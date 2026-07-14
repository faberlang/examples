#!/usr/bin/env python3
from __future__ import annotations

import pathlib
import sys
import tomllib

from claim_gates import FORBIDDEN_INFERENCE_CLAIMS, false_claim_failures

FORBIDDEN_TRUE_CLAIMS = FORBIDDEN_INFERENCE_CLAIMS


def workspace_root() -> pathlib.Path:
    return pathlib.Path(__file__).resolve().parents[3]


def fail(failures: list[str], message: str) -> None:
    failures.append(message)


def require_path(root: pathlib.Path, failures: list[str], relative: str) -> None:
    path = root / relative
    if not path.exists():
        fail(failures, f"missing referenced path: {relative}")


def main() -> int:
    root = workspace_root()
    map_path = root / "examples/ai-workbench/inference-fixture-map.toml"
    readme_path = root / "examples/ai-workbench/README.md"
    fixture_map = tomllib.loads(map_path.read_text())
    readme = readme_path.read_text()
    failures: list[str] = []

    contract = fixture_map["inference_fixture_map"]
    if contract["status"] != "fixture-map":
        fail(failures, "inference fixture map must stay a map, not a capability claim")
    if contract["scope"] != "examples-owned evidence packet only":
        fail(failures, "scope must stay examples-owned")
    if contract["selected_next_fixture"] != "tiny-token-logits-oracle":
        fail(failures, "selected next fixture must stay tiny-token-logits-oracle")
    if "blocked" not in contract["current_blocked_surface"].lower():
        fail(failures, "current blocked surface must remain explicit")

    for key in (
        "model_artifact_floor",
        "inference_artifact_admission",
        "session_lifecycle",
        "gpu_workload_contract",
        "gpu_evidence_map",
        "generate_oracle_fixture",
        "generate_cases",
        "token_logits_oracle_fixture",
        "token_logits_expected_sidecar",
        "token_logits_checker",
        "artifact_admission_checker",
    ):
        require_path(root, failures, contract[key])

    for issue in false_claim_failures(fixture_map["guarded_claims"], label="guarded", require_all=True):
        fail(failures, issue)

    evidence = fixture_map.get("evidence", [])
    evidence_ids = {item["id"] for item in evidence}
    for required in {
        "metadata-tokenizer-floor",
        "inference-artifact-admission",
        "oracle-backed-generate",
        "tiny-token-logits-oracle",
        "router-backed-chat",
        "gpu-rung4-session-map",
    }:
        if required not in evidence_ids:
            fail(failures, f"missing evidence item {required}")
    for item in evidence:
        require_path(root, failures, item["artifact"])
        if not item.get("blocker"):
            fail(failures, f"{item['id']} must record a blocker/non-claim boundary")

    candidates = {item["id"]: item for item in fixture_map.get("candidate", [])}
    selected = candidates.get(contract["selected_next_fixture"])
    if selected is None:
        fail(failures, "selected next fixture must be present in candidate list")
    else:
        if selected["status"] != "implemented" or selected["runnable_now"] is not True:
            fail(failures, "tiny token/logits oracle must be marked as implemented and runnable")
        if "Python harness/oracle fixture" not in selected["implementation_boundary"]:
            fail(failures, "selected fixture boundary must stay examples-local")
        for relative in selected["inputs"]:
            require_path(root, failures, relative)
        require_path(root, failures, contract["token_logits_expected_sidecar"])
        required_outputs = {"prefill token ids", "one deterministic logits vector over the tiny vocab", "selected next token"}
        if not required_outputs.issubset(set(selected["outputs"])):
            fail(failures, "selected fixture must define token ids, logits, and next-token outputs")
        if "expected JSONL sidecar" not in selected["outputs"]:
            fail(failures, "selected fixture must define the expected JSONL sidecar")
        if "checker compares generated JSONL against expected sidecar" not in selected["done_when"]:
            fail(failures, "selected fixture must require sidecar comparison")

    blocked = candidates.get("faber-owned-tiny-forward")
    if blocked is None:
        fail(failures, "blocked Faber-owned tiny forward candidate must stay visible")
    elif blocked["runnable_now"] is not False or blocked["status"] != "blocked":
        fail(failures, "Faber-owned tiny forward candidate must remain blocked")

    follow_ups = fixture_map.get("follow_up_want", [])
    if len(follow_ups) < 3:
        fail(failures, "map must name at least three candidate follow-up wants")
    if "inference-fixture-map.toml" not in readme:
        fail(failures, "README must point at inference-fixture-map.toml")

    if failures:
        for failure in failures:
            print(f"FAIL {failure}", file=sys.stderr)
        return 1
    print("ok: inference fixture map")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
