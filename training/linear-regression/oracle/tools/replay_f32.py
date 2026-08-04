#!/usr/bin/env python3
# =============================================================================
# oracle/tools/replay_f32.py — independent strict-f32 trajectory replay (S4-A)
# =============================================================================
#
# Re-derives the 8-step training trajectory with STRICT f32 arithmetic and
# checks it against the captured oracle. The FMIR stepper computes float math
# in f64 (radix-mir-stepper); this replay instead rounds every op to f32
# (numpy float32) to verify that the *executed contract* is the f32-typed
# program the fixture declares — i.e. an independent implementation of the
# same forward/update semantics:
#
#   for step s:  loss_s = mean((input@weight + bias − target)²)   # current params
#                params[t] -= lr * grad_s(t)                      # trainable t only
#
# Every arithmetic op is rounded to f32 explicitly (products, running sums,
# bias add, residual sub, square, mean, lr fill, scaled grad, param sub), so
# the trajectory is an f32 lower bound of the executed f64 computation. The
# deviation between the two is bounded by f32 precision accumulation; the
# N1.9 oracle rules (same as oracle/*.json) are asserted below:
#   reduction scalars (loss trace)  |a-b| <= 1e-6 + 1e-6*|b|   (N1.9)
#   gradients / params              |a-b| <= 1e-4 + 1e-4*|b|   (N1.9)
# Observed worst deltas on the pinned oracle are ~2e-7 (losses) and ~5e-8
# (final params), so the N1.9 rules hold with an order-of-magnitude margin.
# All compared values must be finite.
#
# Usage:
#   python3 tools/replay_f32.py [oracle_dir]
#   oracle_dir  defaults to the parent of the tools/ directory.
#
# Exit codes: 0 = all checks within rule; 1 = error or out-of-tolerance value.
# =============================================================================
import argparse
import json
import math
import os
import sys

import numpy as np

# N1.9 oracle rules (identical to oracle/*.json; not weakened).
ATOL_LOSS = 1.0e-6
RTOL_LOSS = 1.0e-6
ATOL_PARAM = 1.0e-4
RTOL_PARAM = 1.0e-4
RULE_LOSS = "|a-b| <= 1e-6 + 1e-6*|b| (N1.9 reduction scalar)"
RULE_PARAM = "|a-b| <= 1e-4 + 1e-4*|b| (N1.9 gradient tolerances)"
STEPS = 8

F32 = np.float32


# ---------------------------------------------------------------------------
# Strict-f32 2×2 matmul: each product rounded, running sum rounded per add.
# ---------------------------------------------------------------------------
def f32_matmul_2x2(a, b):
    out = []
    for i in range(2):
        for j in range(2):
            s = F32(0.0)
            for k in range(2):
                s = F32(s + F32(a[i * 2 + k] * b[k * 2 + j]))
            out.append(s)
    return out


def f32_forward(params):
    """mean((input@weight + bias − target)²), every op rounded to f32."""
    i, w, b, t = params["input"], params["weight"], params["bias"], params["target"]
    pred = f32_matmul_2x2(i, w)
    total = F32(0.0)
    for k in range(4):
        shifted = F32(pred[k] + b[k])
        residual = F32(shifted - t[k])
        total = F32(total + F32(residual * residual))
    return F32(total / F32(4.0))


def f32_sgd(param, grad, lr):
    """param − lr·grad in strict f32 (mirrors the gradus train_step math)."""
    return F32(param - F32(lr * grad))


# ---------------------------------------------------------------------------
# Parsing helpers (mirror replay_loss.py)
# ---------------------------------------------------------------------------
def parse_tensor_list(line):
    return [F32(x) for x in line.strip().strip("[]").split(",")]


def load_initial(capture_txt):
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


def main() -> int:
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ap = argparse.ArgumentParser(description="Independent strict-f32 trajectory replay (S4-A)")
    ap.add_argument("oracle_dir", nargs="?", default=here)
    args = ap.parse_args()

    oracle_dir = os.path.abspath(args.oracle_dir)
    capture_txt = os.path.join(oracle_dir, "capture.txt")
    gradients_json = os.path.join(oracle_dir, "gradients.json")
    loss_trace_json = os.path.join(oracle_dir, "loss-trace.json")
    final_params_json = os.path.join(oracle_dir, "final-params.json")
    for path in (capture_txt, gradients_json, loss_trace_json, final_params_json):
        if not os.path.isfile(path):
            print(f"error: missing {path}", file=sys.stderr)
            return 1

    params = load_initial(capture_txt)
    gradients = json.load(open(gradients_json))
    loss_trace = json.load(open(loss_trace_json))
    final_ref = json.load(open(final_params_json))["final_params"]
    steps, fixture = gradients["steps"], gradients["fixture"]
    losses = [float(v) for v in loss_trace["losses"]]
    lr = F32(float(loss_trace["lr"]))

    worst_loss = 0.0
    worst_param = 0.0
    all_pass = True
    print(f"fixture: {fixture}   lr: {float(lr)}   steps: {len(steps)}   precision: strict f32")
    for s, step in enumerate(steps):
        loss = f32_forward(params)
        expected = losses[s]
        delta = abs(float(loss) - expected)
        tol = ATOL_LOSS + RTOL_LOSS * abs(expected)
        ok = delta <= tol and math.isfinite(float(loss)) and math.isfinite(expected)
        all_pass = all_pass and ok
        worst_loss = max(worst_loss, delta)
        print(f"  step {s}: f32={float(loss)!r} trace={expected!r} "
              f"delta={delta:.6g} tol={tol:.6g} {'PASS' if ok else 'FAIL'}")
        # SGD update of the trainable params (strict f32; frozen untouched)
        for tensor in step["gradients"]:
            g = [F32(v) for v in tensor["values"]]
            p = params[tensor["name"]]
            for idx in range(len(p)):
                p[idx] = f32_sgd(p[idx], g[idx], lr)

    # Final params (trainable only) under the N1.9 gradient rule.
    for fp in final_ref:
        name = fp["name"]
        ref = [float(v) for v in fp["values"]]
        got = [float(x) for x in params[name]]
        for idx, (g, r) in enumerate(zip(got, ref)):
            delta = abs(g - r)
            tol = ATOL_PARAM + RTOL_PARAM * abs(r)
            ok = delta <= tol and math.isfinite(g) and math.isfinite(r)
            all_pass = all_pass and ok
            worst_param = max(worst_param, delta)
            print(f"  final {name}[{idx}]: f32={g!r} ref={r!r} "
                  f"delta={delta:.6g} tol={tol:.6g} {'PASS' if ok else 'FAIL'}")

    print(f"f32 replay: {'all ' + str(len(steps)) + ' loss steps + final params pass' if all_pass else 'FAILURES'}, "
          f"worst loss delta {worst_loss:.6g} (rule tol ~{ATOL_LOSS + RTOL_LOSS * max(losses):.6g}), "
          f"worst param delta {worst_param:.6g} (rule {RULE_PARAM})")
    return 0 if all_pass else 1


if __name__ == "__main__":
    sys.exit(main())
