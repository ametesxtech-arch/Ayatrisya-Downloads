---
title: Ayatrisya Chat Model Server
emoji: ⚡
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
---

# Ayatrisya Chat Model Server
**Creator & Parent Company:** Ametesx (Ametesx Architecture / Ametesx Technologies)

A dedicated, lightweight, CPU-optimized chat inference server designed to power the **Ayatrisya AI** chat platform, 100% compatible with the Ayatrisya Render API Gateway.

---

## 1. Selected Model: Qwen/Qwen2.5-0.5B-Instruct

| Metric | Specification |
| :--- | :--- |
| **Model ID** | `Qwen/Qwen2.5-0.5B-Instruct` |
| **Architecture** | Dense Decoder-only Transformer with GQA, RoPE up to 32k context |
| **Parameter Count** | ~490 Million |
| **License** | **Apache 2.0** (Open weights, permissive commercial & personal use) |
| **Download Size** | ~980 MB (safetensors) |
| **RAM Footprint** | ~1.1 GB in FP32 / ~650 MB in BF16 (well under the 16 GB free limit) |
| **CPU Speed** | ~30–55 tokens/second on 2 vCPUs |
| **Supported Tasks** | Conversational chat, structured code generation, LaTeX math, interactive blocks |

---

## 2. API Contract with Ayatrisya Render Gateway

The server exposes the exact endpoints expected by `AYATRISYA_MODEL_ENDPOINT`:

### A. Health Check: `GET /health`
- **Behavior**: Returns `HTTP 200 {"status": "ok"}` **only after** an actual warm-up self-test inference succeeds.
- **Fail-safe**: Returns `HTTP 503 {"status": "not_ready", "error": "..."}` if weights are loading or self-test failed.

### B. Capabilities Check: `GET /capabilities`
- **Behavior**: Declares supported models (`v1-fast` and `v2-best`) with modalities `["chat"]`, streaming support, and attachment handling.
- **Header**: Requires `Authorization: Bearer <AYATRISYA_MODEL_API_KEY>`.

### C. Chat Inference: `POST /chat`
- **Header**: Requires `Authorization: Bearer <AYATRISYA_MODEL_API_KEY>`.
- **Payload Schema**:
  ```json
  {
    "messages": [
      { "role": "user", "content": "Explain quantum tunneling." }
    ],
    "model": "v1-fast",
    "mode": "Normal",
    "stream": true
  }
  ```
- **Modes Supported**:
  - `Normal`: Direct answer first, natural conversational tone, LaTeX math delimiters (`$...$` and `$$...$$`), tagged code blocks.
  - `Savage`: Witty, sharp, playful teasing, highly direct without harmful content.
  - `Joke`: Humorous, pun-filled, lighthearted.
- **Streaming Response**: Supports both `application/x-ndjson` (`{"token":"..."}\n`) and `text/event-stream` (`data: {"token":"..."}\n\n`).
- **Non-Streaming Response**: Returns standard JSON `{"text": "<generated text>"}`.

---

## 3. Deployment Options (₹0 Budget)

### Option 1: Hugging Face Spaces (Free CPU Basic)

Hugging Face provides free **CPU Basic** instances (2 vCPU, 16 GB RAM, 50 GB storage) for both Public and Private Spaces.

#### Step-by-Step Deployment Instructions:
1. Log in to [Hugging Face](https://huggingface.co/).
2. Click **New Space** &rarr; Name your space (e.g. `ayatrisya-chat-server`).
3. Select **Space SDK**: **Docker** (Blank).
4. Select **Space hardware**: **CPU Basic · 2 vCPU · 16 GB RAM · Free**.
5. Set Visibility to **Private** (or Public).
6. Click **Create Space**.
7. In the Space **Settings** &rarr; **Variables and secrets**:
   - Add Secret: `AYATRISYA_MODEL_API_KEY` (set to your secure model token).
   - Add Variable: `MODEL_ID` = `Qwen/Qwen2.5-0.5B-Instruct`
   - Add Variable: `DEVICE` = `cpu`
8. Push this repository or directory contents to the Space:
   ```bash
   git remote add space https://huggingface.co/spaces/<your-username>/ayatrisya-chat-server
   git push space main
   ```
9. Once built, your Space URL will be:
   `https://<your-username>-ayatrisya-chat-server.hf.space/`
10. Update your Render API Gateway environment variable:
    ```bash
    AYATRISYA_MODEL_ENDPOINT=https://<your-username>-ayatrisya-chat-server.hf.space/
    AYATRISYA_MODEL_API_KEY=<your_api_key>
    ```

> [!NOTE]
> **Free Tier Sleep Behavior & Gateway Protection**:
> - Hugging Face Free CPU Spaces sleep after 48 hours of inactivity.
> - Cold-start container startup takes approximately 30–45 seconds.
> - While waking up, Ayatrisya's existing **Gemini fallback** seamlessly handles user chats with explicit consent so users experience zero interruption. Once awake, all chats route to your own model server!

---

### Option 2: Local Development Test Path (100% Free, Zero Cloud Setup)

You can run and test the model server locally on your machine with zero configuration:

1. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```
2. **Run the server**:
   ```bash
   python app.py
   ```
   Or using Uvicorn directly:
   ```bash
   uvicorn app:app --host 127.0.0.1 --port 8000
   ```
3. **Verify the server**:
   ```bash
   curl http://127.0.0.1:8000/health
   # Returns: {"status":"ok","model":"Qwen/Qwen2.5-0.5B-Instruct","readiness":"ready",...}
   ```
4. **Test chat inference with curl**:
   ```bash
   curl -X POST http://127.0.0.1:8000/chat \
     -H "Authorization: Bearer test-model-api-key" \
     -H "Content-Type: application/json" \
     -d "{\"messages\":[{\"role\":\"user\",\"content\":\"Hello Ayatrisya!\"}],\"model\":\"v1-fast\",\"mode\":\"Normal\",\"stream\":false}"
   ```
5. **Connect your local API Gateway**:
   In `.env`:
   ```bash
   AYATRISYA_MODEL_ENDPOINT=http://127.0.0.1:8000/
   AYATRISYA_MODEL_API_KEY=test-model-api-key
   ALLOW_LOCAL_MODEL_ENDPOINT=true
   ```

---

## 4. Automated Testing

Run the automated test suite locally:
```bash
pytest test_server.py -v
```
All 11 unit and integration tests will execute and verify contract adherence against the gateway.
