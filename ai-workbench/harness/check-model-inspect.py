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
    aliases_path = root / "docs/campaigns/ai-workbench/model-aliases.toml"
    package = root / "examples/ai-workbench/packages/faber-ai"
    faber_manifest = root / "faber/Cargo.toml"

    if not aliases_path.exists():
        print(
            "FAIL campaign alias map missing: "
            f"{aliases_path}. Run this harness from the faberlang workspace; "
            "standalone examples checkouts do not contain campaign docs.",
            file=sys.stderr,
        )
        return 2

    cases = tomllib.loads(cases_path.read_text())["case"]
    aliases = {
        item["alias"]: item
        for item in tomllib.loads(aliases_path.read_text())["tiers"]
    }
    failures: list[str] = []
    for case in cases:
        absent_path = case.get("absent_path")
        if absent_path:
            pathlib.Path(absent_path).unlink(missing_ok=True)

        directory_path = case.get("directory_path")
        if directory_path:
            path = pathlib.Path(directory_path)
            if path.exists() and not path.is_dir():
                path.unlink()
            path.mkdir(parents=True, exist_ok=True)

        unreadable_path = case.get("unreadable_path")
        if unreadable_path:
            path = pathlib.Path(unreadable_path)
            path.write_text("[[tiers]]\n")
            path.chmod(0)

        command = [
            "cargo",
            "run",
            "--manifest-path",
            str(faber_manifest),
            "--",
            "run",
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
        if unreadable_path:
            path = pathlib.Path(unreadable_path)
            try:
                path.chmod(0o600)
                path.unlink()
            except FileNotFoundError:
                pass
        if directory_path:
            try:
                pathlib.Path(directory_path).rmdir()
            except OSError:
                pass
        combined = result.stdout + result.stderr
        expected_exit = int(case["exit"])
        if result.returncode != expected_exit:
            failures.append(
                f"{case['id']}: exit {result.returncode}, expected {expected_exit}"
            )
        for needle in case.get("stdout_contains", []):
            if needle not in result.stdout:
                failures.append(f"{case['id']}: stdout missing {needle!r}")
        if (
            case.get("compare_campaign", True)
            and "--format" in case["args"]
            and "json" in case["args"]
        ):
            target = case["args"][2]
            expected = aliases.get(target)
            if expected is None:
                failures.append(f"{case['id']}: no campaign alias for {target!r}")
            else:
                try:
                    actual = json.loads(result.stdout)
                except json.JSONDecodeError as exc:
                    failures.append(f"{case['id']}: invalid json: {exc}")
                else:
                    for key in ("source", "status", "router_model_id"):
                        if actual.get(key) != expected[key]:
                            failures.append(
                                f"{case['id']}: {key}={actual.get(key)!r}, "
                                f"expected {expected[key]!r}"
                            )
                    if actual.get("local_path") != "":
                        failures.append(
                            f"{case['id']}: local_path={actual.get('local_path')!r}, "
                            "expected portable redaction ''"
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
