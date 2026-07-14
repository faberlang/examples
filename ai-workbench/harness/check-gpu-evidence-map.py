#!/usr/bin/env python3
from __future__ import annotations

import json
import pathlib
import sys
import tomllib


FORBIDDEN_TRUE_CLAIMS = [
    "faber_owned_inference",
    "llama_cpp_equivalence",
    "gguf_runtime",
    "transformer_runtime",
    "quantized_kernel_support",
    "gpu_runtime",
    "device_logits_execution",
    "device_softmax_execution",
    "device_training",
    "implicit_model_downloads",
    "model_blobs_in_git",
]

EXPECTED_RUNG_ARTIFACTS = {
    "matmul-shape-precedent": ("examples/gpu-workload/rung-0-matmul.ref.json", 0),
    "softmax-reduction-precedent": ("examples/gpu-workload/rung-1-softmax.ref.json", 1),
    "mlp-forward-precedent": ("examples/gpu-workload/rung-2-mlp-forward.ref.json", 2),
    "autograd-training-boundary": ("examples/gpu-workload/rung-3-linear-backward.ref.json", 3),
    "session-launch-boundary": ("examples/gpu-workload/rung-4-toy-train.ref.json", 4),
}


def workspace_root() -> pathlib.Path:
    return pathlib.Path(__file__).resolve().parents[3]


def fail(failures: list[str], message: str) -> None:
    failures.append(message)


def require_path(root: pathlib.Path, failures: list[str], relative: str) -> pathlib.Path:
    path = root / relative
    if not path.exists():
        fail(failures, f"missing referenced path: {relative}")
    return path


def main() -> int:
    root = workspace_root()
    map_path = root / "examples/ai-workbench/gpu-evidence-map.toml"
    inference_path = root / "examples/ai-workbench/inference-fixture-map.toml"
    readme_path = root / "examples/ai-workbench/README.md"
    gpu_readme_path = root / "examples/gpu-workload/README.md"
    evidence = tomllib.loads(map_path.read_text(encoding="utf-8"))
    inference = tomllib.loads(inference_path.read_text(encoding="utf-8"))
    readme = readme_path.read_text(encoding="utf-8")
    gpu_readme = gpu_readme_path.read_text(encoding="utf-8")
    failures: list[str] = []

    contract = evidence["gpu_evidence_map"]
    if contract["status"] != "evidence-map":
        fail(failures, "GPU evidence bridge must stay an evidence map")
    if contract["scope"] != "CPU oracle to systems-lane evidence only":
        fail(failures, "GPU evidence bridge scope must stay CPU-oracle-only")
    if "blocked" not in contract["blocked_state"].lower():
        fail(failures, "blocked GPU execution state must remain explicit")
    for key in ("cpu_oracle", "cpu_oracle_checker", "inference_fixture_map", "gpu_workload_readme"):
        require_path(root, failures, contract[key])

    if inference["inference_fixture_map"]["selected_next_fixture"] != "tiny-token-logits-oracle":
        fail(failures, "inference fixture map must still select tiny-token-logits-oracle")
    if "gpu-evidence-map.toml" not in readme:
        fail(failures, "AI workbench README must link gpu-evidence-map.toml")
    if "gpu-evidence-map.toml" not in gpu_readme:
        fail(failures, "GPU workload README must link gpu-evidence-map.toml")

    for key in FORBIDDEN_TRUE_CLAIMS:
        if evidence["guarded_claims"].get(key) is not False:
            fail(failures, f"guarded claim {key} must remain false")

    bridge_steps = {step["id"]: step for step in evidence.get("bridge_step", [])}
    for step_id in ("cpu-tokenization", "cpu-logits-vector", *EXPECTED_RUNG_ARTIFACTS.keys()):
        if step_id not in bridge_steps:
            fail(failures, f"missing bridge step {step_id}")

    for step in bridge_steps.values():
        path = require_path(root, failures, step["artifact"])
        if not step.get("blocked_by"):
            fail(failures, f"{step['id']} must record a blocker/non-claim boundary")
        if step["id"] in EXPECTED_RUNG_ARTIFACTS and path.exists():
            expected_path, expected_rung = EXPECTED_RUNG_ARTIFACTS[step["id"]]
            if step["artifact"] != expected_path:
                fail(failures, f"{step['id']} must point at {expected_path}")
            payload = json.loads(path.read_text(encoding="utf-8"))
            if int(payload.get("rung", -1)) != expected_rung:
                fail(failures, f"{step['id']} expected rung {expected_rung}")

    follow_ups = evidence.get("follow_up_want", [])
    if len(follow_ups) < 3:
        fail(failures, "GPU evidence bridge must record at least three follow-up wants")

    if failures:
        for failure in failures:
            print(f"FAIL {failure}", file=sys.stderr)
        return 1
    print("ok: CPU logits to GPU evidence map")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
