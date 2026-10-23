# Training data

This directory does not contain any third-party or private training corpus.
Only add data that Ametesx is authorized to use. Keep the original source,
license or permission basis, collection date, and a local checksum in the
training-run record. The training scripts never download datasets.
Supported JSONL records may contain a `text` field or an `instruction`,
optional `input`, and `output`. License and provenance fields remain
metadata—they are not included in the model's training text. The tool records
the owner's statement but does not independently verify reuse rights.

The small `samples/smoke.txt` file is synthetic text written only to exercise
the training pipeline. It is not a useful language-model training corpus.
