#!/usr/bin/env python3
# =============================================================================
# oracle/tools/extract_reference.py — rebuild the JSON reference files from a
# fresh capture.txt (S5-U7)
# =============================================================================
#
# Re-derives inputs.json, loss-trace.json, gradients.json, and
# final-params.json from the marker/value stream of oracle/capture.txt. The
# JSON files store the stepper's verbatim Display strings (the f64 shortest
# round-trip decimals) — this extractor never reformats or re-parses them as
# floats, so the reference round-trips exactly.
#
# Marker schema (see oracle/README.md "Capture schema"):
#   initial_<name>  → inputs.json (all six: input, weight1, bias1, weight2,
#                     bias2, target)
#   step_loss       → loss-trace.json (100 values, step order)
#   grad_<name>     → gradients.json per step (TRAINABLE slots only, in
#                     slot order weight1, bias1, weight2, bias2; frozen
#                     grad_input / grad_target stay in capture.txt only)
#   final_<name>    → final-params.json (trainable four)
#
# Usage:
#   python3 tools/extract_reference.py [oracle_dir] [--output DIR]
#   oracle_dir  defaults to the parent of the tools/ directory.
#
# Exit codes: 0 = regenerated; 1 = error (missing capture.txt or malformed
# marker stream).
# =============================================================================
import argparse
import json
import os
import sys

TRAINABLE = ["weight1", "bias1", "weight2", "bias2"]
SHAPE = [4, 4]
RULE_LOSS = "|a-b| <= 1e-6 + 1e-6*|b| (N1.9 reduction scalar), all finite"
RULE_GRAD = "|a-b| <= 1e-4 + 1e-4*|b| (N1.9 gradient tolerances), all finite"
METHOD = "air-generated CPU companion (@ radix backward), FMIR stepper"
SOURCE = "src/train.fab (pinned, read-only)"


def parse_tensor_values(line: str):
    """The flat row-major list on one line — split on commas, verbatim."""
    body = line.strip().strip("[]")
    if not body.strip():
        return []
    return [tok.strip() for tok in body.split(",")]


def load_capture(capture_txt: str):
    """Parse the marker/value stream into an ordered event list.

    Markers are bare lowercase identifiers; the value line that follows is
    either a `[...]` list (tensors) or a bare decimal (scalars such as the
    per-step `step_loss`). The fixture's trailing `nota loss_trace` prints
    the aggregate loss list WITHOUT a marker prefix (the S0-C "byte-identical
    suffix" cross-check) — a stray value line with no pending marker is
    skipped, since the per-step `step_loss` values already carry the trace.
    """
    def is_value(line: str) -> bool:
        if line.startswith("["):
            return True
        try:
            float(line)
            return True
        except ValueError:
            return False

    events = []
    pending = None
    for raw in open(capture_txt).read().splitlines():
        stripped = raw.strip()
        if stripped == "":
            continue
        if is_value(stripped):
            if pending is not None:
                events.append((pending, stripped))
                pending = None
            # else: stray value line (the trailing loss_trace aggregate) — skip.
            continue
        if pending is not None:
            raise RuntimeError(f"marker {pending!r} has no value line")
        pending = stripped
    if pending is not None:
        raise RuntimeError(f"marker {pending!r} has no value line")
    return events


def tensor(name: str, values):
    return {"name": name, "shape": SHAPE, "values": values}


def main() -> int:
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ap = argparse.ArgumentParser(description="Rebuild the mlp JSON reference files from capture.txt")
    ap.add_argument("oracle_dir", nargs="?", default=here)
    ap.add_argument("--output", default=None, help="output directory (default: oracle_dir)")
    args = ap.parse_args()

    oracle_dir = os.path.abspath(args.oracle_dir)
    out_dir = os.path.abspath(args.output) if args.output else oracle_dir
    capture_txt = os.path.join(oracle_dir, "capture.txt")
    if not os.path.isfile(capture_txt):
        print(f"error: missing {capture_txt}", file=sys.stderr)
        return 1

    events = load_capture(capture_txt)

    # Initial inputs (all six), in a stable order.
    initial = {}
    losses = []
    steps = []
    finals = {}
    current_step = None
    current_grads = {}
    for marker, value in events:
        if marker.startswith("initial_"):
            initial[marker[len("initial_"):]] = parse_tensor_values(value)
        elif marker == "step_loss":
            losses.append(value)
        elif marker.startswith("grad_"):
            name = marker[len("grad_"):]
            if current_step is None:
                current_step = {"step": len(steps), "gradients": []}
                current_grads = {}
            current_grads[name] = parse_tensor_values(value)
            if name == "target":
                # The capture emits all six slots in a fixed order ending with
                # grad_target; the trainable four are recorded.
                ordered = [tensor(n, current_grads[n]) for n in TRAINABLE]
                current_step["gradients"] = ordered
                steps.append(current_step)
                current_step = None
                current_grads = {}
        elif marker.startswith("final_"):
            finals[marker[len("final_"):]] = parse_tensor_values(value)

    if len(steps) != len(losses):
        print(
            f"error: {len(steps)} gradient steps but {len(losses)} losses",
            file=sys.stderr,
        )
        return 1
    if len(steps) < 1:
        print("error: no step_loss markers in capture.txt", file=sys.stderr)
        return 1

    inputs = [tensor(name, initial[name]) for name in
              ["input", "weight1", "bias1", "weight2", "bias2", "target"]]
    for t in inputs:
        if len(t["values"]) != 16:
            print(f"error: initial {t['name']} has {len(t['values'])} values, expected 16",
                  file=sys.stderr)
            return 1

    write_json(out_dir, "inputs.json", {
        "fixture": "mlp",
        "source": SOURCE,
        "inputs": inputs,
    })
    write_json(out_dir, "loss-trace.json", {
        "fixture": "mlp",
        "steps": len(losses),
        "lr": "0.1",
        "losses": losses,
        "rule": RULE_LOSS,
    })
    write_json(out_dir, "gradients.json", {
        "fixture": "mlp",
        "rule": RULE_GRAD,
        "method": METHOD,
        "steps": steps,
    })
    write_json(out_dir, "final-params.json", {
        "fixture": "mlp",
        "after_steps": len(steps),
        "final_params": [tensor(name, finals[name]) for name in TRAINABLE],
    })

    print(f"wrote inputs.json / loss-trace.json / gradients.json / final-params.json "
          f"({len(steps)} steps) from {capture_txt}")
    return 0


def write_json(out_dir: str, name: str, data) -> None:
    path = os.path.join(out_dir, name)
    with open(path, "w") as fh:
        fh.write(json.dumps(data, indent=2) + "\n")


if __name__ == "__main__":
    sys.exit(main())
