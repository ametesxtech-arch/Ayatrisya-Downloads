# Ayatrisya Chat Model Server - Gradio / ZeroGPU Entry Point
# Space: grpAX/ayatrisya-chat-model-server
# Parent Company: Ametesx

import json
import logging
import os
import threading
from typing import Any, Dict, List, Optional

import gradio as gr
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

try:
    import spaces  # type: ignore
    HAS_SPACES = True
except ImportError:
    HAS_SPACES = False

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("ayatrisya.zerogpu")

MODEL_ID = os.getenv("MODEL_ID", "Qwen/Qwen2.5-0.5B-Instruct")
MAX_INPUT_TOKENS = int(os.getenv("MAX_INPUT_TOKENS", "4096"))
MAX_NEW_TOKENS = int(os.getenv("MAX_NEW_TOKENS", "512"))
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

logger.info(f"Initializing Ayatrisya ZeroGPU Engine: model={MODEL_ID}, device={DEVICE}, has_spaces={HAS_SPACES}")

# ---------------------------------------------------------------------------
# Global Model & Tokenizer (Loaded at module level for ZeroGPU context)
# ---------------------------------------------------------------------------
tokenizer = None
model = None
is_loaded = False
self_test_passed = False
self_test_error: Optional[str] = None
param_count = "490M"

try:
    logger.info("Loading tokenizer from %s...", MODEL_ID)
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, trust_remote_code=True)

    logger.info("Loading model weights for %s...", MODEL_ID)
    dtype = torch.bfloat16 if torch.cuda.is_available() and torch.cuda.is_bf16_supported() else (
        torch.float16 if torch.cuda.is_available() else torch.float32
    )
    model = AutoModelForCausalLM.from_pretrained(
        MODEL_ID,
        torch_dtype=dtype,
        device_map="auto" if torch.cuda.is_available() else None,
        low_cpu_mem_usage=True,
        trust_remote_code=True,
    )
    model.eval()

    total_params = sum(p.numel() for p in model.parameters())
    param_count = f"{total_params / 1_000_000:.1f}M"
    logger.info(f"Model loaded successfully ({param_count} parameters).")
    is_loaded = True

    # Initial self-test
    logger.info("Running initialization warm-up self-test...")
    test_inputs = tokenizer("Hello! Ayatrisya warmup test.", return_tensors="pt")
    if torch.cuda.is_available():
        test_inputs = {k: v.to("cuda") for k, v in test_inputs.items()}
    with torch.no_grad():
        test_out = model.generate(**test_inputs, max_new_tokens=8, do_sample=False)
    test_text = tokenizer.decode(test_out[0], skip_special_tokens=True)
    if test_text and test_text.strip():
        self_test_passed = True
        self_test_error = None
        logger.info("Initialization self-test PASSED.")
    else:
        raise RuntimeError("Self-test produced empty output.")

except Exception as exc:
    logger.error(f"Failed to initialize model or warm-up test: {exc}", exc_info=True)
    is_loaded = False
    self_test_passed = False
    self_test_error = str(exc)


# ---------------------------------------------------------------------------
# Persona & Prompt Formatting Helper
# ---------------------------------------------------------------------------
def format_prompt(messages: List[Dict[str, Any]], mode: str) -> str:
    if mode == "Savage":
        tone_prompt = (
            "You are Ayatrisya AI in Savage Mode. Be witty, snappy, sharp, and playfully sarcastic "
            "while ensuring technical, mathematical, and logical accuracy. Do not be offensive or harmful."
        )
    elif mode == "Joke":
        tone_prompt = (
            "You are Ayatrisya AI in Joke Mode. Be funny, lighthearted, pun-friendly, and entertaining "
            "while still giving clear answers."
        )
    else:
        tone_prompt = (
            "You are Ayatrisya AI, a premier intelligent reasoning, coding, and creative assistant created by Ametesx.\n"
            "Core Principles:\n"
            "1. Direct Answer First: Begin directly with the answer to the user's specific question.\n"
            "2. Conversational Tone: Natural, clear, engaging, and precise.\n"
            "3. Mathematical Notation: Always use standard LaTeX delimiters ($...$ for inline, $$...$$ for display equations).\n"
            "4. Code Quality: Tag code blocks with exact language identifiers (```python, ```typescript, ```rust, etc.)."
        )

    conversation_history: List[dict] = [{"role": "system", "content": tone_prompt}]

    for msg in messages:
        content = msg.get("content", "")
        # Attachments support
        attachments = msg.get("attachments") or []
        for att in attachments:
            if isinstance(att, dict) and att.get("textContent"):
                content += f"\n\n[Attached File: {att.get('name', 'file')} ({att.get('mimeType', 'text/plain')}]:\n{att.get('textContent')}"
            elif isinstance(att, dict) and att.get("dataBase64") and not att.get("textContent"):
                content += f"\n\n[Attached Image: {att.get('name', 'image')} - Note: Visual/multimodal image understanding is not supported on this text-only Qwen model.]"

        conversation_history.append({"role": msg.get("role", "user"), "content": content})

    if tokenizer and hasattr(tokenizer, "apply_chat_template"):
        try:
            return tokenizer.apply_chat_template(
                conversation_history,
                tokenize=False,
                add_generation_prompt=True,
            )
        except Exception:
            pass

    # ChatML fallback
    lines: List[str] = [f"<|im_start|>system\n{tone_prompt}<|im_end|>"]
    for item in conversation_history[1:]:
        lines.append(f"<|im_start|>{item['role']}\n{item['content']}<|im_end|>")
    lines.append("<|im_start|>assistant\n")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# ZeroGPU Decorated Inference Function
# ---------------------------------------------------------------------------
def _raw_inference(prompt_text: str, max_tokens: int, temperature: float, top_p: float) -> str:
    if not model or not tokenizer:
        raise RuntimeError(self_test_error or "Model is not loaded on this Space.")

    current_device = "cuda" if torch.cuda.is_available() else "cpu"
    inputs = tokenizer(
        prompt_text,
        return_tensors="pt",
        truncation=True,
        max_length=MAX_INPUT_TOKENS,
    ).to(current_device)

    input_length = inputs.input_ids.shape[1]

    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=min(max_tokens, MAX_NEW_TOKENS),
            do_sample=True,
            temperature=temperature,
            top_p=top_p,
            repetition_penalty=1.1,
            pad_token_id=tokenizer.eos_token_id,
        )

    generated_tokens = outputs[0][input_length:]
    return tokenizer.decode(generated_tokens, skip_special_tokens=True).strip()


if HAS_SPACES:
    @spaces.GPU(duration=60)
    def run_gpu_inference(prompt_text: str, max_tokens: int, temperature: float, top_p: float) -> str:
        return _raw_inference(prompt_text, max_tokens, temperature, top_p)
else:
    def run_gpu_inference(prompt_text: str, max_tokens: int, temperature: float, top_p: float) -> str:
        return _raw_inference(prompt_text, max_tokens, temperature, top_p)


# ---------------------------------------------------------------------------
# Gradio Endpoints
# ---------------------------------------------------------------------------
def chat_predict(payload_json: str) -> str:
    """
    Standard Ayatrisya Chat API prediction endpoint.
    Takes a JSON serialized SendModelChatBody:
    {
      "messages": [{"role": "user", "content": "..."}],
      "model": "v1-fast" | "v2-best",
      "mode": "Normal" | "Savage" | "Joke",
      "stream": false
    }
    Returns JSON serialized SendModelChatResponse:
    {
      "text": "..."
    }
    """
    try:
        data = json.loads(payload_json) if isinstance(payload_json, str) else payload_json
        if not isinstance(data, dict):
            return json.dumps({"error": "Payload must be a JSON object."})

        messages = data.get("messages")
        if not messages or not isinstance(messages, list):
            return json.dumps({"error": "messages list is required."})

        mode = data.get("mode", "Normal")
        model_choice = data.get("model", "v1-fast")

        if model_choice == "v2-best":
            max_tokens = min(512, MAX_NEW_TOKENS)
            temperature = 0.65
            top_p = 0.95
        else:
            max_tokens = min(256, MAX_NEW_TOKENS)
            temperature = 0.75
            top_p = 0.9

        prompt = format_prompt(messages, mode)
        answer = run_gpu_inference(prompt, max_tokens, temperature, top_p)

        return json.dumps({"text": answer})

    except Exception as err:
        logger.error(f"chat_predict error: {err}", exc_info=True)
        return json.dumps({"error": str(err)})


def health_check() -> str:
    """Returns honest model readiness and hardware status."""
    status = "ok" if (is_loaded and self_test_passed) else "not_ready"
    return json.dumps({
        "status": status,
        "model": "Qwen/Qwen2.5-0.5B-Instruct",
        "readiness": "ready" if status == "ok" else "unready",
        "parameter_count": param_count,
        "device": "ZeroGPU (CUDA)" if torch.cuda.is_available() else "CPU",
        "error": self_test_error if status != "ok" else None,
    })


def capabilities() -> str:
    """Returns supported models and modalities."""
    available = is_loaded and self_test_passed
    return json.dumps({
        "models": [
            {
                "id": "v1-fast",
                "available": available,
                "reason": "Ready on Ayatrisya ZeroGPU" if available else (self_test_error or "Model not ready"),
                "streaming": False,
                "attachments": True,
                "modalities": ["chat"],
            },
            {
                "id": "v2-best",
                "available": available,
                "reason": "Ready on Ayatrisya ZeroGPU (High Reasoning)" if available else (self_test_error or "Model not ready"),
                "streaming": False,
                "attachments": True,
                "modalities": ["chat"],
            },
        ]
    })


# ---------------------------------------------------------------------------
# Gradio UI & Named API Endpoints
# ---------------------------------------------------------------------------
with gr.Blocks(title="Ayatrisya Chat Model Server") as demo:
    gr.Markdown(
        "# Ayatrisya Chat Model Server (ZeroGPU)\n"
        "**Model:** `Qwen/Qwen2.5-0.5B-Instruct` | **Hardware:** Free ZeroGPU | **Author:** Ametesx\n\n"
        "Dedicated inference engine serving Ayatrisya AI production gateway."
    )

    with gr.Tab("API Interface"):
        input_payload = gr.Textbox(
            label="Chat Request Payload (JSON)",
            placeholder='{"messages": [{"role": "user", "content": "hi"}], "model": "v1-fast", "mode": "Normal"}',
            lines=4,
        )
        chat_output = gr.Textbox(label="Chat Response (JSON)", lines=4)
        chat_btn = gr.Button("Send Chat Prediction", variant="primary")
        chat_btn.click(
            fn=chat_predict,
            inputs=[input_payload],
            outputs=[chat_output],
            api_name="predict",
        )

    with gr.Tab("System & Health"):
        health_btn = gr.Button("Query Health Status")
        health_output = gr.Textbox(label="Health Status (JSON)", lines=3)
        health_btn.click(fn=health_check, inputs=[], outputs=[health_output], api_name="health")

        cap_btn = gr.Button("Query Capabilities")
        cap_output = gr.Textbox(label="Capabilities (JSON)", lines=3)
        cap_btn.click(fn=capabilities, inputs=[], outputs=[cap_output], api_name="capabilities")

demo.queue()

if __name__ == "__main__":
    demo.launch(server_name="0.0.0.0", server_port=int(os.getenv("PORT", 7860)))
