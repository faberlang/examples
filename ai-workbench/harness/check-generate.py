#!/usr/bin/env python3
from __future__ import annotations

import json
import pathlib
import subprocess
import sys
import tomllib
from typing import Any

from artifact_metadata_claims import metadata_claim_failures


def workspace_root() -> pathlib.Path:
    return pathlib.Path(__file__).resolve().parents[3]


def load_events(path: pathlib.Path) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    for line in path.read_text().splitlines():
        if line.strip():
            events.append(json.loads(line))
    return events


def stdout_json(stdout: str) -> dict[str, object]:
    for line in reversed(stdout.splitlines()):
        line = line.strip()
        if line.startswith("{") and line.endswith("}"):
            return json.loads(line)
    raise json.JSONDecodeError("no JSON object in stdout", stdout, 0)


def main() -> int:
    root = workspace_root()
    cases_path = root / "examples/ai-workbench/harness/fixtures/generate/cases.toml"
    package = root / "examples/ai-workbench/packages/faber-ai"
    faber_manifest = root / "faber/Cargo.toml"
    cases = tomllib.loads(cases_path.read_text())["case"]
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

        out_path = pathlib.Path(case["out_path"])
        out_path.unlink(missing_ok=True)
        if case.get("preexisting_output", False):
            out_path.write_text('{"event":"stale","text":"old"}\n')

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
        if directory_path:
            try:
                pathlib.Path(directory_path).rmdir()
            except OSError:
                pass

        combined = result.stdout + result.stderr
        if result.returncode != int(case["exit"]):
            failures.append(
                f"{case['id']}: exit {result.returncode}, expected {case['exit']}"
            )
        for needle in case.get("stdout_contains", []):
            if needle not in result.stdout:
                failures.append(f"{case['id']}: stdout missing {needle!r}")
        if "stdout_json_equals" in case:
            try:
                summary = stdout_json(result.stdout)
            except json.JSONDecodeError as exc:
                failures.append(f"{case['id']}: invalid stdout json: {exc}")
            else:
                for key, expected in case["stdout_json_equals"].items():
                    if summary.get(key) != expected:
                        failures.append(
                            f"{case['id']}: stdout {key}={summary.get(key)!r}, "
                            f"expected {expected!r}"
                        )

        if case.get("expect_output_file", False):
            if not out_path.exists():
                failures.append(f"{case['id']}: missing output file {out_path}")
            else:
                text = out_path.read_text()
                for needle in case.get("artifact_contains", []):
                    if needle not in text:
                        failures.append(f"{case['id']}: artifact missing {needle!r}")
                try:
                    events = load_events(out_path)
                except json.JSONDecodeError as exc:
                    failures.append(f"{case['id']}: invalid event json: {exc}")
                else:
                    expected_events = case.get("artifact_events", [])
                    actual_events = [event.get("event") for event in events]
                    if actual_events != expected_events:
                        failures.append(
                            f"{case['id']}: events={actual_events!r}, expected {expected_events!r}"
                        )
                    claim_failures = metadata_claim_failures(events, label=case["id"])
                    if case.get("expect_metadata_claim_failure", False):
                        if not claim_failures:
                            failures.append(f"{case['id']}: expected metadata claim gate failure")
                    else:
                        failures.extend(f"{case['id']}: {issue}" for issue in claim_failures)
        elif out_path.exists():
            failures.append(f"{case['id']}: unexpected output file {out_path}")
        out_path.unlink(missing_ok=True)

        if failures:
            sys.stderr.write(combined)

    if failures:
        for failure in failures:
            print(f"FAIL {failure}", file=sys.stderr)
        return 1
    print(f"ok: {len(cases)} generate cases")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
