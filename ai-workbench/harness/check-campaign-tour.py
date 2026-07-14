#!/usr/bin/env python3
from __future__ import annotations

import pathlib
import subprocess
import sys


TOUR_STEPS = [
    ("local inventory gaps", "check-local-inventory-gaps.py"),
    ("model inspect", "check-model-inspect.py"),
    ("embed", "check-embed.py"),
    ("index", "check-index.py"),
    ("query", "check-query.py"),
    ("generate", "check-generate.py"),
    ("model artifact floor", "check-model-artifact-floor.py"),
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


def main() -> int:
    root = workspace_root()
    harness_dir = root / "examples/ai-workbench/harness"
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
            blocked.append(f"{label}: {script} reported an intentional environment block")
            sys.stderr.write(f"\n--- {label} blocked tail ---\n{tail(combined)}\n")
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
