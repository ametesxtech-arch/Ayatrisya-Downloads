from __future__ import annotations

import argparse
import json
import math
import time
from pathlib import Path

import torch
from torch.utils.data import DataLoader

from model.generation import generate
from model.tokenizer import ByteTokenizer
from training.checkpoint import load_model_checkpoint
from training.data import TextWindowDataset, load_documents, split_documents


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Measure held-out next-byte loss for a local Ayatrisya Seed checkpoint."
    )
    parser.add_argument("--checkpoint", type=Path, required=True)
    parser.add_argument("--data", type=Path, nargs="+", required=True)
    parser.add_argument(
        "--seed",
        type=int,
        default=None,
        help="Override the checkpoint's recorded train/validation split seed.",
    )
    parser.add_argument("--batch-size", type=int, default=2)
    args = parser.parse_args()
    model, tokenizer, payload = load_model_checkpoint(args.checkpoint.resolve())
    training_state = payload.get("training_state", {})
    split_seed = (
        args.seed
        if args.seed is not None
        else int(training_state.get("seed", 17))
    )
    documents, dataset_hash, duplicates = load_documents([path.resolve() for path in args.data])
    _, validation_documents = split_documents(documents, seed=split_seed)
    dataset = TextWindowDataset(
        validation_documents,
        tokenizer,
        block_size=model.config.max_seq_len,
    )
    loader = DataLoader(dataset, batch_size=args.batch_size, shuffle=False)
    loss_total = 0.0
    token_total = 0
    model.eval()
    with torch.inference_mode():
        for input_ids, targets, mask in loader:
            _, loss = model(input_ids, attention_mask=mask, targets=targets)
            assert loss is not None
            count = int((targets != -100).sum().item())
            loss_total += float(loss.item()) * count
            token_total += count
    if token_total == 0:
        raise RuntimeError("held-out split contains no tokens")
    mean_loss = loss_total / token_total
    start = time.monotonic()
    sample = generate(
        model,
        tokenizer,
        "Ayatrisya Seed",
        max_new_tokens=16,
        temperature=0,
        top_k=0,
    )
    generation_seconds = time.monotonic() - start
    generated_tokens = tokenizer.encode(sample)
    generated_token_count = len(generated_tokens)
    repeated_token_fraction = (
        1.0 - len(set(generated_tokens)) / generated_token_count
        if generated_token_count
        else 0.0
    )
    report = {
        "model": "Ayatrisya Seed",
        "checkpoint_step": payload.get("training_state", {}).get("step"),
        "split_seed": split_seed,
        "dataset_sha256": dataset_hash,
        "duplicate_documents_removed": duplicates,
        "held_out_tokens": token_total,
        "byte_cross_entropy": mean_loss,
        "perplexity": math.exp(min(mean_loss, 20)),
        "greedy_sample": sample,
        "generation_seconds": round(generation_seconds, 4),
        "generated_tokens": generated_token_count,
        "generated_token_repeat_fraction": round(repeated_token_fraction, 4),
        "generated_tokens_per_second": (
            round(generated_token_count / generation_seconds, 3)
            if generation_seconds > 0
            else None
        ),
        "limitation": "Synthetic or owner-supplied corpus evaluation is not an assistant capability benchmark.",
    }
    print(json.dumps(report, indent=2, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
