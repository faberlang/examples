from __future__ import annotations

from typing import Any


FORBIDDEN_INFERENCE_CLAIMS = (
    "faber_owned_inference",
    "owned_model_runtime",
    "general_inference",
    "llama_cpp_parity",
    "llama_cpp_equivalence",
    "llama_cpp_runtime",
    "gguf_runtime",
    "transformer_execution",
    "transformer_runtime",
    "quantized_kernel_support",
    "gpu_execution",
    "gpu_runtime",
    "gpu_runtime_claims",
    "device_logits_execution",
    "device_softmax_execution",
    "device_training",
    "public_inference",
    "public_product_release",
    "model_downloads",
    "model_blobs_in_git",
    "implicit_model_downloads",
    "implicit_model_blobs",
)


def false_claim_failures(
    claims: dict[str, Any] | None,
    *,
    label: str,
    require_all: bool,
) -> list[str]:
    failures: list[str] = []
    if not isinstance(claims, dict):
        return [f"{label} claims must be an object"]
    for key in FORBIDDEN_INFERENCE_CLAIMS:
        if key not in claims:
            if require_all:
                failures.append(f"{label} claim {key} must be explicitly false")
            continue
        if claims[key] is not False:
            failures.append(f"{label} claim {key} must remain false")
    return failures
