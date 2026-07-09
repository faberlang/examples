#!/usr/bin/env python3
from __future__ import annotations

import json
import pathlib
import subprocess
import sys
import tomllib


def workspace_root() -> pathlib.Path:
    return pathlib.Path(__file__).resolve().parents[3]


def run_command(root: pathlib.Path, command: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        cwd=root,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=120,
    )


def build_index(root: pathlib.Path, package: pathlib.Path, manifest: pathlib.Path, index_path: pathlib.Path) -> str:
    index_path.unlink(missing_ok=True)
    command = [
        "cargo",
        "run",
        "--manifest-path",
        str(manifest),
        "--",
        "run",
        str(package),
        "--",
        "index",
        "examples/ai-workbench/harness/fixtures/index/vectors.fvi",
        "--out",
        str(index_path),
        "--format",
        "json",
    ]
    result = run_command(root, command)
    if result.returncode != 0 or not index_path.exists():
        raise RuntimeError(result.stdout + result.stderr)
    return result.stdout + result.stderr


def main() -> int:
    root = workspace_root()
    cases_path = root / "examples/ai-workbench/harness/fixtures/query/cases.toml"
    package = root / "examples/ai-workbench/packages/faber-ai"
    faber_manifest = root / "faber/Cargo.toml"
    cases = tomllib.loads(cases_path.read_text())["case"]
    failures: list[str] = []

    for case in cases:
        built_index: pathlib.Path | None = None
        combined_setup = ""
        try:
            if case.get("build_index", False):
                built_index = pathlib.Path(case["index_path"])
                combined_setup = build_index(root, package, faber_manifest, built_index)
        except RuntimeError as exc:
            failures.append(f"{case['id']}: failed to build index fixture")
            sys.stderr.write(str(exc))
            continue

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
        result = run_command(root, command)
        combined = combined_setup + result.stdout + result.stderr
        if result.returncode != int(case["exit"]):
            failures.append(
                f"{case['id']}: exit {result.returncode}, expected {case['exit']}"
            )
        for needle in case.get("stdout_contains", []):
            if needle not in result.stdout:
                failures.append(f"{case['id']}: stdout missing {needle!r}")
        expected_results = case.get("expected_results")
        if expected_results is not None:
            try:
                actual = json.loads(result.stdout)
            except json.JSONDecodeError as exc:
                failures.append(f"{case['id']}: invalid json stdout: {exc}")
            else:
                expected_query = case.get("expected_query")
                if expected_query is not None and actual.get("query") != expected_query:
                    failures.append(
                        f"{case['id']}: query={actual.get('query')!r}, "
                        f"expected {expected_query!r}"
                    )
                results = actual.get("results")
                if not isinstance(results, list):
                    failures.append(f"{case['id']}: results is not a list")
                elif len(results) != len(expected_results):
                    failures.append(
                        f"{case['id']}: result count={len(results)}, "
                        f"expected {len(expected_results)}"
                    )
                else:
                    for index, expected in enumerate(expected_results):
                        actual_result = results[index]
                        if actual_result.get("rank") != index + 1:
                            failures.append(
                                f"{case['id']}: result {index} rank="
                                f"{actual_result.get('rank')!r}, expected {index + 1}"
                            )
                        if actual_result.get("id") != expected["id"]:
                            failures.append(
                                f"{case['id']}: result {index} id="
                                f"{actual_result.get('id')!r}, expected {expected['id']!r}"
                            )
                        score = actual_result.get("score")
                        if score is None or abs(float(score) - float(expected["score"])) > 1e-9:
                            failures.append(
                                f"{case['id']}: result {index} score={score!r}, "
                                f"expected {expected['score']!r}"
                            )
        if built_index is not None:
            built_index.unlink(missing_ok=True)
        if failures:
            sys.stderr.write(combined)

    if failures:
        for failure in failures:
            print(f"FAIL {failure}", file=sys.stderr)
        return 1
    print(f"ok: {len(cases)} query cases")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
