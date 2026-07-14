#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import pathlib
import sys
from typing import Any

from claim_gates import false_claim_failures


def load_events(path: pathlib.Path) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.strip():
            continue
        try:
            event = json.loads(line)
        except json.JSONDecodeError as exc:
            raise ValueError(f"line {line_number}: invalid JSON: {exc}") from exc
        if not isinstance(event, dict):
            raise ValueError(f"line {line_number}: event must be a JSON object")
        events.append(event)
    return events


def validate_runner_artifact(path: pathlib.Path, expected_status: str) -> list[str]:
    failures: list[str] = []
    events = load_events(path)
    if not events:
        return ["runner artifact has no events"]

    first = events[0]
    if first.get("event") != "metadata":
        failures.append("runner artifact first event must be metadata")
        return failures
    if first.get("status") != expected_status:
        failures.append(
            f"runner artifact metadata status {first.get('status')!r} does not match {expected_status!r}"
        )
    failures.extend(
        false_claim_failures(
            first.get("claims"),
            label="runner artifact metadata",
            require_all=True,
        )
    )
    return failures


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate runner artifact claim metadata")
    parser.add_argument("artifact")
    parser.add_argument("expected_status", choices=["oracle-backed", "router-backed"])
    args = parser.parse_args()

    try:
        failures = validate_runner_artifact(pathlib.Path(args.artifact), args.expected_status)
    except (OSError, ValueError) as exc:
        failures = [str(exc)]

    if failures:
        for failure in failures:
            print(failure, file=sys.stderr)
        return 1
    print(f"ok: {args.artifact} {args.expected_status}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
