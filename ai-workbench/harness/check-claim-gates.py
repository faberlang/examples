#!/usr/bin/env python3
from __future__ import annotations

import json
import pathlib
import sys
import tempfile

from claim_gates import FORBIDDEN_INFERENCE_CLAIMS, false_claim_failures
from runner_artifact_claim_gate import validate_runner_artifact


def main() -> int:
    failures: list[str] = []

    full_false = {key: False for key in FORBIDDEN_INFERENCE_CLAIMS}
    if false_claim_failures(full_false, label="full false", require_all=True):
        failures.append("complete shared vocabulary with false values must pass")

    unknown_true = {**full_false, "renamed_public_runtime_claim": True}
    if not any(
        "renamed_public_runtime_claim" in issue
        for issue in false_claim_failures(unknown_true, label="unknown true", require_all=True)
    ):
        failures.append("unknown true claim key must fail require-all claim gate")

    partial = {"public_inference": False}
    missing = false_claim_failures(partial, label="partial", require_all=True)
    if not any("faber_owned_inference" in issue for issue in missing):
        failures.append("partial guarded claim vocabulary must fail require-all claim gate")

    unknown_exception = {**full_false, "documented_local_metadata_claim": False}
    if false_claim_failures(
        unknown_exception,
        label="documented exception",
        require_all=True,
        allowed_false_unknown_claims=("documented_local_metadata_claim",),
    ):
        failures.append(
            "documented false unknown claim exception must pass when explicitly supplied"
        )

    true_unknown_exception = {**full_false, "documented_local_metadata_claim": True}
    if not any(
        "documented_local_metadata_claim" in issue
        for issue in false_claim_failures(
            true_unknown_exception,
            label="documented true exception",
            require_all=True,
            allowed_false_unknown_claims=("documented_local_metadata_claim",),
        )
    ):
        failures.append("documented false unknown claim exception must reject true values")

    if false_claim_failures(
        true_unknown_exception,
        label="documented positive exception",
        require_all=True,
        allowed_true_claims=("documented_local_metadata_claim",),
    ):
        failures.append("documented positive exception must pass only through allowed_true_claims")

    with tempfile.TemporaryDirectory() as tmp:
        artifact = pathlib.Path(tmp) / "artifact.jsonl"
        artifact.write_text(
            json.dumps(
                {
                    "event": "metadata",
                    "status": "oracle-backed",
                    "claims": full_false,
                },
                separators=(",", ":"),
            )
            + "\n",
            encoding="utf-8",
        )
        if validate_runner_artifact(artifact, "oracle-backed"):
            failures.append("runner artifact gate must accept matching status with full false claims")
        if not any(
            "does not match" in issue
            for issue in validate_runner_artifact(artifact, "router-backed")
        ):
            failures.append("runner artifact gate must reject metadata/status mismatch")

    if failures:
        for failure in failures:
            print(f"FAIL {failure}", file=sys.stderr)
        return 1
    print("ok: shared claim gates")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
