#!/usr/bin/env python3
"""Validate coreutils file-effect fixture postconditions and runner checks."""

from __future__ import annotations

import argparse
import importlib.util
import sys
import tempfile
from pathlib import Path

try:
    import tomllib
except ModuleNotFoundError:  # pragma: no cover
    import tomli as tomllib  # type: ignore[no-redef]


REPO = Path(__file__).resolve().parents[1]
FIXTURES = REPO / "coreutils" / "harness" / "fixtures"
RUNNER = REPO.parent / "radix" / "scripta" / "check_coreutils_parity.py"


def load_runner():
    spec = importlib.util.spec_from_file_location("check_coreutils_parity", RUNNER)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"failed to load runner module {RUNNER}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def postcondition_cases() -> list[str]:
    errors: list[str] = []
    count = 0
    for path in sorted(FIXTURES.glob("*/cases.toml")):
        data = tomllib.loads(path.read_text(encoding="utf-8"))
        for index, case in enumerate(data.get("case", []), start=1):
            label = f"{path.relative_to(REPO)} case[{index}] {case.get('id', '<missing-id>')}"
            files = case.get("files", {})
            dirs = case.get("dirs", [])
            missing = case.get("missing", [])
            if files or dirs or missing:
                count += 1
            if not isinstance(files, dict) or not all(
                isinstance(key, str) and isinstance(value, str)
                for key, value in files.items()
            ):
                errors.append(f"{label}: files must be a string-to-string table")
            if not isinstance(dirs, list) or not all(isinstance(item, str) for item in dirs):
                errors.append(f"{label}: dirs must be a string list")
            if not isinstance(missing, list) or not all(
                isinstance(item, str) for item in missing
            ):
                errors.append(f"{label}: missing must be a string list")
    if count == 0:
        errors.append("no coreutils fixtures declare file-effect postconditions")
    return errors


def runner_self_test() -> list[str]:
    runner = load_runner()
    errors: list[str] = []
    with tempfile.TemporaryDirectory(prefix="coreutils-postconditions-") as tmp:
        root = Path(tmp)
        root.joinpath("present.txt").write_text("actual\n", encoding="utf-8")
        root.joinpath("present-dir").mkdir()
        root.joinpath("unexpected").write_text("still here", encoding="utf-8")

        file_errors = runner.compare_files("probe", root, {"missing.txt": "want\n"})
        dir_errors = runner.compare_dirs("probe", root, ["missing-dir"])
        missing_errors = runner.compare_missing("probe", root, ["unexpected"])

    if not file_errors:
        errors.append("runner did not reject a missing expected file")
    if not dir_errors:
        errors.append("runner did not reject a missing expected directory")
    if not missing_errors:
        errors.append("runner did not reject an unexpectedly present missing path")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--fixtures-only",
        action="store_true",
        help="skip runner comparator self-test",
    )
    args = parser.parse_args()

    errors = postcondition_cases()
    if not args.fixtures_only:
        errors.extend(runner_self_test())

    if errors:
        for error in errors:
            print(f"error: {error}", file=sys.stderr)
        return 1
    print("ok: coreutils file-effect postconditions are documented and fail-closed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
