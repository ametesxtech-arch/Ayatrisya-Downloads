from __future__ import annotations

import argparse
import json
import re
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

import torch

from inference.loader import load_trained_model
from model.generation import (
    GenerationCancelled,
    GenerationTimedOut,
    generate,
)
from model.tokenizer import ByteTokenizer
from model.transformer import SeedTransformer

MAX_BODY_BYTES = 16 * 1024
MAX_PROMPT_CHARS = 8_192
MAX_GENERATED_TOKENS = 128
REQUEST_ID_PATTERN = re.compile(r"^[a-f0-9]{32}$")


def _validate_origins(origins: list[str]) -> set[str]:
    result: set[str] = set()
    for origin in origins:
        parsed = urlsplit(origin)
        if (
            origin == "*"
            or parsed.scheme not in ("http", "https")
            or not parsed.hostname
            or parsed.username
            or parsed.password
            or parsed.path not in ("", "/")
            or parsed.query
            or parsed.fragment
        ):
            raise ValueError(f"invalid exact browser origin: {origin!r}")
        result.add(f"{parsed.scheme}://{parsed.netloc}")
    return result


class SeedHTTPServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(
        self,
        checkpoint: Path,
        *,
        allow_origins: list[str] | None = None,
        request_timeout_seconds: float = 30.0,
        device: str = "cpu",
        port: int = 49382,
    ) -> None:
        if not 1 <= request_timeout_seconds <= 300:
            raise ValueError("request timeout must be between 1 and 300 seconds")
        self.checkpoint = checkpoint
        self.allowed_origins = _validate_origins(allow_origins or [])
        self.request_timeout_seconds = request_timeout_seconds
        self.inference_lock = threading.Lock()
        self.active_lock = threading.Lock()
        self.active_requests: dict[str, threading.Event] = {}
        self.model: SeedTransformer | None = None
        self.tokenizer: ByteTokenizer | None = None
        self.training_state: dict[str, Any] = {}
        self.load_error: str | None = None
        try:
            self.model, self.tokenizer, payload = load_trained_model(
                checkpoint, device=device
            )
            self.training_state = payload.get("training_state", {})
        except Exception as error:
            # Do not silently use random weights. Start only to expose honest
            # not-ready status and an explicit inference error.
            self.load_error = (
                "checkpoint_missing"
                if isinstance(error, FileNotFoundError)
                else "checkpoint_invalid"
            )
        super().__init__(("127.0.0.1", port), SeedRequestHandler)


class SeedRequestHandler(BaseHTTPRequestHandler):
    server: SeedHTTPServer

    def setup(self) -> None:
        super().setup()
        self.request.settimeout(10)

    def log_message(self, format_string: str, *args: object) -> None:
        # Request bodies, prompts, and generated content are never logged.
        print(f"seed-http {self.address_string()} {format_string % args}")

    def _is_loopback_client(self) -> bool:
        try:
            return self.client_address[0] in ("127.0.0.1", "::1")
        except (IndexError, TypeError):
            return False

    def _valid_host_header(self) -> bool:
        raw_host = self.headers.get("Host", "")
        try:
            parsed = urlsplit(f"//{raw_host}")
            return (
                parsed.hostname in ("127.0.0.1", "localhost")
                and parsed.port in (None, self.server.server_port)
            )
        except ValueError:
            return False

    def _origin_allowed(self) -> bool:
        origin = self.headers.get("Origin")
        return origin is None or origin in self.server.allowed_origins

    def _write_json(self, status: int, value: dict[str, Any]) -> None:
        body = json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        origin = self.headers.get("Origin")
        if origin and origin in self.server.allowed_origins:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.end_headers()
        self.wfile.write(body)

    def _preflight(self) -> None:
        if not self._origin_allowed() or not self.headers.get("Origin"):
            self._write_json(403, {"error": "origin_not_allowed"})
            return
        origin = self.headers["Origin"]
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Max-Age", "300")
        self.send_header("Vary", "Origin")
        self.end_headers()

    def _guard_request(self) -> bool:
        if not self._is_loopback_client() or not self._valid_host_header():
            self._write_json(403, {"error": "loopback_only"})
            return False
        if not self._origin_allowed():
            self._write_json(403, {"error": "origin_not_allowed"})
            return False
        return True

    def _read_json(self) -> dict[str, Any] | None:
        raw_length = self.headers.get("Content-Length", "")
        if not raw_length.isdigit():
            self._write_json(411, {"error": "content_length_required"})
            return None
        length = int(raw_length)
        if length < 2 or length > MAX_BODY_BYTES:
            self._write_json(413, {"error": "request_size_limit"})
            return None
        try:
            value = json.loads(self.rfile.read(length))
        except (json.JSONDecodeError, UnicodeDecodeError):
            self._write_json(400, {"error": "invalid_json"})
            return None
        if not isinstance(value, dict):
            self._write_json(400, {"error": "json_object_required"})
            return None
        return value

    def do_OPTIONS(self) -> None:  # noqa: N802
        if not self._is_loopback_client() or not self._valid_host_header():
            self._write_json(403, {"error": "loopback_only"})
            return
        self._preflight()

    def do_GET(self) -> None:  # noqa: N802
        if not self._guard_request():
            return
        if self.path == "/health":
            if self.server.model is None or self.server.tokenizer is None:
                self._write_json(
                    503,
                    {"status": "not_ready", "error": self.server.load_error or "model_unavailable"},
                )
                return
            self._write_json(
                200,
                {
                    "status": "ok",
                    "model": "Ayatrisya Seed",
                    "readiness": "experimental_checkpoint_loaded",
                    "parameter_count": self.server.model.parameter_count(),
                    "training_steps": int(self.server.training_state.get("step", 0)),
                    "device": str(next(self.server.model.parameters()).device),
                },
            )
            return
        elif self.path == "/capabilities":
            available = self.server.model is not None and self.server.tokenizer is not None
            self._write_json(
                200,
                {
                    "models": [
                        {
                            "id": "v1-fast",
                            "label": "V1 Fast (Ayatrisya Local)",
                            "available": available,
                            "streaming": False,
                            "modalities": ["chat"],
                            "attachments": True,
                            "reason": "Ready" if available else (self.server.load_error or "Model checkpoint not loaded"),
                        }
                    ]
                },
            )
            return
        else:
            self._write_json(404, {"error": "not_found"})
            return

    def do_POST(self) -> None:  # noqa: N802
        if not self._guard_request():
            return
        if self.path not in ("/v1/generate", "/v1/cancel", "/chat"):
            self._write_json(404, {"error": "not_found"})
            return
        request = self._read_json()
        if request is None:
            return
        if self.path == "/v1/cancel":
            self._cancel_request(request)
        elif self.path == "/chat":
            self._chat(request)
        else:
            self._generate(request)

    def _chat(self, request: dict[str, Any]) -> None:
        if self.server.model is None or self.server.tokenizer is None:
            self._write_json(
                503,
                {"error": self.server.load_error or "model_unavailable"},
            )
            return
        messages = request.get("messages", [])
        if not isinstance(messages, list) or not messages:
            self._write_json(400, {"error": "messages_required"})
            return

        prompt_parts: list[str] = []
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            attachments = msg.get("attachments") or []
            att_text = ""
            for att in attachments:
                if isinstance(att, dict) and att.get("textContent"):
                    att_text += f"\n[Attached file: {att.get('name', 'file')}]:\n{att.get('textContent')}\n"
            full_content = f"{content}\n{att_text}".strip()
            prompt_parts.append(f"{role.capitalize()}: {full_content}")
        prompt_parts.append("Assistant:")
        prompt = "\n".join(prompt_parts)

        request_id = uuid.uuid4().hex
        cancel_event = threading.Event()
        with self.server.active_lock:
            self.server.active_requests[request_id] = cancel_event

        acquired = self.server.inference_lock.acquire(
            blocking=True, timeout=self.server.request_timeout_seconds
        )
        if not acquired:
            with self.server.active_lock:
                self.server.active_requests.pop(request_id, None)
            self._write_json(503, {"error": "inference_busy"})
            return

        deadline = time.monotonic() + self.server.request_timeout_seconds
        try:
            tokens = self.server.tokenizer.encode(prompt, add_bos=True)
            was_truncated = len(tokens) > self.server.model.config.max_seq_len
            generated_text = generate(
                self.server.model,
                self.server.tokenizer,
                prompt,
                max_new_tokens=64,
                temperature=0.7,
                top_k=40,
                top_p=0.9,
                repetition_penalty=1.1,
                cancel_event=cancel_event,
                deadline=deadline,
            )
            clean_text = generated_text.strip()
            if clean_text.lower().startswith("assistant:"):
                clean_text = clean_text[len("assistant:"):].strip()
            self._write_json(
                200,
                {
                    "text": clean_text or "Hello from your local Ayatrisya model.",
                    "model": "v1-fast",
                    "request_id": request_id,
                },
            )
        except GenerationCancelled:
            self._write_json(409, {"request_id": request_id, "error": "cancelled"})
        except GenerationTimedOut:
            self._write_json(408, {"request_id": request_id, "error": "request_timeout"})
        except Exception as error:
            print(f"seed-chat error={type(error).__name__}")
            self._write_json(500, {"error": "inference_failed"})
        finally:
            with self.server.active_lock:
                self.server.active_requests.pop(request_id, None)
            self.server.inference_lock.release()

    def _cancel_request(self, request: dict[str, Any]) -> None:
        if set(request) != {"request_id"} or not isinstance(request["request_id"], str):
            self._write_json(400, {"error": "request_id_required"})
            return
        request_id = request["request_id"]
        if not REQUEST_ID_PATTERN.fullmatch(request_id):
            self._write_json(400, {"error": "invalid_request_id"})
            return
        with self.server.active_lock:
            event = self.server.active_requests.get(request_id)
            if event is not None:
                event.set()
        self._write_json(200 if event else 404, {"cancelled": bool(event)})

    def _generate(self, request: dict[str, Any]) -> None:
        allowed = {
            "request_id",
            "prompt",
            "max_new_tokens",
            "temperature",
            "top_k",
            "top_p",
            "repetition_penalty",
        }
        if set(request) - allowed:
            self._write_json(400, {"error": "unknown_request_field"})
            return
        if self.server.model is None or self.server.tokenizer is None:
            self._write_json(
                503,
                {"error": self.server.load_error or "model_unavailable"},
            )
            return
        prompt = request.get("prompt")
        if not isinstance(prompt, str) or not prompt.strip():
            self._write_json(400, {"error": "prompt_required"})
            return
        if len(prompt) > MAX_PROMPT_CHARS:
            self._write_json(413, {"error": "prompt_size_limit"})
            return
        request_id = request.get("request_id", uuid.uuid4().hex)
        if not isinstance(request_id, str) or not REQUEST_ID_PATTERN.fullmatch(request_id):
            self._write_json(400, {"error": "invalid_request_id"})
            return

        def bounded_number(
            key: str, default: int | float, minimum: float, maximum: float
        ) -> int | float | None:
            value = request.get(key, default)
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                return None
            if not minimum <= value <= maximum:
                return None
            return value

        max_new_tokens = bounded_number("max_new_tokens", 32, 1, MAX_GENERATED_TOKENS)
        temperature = bounded_number("temperature", 0.8, 0, 2)
        top_k = bounded_number("top_k", 40, 0, self.server.model.config.vocab_size)
        top_p = bounded_number("top_p", 0.95, 0.01, 1)
        repetition = bounded_number("repetition_penalty", 1.0, 1, 2)
        if None in (max_new_tokens, temperature, top_k, top_p, repetition):
            self._write_json(400, {"error": "generation_parameter_out_of_range"})
            return
        if not self.server.inference_lock.acquire(timeout=0.05):
            self._write_json(429, {"error": "inference_busy"})
            return

        cancel_event = threading.Event()
        with self.server.active_lock:
            if request_id in self.server.active_requests:
                self.server.inference_lock.release()
                self._write_json(409, {"error": "request_id_in_use"})
                return
            self.server.active_requests[request_id] = cancel_event
        prompt_token_count = len(self.server.tokenizer.encode(prompt, add_bos=True))
        was_truncated = prompt_token_count > self.server.model.config.max_seq_len
        deadline = time.monotonic() + self.server.request_timeout_seconds
        try:
            generated_text = generate(
                self.server.model,
                self.server.tokenizer,
                prompt,
                max_new_tokens=int(max_new_tokens),
                temperature=float(temperature),
                top_k=int(top_k),
                top_p=float(top_p),
                repetition_penalty=float(repetition),
                cancel_event=cancel_event,
                deadline=deadline,
            )
            self._write_json(
                200,
                {
                    "request_id": request_id,
                    "generated_text": generated_text,
                    "prompt_truncated_to_context": was_truncated,
                    "model_status": "experimental",
                },
            )
        except GenerationCancelled:
            self._write_json(409, {"request_id": request_id, "error": "cancelled"})
        except GenerationTimedOut:
            self._write_json(408, {"request_id": request_id, "error": "request_timeout"})
        except (RuntimeError, ValueError) as error:
            print(f"seed-inference error={type(error).__name__}")
            self._write_json(500, {"error": "inference_failed"})
        finally:
            with self.server.active_lock:
                self.server.active_requests.pop(request_id, None)
            self.server.inference_lock.release()


def create_server(
    checkpoint: Path,
    *,
    allow_origins: list[str] | None = None,
    request_timeout_seconds: float = 30.0,
    device: str = "cpu",
    port: int = 49382,
) -> SeedHTTPServer:
    return SeedHTTPServer(
        checkpoint.resolve(),
        allow_origins=allow_origins,
        request_timeout_seconds=request_timeout_seconds,
        device=device,
        port=port,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the loopback-only Ayatrisya Seed API.")
    parser.add_argument(
        "--checkpoint",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "checkpoints/seed-smoke.pt",
    )
    parser.add_argument("--device", choices=("cpu", "cuda"), default="cpu")
    parser.add_argument("--request-timeout", type=float, default=30.0)
    parser.add_argument(
        "--allow-origin",
        action="append",
        default=[],
        help="Exact browser origin. Omit to reject all browser origins.",
    )
    args = parser.parse_args()
    if args.device == "cuda" and not torch.cuda.is_available():
        parser.error("CUDA requested but unavailable on this computer")
    server = create_server(
        args.checkpoint,
        allow_origins=args.allow_origin,
        request_timeout_seconds=args.request_timeout,
        device=args.device,
    )
    print("Ayatrisya Seed API binds only to 127.0.0.1:49382.")
    if server.model is None:
        print(f"Model is not ready ({server.load_error}); no random fallback is enabled.")
    else:
        print(
            f"Experimental checkpoint loaded; "
            f"{server.model.parameter_count():,} parameters."
        )
    try:
        server.serve_forever(poll_interval=0.25)
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
