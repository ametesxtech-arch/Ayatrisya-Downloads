from __future__ import annotations

from pathlib import Path
from typing import Any

import torch

from model.tokenizer import ByteTokenizer
from model.transformer import SeedTransformer
from training.checkpoint import load_model_checkpoint


def load_trained_model(
    checkpoint: Path,
    *,
    device: str | torch.device = "cpu",
) -> tuple[SeedTransformer, ByteTokenizer, dict[str, Any]]:
    return load_model_checkpoint(checkpoint, device=device)
