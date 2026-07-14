#!/usr/bin/env python3
from __future__ import annotations

import pathlib
import sys
import tomllib


EXPECTED_FIELDS = ["alias", "source", "status", "local_path", "router_model_id"]
EXPECTED_SURFACES = {"model inspect", "embed", "index", "query", "generate", "chat"}


def workspace_root() -> pathlib.Path:
    return pathlib.Path(__file__).resolve().parents[3]


def fail(failures: list[str], message: str) -> None:
    failures.append(message)


def main() -> int:
    root = workspace_root()
    handoff = tomllib.loads((root / "examples/ai-workbench/reuse-handoff.toml").read_text())
    package_reuse = tomllib.loads((root / "examples/ai-workbench/package-reuse.toml").read_text())
    failures: list[str] = []

    if handoff["handoff"]["stage"] != "8C":
        fail(failures, "handoff stage must be 8C")
    if handoff["alias_fields"]["required"] != EXPECTED_FIELDS:
        fail(failures, f"alias fields must stay {EXPECTED_FIELDS!r}")
    if handoff["alias_fields"]["campaign_fixture"] != package_reuse["alias_contract"]["campaign_fixture"]:
        fail(failures, "campaign fixture must match package-reuse alias contract")
    if handoff["alias_fields"]["workspace_campaign_fixture"] != package_reuse["alias_contract"]["workspace_campaign_fixture"]:
        fail(failures, "workspace campaign fixture must match package-reuse alias contract")
    if handoff["alias_fields"]["live_inventory_root"] != package_reuse["alias_contract"]["live_inventory_root"]:
        fail(failures, "live inventory root must match package-reuse alias contract")
    if handoff["alias_fields"]["host_path_redaction"] is not True:
        fail(failures, "handoff must preserve host path redaction")

    boundaries = handoff["reuse_boundaries"]
    for key in ("gpu_claims", "owned_inference_claims", "model_blobs_in_git"):
        if boundaries[key] is not False:
            fail(failures, f"reuse boundary {key} must be false")
    for forbidden in ("CUDA backend", "Faber-owned transformer inference", "PyTorch replacement binary"):
        if forbidden not in boundaries["faber_ai_does_not_own"]:
            fail(failures, f"missing explicit non-ownership boundary: {forbidden}")

    artifact_surfaces = {artifact["surface"] for artifact in handoff["artifacts"]}
    package_surfaces = {command["surface"] for command in package_reuse["commands"]}
    if artifact_surfaces != EXPECTED_SURFACES:
        fail(failures, f"handoff surfaces {sorted(artifact_surfaces)!r} != {sorted(EXPECTED_SURFACES)!r}")
    if artifact_surfaces != package_surfaces:
        fail(failures, "handoff surfaces must match package-reuse command surfaces")
    for artifact in handoff["artifacts"]:
        if artifact["native_runtime_claim"] is not False:
            fail(failures, f"{artifact['surface']} must not claim native runtime ownership")
        if artifact["surface"] in {"model inspect", "embed", "index", "query"}:
            if artifact["systems_reuse"] is not True:
                fail(failures, f"{artifact['surface']} should remain systems-reusable")

    validation = handoff["validation"]
    if validation["tour_harness"] != "examples/ai-workbench/harness/check-campaign-tour.py":
        fail(failures, "handoff must point at the campaign tour harness")
    if validation["lifecycle_harness"] != "examples/ai-workbench/harness/check-session-lifecycle.py":
        fail(failures, "handoff must point at the session lifecycle harness")
    if validation["hermetic"] is not True or validation["live_model_loads"] is not False:
        fail(failures, "campaign tour must stay hermetic and avoid live model loads")
    if validation["allow_blocked_oracle_labels"] is not True:
        fail(failures, "tour must allow honest blocked/oracle-backed labels")

    if failures:
        for failure in failures:
            print(f"FAIL {failure}", file=sys.stderr)
        return 1
    print("ok: reuse handoff")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
