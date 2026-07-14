from __future__ import annotations

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from claim_gates import FORBIDDEN_INFERENCE_CLAIMS  # noqa: E402


def false_runner_claims() -> dict[str, bool]:
    return {key: False for key in FORBIDDEN_INFERENCE_CLAIMS}
