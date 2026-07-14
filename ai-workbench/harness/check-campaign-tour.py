#!/usr/bin/env python3
from __future__ import annotations

import pathlib
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


def documented_block_scripts(root: pathlib.Path) -> set[str]:
    gaps_path = root / "examples/ai-workbench/local-inventory-gaps.toml"
    gaps = tomllib.loads(gaps_path.read_text())
    return {
        blocker["step"]
        for blocker in gaps.get("blockers", [])
        if blocker.get("blocked_exit") == 2
    }


def main() -> int:
    root = workspace_root()
    harness_dir = root / "examples/ai-workbench/harness"
    allowed_block_scripts = documented_block_scripts(root)
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
            if script in allowed_block_scripts:
                blocked.append(f"{label}: {script} reported an intentional environment block")
                sys.stderr.write(f"\n--- {label} blocked tail ---\n{tail(combined)}\n")
            else:
                failures.append(f"{label}: {script} exited undocumented blocked status 2")
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
