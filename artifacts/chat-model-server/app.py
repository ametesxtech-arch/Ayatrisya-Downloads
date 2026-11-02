# Ayatrisya Chat Model Server - FastAPI Application
# Parent Company: Ametesx

import json
import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from config import config
from model_engine import ChatEngine
from schemas import (
    GetModelCapabilitiesResponse,
    GetModelHealthResponse,
    ModelCapabilityItem,
    SendModelChatBody,
    SendModelChatResponse,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("ayatrisya.server")

# Global inference engine instance
engine = ChatEngine(
    model_id=config.MODEL_ID,
    device=config.DEVICE,
    mock_inference=config.MOCK_INFERENCE,
    max_input_tokens=config.MAX_INPUT_TOKENS,
    max_new_tokens=config.MAX_NEW_TOKENS,
    request_timeout=config.REQUEST_TIMEOUT_SECONDS,
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Load weights and execute mandatory warm-up inference test
    logger.info("Initializing Ayatrisya Chat Model Server...")
    engine.load()
    if engine.self_test_passed:
        logger.info("Ayatrisya Chat Model Server is READY for incoming requests.")
    else:
        logger.warning("Ayatrisya Chat Model Server is STARTING IN UNREADY STATE: %s", engine.self_test_error)
    yield
    # Shutdown
    logger.info("Shutting down Ayatrisya Chat Model Server.")

app = FastAPI(
    title="Ayatrisya Chat Model Server",
    description="Dedicated, CPU-optimized chat model server for Ayatrisya AI, compatible with the Render API Gateway.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware for local testing or cross-origin access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

def verify_api_key(authorization: Optional[str] = Header(None)) -> bool:
    """Verifies the Bearer API key against the server configuration."""
    if not config.API_KEY:
        # If no key configured on the server, permit development access
        return True

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Unauthorized: Missing or malformed Authorization header. Expected 'Bearer <token>'.",
        )

    token = authorization[len("Bearer "):].strip()
    if token != config.API_KEY:
        raise HTTPException(
            status_code=401,
            detail="Unauthorized: Invalid model API key.",
        )
    return True

@app.get("/health", response_model=GetModelHealthResponse)
async def get_health():
    """
    Health check endpoint.
    Strictly adheres to: 'Never report the model as ready until an actual inference request succeeds.'
    """
    if not engine.self_test_passed:
        return JSONResponse(
            status_code=503,
            content={
                "status": "not_ready",
                "error": engine.self_test_error or "Warm-up inference self-test has not passed.",
            },
        )

    return GetModelHealthResponse(
        status="ok",
        model=engine.model_id,
        readiness="ready",
        parameter_count=engine.param_count,
        device=engine.device,
    )

@app.get("/capabilities", response_model=GetModelCapabilitiesResponse)
async def get_capabilities(authenticated: bool = Depends(verify_api_key)):
    """Capabilities check endpoint, declaring supported modalities and models."""
    ready = engine.self_test_passed
    reason = "Ready" if ready else (engine.self_test_error or "Model warm-up test pending")

    return GetModelCapabilitiesResponse(
        models=[
            ModelCapabilityItem(
                id="v1-fast",
                label="Ayatrisya Fast Engine (Qwen2.5-0.5B)",
                available=ready,
                streaming=True,
                attachments=True,
                modalities=["chat"],
                reason=reason,
            ),
            ModelCapabilityItem(
                id="v2-best",
                label="Ayatrisya Deep Reasoning Engine",
                available=ready,
                streaming=True,
                attachments=True,
                modalities=["chat"],
                reason=reason,
            ),
        ]
    )

@app.post("/chat")
async def post_chat(
    req: Request,
    body: SendModelChatBody,
    authenticated: bool = Depends(verify_api_key),
):
    """
    Primary chat inference endpoint.
    Supports both non-streaming JSON and streaming NDJSON/SSE responses.
    """
    if not engine.self_test_passed:
        raise HTTPException(
            status_code=503,
            detail=f"Ayatrisya model is not ready: {engine.self_test_error or 'Self-test pending'}",
        )

    accept_header = req.headers.get("accept", "").lower()
    is_sse = "text/event-stream" in accept_header

    # Streaming generation
    model_provenance = "ayatrisya-v2-reasoning" if body.model == "v2-best" else "ayatrisya-v1-fast"
    if body.stream:
        if is_sse:
            def sse_generator():
                try:
                    for token in engine.generate_stream(body.messages, body.mode, model_type=body.model):
                        payload = json.dumps({"token": token}, separators=(",", ":"))
                        yield f"data: {payload}\n\n"
                    yield "data: [DONE]\n\n"
                except Exception as exc:
                    logger.error("SSE streaming error: %s", exc)
                    err_payload = json.dumps({"error": str(exc)}, separators=(",", ":"))
                    yield f"data: {err_payload}\n\n"

            return StreamingResponse(
                sse_generator(),
                media_type="text/event-stream; charset=utf-8",
                headers={
                    "Cache-Control": "no-store",
                    "X-Accel-Buffering": "no",
                    "x-model-source": model_provenance,
                    "x-provider": "ayatrisya-native",
                },
            )
        else:
            # Default streaming format: application/x-ndjson
            def ndjson_generator():
                try:
                    for token in engine.generate_stream(body.messages, body.mode, model_type=body.model):
                        payload = json.dumps({"token": token}, separators=(",", ":"))
                        yield f"{payload}\n"
                    yield json.dumps({"token": "", "done": True}, separators=(",", ":")) + "\n"
                except Exception as exc:
                    logger.error("NDJSON streaming error: %s", exc)
                    err_payload = json.dumps({"error": str(exc)}, separators=(",", ":"))
                    yield f"{err_payload}\n"

            return StreamingResponse(
                ndjson_generator(),
                media_type="application/x-ndjson; charset=utf-8",
                headers={
                    "Cache-Control": "no-store",
                    "X-Accel-Buffering": "no",
                    "x-model-source": model_provenance,
                    "x-provider": "ayatrisya-native",
                },
            )

    # Non-streaming standard JSON generation
    try:
        output_text = engine.generate(body.messages, body.mode, model_type=body.model)
        return JSONResponse(
            status_code=200,
            content={
                "text": output_text,
                "provider": "ayatrisya-native",
                "model": model_provenance,
                "engine": engine.model_id,
            },
            headers={
                "Cache-Control": "no-store",
                "x-model-source": model_provenance,
                "x-provider": "ayatrisya-native",
            },
        )
    except TimeoutError as exc:
        raise HTTPException(status_code=504, detail=str(exc))
    except Exception as exc:
        logger.error("Inference failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Inference error: {str(exc)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app:app",
        host=config.HOST,
        port=config.PORT,
        log_level="info",
    )
