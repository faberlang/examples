#!/usr/bin/env python3
from __future__ import annotations

import json
import math
import os
import pathlib
import subprocess
import sys

import qwen3_oracle


EXPECTED_DIMENSIONS = 1024
TOLERANCE = qwen3_oracle.TOLERANCE


def workspace_root() -> pathlib.Path:
    return pathlib.Path(__file__).resolve().parents[3]


def load_json(path: pathlib.Path) -> dict:
    return json.loads(path.read_text())


def validate_vectors(artifact: dict) -> list[str]:
    failures: list[str] = []
    vectors = artifact.get("vectors", [])
    if len(vectors) != artifact.get("input_count"):
        failures.append("artifact vector count does not match input_count")
    for item in vectors:
        values = item.get("values", [])
        if len(values) != EXPECTED_DIMENSIONS:
            failures.append(f"vector {item.get('id')} dimension {len(values)}, expected {EXPECTED_DIMENSIONS}")
            continue
        norm = math.sqrt(sum(float(value) * float(value) for value in values))
        if abs(norm - 1.0) > TOLERANCE:
            failures.append(f"vector {item.get('id')} l2 norm {norm}, tolerance {TOLERANCE}")
    return failures


def main() -> int:
    root = workspace_root()
    model_dir = pathlib.Path("/Users/ianzepp/ai/models/Qwen3-Embedding-0.6B")
    required = [
        model_dir / "model.safetensors",
        model_dir / "tokenizer.json",
        model_dir / "config.json",
        model_dir / "tokenizer_config.json",
    ]
    missing = [path for path in required if not path.is_file()]
    if missing:
        print(
            "BLOCK missing local Qwen3 oracle files: "
            + ", ".join(str(path) for path in missing),
            file=sys.stderr,
        )
        return 2
    if not qwen3_oracle.DEFAULT_VENV_PYTHON.exists():
        print(
            f"BLOCK missing Qwen3 oracle venv: {qwen3_oracle.DEFAULT_VENV_PYTHON}",
            file=sys.stderr,
        )
        return 2

    texts_path = root / "examples/ai-workbench/harness/fixtures/embed/texts.txt"
    actual_path = pathlib.Path("/tmp/faber-ai-qwen3-oracle-cli.fvi")
    expected_path = pathlib.Path("/tmp/faber-ai-qwen3-oracle-direct.fvi")
    actual_path.unlink(missing_ok=True)
    expected_path.unlink(missing_ok=True)

    env = os.environ.copy()
    env.update(
        {
            "HF_HUB_OFFLINE": "1",
            "TRANSFORMERS_OFFLINE": "1",
            "HF_HOME": "/Users/ianzepp/ai/huggingface-cache",
        }
    )

    expected_command = [
        str(qwen3_oracle.DEFAULT_VENV_PYTHON),
        str(root / "examples/ai-workbench/harness/qwen3_oracle.py"),
        "--texts",
        str(texts_path),
        "--out",
        str(expected_path),
        "--model-dir",
        str(model_dir),
        "--model-alias",
        "mid/qwen3-embed-0.6b",
        "--source",
        "Qwen/Qwen3-Embedding-0.6B",
        "--oracle-label",
        qwen3_oracle.DEFAULT_ORACLE_LABEL,
    ]
    expected_result = subprocess.run(
        expected_command,
        cwd=root,
        env=env,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=900,
    )
    if expected_result.returncode != 0:
        sys.stderr.write(expected_result.stdout)
        sys.stderr.write(expected_result.stderr)
        print(f"FAIL direct Qwen3 oracle exited {expected_result.returncode}", file=sys.stderr)
        return 1

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
        "mid/qwen3-embed-0.6b",
        "--out",
        str(actual_path),
        "--format",
        "json",
        "--alias-map",
        str(root / "docs/campaigns/ai-workbench/model-aliases.toml"),
        "--oracle-runner",
        str(root / "examples/ai-workbench/harness/qwen3_oracle.py"),
        "--oracle-label",
        qwen3_oracle.DEFAULT_ORACLE_LABEL,
    ]
    result = subprocess.run(
        command,
        cwd=root,
        env=env,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=900,
    )
    if result.returncode != 0:
        sys.stderr.write(result.stdout)
        sys.stderr.write(result.stderr)
        print(f"FAIL embed Qwen3 oracle command exited {result.returncode}", file=sys.stderr)
        return 1

    summary = json.loads(result.stdout.strip().splitlines()[-1])
    expected = load_json(expected_path)
    failures: list[str] = []
    for key, expected_value in {
        "model": "mid/qwen3-embed-0.6b",
        "source": "Qwen/Qwen3-Embedding-0.6B",
        "status": "oracle-backed",
        "input_count": expected["input_count"],
        "dimensions": EXPECTED_DIMENSIONS,
        "normalization": "l2",
        "oracle": qwen3_oracle.DEFAULT_ORACLE_LABEL,
    }.items():
        if summary.get(key) != expected_value:
            failures.append(f"summary {key}={summary.get(key)!r}, expected {expected_value!r}")

    error = float("nan")
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
            "oracle",
            "batch",
        ]:
            if actual.get(key) != expected.get(key):
                failures.append(f"artifact {key}={actual.get(key)!r}, expected {expected.get(key)!r}")
        failures.extend(validate_vectors(actual))
        error = qwen3_oracle.max_abs_error(actual, expected)
        if error > TOLERANCE:
            failures.append(f"max_abs_error={error}, tolerance={TOLERANCE}")

    actual_path.unlink(missing_ok=True)
    expected_path.unlink(missing_ok=True)

    if failures:
        sys.stderr.write(result.stdout)
        sys.stderr.write(result.stderr)
        for failure in failures:
            print(f"FAIL {failure}", file=sys.stderr)
        return 1
    print(f"ok: local Qwen3 oracle-backed embed max_abs_error={error} tolerance={TOLERANCE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
