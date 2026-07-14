#!/usr/bin/env python3
from __future__ import annotations

import json
import pathlib
import subprocess
import sys
import tempfile
from typing import Any


FORBIDDEN_TRUE_CLAIMS = [
    "faber_owned_inference",
    "owned_model_runtime",
    "llama_cpp_parity",
    "llama_cpp_equivalence",
    "gguf_runtime",
    "transformer_execution",
    "transformer_runtime",
    "quantized_kernel_support",
    "gpu_runtime",
    "public_inference",
    "public_product_release",
    "model_blobs_in_git",
    "implicit_model_downloads",
]


def workspace_root() -> pathlib.Path:
    return pathlib.Path(__file__).resolve().parents[3]


def fail(failures: list[str], message: str) -> None:
    failures.append(message)


def load_events(path: pathlib.Path) -> list[dict[str, Any]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def encode(text: str, vocab: dict[str, int], unknown_id: int) -> list[int]:
    return [vocab.get(token, unknown_id) for token in text.split()]


def main() -> int:
    root = workspace_root()
    oracle = root / "examples/ai-workbench/harness/fixtures/generate/tiny_token_logits_oracle.py"
    expected = root / "examples/ai-workbench/harness/fixtures/generate/tiny-token-logits.expected.jsonl"
    model = root / "examples/ai-workbench/harness/fixtures/model-artifact/tiny-model.fma.json"
    prompt = root / "examples/ai-workbench/harness/fixtures/generate/prompt.txt"
    artifact = json.loads(model.read_text(encoding="utf-8"))
    vocab = artifact["tokenizer"]["vocab"]
    unknown_id = int(vocab[artifact["tokenizer"]["unknown_token"]])
    expected_token_ids = encode(prompt.read_text(encoding="utf-8").strip(), vocab, unknown_id)
    failures: list[str] = []
    expected_events = load_events(expected)

    with tempfile.TemporaryDirectory(prefix="faber-ai-token-logits-") as temp:
        out = pathlib.Path(temp) / "token-logits.jsonl"
        result = subprocess.run(
            [
                "python3",
                str(oracle),
                "--prompt",
                str(prompt),
                "--out",
                str(out),
                "--model-dir",
                str(model.parent),
                "--model-alias",
                "tiny/inference-fixture",
                "--source",
                "examples tiny fixture",
                "--oracle-label",
                "tiny-token-logits-oracle",
                "--max-new-tokens",
                "1",
                "--temperature",
                "0",
                "--seed",
                "7",
            ],
            cwd=root,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=30,
        )
        if result.returncode != 0:
            sys.stderr.write(result.stdout + result.stderr)
            fail(failures, f"oracle exited {result.returncode}")
        elif not out.exists():
            fail(failures, "oracle did not produce output")
        else:
            events = load_events(out)
            if events != expected_events:
                fail(failures, "generated token/logits JSONL must match expected sidecar")
            event_names = [event.get("event") for event in events]
            if event_names != ["metadata", "prefill", "logits", "token", "final"]:
                fail(failures, f"event sequence {event_names!r}")
            by_name = {event["event"]: event for event in events if "event" in event}
            metadata = by_name.get("metadata", {})
            if metadata.get("status") != "oracle-backed":
                fail(failures, "metadata status must be oracle-backed")
            if metadata.get("fixture") != "tiny-token-logits-oracle-v0":
                fail(failures, "metadata fixture marker mismatch")
            for key in FORBIDDEN_TRUE_CLAIMS:
                if metadata.get("claims", {}).get(key) is not False:
                    fail(failures, f"metadata claim {key} must remain false")

            prefill = by_name.get("prefill", {})
            if prefill.get("token_ids") != expected_token_ids:
                fail(failures, f"prefill token ids {prefill.get('token_ids')!r} != {expected_token_ids!r}")
            if prefill.get("unknown_token_id") != unknown_id:
                fail(failures, "prefill unknown token id mismatch")

            logits_event = by_name.get("logits", {})
            logits = logits_event.get("values", [])
            if logits_event.get("vocab_size") != len(vocab):
                fail(failures, "logits vocab_size must match tokenizer vocab")
            if len(logits) != len(vocab):
                fail(failures, "logits length must match tokenizer vocab")
            if logits_event.get("dtype") != "f32":
                fail(failures, "logits dtype must stay f32")

            token = by_name.get("token", {})
            if logits:
                expected_id = max(range(len(logits)), key=lambda index: float(logits[index]))
                reverse_vocab = {value: key for key, value in vocab.items()}
                if token.get("token_id") != expected_id:
                    fail(failures, "selected token id must be argmax(logits)")
                if token.get("text") != reverse_vocab[expected_id]:
                    fail(failures, "selected token text must match tokenizer vocab")
                if by_name.get("final", {}).get("text") != token.get("text"):
                    fail(failures, "final text must match selected token")

    if failures:
        for failure in failures:
            print(f"FAIL {failure}", file=sys.stderr)
        return 1
    print("ok: tiny token/logits oracle")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
