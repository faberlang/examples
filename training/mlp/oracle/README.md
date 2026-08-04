# mlp — CPU/FMIR Oracle Reference (S0-C)

Pinned deterministic CPU/FMIR oracle references for `examples/training/mlp/`.
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
| model | two-layer MLP: `linear(4×4→4×4) + GELU + linear(4×4→4×4) + MSE`, 8-step SGD (`lr = 0.01`) via the Gradus static-shape surface (S4-B): `nn.linear_4x4` forward, `nn.gelu_4x4`, `loss.mse_4x4`, `train.train_step_4x4` update |
| trainable | `weight1` [4,4], `bias1` [4,4], `weight2` [4,4], `bias2` [4,4] |
| frozen | `input` [4,4], `target` [4,4] |
| companion | `@ radix backward "mlp_backward"` (AIR-generated, CPU FMIR stepper) |
| run | `faber run -t fmir .` from the package directory |

S4-B (Stage 4, `gpu-training-lowering` stage-4-delivery.md unit S4-B) migrated
this fixture from inline layer/loss/SGD expressions onto the Gradus surface,
proving the API for a second caller with four trainable
gradient/update tensors. The model function still carries the ONE explicit
`@ radix backward` annotation; the loop owns no inline learning-rate fill,
gradient scaling, or parameter subtraction. The migration preserves the
captured oracle byte-for-byte (see Determinism evidence below).

## File inventory

| File | Content |
|---|---|
| `capture.fab` | Instrumented capture runner: an exact copy of `src/train.fab` with added `nota` statements (provenance documented in its header). |
| `capture.txt` | Raw, byte-deterministic capture output (marker/value stream, see schema below). |
| `capture.sha256` | SHA-256 of `capture.txt`. |
| `inputs.json` | Initial params/inputs (pinned oracle inputs). |
| `loss-trace.json` | The 8-step loss trace. |
| `gradients.json` | Per-step gradient tensors from the CPU companion, **trainable slots only** (`weight1`, `bias1`, `weight2`, `bias2`). Frozen-slot gradients (`grad_input`, `grad_target`) exist only in `capture.txt`. |
| `final-params.json` | Trainable params after the 8 SGD steps. |
| `fd-validation.json` | Per-element finite-difference gradient validation results (N1.9 FD rule). |

## Capture schema

`capture.txt` is a marker/value stream, one value per line:

```
initial_input
[0.5, -0.3, 1.2, -0.7, ...]
...
step_loss
<loss at step 0>
...
grad_weight1
[16 f64 Display values]
...
final_weight1
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
  step is the trainable slot order `(grad_weight1, grad_bias1, grad_weight2,
  grad_bias2)`. Frozen-slot gradients (`grad_input`, `grad_target`) are captured
  in `capture.txt` but not recorded here.
- `final-params.json` — `{"fixture", "after_steps": 8, "final_params": [tensor...]}`.
- `fd-validation.json` — per-element `{index, fd, companion, delta, tol, pass}`.

## Regeneration

```bash
cd examples/training/mlp
faber run -t fmir oracle/capture.fab > oracle/capture.txt   # regenerate capture
shasum -a 256 oracle/capture.txt                            # must equal capture.sha256

python3 oracle/tools/fd_probe.py        # regenerate oracle/fd-validation.json
python3 oracle/tools/replay_loss.py     # independent f64 loss-trace replay
python3 oracle/tools/replay_f32.py      # independent strict-f32 trajectory replay
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

## Determinism evidence

### Original capture (2026-08-03, S0-C — inline SGD fixture)

- capture.txt sha256: `cb922eb0b6b95c72ea6a5ea7502447537addabfc24c8f7a9f0ab2cc18cd28c8e`
- fixture run output sha256 (two runs identical): `be0b5280a07db413b112b82d5551956631237f9ff8d1eb1af1b7a159e810aadd`
- fixture output is a byte-identical suffix of capture.txt (cross-check).
- Loss trace replay (independent f64 replay of the trajectory from captured
  gradients): all 8 steps match, worst delta ~2.2e-16 (rule tol ~2.5e-6).
- FD gradient validation: 64/64 elements pass, worst delta ~4.3e-8 (rule tol ~1e-4).
- All captured values finite.

### S4-B migration (2026-08-04, Gradus surface — pinned release faber v1.4.0)

The S4-B migration changed `src/train.fab` (inline SGD → `gradus:nn` /
`gradus:loss` / `gradus:train` 4×4 calls) and regenerated `oracle/capture.fab`
as the instrumented copy of the migrated source. The captured oracle is
**unchanged byte-for-byte**; no oracle assertion was weakened.

- migrated source sha256 (`src/train.fab`): `698334c504ffe0d7f52dd93a298a4d4797843863ab1cb5101e485a2d2f857f32`
- capture runner sha256 (`oracle/capture.fab`): `fe685f0706547e3c1815dbfd56d596ae65b6da7a5c01049ee724053250fa9d4a`
- capture.txt sha256 (unchanged): `cb922eb0b6b95c72ea6a5ea7502447537addabfc24c8f7a9f0ab2cc18cd28c8e`
  (`shasum -a 256 oracle/capture.txt` matches `capture.sha256`)
- fixture run output sha256 (unchanged): `be0b5280a07db413b112b82d5551956631237f9ff8d1eb1af1b7a159e810aadd`
- FD gradient validation: 64/64 elements pass, worst delta ~4.3e-8 (rule tol ~1e-4).
- Loss trace replay (independent f64): all 8 steps pass, worst delta ~2.2e-16.
- Strict-f32 trajectory replay (`tools/replay_f32.py`, independent f32
  implementation of the same forward/update including GELU): all 8 loss steps
  + final params pass under the N1.9 rules, worst loss delta ~1.5e-7, worst
  param delta ~8.8e-8 — the executed contract is the f32-typed program.
- All captured values finite.
