#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import pathlib


REPO = pathlib.Path(__file__).resolve().parents[4]
MODEL_ARTIFACT = REPO / "ai-workbench/harness/fixtures/model-artifact/tiny-model.fma.json"


def encode_prompt(prompt: str, vocab: dict[str, int], unknown_id: int) -> list[int]:
    return [vocab.get(token, unknown_id) for token in prompt.split()]


def main() -> int:
    parser = argparse.ArgumentParser(description="Hermetic tiny token/logits oracle")
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--model-dir", required=True)
    parser.add_argument("--model-alias", required=True)
    parser.add_argument("--source", required=True)
    parser.add_argument("--oracle-label", required=True)
    parser.add_argument("--max-new-tokens", required=True)
    parser.add_argument("--temperature", required=True)
    parser.add_argument("--seed", required=True)
    args = parser.parse_args()

    artifact = json.loads(MODEL_ARTIFACT.read_text(encoding="utf-8"))
    vocab = artifact["tokenizer"]["vocab"]
    unknown_id = int(vocab[artifact["tokenizer"]["unknown_token"]])
    prompt = pathlib.Path(args.prompt).read_text(encoding="utf-8").strip()
    token_ids = encode_prompt(prompt, vocab, unknown_id)
    logits = [-4.0, -3.0, -2.0, -1.0, 0.0, 4.0, 2.0]
    selected_id = max(range(len(logits)), key=lambda index: logits[index])
    reverse_vocab = {value: key for key, value in vocab.items()}
    selected_text = reverse_vocab[selected_id]

    events = [
        {
            "event": "metadata",
            "model": args.model_alias,
            "source": args.source,
            "status": "oracle-backed",
            "runtime": args.oracle_label,
            "fixture": "tiny-token-logits-oracle-v0",
            "prompt": prompt,
            "max_new_tokens": int(args.max_new_tokens),
            "temperature": args.temperature,
            "seed": int(args.seed),
            "claims": {
                "faber_owned_inference": False,
                "owned_model_runtime": False,
                "general_inference": False,
                "llama_cpp_parity": False,
                "llama_cpp_equivalence": False,
                "llama_cpp_runtime": False,
                "gguf_runtime": False,
                "transformer_execution": False,
                "transformer_runtime": False,
                "quantized_kernel_support": False,
                "gpu_execution": False,
                "gpu_runtime": False,
                "gpu_runtime_claims": False,
                "device_logits_execution": False,
                "device_softmax_execution": False,
                "device_training": False,
                "public_inference": False,
                "public_product_release": False,
                "model_downloads": False,
                "model_blobs_in_git": False,
                "implicit_model_downloads": False,
                "implicit_model_blobs": False,
            },
        },
        {
            "event": "prefill",
            "tokenizer": artifact["tokenizer"]["format"],
            "unknown_token_id": unknown_id,
            "token_ids": token_ids,
        },
        {
            "event": "logits",
            "dtype": "f32",
            "vocab_size": len(vocab),
            "values": logits,
        },
        {
            "event": "token",
            "token_id": selected_id,
            "text": selected_text,
            "logit": logits[selected_id],
        },
        {
            "event": "final",
            "text": selected_text,
        },
    ]
    output = pathlib.Path(args.out)
    output.write_text(
        "\n".join(json.dumps(event, separators=(",", ":")) for event in events) + "\n",
        encoding="utf-8",
    )
    print(f"wrote {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
