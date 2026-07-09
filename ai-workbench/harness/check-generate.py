#!/usr/bin/env python3
from __future__ import annotations

import json
import pathlib
import subprocess
import sys
import tomllib


def workspace_root() -> pathlib.Path:
    return pathlib.Path(__file__).resolve().parents[3]


def load_events(path: pathlib.Path) -> list[dict[str, object]]:
    events: list[dict[str, object]] = []
    for line in path.read_text().splitlines():
        if line.strip():
            events.append(json.loads(line))
    return events


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
