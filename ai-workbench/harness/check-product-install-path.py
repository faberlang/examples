#!/usr/bin/env python3
from __future__ import annotations

import json
import pathlib
import shlex
import subprocess
import sys
import tomllib


def workspace_root() -> pathlib.Path:
    return pathlib.Path(__file__).resolve().parents[3]


def fail(failures: list[str], message: str) -> None:
    failures.append(message)


def tail(text: str, lines: int = 20) -> str:
    return "\n".join(text.splitlines()[-lines:])


def run_smoke(root: pathlib.Path, invocation: str, smoke: str) -> tuple[subprocess.CompletedProcess[str], dict]:
    command = shlex.split(invocation) + shlex.split(smoke)
    result = subprocess.run(
        command,
        cwd=root,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=120,
    )
    payload = json.loads(result.stdout)
    return result, payload


def check_contract_links(failures: list[str], contract: dict, gaps: dict) -> None:
    alias_contract = contract["alias_contract"]
    install_path = contract["product_install_path"]
    if gaps["operator_smoke"] != install_path["operator_smoke"]:
        fail(failures, "local inventory gap map operator smoke must match package reuse contract")
    if gaps["missing_inventory_smoke"] != install_path["missing_inventory_smoke"]:
        fail(failures, "local inventory gap map missing-inventory smoke must match package reuse contract")
    if gaps["campaign_fixture"] != alias_contract["campaign_fixture"]:
        fail(failures, "local inventory gap map campaign fixture must match package reuse contract")
    if gaps["live_inventory_root"] != alias_contract["live_inventory_root"]:
        fail(failures, "local inventory gap map live inventory root must match package reuse contract")


def check_missing_inventory_smoke(
    root: pathlib.Path,
    invocation: str,
    smoke: str,
    failures: list[str],
) -> None:
    try:
        missing_result, missing = run_smoke(root, invocation, smoke)
    except Exception as exc:
        fail(failures, f"missing-inventory smoke failed before JSON validation: {exc}")
        return

    if missing_result.returncode != 0:
        fail(failures, f"missing-inventory smoke exit {missing_result.returncode}, expected 0")
        sys.stderr.write(tail(missing_result.stderr) + "\n")
    expected = {
        "alias": "basic/minilm",
        "status": "missing-download",
        "format": "alias-missing",
        "local_path": "",
        "tensor_count": 0,
    }
    for key, value in expected.items():
        if missing.get(key) != value:
            fail(
                failures,
                f"missing-inventory smoke {key}={missing.get(key)!r}, expected {value!r}",
            )
    diagnostics = missing.get("diagnostics", [])
    if not diagnostics or "missing local download" not in diagnostics[0]:
        fail(failures, "missing-inventory smoke must fail closed with a download diagnostic")


def reports_missing_local_inventory(payload: dict, live_inventory_root: pathlib.Path) -> bool:
    diagnostics = payload.get("diagnostics", [])
    return (
        not live_inventory_root.exists()
        or payload.get("status") == "missing-download"
        or any("missing local download" in diagnostic for diagnostic in diagnostics)
    )


def main() -> int:
    root = workspace_root()
    contract_path = root / "examples/ai-workbench/package-reuse.toml"
    gaps_path = root / "examples/ai-workbench/local-inventory-gaps.toml"
    contract = tomllib.loads(contract_path.read_text())
    gaps = tomllib.loads(gaps_path.read_text())["local_inventory_gaps"]
    package = contract["package"]
    alias_contract = contract["alias_contract"]
    install_path = contract["product_install_path"]
    failures: list[str] = []
    blocked: list[str] = []

    if install_path["current"] != "package-invoked":
        fail(failures, "Stage 8B current product path must be package-invoked")
    if "cista run" not in install_path["future_installed_bin"]:
        fail(failures, "future installed-bin note must defer to Cista bin/cista run")

    check_contract_links(failures, contract, gaps)

    campaign_fixture = root / alias_contract["campaign_fixture"]
    live_inventory_root = pathlib.Path(alias_contract["live_inventory_root"])
    if not campaign_fixture.exists():
        blocked.append(
            "product-install-campaign-alias-map: operator smoke blocked: missing campaign fixture "
            f"{alias_contract['campaign_fixture']} "
            "(see examples/ai-workbench/local-inventory-gaps.toml)"
        )
    else:
        try:
            live_result, live = run_smoke(root, package["invocation"], install_path["operator_smoke"])
        except Exception as exc:
            fail(failures, f"operator smoke failed before JSON validation: {exc}")
        else:
            if live_result.returncode != 0:
                fail(failures, f"operator smoke exit {live_result.returncode}, expected 0")
                sys.stderr.write(tail(live_result.stderr) + "\n")
            elif (
                live.get("alias") == "basic/minilm"
                and (
                    live.get("status") != "local"
                    or live.get("format") != "safetensors"
                    or live.get("tensor_count", 0) <= 0
                )
                and reports_missing_local_inventory(live, live_inventory_root)
            ):
                blocked.append(
                    "operator-minilm-local-metadata: operator smoke blocked: live MiniLM safetensors metadata unavailable under "
                    f"{alias_contract['live_inventory_root']} "
                    "(see examples/ai-workbench/local-inventory-gaps.toml)"
                )
            elif not blocked:
                expected = {
                    "alias": "basic/minilm",
                    "status": "local",
                    "format": "safetensors",
                    "local_path": "",
                }
                for key, value in expected.items():
                    if live.get(key) != value:
                        fail(failures, f"operator smoke {key}={live.get(key)!r}, expected {value!r}")
                if live.get("tensor_count", 0) <= 0:
                    fail(failures, "operator smoke should inspect local MiniLM tensor metadata")

    check_missing_inventory_smoke(
        root,
        package["invocation"],
        install_path["missing_inventory_smoke"],
        failures,
    )

    if failures:
        for failure in failures:
            print(f"FAIL {failure}", file=sys.stderr)
        return 1
    if blocked:
        for item in blocked:
            print(f"BLOCK {item}", file=sys.stderr)
        return 2
    print("ok: product install path")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
