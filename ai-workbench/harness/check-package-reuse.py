#!/usr/bin/env python3
from __future__ import annotations

import pathlib
import re
import sys
import tomllib


EXPECTED_ALIASES = {
    "basic/minilm": "local",
    "mid/qwen3-embed-0.6b": "local",
    "stretch/qwen3-4b-fp8": "local",
    "daily/qwen36-35b-a3b-q4": "router-backed",
}
EXPECTED_COMMANDS = {"model inspect", "embed", "index", "query", "generate", "chat"}
ALLOWED_MODEL_FIXTURES = {
    pathlib.Path("ai-workbench/harness/fixtures/model-inspect/files/tiny.gguf"),
    pathlib.Path("ai-workbench/harness/fixtures/model-inspect/files/tiny.safetensors"),
}


def workspace_root() -> pathlib.Path:
    return pathlib.Path(__file__).resolve().parents[3]


def fail(failures: list[str], message: str) -> None:
    failures.append(message)


def main() -> int:
    root = workspace_root()
    examples = root / "examples"
    contract_path = root / "examples/ai-workbench/package-reuse.toml"
    manifest_path = root / "examples/ai-workbench/packages/faber-ai/faber.toml"
    main_path = root / "examples/ai-workbench/packages/faber-ai/src/main.fab"
    aliases_path = root / "docs/campaigns/ai-workbench/model-aliases.toml"
    failures: list[str] = []

    contract = tomllib.loads(contract_path.read_text())
    manifest = tomllib.loads(manifest_path.read_text())
    aliases = tomllib.loads(aliases_path.read_text())["tiers"]
    main_text = main_path.read_text()

    if manifest["package"]["name"] != contract["package"]["name"]:
        fail(failures, "package name mismatch between faber.toml and package-reuse.toml")
    if manifest["paths"]["source"] != contract["package"]["source"]:
        fail(failures, "package source mismatch between faber.toml and package-reuse.toml")
    if manifest["paths"]["entry"] != contract["package"]["entry"]:
        fail(failures, "package entry mismatch between faber.toml and package-reuse.toml")
    if contract["alias_contract"]["decision"] != "hybrid":
        fail(failures, "alias contract must preserve the hybrid source-of-truth decision")
    if contract["alias_contract"]["host_path_redaction"] is not True:
        fail(failures, "host path redaction must stay enabled for hermetic tests")

    boundaries = contract["boundaries"]
    for key in ("duplicate_model_downloads", "model_blobs_in_git", "gpu_claims", "owned_inference_claims", "pytorch_replacement_binary"):
        if boundaries[key] is not False:
            fail(failures, f"boundary {key} must be false")
    for key in ("product_cli_install", "future_systems_reuse"):
        if boundaries[key] is not True:
            fail(failures, f"boundary {key} must be true")

    command_surfaces = {command["surface"] for command in contract["commands"]}
    if command_surfaces != EXPECTED_COMMANDS:
        fail(failures, f"command surfaces {sorted(command_surfaces)!r} != {sorted(EXPECTED_COMMANDS)!r}")
    for surface in ("embed", "index", "query", "generate", "chat"):
        if f'@ imperium "{surface}"' not in main_text:
            fail(failures, f"missing CLI command surface in main.fab: {surface}")
    if '@ imperia "model"' not in main_text:
        fail(failures, "missing model command group in main.fab")

    seen_aliases = {item["alias"]: item for item in aliases}
    for alias, status in EXPECTED_ALIASES.items():
        item = seen_aliases.get(alias)
        if item is None:
            fail(failures, f"campaign alias missing: {alias}")
            continue
        if item["status"] != status:
            fail(failures, f"{alias} status {item['status']!r} != {status!r}")
        local_path = item.get("local_path", "")
        if local_path and not local_path.startswith("/Users/ianzepp/ai/models/"):
            fail(failures, f"{alias} local_path outside durable inventory: {local_path}")
        if status == "router-backed" and not item.get("router_model_id"):
            fail(failures, f"{alias} router-backed alias missing router_model_id")

    model_blobs = []
    for path in examples.rglob("*"):
        if path.is_file() and path.suffix.lower() in {".gguf", ".safetensors"}:
            relative = path.relative_to(examples)
            if relative not in ALLOWED_MODEL_FIXTURES:
                model_blobs.append(str(relative))
    if model_blobs:
        fail(failures, f"unexpected model blobs in examples repo: {model_blobs}")

    readme = (root / "examples/ai-workbench/README.md").read_text()
    if not re.search(r"package-reuse\.toml", readme):
        fail(failures, "README must point operators at package-reuse.toml")

    if failures:
        for failure in failures:
            print(f"FAIL {failure}", file=sys.stderr)
        return 1
    print("ok: package reuse contract")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
