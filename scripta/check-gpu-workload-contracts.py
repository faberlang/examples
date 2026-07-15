#!/usr/bin/env python3
"""Validate examples-owned GPU workload oracle contracts."""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
RUNG4_REF = REPO / "gpu-workload" / "rung-4-toy-train.ref.json"
RUNG4_EXPECTED = REPO / "gpu-workload" / "rung-4-toy-train.expected"


def fail(failures: list[str], message: str) -> None:
    failures.append(message)


def close(left: float, right: float, tolerance: float) -> bool:
    return abs(left - right) <= tolerance


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def check_rung4(failures: list[str]) -> None:
    ref = load_json(RUNG4_REF)
    try:
        tolerance = float(ref["tolerance"])
    except (KeyError, TypeError, ValueError):
        fail(failures, "rung4 tolerance must be a finite non-negative number")
        return
    if not math.isfinite(tolerance) or tolerance < 0:
        fail(failures, "rung4 tolerance must be a finite non-negative number")
        return

    expected = load_json(RUNG4_EXPECTED)
    inputs = ref["inputs"]
    events = ref["session_contract"]["events"]

    weight = float(inputs["initial_weight"])
    x = float(inputs["x"])
    y = float(inputs["y"])
    rate = float(inputs["rate"])
    losses: list[float] = []
    weights: list[float] = []

    for index, event in enumerate(events):
        if int(event["step"]) != index:
            fail(failures, f"rung4 event {index}: step={event['step']!r}")
        if event["launch"] != "rung4_step_kernel":
            fail(failures, f"rung4 event {index}: unexpected launch {event['launch']!r}")
        if not close(float(event["previous_weight"]), weight, tolerance):
            fail(failures, f"rung4 event {index}: previous_weight mismatch")

        err = weight * x - y
        loss = err * err
        next_weight = weight - rate * err * x
        losses.append(loss)
        weights.append(next_weight)

        if not close(float(event["loss"]), loss, tolerance):
            fail(failures, f"rung4 event {index}: loss mismatch")
        if not close(float(event["next_weight"]), next_weight, tolerance):
            fail(failures, f"rung4 event {index}: next_weight mismatch")
        weight = next_weight

    if int(inputs["steps"]) != len(events):
        fail(failures, "rung4 inputs.steps does not match session event count")
    if ref["reference"] != expected:
        fail(failures, "rung4 .expected sidecar must mirror reference oracle")
    if len(ref["reference"]["losses"]) != len(losses):
        fail(failures, "rung4 reference loss count does not match session event count")
    if len(ref["reference"]["weights"]) != len(weights):
        fail(failures, "rung4 reference weight count does not match session event count")
    if any(
        not close(float(left), float(right), tolerance)
        for left, right in zip(ref["reference"]["losses"], losses)
    ):
        fail(failures, "rung4 reference losses do not match derived oracle")
    if any(
        not close(float(left), float(right), tolerance)
        for left, right in zip(ref["reference"]["weights"], weights)
    ):
        fail(failures, "rung4 reference weights do not match derived oracle")

    floor = ref["current_output_checked_floor"]
    for claim in ("device_training", "session_lifecycle", "optimizer_workflow", "pytorch_equivalence"):
        if int(floor[claim]) != 0:
            fail(failures, f"rung4 {claim} must remain a non-claim")
    if "PyTorch equivalence" not in ref["contract"]:
        fail(failures, "rung4 contract must explicitly reject PyTorch equivalence")


def main() -> int:
    failures: list[str] = []
    check_rung4(failures)
    if failures:
        print("gpu workload contract failures:", file=sys.stderr)
        for failure in failures:
            print(f"  - {failure}", file=sys.stderr)
        return 1
    print("gpu workload contracts ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
