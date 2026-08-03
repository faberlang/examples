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
# approximation — 0.5*x*(1+tanh(√(2/π)*(x+0.044715·x³)))).
#
# MLP forward: mean((gelu(input·weight1 + bias1)·weight2 + bias2 − target)²)
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


# ---------------------------------------------------------------------------
# f64 tensor helpers (op order mirrors radix-mir-stepper)
# ---------------------------------------------------------------------------
def matmul(A, B, n, k, m):
    C = [0.0] * (n * m)
    for i in range(n):
        for j in range(m):
            acc = A[i * k + 0] * B[0 * m + j]
            for l in range(1, k):
                acc += A[i * k + l] * B[l * m + j]
            C[i * m + j] = acc
    return C


def gelu(x):
    alpha = (2.0 / math.pi) ** 0.5
    beta = 0.044715
    cube = x * x * x
    return 0.5 * x * (1.0 + math.tanh(alpha * (x + beta * cube)))


def vadd(A, B):
    return [a + b for a, b in zip(A, B)]


def vsub(A, B):
    return [a - b for a, b in zip(A, B)]


# ---------------------------------------------------------------------------
# f64 forward for mlp: mean((gelu(input·weight1 + bias1)·weight2 + bias2 − target)²)
# ---------------------------------------------------------------------------
def forward(params):
    I = params["input"]
    W1, B1 = params["weight1"], params["bias1"]
    W2, B2 = params["weight2"], params["bias2"]
    T = params["target"]
    h1 = matmul(I, W1, 4, 4, 4)
    h1b = vadd(h1, B1)
    a1 = [gelu(v) for v in h1b]
    h2 = matmul(a1, W2, 4, 4, 4)
    h2b = vadd(h2, B2)
    residual = vsub(h2b, T)
    return sum(v * v for v in residual) / 16.0


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
