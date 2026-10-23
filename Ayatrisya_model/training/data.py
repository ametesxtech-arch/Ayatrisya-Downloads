from __future__ import annotations

import hashlib
import json
import random
import re
from pathlib import Path
from typing import Iterable

import torch
from torch.utils.data import Dataset

from model.tokenizer import ByteTokenizer

MAX_DATA_FILE_BYTES = 64 * 1024 * 1024
MAX_DATASET_BYTES = 256 * 1024 * 1024


def load_documents(paths: Iterable[Path]) -> tuple[list[str], str, int]:
    paths = list(paths)
    total_size = 0
    for path in paths:
        if not path.is_file():
            raise FileNotFoundError(f"dataset file does not exist: {path}")
        size = path.stat().st_size
        if size > MAX_DATA_FILE_BYTES:
            raise ValueError(f"dataset file exceeds the 64 MiB limit: {path}")
        total_size += size
        if total_size > MAX_DATASET_BYTES:
            raise ValueError("combined dataset exceeds the 256 MiB safety limit")

    documents: list[str] = []
    source_hash = hashlib.sha256()
    seen: set[str] = set()
    duplicate_count = 0

    for path in paths:
        raw = path.read_bytes()
        source_hash.update(path.name.encode("utf-8"))
        source_hash.update(raw)
        content = raw.decode("utf-8", errors="strict")
        suffix = path.suffix.lower()
        looks_like_jsonl = content.lstrip().startswith("{")
        if suffix == ".jsonl" or (suffix == ".txt" and looks_like_jsonl):
            entries = []
            for line_number, line in enumerate(content.splitlines(), start=1):
                if not line.strip():
                    continue
                try:
                    item = json.loads(line)
                except json.JSONDecodeError as error:
                    raise ValueError(f"invalid JSONL at {path}:{line_number}") from error
                if not isinstance(item, dict):
                    raise ValueError(f"JSONL record at {path}:{line_number} must be an object")
                if isinstance(item.get("text"), str) and item["text"].strip():
                    text = item["text"].strip()
                else:
                    instruction = item.get("instruction")
                    user_input = item.get("input", "")
                    output = item.get("output")
                    if (
                        not isinstance(instruction, str)
                        or not instruction.strip()
                        or not isinstance(user_input, str)
                        or not isinstance(output, str)
                        or not output.strip()
                    ):
                        raise ValueError(
                            f"JSONL record at {path}:{line_number} needs either "
                            "a non-empty 'text' or 'instruction' and 'output' strings"
                        )
                    category = item.get("category")
                    parts = []
                    if isinstance(category, str) and category.strip():
                        parts.append(f"Topic: {category.strip()}")
                    parts.append(f"Instruction: {instruction.strip()}")
                    if user_input.strip():
                        parts.append(f"Input: {user_input.strip()}")
                    parts.append(f"Response: {output.strip()}")
                    text = "\n".join(parts)
                entries.append(text)
        elif suffix == ".txt":
            entries = [part.strip() for part in content.split("\n\n")]
        else:
            raise ValueError(f"only .txt and .jsonl datasets are supported: {path}")

        for text in entries:
            if not text:
                continue
            if text in seen:
                duplicate_count += 1
                continue
            seen.add(text)
            documents.append(text)

    if len(documents) < 2:
        raise ValueError("at least two distinct non-empty documents are required for a held-out split")
    return documents, source_hash.hexdigest(), duplicate_count


def document_group_key(document: str) -> str:
    """Keep JSONL examples with the same instruction template in one split."""
    instruction_lines: list[str] = []
    collecting = False
    for line in document.splitlines():
        if not collecting and line.startswith("Instruction: "):
            collecting = True
            instruction_lines.append(line.removeprefix("Instruction: "))
        elif collecting and line.startswith(("Input: ", "Response: ")):
            break
        elif collecting:
            instruction_lines.append(line)
    value = "\n".join(instruction_lines) if instruction_lines else document
    normalized = re.sub(r"[^\w]+", " ", value.casefold(), flags=re.UNICODE).strip()
    return normalized or hashlib.sha256(document.encode("utf-8")).hexdigest()


def split_documents(
    documents: list[str],
    *,
    seed: int,
    validation_fraction: float = 0.2,
) -> tuple[list[str], list[str]]:
    if len(documents) < 2:
        raise ValueError("at least two documents are required for a held-out split")
    if not 0.05 <= validation_fraction <= 0.5:
        raise ValueError("validation_fraction must be between 0.05 and 0.5")
    grouped: dict[str, list[int]] = {}
    for index, document in enumerate(documents):
        grouped.setdefault(document_group_key(document), []).append(index)
    if len(grouped) < 2:
        raise ValueError("at least two distinct instruction groups are required for a held-out split")

    target_size = max(1, round(len(documents) * validation_fraction))
    max_validation_size = len(documents) - 1
    groups = list(grouped.items())
    random.Random(seed).shuffle(groups)

    # A small subset-sum pass gets close to the requested document fraction
    # while assigning each normalized instruction template wholly to one split.
    choices: dict[int, tuple[str, ...]] = {0: ()}
    for group_key, indices in groups:
        for size in sorted(tuple(choices), reverse=True):
            new_size = size + len(indices)
            if new_size <= max_validation_size and new_size not in choices:
                choices[new_size] = choices[size] + (group_key,)
    validation_size = min(
        (size for size in choices if size > 0),
        key=lambda size: (abs(size - target_size), size < target_size),
    )
    validation_groups = set(choices[validation_size])
    validation_indices = {
        index
        for group_key in validation_groups
        for index in grouped[group_key]
    }
    train = [doc for index, doc in enumerate(documents) if index not in validation_indices]
    validation = [doc for index, doc in enumerate(documents) if index in validation_indices]
    return train, validation


class TextWindowDataset(Dataset[tuple[torch.Tensor, torch.Tensor, torch.Tensor]]):
    def __init__(
        self,
        documents: list[str],
        tokenizer: ByteTokenizer,
        *,
        block_size: int,
    ) -> None:
        if block_size < 2:
            raise ValueError("block_size must be at least 2")
        self.block_size = block_size
        self.pad_id = tokenizer.PAD
        self.windows: list[list[int]] = []
        for document in documents:
            tokens = tokenizer.encode(document, add_bos=True, add_eos=True)
            for start in range(0, max(1, len(tokens) - 1), block_size):
                window = tokens[start : start + block_size + 1]
                if len(window) >= 2:
                    self.windows.append(window)
        if not self.windows:
            raise ValueError("dataset produced no next-token training windows")

    def __len__(self) -> int:
        return len(self.windows)

    def __getitem__(self, index: int) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        window = self.windows[index]
        input_tokens = window[:-1]
        target_tokens = window[1:]
        valid_length = len(input_tokens)
        pad_length = self.block_size - valid_length
        input_tokens = input_tokens + [self.pad_id] * pad_length
        target_tokens = target_tokens + [-100] * pad_length
        mask = [1] * valid_length + [0] * pad_length
        return (
            torch.tensor(input_tokens, dtype=torch.long),
            torch.tensor(target_tokens, dtype=torch.long),
            torch.tensor(mask, dtype=torch.bool),
        )
