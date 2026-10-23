from __future__ import annotations

import argparse
import json
from pathlib import Path

from training.data import document_group_key, load_documents, split_documents

ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Validate owner-supplied UTF-8 TXT/JSONL documents without downloading data. "
            "JSONL may contain text or instruction/input/output fields."
        )
    )
    parser.add_argument("files", nargs="+", type=Path)
    parser.add_argument("--seed", type=int, default=17)
    parser.add_argument(
        "--provenance",
        required=True,
        help="Owner-declared source and permission basis; the tool does not verify rights.",
    )
    args = parser.parse_args()
    files = [path.resolve() for path in args.files]
    documents, dataset_hash, removed = load_documents(files)
    train, validation = split_documents(documents, seed=args.seed)
    report = {
        "files": [str(path) for path in files],
        "dataset_sha256": dataset_hash,
        "distinct_documents": len(documents),
        "distinct_instruction_groups": len(
            {document_group_key(document) for document in documents}
        ),
        "duplicate_documents_removed": removed,
        "train_documents": len(train),
        "validation_documents": len(validation),
        "train_instruction_groups": len({document_group_key(document) for document in train}),
        "validation_instruction_groups": len(
            {document_group_key(document) for document in validation}
        ),
        "sources_are_owner_supplied": True,
        "provenance_owner_statement": args.provenance,
        "provenance_verified_by_tool": False,
    }
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
