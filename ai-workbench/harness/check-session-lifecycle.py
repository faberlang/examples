#!/usr/bin/env python3
from __future__ import annotations

import pathlib
import sys
import tomllib

from claim_gates import false_claim_failures


EXPECTED_ORDER = ["inspect", "embed", "index", "query", "generate", "chat"]
EXPECTED_SURFACES = ["model inspect", "embed", "index", "query", "generate", "chat"]
REQUIRED_LABELS = {"blocked", "oracle-backed", "router-backed", "local-ops", "faber-owned"}


def workspace_root() -> pathlib.Path:
    return pathlib.Path(__file__).resolve().parents[3]


def fail(failures: list[str], message: str) -> None:
    failures.append(message)


def main() -> int:
    root = workspace_root()
    lifecycle_path = root / "examples/ai-workbench/session-lifecycle.toml"
    package_reuse_path = root / "examples/ai-workbench/package-reuse.toml"
    readme_path = root / "examples/ai-workbench/README.md"

    lifecycle = tomllib.loads(lifecycle_path.read_text())
    package_reuse = tomllib.loads(package_reuse_path.read_text())
    readme = readme_path.read_text()
    failures: list[str] = []

    session = lifecycle["session_lifecycle"]
    if session["order"] != EXPECTED_ORDER:
        fail(failures, f"lifecycle order must stay {EXPECTED_ORDER!r}")
    if set(session["status_labels"]) != REQUIRED_LABELS:
        fail(failures, f"status labels must be {sorted(REQUIRED_LABELS)!r}")
    if "workspace-external" not in session["campaign_reference_scope"]:
        fail(failures, "campaign reference scope must record docs/campaigns as workspace-external")
    if session["model_artifact_contract"] != "examples/ai-workbench/model-artifact-floor.toml":
        fail(failures, "lifecycle must point at the model artifact floor contract")

    guarded = lifecycle["guarded_claims"]
    for issue in false_claim_failures(guarded, label="guarded", require_all=True):
        fail(failures, issue)

    stages = lifecycle["stages"]
    stage_order = [stage["lifecycle"] for stage in stages]
    surfaces = [stage["surface"] for stage in stages]
    if stage_order != EXPECTED_ORDER:
        fail(failures, f"stage order {stage_order!r} != {EXPECTED_ORDER!r}")
    if surfaces != EXPECTED_SURFACES:
        fail(failures, f"stage surfaces {surfaces!r} != {EXPECTED_SURFACES!r}")

    package_surfaces = [command["surface"] for command in package_reuse["commands"]]
    if surfaces != package_surfaces:
        fail(failures, "lifecycle surfaces must match package-reuse command order")

    seen_labels: set[str] = set()
    for index, stage in enumerate(stages):
        states = set(stage["current_states"])
        seen_labels.update(states)
        seen_labels.add(stage["future_state"])
        unknown = (states | {stage["future_state"]}) - REQUIRED_LABELS
        if unknown:
            fail(failures, f"{stage['lifecycle']} has unknown labels: {sorted(unknown)!r}")
        if stage["future_state"] != "faber-owned":
            fail(failures, f"{stage['lifecycle']} future state must be faber-owned")
        if not stage["inputs"]:
            fail(failures, f"{stage['lifecycle']} must name input artifacts")
        if not stage["outputs"]:
            fail(failures, f"{stage['lifecycle']} must name output artifacts")
        expected_next = EXPECTED_ORDER[index + 1] if index + 1 < len(EXPECTED_ORDER) else ""
        if stage["next"] != expected_next:
            fail(failures, f"{stage['lifecycle']} next must be {expected_next!r}")
        ownership = stage["ownership"].lower()
        if "pytorch" in ownership or "release" in ownership:
            fail(failures, f"{stage['lifecycle']} ownership text must avoid product/PyTorch claims")

    if seen_labels != REQUIRED_LABELS:
        fail(failures, f"seen labels {sorted(seen_labels)!r} != {sorted(REQUIRED_LABELS)!r}")
    if "session-lifecycle.toml" not in readme:
        fail(failures, "README must point at session-lifecycle.toml")

    if failures:
        for failure in failures:
            print(f"FAIL {failure}", file=sys.stderr)
        return 1
    print("ok: session lifecycle contract")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
