from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path


CHECKER_PATH = Path(__file__).with_name("check-gpu-workload-contracts.py")


def load_checker():
    spec = importlib.util.spec_from_file_location(
        "check_gpu_workload_contracts", CHECKER_PATH
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load checker: {CHECKER_PATH}")
    checker = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(checker)
    return checker


checker = load_checker()


class ToleranceContractTests(unittest.TestCase):
    def test_accepts_delta_within_declared_tolerance(self) -> None:
        self.assertTrue(checker.close(1.0, 1.0 + checker.TOLERANCE * 0.5))

    def test_rejects_delta_above_declared_tolerance(self) -> None:
        self.assertFalse(checker.close(1.0, 1.0 + checker.TOLERANCE * 1.1))


if __name__ == "__main__":
    unittest.main()
