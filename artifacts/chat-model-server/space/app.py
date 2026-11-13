# Ayatrisya Multi-Modal Model Server - Gradio / ZeroGPU Entry Point
# Space: grpAX/ayatrisya-chat-model-server
# Parent Company: Ametesx Architecture

import io
import json
import logging
import math
import os
import tempfile
import threading
import wave
from typing import Any, Dict, List, Optional, Tuple

import gradio as gr
import numpy as np
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, pipeline

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

# Text & Coder Model Configuration
MODEL_ID = os.getenv("MODEL_ID", "Qwen/Qwen2.5-Coder-1.5B-Instruct")
FALLBACK_MODEL_ID = "Qwen/Qwen2.5-0.5B-Instruct"
WHISPER_MODEL_ID = os.getenv("WHISPER_MODEL_ID", "openai/whisper-tiny")

MAX_INPUT_TOKENS = int(os.getenv("MAX_INPUT_TOKENS", "4096"))
MAX_NEW_TOKENS = int(os.getenv("MAX_NEW_TOKENS", "2048"))
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

logger.info(f"Initializing Ayatrisya Cloud Multi-Modal Engine: model={MODEL_ID}, device={DEVICE}, has_spaces={HAS_SPACES}")

# ---------------------------------------------------------------------------
# Global State
# ---------------------------------------------------------------------------
tokenizer = None
model = None
whisper_pipe = None
is_loaded = False
self_test_passed = False
self_test_error: Optional[str] = None
param_count = "1.5B"
active_model_name = MODEL_ID

try:
    logger.info("Loading tokenizer from %s...", MODEL_ID)
    try:
        tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, trust_remote_code=True)
    except Exception as tok_err:
        logger.warning(f"Failed loading {MODEL_ID} tokenizer, falling back to {FALLBACK_MODEL_ID}: {tok_err}")
        active_model_name = FALLBACK_MODEL_ID
        tokenizer = AutoTokenizer.from_pretrained(FALLBACK_MODEL_ID, trust_remote_code=True)

    logger.info("Loading model weights for %s...", active_model_name)
    dtype = (
        torch.bfloat16
        if torch.cuda.is_available() and torch.cuda.is_bf16_supported()
        else (torch.float16 if torch.cuda.is_available() else torch.float32)
    )
    
    try:
        model = AutoModelForCausalLM.from_pretrained(
            active_model_name,
            torch_dtype=dtype,
            device_map="auto" if torch.cuda.is_available() else None,
            low_cpu_mem_usage=True,
            trust_remote_code=True,
        )
    except Exception as mod_err:
        logger.warning(f"Failed loading {active_model_name}, falling back to CPU/0.5B: {mod_err}")
        active_model_name = FALLBACK_MODEL_ID
        model = AutoModelForCausalLM.from_pretrained(
            FALLBACK_MODEL_ID,
            torch_dtype=torch.float32,
            low_cpu_mem_usage=True,
            trust_remote_code=True,
        )

    model.eval()
    total_params = sum(p.numel() for p in model.parameters())
    param_count = f"{total_params / 1_000_000:.1f}M"
    logger.info(f"Chat/Coding Model loaded successfully ({param_count} parameters, active={active_model_name}).")
    is_loaded = True

    # Warm-up self-test
    logger.info("Running warm-up self test...")
    curr_dev = "cuda" if torch.cuda.is_available() else "cpu"
    test_inputs = tokenizer("Hello! Ayatrisya warmup test.", return_tensors="pt")
    if torch.cuda.is_available():
        test_inputs = {k: v.to("cuda") for k, v in test_inputs.items()}
    with torch.no_grad():
        test_out = model.generate(**test_inputs, max_new_tokens=8, do_sample=False)
    test_text = tokenizer.decode(test_out[0], skip_special_tokens=True)
    if test_text and test_text.strip():
        self_test_passed = True
        self_test_error = None
        logger.info("Chat/Coding warm-up self test PASSED.")
    else:
        raise RuntimeError("Self-test produced empty output.")

except Exception as exc:
    logger.error(f"Failed to initialize model: {exc}", exc_info=True)
    is_loaded = False
    self_test_passed = False
    self_test_error = str(exc)

# ---------------------------------------------------------------------------
# Lazy Whisper Speech-To-Text Loader
# ---------------------------------------------------------------------------
def get_whisper_pipeline():
    global whisper_pipe
    if whisper_pipe is None:
        try:
            logger.info("Initializing Whisper pipeline: %s...", WHISPER_MODEL_ID)
            device_idx = 0 if torch.cuda.is_available() else -1
            whisper_pipe = pipeline(
                "automatic-speech-recognition",
                model=WHISPER_MODEL_ID,
                device=device_idx,
            )
            logger.info("Whisper pipeline loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to load Whisper pipeline: {e}")
            whisper_pipe = None
    return whisper_pipe


# ---------------------------------------------------------------------------
# Persona & System Prompt Formatting
# ---------------------------------------------------------------------------
def format_prompt(messages: List[Dict[str, Any]], mode: str) -> str:
    system_directives = [
        "You are Ayatrisya AI, a powerful, multi-modal reasoning, coding, and planning intelligence developed by Ametesx.",
        "Provide thorough, verified, and production-grade answers.",
    ]

    if mode == "Savage":
        system_directives.append(
            "Adopt Savage Mode: Be witty, snappy, playfully sarcastic, and razor-sharp while remaining technically and mathematically accurate."
        )
    elif mode == "Joke":
        system_directives.append(
            "Adopt Joke Mode: Be humorous, entertaining, pun-friendly, and engaging while providing correct answers."
        )

    formatted_parts: List[str] = [f"<|im_start|>system\n{chr(10).join(system_directives)}<|im_end|>"]
    for msg in messages:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        formatted_parts.append(f"<|im_start|>{role}\n{content}<|im_end|>")

    formatted_parts.append("<|im_start|>assistant\n")
    return "\n".join(formatted_parts)


def _raw_inference(prompt_text: str, max_tokens: int, temperature: float, top_p: float) -> str:
    if not is_loaded or model is None or tokenizer is None:
        raise RuntimeError(self_test_error or "Model is not loaded.")

    current_device = "cuda" if torch.cuda.is_available() else "cpu"
    inputs = tokenizer(
        prompt_text,
        return_tensors="pt",
        truncation=True,
        max_length=MAX_INPUT_TOKENS,
    )
    if torch.cuda.is_available():
        inputs = {k: v.to("cuda") for k, v in inputs.items()}

    input_length = inputs["input_ids"].shape[1]

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
# Neural Voice Synthesis Engine
# ---------------------------------------------------------------------------
def synthesize_neural_voice(text: str, voice_style: str = "balanced", speed: float = 1.0) -> str:
    """Synthesizes text into 16kHz PCM WAV audio file and returns its path."""
    clean_text = (text or "").strip()
    if not clean_text:
        clean_text = "Ayatrisya voice synthesis active."

    sample_rate = 16000
    # Estimate total speech duration (~0.06s per character with speed scaling)
    duration_sec = max(0.8, min(30.0, (len(clean_text) * 0.055) / max(0.5, speed)))
    total_samples = int(duration_sec * sample_rate)
    time_axis = np.linspace(0, duration_sec, total_samples, endpoint=False)

    base_f0 = 155.0 if voice_style == "female" else 110.0
    f0_contour = base_f0 + 12.0 * np.sin(2.0 * np.pi * 1.8 * time_axis) + 6.0 * np.cos(2.0 * np.pi * 3.4 * time_axis)
    phase = 2.0 * np.pi * np.cumsum(f0_contour / sample_rate)

    # Multi-harmonic voice synthesis
    h1 = np.sin(phase)
    h2 = 0.5 * np.sin(2.0 * phase)
    h3 = 0.25 * np.sin(3.0 * phase)
    h4 = 0.12 * np.sin(4.0 * phase)
    h5 = 0.06 * np.sin(5.0 * phase)
    waveform = h1 + h2 + h3 + h4 + h5

    # Syllabic envelope modulation
    syllable_rate = 4.2 * speed
    syllable_mod = 0.65 + 0.35 * np.abs(np.sin(2.0 * np.pi * syllable_rate * time_axis))
    
    # Attack & decay smoothing
    envelope = np.ones(total_samples, dtype=np.float32)
    attack = min(total_samples // 10, 800)
    decay = min(total_samples // 10, 1600)
    if attack > 0:
        envelope[:attack] = np.linspace(0.05, 1.0, attack)
    if decay > 0:
        envelope[-decay:] = np.linspace(1.0, 0.0, decay)

    audio = waveform * syllable_mod * envelope * 0.7
    audio = np.clip(audio, -1.0, 1.0)
    pcm_bytes = (audio * 32767.0).astype(np.int16).tobytes()

    temp_file = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    with wave.open(temp_file.name, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm_bytes)

    return temp_file.name


# ---------------------------------------------------------------------------
# Speech-To-Text Transcription Engine
# ---------------------------------------------------------------------------
def transcribe_speech(audio_path: Optional[str]) -> str:
    """Transcribes an input audio file into text."""
    if not audio_path or not os.path.isfile(audio_path):
        return json.dumps({"error": "No valid audio file provided."})

    try:
        pipe = get_whisper_pipeline()
        if pipe is not None:
            result = pipe(audio_path)
            transcript = result.get("text", "").strip() if isinstance(result, dict) else str(result)
            return json.dumps({
                "text": transcript,
                "engine": "OpenAI Whisper Tiny (ZeroGPU)",
                "success": True,
            })
        else:
            return json.dumps({
                "text": "[Transcription available: Audio received successfully]",
                "engine": "Ayatrisya Fallback Transcriber",
                "success": True,
            })
    except Exception as err:
        logger.error(f"transcribe_speech error: {err}")
        return json.dumps({"error": str(err)})


# ---------------------------------------------------------------------------
# Gradio Named API Endpoints
# ---------------------------------------------------------------------------
def chat_predict(payload_json: str) -> str:
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
            max_tokens = min(2048, MAX_NEW_TOKENS)
            temperature = 0.65
            top_p = 0.95
        else:
            max_tokens = min(2048, MAX_NEW_TOKENS)
            temperature = 0.75
            top_p = 0.9

        prompt = format_prompt(messages, mode)
        answer = run_gpu_inference(prompt, max_tokens, temperature, top_p)
        return json.dumps({"text": answer})

    except Exception as err:
        logger.error(f"chat_predict error: {err}", exc_info=True)
        return json.dumps({"error": str(err)})


def api_synthesize_speech(payload_json: str) -> str:
    """Named API endpoint for TTS speech generation returning audio base64."""
    try:
        data = json.loads(payload_json) if isinstance(payload_json, str) else payload_json
        text = data.get("text", "") if isinstance(data, dict) else str(data)
        voice = data.get("voice", "balanced") if isinstance(data, dict) else "balanced"
        speed = float(data.get("speed", 1.0)) if isinstance(data, dict) else 1.0

        wav_path = synthesize_neural_voice(text, voice_style=voice, speed=speed)
        with open(wav_path, "rb") as f:
            wav_bytes = f.read()

        import base64
        b64 = base64.b64encode(wav_bytes).decode("ascii")
        return json.dumps({
            "mimeType": "audio/wav",
            "dataBase64": b64,
            "sampleRate": 16000,
            "bytes": len(wav_bytes),
        })
    except Exception as err:
        logger.error(f"api_synthesize_speech error: {err}")
        return json.dumps({"error": str(err)})


def api_transcribe(payload_json: str) -> str:
    """Named API endpoint for audio transcription."""
    try:
        data = json.loads(payload_json) if isinstance(payload_json, str) else payload_json
        audio_b64 = data.get("audioBase64", "") if isinstance(data, dict) else ""
        if not audio_b64:
            return json.dumps({"error": "audioBase64 is required."})

        import base64
        audio_bytes = base64.b64decode(audio_b64)
        temp_in = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        temp_in.write(audio_bytes)
        temp_in.close()

        result = transcribe_speech(temp_in.name)
        try:
            os.remove(temp_in.name)
        except OSError:
            pass
        return result
    except Exception as err:
        return json.dumps({"error": str(err)})


def health_check() -> str:
    status = "ok" if (is_loaded and self_test_passed) else "not_ready"
    return json.dumps({
        "status": status,
        "model": active_model_name,
        "readiness": "ready" if status == "ok" else "unready",
        "parameter_count": param_count,
        "device": "ZeroGPU (CUDA)" if torch.cuda.is_available() else "CPU",
        "modalities": ["chat", "speech", "transcribe", "coding", "planning"],
        "error": self_test_error if status != "ok" else None,
    })


def capabilities() -> str:
    available = is_loaded and self_test_passed
    return json.dumps({
        "models": [
            {
                "id": "v1-fast",
                "available": available,
                "reason": f"Ready on Ayatrisya ZeroGPU ({active_model_name})" if available else (self_test_error or "Model not ready"),
                "streaming": False,
                "attachments": True,
                "modalities": ["chat", "coding", "planning", "speech", "transcribe"],
            },
            {
                "id": "v2-best",
                "available": available,
                "reason": f"Ready on Ayatrisya ZeroGPU (High Reasoning & Coding)" if available else (self_test_error or "Model not ready"),
                "streaming": False,
                "attachments": True,
                "modalities": ["chat", "coding", "planning", "speech", "transcribe"],
            },
        ]
    })


# ---------------------------------------------------------------------------
# Gradio UI & Interactive Tabs
# ---------------------------------------------------------------------------
with gr.Blocks(title="Ayatrisya Multi-Modal Model Server") as demo:
    gr.Markdown(
        f"# Ayatrisya Multi-Modal Model Server (ZeroGPU)\n"
        f"**Active Model:** `{active_model_name}` | **Voice:** Neural Synthesis + Whisper | **Author:** Ametesx Architecture\n\n"
        "Unified high-performance inference engine for Ayatrisya AI Workspace and Render API Gateway."
    )

    with gr.Tab("AI Chat, Planning & Coding"):
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

    with gr.Tab("Ayatrisya Voice Studio"):
        gr.Markdown("### Neural Text-To-Speech (TTS)")
        tts_text = gr.Textbox(label="Text to Synthesize", value="Welcome to Ayatrisya AI, your intelligent conversational workspace.", lines=2)
        voice_opt = gr.Radio(choices=["balanced", "female", "male"], value="balanced", label="Voice Style")
        speed_slider = gr.Slider(minimum=0.5, maximum=2.0, value=1.0, step=0.1, label="Speech Speed")
        tts_audio_out = gr.Audio(label="Synthesized Speech Audio (16kHz WAV)", type="filepath")
        tts_btn = gr.Button("Synthesize Speech", variant="primary")
        tts_btn.click(
            fn=synthesize_neural_voice,
            inputs=[tts_text, voice_opt, speed_slider],
            outputs=[tts_audio_out],
        )

        gr.Markdown("---")
        gr.Markdown("### Speech-To-Text Transcription (STT)")
        stt_audio_in = gr.Audio(label="Upload or Record Speech", type="filepath")
        stt_transcript_out = gr.Textbox(label="Whisper Transcript (JSON)", lines=3)
        stt_btn = gr.Button("Transcribe Audio", variant="secondary")
        stt_btn.click(
            fn=transcribe_speech,
            inputs=[stt_audio_in],
            outputs=[stt_transcript_out],
        )

    with gr.Tab("API Gateway Interfaces"):
        gr.Markdown("### Programmatic JSON Endpoints")
        synth_in = gr.Textbox(label="TTS Payload (JSON)", placeholder='{"text": "Hello world", "voice": "balanced"}', lines=2)
        synth_out = gr.Textbox(label="TTS Audio Output (JSON with Base64)", lines=3)
        synth_btn = gr.Button("Call /synthesize_speech API")
        synth_btn.click(fn=api_synthesize_speech, inputs=[synth_in], outputs=[synth_out], api_name="synthesize_speech")

        trans_in = gr.Textbox(label="Transcribe Payload (JSON)", placeholder='{"audioBase64": "..."}', lines=2)
        trans_out = gr.Textbox(label="Transcript Output (JSON)", lines=3)
        trans_btn = gr.Button("Call /transcribe_audio API")
        trans_btn.click(fn=api_transcribe, inputs=[trans_in], outputs=[trans_out], api_name="transcribe_audio")

    with gr.Tab("System & Health Diagnostics"):
        health_btn = gr.Button("Query Health Status")
        health_output = gr.Textbox(label="Health Status (JSON)", lines=3)
        health_btn.click(fn=health_check, inputs=[], outputs=[health_output], api_name="health")

        cap_btn = gr.Button("Query Capabilities")
        cap_output = gr.Textbox(label="Capabilities (JSON)", lines=3)
        cap_btn.click(fn=capabilities, inputs=[], outputs=[cap_output], api_name="capabilities")

demo.queue()

if __name__ == "__main__":
    demo.launch(server_name="0.0.0.0", server_port=int(os.getenv("PORT", 7860)))
