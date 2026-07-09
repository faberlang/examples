#!/usr/bin/env python3
from __future__ import annotations

import json
import pathlib
import subprocess
import sys
import tomllib


def workspace_root() -> pathlib.Path:
    return pathlib.Path(__file__).resolve().parents[3]


def main() -> int:
    root = workspace_root()
    cases_path = root / "examples/ai-workbench/harness/fixtures/model-inspect/cases.toml"
    aliases_path = (
        root / "examples/ai-workbench/harness/fixtures/model-inspect/model-aliases.toml"
    )
    package = root / "examples/ai-workbench/packages/faber-ai"
    faber_manifest = root / "faber/Cargo.toml"

    cases = tomllib.loads(cases_path.read_text())["case"]
    aliases = {
        item["alias"]: item
        for item in tomllib.loads(aliases_path.read_text()).get("tiers", [])
    }
    failures: list[str] = []
    for case in cases:
        command = [
            "cargo",
            "run",
            "--manifest-path",
            str(faber_manifest),
            "--",
            "run",
            "--interpret",
            str(package),
            "--",
            *case["args"],
        ]
        result = subprocess.run(
            command,
            cwd=root,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=120,
        )
        combined = result.stdout + result.stderr
        expected_exit = int(case["exit"])
        if result.returncode != expected_exit:
            failures.append(
                f"{case['id']}: exit {result.returncode}, expected {expected_exit}"
            )
        for needle in case.get("stdout_contains", []):
            if needle not in result.stdout:
                failures.append(f"{case['id']}: stdout missing {needle!r}")
        if "--format" in case["args"] and "json" in case["args"]:
            target = case["args"][2]
            expected = aliases.get(target)
            if expected is None:
                failures.append(f"{case['id']}: no alias fixture for {target!r}")
            else:
                try:
                    actual = json.loads(result.stdout)
                except json.JSONDecodeError as exc:
                    failures.append(f"{case['id']}: invalid json: {exc}")
                else:
                    for key in (
                        "source",
                        "status",
                        "format",
                        "local_path",
                        "router_model_id",
                    ):
                        if actual.get(key) != expected[key]:
                            failures.append(
                                f"{case['id']}: {key}={actual.get(key)!r}, "
                                f"expected {expected[key]!r}"
                            )
        if failures:
            sys.stderr.write(combined)

    if failures:
        for failure in failures:
            print(f"FAIL {failure}", file=sys.stderr)
        return 1
    print(f"ok: {len(cases)} model-inspect cases")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
