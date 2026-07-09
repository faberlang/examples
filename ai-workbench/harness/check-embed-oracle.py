#!/usr/bin/env python3
from __future__ import annotations

import json
import pathlib
import subprocess
import sys

import minilm_oracle


TOLERANCE = 1e-6


def workspace_root() -> pathlib.Path:
    return pathlib.Path(__file__).resolve().parents[3]


def load_json(path: pathlib.Path) -> dict:
    return json.loads(path.read_text())


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
    actual_path = pathlib.Path("/tmp/faber-ai-minilm-oracle-cli.fvi")
    actual_path.unlink(missing_ok=True)

    texts = minilm_oracle.read_texts(texts_path)
    expected = minilm_oracle.artifact(
        model_alias="basic/minilm",
        source="sentence-transformers/all-MiniLM-L6-v2",
        oracle_label=minilm_oracle.DEFAULT_ORACLE_LABEL,
        texts=texts,
        vectors=minilm_oracle.embed(model_dir, texts),
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
        minilm_oracle.DEFAULT_ORACLE_LABEL,
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
        print(f"FAIL embed oracle command exited {result.returncode}", file=sys.stderr)
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
        "oracle": minilm_oracle.DEFAULT_ORACLE_LABEL,
    }.items():
        if summary.get(key) != expected_value:
            failures.append(f"summary {key}={summary.get(key)!r}, expected {expected_value!r}")
    if not actual_path.exists():
        failures.append(f"missing output artifact {actual_path}")
    else:
        actual = load_json(actual_path)
        for key in ["format", "model", "source", "status", "input_count", "dimensions", "normalization", "oracle"]:
            if actual.get(key) != expected.get(key):
                failures.append(f"artifact {key}={actual.get(key)!r}, expected {expected.get(key)!r}")
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
    print(f"ok: local MiniLM oracle-backed embed max_abs_error={error} tolerance={TOLERANCE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
