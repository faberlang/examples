from __future__ import annotations

from typing import Any

from claim_gates import false_claim_failures


CLAIM_GATED_METADATA_STATUSES = {"oracle-backed", "router-backed"}


def metadata_claim_failures(events: list[dict[str, Any]], *, label: str) -> list[str]:
    failures: list[str] = []
    for index, event in enumerate(events):
        if event.get("event") != "metadata":
            continue
        if event.get("status") not in CLAIM_GATED_METADATA_STATUSES:
            continue
        if "claims" not in event:
            continue
        failures.extend(
            false_claim_failures(
                event.get("claims"),
                label=f"{label} metadata[{index}]",
                require_all=True,
            )
        )
    return failures
