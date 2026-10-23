from __future__ import annotations

from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class ModelConfig:
    """Small decoder-only language-model configuration."""

    vocab_size: int = 260
    d_model: int = 128
    n_layers: int = 4
    n_heads: int = 4
    max_seq_len: int = 256
    dropout: float = 0.0
    pad_token_id: int = 256
    bos_token_id: int = 257
    eos_token_id: int = 258

    def __post_init__(self) -> None:
        if self.vocab_size < 260:
            raise ValueError("vocab_size must include all 256 byte and 4 special tokens")
        if self.d_model <= 0 or self.n_layers <= 0 or self.n_heads <= 0:
            raise ValueError("model dimensions and layer counts must be positive")
        if self.d_model % self.n_heads:
            raise ValueError("d_model must be divisible by n_heads")
        if (self.d_model // self.n_heads) % 2:
            raise ValueError("rotary attention requires an even head dimension")
        if self.max_seq_len < 2:
            raise ValueError("max_seq_len must be at least 2")
        if not 0.0 <= self.dropout < 1.0:
            raise ValueError("dropout must be in [0, 1)")
        special_ids = (self.pad_token_id, self.bos_token_id, self.eos_token_id)
        if len(set(special_ids)) != len(special_ids):
            raise ValueError("special token IDs must be unique")
        if any(token_id < 256 or token_id >= self.vocab_size for token_id in special_ids):
            raise ValueError("special token IDs must be outside the byte range and inside the vocabulary")

    def to_dict(self) -> dict[str, int | float]:
        return asdict(self)

    @classmethod
    def from_dict(cls, values: dict[str, object]) -> "ModelConfig":
        allowed = cls.__dataclass_fields__.keys()
        return cls(**{key: values[key] for key in allowed if key in values})

    def parameter_count_estimate(self) -> int:
        """Estimate parameters for this tied-embedding, GELU decoder."""
        width = self.d_model
        # QKV/projection + two biased MLP layers + two layer norms.
        per_layer = 12 * width * width + 9 * width
        embeddings = self.vocab_size * width
        final_norm = 2 * width
        return embeddings + self.n_layers * per_layer + final_norm

    def estimate_training_memory_bytes(self, batch_size: int = 1) -> int:
        """Conservative CPU/GPU estimate: parameters, gradients, optimizer, activations."""
        params = self.parameter_count_estimate()
        parameter_state = params * 16  # fp32 weights/gradients and Adam moments
        activations = (
            batch_size
            * self.max_seq_len
            * self.d_model
            * self.n_layers
            * 8
        )
        attention = batch_size * self.n_heads * self.max_seq_len**2 * 4
        return parameter_state + activations + attention
