#!/usr/bin/env python3
# =============================================================================
# oracle/tools/replay_loss.py — independent f64 loss-trace replay (S0-C,
# S6-U8 [8]-bias shape)
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
# approximation — 0.5*x*(1+tanh(√(2/π)*(x+0.044715·x³))); softmax subtracts the
# row max and accumulates exp terms left-to-right; LayerNorm computes
# mean(centered)² over the last axis, inv = 1/√(var+eps), y = x·inv·γ+β).
#
# BERT-tiny forward (B=2, D=8, H=1): pre-LN → Q/K/V → scaled dot-product
# attention → output projection → residual → LN → FFN (linear→GELU→linear) →
# residual → LN → MSE.
#
# S6-U8 bias contract: biases are per-channel [8] and broadcast across the
# batch axis (the S6-C2 addita_bias rank-extension add) — `vadd_bias` adds
# bias[d] to every row d. The [2,8] duplicated-row workaround is gone.
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


def transpose(A, rows, cols):
    """Row-major A[rows][cols] -> row-major A^T[cols][rows]."""
    return [A[i * cols + j] for j in range(cols) for i in range(rows)]


def gelu(x):
    alpha = (2.0 / math.pi) ** 0.5
    beta = 0.044715
    cube = x * x * x
    return 0.5 * x * (1.0 + math.tanh(alpha * (x + beta * cube)))


def softmax_rows(x, dim):
    """Row-wise softmax over the last axis (length `dim`); row max is
    subtracted for stability, exp terms accumulate left-to-right."""
    out = []
    batch = len(x) // dim
    for b in range(batch):
        base = b * dim
        row = x[base:base + dim]
        mx = max(row)
        exps = [math.exp(v - mx) for v in row]
        exp_sum = 0.0
        for e in exps:
            exp_sum += e
        out.extend(e / exp_sum for e in exps)
    return out


def layernorm(x, dim, gamma, beta, eps=1e-5):
    """LayerNorm over the last axis (length `dim`): mean, centered, var,
    inv = 1/√(var+eps), y = centered·inv·γ+β."""
    out = []
    batch = len(x) // dim
    for b in range(batch):
        base = b * dim
        row = x[base:base + dim]
        s = 0.0
        for v in row:
            s += v
        mean = s / dim
        centered = [v - mean for v in row]
        sum_sq = 0.0
        for c in centered:
            sum_sq += c * c
        var = sum_sq / dim
        inv_std = 1.0 / math.sqrt(var + eps)
        for c in range(dim):
            out.append(centered[c] * inv_std * gamma[c] + beta[c])
    return out


def vadd(A, B):
    return [a + b for a, b in zip(A, B)]


def vadd_bias(A, b):
    """Per-channel [D] bias broadcast across the batch axis of a row-major
    [B,D] tensor (the S6-C2 addita_bias rank-extension add): bias[d] is added
    to every row's channel d."""
    dim = len(b)
    out = []
    for i, a in enumerate(A):
        out.append(a + b[i % dim])
    return out


def vsub(A, B):
    return [a - b for a, b in zip(A, B)]


def vmul(A, B):
    return [a * b for a, b in zip(A, B)]


# ---------------------------------------------------------------------------
# f64 forward for bert-tiny-fragment (B=2, D=8, H=1)
# ---------------------------------------------------------------------------
def forward(params):
    I = params["input"]
    wq, bq = params["wq"], params["bq"]
    wk, bk = params["wk"], params["bk"]
    wv, bv = params["wv"], params["bv"]
    wo, bo = params["wo"], params["bo"]
    wf1, bf1 = params["wf1"], params["bf1"]
    wf2, bf2 = params["wf2"], params["bf2"]
    ln1_s, ln1_o = params["ln1_s"], params["ln1_o"]
    ln2_s, ln2_o = params["ln2_s"], params["ln2_o"]
    ln3_s, ln3_o = params["ln3_s"], params["ln3_o"]
    dk_scale = params["dk_scale"]
    T = params["target"]

    ln1 = layernorm(I, 8, ln1_s, ln1_o, 1e-5)
    q = vadd_bias(matmul(ln1, wq, 2, 8, 8), bq)
    k = vadd_bias(matmul(ln1, wk, 2, 8, 8), bk)
    v = vadd_bias(matmul(ln1, wv, 2, 8, 8), bv)

    kt = transpose(k, 2, 8)                      # [8,2]
    scores = matmul(q, kt, 2, 8, 2)              # [2,2]
    scaled = vmul(scores, dk_scale)              # [2,2]
    attn = softmax_rows(scaled, 2)               # [2,2]
    context = matmul(attn, v, 2, 2, 8)           # [2,8]

    attn_ob = vadd_bias(matmul(context, wo, 2, 8, 8), bo)   # [2,8]
    resid1 = vadd(I, attn_ob)
    ln2 = layernorm(resid1, 8, ln2_s, ln2_o, 1e-5)
    h1b = vadd_bias(matmul(ln2, wf1, 2, 8, 8), bf1)
    a1 = [gelu(x) for x in h1b]
    h2b = vadd_bias(matmul(a1, wf2, 2, 8, 8), bf2)
    resid2 = vadd(ln2, h2b)
    ln3 = layernorm(resid2, 8, ln3_s, ln3_o, 1e-5)

    residual = vsub(ln3, T)
    return sum(x * x for x in residual) / 16.0


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
