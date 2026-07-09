#!/usr/bin/env python3
from __future__ import annotations

import importlib
import pathlib
import sys


REQUIRED_FILES = [
    "config.json",
    "generation_config.json",
    "model.safetensors.index.json",
    "tokenizer.json",
    "tokenizer_config.json",
]

ORACLE_MODULES = ["torch", "transformers", "safetensors", "accelerate"]


def main() -> int:
    model_dir = pathlib.Path("/Users/ianzepp/ai/models/Qwen3-4B-FP8")
    missing_files = [name for name in REQUIRED_FILES if not (model_dir / name).is_file()]
    if missing_files:
        print(
            "blocked: transformers-local-fp8 missing local files: "
            + ", ".join(missing_files)
        )
        return 0

    missing_modules: list[str] = []
    present_modules: list[str] = []
    for module in ORACLE_MODULES:
        try:
            imported = importlib.import_module(module)
        except Exception:
            missing_modules.append(module)
        else:
            present_modules.append(f"{module}={getattr(imported, '__version__', 'present')}")

    if missing_modules:
        print(
            "blocked: transformers-local-fp8 missing Python modules: "
            + ", ".join(missing_modules)
        )
        print("present: " + ", ".join(present_modules))
        print("status: blocked")
        return 0

    print("ready: transformers-local-fp8 dependencies present")
    print("status: ready")
    print("note: full model load and streaming are intentionally outside this preflight")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
