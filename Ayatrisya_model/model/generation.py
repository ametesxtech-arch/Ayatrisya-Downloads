from __future__ import annotations

import threading
import time

import torch

from .tokenizer import ByteTokenizer
from .transformer import SeedTransformer


class GenerationCancelled(RuntimeError):
    pass


class GenerationTimedOut(TimeoutError):
    pass


@torch.inference_mode()
def generate(
    model: SeedTransformer,
    tokenizer: ByteTokenizer,
    prompt: str,
    *,
    max_new_tokens: int = 64,
    temperature: float = 0.8,
    top_k: int = 40,
    top_p: float = 0.95,
    repetition_penalty: float = 1.0,
    cancel_event: threading.Event | None = None,
    deadline: float | None = None,
) -> str:
    if max_new_tokens < 0 or max_new_tokens > 512:
        raise ValueError("max_new_tokens must be between 0 and 512")
    if temperature < 0:
        raise ValueError("temperature cannot be negative")
    if top_k < 0:
        raise ValueError("top_k cannot be negative")
    if not 0 < top_p <= 1:
        raise ValueError("top_p must be in (0, 1]")
    if repetition_penalty < 1.0 or repetition_penalty > 2.0:
        raise ValueError("repetition_penalty must be in [1, 2]")
    if not isinstance(prompt, str):
        raise TypeError("prompt must be a string")

    model.eval()
    device = next(model.parameters()).device
    tokens = tokenizer.encode(prompt, add_bos=True)
    if not tokens:
        tokens = [tokenizer.BOS]
    tokens = tokens[-model.config.max_seq_len :]
    generated: list[int] = []

    for _ in range(max_new_tokens):
        if cancel_event is not None and cancel_event.is_set():
            raise GenerationCancelled("generation was cancelled")
        if deadline is not None and time.monotonic() >= deadline:
            raise GenerationTimedOut("generation exceeded the request time limit")
        model_input = torch.tensor(
            [tokens[-model.config.max_seq_len :]], dtype=torch.long, device=device
        )
        logits, _ = model(model_input)
        if cancel_event is not None and cancel_event.is_set():
            raise GenerationCancelled("generation was cancelled")
        if deadline is not None and time.monotonic() >= deadline:
            raise GenerationTimedOut("generation exceeded the request time limit")
        next_logits = logits[0, -1].float().clone()
        next_logits[tokenizer.PAD] = -torch.inf
        next_logits[tokenizer.BOS] = -torch.inf
        if repetition_penalty > 1 and generated:
            for token_id in set(generated):
                if next_logits[token_id] > 0:
                    next_logits[token_id] /= repetition_penalty
                else:
                    next_logits[token_id] *= repetition_penalty

        if temperature == 0:
            next_token = int(torch.argmax(next_logits).item())
        else:
            next_logits /= temperature
            if top_k:
                k = min(top_k, next_logits.numel())
                threshold = torch.topk(next_logits, k).values[-1]
                next_logits[next_logits < threshold] = -torch.inf
            if top_p < 1:
                sorted_logits, sorted_indices = torch.sort(next_logits, descending=True)
                cumulative = torch.softmax(sorted_logits, dim=-1).cumsum(dim=-1)
                remove = cumulative > top_p
                remove[1:] = remove[:-1].clone()
                remove[0] = False
                next_logits[sorted_indices[remove]] = -torch.inf
            probabilities = torch.softmax(next_logits, dim=-1)
            if not torch.isfinite(probabilities).all() or probabilities.sum() <= 0:
                raise RuntimeError("generation produced invalid token probabilities")
            next_token = int(torch.multinomial(probabilities, 1).item())

        if next_token == tokenizer.EOS:
            break
        tokens.append(next_token)
        generated.append(next_token)

    return tokenizer.decode(generated)
