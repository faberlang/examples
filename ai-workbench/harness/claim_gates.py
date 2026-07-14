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
    "pytorch_equivalence",
)


def false_claim_failures(
    claims: dict[str, Any] | None,
    *,
    label: str,
    require_all: bool,
    allowed_false_unknown_claims: tuple[str, ...] = (),
    allowed_true_claims: tuple[str, ...] = (),
) -> list[str]:
    failures: list[str] = []
    if not isinstance(claims, dict):
        return [f"{label} claims must be an object"]
    if require_all:
        allowed_false = set(allowed_false_unknown_claims)
        allowed_true = set(allowed_true_claims)
        allowed = allowed_false | allowed_true
        known = set(FORBIDDEN_INFERENCE_CLAIMS) | allowed
        for key in sorted(set(claims) - known):
            failures.append(f"{label} claim {key} is unknown to the shared forbidden vocabulary")
        for key in sorted(set(claims) & allowed_false):
            if claims[key] is not False:
                failures.append(f"{label} claim {key} must remain false")
    for key in FORBIDDEN_INFERENCE_CLAIMS:
        if key not in claims:
            if require_all:
                failures.append(f"{label} claim {key} must be explicitly false")
            continue
        if claims[key] is not False:
            failures.append(f"{label} claim {key} must remain false")
    return failures
