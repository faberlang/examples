#!/usr/bin/env python3
# =============================================================================
# oracle/tools/extract_reference.py — rebuild the JSON reference files from a
# fresh capture.txt (S6-U8, extended exit-gate schema)
# =============================================================================
#
# Re-derives the reference JSON files from the marker/value stream of
# oracle/capture.txt. The captured tensor values are the stepper's verbatim
# Display strings (the f64 shortest round-trip decimals) — this extractor
# never reformats or re-parses them as floats, so the tensor references
# round-trip exactly. The only DERIVED values (gradient L2 norms and softmax
# row sums) are computed from the captured tensors with a documented formula
# and stored as Python shortest-round-trip f64 reprs.
#
# Marker schema (see oracle/README.md "Capture schema"):
#   initial_<name>     → inputs.json (all 21 tensors)
#   step_loss          → loss-trace.json (8 values, step order)
#   intermediate_<name>→ intermediates.json per step: ln1, scores, attn,
#                        context, ln2, ln3 (the selected LayerNorm / score /
#                        softmax / context exit-gate intermediates)
#   grad_<name>        → gradients.json per step (TRAINABLE 18 slots only, in
#                        slot order wq,bq,…,ln3_o; frozen grad_input /
#                        grad_dk_scale / grad_target stay in capture.txt) AND
#                        gradients-full.json (all 21 slots + per-tensor L2
#                        norm, formula sqrt(sum(x_i^2)))
#   update_<name>      → update-states.json (the 18 trainable tensors after
#                        each SGD step — all 8 parameter-update states)
#   final_<name>       → final-params.json (the 18 trainable tensors)
#   softmax row sums   → row-sums.json per step (sum of each of the 2 rows of
#                        the captured intermediate_attn tensor)
#
# The fixture's trailing `nota loss_trace` prints the aggregate loss list
# WITHOUT a marker prefix — a stray value line with no pending marker is
# skipped (the per-step `step_loss` values already carry the trace).
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
import math
import os
import sys

TRAINABLE = ["wq", "bq", "wk", "bk", "wv", "bv", "wo", "bo",
             "wf1", "bf1", "wf2", "bf2",
             "ln1_s", "ln1_o", "ln2_s", "ln2_o", "ln3_s", "ln3_o"]
FROZEN = ["input", "dk_scale", "target"]
ALL_21 = TRAINABLE + FROZEN
SHAPES = {
    "input": [2, 8], "wq": [8, 8], "bq": [8], "wk": [8, 8], "bk": [8],
    "wv": [8, 8], "bv": [8], "wo": [8, 8], "bo": [8], "wf1": [8, 8],
    "bf1": [8], "wf2": [8, 8], "bf2": [8], "ln1_s": [8], "ln1_o": [8],
    "ln2_s": [8], "ln2_o": [8], "ln3_s": [8], "ln3_o": [8],
    "dk_scale": [2, 2], "target": [2, 8],
    "ln1": [2, 8], "scores": [2, 2], "attn": [2, 2], "context": [2, 8],
    "ln2": [2, 8], "ln3": [2, 8],
}
INTERMEDIATES = ["ln1", "scores", "attn", "context", "ln2", "ln3"]
RULE_LOSS = "|a-b| <= 1e-6 + 1e-6*|b| (numeric-policy v1.0.0 reduction scalar), all finite"
RULE_GRAD = "|a-b| <= 1e-4 + 1e-4*|b| (numeric-policy v1.0.0 gradient tensors), all finite"
RULE_ELEM = "|a-b| <= 1e-6 + 1e-5*|b| (numeric-policy v1.0.0 elementwise), all finite"
RULE_MATMUL = "|a-b| <= 1e-5 + 1e-5*|b| (numeric-policy v1.0.0 matmul), all finite"
METHOD = "air-generated CPU companion (@ radix backward), FMIR stepper"
SOURCE = "src/train.fab (pinned, read-only)"
NORM_RULE = "L2 norm = sqrt(sum(x_i^2)) over the captured tensor; derived reference"
ROWSUM_RULE = "softmax row sum = sum of the captured intermediate_attn row; derived reference"


def parse_tensor_values(line: str):
    """The flat row-major list on one line — split on commas, verbatim."""
    body = line.strip().strip("[]")
    if not body.strip():
        return []
    return [tok.strip() for tok in body.split(",")]


def l2_norm(values) -> str:
    """L2 norm sqrt(sum(x_i^2)) over the captured values (derived, f64)."""
    acc = 0.0
    for v in values:
        acc += float(v) * float(v)
    return repr(math.sqrt(acc))


def row_sums(values, dim):
    """Sum of each row (last-axis groups of length `dim`) — derived, f64."""
    out = []
    for base in range(0, len(values), dim):
        row = values[base:base + dim]
        out.append(repr(sum(float(v) for v in row)))
    return out


def load_capture(capture_txt: str):
    """Parse the marker/value stream into an ordered event list.

    Markers are bare lowercase identifiers; the value line that follows is
    either a `[...]` list (tensors) or a bare decimal (scalars such as the
    per-step `step_loss`). A stray value line with no pending marker (the
    trailing `loss_trace` aggregate) is skipped.
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
            continue
        if pending is not None:
            raise RuntimeError(f"marker {pending!r} has no value line")
        pending = stripped
    if pending is not None:
        raise RuntimeError(f"marker {pending!r} has no value line")
    return events


def tensor(name: str, values):
    return {"name": name, "shape": SHAPES[name], "values": values}


def main() -> int:
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ap = argparse.ArgumentParser(
        description="Rebuild the bert-tiny-fragment JSON reference files from capture.txt")
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

    initial = {}
    losses = []
    steps = []          # gradients (18 trainable) per step
    full_steps = []     # gradients (21) + norms per step
    inter_steps = []    # selected intermediates per step
    update_steps = []   # 18 parameter-update states per step
    rowsum_steps = []   # softmax row sums per step
    finals = {}

    current_step = None
    current_inter = None
    current_grads = {}
    current_updates = {}
    current_rowsums = None

    for marker, value in events:
        if marker.startswith("initial_"):
            name = marker[len("initial_"):]
            initial[name] = parse_tensor_values(value)
        elif marker == "step_loss":
            losses.append(value)
            current_step = {"step": len(steps), "gradients": []}
            current_inter = {}
            current_grads = {}
            current_updates = {}
            current_rowsums = None
        elif marker.startswith("intermediate_"):
            name = marker[len("intermediate_"):]
            current_inter[name] = parse_tensor_values(value)
            if name == "ln3":
                # ln3 is the last intermediate marker of the step.
                inter_steps.append({"step": len(inter_steps), "intermediates": [
                    tensor(n, current_inter[n]) for n in INTERMEDIATES
                ]})
                # Softmax row sums: each row of the [2,2] attn tensor.
                attn = current_inter["attn"]
                current_rowsums = row_sums(attn, 2)
                rowsum_steps.append({"step": len(rowsum_steps), "row_sums": current_rowsums})
        elif marker.startswith("grad_"):
            name = marker[len("grad_"):]
            current_grads[name] = parse_tensor_values(value)
            if name == "target":
                # All 21 slots are in; commit this step's gradient records.
                ordered_train = [tensor(n, current_grads[n]) for n in TRAINABLE]
                current_step["gradients"] = ordered_train
                steps.append(current_step)
                full = [tensor(n, current_grads[n]) for n in ALL_21]
                full_steps.append({
                    "step": len(full_steps),
                    "gradients": full,
                    "norms": {n: l2_norm(current_grads[n]) for n in ALL_21},
                })
                current_step = None
                current_grads = {}
        elif marker.startswith("update_"):
            name = marker[len("update_"):]
            current_updates[name] = parse_tensor_values(value)
            if name == "ln3_o":
                update_steps.append({"step": len(update_steps), "params": [
                    tensor(n, current_updates[n]) for n in TRAINABLE
                ]})
                current_updates = {}
        elif marker.startswith("final_"):
            name = marker[len("final_"):]
            finals[name] = parse_tensor_values(value)

    if len(steps) != len(losses):
        print(f"error: {len(steps)} gradient steps but {len(losses)} losses",
              file=sys.stderr)
        return 1
    if len(losses) < 1:
        print("error: no step_loss markers in capture.txt", file=sys.stderr)
        return 1
    if len(steps) != len(inter_steps) or len(steps) != len(update_steps):
        print(f"error: step counts disagree (losses={len(losses)} "
              f"grads={len(steps)} inter={len(inter_steps)} update={len(update_steps)})",
              file=sys.stderr)
        return 1
    if len(rowsum_steps) != len(steps):
        print(f"error: row-sum steps {len(rowsum_steps)} != gradient steps {len(steps)}",
              file=sys.stderr)
        return 1

    # Shape sanity: every captured tensor must match its pinned shape.
    def check_count(t: dict) -> None:
        n = 1
        for d in t["shape"]:
            n *= d
        if len(t["values"]) != n:
            raise RuntimeError(
                f"{t['name']} has {len(t['values'])} values, expected {n}")

    for name in ALL_21:
        check_count(tensor(name, initial[name]))
    for s in inter_steps:
        for t in s["intermediates"]:
            check_count(t)
    for s in full_steps:
        for t in s["gradients"]:
            check_count(t)
    for s in update_steps:
        for t in s["params"]:
            check_count(t)

    write_json(out_dir, "inputs.json", {
        "fixture": "bert-tiny-fragment",
        "source": SOURCE,
        "inputs": [tensor(n, initial[n]) for n in ALL_21],
    })
    write_json(out_dir, "loss-trace.json", {
        "fixture": "bert-tiny-fragment",
        "steps": len(losses),
        "lr": "0.01",
        "losses": losses,
        "rule": RULE_LOSS,
    })
    write_json(out_dir, "gradients.json", {
        "fixture": "bert-tiny-fragment",
        "rule": RULE_GRAD,
        "method": METHOD,
        "steps": steps,
    })
    write_json(out_dir, "gradients-full.json", {
        "fixture": "bert-tiny-fragment",
        "rule": RULE_GRAD,
        "method": METHOD,
        "norm": NORM_RULE,
        "steps": full_steps,
    })
    write_json(out_dir, "final-params.json", {
        "fixture": "bert-tiny-fragment",
        "after_steps": len(steps),
        "final_params": [tensor(n, finals[n]) for n in TRAINABLE],
    })
    write_json(out_dir, "intermediates.json", {
        "fixture": "bert-tiny-fragment",
        "steps": len(steps),
        "intermediates": inter_steps,
        "families": {
            "ln1": RULE_ELEM + " (LayerNorm output)",
            "scores": RULE_MATMUL + " (scaled attention scores, pre-softmax)",
            "attn": RULE_ELEM + " (softmax weights)",
            "context": RULE_MATMUL + " (attn@V)",
            "ln2": RULE_ELEM + " (LayerNorm output)",
            "ln3": RULE_ELEM + " (LayerNorm output)",
        },
    })
    write_json(out_dir, "update-states.json", {
        "fixture": "bert-tiny-fragment",
        "after_steps": len(steps),
        "rule": RULE_ELEM,
        "states": update_steps,
    })
    write_json(out_dir, "row-sums.json", {
        "fixture": "bert-tiny-fragment",
        "steps": len(steps),
        "rule": ROWSUM_RULE,
        "row_sums": rowsum_steps,
    })

    print(f"wrote inputs / loss-trace / gradients / gradients-full / final-params / "
          f"intermediates / update-states / row-sums ({len(steps)} steps) from {capture_txt}")
    return 0


def write_json(out_dir: str, name: str, data) -> None:
    path = os.path.join(out_dir, name)
    with open(path, "w") as fh:
        fh.write(json.dumps(data, indent=2) + "\n")


if __name__ == "__main__":
    sys.exit(main())
