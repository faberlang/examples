#!/usr/bin/env python3
# =============================================================================
# oracle/tools/replay_f32.py — independent strict-f32 trajectory replay (S4-B)
# =============================================================================
#
# Re-derives the training trajectory with STRICT f32 arithmetic and checks it
# against the captured oracle. The step count is auto-detected from the
# capture (gradients.json steps vs loss-trace.json), so the replay validates
# an 8-step capture and a 100-step capture identically. The FMIR stepper
# computes float math in f64 (radix-mir-stepper); this replay instead rounds
# every op to f32
# (numpy float32) to verify that the *executed contract* is the f32-typed
# program the fixture declares — i.e. an independent implementation of the
# same forward/update semantics:
#
#   for step s:  loss_s = mean((gelu(input@weight1 + bias1)@weight2
#                               + bias2 − target)²)      # current params
#                params[t] -= lr * grad_s(t)             # trainable t only
#
# Every arithmetic op is rounded to f32 explicitly (matmul products and
# running sums, bias adds, GELU tanh-approximation intermediates, residual
# sub, square, mean, lr fill, scaled grad, param sub), so the trajectory is
# an f32 lower bound of the executed f64 computation. The deviation between
# the two is bounded by f32 precision accumulation; the N1.9 oracle rules
# (same as oracle/*.json) are asserted below:
#   reduction scalars (loss trace)  |a-b| <= 1e-6 + 1e-6*|b|   (N1.9)
#   gradients / params              |a-b| <= 1e-4 + 1e-4*|b|   (N1.9)
# Observed worst deltas on the pinned oracle are ~1.5e-7 (losses) and
# ~8.8e-8 (final params), so the N1.9 rules hold with an order-of-magnitude
# margin. All compared values must be finite.
#
# Usage:
#   python3 tools/replay_f32.py [oracle_dir] [--max-steps N]
#   oracle_dir   defaults to the parent of the tools/ directory.
#   --max-steps  validate/print only the first N steps (all updates are still
#                applied, so the final-params check covers the full trajectory);
#                0 = all steps (default).
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

F32 = np.float32


# ---------------------------------------------------------------------------
# Strict-f32 4×4 matmul: each product rounded, running sum rounded per add.
# ---------------------------------------------------------------------------
def f32_matmul_4x4(a, b):
    out = []
    for i in range(4):
        for j in range(4):
            s = F32(0.0)
            for k in range(4):
                s = F32(s + F32(a[i * 4 + k] * b[k * 4 + j]))
            out.append(s)
    return out


def f32_gelu(x):
    """Strict-f32 GELU tanh approximation (same formula as the stepper):
    gelu(x) = 0.5·x·(1 + tanh(√(2/π)·(x + 0.044715·x³))). Every arithmetic
    sub-step — including the tanh evaluation — is rounded to f32."""
    alpha = F32(np.sqrt(F32(F32(2.0) / F32(np.float32(math.pi)))))
    beta = F32(0.044715)
    x = F32(x)
    x3 = F32(x * x * x)
    t = F32(x + F32(beta * x3))
    t = F32(alpha * t)
    tanh_t = F32(np.tanh(t))
    half = F32(F32(0.5) * x)
    return F32(half * F32(F32(1.0) + tanh_t))


def f32_forward(params):
    """mean((gelu(input@weight1 + bias1)@weight2 + bias2 − target)²),
    every op rounded to f32."""
    i = params["input"]
    w1, b1 = params["weight1"], params["bias1"]
    w2, b2 = params["weight2"], params["bias2"]
    t = params["target"]
    h1 = f32_matmul_4x4(i, w1)
    h1b = [F32(h1[k] + b1[k]) for k in range(16)]
    a1 = [f32_gelu(v) for v in h1b]
    h2 = f32_matmul_4x4(a1, w2)
    h2b = [F32(h2[k] + b2[k]) for k in range(16)]
    total = F32(0.0)
    for k in range(16):
        r = F32(h2b[k] - t[k])
        total = F32(total + F32(r * r))
    return F32(total / F32(16.0))


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


def check_step_count(steps, losses, declared, capture_txt):
    """Auto-detect the trajectory length and cross-check every source agrees.

    The gradient step list in gradients.json is the replay source of truth.
    loss-trace.json must agree (its declared 'steps' field, when present, and
    its losses array length). capture.txt step_loss markers are a regeneration
    artifact: a count mismatch there is a warning, not a hard error, so an
    older capture.txt never blocks a JSON-only replay.

    Returns the step count, or None when a hard check fails."""
    n = len(steps)
    problems = []
    if len(losses) != n:
        problems.append(f"loss-trace.json has {len(losses)} losses, "
                        f"gradients.json has {n} steps")
    if declared is not None and declared != n:
        problems.append(f"loss-trace.json declares {declared} steps, "
                        f"gradients.json has {n}")
    if problems:
        for p in problems:
            print(f"error: {p}", file=sys.stderr)
        return None
    with open(capture_txt) as fh:
        n_cap = sum(1 for line in fh if line.strip() == "step_loss")
    if n_cap != n:
        print(f"warning: capture.txt has {n_cap} step_loss markers, "
              f"expected {n}", file=sys.stderr)
    return n


def main() -> int:
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ap = argparse.ArgumentParser(description="Independent strict-f32 trajectory replay (S4-B)")
    ap.add_argument("oracle_dir", nargs="?", default=here)
    ap.add_argument("--max-steps", type=int, default=0, metavar="N",
                    help="validate/print only the first N steps (all updates are "
                         "still applied, so the final-params check stays valid for "
                         "the full trajectory); 0 = all steps (default)")
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

    n = check_step_count(steps, losses, loss_trace.get("steps"), capture_txt)
    if n is None:
        return 1
    limit = n if args.max_steps <= 0 else min(args.max_steps, n)

    worst_loss = 0.0
    worst_param = 0.0
    all_pass = True
    print(f"fixture: {fixture}   lr: {float(lr)}   steps: {n}   precision: strict f32")
    if limit < n:
        print(f"  (validating first {limit} of {n} steps; updates applied for all {n})")
    for s, step in enumerate(steps):
        loss = f32_forward(params)
        if s < limit:
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

    print(f"f32 replay: {'all ' + str(limit) + ' loss steps (of ' + str(n) + ') + final params pass' if all_pass else 'FAILURES'}, "
          f"worst loss delta {worst_loss:.6g} (rule tol ~{ATOL_LOSS + RTOL_LOSS * max(losses):.6g}), "
          f"worst param delta {worst_param:.6g} (rule {RULE_PARAM})")
    return 0 if all_pass else 1


if __name__ == "__main__":
    sys.exit(main())
