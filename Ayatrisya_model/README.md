# Ayatrisya Seed

**Experimental, locally trainable model project. Not an assistant or production model.**

Ayatrisya Seed contains first-party code for a small decoder-only Transformer, a
UTF-8 byte tokenizer, deterministic dataset preparation, resumable training,
evaluation, and a loopback-only inference server. The brief's required folder
was not present as a populated project; this implementation lives in the
existing empty `Ayatrisya_model/` directory. No existing weights, model repo,
or training corpus were assumed.

## Important status

- The architecture and software pipeline are implemented.
- The included corpus is synthetic test text created only for a short software
  smoke run. It is not useful pretraining data.
- A smoke-trained checkpoint is an experimental artifact, ignored by Git, and
  must not be used to answer real users.
- The desktop application can manage this local runner as a separate experimental
  prompt-test tool. It is not connected to website chat or normal desktop chat.
- No external model or AI inference API is called. The API server binds only to
  `127.0.0.1`.
- Windows commands are documented, but this Linux workspace does not verify
  Windows installation or execution.

## Requirements

- Python 3.10 or newer
- PyTorch 2.6 or newer
- CPU works; CUDA is optional and detected rather than assumed
- Enough free memory and disk space for the chosen configuration

### Linux/macOS setup

From this directory:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install torch --index-url https://download.pytorch.org/whl/cpu
python -m pip install -r requirements.txt
```

### Windows PowerShell setup

```powershell
py -3.13 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install torch --index-url https://download.pytorch.org/whl/cpu
python -m pip install -r requirements.txt
```

If that Python version has no matching wheel on the official PyTorch index,
install a currently supported Python version rather than bypassing package
verification. The commands above have not been run on Windows.

## Verify and run the smoke experiment

```bash
python -m unittest discover -s tests -v
python -m training.train --config configs/smoke.json --dry-run
python -m training.train --config configs/smoke.json
```

The smoke config is intentionally tiny and trains for six steps on the
synthetic sample. It writes `checkpoints/seed-smoke.pt` and a neighboring
`.run.json` record. Checkpoints are excluded from Git. To make a real training
run, use only data you are authorized to use and record the source and license.

For the user-provided instruction dataset in the Replit workspace, the bounded
20-epoch experiment is configured separately:

```bash
python -m training.train --config configs/user-dataset-fit.json --dry-run
python -m training.train --config configs/user-dataset-fit.json
python -m training.evaluate \
  --checkpoint checkpoints/seed-user-data-fit.pt \
  --data ../attached_assets/Pasted--instruction-Why-do-we-see-lightning-before-hearing-thu_1792735843206.txt
```

The input files are not copied into this project. Their license/provenance
metadata are owner-provided claims, not independently verified by the tool.

Validate provided text without downloading anything:

```bash
python -m training.prepare_data path/to/authorized-data.txt
```

Supported inputs are UTF-8 `.txt` files split into documents by blank lines
and UTF-8 JSONL (including newline-delimited JSON saved with a `.txt`
extension). A JSONL record may contain a `text` field or `instruction`,
optional `input`, and `output` fields. Instruction records are serialized as
plain text for next-byte training; this is not instruction fine-tuning.
Exact duplicate documents are removed. Documents are split before training;
normalized matching instruction templates stay in one split to prevent
template leakage. At least two distinct instruction groups are required.
Every training configuration must include a
`data_provenance` owner statement describing sources and permission basis. The
software records that statement but cannot verify legal rights.

## Local inference API

Only after training a checkpoint:

```bash
python -m inference.server --checkpoint checkpoints/seed-smoke.pt
```

The server listens on `127.0.0.1:49382`; it cannot bind to a LAN or public
interface. It does not enable browser CORS by default. An exact browser origin
can be added with `--allow-origin`, but that exposes a no-login local generation
route to scripts running on that origin; do not use it for the public website.
Ayatrisya Desktop uses its context-isolated, permission-controlled local bridge
to manage this runner. Do not enable `--allow-origin` for the website or PWA.

`GET /health` returns ready only when a compatible checkpoint loaded.
`POST /v1/generate` accepts JSON:

```json
{
  "request_id": "0123456789abcdef0123456789abcdef",
  "prompt": "A short prompt",
  "max_new_tokens": 32,
  "temperature": 0.8,
  "top_k": 40,
  "top_p": 0.95,
  "repetition_penalty": 1.0
}
```

`POST /v1/cancel` with the same `request_id` requests cancellation. Cancellation
and timeouts are checked between token-generation steps; an in-progress CPU
matrix operation cannot be interrupted. Requests are serialized, prompts are
not written to logs, bodies/prompts/outputs have size bounds, and generated
tokens are capped. A missing or invalid checkpoint returns not-ready/errors;
the server never silently substitutes random weights or canned responses.

Ayatrisya Desktop can start and stop this runner after the user selects a local
checkpoint. The desktop main process calls it through a fixed loopback address
via the context-isolated IPC bridge; it is not connected to workspace chat. The
website, PWA, phone, and remote pairing do not use this service. Do not forward
private conversations to it from a browser or network service.

## Training and evaluation

Set either `max_steps`, `epochs`, or both in the training configuration;
training stops at the first configured limit. Gradient accumulation works
across batches and partial final updates are scaled by the number of batches
actually accumulated. The run record stores the dataset content hash, seed, model/training
configuration, actual steps, train and validation losses, validation
perplexity, elapsed time, token counts, and device. Evaluation reports
next-byte cross-entropy/perplexity only; it does not establish reasoning,
instruction-following, coding skill, safety, or user readiness.

For a held-out evaluation of a checkpoint:

```bash
python -m training.evaluate \
  --checkpoint checkpoints/seed-smoke.pt \
  --data data/samples/smoke.txt
```

Evaluation defaults to the split seed recorded in the checkpoint; pass
`--seed` only to intentionally evaluate a different split. Use a sufficiently
large, legally usable, carefully separated corpus for meaningful evaluation.

For the combined user-provided synthetic corpus, use the separate experimental
configuration and checkpoint:

```bash
python -m training.train --config configs/synthetic-v2-experimental.json --dry-run
python -m training.train --config configs/synthetic-v2-experimental.json
python -m training.evaluate \
  --checkpoint checkpoints/seed-synthetic-v2-experimental.pt \
  --data \
    ../attached_assets/Pasted--instruction-Why-do-we-see-lightning-before-hearing-thu_1792736481903.txt \
    ../attached_assets/ayatrisya_seed_synthetic_v2_1792739038113.jsonl
```

To generate additional original synthetic examples and evaluate on a separate,
unseen prompt-template set:

```bash
python -m training.generate_synthetic_expansion
python -m training.train --config configs/expanded-experimental.json --dry-run
python -m training.train --config configs/expanded-experimental.json
python -m training.evaluate \
  --checkpoint checkpoints/seed-expanded-experimental.pt \
  --data data/generated/synthetic-expansion-eval.jsonl \
  --all-data
```

Generated examples are intended for internal experiments only; no public
license is assigned. The separate holdout is synthetic and is not a real-user
or independent capability benchmark.

## Project ownership and third-party components

First-party Ayatrisya Seed source and original documentation are intended to
remain proprietary to Ametesx; no public license to copy, modify, redistribute,
or commercially reuse those materials is granted by this repository. This
notice does not change third-party software or data licenses. PyTorch and its
transitive dependencies remain governed by their own upstream terms. See
`PROPRIETARY-NOTICE.md` and `MODEL_CARD.md`; confirm ownership authority and
any required assignments before distribution.
