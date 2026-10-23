from __future__ import annotations

import http.client
import json
import tempfile
import threading
import unittest
from pathlib import Path

import torch

from inference.server import create_server
from model.config import ModelConfig
from model.tokenizer import ByteTokenizer
from model.transformer import SeedTransformer
from training.checkpoint import save_checkpoint


def write_tiny_checkpoint(path: Path) -> None:
    config = ModelConfig(d_model=32, n_layers=1, n_heads=4, max_seq_len=32)
    torch.manual_seed(2)
    model = SeedTransformer(config)
    save_checkpoint(
        path,
        model=model,
        tokenizer=ByteTokenizer(),
        training_state={"step": 1, "dataset_sha256": "a" * 64},
    )


class InferenceServerTests(unittest.TestCase):
    def test_missing_checkpoint_is_not_ready_and_never_fabricates_output(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            server = create_server(Path(directory) / "missing.pt", port=0)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                self.assertIsNone(server.model)
                self.assertEqual(server.load_error, "checkpoint_missing")
                connection = http.client.HTTPConnection(
                    "127.0.0.1", server.server_port, timeout=5
                )
                connection.request("GET", "/health")
                response = connection.getresponse()
                health = json.loads(response.read())
                self.assertEqual(response.status, 503)
                self.assertEqual(health["status"], "not_ready")
                connection.request(
                    "POST",
                    "/v1/generate",
                    body=json.dumps({"prompt": "do not fake a reply"}),
                    headers={"Content-Type": "application/json"},
                )
                response = connection.getresponse()
                body = json.loads(response.read())
                self.assertEqual(response.status, 503)
                self.assertEqual(body["error"], "checkpoint_missing")
                connection.close()
            finally:
                server.shutdown()
                server.server_close()
                thread.join(timeout=2)

    def test_loopback_api_requires_valid_request_and_generates_from_weights(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            checkpoint = Path(directory) / "model.pt"
            write_tiny_checkpoint(checkpoint)
            server = create_server(checkpoint, port=0, request_timeout_seconds=10)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                connection = http.client.HTTPConnection(
                    "127.0.0.1", server.server_port, timeout=12
                )
                connection.request("GET", "/health")
                response = connection.getresponse()
                health = json.loads(response.read())
                self.assertEqual(response.status, 200)
                self.assertEqual(health["status"], "ready")
                self.assertEqual(health["parameter_count"], server.model.parameter_count())

                request = {
                    "request_id": "a" * 32,
                    "prompt": "A",
                    "max_new_tokens": 2,
                    "temperature": 0,
                    "top_k": 0,
                }
                connection.request(
                    "POST",
                    "/v1/generate",
                    body=json.dumps(request),
                    headers={"Content-Type": "application/json"},
                )
                response = connection.getresponse()
                result = json.loads(response.read())
                self.assertEqual(response.status, 200)
                self.assertEqual(result["request_id"], request["request_id"])
                self.assertIn("generated_text", result)

                connection.request(
                    "POST",
                    "/v1/generate",
                    body=json.dumps({"prompt": "x", "max_new_tokens": 999}),
                    headers={"Content-Type": "application/json"},
                )
                response = connection.getresponse()
                self.assertEqual(response.status, 400)

                cancel_id = "d" * 32
                cancel_event = threading.Event()
                with server.active_lock:
                    server.active_requests[cancel_id] = cancel_event
                connection.request(
                    "POST",
                    "/v1/cancel",
                    body=json.dumps({"request_id": cancel_id}),
                    headers={"Content-Type": "application/json"},
                )
                response = connection.getresponse()
                cancel_result = json.loads(response.read())
                self.assertEqual(response.status, 200)
                self.assertTrue(cancel_result["cancelled"])
                self.assertTrue(cancel_event.is_set())
                with server.active_lock:
                    server.active_requests.pop(cancel_id, None)
                connection.close()
            finally:
                server.shutdown()
                server.server_close()
                thread.join(timeout=2)

    def test_unapproved_browser_origin_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            checkpoint = Path(directory) / "model.pt"
            write_tiny_checkpoint(checkpoint)
            server = create_server(checkpoint, port=0)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                connection = http.client.HTTPConnection(
                    "127.0.0.1", server.server_port, timeout=5
                )
                connection.request(
                    "GET",
                    "/health",
                    headers={"Origin": "https://not-authorized.example"},
                )
                response = connection.getresponse()
                result = json.loads(response.read())
                self.assertEqual(response.status, 403)
                self.assertEqual(result["error"], "origin_not_allowed")
                connection.close()
            finally:
                server.shutdown()
                server.server_close()
                thread.join(timeout=2)


if __name__ == "__main__":
    unittest.main()
