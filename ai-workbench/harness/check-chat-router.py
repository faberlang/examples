#!/usr/bin/env python3
from __future__ import annotations

import json
import pathlib
import sys
import urllib.request


MODEL_ID = "qwen36-35b-a3b-q4"
ROUTER_URL = "http://127.0.0.1:18173/v1/models"
GGUF_PATH = pathlib.Path("/Users/ianzepp/ai/models/Qwen3.6-35B-A3B-UD-Q4_K_M.gguf")


def main() -> int:
    if not GGUF_PATH.is_file():
        print(f"blocked: missing GGUF inventory {GGUF_PATH}")
        return 0

    try:
        with urllib.request.urlopen(ROUTER_URL, timeout=2) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except Exception as exc:
        print(f"blocked: llama router unavailable at {ROUTER_URL}: {exc}")
        return 0

    models = payload.get("data", [])
    match = next((item for item in models if item.get("id") == MODEL_ID), None)
    if match is None:
        print(f"blocked: router model id not listed: {MODEL_ID}")
        return 0

    status = (match.get("status") or {}).get("value", "unknown")
    preset = (match.get("status") or {}).get("preset", "")
    if str(GGUF_PATH) not in preset:
        print(f"blocked: router preset does not reference {GGUF_PATH}")
        return 0

    print(f"ready: {MODEL_ID} listed by llama router with status={status}")
    print("status: ready" if status == "loaded" else "status: unloaded")
    print("note: Stage 7A only checks inventory/readiness; chat smoke belongs to Stage 7B")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
