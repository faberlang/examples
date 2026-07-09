#!/usr/bin/env python3
from __future__ import annotations

import json
import pathlib
import subprocess
import sys
from dataclasses import dataclass
from typing import Any


TOLERANCE = 1e-6


@dataclass(frozen=True)
class Case:
    id: str
    index_path: pathlib.Path
    query_path: pathlib.Path
    query: str
    top: int
    build_index: bool = False


def workspace_root() -> pathlib.Path:
    return pathlib.Path(__file__).resolve().parents[3]


def load_json(path: pathlib.Path) -> dict[str, Any]:
    return json.loads(path.read_text())


def run_command(root: pathlib.Path, command: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        cwd=root,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=120,
    )


def build_index(root: pathlib.Path, package: pathlib.Path, manifest: pathlib.Path, out_path: pathlib.Path) -> str:
    out_path.unlink(missing_ok=True)
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
        str(out_path),
        "--format",
        "json",
    ]
    result = run_command(root, command)
    if result.returncode != 0 or not out_path.exists():
        raise RuntimeError(result.stdout + result.stderr)
    return result.stdout + result.stderr


def dot(left: list[float], right: list[float]) -> float:
    if len(left) != len(right):
        raise ValueError(f"dimension mismatch: expected {len(left)} got {len(right)}")
    return sum(a * b for a, b in zip(left, right))


def reference_results(index_artifact: dict[str, Any], query_artifact: dict[str, Any], top: int) -> list[dict[str, Any]]:
    if index_artifact.get("format") != "fvi-stage3-index":
        raise ValueError("index must be fvi-stage3-index")
    if query_artifact.get("format") != "fvi-stage3-query-vector":
        raise ValueError("query vector must be fvi-stage3-query-vector")
    if index_artifact.get("metric") != "cosine":
        raise ValueError("index metric must be cosine")
    if index_artifact.get("normalization") != "l2":
        raise ValueError("index normalization must be l2")
    if query_artifact.get("normalization") != "l2":
        raise ValueError("query normalization must be l2")
    dimensions = int(index_artifact["dimensions"])
    query_values = [float(value) for value in query_artifact["values"]]
    if len(query_values) != dimensions:
        raise ValueError(f"query dimension mismatch: expected {dimensions} got {len(query_values)}")

    scored: list[dict[str, Any]] = []
    for record in index_artifact["vectors"]:
        values = [float(value) for value in record["values"]]
        if len(values) != dimensions:
            raise ValueError(f"record {record['id']} dimension mismatch: expected {dimensions} got {len(values)}")
        scored.append(
            {
                "id": str(record["id"]),
                "text": str(record["text"]),
                "score": dot(values, query_values),
            }
        )
    scored.sort(key=lambda item: (-float(item["score"]), item["id"]))
    return [
        {"rank": index + 1, **item}
        for index, item in enumerate(scored[:top])
    ]


def compare_results(case: Case, actual: dict[str, Any], expected: list[dict[str, Any]]) -> list[str]:
    failures: list[str] = []
    for key, expected_value in {
        "status": "ok",
        "query": case.query,
        "top": case.top,
        "metric": "cosine",
    }.items():
        if actual.get(key) != expected_value:
            failures.append(f"{case.id}: {key}={actual.get(key)!r}, expected {expected_value!r}")

    actual_results = actual.get("results")
    if not isinstance(actual_results, list):
        return failures + [f"{case.id}: results is not a list"]
    if len(actual_results) != len(expected):
        failures.append(f"{case.id}: result count={len(actual_results)}, expected {len(expected)}")
        return failures

    for index, (actual_item, expected_item) in enumerate(zip(actual_results, expected)):
        for key in ["rank", "id", "text"]:
            if actual_item.get(key) != expected_item[key]:
                failures.append(
                    f"{case.id}: result {index} {key}={actual_item.get(key)!r}, expected {expected_item[key]!r}"
                )
        actual_score = actual_item.get("score")
        if actual_score is None or abs(float(actual_score) - float(expected_item["score"])) > TOLERANCE:
            failures.append(
                f"{case.id}: result {index} score={actual_score!r}, expected {expected_item['score']!r}"
            )
    return failures


def main() -> int:
    root = workspace_root()
    package = root / "examples/ai-workbench/packages/faber-ai"
    manifest = root / "faber/Cargo.toml"
    fixture_root = root / "examples/ai-workbench/harness/fixtures"
    built_index = pathlib.Path("/tmp/faber-ai-stage5-cosine-index.fvi")
    cases = [
        Case(
            id="stage5-cosine-top-three",
            index_path=built_index,
            query_path=fixture_root / "query/beta-query.fvi",
            query="beta release",
            top=3,
            build_index=True,
        ),
        Case(
            id="stage5-cosine-tie-order",
            index_path=fixture_root / "query/tie-index.fvi",
            query_path=fixture_root / "query/beta-query.fvi",
            query="beta release",
            top=2,
        ),
    ]

    failures: list[str] = []
    for case in cases:
        combined = ""
        try:
            if case.build_index:
                combined += build_index(root, package, manifest, case.index_path)
            expected = reference_results(load_json(case.index_path), load_json(case.query_path), case.top)
        except Exception as exc:
            failures.append(f"{case.id}: reference setup failed: {exc}")
            continue

        command = [
            "cargo",
            "run",
            "--manifest-path",
            str(manifest),
            "--",
            "run",
            str(package),
            "--",
            "query",
            str(case.index_path),
            case.query,
            "--query-vector",
            str(case.query_path),
            "--top",
            str(case.top),
            "--format",
            "json",
        ]
        result = run_command(root, command)
        combined += result.stdout + result.stderr
        if result.returncode != 0:
            failures.append(f"{case.id}: query command exited {result.returncode}")
            sys.stderr.write(combined)
            continue
        try:
            actual = json.loads(result.stdout)
        except json.JSONDecodeError as exc:
            failures.append(f"{case.id}: invalid json stdout: {exc}")
            sys.stderr.write(combined)
            continue
        case_failures = compare_results(case, actual, expected)
        if case_failures:
            failures.extend(case_failures)
            sys.stderr.write(combined)

    built_index.unlink(missing_ok=True)

    if failures:
        for failure in failures:
            print(f"FAIL {failure}", file=sys.stderr)
        return 1
    print(f"ok: {len(cases)} cosine batch cases tolerance={TOLERANCE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
