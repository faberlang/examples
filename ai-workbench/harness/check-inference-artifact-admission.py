#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import pathlib
import subprocess
import sys
import tempfile
import tomllib
from typing import Any

from claim_gates import FORBIDDEN_INFERENCE_CLAIMS, false_claim_failures

EXPECTED_FORMAT = "faber-ai-inference-artifact-admission-v0"
EXPECTED_MODEL_FORMAT = "faber-ai-model-artifact-v0"
EXPECTED_TOKENIZER_FORMAT = "faber-ai-tokenizer-v0"
ALLOWED_TENSOR_DTYPES = {"BF16", "F8_E4M3"}
FORBIDDEN_TRUE_CLAIMS = FORBIDDEN_INFERENCE_CLAIMS
RUNTIME_KINDS = {"gguf", "transformer-runtime"}


def workspace_root() -> pathlib.Path:
    return pathlib.Path(__file__).resolve().parents[3]


def fail(failures: list[str], message: str) -> None:
    failures.append(message)


def read_json(path: pathlib.Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def load_events(path: pathlib.Path) -> list[dict[str, Any]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def sha256_metadata(value: Any) -> str:
    payload = json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
    return "sha256:" + hashlib.sha256(payload).hexdigest()


def path_for(root: pathlib.Path, relative: str) -> pathlib.Path:
    if relative.startswith("generated:"):
        raise ValueError(f"generated artifact has no static path: {relative}")
    return root / relative


def validate_tensor_metadata(artifact: dict[str, Any]) -> list[str]:
    failures: list[str] = []
    if artifact.get("format") != EXPECTED_MODEL_FORMAT:
        fail(failures, "model artifact format mismatch")
    if artifact.get("status") != "local-ops":
        fail(failures, "model artifact status must be local-ops")
    metadata = artifact.get("metadata", {})
    tensors = artifact.get("tensors", [])
    if metadata.get("tensor_count") != len(tensors):
        fail(failures, "tensor_count must match tensor rows")
    parameter_count = 0
    for tensor in tensors:
        dtype = tensor.get("dtype")
        if dtype not in ALLOWED_TENSOR_DTYPES:
            fail(failures, f"unsupported tensor dtype {dtype!r}")
        shape = tensor.get("shape", [])
        if not shape or any(not isinstance(dim, int) or dim <= 0 for dim in shape):
            fail(failures, f"tensor {tensor.get('name')} shape must use positive integer dimensions")
            continue
        count = 1
        for dim in shape:
            count *= dim
        parameter_count += count
        checksum_input = {
            "name": tensor.get("name"),
            "dtype": tensor.get("dtype"),
            "shape": tensor.get("shape"),
        }
        if tensor.get("checksum") != sha256_metadata(checksum_input):
            fail(failures, f"tensor {tensor.get('name')} checksum mismatch")
    if metadata.get("parameter_count") != parameter_count:
        fail(failures, "parameter_count must match admitted tensor shapes")
    return failures


def validate_tokenizer(artifact: dict[str, Any]) -> list[str]:
    failures: list[str] = []
    tokenizer = artifact.get("tokenizer", {})
    if tokenizer.get("format") != EXPECTED_TOKENIZER_FORMAT:
        fail(failures, "tokenizer format mismatch")
    vocab = tokenizer.get("vocab", {})
    unknown_token = tokenizer.get("unknown_token")
    if unknown_token not in vocab:
        fail(failures, "unknown token must be present in vocabulary")
    values = list(vocab.values())
    if sorted(values) != list(range(len(values))):
        fail(failures, "tokenizer vocabulary ids must be contiguous from zero")
    if len(set(values)) != len(values):
        fail(failures, "tokenizer vocabulary ids must be unique")
    if tokenizer.get("checksum") != sha256_metadata(vocab):
        fail(failures, "tokenizer vocabulary checksum mismatch")
    return failures


def validate_artifact_claims(artifact: dict[str, Any], label: str) -> list[str]:
    return false_claim_failures(artifact.get("claims"), label=label, require_all=True)


def validate_logits_events(events: list[dict[str, Any]], vocab: dict[str, int]) -> list[str]:
    failures: list[str] = []
    event_names = [event.get("event") for event in events]
    if event_names != ["metadata", "prefill", "logits", "token", "final"]:
        fail(failures, f"event sequence {event_names!r}")
        return failures
    by_name = {event["event"]: event for event in events}
    metadata = by_name["metadata"]
    for issue in false_claim_failures(metadata.get("claims"), label="logits metadata", require_all=True):
        fail(failures, issue)
    logits_event = by_name["logits"]
    logits = logits_event.get("values", [])
    if logits_event.get("dtype") != "f32":
        fail(failures, "logits dtype must stay f32")
    if logits_event.get("vocab_size") != len(vocab) or len(logits) != len(vocab):
        fail(failures, "logits vector does not match tokenizer vocabulary")
    if not all(isinstance(value, (int, float)) for value in logits):
        fail(failures, "logits values must be numeric")
    token = by_name["token"]
    if logits:
        selected_id = max(range(len(logits)), key=lambda index: float(logits[index]))
        reverse_vocab = {value: key for key, value in vocab.items()}
        if token.get("token_id") != selected_id:
            fail(failures, "selected token id must be argmax(logits)")
        if token.get("text") != reverse_vocab.get(selected_id):
            fail(failures, "selected token text must match tokenizer vocab")
        if by_name["final"].get("text") != token.get("text"):
            fail(failures, "final text must match selected token")
    return failures


def run_oracle(root: pathlib.Path, contract: dict[str, Any]) -> list[dict[str, Any]]:
    with tempfile.TemporaryDirectory(prefix="faber-ai-admission-") as temp:
        out = pathlib.Path(temp) / "token-logits.jsonl"
        result = subprocess.run(
            [
                "python3",
                str(path_for(root, contract["token_logits_oracle"])),
                "--prompt",
                str(path_for(root, contract["prompt"])),
                "--out",
                str(out),
                "--model-dir",
                str(root / "examples/ai-workbench/harness/fixtures/model-artifact"),
                "--model-alias",
                "tiny/inference-fixture",
                "--source",
                "examples admission boundary",
                "--oracle-label",
                "tiny-token-logits-oracle",
                "--max-new-tokens",
                "1",
                "--temperature",
                "0",
                "--seed",
                "7",
            ],
            cwd=root,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=30,
        )
        if result.returncode != 0:
            raise RuntimeError(result.stdout + result.stderr)
        return load_events(out)


def main() -> int:
    root = workspace_root()
    contract_path = root / "examples/ai-workbench/inference-artifact-admission.toml"
    readme_path = root / "examples/ai-workbench/README.md"
    contract_doc = tomllib.loads(contract_path.read_text())
    readme = readme_path.read_text()
    boundary = contract_doc["inference_artifact_admission"]
    failures: list[str] = []

    if boundary.get("format") != EXPECTED_FORMAT:
        fail(failures, "admission boundary format mismatch")
    if boundary.get("status") != "local-ops":
        fail(failures, "admission boundary must remain local-ops")
    if "fixture artifacts only" not in boundary.get("scope", ""):
        fail(failures, "admission boundary scope must stay parse/validation only")
    for issue in false_claim_failures(contract_doc["guarded_claims"], label="guarded", require_all=True):
        fail(failures, issue)

    accepted = contract_doc.get("accepted_artifact", [])
    malformed = contract_doc.get("malformed_artifact", [])
    if len(accepted) != boundary.get("accepted_count"):
        fail(failures, "accepted_count must match accepted rows")
    if len(malformed) != boundary.get("malformed_count"):
        fail(failures, "malformed_count must match malformed rows")

    model_artifact = read_json(root / "examples/ai-workbench/harness/fixtures/model-artifact/tiny-model.fma.json")
    vocab = model_artifact["tokenizer"]["vocab"]
    for row in accepted:
        if row.get("admission") != "accepted":
            fail(failures, f"{row['id']} must be accepted")
        if row.get("runtime_claim") is not False:
            fail(failures, f"{row['id']} must not claim runtime execution")
        if row["kind"] == "tensor-metadata":
            artifact = read_json(path_for(root, row["artifact"]))
            for issue in validate_tensor_metadata(artifact):
                fail(failures, f"{row['id']}: {issue}")
            for issue in validate_artifact_claims(artifact, row["id"]):
                fail(failures, f"{row['id']}: {issue}")
        elif row["kind"] == "tokenizer":
            artifact = read_json(path_for(root, row["artifact"]))
            for issue in validate_tokenizer(artifact):
                fail(failures, f"{row['id']}: {issue}")
            for issue in validate_artifact_claims(artifact, row["id"]):
                fail(failures, f"{row['id']}: {issue}")
        elif row["kind"] == "token-logits-jsonl":
            try:
                events = run_oracle(root, boundary)
            except RuntimeError as error:
                fail(failures, f"{row['id']}: oracle failed: {error}")
            else:
                for issue in validate_logits_events(events, vocab):
                    fail(failures, f"{row['id']}: {issue}")
        else:
            fail(failures, f"{row['id']} has unknown accepted artifact kind {row['kind']}")

    for row in malformed:
        artifact = path_for(root, row["artifact"])
        if not artifact.exists():
            fail(failures, f"{row['id']} missing malformed artifact path")
            continue
        if row.get("admission") != "rejected":
            fail(failures, f"{row['id']} must be rejected")
        if not row.get("reason"):
            fail(failures, f"{row['id']} must record a rejection reason")
        issues: list[str] = []
        if row["kind"] == "tensor-metadata":
            artifact_payload = read_json(artifact)
            issues = validate_tensor_metadata(artifact_payload)
            issues.extend(validate_artifact_claims(artifact_payload, row["id"]))
        elif row["kind"] == "tokenizer":
            artifact_payload = read_json(artifact)
            issues = validate_tokenizer(artifact_payload)
            issues.extend(validate_artifact_claims(artifact_payload, row["id"]))
        elif row["kind"] == "token-logits-jsonl":
            issues = validate_logits_events(load_events(artifact), vocab)
        elif row["kind"] in RUNTIME_KINDS:
            issues = [row["reason"]]
        else:
            fail(failures, f"{row['id']} has unknown malformed artifact kind {row['kind']}")
        if not issues:
            fail(failures, f"{row['id']} was expected to fail admission")

    if "inference-artifact-admission.toml" not in readme:
        fail(failures, "README must point at inference-artifact-admission.toml")

    if failures:
        for failure in failures:
            print(f"FAIL {failure}", file=sys.stderr)
        return 1
    print("ok: inference artifact admission boundary")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
