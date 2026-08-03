#!/usr/bin/env python3
# =============================================================================
# oracle/tools/replay_loss.py — independent f64 loss-trace replay (S0-C)
# =============================================================================
#
# Re-derives the 8-step loss trace from the captured initial values
# (oracle/capture.txt, initial_* markers) and the captured per-step gradients
# (oracle/gradients.json), using pure Python f64 arithmetic. The FMIR stepper
# computes float math in f64 (radix-mir-stepper), so an f64 replay is an
# independent re-derivation of the trajectory:
#
#   for step s:  loss_s = forward(params)            # current params
#                params[t] -= lr * grad_s(t)         # trainable t only
#
# Each step is compared against oracle/loss-trace.json under the N1.9
# reduction-scalar rule  |a-b| <= 1e-6 + 1e-6*|b|. The forward below mirrors
# the fixture arithmetic (same op order as the stepper: matmul accumulates
# left-to-right from the first product; mean = sum/len; GELU is the tanh
# approximation; LayerNorm/softmax follow the stepper runtime).
#
# Usage:
#   python3 tools/replay_loss.py [oracle_dir]
#   oracle_dir  defaults to the parent of the tools/ directory.
#
# Exit codes: 0 = all steps within rule; 1 = error or out-of-tolerance step.
# =============================================================================
import argparse
import json
import math
import os
import sys

ATOL = 1.0e-6
RTOL = 1.0e-6
RULE = "|a-b| <= 1e-6 + 1e-6*|b| (N1.9 reduction scalar)"
STEPS = 8


# ---------------------------------------------------------------------------
# f64 forward for linear-regression: mean((input·weight + bias − target)²)
# ---------------------------------------------------------------------------
def forward(params):
    I, W, B, T = params["input"], params["weight"], params["bias"], params["target"]
    # pred = I @ W + B   (2x2, row-major, left-to-right accumulation)
    pred = [0.0] * 4
    for i in range(2):
        for j in range(2):
            pred[i * 2 + j] = I[i * 2 + 0] * W[0 * 2 + j] + I[i * 2 + 1] * W[1 * 2 + j]
    residual = [pred[k] + B[k] - T[k] for k in range(4)]
    return sum(v * v for v in residual) / 4.0


# ---------------------------------------------------------------------------
# Parsing helpers
# ---------------------------------------------------------------------------
def parse_tensor_list(line: str):
    return [float(x) for x in line.strip().strip("[]").split(",")]


def load_initial(capture_txt: str):
    """Parse initial_<name> marker/value pairs from capture.txt."""
    params = {}
    lines = open(capture_txt).read().splitlines()
    i = 0
    while i < len(lines):
        marker = lines[i].strip()
        if marker.startswith("initial_"):
            params[marker[len("initial_"):]] = parse_tensor_list(lines[i + 1])
            i += 2
        else:
            i += 1
    return params


def load_gradients(path: str):
    g = json.load(open(path))
    return g["steps"], g.get("fixture")


def load_losses(path: str):
    d = json.load(open(path))
    return [float(v) for v in d["losses"]], float(d["lr"])


# ---------------------------------------------------------------------------
def main() -> int:
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ap = argparse.ArgumentParser(description="Independent f64 loss-trace replay (S0-C)")
    ap.add_argument("oracle_dir", nargs="?", default=here)
    args = ap.parse_args()

    oracle_dir = os.path.abspath(args.oracle_dir)
    capture_txt = os.path.join(oracle_dir, "capture.txt")
    gradients_json = os.path.join(oracle_dir, "gradients.json")
    loss_trace_json = os.path.join(oracle_dir, "loss-trace.json")
    for path in (capture_txt, gradients_json, loss_trace_json):
        if not os.path.isfile(path):
            print(f"error: missing {path}", file=sys.stderr)
            return 1

    params = load_initial(capture_txt)
    steps, fixture = load_gradients(gradients_json)
    losses, lr = load_losses(loss_trace_json)

    worst = 0.0
    all_pass = True
    print(f"fixture: {fixture}   lr: {lr}   steps: {len(steps)}")
    for s, step in enumerate(steps):
        loss = forward(params)
        expected = losses[s]
        delta = abs(loss - expected)
        tol = ATOL + RTOL * abs(expected)
        ok = delta <= tol and math.isfinite(loss) and math.isfinite(expected)
        all_pass = all_pass and ok
        worst = max(worst, delta)
        print(f"  step {s}: replay={loss!r} trace={expected!r} "
              f"delta={delta:.6g} tol={tol:.6g} {'PASS' if ok else 'FAIL'}")
        # SGD update of the trainable params (frozen tensors untouched)
        for tensor in step["gradients"]:
            g = [float(v) for v in tensor["values"]]
            p = params[tensor["name"]]
            for i in range(len(p)):
                p[i] -= lr * g[i]

    print(f"loss replay: {'all ' + str(len(steps)) + ' steps pass' if all_pass else 'FAILURES'}, "
          f"worst delta {worst:.6g} (rule tol ~{ATOL + RTOL * max(losses):.6g})")
    return 0 if all_pass else 1


if __name__ == "__main__":
    sys.exit(main())
