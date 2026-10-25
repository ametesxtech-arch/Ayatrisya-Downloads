# Ayatrisya Chat Model Server - Configuration
# Parent Company: Ametesx

import os
from typing import Optional

def get_env_str(key: str, default: str) -> str:
    val = os.getenv(key, "").strip()
    return val if val else default

def get_env_int(key: str, default: int) -> int:
    val = os.getenv(key, "").strip()
    try:
        return int(val) if val else default
    except ValueError:
        return default

def get_env_float(key: str, default: float) -> float:
    val = os.getenv(key, "").strip()
    try:
        return float(val) if val else default
    except ValueError:
        return default

def get_env_bool(key: str, default: bool) -> bool:
    val = os.getenv(key, "").strip().lower()
    if not val:
        return default
    return val in ("1", "true", "yes", "on")

class ServerConfig:
    # Authentication token matching AYATRISYA_MODEL_API_KEY on the Render API Gateway
    API_KEY: str = os.getenv("AYATRISYA_MODEL_API_KEY", "test-model-api-key").strip()

    # Model identifier on Hugging Face (or local directory / GGUF file path)
    # Recommended small CPU-optimized model: Qwen/Qwen2.5-0.5B-Instruct (Apache 2.0, ~490M params, ~1GB RAM)
    MODEL_ID: str = get_env_str("MODEL_ID", "Qwen/Qwen2.5-0.5B-Instruct")

    # Host & Port (Hugging Face Spaces routes inbound traffic to port 7860 by default)
    HOST: str = get_env_str("HOST", "0.0.0.0")
    PORT: int = get_env_int("PORT", 7860)

    # Compute device ('cpu' for Hugging Face Free CPU Basic / local CPU)
    DEVICE: str = get_env_str("DEVICE", "cpu").lower()

    # Generation bounds & safety limits
    MAX_INPUT_TOKENS: int = get_env_int("MAX_INPUT_TOKENS", 4096)
    MAX_NEW_TOKENS: int = get_env_int("MAX_NEW_TOKENS", 512)
    REQUEST_TIMEOUT_SECONDS: float = get_env_float("REQUEST_TIMEOUT_SECONDS", 60.0)

    # Mock inference mode (used for lightweight unit testing without downloading full weights)
    MOCK_INFERENCE: bool = get_env_bool("MOCK_INFERENCE", False)

config = ServerConfig()
