# Ayatrisya Chat Model Server - Automated Test Suite
# Tests contract compatibility with the Render API Gateway

import json
import pytest
import httpx

from app import app, engine
from config import config

AUTH_HEADER = {"Authorization": f"Bearer {config.API_KEY}"}

@pytest.fixture(autouse=True)
def ensure_engine_ready():
    """Ensure engine is initialized and in mock inference mode for quick, reliable tests."""
    engine.mock_inference = True
    engine.is_loaded = True
    engine.self_test_passed = True
    engine.self_test_error = None
    engine.model_id = "Qwen/Qwen2.5-0.5B-Instruct"

@pytest.fixture
def anyio_backend():
    return "asyncio"

async def get_client():
    transport = httpx.ASGITransport(app=app)
    return httpx.AsyncClient(transport=transport, base_url="http://testserver")

# ---------------------------------------------------------------------------
# 1. Health & Self-Test Readiness
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_health_check_returns_503_when_not_ready():
    """Requirement: Never report the model as ready until an actual inference request succeeds."""
    engine.self_test_passed = False
    engine.self_test_error = "Self-test pending execution."

    async with await get_client() as client:
        response = await client.get("/health")
        assert response.status_code == 503
        data = response.json()
        assert data["status"] == "not_ready"
        assert "Self-test pending" in data["error"]

@pytest.mark.anyio
async def test_health_check_returns_ok_when_self_test_passed():
    engine.self_test_passed = True
    engine.self_test_error = None

    async with await get_client() as client:
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["readiness"] == "ready"
        assert "model" in data

# ---------------------------------------------------------------------------
# 2. Capabilities Endpoint
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_capabilities_returns_chat_modality():
    async with await get_client() as client:
        response = await client.get("/capabilities", headers=AUTH_HEADER)
        assert response.status_code == 200
        data = response.json()
        assert "models" in data
        assert len(data["models"]) >= 1

        fast_model = next((m for m in data["models"] if m["id"] == "v1-fast"), None)
        assert fast_model is not None
        assert fast_model["available"] is True
        assert fast_model["streaming"] is True
        assert fast_model["attachments"] is True
        assert "chat" in fast_model["modalities"]

# ---------------------------------------------------------------------------
# 3. Authentication & Authorization
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_chat_rejects_missing_authorization_header():
    payload = {
        "messages": [{"role": "user", "content": "Hello!"}],
        "model": "v1-fast",
        "mode": "Normal",
        "stream": False,
    }
    async with await get_client() as client:
        response = await client.post("/chat", json=payload)
        assert response.status_code == 401
        assert "Unauthorized" in response.text

@pytest.mark.anyio
async def test_chat_rejects_invalid_bearer_token():
    payload = {
        "messages": [{"role": "user", "content": "Hello!"}],
        "model": "v1-fast",
        "mode": "Normal",
        "stream": False,
    }
    async with await get_client() as client:
        response = await client.post("/chat", json=payload, headers={"Authorization": "Bearer wrong-token-xyz"})
        assert response.status_code == 401
        assert "Invalid model API key" in response.text

# ---------------------------------------------------------------------------
# 4. Standard Non-Streaming Chat Generation
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_chat_non_streaming_success():
    payload = {
        "messages": [
            {"role": "user", "content": "What is the capital of France?"}
        ],
        "model": "v1-fast",
        "mode": "Normal",
        "stream": False,
    }
    async with await get_client() as client:
        response = await client.post("/chat", json=payload, headers=AUTH_HEADER)
        assert response.status_code == 200
        data = response.json()
        assert "text" in data
        assert isinstance(data["text"], str)
        assert len(data["text"]) > 0

@pytest.mark.anyio
async def test_chat_with_modes_normal_savage_joke():
    async with await get_client() as client:
        for mode in ["Normal", "Savage", "Joke"]:
            payload = {
                "messages": [{"role": "user", "content": f"Tell me about physics in {mode} mode"}],
                "model": "v1-fast",
                "mode": mode,
                "stream": False,
            }
            response = await client.post("/chat", json=payload, headers=AUTH_HEADER)
            assert response.status_code == 200
            assert "text" in response.json()

@pytest.mark.anyio
async def test_chat_with_file_attachments():
    payload = {
        "messages": [
            {
                "role": "user",
                "content": "Please analyze this attached code file.",
                "attachments": [
                    {
                        "name": "math_utils.py",
                        "mimeType": "text/x-python",
                        "textContent": "def add(a, b): return a + b",
                        "size": 28,
                    }
                ]
            }
        ],
        "model": "v1-fast",
        "mode": "Normal",
        "stream": False,
    }
    async with await get_client() as client:
        response = await client.post("/chat", json=payload, headers=AUTH_HEADER)
        assert response.status_code == 200
        assert "text" in response.json()

# ---------------------------------------------------------------------------
# 5. Streaming Chat Generation (NDJSON and SSE)
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_chat_streaming_ndjson():
    payload = {
        "messages": [{"role": "user", "content": "Stream me a poem."}],
        "model": "v1-fast",
        "mode": "Normal",
        "stream": True,
    }
    async with await get_client() as client:
        response = await client.post(
            "/chat",
            json=payload,
            headers={**AUTH_HEADER, "Accept": "application/x-ndjson"},
        )
        assert response.status_code == 200
        assert "application/x-ndjson" in response.headers.get("content-type", "")

        lines = [line.strip() for line in response.text.split("\n") if line.strip()]
        assert len(lines) >= 2

        # Verify each line is valid JSON with 'token' field
        parsed_chunks = [json.loads(line) for line in lines]
        assert any("token" in c for c in parsed_chunks)
        assert parsed_chunks[-1].get("done") is True

@pytest.mark.anyio
async def test_chat_streaming_sse():
    payload = {
        "messages": [{"role": "user", "content": "Stream me a haiku."}],
        "model": "v1-fast",
        "mode": "Normal",
        "stream": True,
    }
    async with await get_client() as client:
        response = await client.post(
            "/chat",
            json=payload,
            headers={**AUTH_HEADER, "Accept": "text/event-stream"},
        )
        assert response.status_code == 200
        assert "text/event-stream" in response.headers.get("content-type", "")

        raw_text = response.text
        assert "data:" in raw_text
        assert "data: [DONE]" in raw_text

# ---------------------------------------------------------------------------
# 6. Request Validation & Bounds
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_chat_rejects_empty_messages_list():
    payload = {
        "messages": [],
        "model": "v1-fast",
        "mode": "Normal",
        "stream": False,
    }
    async with await get_client() as client:
        response = await client.post("/chat", json=payload, headers=AUTH_HEADER)
        assert response.status_code == 422  # Pydantic validation failure
