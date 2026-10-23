from __future__ import annotations


class ByteTokenizer:
    """Deterministic UTF-8 byte tokenizer with three reserved control tokens."""

    PAD = 256
    BOS = 257
    EOS = 258
    UNK = 259
    VOCAB_SIZE = 260

    def encode(
        self,
        text: str,
        *,
        add_bos: bool = False,
        add_eos: bool = False,
    ) -> list[int]:
        if not isinstance(text, str):
            raise TypeError("text must be a string")
        ids = list(text.encode("utf-8", errors="strict"))
        if add_bos:
            ids.insert(0, self.BOS)
        if add_eos:
            ids.append(self.EOS)
        return ids

    def decode(self, token_ids: list[int], *, skip_special: bool = True) -> str:
        byte_values: list[int] = []
        for raw_id in token_ids:
            token_id = int(raw_id)
            if 0 <= token_id <= 255:
                byte_values.append(token_id)
            elif token_id == self.EOS:
                if skip_special:
                    break
            elif token_id in (self.PAD, self.BOS, self.UNK) and not skip_special:
                continue
            elif token_id not in (self.PAD, self.BOS, self.EOS, self.UNK):
                raise ValueError(f"token ID {token_id} is outside the tokenizer vocabulary")
        return bytes(byte_values).decode("utf-8", errors="replace")

    def to_dict(self) -> dict[str, object]:
        return {
            "type": "utf8-byte-v1",
            "vocab_size": self.VOCAB_SIZE,
            "pad_token_id": self.PAD,
            "bos_token_id": self.BOS,
            "eos_token_id": self.EOS,
            "unk_token_id": self.UNK,
        }
