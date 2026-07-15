#!/usr/bin/env python3
"""Audit active first-party Faber apps for manual JSON builders/scanners."""

from __future__ import annotations

import argparse
import re
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path


REPO = Path(__file__).resolve().parents[1]
DEFAULT_ROOTS = (
    REPO / "ai-workbench" / "packages" / "faber-ai" / "src",
    REPO / "vivilite" / "src",
)

FORBIDDEN_HELPER = re.compile(
    r"\bfunctio\s+("
    r"json_[A-Za-z0-9_]*|"
    r"field_textus|field_numerus|array_end|object_end|json_string_end|json_unescape|"
    r"jq|lb|rb|q|qq|pair|pair_text"
    r")\b"
)
JSON_LITERAL = re.compile(r'"[^"\n]*(?:\{|\}|\[|\]|\\?"\s*:|:|,)[^"\n]*"')
FVI_LITERAL = re.compile(r'"fvi-stage[0-9A-Za-z_-]*"')


@dataclass(frozen=True)
class Violation:
    path: Path
    line_no: int
    kind: str
    text: str

    def format(self) -> str:
        rel = self.path.relative_to(REPO) if self.path.is_relative_to(REPO) else self.path
        return f"{rel}:{self.line_no}: {self.kind}: {self.text.strip()}"


def fab_sources(roots: tuple[Path, ...]) -> list[Path]:
    sources: list[Path] = []
    for root in roots:
        if root.is_file() and root.suffix == ".fab":
            sources.append(root)
            continue
        if not root.exists():
            continue
        for path in root.rglob("*.fab"):
            parts = set(path.parts)
            if "target" in parts or "archive" in parts or "archivum" in parts:
                continue
            sources.append(path)
    return sorted(sources)


def manual_json_concat(line: str) -> bool:
    if "+" not in line:
        return False
    if " ↦ json" in line or "@ json" in line:
        return False
    return bool(JSON_LITERAL.search(line) or FVI_LITERAL.search(line))


def audit_file(path: Path) -> list[Violation]:
    violations: list[Violation] = []
    for index, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        helper = FORBIDDEN_HELPER.search(line)
        if helper:
            violations.append(Violation(path, index, "manual-json-helper", line))
        if manual_json_concat(line):
            violations.append(Violation(path, index, "manual-json-concat", line))
        if FVI_LITERAL.search(line) and "+" in line:
            violations.append(Violation(path, index, "manual-fvi-marker-assembly", line))
    return violations


def audit(roots: tuple[Path, ...]) -> list[Violation]:
    violations: list[Violation] = []
    for source in fab_sources(roots):
        violations.extend(audit_file(source))
    return violations


def run_self_test() -> int:
    with tempfile.TemporaryDirectory(prefix="faber-json-audit-") as tmp:
        root = Path(tmp)
        source = root / "bad.fab"
        source.write_text(
            "\n".join(
                [
                    'functio json_escape(textus value) → textus {',
                    '    redde value',
                    '}',
                    'functio emits() → textus {',
                    '    redde "{" + "\\"status\\":\\"" + "ok" + "\\"}"',
                    '}',
                ]
            ),
            encoding="utf-8",
        )
        violations = audit((source,))
    helper = any(item.kind == "manual-json-helper" for item in violations)
    builder = any(item.kind == "manual-json-concat" for item in violations)
    if helper and builder:
        print("ok: seeded manual JSON helper and builder were rejected")
        return 0
    for item in violations:
        print(item.format(), file=sys.stderr)
    print("self-test failed: expected helper and builder violations", file=sys.stderr)
    return 1


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="fail when active sources contain manual JSON patterns")
    parser.add_argument("--self-test", action="store_true", help="prove seeded forbidden patterns are rejected")
    args = parser.parse_args()

    if args.self_test:
        return run_self_test()

    violations = audit(DEFAULT_ROOTS)
    if violations:
        for item in violations:
            print(item.format(), file=sys.stderr)
        return 1
    print("ok: no manual JSON builders or scanners in active first-party app sources")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
