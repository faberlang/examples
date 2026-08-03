#!/usr/bin/env python3
# =============================================================================
# oracle/tools/honesty_check.py — the S3-B1 honesty gate (C3)
# =============================================================================
#
# Proves that the mul-mean fixture inputs are NON-structurally-exact and
# REJECTS a structurally-exact alternative (half-integer × power-of-two
# pattern, delta-0 oracle). This is the unit check behind stage-3-delivery.md
# §4 S3-B1 done_when items 1 and 4 (the S0-D exactness pattern must NOT be
# reproduced; see stage-3-delivery.md N3.7).
#
#   usage: honesty_check.py [--capture oracle/capture.fab]
#                           [--gradients oracle/gradients.json]
#
# Defaults are the committed fixture paths (run from the package directory).
#
# Checks (all must hold for ACCEPT):
#   1.  Wide reduction:  N >= 512 and N is not a power of two.
#   2.  No input element is exactly representable in f32 (inputs are
#       non-half-integer / non-dyadic).
#   3.  NO analytic gradient element (grad_w[i] = x[i]/N, grad_x[i] = w[i]/N)
#       is exactly representable in f32 — proven in EXACT rational arithmetic
#       (a reduced fraction is f32-representable iff its denominator is a
#       power of two and its magnitude is within the f32 range), so no f32
#       rounding accident can mask the argument.
#   4.  The f32 forward mean of x·w differs from the exact mean (the wide
#       mean/accumulation sums exercise the gradient floor: non-zero
#       rounding, never delta-0).
#   5.  Oracle self-check (when --gradients is given): the pinned companion
#       gradients match the independent exact-analytic reference under the
#       numeric-policy v1.0.0 gradient row (|a-b| <= 1e-4 + 1e-4*|b|,
#       numeric-policy.md §2/§3.1), every element finite, and at least one
#       observed/reference delta is non-zero.
#
# Exit codes: 0 = ACCEPT (honest non-exact fixture), 2 = REJECT (structurally
# exact — the inadmissible S0-D pattern), 1 = error (malformed input, oracle
# mismatch).
# =============================================================================
import argparse
import json
import math
import os
import re
import struct
import sys
from fractions import Fraction

N_MIN = 512              # documented "wide reduction" floor (S3-B1)
ATOL = 1.0e-4            # numeric-policy v1.0.0 gradient row (R4, council G6)
RTOL = 1.0e-4
RULE = "|a-b| <= 1e-4 + 1e-4*|b| (numeric-policy v1.0.0 gradient row)"

# A `fixum lista<f32> data_<name> ← [...]` block; list bodies never contain
# nested brackets, so the non-greedy match up to the first `]` is exact.
BLOCK_RE = re.compile(r"fixum\s+lista<f32>\s+data_(\w+)\s*←\s*\[(.*?)\]", re.S)


def parse_elem(s: str) -> Fraction:
    """Parse one f32-list element as an EXACT rational. Negatives would be
    written `0.0 - v` (radix lexical form); this fixture has no negatives."""
    s = s.strip()
    if " - " in s:
        a, b = s.split(" - ", 1)
        return Fraction(a.strip()) - Fraction(b.strip())
    return Fraction(s)


def parse_lists(src: str) -> dict:
    blocks = {}
    for m in BLOCK_RE.finditer(src):
        name = m.group(1)
        vals = [parse_elem(x) for x in m.group(2).split(",") if x.strip()]
        blocks[name] = vals
    return blocks


def is_power_of_two(n: int) -> bool:
    return n > 0 and (n & (n - 1)) == 0


def f32_representable(f: Fraction) -> bool:
    """Exact check: f is representable in f32 iff its reduced denominator is
    a power of two and |f| lies within the finite f32 range."""
    if f.denominator & (f.denominator - 1):
        return False  # non-dyadic denominator -> not representable
    if f == 0:
        return True
    return 1.0e-45 <= abs(float(f)) <= 3.4028235e38


def f32(v: float) -> float:
    """Round a Python float through f32 (round-to-nearest-even)."""
    return struct.unpack("<f", struct.pack("<f", v))[0]


def main() -> int:
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ap = argparse.ArgumentParser(description="S3-B1 honesty gate (C3)")
    ap.add_argument("--capture", default=os.path.join(here, "capture.fab"))
    ap.add_argument("--gradients", default=os.path.join(here, "gradients.json"))
    ap.add_argument("--no-gradients", action="store_true",
                    help="skip the oracle self-check leg (rejection-probe mode)")
    ap.add_argument("--json", default=os.path.join(here, "honesty-check.json"))
    args = ap.parse_args()

    problems = []          # REJECT (exit 2) reasons — structural exactness
    errors = []            # ERROR (exit 1) reasons — bad input/oracle
    report = {"policy": "numeric-policy v1.0.0", "rule": RULE,
              "atol": ATOL, "rtol": RTOL, "n_min": N_MIN}

    src = open(args.capture).read()
    lists = parse_lists(src)
    if "x" not in lists or "w" not in lists:
        print(f"error: capture {args.capture} lacks data_x/data_w lists",
              file=sys.stderr)
        return 1
    xs, ws = lists["x"], lists["w"]
    if len(xs) != len(ws):
        print("error: data_x/data_w lengths differ", file=sys.stderr)
        return 1
    N = len(xs)
    report["N"] = N

    # 1. Wide reduction, non-power-of-two.
    if N < N_MIN:
        problems.append(f"N={N} < wide-reduction floor {N_MIN}")
    if is_power_of_two(N):
        problems.append(f"N={N} is a power of two (1/N division exact -> "
                        f"structurally-exact-eligible)")
    report["N_wide"] = N >= N_MIN
    report["N_power_of_two"] = is_power_of_two(N)

    # 2. Input representability (non-half-integer / non-dyadic).
    rep_inputs = sum(1 for v in xs if f32_representable(v)) + \
                 sum(1 for v in ws if f32_representable(v))
    report["input_representable_elements"] = rep_inputs
    report["input_elements"] = 2 * N
    if rep_inputs > 0:
        problems.append(f"{rep_inputs}/{2*N} input elements are exactly "
                        f"representable in f32 (half-integer / dyadic inputs "
                        f"-> S0-D pattern)")

    # 3. Gradient representability, EXACT rational arithmetic.
    grads_x = [w / N for w in ws]      # grad_x[i] = w[i]/N
    grads_w = [x / N for x in xs]      # grad_w[i] = x[i]/N
    rep_gx = sum(1 for g in grads_x if f32_representable(g))
    rep_gw = sum(1 for g in grads_w if f32_representable(g))
    report["grad_x_representable_elements"] = rep_gx
    report["grad_w_representable_elements"] = rep_gw
    report["gradient_elements"] = 2 * N
    if rep_gx + rep_gw > 0:
        problems.append(
            f"{rep_gx + rep_gw}/{2*N} analytic gradient elements are exactly "
            f"representable in f32 -> the oracle would be structurally exact "
            f"(delta-0); REJECTED as the S0-D exactness pattern")
    report["representability_proof"] = (
        "gradient elements are exact Fractions; representable iff reduced "
        "denominator is a power of two and magnitude is in the f32 range")

    # 4. f32 forward mean exercises the floor (non-zero rounding).
    s32 = 0.0
    for x, w in zip(xs, ws):
        s32 = f32(s32 + f32(float(x * w)))
    mean32 = f32(s32 / N)
    mean_exact = sum(x * w for x, w in zip(xs, ws)) / N
    fwd_delta = abs(mean32 - float(mean_exact))
    report["forward_mean_f32"] = mean32
    report["forward_mean_exact"] = str(mean_exact)
    report["forward_rounding_delta"] = fwd_delta
    if not (fwd_delta > 0.0):
        problems.append("f32 forward mean equals the exact mean (no rounding "
                        "in the wide accumulation -> delta-0 forward)")

    # 5. Oracle self-check against the independent exact-analytic reference.
    oracle_ok = True
    if not args.no_gradients and args.gradients and os.path.isfile(args.gradients):
        grads = json.load(open(args.gradients))
        steps = grads.get("steps", [])
        if not steps:
            print("error: gradients.json has no steps", file=sys.stderr)
            return 1
        g0 = {t["name"]: t for t in steps[0]["gradients"]}
        expected = {"grad_x": grads_x, "grad_w": grads_w}
        missing = [n for n in expected if n not in g0]
        if missing:
            print(f"error: gradients.json missing slots {missing}",
                  file=sys.stderr)
            return 1
        checked = 0
        worst = 0.0
        non_zero = 0
        finite = True
        per_slot = {}
        for name, ref in expected.items():
            vals = [float(v) for v in g0[name]["values"]]
            if len(vals) != N:
                print(f"error: {name} has {len(vals)} values, expected {N}",
                      file=sys.stderr)
                return 1
            slot_fail = 0
            slot_worst = 0.0
            for idx, (obs, refv) in enumerate(zip(vals, ref)):
                if not (math.isfinite(obs) and math.isfinite(float(refv))):
                    finite = False
                delta = abs(obs - float(refv))
                tol = ATOL + RTOL * abs(float(refv))
                slot_worst = max(slot_worst, delta)
                worst = max(worst, delta)
                checked += 1
                if delta > 0.0:
                    non_zero += 1
                if not (delta <= tol):
                    slot_fail += 1
            per_slot[name] = {"checked": N, "fail": slot_fail,
                              "worst_delta": slot_worst}
            if slot_fail:
                oracle_ok = False
        report["oracle_self_check"] = {
            "method": "pinned CPU companion vs independent exact-analytic "
                      "reference (f64/exact rational)",
            "checked": checked,
            "non_zero_deltas": non_zero,
            "worst_delta": worst,
            "finite": finite,
            "pass": oracle_ok and finite and non_zero > 0,
            "per_slot": per_slot,
        }
        if not finite:
            errors.append("non-finite value in the oracle (numeric-policy §5.1)")
        if not oracle_ok:
            errors.append(f"oracle vs analytic mismatch beyond the gradient "
                          f"row ({RULE})")
        if non_zero == 0:
            problems.append("oracle deltas are all zero (delta-0 reference "
                            "-- structurally exact)")
    else:
        report["oracle_self_check"] = {
            "skipped": "no --gradients file given (rejection-probe mode)",
        }

    report["accepted"] = not problems and not errors
    with open(args.json, "w") as fh:
        fh.write(json.dumps(report, indent=2) + "\n")

    print(f"honesty check: N={N} (wide={N >= N_MIN}, "
          f"power-of-two={is_power_of_two(N)})")
    print(f"  input elements representable in f32: "
          f"{rep_inputs}/{2*N}")
    print(f"  gradient elements representable in f32: "
          f"{rep_gx + rep_gw}/{2*N}")
    print(f"  forward mean: f32={mean32!r} exact={mean_exact!s} "
          f"rounding_delta={fwd_delta:.3e}")
    if report["oracle_self_check"].get("pass") is not None:
        osc = report["oracle_self_check"]
        print(f"  oracle self-check: {osc['checked']} elements, "
              f"{osc['non_zero_deltas']} non-zero deltas, "
              f"worst_delta={osc['worst_delta']:.3e}, "
              f"finite={osc['finite']}, pass={osc['pass']}")
    if problems:
        print("REJECTED (structurally exact / delta-0):", file=sys.stderr)
        for p in problems:
            print(f"  - {p}", file=sys.stderr)
        return 2
    if errors:
        print("ERROR:", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        return 1
    print("ACCEPTED: non-exact oracle, wide reduction, gradient floor "
          "exercised.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
