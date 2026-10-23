from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from dataclasses import fields
from pathlib import Path

import torch

from model.config import ModelConfig
from model.tokenizer import ByteTokenizer
from training.data import (
    TextWindowDataset,
    document_group_key,
    load_documents,
    split_documents,
)
from training.trainer import TrainingConfig, train_model

ROOT = Path(__file__).resolve().parents[1]


def _available_memory_bytes() -> int | None:
    try:
        for line in Path("/proc/meminfo").read_text().splitlines():
            if line.startswith("MemAvailable:"):
                return int(line.split()[1]) * 1024
    except OSError:
        pass
    try:
        return int(os.sysconf("SC_AVPHYS_PAGES") * os.sysconf("SC_PAGE_SIZE"))
    except (ValueError, OSError, AttributeError):
        return None


def _read_config(
    path: Path,
) -> tuple[ModelConfig, TrainingConfig, list[Path], Path, str, str]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    model_config = ModelConfig(**raw.get("model", {}))
    training_fields = {field.name for field in fields(TrainingConfig)}
    training_config = TrainingConfig(
        **{key: value for key, value in raw.get("training", {}).items() if key in training_fields}
    )
    data_files = [((ROOT / item).resolve()) for item in raw.get("data_files", [])]
    output = (ROOT / raw.get("checkpoint", "checkpoints/seed-smoke.pt")).resolve()
    device = str(raw.get("device", "auto"))
    provenance = raw.get("data_provenance")
    if not data_files:
        raise ValueError("config must list at least one owner-provided dataset file")
    if not isinstance(provenance, str) or not provenance.strip():
        raise ValueError(
            "config must include a data_provenance statement describing sources and use rights"
        )
    return model_config, training_config, data_files, output, device, provenance


def main() -> int:
    parser = argparse.ArgumentParser(description="Train the experimental Ayatrisya Seed baseline.")
    parser.add_argument("--config", type=Path, default=ROOT / "configs/smoke.json")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--resume", type=Path)
    args = parser.parse_args()
    config_path = args.config if args.config.is_absolute() else (ROOT / args.config)
    (
        model_config,
        training_config,
        data_files,
        checkpoint,
        device_name,
        provenance,
    ) = _read_config(config_path)
    estimate = model_config.estimate_training_memory_bytes(training_config.batch_size)
    available = _available_memory_bytes()
    dataset_bytes = 0
    for data_file in data_files:
        if not data_file.is_file():
            raise FileNotFoundError(f"dataset file does not exist: {data_file}")
        size = data_file.stat().st_size
        if size > 64 * 1024 * 1024:
            raise ValueError(f"dataset file exceeds the 64 MiB limit: {data_file}")
        dataset_bytes += size
    if dataset_bytes > 256 * 1024 * 1024:
        raise ValueError("combined dataset exceeds the 256 MiB safety limit")
    required_free = max(
        estimate * 2 + dataset_bytes * 3,
        256 * 1024 * 1024,
    )
    if available is not None and available < required_free:
        raise MemoryError(
            f"insufficient available RAM for a safe run; estimated reserve is "
            f"{required_free / (1024**2):.1f} MiB"
        )

    documents, data_hash, duplicate_count = load_documents(data_files)
    train_documents, validation_documents = split_documents(
        documents, seed=training_config.seed
    )
    tokenizer = ByteTokenizer()
    train_data = TextWindowDataset(
        train_documents, tokenizer, block_size=model_config.max_seq_len
    )
    validation_data = TextWindowDataset(
        validation_documents, tokenizer, block_size=model_config.max_seq_len
    )
    print(f"Python: {sys.version.split()[0]}")
    print(f"PyTorch: {torch.__version__}")
    print(f"Device requested: {device_name}; CUDA available: {torch.cuda.is_available()}")
    print(f"CPU cores: {os.cpu_count() or 'unknown'}")
    print(f"Available RAM: {available / (1024**3):.2f} GiB" if available else "Available RAM: unknown")
    print(f"Free disk: {shutil.disk_usage(ROOT).free / (1024**3):.2f} GiB")
    print(f"Parameter estimate: {model_config.parameter_count_estimate():,}")
    print(f"Conservative training memory estimate: {estimate / (1024**2):.1f} MiB")
    print(f"Distinct documents: {len(documents)}; removed exact duplicates: {duplicate_count}")
    train_group_count = len({document_group_key(document) for document in train_documents})
    validation_group_count = len(
        {document_group_key(document) for document in validation_documents}
    )
    print(
        f"Instruction groups: {len({document_group_key(document) for document in documents})}; "
        f"train={train_group_count}; validation={validation_group_count}; "
        "template leakage=0"
    )
    print(f"Train windows: {len(train_data)}; validation windows: {len(validation_data)}")
    if args.dry_run:
        print("Dry run passed; no model weights were trained or saved.")
        return 0

    torch.set_num_threads(max(1, min(4, os.cpu_count() or 1)))
    result = train_model(
        train_dataset=train_data,
        validation_dataset=validation_data,
        model_config=model_config,
        training_config=training_config,
        device_name=device_name,
        checkpoint_path=checkpoint,
        dataset_sha256=data_hash,
        duplicate_documents_removed=duplicate_count,
        dataset_source_files=[
            str(path.relative_to(ROOT)) if path.is_relative_to(ROOT) else str(path)
            for path in data_files
        ],
        data_provenance=provenance,
        resume_from=args.resume,
    )
    print(json.dumps(result, indent=2, sort_keys=True))
    print(f"Checkpoint: {checkpoint}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
