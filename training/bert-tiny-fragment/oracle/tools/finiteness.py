#!/usr/bin/env python3
# =============================================================================
# oracle/tools/finiteness.py — finite-check over every captured oracle value
# (S6-U8 extended schema; exit-gate "every oracle value finite")
# =============================================================================
#
# Scans every captured value in oracle/capture.txt (the full marker/value
# stream) and every numeric leaf in the JSON reference files, and writes
# oracle/finiteness.json with the pass verdict. Any NaN or ±Inf value is a
# FAIL (numeric-policy v1.0.0: "Any NaN or ±Inf in observed or reference
# value → FAIL").
#
# Usage:
#   python3 tools/finiteness.py [oracle_dir] [--output PATH]
#   oracle_dir  defaults to the parent of the tools/ directory.
#
# Exit codes: 0 = every value finite; 2 = non-finite values found (the
# report is still written); 1 = error.
# =============================================================================
import argparse
import json
import math
import os
import sys

FILES = ["inputs.json", "loss-trace.json", "gradients.json",
         "gradients-full.json", "final-params.json", "intermediates.json",
         "update-states.json", "row-sums.json"]


def finite_leaf(node):
    """True when the JSON leaf is a number or a numeric string and finite."""
    if isinstance(node, bool) or node is None:
        return True  # structural leaf, not a numeric value
    if isinstance(node, (int, float)):
        return math.isfinite(node)
    if isinstance(node, str):
        try:
            return math.isfinite(float(node))
        except ValueError:
            return True  # a marker/name string, not a numeric value
    return True


def is_numeric_leaf(node):
    if isinstance(node, bool) or node is None:
        return False
    if isinstance(node, (int, float)):
        return True
    if isinstance(node, str):
        try:
            float(node)
            return True
        except ValueError:
            return False
    return False


def walk(node, on_leaf):
    """Recursive JSON leaf walker calling on_leaf(value) for numeric leaves."""
    if isinstance(node, dict):
        for value in node.values():
            walk(value, on_leaf)
    elif isinstance(node, list):
        for value in node:
            walk(value, on_leaf)
    else:
        if is_numeric_leaf(node):
            on_leaf(node)


def main() -> int:
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ap = argparse.ArgumentParser(description="Finite-check every captured oracle value")
    ap.add_argument("oracle_dir", nargs="?", default=here)
    ap.add_argument("--output", default=None)
    args = ap.parse_args()

    oracle_dir = os.path.abspath(args.oracle_dir)
    capture_txt = os.path.join(oracle_dir, "capture.txt")

    report = {"fixture": "bert-tiny-fragment",
              "checked": 0,
              "non_finite": 0,
              "pass": True,
              "by_file": {}}

    # capture.txt: every marker/value stream line that is a value (a bare
    # decimal or a `[...]` list). Marker lines are skipped.
    if not os.path.isfile(capture_txt):
        print(f"error: missing {capture_txt}", file=sys.stderr)
        return 1
    report["by_file"]["capture.txt"] = []
    for raw in open(capture_txt).read().splitlines():
        stripped = raw.strip()
        if not stripped:
            continue
        if stripped.startswith("["):
            values = stripped.strip("[]").split(",")
        else:
            try:
                float(stripped)
                values = [stripped]
            except ValueError:
                continue  # a marker line, not a value
        report["checked"] += len(values)
        for v in values:
            try:
                if not math.isfinite(float(v.strip())):
                    report["by_file"]["capture.txt"].append(v.strip())
            except ValueError:
                pass

    for name in FILES:
        path = os.path.join(oracle_dir, name)
        if not os.path.isfile(path):
            print(f"error: missing {path}", file=sys.stderr)
            return 1
        report["by_file"][name] = []
        data = json.load(open(path))
        walk(data, lambda v: (report.__setitem__("checked", report["checked"] + 1),
                              (report["by_file"][name].append(v)
                               if not finite_leaf(v) else None)))

    for file_name, bad in report["by_file"].items():
        report["non_finite"] += len(bad)

    report["pass"] = report["non_finite"] == 0

    output = args.output or os.path.join(oracle_dir, "finiteness.json")
    with open(output, "w") as fh:
        fh.write(json.dumps(report, indent=2) + "\n")
    print(f"wrote {output}: {report['checked']} values checked, "
          f"{report['non_finite']} non-finite -> "
          f"{'PASS' if report['pass'] else 'FAIL'}")

    return 0 if report["pass"] else 2


if __name__ == "__main__":
    sys.exit(main())
