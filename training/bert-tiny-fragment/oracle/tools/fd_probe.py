#!/usr/bin/env python3
# =============================================================================
# oracle/tools/fd_probe.py — regenerate oracle/fd-validation.json (S0-C)
# =============================================================================
#
# Method (frozen N1.9, stage-0-delivery.md §2): central difference,
# eps = 1.0e-3, per-element perturbation of the ACTUAL faber computation.
# The capture runner (oracle/capture.fab) is reused as the probe:
#
#   for each element e of each TRAINABLE tensor recorded in gradients.json:
#     - write a copy of capture.fab whose data_<name> initial list has element
#       e perturbed by +eps, run `faber run -t fmir <copy>`, read the step-0
#       loss from the marker stream
#     - repeat with -eps
#     fd = (L(x+eps) - L(x-eps)) / (2*eps)
#   compare fd to the companion gradient (gradients.json, step 0) under the
#   N1.9 gradient rule  |fd - companion| <= 1e-4 + 1e-4*|companion|.
#
# gradients.json records the TRAINABLE tensors only (e.g. LR: weight, bias;
# MLP: weight1, bias1, weight2, bias2; BERT: the 18 trainable tensors).
# Frozen-slot gradients (input/target/dk_scale) exist only in capture.txt and
# are not FD-checked here.
#
# Requires a `faber` that builds this fixture (GELU-capable — needs the radix
# R-W1 fix, radix commit 4197839e9; see oracle/README.md "Regeneration" for
# the verified binary). Pass `--faber PATH` if faber is not on PATH.
#
# Usage:
#   python3 tools/fd_probe.py [oracle_dir] [--eps 1e-3] [--faber PATH]
#                             [--output PATH] [--dry-run]
#   oracle_dir  defaults to the parent of the tools/ directory.
#   --dry-run   parse and check the data lists but do not run faber.
#   --output    file to write (default: oracle_dir/fd-validation.json).
#
# Exit codes:
#   0  regenerated, all elements pass
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
RULE = "|a-b| <= 1e-4 + 1e-4*|b| (N1.9 gradient tolerances)"
METHOD = "central difference, eps=1e-3 (N1.9)"

# A `fixum lista<f32> data_<name> ← [...]` block; the list body never contains
# nested brackets, so the non-greedy match up to the first `]` is exact.
BLOCK_RE = re.compile(r"fixum\s+lista<f32>\s+data_(\w+)\s*←\s*\[(.*?)\]", re.S)


def parse_elem(s: str) -> float:
    """Parse one f32-list element. Negatives are written `0.0 - v` (radix
    lexical limitation; see the train.fab headers)."""
    s = s.strip()
    if " - " in s:
        a, b = s.split(" - ", 1)
        return float(a) - float(b)
    return float(s)


def fmt_elem(v: float) -> str:
    """Format a list value for capture.fab. Negatives must keep the `0.0 - v`
    form; the written decimal is the shortest f64 round-trip of the perturbed
    value (the FMIR stepper computes float math in f64)."""
    if v == 0.0:
        return "0.0"
    if v < 0.0:
        return f"0.0 - {repr(abs(v))}"
    return repr(v)


def parse_blocks(src: str) -> dict:
    """Return {data_<name>: (start, end, [values])} for every data list."""
    blocks = {}
    for m in BLOCK_RE.finditer(src):
        name = "data_" + m.group(1)
        body = m.group(2)
        vals = [parse_elem(x) for x in body.split(",") if x.strip()]
        blocks[name] = (m.start(), m.end(), vals)
    return blocks


def parse_loss0(stdout: str) -> float:
    """Read the first `step_loss` value from the capture marker stream."""
    lines = stdout.splitlines()
    for i, line in enumerate(lines):
        if line.strip() == "step_loss":
            return float(lines[i + 1].strip())
    raise RuntimeError("no step_loss marker in faber output")


def loss0_from_capture(capture_txt: str) -> float:
    """Read the first `step_loss` value from oracle/capture.txt."""
    with open(capture_txt) as fh:
        return parse_loss0(fh.read())


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
    return parse_loss0(proc.stdout)


def main() -> int:
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ap = argparse.ArgumentParser(description="Regenerate oracle/fd-validation.json (S0-C)")
    ap.add_argument("oracle_dir", nargs="?", default=here)
    ap.add_argument("--eps", type=float, default=EPS)
    ap.add_argument("--faber", default="faber")
    ap.add_argument("--output", default=None)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    oracle_dir = os.path.abspath(args.oracle_dir)
    package_dir = os.path.dirname(oracle_dir)
    capture_fab = os.path.join(oracle_dir, "capture.fab")
    capture_txt = os.path.join(oracle_dir, "capture.txt")
    gradients_json = os.path.join(oracle_dir, "gradients.json")
    for path in (capture_fab, capture_txt, gradients_json):
        if not os.path.isfile(path):
            print(f"error: missing {path}", file=sys.stderr)
            return 1

    eps = args.eps
    grads = json.load(open(gradients_json))
    fixture = grads["fixture"]
    step0 = grads["steps"][0]["gradients"]
    loss0 = loss0_from_capture(capture_txt)

    src = open(capture_fab).read()
    blocks = parse_blocks(src)

    # Sanity: every trainable tensor must have a data list of matching size.
    for tensor in step0:
        name = "data_" + tensor["name"]
        if name not in blocks:
            print(f"error: no {name} list in capture.fab (trainable {tensor['name']})",
                  file=sys.stderr)
            return 1
        n = 1
        for d in tensor["shape"]:
            n *= d
        if len(blocks[name][2]) != n:
            print(f"error: {name} has {len(blocks[name][2])} values, expected {n}",
                  file=sys.stderr)
            return 1

    params_out = {}
    failures = []
    total = 0
    total_pass = 0
    worst = 0.0

    if args.dry_run:
        names = ", ".join(t["name"] for t in step0)
        print(f"[dry-run] {fixture}: {len(step0)} trainable tensors ({names}); "
              f"loss0={loss0!r}; no faber runs performed")
        return 0

    with tempfile.TemporaryDirectory() as tmp:
        run_counter = 0
        for tensor in step0:
            tname = tensor["name"]
            data_name = "data_" + tname
            base_vals = list(blocks[data_name][2])
            companion = [float(v) for v in tensor["values"]]
            elements = []
            for idx, x in enumerate(base_vals):
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
                    failures.append({"param": tname, "index": idx, "fd": fd,
                                     "companion": comp, "delta": delta, "tol": tol})
            params_out[tname] = {
                "elements": elements,
                "checked": len(elements),
                "pass": sum(1 for e in elements if e["pass"]),
            }

    result = {
        "fixture": fixture,
        "method": METHOD,
        "rule": RULE,
        "loss0": loss0,
        "elements_checked": total,
        "elements_pass": total_pass,
        "worst_delta": worst,
        "params": params_out,
        "failures": failures,
    }

    output = args.output or os.path.join(oracle_dir, "fd-validation.json")
    with open(output, "w") as fh:
        fh.write(json.dumps(result, indent=2) + "\n")
    print(f"wrote {output}: {total_pass}/{total} elements pass "
          f"(worst delta {worst:.6g})")

    if failures:
        print(f"FAIL: {len(failures)} element(s) outside the N1.9 gradient rule; "
              f"see \"failures\" in {output}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
