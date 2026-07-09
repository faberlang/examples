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


def main() -> int:
    root = workspace_root()
    contract_path = root / "examples/ai-workbench/package-reuse.toml"
    contract = tomllib.loads(contract_path.read_text())
    package = contract["package"]
    install_path = contract["product_install_path"]
    failures: list[str] = []

    if install_path["current"] != "package-invoked":
        fail(failures, "Stage 8B current product path must be package-invoked")
    if "cista run" not in install_path["future_installed_bin"]:
        fail(failures, "future installed-bin note must defer to Cista bin/cista run")

    try:
        live_result, live = run_smoke(root, package["invocation"], install_path["operator_smoke"])
    except Exception as exc:
        fail(failures, f"operator smoke failed before JSON validation: {exc}")
    else:
        if live_result.returncode != 0:
            fail(failures, f"operator smoke exit {live_result.returncode}, expected 0")
            sys.stderr.write(tail(live_result.stderr) + "\n")
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

    try:
        missing_result, missing = run_smoke(root, package["invocation"], install_path["missing_inventory_smoke"])
    except Exception as exc:
        fail(failures, f"missing-inventory smoke failed before JSON validation: {exc}")
    else:
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

    if failures:
        for failure in failures:
            print(f"FAIL {failure}", file=sys.stderr)
        return 1
    print("ok: product install path")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
