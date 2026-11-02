---
title: Ayatrisya Chat Model Server
emoji: ⚡
colorFrom: purple
colorTo: indigo
sdk: gradio
sdk_version: 5.16.0
app_file: app.py
pinned: false
license: apache-2.0
---

# Ayatrisya Chat Model Server (ZeroGPU)

Dedicated serverless inference engine for **Ayatrisya AI**, developed by **Ametesx**.

- **Model:** `Qwen/Qwen2.5-0.5B-Instruct` (Licensed under Apache-2.0 by Alibaba Cloud)
- **Hardware:** Hugging Face ZeroGPU (Free Tier dynamic GPU allocation)
- **Framework:** Gradio + Hugging Face Transformers + PyTorch
- **Client Protocol:** Direct `/gradio_api/call/predict` SSE integration via the Ayatrisya Render Gateway

### Endpoints
- `/predict`: Accepts serialized JSON payload `{"messages": [...], "model": "v1-fast", "mode": "Normal"}` and yields `{"text": "..."}`.
- `/health`: Verifies model parameter loading and warm-up inference test.
- `/capabilities`: Returns available models and modalities.
