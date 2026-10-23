# Ayatrisya Seed model card

## Identity

- **Name:** Ayatrisya Seed
- **Type:** Decoder-only causal Transformer language model
- **Status:** Experimental implementation and software smoke-test baseline
- **Owner:** Ametesx's intended proprietary product; ownership authority and
  assignments must be confirmed before external distribution
- **External inference services:** None

## Architecture

Token embeddings feed pre-normalized residual decoder blocks. Each block uses
multi-head causal self-attention with rotary position embeddings, a GELU
feed-forward network, layer normalization, residual connections, and dropout.
The language-model head shares weights with the token embedding. The model
predicts the next token using cross-entropy.

The included tokenizer is a deterministic UTF-8 byte tokenizer with PAD, BOS,
EOS, and UNK IDs. It has no external tokenizer vocabulary or downloaded model
assets. It is functional but byte-level tokenization is inefficient and is not
an indication of language capability.

The default architecture is configurable and deliberately small enough for
resource estimation before training. `configs/smoke.json` uses a smaller
two-layer, 64-wide model intended only for pipeline verification.

## Training data

No external corpus is included or downloaded. `data/samples/smoke.txt` is
synthetic text authored to test tokenization, loss calculation, checkpoints,
and inference. It does not provide a meaningful language-learning corpus.

For any future corpus, maintain source, license/permission basis, collection
date, and checksum. Do not provide private, personal, copyrighted, or
otherwise unauthorized text. The software deduplicates exact documents and
splits by document before training; this does not establish that a corpus is
lawful, safe, representative, or free of all leakage.

## Intended use

Development, reproducible pipeline testing, and research on a small
next-byte-prediction model. Do not use it for user-facing chat, study advice,
writing, coding, high-stakes decisions, or autonomous actions.

## Limitations and risks

- Random initialization is not an intelligent assistant.
- The synthetic smoke run is far too small to demonstrate general language
  ability.
- Byte-level vocabulary, limited context, and small model capacity restrict
  quality and efficiency.
- There are no instruction tuning, preference alignment, safety training,
  multilingual, coding, or reasoning evaluations.
- No real-user, Windows, GPU, load, security, or production-readiness test has
  been performed.
- Generated output can be incoherent or misleading. It must not be treated as
  factual advice.
- The local API is loopback-only, has no user authentication, and is not a
  public or multi-user service.

## Evaluation

The software reports only measured training/validation losses, held-out
next-byte perplexity, tokens, elapsed time, and a sample generated from the
loaded checkpoint. A synthetic-data score is a pipeline check, not a quality
benchmark.

## Reproducibility

Each training run records its seed, content hash, configuration, steps,
device, token counts, losses, and elapsed time. Checkpoint writes use a
temporary file plus atomic replacement. Never load model checkpoint files from
untrusted parties.

## License and ownership

Ayatrisya Seed's first-party code is intended to remain proprietary to
Ametesx; no public license is granted. Third-party runtime and transitive
dependency terms remain applicable. Verify company ownership authority,
assignments, and exact third-party notices before distributing source,
weights, or bundled software.
