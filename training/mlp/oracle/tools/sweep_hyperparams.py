#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
sweep_hyperparams.py — (steps x lr) hyperparameter sweep for the MLP fixture.

Stage 5 science sweep (Vivi task 9d6b8248, faberlang GPU training campaign):
learning-curve data across the operator grid on the S5-U7 deterministic
CPU/FMIR oracle.

Grid: steps in {100, 500, 1000} x lr in {0.01, 0.05, 0.1} — 9 combos.
Per combo it records loss0, loss_final, all-finite, the convergence step
(first step where loss < 0.1 * loss0, or "none"), and CPU wall-clock of the
capture run. Determinism spot-check: the 1000/0.01 combo runs twice; the two
loss traces (and full captures) must be byte-identical.

How each combo runs (capture convention — oracle/README.md):
  1. Patch in place: src/train.fab and oracle/capture.fab get the lr literal
     and the loop bound (`fixum f32 lr <- <lr>`, `fixum numerus steps <- <n>`);
     faber.toml gets `[device] steps = <n>`. The loop bound and the manifest
     step count MUST match — the step-count validation fails closed.
     (oracle/capture.fab is the instrumented copy of src/train.fab that the
     CPU capture actually executes; it must carry the same lr/steps.)
  2. Run the capture: `faber run -t fmir oracle/capture.fab` from the package
     dir, with FABER_LIBRARY_HOME pointing at the faberlang container root
     (gradus/norma providers). Wall-clock is measured over the whole
     invocation (fmir image build + stepper).
  3. Parse the capture marker stream (step_loss values) and compute the stats.
  4. Restore all three files byte-identical and assert `git diff` is clean in
     the examples repo (hard constraint: the committed acceptance fixture must
     not drift).

Reusability seam (done_when 4): pass `--route device --backend <metal|cuda>`
to run `faber run --backend <backend> .` on the package entry instead of the
fmir capture route; the device route parses the fixture's trailing loss_trace
aggregate. NOTE: as of this sweep the MLP device image fails closed at the
device-program signature stage (scalar-return lane — see oracle/README.md
"Device image build (S5-U7)"), so the device route is structurally ready but
not exercisable yet; it is not part of this sweep's validation.

Usage:
  sweep_hyperparams.py                       # run the 9-combo sweep + determinism check, write oracle/sweep-report.md
  sweep_hyperparams.py --report              # regenerate oracle/sweep-report.md from the embedded data (idempotency check)
  sweep_hyperparams.py --combo 500,0.05      # run a single combo (debug)
  sweep_hyperparams.py --faber /path/faber   # faber binary (default: $FABER, else 'faber' on PATH)
  sweep_hyperparams.py --route device --backend metal   # future device-side route (untested — image builds fail closed)

Environment: FABER_LIBRARY_HOME (default: the faberlang container root, the
parent of the examples repo containing this fixture).
"""

from __future__ import annotations

import argparse
import datetime
import hashlib
import json
import os
import platform
import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

TOOLS_DIR = Path(__file__).resolve().parent
ORACLE_DIR = TOOLS_DIR.parent
PKG_DIR = ORACLE_DIR.parent                       # examples/training/mlp
EXAMPLES_REPO = PKG_DIR.parents[1]                # examples/ (git repo)
FABERLANG_ROOT = PKG_DIR.parents[2]               # container root

REPORT_PATH = ORACLE_DIR / "sweep-report.md"

GRID_STEPS = [100, 500, 1000]
GRID_LR = ["0.01", "0.05", "0.1"]
CONV_FACTOR = 0.1
DETERMINISM_COMBO = (1000, "0.01")
EXPECTED_LOSS0 = "1.576448169383708"

LR_RE = re.compile(r"(fixum f32 lr ← )\d+(\.\d+)?")
STEPS_FAB_RE = re.compile(r"(fixum numerus steps ← )\d+")
STEPS_TOML_RE = re.compile(r"^(steps = )\d+$", re.MULTILINE)

PATCH_FILES = [
    {"path": PKG_DIR / "src" / "train.fab", "re_lr": LR_RE, "re_steps": STEPS_FAB_RE},
    {"path": ORACLE_DIR / "capture.fab", "re_lr": LR_RE, "re_steps": STEPS_FAB_RE},
    {"path": PKG_DIR / "faber.toml", "re_lr": None, "re_steps": STEPS_TOML_RE},
]
FIXTURE_REPO_PATHS = {"src/train.fab", "oracle/capture.fab", "faber.toml"}

FLOAT_TOKEN_RE = re.compile(r"[+-]?(?:inf|nan|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)")

EMBED_RE = re.compile(r"<!-- sweep-data-json v1:(\{.*?\}) -->", re.DOTALL)


# ---------------------------------------------------------------------------
# fixture patching / restoring
# ---------------------------------------------------------------------------

def patch_fixture(steps: int, lr: str) -> None:
    for spec in PATCH_FILES:
        path = spec["path"]
        text = path.read_bytes().decode("utf-8")
        if spec["re_lr"] is not None:
            text, n = spec["re_lr"].subn(lambda m: m.group(1) + lr, text)
            if n != 1:
                raise RuntimeError(f"{path}: expected exactly one lr literal, replaced {n}")
        text, n = spec["re_steps"].subn(lambda m: m.group(1) + str(steps), text)
        if n != 1:
            raise RuntimeError(f"{path}: expected exactly one steps literal, replaced {n}")
        path.write_bytes(text.encode("utf-8"))


def git_status() -> list[str]:
    res = subprocess.run(
        ["git", "-C", str(EXAMPLES_REPO), "status", "--porcelain"],
        capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"git status failed: {res.stderr}")
    return res.stdout.splitlines()


def assert_fixture_clean() -> None:
    bad = [line for line in git_status() if line[3:] in FIXTURE_REPO_PATHS]
    if bad:
        raise RuntimeError(
            "fixture files dirty after restore (hard constraint violated): "
            + ", ".join(bad))


# ---------------------------------------------------------------------------
# capture run + parsing
# ---------------------------------------------------------------------------

def run_one_combo(faber: str, route: str, backend: str | None,
                  steps: int, lr: str, workdir: Path) -> dict:
    originals = {spec["path"]: spec["path"].read_bytes() for spec in PATCH_FILES}
    try:
        patch_fixture(steps, lr)
        if route == "fmir":
            cmd = [faber, "run", "-t", "fmir", "oracle/capture.fab"]
        else:
            cmd = [faber, "run", "--backend", backend, "."]
        env = dict(os.environ)
        env.setdefault("FABER_LIBRARY_HOME", str(FABERLANG_ROOT))
        out_path = workdir / f"capture_s{steps}_lr{lr}.txt"
        t0 = time.perf_counter()
        with open(out_path, "wb") as fh:
            proc = subprocess.run(cmd, cwd=str(PKG_DIR), env=env,
                                  stdout=fh, stderr=subprocess.PIPE)
        wall = time.perf_counter() - t0
        if proc.returncode != 0:
            raise RuntimeError(
                f"capture failed for steps={steps} lr={lr} (exit {proc.returncode}): "
                + proc.stderr.decode("utf-8", "replace")[-3000:])
        text = out_path.read_text(encoding="utf-8")
    finally:
        for path, data in originals.items():
            path.write_bytes(data)
        assert_fixture_clean()

    losses = parse_losses(text, steps, route)
    if losses[0] != EXPECTED_LOSS0:
        raise RuntimeError(
            f"loss0 changed: expected {EXPECTED_LOSS0}, got {losses[0]} "
            f"(steps={steps} lr={lr}) — wrong image or nondeterministic build?")
    vals = [float(v) for v in losses]
    threshold = CONV_FACTOR * vals[0]
    conv = None
    for i, v in enumerate(vals):
        if v < threshold:
            conv = i
            break
    nonfinite = [tok for tok in FLOAT_TOKEN_RE.findall(text)
                 if tok.lstrip("+-") in ("inf", "nan")]
    all_finite = not nonfinite
    return {
        "steps": steps,
        "lr": lr,
        "loss0": losses[0],
        "loss_final": losses[-1],
        "convergence_step": conv,
        "all_finite": all_finite,
        "wall_clock_s": round(wall, 3),
        "capture_sha256": hashlib.sha256(text.encode("utf-8")).hexdigest(),
        "losses": vals,  # internal only; stripped before the report
    }


def parse_losses(text: str, steps: int, route: str) -> list[str]:
    lines = text.splitlines()
    if route == "fmir":
        losses: list[str] = []
        i, n = 0, len(lines)
        while i < n:
            if lines[i] == "step_loss":
                i += 1
                if i >= n:
                    raise RuntimeError("capture ended after a step_loss marker")
                losses.append(lines[i])
            i += 1
        if len(losses) != steps:
            raise RuntimeError(f"expected {steps} step_loss values, got {len(losses)}")
        return losses
    # device route: the fixture's trailing `nota loss_trace` aggregate line.
    agg = None
    for line in lines:
        if line.startswith("[") and line.endswith("]"):
            agg = line
    if agg is None:
        raise RuntimeError("no aggregate loss list in device output")
    losses = [tok.strip() for tok in agg[1:-1].split(",")]
    if len(losses) != steps:
        raise RuntimeError(f"expected {steps} loss values, got {len(losses)}")
    return losses


# ---------------------------------------------------------------------------
# report generation
# ---------------------------------------------------------------------------

def render_report(data: dict) -> str:
    out: list[str] = []
    a = out.append
    if data["route"] == "fmir":
        route_desc = "CPU/FMIR oracle capture (`faber run -t fmir oracle/capture.fab`)"
    else:
        route_desc = f"device route (`faber run --backend {data['backend']} .`)"
    a("# mlp — CPU hyperparameter sweep (steps × lr grid)")
    a("")
    a(f"**Date:** {data['date']} · **Host:** {data['host']} · **Route:** {route_desc} · "
      f"**Faber:** `{data['faber_binary']}` ({data['faber_version']})")
    a("")
    a("Stage 5 science sweep (Vivi task 9d6b8248) for the faberlang GPU training "
      "campaign — learning-curve data across the operator (steps × lr) grid on the "
      "S5-U7 deterministic CPU/FMIR oracle. The committed acceptance state "
      "(steps=100, lr=0.1) is the 100/0.1 row; the fixture files were restored "
      "byte-identical to HEAD after every combo (asserted via `git diff`).")
    a("")
    a("## Method")
    a("")
    a("Per combo the sweep patches in place — `src/train.fab` and "
      "`oracle/capture.fab` get the `lr` literal and the loop bound "
      "`fixum numerus steps ← <n>`, and `faber.toml` gets `[device] steps = <n>` "
      "(the loop bound and the manifest step count must match; the step-count "
      "validation fails closed) — runs the capture "
      "(`faber run -t fmir oracle/capture.fab`, `FABER_LIBRARY_HOME=…/faberlang`), "
      "extracts the trajectory stats and wall-clock, then restores the fixture. "
      "Each combo's `git diff` on the patched files is asserted empty.")
    a("")
    a(f"Convergence rule: the first 0-based step where `loss < {CONV_FACTOR:g} × loss0` "
      f"(`none` if the {max(GRID_STEPS)}-step budget never reaches it). `loss0` is "
      f"`{data['expected_loss0']}` for every combo — the initial params are fixed "
      "literals, so step-0 loss is lr-independent.")
    a("")
    a("## Grid")
    a("")
    a(f"steps ∈ {{{', '.join(str(s) for s in GRID_STEPS)}}} × "
      f"lr ∈ {{{', '.join(GRID_LR)}}} — 9 combos.")
    a("")
    a("## Table")
    a("")
    a("| steps | lr | loss0 | loss_final | final/initial | convergence step | all-finite | wall-clock (s) |")
    a("|---|---|---|---|---|---|---|---|")
    for c in data["combos"]:
        conv = "none" if c["convergence_step"] is None else str(c["convergence_step"])
        ratio = float(c["loss_final"]) / float(c["loss0"])
        finite = "yes" if c["all_finite"] else "**NO**"
        a(f"| {c['steps']} | {c['lr']} | {c['loss0']} | {c['loss_final']} | "
          f"{ratio:.6g} | {conv} | {finite} | {c['wall_clock_s']:.3f} |")
    a("")
    a("## Determinism spot-check")
    a("")
    d = data["determinism"]
    a(f"The {d['combo'][0]}/{d['combo'][1]} combo was captured twice. "
      f"Loss traces identical: **{d['loss_traces_identical']}**; "
      f"capture outputs byte-identical: **{d['captures_identical']}** "
      "(per-combo capture sha256s are in the embedded data block below). "
      "This matches the S5-U7 determinism evidence (the FMIR stepper is "
      "deterministic).")
    a("")
    a("## Read")
    a("")
    a(data["notes"])
    a("")
    a("<!-- sweep-data-json v1:" + json.dumps(data, separators=(",", ":")) + " -->")
    a("")
    return "\n".join(out)


def extract_data(text: str) -> dict:
    m = EMBED_RE.search(text)
    if not m:
        raise RuntimeError("no embedded sweep-data-json block found")
    return json.loads(m.group(1))


# ---------------------------------------------------------------------------
# faber resolution
# ---------------------------------------------------------------------------

def resolve_faber(explicit: str | None) -> str:
    if explicit:
        p = Path(explicit)
        if not p.is_file():
            raise SystemExit(f"error: faber binary not found: {p}")
        return str(p)
    env = os.environ.get("FABER")
    if env:
        return env
    return "faber"


def faber_version(faber: str) -> str:
    try:
        res = subprocess.run([faber, "--version"], capture_output=True,
                             text=True, timeout=30)
        return (res.stdout or res.stderr).strip()
    except Exception as exc:  # noqa: BLE001
        return f"(version query failed: {exc})"


# ---------------------------------------------------------------------------
# command modes
# ---------------------------------------------------------------------------

def run_sweep(args: argparse.Namespace) -> int:
    faber = resolve_faber(args.faber)
    print(f"[sweep] faber: {faber} ({faber_version(faber)})")
    workdir = Path(tempfile.mkdtemp(prefix="mlp_sweep_"))
    try:
        combos = []
        for steps in GRID_STEPS:
            for lr in GRID_LR:
                print(f"[sweep] steps={steps} lr={lr} …", flush=True)
                st = run_one_combo(faber, args.route, args.backend, steps, lr, workdir)
                combos.append(st)
                print(f"[sweep]   loss0={st['loss0']} loss_final={st['loss_final']} "
                      f"conv={st['convergence_step']} finite={st['all_finite']} "
                      f"wall={st['wall_clock_s']}s", flush=True)
        print("[sweep] determinism spot-check (1000/0.01 twice) …", flush=True)
        d1 = run_one_combo(faber, args.route, args.backend,
                           DETERMINISM_COMBO[0], DETERMINISM_COMBO[1], workdir)
        d2 = run_one_combo(faber, args.route, args.backend,
                           DETERMINISM_COMBO[0], DETERMINISM_COMBO[1], workdir)
        traces_identical = d1["losses"] == d2["losses"]
        captures_identical = d1["capture_sha256"] == d2["capture_sha256"]
        if not (traces_identical and captures_identical):
            raise RuntimeError("determinism spot-check FAILED")
        print(f"[sweep] determinism: traces identical={traces_identical} "
              f"captures identical={captures_identical}")

        data = build_data(args, faber, combos, traces_identical, captures_identical)
        report = render_report(data)
        REPORT_PATH.write_text(report, encoding="utf-8")
        print(f"[sweep] wrote {REPORT_PATH}")

        regen = render_report(extract_data(report))
        if regen == report:
            print("[sweep] idempotency self-check: regenerated report byte-identical")
        else:
            print("[sweep] WARNING: regenerated report differs (self-check)", file=sys.stderr)

        print("[sweep] git status --porcelain (fixture must be clean):")
        for line in git_status():
            print("  " + line)
        assert_fixture_clean()
    finally:
        shutil.rmtree(workdir, ignore_errors=True)
    return 0


def build_data(args: argparse.Namespace, faber: str, combos: list[dict],
               traces_identical: bool, captures_identical: bool) -> dict:
    ver = faber_version(faber)
    try:
        binary_sha = hashlib.sha256(Path(faber).read_bytes()).hexdigest()
    except OSError:
        binary_sha = None
    return {
        "fixture": "examples/training/mlp",
        "date": datetime.date.today().isoformat(),
        "host": platform.node(),
        "route": args.route,
        "backend": args.backend if args.route != "fmir" else None,
        "faber_binary": str(Path(faber).resolve()),
        "faber_version": ver,
        "faber_sha256": binary_sha,
        "grid": {"steps": GRID_STEPS, "lr": GRID_LR},
        "convergence_rule": f"first 0-based step where loss < {CONV_FACTOR:g} * loss0",
        "expected_loss0": EXPECTED_LOSS0,
        "determinism": {
            "combo": [DETERMINISM_COMBO[0], DETERMINISM_COMBO[1]],
            "loss_traces_identical": traces_identical,
            "captures_identical": captures_identical,
        },
        "combos": [
            {k: st[k] for k in ("steps", "lr", "loss0", "loss_final",
                                "convergence_step", "all_finite",
                                "wall_clock_s", "capture_sha256")}
            for st in combos
        ],
        "notes": NOTES_TEXT,
    }


def cmd_report() -> int:
    if not REPORT_PATH.exists():
        print(f"error: {REPORT_PATH} not found — run the sweep first", file=sys.stderr)
        return 1
    orig = REPORT_PATH.read_bytes()
    data = extract_data(orig.decode("utf-8"))
    regen = render_report(data)
    if regen.encode("utf-8") == orig:
        print(f"idempotent: regenerated report byte-identical ({REPORT_PATH})")
        return 0
    print("error: regenerated report differs from the committed report", file=sys.stderr)
    print("the report on disk may have been hand-edited or generated by an older "
          "version of this script; it was left untouched.", file=sys.stderr)
    return 1


def cmd_combo(faber: str, route: str, backend: str | None, combo: str) -> int:
    steps_s, _, lr = combo.partition(",")
    steps = int(steps_s.strip())
    lr = lr.strip()
    if lr not in GRID_LR:
        raise SystemExit(f"error: lr {lr} not in grid {GRID_LR}")
    workdir = Path(tempfile.mkdtemp(prefix="mlp_sweep_"))
    try:
        st = run_one_combo(faber, route, backend, steps, lr, workdir)
        st.pop("losses", None)
        print(json.dumps(st, indent=2))
    finally:
        shutil.rmtree(workdir, ignore_errors=True)
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--report", action="store_true",
                   help="regenerate oracle/sweep-report.md from the embedded data "
                        "(idempotency check); runs no sweeps")
    p.add_argument("--combo", metavar="STEPS,LR",
                   help="run a single combo, e.g. 500,0.05 (debug); runs no full sweep")
    p.add_argument("--faber", metavar="PATH",
                   help="faber binary (default: $FABER, else 'faber' on PATH)")
    p.add_argument("--route", choices=["fmir", "device"], default="fmir",
                   help="capture route ('device' is the future device-side seam)")
    p.add_argument("--backend", default=None,
                   help="device backend for --route device (metal|cuda)")
    args = p.parse_args(argv)
    if args.report and args.combo:
        p.error("--report and --combo are mutually exclusive")
    if args.route == "device" and not args.backend:
        p.error("--route device requires --backend")
    if args.report:
        return cmd_report()
    if args.combo:
        return cmd_combo(resolve_faber(args.faber), args.route, args.backend,
                         args.combo)
    return run_sweep(args)


# The "short read" prose, authored after inspecting the sweep data. It is part
# of the embedded data block, so `--report` regeneration reproduces it.
NOTES_TEXT = (
    "The learning rate dominates the step budget. The convergence step is a "
    "pure function of lr — the first step where loss < 0.1×loss0 is 48 "
    "(lr=0.1), 95 (lr=0.05), and 472 (lr=0.01), identical across the "
    "100/500/1000 step budgets — so the trajectory is deterministic and "
    "lr-scaled.\n\n"
    "The 0.794 plateau at 100/0.01 is a small-lr artifact, not a fixture "
    "limit: at lr=0.01 the loss falls only to 0.794 in 100 steps (0.504×loss0, "
    "no convergence), but reaches 0.139 in 500 steps and 0.0173 in 1000 steps "
    "(crossing the gate at step 472). Raising lr dissolves the plateau faster: "
    "lr=0.05 reaches 0.142 in the same 100-step budget (0.0898×loss0, just "
    "under the gate) and lr=0.1 reaches 0.0179 (0.0114×loss0).\n\n"
    "Gate (final < 0.1×loss0): 8 of 9 combos meet it; only 100/0.01 does not "
    "(0.504×loss0). The marginal cases are 100/0.05 (0.0898, ≈1.1× margin, "
    "crossing on step 95 of 100) and 500/0.01 (0.0881, ≈1.1×). The committed "
    "acceptance state 100/0.1 has an 8.8× margin; 1000/0.01 reaches 0.0110 "
    "(9.1×); 500/0.05 reaches 8.0×10^-5 (~1,250×); 500/0.1 and 1000/0.05 land "
    "at ≈5×10^-8, and 1000/0.1 at 4×10^-14 (machine-level convergence).\n\n"
    "Wall-clock scales linearly with steps on top of a fixed build cost: "
    "0.16–0.17s (100 steps), 0.26–0.27s (500), 0.39s (1000) per capture, of "
    "which ~0.14s is the FMIR image build; the stepper adds ~0.025s per 100 "
    "steps (~0.25 ms/step) at this 4×4 problem size. A 1000-step device-side "
    "run's CPU-side math is sub-second, so the Stage 8 performance gate will "
    "be dominated by device launch/transfer overhead, not compute.\n\n"
    "All 9 combos are all-finite. Determinism spot-check: the 1000/0.01 combo "
    "captured twice produced byte-identical loss traces and captures, "
    "consistent with the S5-U7 determinism evidence."
)


if __name__ == "__main__":
    sys.exit(main())
