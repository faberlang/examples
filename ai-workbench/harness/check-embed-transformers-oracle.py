#!/usr/bin/env python3
from __future__ import annotations

import json
import pathlib
import subprocess
import sys

import torch

try:
    from transformers import AutoModel, AutoTokenizer
except ImportError as exc:
    print(f"BLOCK missing Transformers oracle dependency: {exc}", file=sys.stderr)
    raise SystemExit(2)

import minilm_oracle


TOLERANCE = 1e-5


def workspace_root() -> pathlib.Path:
    return pathlib.Path(__file__).resolve().parents[3]


def load_json(path: pathlib.Path) -> dict:
    return json.loads(path.read_text())


def transformers_vectors(model_dir: pathlib.Path, texts: list[str]) -> list[list[float]]:
    sentence_config_path = model_dir / "sentence_bert_config.json"
    max_seq_length = 256
    if sentence_config_path.exists():
        sentence_config = json.loads(sentence_config_path.read_text())
        max_seq_length = int(sentence_config.get("max_seq_length", max_seq_length))

    tokenizer = AutoTokenizer.from_pretrained(model_dir, local_files_only=True)
    model = AutoModel.from_pretrained(model_dir, local_files_only=True)
    model.eval()

    encoded = tokenizer(
        texts,
        padding=True,
        truncation=True,
        max_length=max_seq_length,
        return_tensors="pt",
    )
    with torch.no_grad():
        output = model(**encoded)
    token_embeddings = output.last_hidden_state
    mask = encoded["attention_mask"].unsqueeze(-1).float()
    pooled = (token_embeddings * mask).sum(dim=1) / mask.sum(dim=1).clamp(min=1e-9)
    vectors = torch.nn.functional.normalize(pooled, p=2, dim=1)
    return [[float(value) for value in row] for row in vectors.tolist()]


def main() -> int:
    root = workspace_root()
    model_dir = pathlib.Path("/Users/ianzepp/ai/models/all-MiniLM-L6-v2")
    required = [
        model_dir / "model.safetensors",
        model_dir / "tokenizer.json",
        model_dir / "config.json",
        model_dir / "1_Pooling/config.json",
    ]
    missing = [path for path in required if not path.is_file()]
    if missing:
        print(
            "BLOCK missing local MiniLM oracle files: "
            + ", ".join(str(path) for path in missing),
            file=sys.stderr,
        )
        return 2

    texts_path = root / "examples/ai-workbench/harness/fixtures/embed/texts.txt"
    actual_path = pathlib.Path("/tmp/faber-ai-minilm-transformers-oracle-cli.fvi")
    actual_path.unlink(missing_ok=True)

    texts = minilm_oracle.read_texts(texts_path)
    expected = minilm_oracle.artifact(
        model_alias="basic/minilm",
        source="sentence-transformers/all-MiniLM-L6-v2",
        oracle_label="transformers-local",
        texts=texts,
        vectors=transformers_vectors(model_dir, texts),
    )

    command = [
        "cargo",
        "run",
        "--manifest-path",
        str(root / "faber/Cargo.toml"),
        "--",
        "run",
        str(root / "examples/ai-workbench/packages/faber-ai"),
        "--",
        "embed",
        str(texts_path),
        "--model",
        "basic/minilm",
        "--out",
        str(actual_path),
        "--format",
        "json",
        "--alias-map",
        str(root / "docs/campaigns/ai-workbench/model-aliases.toml"),
        "--oracle-runner",
        str(root / "examples/ai-workbench/harness/minilm_oracle.py"),
        "--oracle-label",
        "manual-minilm-torch",
    ]
    result = subprocess.run(
        command,
        cwd=root,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=180,
    )
    if result.returncode != 0:
        sys.stderr.write(result.stdout)
        sys.stderr.write(result.stderr)
        print(
            f"FAIL embed oracle command exited {result.returncode}",
            file=sys.stderr,
        )
        return 1

    summary = json.loads(result.stdout.strip().splitlines()[-1])
    failures: list[str] = []
    error = float("nan")
    for key, expected_value in {
        "model": "basic/minilm",
        "source": "sentence-transformers/all-MiniLM-L6-v2",
        "status": "oracle-backed",
        "input_count": len(texts),
        "dimensions": 384,
        "normalization": "l2",
        "oracle": "manual-minilm-torch",
    }.items():
        if summary.get(key) != expected_value:
            failures.append(
                f"summary {key}={summary.get(key)!r}, expected {expected_value!r}"
            )
    if not actual_path.exists():
        failures.append(f"missing output artifact {actual_path}")
    else:
        actual = load_json(actual_path)
        for key in [
            "format",
            "model",
            "source",
            "status",
            "input_count",
            "dimensions",
            "normalization",
        ]:
            if actual.get(key) != expected.get(key):
                failures.append(
                    f"artifact {key}={actual.get(key)!r}, expected {expected.get(key)!r}"
                )
        error = minilm_oracle.max_abs_error(actual, expected)
        if error > TOLERANCE:
            failures.append(f"max_abs_error={error}, tolerance={TOLERANCE}")

    actual_path.unlink(missing_ok=True)

    if failures:
        sys.stderr.write(result.stdout)
        sys.stderr.write(result.stderr)
        for failure in failures:
            print(f"FAIL {failure}", file=sys.stderr)
        return 1
    print(
        "ok: local MiniLM manual oracle matches Transformers "
        f"max_abs_error={error} tolerance={TOLERANCE}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
