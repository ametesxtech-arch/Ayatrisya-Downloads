from __future__ import annotations

import json
import math
import os
import random
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import torch
from torch.utils.data import DataLoader

from model.config import ModelConfig
from model.tokenizer import ByteTokenizer
from model.transformer import SeedTransformer
from training.checkpoint import read_checkpoint, save_checkpoint
from training.data import TextWindowDataset


@dataclass(frozen=True)
class TrainingConfig:
    max_steps: int | None = 20
    epochs: int | None = None
    batch_size: int = 2
    gradient_accumulation_steps: int = 1
    learning_rate: float = 0.0003
    weight_decay: float = 0.01
    warmup_steps: int = 2
    gradient_clip_norm: float = 1.0
    seed: int = 17
    num_workers: int = 0
    use_mixed_precision: bool = False
    eval_batches: int = 8
    checkpoint_every: int = 10


def _seed_everything(seed: int) -> None:
    random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def _choose_device(requested: str) -> torch.device:
    if requested == "auto":
        return torch.device("cuda" if torch.cuda.is_available() else "cpu")
    if requested == "cuda" and not torch.cuda.is_available():
        raise RuntimeError("CUDA was requested but is not available")
    if requested not in ("cpu", "cuda"):
        raise ValueError("device must be auto, cpu, or cuda")
    return torch.device(requested)


def _evaluate(
    model: SeedTransformer,
    loader: DataLoader,
    device: torch.device,
    max_batches: int,
) -> tuple[float, int]:
    model.eval()
    loss_sum = 0.0
    token_count = 0
    with torch.inference_mode():
        for index, (input_ids, targets, mask) in enumerate(loader):
            if index >= max_batches:
                break
            input_ids = input_ids.to(device)
            targets = targets.to(device)
            mask = mask.to(device)
            _, loss = model(input_ids, attention_mask=mask, targets=targets)
            assert loss is not None
            tokens = int((targets != -100).sum().item())
            loss_sum += float(loss.item()) * tokens
            token_count += tokens
    model.train()
    return (loss_sum / max(1, token_count), token_count)


def train_model(
    *,
    train_dataset: TextWindowDataset,
    validation_dataset: TextWindowDataset,
    model_config: ModelConfig,
    training_config: TrainingConfig,
    device_name: str,
    checkpoint_path: Path,
    dataset_sha256: str,
    duplicate_documents_removed: int,
    dataset_source_files: list[str],
    data_provenance: str,
    resume_from: Path | None = None,
) -> dict[str, Any]:
    if training_config.max_steps is not None and not 1 <= training_config.max_steps <= 1_000_000:
        raise ValueError("max_steps must be between 1 and 1,000,000")
    if training_config.epochs is not None and not 1 <= training_config.epochs <= 10_000:
        raise ValueError("epochs must be between 1 and 10,000")
    if training_config.max_steps is None and training_config.epochs is None:
        raise ValueError("set max_steps, epochs, or both to bound training")
    if training_config.batch_size < 1 or training_config.batch_size > 256:
        raise ValueError("batch_size must be between 1 and 256")
    if training_config.gradient_accumulation_steps < 1:
        raise ValueError("gradient_accumulation_steps must be positive")

    _seed_everything(training_config.seed)
    device = _choose_device(device_name)
    model = SeedTransformer(model_config).to(device)
    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=training_config.learning_rate,
        weight_decay=training_config.weight_decay,
    )
    initial_step = 0
    if resume_from is not None:
        payload = read_checkpoint(resume_from, map_location=device)
        saved_config = ModelConfig.from_dict(payload["model_config"])
        if saved_config != model_config:
            raise ValueError("cannot resume: checkpoint model configuration differs")
        model.load_state_dict(payload["model_state"], strict=True)
        if "optimizer_state" in payload:
            optimizer.load_state_dict(payload["optimizer_state"])
        initial_step = int(payload.get("training_state", {}).get("step", 0))

    train_loader = DataLoader(
        train_dataset,
        batch_size=training_config.batch_size,
        shuffle=True,
        num_workers=training_config.num_workers,
        drop_last=False,
    )
    validation_loader = DataLoader(
        validation_dataset,
        batch_size=training_config.batch_size,
        shuffle=False,
        num_workers=training_config.num_workers,
        drop_last=False,
    )
    iterator = iter(train_loader)
    epochs_completed = 0
    starting_epoch = 0
    if resume_from is not None:
        starting_epoch = int(payload.get("training_state", {}).get("epochs_completed", 0))
    amp_enabled = (
        device.type == "cuda"
        and training_config.use_mixed_precision
        and torch.cuda.is_available()
    )
    amp_dtype = (
        torch.bfloat16
        if amp_enabled and torch.cuda.is_bf16_supported()
        else torch.float16
    )
    scaler_enabled = amp_enabled and amp_dtype == torch.float16
    scaler = torch.amp.GradScaler("cuda", enabled=scaler_enabled)
    started = time.monotonic()
    tokens_processed = 0
    loss_history: list[float] = []
    model.train()

    updates_completed = 0
    final_step = initial_step
    total_steps = training_config.max_steps
    if total_steps is None and training_config.epochs is not None:
        total_steps = math.ceil(
            len(train_loader)
            * training_config.epochs
            / training_config.gradient_accumulation_steps
        )

    def next_batch() -> tuple[torch.Tensor, torch.Tensor, torch.Tensor] | None:
        nonlocal iterator, epochs_completed
        try:
            return next(iterator)
        except StopIteration:
            epochs_completed += 1
            if training_config.epochs is not None and epochs_completed >= training_config.epochs:
                return None
            iterator = iter(train_loader)
            return next(iterator)

    while True:
        if training_config.max_steps is not None and updates_completed >= training_config.max_steps:
            break
        if training_config.epochs is not None and epochs_completed >= training_config.epochs:
            break
        batches: list[tuple[torch.Tensor, torch.Tensor, torch.Tensor]] = []
        for _ in range(training_config.gradient_accumulation_steps):
            batch = next_batch()
            if batch is None:
                break
            batches.append(batch)
        if not batches:
            break

        step = initial_step + updates_completed + 1
        optimizer.zero_grad(set_to_none=True)
        step_loss = 0.0
        step_tokens = 0
        for batch in batches:
            input_ids, targets, mask = (tensor.to(device) for tensor in batch)
            step_tokens += int((targets != -100).sum().item())
            with torch.autocast(
                device_type=device.type,
                dtype=amp_dtype if amp_enabled else torch.float32,
                enabled=amp_enabled,
            ):
                _, loss = model(input_ids, attention_mask=mask, targets=targets)
                assert loss is not None
                scaled_loss = loss / len(batches)
            scaler.scale(scaled_loss).backward()
            step_loss += float(loss.detach().item())

        scaler.unscale_(optimizer)
        torch.nn.utils.clip_grad_norm_(model.parameters(), training_config.gradient_clip_norm)
        warmup = max(1, training_config.warmup_steps)
        if step <= warmup:
            lr_scale = step / warmup
        elif total_steps is None:
            lr_scale = 1.0
        else:
            remaining = max(0, initial_step + total_steps - step)
            decay_steps = max(1, initial_step + total_steps - warmup)
            lr_scale = max(0.1, remaining / decay_steps)
        for group in optimizer.param_groups:
            group["lr"] = training_config.learning_rate * lr_scale
        scaler.step(optimizer)
        scaler.update()

        tokens_processed += step_tokens
        updates_completed += 1
        final_step = step
        mean_loss = step_loss / len(batches)
        loss_history.append(mean_loss)
        if step % training_config.checkpoint_every == 0 or (
            training_config.max_steps is not None
            and updates_completed == training_config.max_steps
        ) or (
            training_config.epochs is not None
            and epochs_completed >= training_config.epochs
        ):
            training_state = {
                "step": step,
                "epochs_completed": starting_epoch + epochs_completed,
                "seed": training_config.seed,
                "tokens_processed": tokens_processed,
                "dataset_sha256": dataset_sha256,
                "dataset_source_files": dataset_source_files,
                "data_provenance_owner_statement": data_provenance,
                "checkpoint_path": str(checkpoint_path),
                "training_config": asdict(training_config),
                "last_train_loss": mean_loss,
                "validation_loss": None,
                "duplicate_documents_removed": duplicate_documents_removed,
            }
            save_checkpoint(
                checkpoint_path,
                model=model,
                tokenizer=ByteTokenizer(),
                training_state=training_state,
                optimizer=optimizer,
            )

    validation_loss, validation_tokens = _evaluate(
        model,
        validation_loader,
        device,
        training_config.eval_batches,
    )
    elapsed = time.monotonic() - started
    final_state = {
        "step": final_step,
        "epochs_completed": starting_epoch + epochs_completed,
        "seed": training_config.seed,
        "tokens_processed": tokens_processed,
        "dataset_sha256": dataset_sha256,
        "dataset_source_files": dataset_source_files,
        "data_provenance_owner_statement": data_provenance,
        "checkpoint_path": str(checkpoint_path),
        "training_config": asdict(training_config),
        "model_config": model_config.to_dict(),
        "last_train_loss": loss_history[-1],
        "validation_loss": validation_loss,
        "validation_perplexity": math.exp(min(validation_loss, 20.0)),
        "validation_tokens": validation_tokens,
        "duplicate_documents_removed": duplicate_documents_removed,
        "elapsed_seconds": round(elapsed, 3),
        "device": str(device),
        "torch_version": str(torch.__version__),
    }
    save_checkpoint(
        checkpoint_path,
        model=model,
        tokenizer=ByteTokenizer(),
        training_state=final_state,
        optimizer=optimizer,
    )
    run_record_path = checkpoint_path.with_suffix(".run.json")
    run_record_path.write_text(
        json.dumps(final_state, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return final_state
