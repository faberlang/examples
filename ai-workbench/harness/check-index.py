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
    cases_path = root / "examples/ai-workbench/harness/fixtures/index/cases.toml"
    package = root / "examples/ai-workbench/packages/faber-ai"
    faber_manifest = root / "faber/Cargo.toml"
    cases = tomllib.loads(cases_path.read_text())["case"]
    failures: list[str] = []

    for case in cases:
        out_path = pathlib.Path(case["out_path"])
        out_path.unlink(missing_ok=True)
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
                try:
                    artifact = json.loads(out_path.read_text())
                except json.JSONDecodeError as exc:
                    failures.append(f"{case['id']}: invalid artifact json: {exc}")
                else:
                    for key, expected in case.get("artifact_equals", {}).items():
                        if artifact.get(key) != expected:
                            failures.append(
                                f"{case['id']}: artifact {key}={artifact.get(key)!r}, "
                                f"expected {expected!r}"
                            )
                    expected_vectors = case.get("artifact_vector_count")
                    if expected_vectors is not None:
                        vectors = artifact.get("vectors")
                        if not isinstance(vectors, list):
                            failures.append(f"{case['id']}: artifact vectors not a list")
                        elif len(vectors) != int(expected_vectors):
                            failures.append(
                                f"{case['id']}: artifact vector count={len(vectors)}, "
                                f"expected {expected_vectors}"
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
    print(f"ok: {len(cases)} index cases")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
