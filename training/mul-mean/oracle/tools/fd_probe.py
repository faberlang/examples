#!/usr/bin/env python3
# =============================================================================
# oracle/tools/fd_probe.py — regenerate oracle/fd-validation.json (S3-B1)
# =============================================================================
#
# Method (numeric-policy v1.0.0 §4, frozen): central difference,
# eps = 1.0e-3 (FINITE_DIFFERENCE_EPSILON), per-element perturbation of the
# ACTUAL faber computation. The capture runner (oracle/capture.fab) is
# reused as the probe:
#
#   for each sampled element e of each gradient slot recorded in
#   gradients.json:
#     - write a copy of capture.fab whose data_<slot> initial list has
#       element e perturbed by +eps, run `faber run -t fmir <copy>`, read the
#       `loss` value from the marker stream
#     - repeat with -eps
#     fd = (L(x+eps) - L(x-eps)) / (2*eps)
#   compare fd to the pinned companion gradient (gradients.json) under the
#   numeric-policy v1.0.0 gradient row |fd - companion| <= 1e-4 + 1e-4*|b|.
#
# Slot / perturbation mapping (loss = mean(x · w)):
#   grad_x  = dL/dx = w/N  -> perturb data_x
#   grad_w  = dL/dw = x/N  -> perturb data_w
#
# FD is a SPOT check over a deterministic sample of elements per slot (first,
# last, and the arithmetic spread in between) — the full-coverage oracle
# self-check is the exact-analytic leg in tools/honesty_check.py. Every faber
# run perturbs one element only, so the probe is O(samples) runs, not O(N).
#
# Requires the PINNED faber binary (N3.8 — the on-PATH/stale debug build is
# NOT acceptable). Pass --faber PATH.
#
# Usage:
#   python3 tools/fd_probe.py [oracle_dir] [--eps 1e-3] [--faber PATH]
#                             [--samples 12] [--output PATH] [--dry-run]
#
# Exit codes:
#   0  regenerated, all sampled elements pass
#   2  regenerated but some elements FAIL (file still written; see "failures")
#   1  error (missing inputs, faber failure, mismatch)
# =============================================================================
import argparse
import json
import math
import os
import re
import subprocess
import sys
import tempfile

EPS = 1.0e-3
ATOL = 1.0e-4
RTOL = 1.0e-4
RULE = "|a-b| <= 1e-4 + 1e-4*|b| (numeric-policy v1.0.0 gradient row)"
METHOD = "central difference, eps=1e-3 (numeric-policy v1.0.0 §4)"

BLOCK_RE = re.compile(r"fixum\s+lista<f32>\s+data_(\w+)\s*←\s*\[(.*?)\]", re.S)


def parse_elem(s: str) -> float:
    s = s.strip()
    if " - " in s:
        a, b = s.split(" - ", 1)
        return float(a) - float(b)
    return float(s)


def fmt_elem(v: float) -> str:
    """Shortest f64 round-trip (the stepper computes float math in f64)."""
    if v == 0.0:
        return "0.0"
    if v < 0.0:
        return f"0.0 - {repr(abs(v))}"
    return repr(v)


def parse_blocks(src: str) -> dict:
    blocks = {}
    for m in BLOCK_RE.finditer(src):
        name = "data_" + m.group(1)
        body = m.group(2)
        vals = [parse_elem(x) for x in body.split(",") if x.strip()]
        blocks[name] = (m.start(), m.end(), vals)
    return blocks


def parse_loss(stdout: str) -> float:
    lines = stdout.splitlines()
    for i, line in enumerate(lines):
        if line.strip() == "loss":
            return float(lines[i + 1].strip())
    raise RuntimeError("no `loss` marker in faber output")


def run_faber(faber: str, fab_file: str, cwd: str) -> float:
    proc = subprocess.run(
        [faber, "run", "-t", "fmir", fab_file],
        capture_output=True,
        text=True,
        cwd=cwd,
    )
    if proc.returncode != 0:
        detail = (proc.stderr or proc.stdout).strip().splitlines()
        raise RuntimeError(
            f"faber run failed on {os.path.basename(fab_file)} "
            f"(exit {proc.returncode}): {(detail or ['?'])[-3:] if detail else 'no output'}"
        )
    return parse_loss(proc.stdout)


def sample_indices(n: int, count: int) -> list:
    """Deterministic spread: 0, n-1, and count-2 evenly spaced interior
    indices (first + last always included so the gradient floor is probed at
    both extremes)."""
    idx = {0, n - 1}
    for k in range(1, count - 1):
        idx.add(round(k * (n - 1) / (count - 1)))
    return sorted(idx)


def main() -> int:
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ap = argparse.ArgumentParser(description="Regenerate oracle/fd-validation.json (S3-B1)")
    ap.add_argument("oracle_dir", nargs="?", default=here)
    ap.add_argument("--eps", type=float, default=EPS)
    ap.add_argument("--faber", default="faber")
    ap.add_argument("--samples", type=int, default=12)
    ap.add_argument("--output", default=None)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    oracle_dir = os.path.abspath(args.oracle_dir)
    package_dir = os.path.dirname(oracle_dir)
    capture_fab = os.path.join(oracle_dir, "capture.fab")
    gradients_json = os.path.join(oracle_dir, "gradients.json")
    for path in (capture_fab, gradients_json):
        if not os.path.isfile(path):
            print(f"error: missing {path}", file=sys.stderr)
            return 1

    eps = args.eps
    grads = json.load(open(gradients_json))
    fixture = grads["fixture"]
    step0 = grads["steps"][0]["gradients"]
    slot_of = {t["name"]: t for t in step0}

    src = open(capture_fab).read()
    blocks = parse_blocks(src)
    for slot in ("grad_x", "grad_w"):
        name = "data_" + ("x" if slot == "grad_x" else "w")
        if name not in blocks:
            print(f"error: no {name} list in capture.fab (slot {slot})",
                  file=sys.stderr)
            return 1
        if slot not in slot_of:
            print(f"error: gradients.json has no {slot} slot", file=sys.stderr)
            return 1

    failures = []
    total = 0
    total_pass = 0
    worst = 0.0
    params_out = {}

    if args.dry_run:
        print(f"[dry-run] {fixture}: slots {list(slot_of)}; "
              f"samples/slot={args.samples} (indices "
              f"{sample_indices(len(blocks['data_x'][2]), args.samples)}); "
              f"no faber runs performed")
        return 0

    with tempfile.TemporaryDirectory() as tmp:
        run_counter = 0
        for slot in ("grad_x", "grad_w"):
            data_name = "data_" + ("x" if slot == "grad_x" else "w")
            base_vals = list(blocks[data_name][2])
            n = len(base_vals)
            companion = [float(v) for v in slot_of[slot]["values"]]
            if len(companion) != n:
                print(f"error: {slot} has {len(companion)} values, expected {n}",
                      file=sys.stderr)
                return 1
            elements = []
            for idx in sample_indices(n, args.samples):
                x = base_vals[idx]
                losses = {}
                for sign in (+1.0, -1.0):
                    perturbed = list(base_vals)
                    perturbed[idx] = x + sign * eps
                    new_src = (
                        src[: blocks[data_name][0]]
                        + f"fixum lista<f32> {data_name} ← "
                        + "[" + ", ".join(fmt_elem(v) for v in perturbed) + "]"
                        + src[blocks[data_name][1]:]
                    )
                    run_counter += 1
                    fab_file = os.path.join(tmp, f"probe_{run_counter:04d}.fab")
                    with open(fab_file, "w") as fh:
                        fh.write(new_src)
                    losses[sign] = run_faber(args.faber, fab_file, package_dir)

                fd = (losses[+1.0] - losses[-1.0]) / (2.0 * eps)
                comp = companion[idx]
                delta = abs(fd - comp)
                tol = ATOL + RTOL * abs(comp)
                ok = math.isfinite(fd) and math.isfinite(comp) and delta <= tol
                elements.append({
                    "index": idx,
                    "fd": fd,
                    "companion": comp,
                    "delta": delta,
                    "tol": tol,
                    "pass": ok,
                })
                total += 1
                total_pass += 1 if ok else 0
                worst = max(worst, delta)
                if not ok:
                    failures.append({"param": slot, "index": idx, "fd": fd,
                                     "companion": comp, "delta": delta,
                                     "tol": tol})
            params_out[slot] = {
                "elements": elements,
                "checked": len(elements),
                "pass": sum(1 for e in elements if e["pass"]),
            }

    result = {
        "fixture": fixture,
        "method": METHOD,
        "rule": RULE,
        "sample": "deterministic spread (first/last + evenly spaced interior)",
        "elements_checked": total,
        "elements_pass": total_pass,
        "worst_delta": worst,
        "params": params_out,
        "failures": failures,
    }

    output = args.output or os.path.join(oracle_dir, "fd-validation.json")
    with open(output, "w") as fh:
        fh.write(json.dumps(result, indent=2) + "\n")
    print(f"wrote {output}: {total_pass}/{total} sampled elements pass "
          f"(worst delta {worst:.6g})")

    if failures:
        print(f"FAIL: {len(failures)} sampled element(s) outside the "
              f"numeric-policy gradient row; see \"failures\" in {output}",
              file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
