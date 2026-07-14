#!/usr/bin/env python3
from __future__ import annotations

import pathlib
import re
import subprocess
import sys
import tomllib


TOUR_STEPS = [
    ("local inventory gaps", "check-local-inventory-gaps.py"),
    ("model inspect", "check-model-inspect.py"),
    ("embed", "check-embed.py"),
    ("index", "check-index.py"),
    ("query", "check-query.py"),
    ("generate", "check-generate.py"),
    ("package reuse", "check-package-reuse.py"),
    ("model artifact floor", "check-model-artifact-floor.py"),
    ("inference artifact admission", "check-inference-artifact-admission.py"),
    ("inference fixture map", "check-inference-fixture-map.py"),
    ("token/logits oracle", "check-token-logits-oracle.py"),
    ("GPU evidence map", "check-gpu-evidence-map.py"),
    ("chat", "check-chat.py"),
    ("session lifecycle", "check-session-lifecycle.py"),
    ("product install path", "check-product-install-path.py"),
    ("reuse handoff", "check-reuse-handoff.py"),
]


def workspace_root() -> pathlib.Path:
    return pathlib.Path(__file__).resolve().parents[3]


def tail(text: str, lines: int = 40) -> str:
    return "\n".join(text.splitlines()[-lines:])


BLOCK_RE = re.compile(r"^BLOCK (?P<id>[A-Za-z0-9_-]+):", re.MULTILINE)


def documented_blockers(root: pathlib.Path) -> dict[str, set[str]]:
    gaps_path = root / "examples/ai-workbench/local-inventory-gaps.toml"
    gaps = tomllib.loads(gaps_path.read_text())
    blockers: dict[str, set[str]] = {}
    for blocker in gaps.get("blockers", []):
        if blocker.get("blocked_exit") != 2:
            continue
        blockers.setdefault(blocker["step"], set()).add(blocker["id"])
    return blockers


def main() -> int:
    root = workspace_root()
    harness_dir = root / "examples/ai-workbench/harness"
    allowed_blockers = documented_blockers(root)
    failures: list[str] = []
    blocked: list[str] = []

    for label, script in TOUR_STEPS:
        result = subprocess.run(
            ["python3", str(harness_dir / script)],
            cwd=root,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=300,
        )
        combined = result.stdout + result.stderr
        if result.returncode == 2:
            reported_ids = set(BLOCK_RE.findall(combined))
            documented_ids = allowed_blockers.get(script, set())
            undocumented_ids = reported_ids - documented_ids
            if reported_ids and not undocumented_ids:
                blocked.append(
                    f"{label}: {script} reported documented block(s) "
                    f"{', '.join(sorted(reported_ids))}"
                )
                sys.stderr.write(f"\n--- {label} blocked tail ---\n{tail(combined)}\n")
            else:
                if not reported_ids:
                    failures.append(
                        f"{label}: {script} exited blocked status 2 without a stable blocker id"
                    )
                else:
                    failures.append(
                        f"{label}: {script} exited blocked status 2 with undocumented "
                        f"blocker id(s) {', '.join(sorted(undocumented_ids))}"
                    )
                sys.stderr.write(f"\n--- {label} undocumented block tail ---\n{tail(combined)}\n")
        elif result.returncode != 0:
            failures.append(f"{label}: {script} exited {result.returncode}")
            sys.stderr.write(f"\n--- {label} failure tail ---\n{tail(combined)}\n")

    if failures:
        for failure in failures:
            print(f"FAIL {failure}", file=sys.stderr)
        return 1
    if blocked:
        for item in blocked:
            print(f"BLOCK {item}", file=sys.stderr)
        print(f"ok: campaign tour ({len(TOUR_STEPS)} steps, {len(blocked)} blocked environment step(s))")
        return 0
    print(f"ok: campaign tour ({len(TOUR_STEPS)} steps)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
