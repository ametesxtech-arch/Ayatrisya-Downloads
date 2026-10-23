from __future__ import annotations

import os
import tempfile
from pathlib import Path
from typing import Any

import torch

from model.config import ModelConfig
from model.tokenizer import ByteTokenizer
from model.transformer import SeedTransformer

CHECKPOINT_FORMAT_VERSION = 1


def save_checkpoint(
    path: Path,
    *,
    model: SeedTransformer,
    tokenizer: ByteTokenizer,
    training_state: dict[str, Any],
    optimizer: torch.optim.Optimizer | None = None,
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload: dict[str, Any] = {
        "format_version": CHECKPOINT_FORMAT_VERSION,
        "model_config": model.config.to_dict(),
        "tokenizer_config": tokenizer.to_dict(),
        "model_state": model.state_dict(),
        "training_state": training_state,
    }
    if optimizer is not None:
        payload["optimizer_state"] = optimizer.state_dict()
    temp_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="wb", prefix=f".{path.name}.", suffix=".tmp", dir=path.parent, delete=False
        ) as temporary:
            temp_path = Path(temporary.name)
            torch.save(payload, temporary)
            temporary.flush()
            os.fsync(temporary.fileno())
        os.replace(temp_path, path)
    finally:
        if temp_path is not None and temp_path.exists():
            temp_path.unlink()


def read_checkpoint(path: Path, *, map_location: str | torch.device = "cpu") -> dict[str, Any]:
    if not path.is_file():
        raise FileNotFoundError(f"checkpoint does not exist: {path}")
    # weights_only=True prevents arbitrary Python object construction. Load only
    # checkpoints produced by this project; never distribute untrusted weights.
    payload = torch.load(path, map_location=map_location, weights_only=True)
    if not isinstance(payload, dict) or payload.get("format_version") != CHECKPOINT_FORMAT_VERSION:
        raise ValueError("unsupported or malformed checkpoint format")
    if not isinstance(payload.get("model_config"), dict):
        raise ValueError("checkpoint has no valid model configuration")
    if not isinstance(payload.get("tokenizer_config"), dict):
        raise ValueError("checkpoint has no tokenizer configuration")
    if not isinstance(payload.get("model_state"), dict):
        raise ValueError("checkpoint has no model weights")
    return payload


def load_model_checkpoint(
    path: Path,
    *,
    device: str | torch.device = "cpu",
) -> tuple[SeedTransformer, ByteTokenizer, dict[str, Any]]:
    payload = read_checkpoint(path, map_location=device)
    config = ModelConfig.from_dict(payload["model_config"])
    tokenizer_config = payload["tokenizer_config"]
    if tokenizer_config.get("type") != "utf8-byte-v1":
        raise ValueError("checkpoint tokenizer is incompatible with this runtime")
    if tokenizer_config.get("vocab_size") != config.vocab_size:
        raise ValueError("tokenizer and model vocabulary sizes do not match")
    training_state = payload.get("training_state")
    if not isinstance(training_state, dict):
        raise ValueError("checkpoint has no training record")
    if not isinstance(training_state.get("step"), int) or training_state["step"] < 1:
        raise ValueError("checkpoint has no completed training step")
    dataset_hash = training_state.get("dataset_sha256")
    if not isinstance(dataset_hash, str) or len(dataset_hash) != 64:
        raise ValueError("checkpoint has no valid dataset identity")
    model = SeedTransformer(config).to(device)
    model.load_state_dict(payload["model_state"], strict=True)
    model.eval()
    return model, ByteTokenizer(), payload
