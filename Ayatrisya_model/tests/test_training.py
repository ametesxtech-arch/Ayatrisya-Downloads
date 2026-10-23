from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

import torch

from model.config import ModelConfig
from model.tokenizer import ByteTokenizer
from model.transformer import SeedTransformer
from training.checkpoint import load_model_checkpoint, save_checkpoint
from training.data import TextWindowDataset, load_documents, split_documents
from training.trainer import TrainingConfig, train_model


class DataAndTrainingTests(unittest.TestCase):
    def test_dedup_split_and_jsonl_validation(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "data.txt"
            path.write_text(
                "alpha training paragraph\n\nbeta validation paragraph\n\nalpha training paragraph\n",
                encoding="utf-8",
            )
            docs, digest, duplicates = load_documents([path])
            train, validation = split_documents(docs, seed=4)
            self.assertEqual(len(docs), 2)
            self.assertEqual(duplicates, 1)
            self.assertEqual(len(digest), 64)
            self.assertEqual(len(train), 1)
            self.assertEqual(len(validation), 1)
            self.assertTrue(set(train).isdisjoint(validation))

            bad = Path(directory) / "bad.jsonl"
            bad.write_text(json.dumps({"not_text": "x"}) + "\n", encoding="utf-8")
            with self.assertRaises(ValueError):
                load_documents([bad])

    def test_windows_are_padded_without_crossing_document_boundaries(self) -> None:
        docs = ["short", "another"]
        dataset = TextWindowDataset(docs, ByteTokenizer(), block_size=16)
        x, y, mask = dataset[0]
        self.assertEqual(tuple(x.shape), (16,))
        self.assertEqual(tuple(y.shape), (16,))
        self.assertEqual(tuple(mask.shape), (16,))
        self.assertTrue(mask.any())
        self.assertTrue((y[~mask] == -100).all())

    def test_short_real_training_run_saves_and_reloads_checkpoint(self) -> None:
        torch.set_num_threads(1)
        config = ModelConfig(d_model=32, n_layers=1, n_heads=4, max_seq_len=16)
        tokenizer = ByteTokenizer()
        train_set = TextWindowDataset(
            ["one small training document", "another training sample"],
            tokenizer,
            block_size=config.max_seq_len,
        )
        validation_set = TextWindowDataset(
            ["held out validation document"],
            tokenizer,
            block_size=config.max_seq_len,
        )
        with tempfile.TemporaryDirectory() as directory:
            checkpoint = Path(directory) / "tiny.pt"
            result = train_model(
                train_dataset=train_set,
                validation_dataset=validation_set,
                model_config=config,
                training_config=TrainingConfig(
                    max_steps=1,
                    batch_size=1,
                    warmup_steps=1,
                    eval_batches=1,
                    checkpoint_every=1,
                    seed=3,
                ),
                device_name="cpu",
                checkpoint_path=checkpoint,
                dataset_sha256="a" * 64,
                duplicate_documents_removed=0,
                dataset_source_files=["synthetic-test.txt"],
                data_provenance="Synthetic unit-test text only.",
            )
            self.assertEqual(result["step"], 1)
            self.assertTrue(torch.isfinite(torch.tensor(result["last_train_loss"])))
            self.assertTrue(torch.isfinite(torch.tensor(result["validation_loss"])))
            self.assertTrue(checkpoint.is_file())
            self.assertTrue(checkpoint.with_suffix(".run.json").is_file())
            model, loaded_tokenizer, payload = load_model_checkpoint(checkpoint)
            self.assertEqual(model.parameter_count(), config.parameter_count_estimate())
            self.assertEqual(loaded_tokenizer.to_dict()["type"], "utf8-byte-v1")
            self.assertEqual(payload["training_state"]["step"], 1)
            self.assertEqual(
                payload["training_state"]["data_provenance_owner_statement"],
                "Synthetic unit-test text only.",
            )

    def test_untrained_checkpoint_is_rejected_for_inference(self) -> None:
        config = ModelConfig(d_model=32, n_layers=1, n_heads=4, max_seq_len=16)
        model = SeedTransformer(config)
        with tempfile.TemporaryDirectory() as directory:
            checkpoint = Path(directory) / "untrained.pt"
            save_checkpoint(
                checkpoint,
                model=model,
                tokenizer=ByteTokenizer(),
                training_state={"step": 0, "dataset_sha256": "a" * 64},
            )
            with self.assertRaises(ValueError):
                load_model_checkpoint(checkpoint)

    def test_epoch_bounded_training_with_gradient_accumulation(self) -> None:
        torch.set_num_threads(1)
        config = ModelConfig(d_model=32, n_layers=1, n_heads=4, max_seq_len=16)
        tokenizer = ByteTokenizer()
        train_set = TextWindowDataset(
            ["first short document", "second short document"],
            tokenizer,
            block_size=config.max_seq_len,
        )
        validation_set = TextWindowDataset(
            ["held out document"],
            tokenizer,
            block_size=config.max_seq_len,
        )
        with tempfile.TemporaryDirectory() as directory:
            result = train_model(
                train_dataset=train_set,
                validation_dataset=validation_set,
                model_config=config,
                training_config=TrainingConfig(
                    max_steps=None,
                    epochs=1,
                    batch_size=1,
                    gradient_accumulation_steps=2,
                    warmup_steps=1,
                    eval_batches=1,
                    checkpoint_every=1,
                    seed=5,
                ),
                device_name="cpu",
                checkpoint_path=Path(directory) / "epoch.pt",
                dataset_sha256="b" * 64,
                duplicate_documents_removed=0,
                dataset_source_files=["synthetic-epoch-test.txt"],
                data_provenance="Synthetic unit-test text only.",
            )
            self.assertEqual(result["epochs_completed"], 1)
            self.assertEqual(result["step"], 2)


if __name__ == "__main__":
    unittest.main()
