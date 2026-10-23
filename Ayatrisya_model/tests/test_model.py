from __future__ import annotations

import threading
import time
import unittest

import torch

from model.config import ModelConfig
from model.generation import GenerationCancelled, GenerationTimedOut, generate
from model.tokenizer import ByteTokenizer
from model.transformer import SeedTransformer


def tiny_model() -> SeedTransformer:
    torch.manual_seed(9)
    return SeedTransformer(
        ModelConfig(d_model=32, n_layers=2, n_heads=4, max_seq_len=32)
    )


class ModelTests(unittest.TestCase):
    def test_parameter_count_matches_actual_parameters(self) -> None:
        model = tiny_model()
        self.assertEqual(model.config.parameter_count_estimate(), model.parameter_count())

    def test_forward_loss_and_gradients(self) -> None:
        model = tiny_model()
        input_ids = torch.randint(0, 256, (2, 12))
        targets = torch.randint(0, 256, (2, 12))
        logits, loss = model(input_ids, targets=targets)
        self.assertEqual(tuple(logits.shape), (2, 12, 260))
        self.assertIsNotNone(loss)
        assert loss is not None
        self.assertTrue(torch.isfinite(loss))
        loss.backward()
        self.assertIsNotNone(model.token_embedding.weight.grad)

    def test_attention_is_causal(self) -> None:
        model = tiny_model().eval()
        original = torch.randint(0, 255, (1, 10))
        changed_future = original.clone()
        changed_future[:, 6:] = torch.randint(0, 255, (1, 4))
        first_logits, _ = model(original)
        second_logits, _ = model(changed_future)
        self.assertTrue(torch.allclose(first_logits[:, :6], second_logits[:, :6], atol=1e-6))

    def test_attention_mask_keeps_padding_batch_finite(self) -> None:
        model = tiny_model()
        ids = torch.tensor([[257, 65, 66, 256], [257, 67, 256, 256]])
        mask = ids.ne(256)
        logits, loss = model(ids, attention_mask=mask, targets=ids)
        self.assertTrue(torch.isfinite(logits).all())
        self.assertIsNotNone(loss)

    def test_tokenizer_unicode_round_trip(self) -> None:
        tokenizer = ByteTokenizer()
        text = "Ayatrisya — नमस्ते 🌱"
        encoded = tokenizer.encode(text, add_bos=True, add_eos=True)
        self.assertEqual(tokenizer.decode(encoded), text)
        self.assertEqual(len(encoded), len(text.encode("utf-8")) + 2)

    def test_generation_respects_max_tokens_and_controls(self) -> None:
        model = tiny_model()
        tokenizer = ByteTokenizer()
        result = generate(
            model,
            tokenizer,
            "test",
            max_new_tokens=3,
            temperature=0,
            top_k=0,
        )
        self.assertIsInstance(result, str)
        self.assertLessEqual(len(result.encode("utf-8")), 12)
        self.assertEqual(generate(model, tokenizer, "test", max_new_tokens=0), "")

    def test_generation_cancellation_and_deadline(self) -> None:
        model = tiny_model()
        event = threading.Event()
        event.set()
        with self.assertRaises(GenerationCancelled):
            generate(model, ByteTokenizer(), "prompt", cancel_event=event)
        with self.assertRaises(GenerationTimedOut):
            generate(
                model,
                ByteTokenizer(),
                "prompt",
                deadline=time.monotonic() - 1,
            )

    def test_generation_rejects_unsafe_bounds(self) -> None:
        with self.assertRaises(ValueError):
            generate(tiny_model(), ByteTokenizer(), "x", max_new_tokens=513)
        with self.assertRaises(ValueError):
            generate(tiny_model(), ByteTokenizer(), "x", top_p=0)


if __name__ == "__main__":
    unittest.main()
