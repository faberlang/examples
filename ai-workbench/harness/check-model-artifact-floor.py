#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import pathlib
import sys
import tomllib
from typing import Any


EXPECTED_FORMAT = "faber-ai-model-artifact-v0"
EXPECTED_TOKENIZER_FORMAT = "faber-ai-tokenizer-v0"
FORBIDDEN_TRUE_CLAIMS = [
    "faber_owned_inference",
    "llama_cpp_runtime",
    "gguf_runtime",
    "general_inference",
    "public_product_release",
]


def workspace_root() -> pathlib.Path:
    return pathlib.Path(__file__).resolve().parents[3]


def fail(failures: list[str], message: str) -> None:
    failures.append(message)


def read_json(path: pathlib.Path) -> dict[str, Any]:
    return json.loads(path.read_text())


def sha256_metadata(value: Any) -> str:
    payload = json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
    return "sha256:" + hashlib.sha256(payload).hexdigest()


def fixture_path(root: pathlib.Path, relative: str) -> pathlib.Path:
    return root / relative


def encode(text: str, vocab: dict[str, int], unknown_id: int) -> list[int]:
    return [vocab.get(token, unknown_id) for token in text.split()]


def decode(ids: list[int], vocab: dict[str, int], unknown_token: str) -> str:
    reverse = {value: key for key, value in vocab.items()}
    return " ".join(reverse.get(token_id, unknown_token) for token_id in ids)


def main() -> int:
    root = workspace_root()
    contract_path = root / "examples/ai-workbench/model-artifact-floor.toml"
    lifecycle_path = root / "examples/ai-workbench/session-lifecycle.toml"
    readme_path = root / "examples/ai-workbench/README.md"

    contract = tomllib.loads(contract_path.read_text())
    lifecycle = tomllib.loads(lifecycle_path.read_text())
    readme = readme_path.read_text()
    floor = contract["model_artifact_floor"]
    valid = read_json(fixture_path(root, floor["valid_fixture"]))
    unsupported = read_json(fixture_path(root, floor["unsupported_fixture"]))
    cases = read_json(fixture_path(root, floor["tokenizer_cases"]))
    failures: list[str] = []

    if floor["format"] != EXPECTED_FORMAT:
        fail(failures, "contract format must stay faber-ai-model-artifact-v0")
    if floor["state_label"] != "local-ops" or floor["future_state"] != "faber-owned":
        fail(failures, "contract must stay local-ops now and future faber-owned")

    guarded = contract["guarded_claims"]
    for key in FORBIDDEN_TRUE_CLAIMS + ["model_blobs_in_git", "implicit_model_downloads"]:
        if guarded.get(key) is not False:
            fail(failures, f"guarded claim {key} must remain false")

    for key in contract["required_fields"]["top_level"]:
        if key not in valid:
            fail(failures, f"valid fixture missing top-level field {key}")
    if valid.get("format") != EXPECTED_FORMAT:
        fail(failures, "valid fixture format mismatch")
    if valid.get("status") != "local-ops":
        fail(failures, "valid fixture status must be local-ops")

    metadata = valid.get("metadata", {})
    for key in contract["required_fields"]["metadata"]:
        if key not in metadata:
            fail(failures, f"metadata missing field {key}")
    tensors = valid.get("tensors", [])
    if metadata.get("tensor_count") != len(tensors):
        fail(failures, "metadata tensor_count must match tensor list")
    parameter_count = 0
    for tensor in tensors:
        for key in contract["required_fields"]["tensor"]:
            if key not in tensor:
                fail(failures, f"tensor missing field {key}")
        count = 1
        for dim in tensor.get("shape", []):
            count *= int(dim)
        parameter_count += count
        checksum_input = {
            "name": tensor.get("name"),
            "dtype": tensor.get("dtype"),
            "shape": tensor.get("shape"),
        }
        expected_checksum = sha256_metadata(checksum_input)
        if tensor.get("checksum") != expected_checksum:
            fail(failures, f"tensor {tensor.get('name')} checksum mismatch")
    if metadata.get("parameter_count") != parameter_count:
        fail(failures, "metadata parameter_count must match tensor shapes")

    tokenizer = valid.get("tokenizer", {})
    for key in contract["required_fields"]["tokenizer"]:
        if key not in tokenizer:
            fail(failures, f"tokenizer missing field {key}")
    if tokenizer.get("format") != EXPECTED_TOKENIZER_FORMAT:
        fail(failures, "tokenizer fixture format mismatch")
    vocab = tokenizer.get("vocab", {})
    if tokenizer.get("checksum") != sha256_metadata(vocab):
        fail(failures, "tokenizer vocabulary checksum mismatch")
    if sorted(vocab.values()) != list(range(len(vocab))):
        fail(failures, "tokenizer vocabulary ids must be contiguous from zero")

    unknown_token = tokenizer.get("unknown_token")
    unknown_id = int(vocab.get(unknown_token, -1))
    floor_tokenizer = contract["tokenizer_floor"]
    if floor_tokenizer["unknown_token"] != unknown_token or floor_tokenizer["unknown_token_id"] != unknown_id:
        fail(failures, "tokenizer unknown-token contract must match fixture")
    for case in cases.get("cases", []):
        encoded = encode(case["text"], vocab, unknown_id)
        if encoded != case["encode"]:
            fail(failures, f"{case['id']} encode {encoded!r} != {case['encode']!r}")
        decoded = decode(case["encode"], vocab, unknown_token)
        if decoded != case["decode"]:
            fail(failures, f"{case['id']} decode {decoded!r} != {case['decode']!r}")
        unknown_count = sum(1 for token_id in encoded if token_id == unknown_id)
        if unknown_count != case["unknown_count"]:
            fail(failures, f"{case['id']} unknown_count {unknown_count} != {case['unknown_count']}")

    for diagnostic in contract["diagnostics"]["valid"]:
        if diagnostic not in valid.get("diagnostics", []):
            fail(failures, f"valid fixture missing diagnostic {diagnostic!r}")
    for key in FORBIDDEN_TRUE_CLAIMS:
        if valid.get("claims", {}).get(key) is not False:
            fail(failures, f"valid fixture claim {key} must remain false")

    if unsupported.get("status") != "error":
        fail(failures, "unsupported fixture status must be error")
    if unsupported.get("format") == EXPECTED_FORMAT:
        fail(failures, "unsupported fixture must use an unsupported format")
    diagnostics = "\n".join(unsupported.get("diagnostics", []))
    if floor["unsupported_format_diagnostic"] not in diagnostics:
        fail(failures, "unsupported fixture must carry unsupported-format diagnostic")
    for key in FORBIDDEN_TRUE_CLAIMS:
        if unsupported.get("claims", {}).get(key) is not False:
            fail(failures, f"unsupported fixture claim {key} must remain false")

    generate_stage = next(stage for stage in lifecycle["stages"] if stage["lifecycle"] == "generate")
    lifecycle_inputs = " ".join(generate_stage["inputs"]).lower()
    if "model artifact" not in lifecycle_inputs or "tokenizer" not in lifecycle_inputs:
        fail(failures, "generate lifecycle inputs must include model artifact and tokenizer fixture")
    if "model-artifact-floor.toml" not in readme:
        fail(failures, "README must point at model-artifact-floor.toml")

    if failures:
        for failure in failures:
            print(f"FAIL {failure}", file=sys.stderr)
        return 1
    print("ok: model artifact and tokenizer floor")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
