#!/usr/bin/env python3
from __future__ import annotations

import sys

from claim_gates import FORBIDDEN_INFERENCE_CLAIMS, false_claim_failures


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
        allowed_unknown_claims=("documented_local_metadata_claim",),
    ):
        failures.append("documented unknown claim exception must pass when explicitly supplied")

    if failures:
        for failure in failures:
            print(f"FAIL {failure}", file=sys.stderr)
        return 1
    print("ok: shared claim gates")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
