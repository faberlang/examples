#!/usr/bin/env python3
from __future__ import annotations

import json
import pathlib
import sys
import tempfile
import urllib.error
import urllib.request


MODEL_ID = "qwen36-35b-a3b-q4"
ROUTER_BASE_URL = "http://127.0.0.1:18173/v1"
GGUF_PATH = pathlib.Path("/Users/ianzepp/ai/models/Qwen3.6-35B-A3B-UD-Q4_K_M.gguf")
PROMPT = "Reply with one short sentence about local model inventory."


def write_jsonl(path: pathlib.Path, events: list[dict[str, object]]) -> None:
    path.write_text("\n".join(json.dumps(event, separators=(",", ":")) for event in events) + "\n")


def fetch_models() -> dict[str, object]:
    with urllib.request.urlopen(f"{ROUTER_BASE_URL}/models", timeout=2) as response:
        return json.loads(response.read().decode("utf-8"))


def post_chat() -> dict[str, object]:
    body = json.dumps(
        {
            "model": MODEL_ID,
            "messages": [{"role": "user", "content": PROMPT}],
            "max_tokens": 16,
            "temperature": 0,
            "stream": False,
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        f"{ROUTER_BASE_URL}/chat/completions",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


def main() -> int:
    output_path = pathlib.Path(tempfile.gettempdir()) / "faber-ai-chat-live.jsonl"
    output_path.unlink(missing_ok=True)

    if not GGUF_PATH.is_file():
        write_jsonl(
            output_path,
            [
                {"event": "metadata", "model": MODEL_ID, "status": "blocked"},
                {"event": "diagnostic", "message": f"missing GGUF inventory: {GGUF_PATH}"},
            ],
        )
        print(f"blocked: missing GGUF inventory {GGUF_PATH}")
        print(f"artifact: {output_path}")
        output_path.unlink(missing_ok=True)
        return 0

    try:
        models = fetch_models()
    except Exception as exc:
        write_jsonl(
            output_path,
            [
                {"event": "metadata", "model": MODEL_ID, "status": "blocked"},
                {"event": "diagnostic", "message": f"llama router unavailable: {exc}"},
            ],
        )
        print(f"blocked: llama router unavailable at {ROUTER_BASE_URL}: {exc}")
        print(f"artifact: {output_path}")
        output_path.unlink(missing_ok=True)
        return 0

    match = next((item for item in models.get("data", []) if item.get("id") == MODEL_ID), None)
    if match is None:
        write_jsonl(
            output_path,
            [
                {"event": "metadata", "model": MODEL_ID, "status": "blocked"},
                {"event": "diagnostic", "message": "router model id not listed"},
            ],
        )
        print(f"blocked: router model id not listed: {MODEL_ID}")
        print(f"artifact: {output_path}")
        output_path.unlink(missing_ok=True)
        return 0

    status = (match.get("status") or {}).get("value", "unknown")
    if status != "loaded":
        write_jsonl(
            output_path,
            [
                {
                    "event": "metadata",
                    "model": MODEL_ID,
                    "status": "blocked",
                    "router_status": status,
                    "runtime": "llama-router",
                },
                {
                    "event": "diagnostic",
                    "message": "router model is listed but not loaded; Stage 7B does not force a 35B load",
                },
            ],
        )
        print(f"blocked: {MODEL_ID} listed but router status={status}")
        print(f"artifact: {output_path}")
        output_path.unlink(missing_ok=True)
        return 0

    try:
        completion = post_chat()
    except urllib.error.HTTPError as exc:
        message = exc.read().decode("utf-8", errors="replace")
        write_jsonl(
            output_path,
            [
                {"event": "metadata", "model": MODEL_ID, "status": "blocked"},
                {"event": "diagnostic", "message": f"chat completion failed: {message}"},
            ],
        )
        print(f"blocked: chat completion failed: {message}")
        print(f"artifact: {output_path}")
        output_path.unlink(missing_ok=True)
        return 0

    choices = completion.get("choices") or []
    text = ""
    if choices:
        text = ((choices[0].get("message") or {}).get("content") or "").strip()
    if not text:
        print("FAIL live chat returned no assistant text", file=sys.stderr)
        return 1

    write_jsonl(
        output_path,
        [
            {
                "event": "metadata",
                "model": MODEL_ID,
                "status": "router-backed",
                "runtime": "llama-router",
                "router_url": ROUTER_BASE_URL,
            },
            {"event": "prompt", "text": PROMPT},
            {"event": "message", "role": "assistant", "text": text},
            {"event": "final", "finish_reason": choices[0].get("finish_reason", "")},
        ],
    )
    print(f"ok: live router chat produced transcript at {output_path}")
    output_path.unlink(missing_ok=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
