---
title: Ayatrisya Multi-Modal Model Server
emoji: ⚡
colorFrom: purple
colorTo: indigo
sdk: gradio
sdk_version: 5.16.0
app_file: app.py
pinned: false
license: apache-2.0
---

# Ayatrisya Multi-Modal Model Server (ZeroGPU)

Dedicated serverless intelligence and multi-modal inference engine for **Ayatrisya AI**, developed by **Ametesx Architecture**.

- **Chat & Coding Model:** `Qwen/Qwen2.5-Coder-1.5B-Instruct` (with dynamic fallback to `0.5B` on CPU)
- **Speech Synthesis:** Neural Harmonic Mel-Spectrogram TTS (16kHz PCM WAV)
- **Speech Transcription:** OpenAI Whisper Tiny
- **Hardware:** Hugging Face ZeroGPU / Dynamic GPU & CPU Allocation
- **Client Protocol:** Direct Gradio SSE (`/gradio_api/call/*`) integration via Ayatrisya Render API Gateway

### Endpoints
- `/predict`: Accepts serialized JSON payload `{"messages": [...], "model": "v1-fast", "mode": "Normal"}` and yields `{"text": "..."}`.
- `/synthesize_speech`: Synthesizes text into high-fidelity 16kHz PCM WAV audio.
- `/transcribe_audio`: Transcribes audio input into structured text using Whisper.
- `/health`: Verifies model parameter loading, speech pipeline status, and hardware health.
- `/capabilities`: Returns supported modalities (`chat`, `coding`, `planning`, `speech`, `transcribe`).
