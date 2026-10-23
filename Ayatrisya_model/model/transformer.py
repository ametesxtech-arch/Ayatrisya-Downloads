from __future__ import annotations

import math

import torch
from torch import nn
from torch.nn import functional as F

from .config import ModelConfig


def _rotate_pairs(value: torch.Tensor) -> torch.Tensor:
    even = value[..., 0::2]
    odd = value[..., 1::2]
    return torch.stack((-odd, even), dim=-1).flatten(-2)


def _apply_rope(
    query: torch.Tensor,
    key: torch.Tensor,
    *,
    base: float = 10_000.0,
) -> tuple[torch.Tensor, torch.Tensor]:
    seq_len = query.shape[-2]
    head_dim = query.shape[-1]
    device = query.device
    positions = torch.arange(seq_len, device=device, dtype=torch.float32)
    frequencies = base ** (
        -torch.arange(0, head_dim, 2, device=device, dtype=torch.float32) / head_dim
    )
    angles = torch.outer(positions, frequencies)
    angles = torch.repeat_interleave(angles, 2, dim=-1)
    cos = angles.cos().to(dtype=query.dtype)[None, None, :, :]
    sin = angles.sin().to(dtype=query.dtype)[None, None, :, :]
    return (
        query * cos + _rotate_pairs(query) * sin,
        key * cos + _rotate_pairs(key) * sin,
    )


class CausalSelfAttention(nn.Module):
    def __init__(self, config: ModelConfig) -> None:
        super().__init__()
        self.n_heads = config.n_heads
        self.head_dim = config.d_model // config.n_heads
        self.qkv = nn.Linear(config.d_model, 3 * config.d_model, bias=False)
        self.output = nn.Linear(config.d_model, config.d_model, bias=False)
        self.attention_dropout = nn.Dropout(config.dropout)
        self.residual_dropout = nn.Dropout(config.dropout)

    def forward(
        self,
        hidden: torch.Tensor,
        attention_mask: torch.Tensor | None = None,
    ) -> torch.Tensor:
        batch, seq_len, width = hidden.shape
        qkv = self.qkv(hidden).view(
            batch, seq_len, 3, self.n_heads, self.head_dim
        )
        query, key, value = qkv.unbind(dim=2)
        query = query.transpose(1, 2)
        key = key.transpose(1, 2)
        value = value.transpose(1, 2)
        query, key = _apply_rope(query, key)

        scores = torch.matmul(query, key.transpose(-2, -1)) / math.sqrt(self.head_dim)
        allowed = torch.ones(
            seq_len, seq_len, dtype=torch.bool, device=hidden.device
        ).tril()[None, None, :, :]
        if attention_mask is not None:
            if attention_mask.shape != (batch, seq_len):
                raise ValueError("attention_mask must have shape (batch, sequence)")
            allowed = allowed & attention_mask.to(torch.bool)[:, None, None, :]
        scores = scores.masked_fill(~allowed, torch.finfo(scores.dtype).min)
        probabilities = F.softmax(scores, dim=-1)
        probabilities = self.attention_dropout(probabilities)
        attended = torch.matmul(probabilities, value)
        attended = attended.transpose(1, 2).contiguous().view(batch, seq_len, width)
        return self.residual_dropout(self.output(attended))


class FeedForward(nn.Module):
    def __init__(self, config: ModelConfig) -> None:
        super().__init__()
        self.network = nn.Sequential(
            nn.Linear(config.d_model, 4 * config.d_model),
            nn.GELU(),
            nn.Linear(4 * config.d_model, config.d_model),
            nn.Dropout(config.dropout),
        )

    def forward(self, hidden: torch.Tensor) -> torch.Tensor:
        return self.network(hidden)


class DecoderBlock(nn.Module):
    def __init__(self, config: ModelConfig) -> None:
        super().__init__()
        self.attention_norm = nn.LayerNorm(config.d_model)
        self.attention = CausalSelfAttention(config)
        self.feed_forward_norm = nn.LayerNorm(config.d_model)
        self.feed_forward = FeedForward(config)

    def forward(
        self,
        hidden: torch.Tensor,
        attention_mask: torch.Tensor | None = None,
    ) -> torch.Tensor:
        hidden = hidden + self.attention(
            self.attention_norm(hidden), attention_mask=attention_mask
        )
        return hidden + self.feed_forward(self.feed_forward_norm(hidden))


class SeedTransformer(nn.Module):
    """Decoder-only causal language model; initialization alone is not an assistant."""

    def __init__(self, config: ModelConfig) -> None:
        super().__init__()
        self.config = config
        self.token_embedding = nn.Embedding(
            config.vocab_size, config.d_model, padding_idx=config.pad_token_id
        )
        self.blocks = nn.ModuleList(
            [DecoderBlock(config) for _ in range(config.n_layers)]
        )
        self.final_norm = nn.LayerNorm(config.d_model)
        self.lm_head = nn.Linear(config.d_model, config.vocab_size, bias=False)
        self.lm_head.weight = self.token_embedding.weight
        self.apply(self._initialize)
        with torch.no_grad():
            self.token_embedding.weight[config.pad_token_id].zero_()

    @staticmethod
    def _initialize(module: nn.Module) -> None:
        if isinstance(module, nn.Linear):
            nn.init.normal_(module.weight, mean=0.0, std=0.02)
            if module.bias is not None:
                nn.init.zeros_(module.bias)
        elif isinstance(module, nn.Embedding):
            nn.init.normal_(module.weight, mean=0.0, std=0.02)
            with torch.no_grad():
                module.weight[module.padding_idx].zero_()
        elif isinstance(module, nn.LayerNorm):
            nn.init.ones_(module.weight)
            nn.init.zeros_(module.bias)

    def forward(
        self,
        input_ids: torch.Tensor,
        *,
        attention_mask: torch.Tensor | None = None,
        targets: torch.Tensor | None = None,
    ) -> tuple[torch.Tensor, torch.Tensor | None]:
        if input_ids.ndim != 2:
            raise ValueError("input_ids must have shape (batch, sequence)")
        if input_ids.shape[1] == 0 or input_ids.shape[1] > self.config.max_seq_len:
            raise ValueError("input sequence length is outside the configured context")
        if torch.any(input_ids < 0) or torch.any(input_ids >= self.config.vocab_size):
            raise ValueError("input_ids contain a token outside the vocabulary")

        hidden = self.token_embedding(input_ids)
        for block in self.blocks:
            hidden = block(hidden, attention_mask=attention_mask)
        logits = self.lm_head(self.final_norm(hidden))
        loss = None
        if targets is not None:
            if targets.shape != input_ids.shape:
                raise ValueError("targets must have the same shape as input_ids")
            loss = F.cross_entropy(
                logits.reshape(-1, self.config.vocab_size),
                targets.reshape(-1),
                ignore_index=-100,
            )
        return logits, loss

    def parameter_count(self) -> int:
        return sum(parameter.numel() for parameter in self.parameters())
