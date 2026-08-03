# linear-regression — CPU/FMIR Oracle Reference (S0-C)

Pinned deterministic CPU/FMIR oracle references for `examples/training/linear-regression/`.
Part of Stage 0 (`stage-0-delivery.md`, unit **S0-C**) of the `gpu-training-lowering`
campaign: exit-gate bullet 5 — "CPU oracle inputs + expected traces pinned".

The fixture `src/train.fab` is **read-only**; it is the pinned oracle input. All
oracle content below was captured by running the fixture through the FMIR stepper
on CPU (burgus, macOS). No device run was involved.

## Purpose

When a later stage (Stage 1+) executes the same training program on Metal/CUDA,
its observed loss trace, gradient tensors, and final parameters are compared
per element against these references using the frozen numeric policy in
`stage-0-delivery.md` §2 (N1.9). These files are that reference.

## Fixture

| | |
|---|---|
| entry | `src/train.fab` |
| model | 2×2 linear + bias + MSE, 8-step inline SGD (`lr = 0.01`) |
| trainable | `weight` [2,2], `bias` [2,2] |
| frozen | `input` [2,2], `target` [2,2] |
| companion | `@ radix backward "linear_backward"` (AIR-generated, CPU FMIR stepper) |
| run | `faber run -t fmir .` from the package directory |

## File inventory

| File | Content |
|---|---|
| `capture.fab` | Instrumented capture runner: an exact copy of `src/train.fab` with added `nota` statements (provenance documented in its header). |
| `capture.txt` | Raw, byte-deterministic capture output (marker/value stream, see schema below). |
| `capture.sha256` | SHA-256 of `capture.txt`. |
| `inputs.json` | Initial params/inputs (pinned oracle inputs). |
| `loss-trace.json` | The 8-step loss trace. |
| `gradients.json` | Per-step gradient tensors from the CPU companion, **trainable slots only** (`weight`, `bias`). Frozen-slot gradients (`grad_input`, `grad_target`) exist only in `capture.txt`. |
| `final-params.json` | Trainable params after the 8 SGD steps. |
| `fd-validation.json` | Per-element finite-difference gradient validation results (N1.9 FD rule). |

## Capture schema

`capture.txt` is a marker/value stream, one value per line:

```
initial_input
[0.5, -1.0, 2.0, 0.75]
...
step_loss
<loss at step 0>
...
grad_weight
[1.7437500000000004, -1.3875, 0.7875000000000001, -0.1343749999999999]
...
final_weight
[...]
```

Markers are bare lowercase identifiers; the value line that follows is the
stepper `nota` output: a flat, row-major list `[...]` for tensors or a bare
decimal for scalars. Markers repeat per training step (`step_loss`, `grad_*`
appear 8 times, in step order).

Value encoding: every number is the verbatim stepper Display string. The FMIR
stepper computes float math in f64 (`radix-mir-stepper`), and `nota` emits the
f64 shortest round-trip decimal (`display_fractus`), so each string parses back
to the exact captured f64. The JSON reference files store these strings
verbatim; do not reformat them.

JSON reference files (shape `{"name", "shape", "values"}` per tensor; `values`
is the flat row-major list of value strings):

- `inputs.json` — `{"fixture", "source", "inputs": [tensor...]}`; all initial
  params/inputs as constructed by `seed.strue(...)` in the fixture.
- `loss-trace.json` — `{"fixture", "steps": 8, "lr": "0.01", "losses": [8 strings],
  "rule"}`.
- `gradients.json` — `{"fixture", "rule", "method", "steps": [{"step", "gradients":
  [tensor...]}]}`. Records the **trainable** tensors only; gradient order per
  step is the trainable slot order `(grad_weight, grad_bias)`. Frozen-slot
  gradients (`grad_input`, `grad_target`) are captured in `capture.txt` but not
  recorded here.
- `final-params.json` — `{"fixture", "after_steps": 8, "final_params": [tensor...]}`.
- `fd-validation.json` — per-element `{index, fd, companion, delta, tol, pass}`.

## Regeneration

```bash
cd examples/training/linear-regression
faber run -t fmir oracle/capture.fab > oracle/capture.txt   # regenerate capture
shasum -a 256 oracle/capture.txt                            # must equal capture.sha256

python3 oracle/tools/fd_probe.py        # regenerate oracle/fd-validation.json
python3 oracle/tools/replay_loss.py     # independent f64 loss-trace replay
```

The capture is byte-deterministic: two identical runs of the fixture
(`faber run -t fmir .`) and of the capture runner produce byte-identical
output. If `src/train.fab` changes, regenerate `capture.fab` (instrumented copy)
and all reference files; the FD probe and replay scripts in `oracle/tools/`
then regenerate `fd-validation.json` and the replay evidence (see
`oracle/tools/README.md` for the `faber` prerequisite and exit codes).

## Validation rules (frozen N1.9)

Applies elementwise; `b` = reference (these files). Shapes must match.
`|a_i − b_i| ≤ atol + rtol·|b_i|`. Any NaN or ±Inf in observed or reference
value → FAIL (all pinned observations are finite).

| Family | atol | rtol |
|---|---|---|
| reduction sum/mean (loss trace) | 1e-6 | 1e-6 |
| gradient tensors | 1e-4 | 1e-4 |

Finite-difference validation: central difference, `ε = 1.0e-3`, per-element
perturbation of the actual faber computation (capture runner reused as the
probe); acceptance per element via the gradient rule.

## Determinism evidence (2026-08-03)

- capture.txt sha256: `2ddbdc75e2cbc6fe8eb6c1feb3fdb312f17ed21540f39347f8c1c6dc1320a740`
- fixture run output sha256 (two runs identical): `e2b258ee97ee8252d910ae2fb059b2793bd3d4667447f60713284db411d3c450`
- fixture output is a byte-identical suffix of capture.txt (cross-check).
- Loss trace replay (independent f64 replay of the trajectory from captured
  gradients): all 8 steps match, worst delta ~1.1e-16 (rule tol ~2e-6).
- FD gradient validation: 8/8 elements pass, worst delta ~1.8e-13 (rule tol ~1e-4).
- All captured values finite.
