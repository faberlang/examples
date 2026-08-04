# mlp — CPU/FMIR Oracle Reference (S0-C / S4-B / S5-U7)

Pinned deterministic CPU/FMIR oracle references for `examples/training/mlp/`.
Part of the `gpu-training-lowering` campaign: Stage 0 exit-gate bullet 5
("CPU oracle inputs + expected traces pinned", unit **S0-C**), extended to the
Gradus surface at Stage 4 (**S4-B**), and to the Stage 5 device product
fixture at **S5-U7** (100 steps, `[device]` section, device marking).

The fixture `src/train.fab` is **read-only**; it is the pinned oracle input. All
oracle content below was captured by running the fixture through the FMIR
stepper on CPU (burgus, macOS). No device run was involved.

## Purpose

When a later stage (Stage 1+) executes the same training program on Metal/CUDA,
its observed loss trace, gradient tensors, and final parameters are compared
per element against these references using the frozen numeric policy in
`numeric-policy.md` (v1.0.0, formerly `stage-0-delivery.md` §2 N1.9). These
files are that reference.

## Fixture

| | |
|---|---|
| entry | `src/train.fab` |
| model | two-layer MLP: `linear(4×4→4×4) + GELU + linear(4×4→4×4) + MSE`, **100-step** SGD (`lr = 0.1`, Wave A5; `mlp_loss` returns `f32` — explicit f32 loss contract) via the Gradus static-shape surface (S4-B/S5-U7): `nn.linear_4x4` forward, `nn.gelu_4x4`, `loss.mse_4x4`, `train.train_step_4x4` update |
| trainable | `weight1` [4,4], `bias1` [4,4], `weight2` [4,4], `bias2` [4,4] |
| frozen | `input` [4,4], `target` [4,4] |
| lane | `@ nucleum` + `@ radix lane "air"` + `@ radix backward "mlp_backward"` (S5-U7 device marking; SEM059 shape) |
| companion | `@ radix backward "mlp_backward"` (AIR-generated, CPU FMIR stepper) |
| manifest | `[device] backend = "auto"`, `steps = 100`, host inputs for all six buffers (faber.toml) |
| run (CPU oracle) | `faber run -t fmir oracle/capture.fab` from the package directory |

S4-B (Stage 4, `stage-4-delivery.md` unit S4-B) migrated this fixture from
inline layer/loss/SGD expressions onto the Gradus surface, proving the API for
a second caller with four trainable gradient/update tensors. The model function
still carries the ONE explicit `@ radix backward` annotation; the loop owns no
inline learning-rate fill, gradient scaling, or parameter subtraction.

S5-U7 (Stage 5, `stage-5-delivery.md` unit S5-U7) evolved the fixture to the
device product shape: the lane gained the `@ nucleum` device marking, the loop
grew to 100 steps, and `faber.toml` gained the `[device]` section (backend
`auto`, declared step count `100` — validated against the source loop bound —
and the pinned host inputs). The initial params and all arithmetic are
**unchanged**; only the step count and the device surface changed. See
"Device image build (S5-U7)" below for the on-device status of this package.

## File inventory

| File | Content |
|---|---|
| `capture.fab` | Instrumented capture runner: an exact copy of `src/train.fab` with added `nota` statements (provenance documented in its header). **Deliberately omits the `@ nucleum` device marking** so the CPU oracle stays regenerable while the manifest declares a `[device]` surface (the faber constructor's documented "CPU oracle capture runner has no kernel" exemption). |
| `capture.txt` | Raw, byte-deterministic capture output (marker/value stream, see schema below). |
| `capture.sha256` | SHA-256 of `capture.txt`. |
| `inputs.json` | Initial params/inputs (pinned oracle inputs). |
| `loss-trace.json` | The 100-step loss trace. |
| `gradients.json` | Per-step gradient tensors from the CPU companion, **trainable slots only** (`weight1`, `bias1`, `weight2`, `bias2`). Frozen-slot gradients (`grad_input`, `grad_target`) exist only in `capture.txt`. |
| `final-params.json` | Trainable params after the 100 SGD steps. |
| `fd-validation.json` | Per-element finite-difference gradient validation results (N1.9 FD rule). |
| `reference.json` | Machine-readable fixture metadata (S2-5 convention): shapes, trainable/frozen sets, policy citation, capture hash, replay/FD verdicts, device-image status. |
| `tools/extract_reference.py` | Rebuilds `inputs.json` / `loss-trace.json` / `gradients.json` / `final-params.json` verbatim from a fresh `capture.txt` (S5-U7; replaces the ad-hoc 8-step generation). |
| `tools/fd_probe.py` | Regenerates `fd-validation.json` (central difference, ε = 1e-3, N1.9). |
| `tools/replay_loss.py` | Independent f64 loss-trace replay. |
| `tools/replay_f32.py` | Independent strict-f32 trajectory replay. |

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
appear 100 times, in step order). The fixture's trailing `nota loss_trace`
prints the aggregate loss list with no marker prefix (kept so the legacy
"fixture output is a byte-identical suffix" cross-check held for the 8-step
capture; it is inert for the reference files — `extract_reference.py` skips
stray value lines).

Value encoding: every number is the verbatim stepper Display string. The FMIR
stepper computes float math in f64 (`radix-mir-stepper`), and `nota` emits the
f64 shortest round-trip decimal (`display_fractus`), so each string parses back
to the exact captured f64. The JSON reference files store these strings
verbatim; do not reformat them.

JSON reference files (shape `{"name", "shape", "values"}` per tensor; `values`
is the flat row-major list of value strings):

- `inputs.json` — `{"fixture", "source", "inputs": [tensor...]}`; all initial
  params/inputs as constructed by `seed.strue(...)` in the fixture.
- `loss-trace.json` — `{"fixture", "steps": 100, "lr": "0.1", "losses": [100
  strings], "rule"}`.
- `gradients.json` — `{"fixture", "rule", "method", "steps": [{"step",
  "gradients": [tensor...]}]}`. Records the **trainable** tensors only;
  gradient order per step is the trainable slot order `(grad_weight1,
  grad_bias1, grad_weight2, grad_bias2)`. Frozen-slot gradients
  (`grad_input`, `grad_target`) are captured in `capture.txt` but not recorded
  here.
- `final-params.json` — `{"fixture", "after_steps": 100, "final_params":
  [tensor...]}`.
- `fd-validation.json` — per-element `{index, fd, companion, delta, tol, pass}`.

## Regeneration

```bash
cd examples/training/mlp
export FABER_LIBRARY_HOME=/Users/ianzepp/work/faberlang   # gradus/norma providers
FABER=/path/to/faber                                       # workspace faber (S5-U5..U5c)
$FABER run -t fmir oracle/capture.fab > oracle/capture.txt   # regenerate capture
shasum -a 256 oracle/capture.txt                            # must equal capture.sha256

python3 oracle/tools/extract_reference.py  # rebuild the four JSON reference files
python3 oracle/tools/fd_probe.py --faber "$FABER"        # regenerate fd-validation.json
python3 oracle/tools/replay_loss.py     # independent f64 loss-trace replay
python3 oracle/tools/replay_f32.py      # independent strict-f32 trajectory replay
```

The capture is byte-deterministic: two identical runs of the capture runner
produce byte-identical output (verified at 100 steps). If `src/train.fab`
changes, regenerate `capture.fab` (instrumented copy) and all reference files.

Note: with the S5-U7 `[device]` section declared, `faber run -t fmir .` on the
package entry fails closed (the entry carries the `@ nucleum` lane and device
construction runs during the FMIR image build — see below). The CPU oracle is
therefore captured through `oracle/capture.fab`, which carries no `@ nucleum`
marking; the 8-step "fixture output is a byte-identical suffix of capture.txt"
cross-check is historical (S0-C evidence) and is not reproducible at 100 steps.

## Validation rules (frozen N1.9 / numeric-policy v1.0.0)

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

### Original capture (2026-08-03, S0-C — inline SGD fixture, 8 steps)

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
- FD gradient validation: 64/64 elements pass, worst delta ~4.3e-8 (rule tol ~1e-4).
- Loss trace replay (independent f64): all 8 steps pass, worst delta ~2.2e-16.
- Strict-f32 trajectory replay (`tools/replay_f32.py`, independent f32
  implementation of the same forward/update including GELU): all 8 loss steps
  + final params pass under the N1.9 rules, worst loss delta ~1.5e-7, worst
  param delta ~8.8e-8 — the executed contract is the f32-typed program.
- All captured values finite.

### S5-U7 re-capture (2026-08-04, 100-step Gradus surface — workspace faber @ faber `a384ff1`)

S5-U7 (`stage-5-delivery.md` unit S5-U7) evolved the fixture to the device
product fixture: `src/train.fab` now runs the deterministic 100-step loop and
carries the `@ nucleum` device marking on `mlp_loss`; `faber.toml` declares the
`[device]` section. The oracle was re-captured at 100 steps. The capture runner
(`oracle/capture.fab`) deliberately omits the `@ nucleum` marking (see its
header NOTE): a CPU oracle capture runner is expected to have no device kernel,
and the arithmetic is otherwise identical to `src/train.fab` (modulo the
`nota` instrumentation, including the named-slot destructuring that lets the
frozen-slot gradients be captured).

- source sha256 (`src/train.fab`): `58e2c01b8305b0726a54fc116376e5469febf59ce0426511fb5237ddfb1c6859` (Gradus arithmetic identical to the S4-B source, plus the `@ nucleum` device marking and the `steps ← 100` loop bound); capture runner sha256 (`oracle/capture.fab`): `8c1c9e02ac84eadf5ed5b04a8f89e6ee5007596d7ce44f3497e451f5fe071c73`.
- capture.txt sha256 (new, 100 steps): `c275463879bba4356741dd8fe711ec33f35d4f9472f7da929d5340ea9203e168`
  (`shasum -a 256 oracle/capture.txt` matches `capture.sha256`; verified by three independent runs — two fresh re-captures plus the committed file — all byte-identical).
- `loss-trace.json`: 100 steps, monotone from `1.576448169383708` (step 0) to `0.7941141822864916` (step 99), all finite.
- Loss trace replay (independent f64): all 100 steps pass, worst delta ~2.2e-16 (rule tol ~2.6e-6).
- Strict-f32 trajectory replay (`tools/replay_f32.py`): all 100 loss steps + final params pass under the N1.9 rules, worst loss delta ~3.5e-7, worst param delta ~3.4e-7 — the executed contract is the f32-typed program.
- FD gradient validation (step-0 companion vs central-difference probe): 64/64 elements pass, worst delta ~4.3e-8 (rule tol ~1e-4) — unchanged from S4-B, as expected: FD validates step-0 gradients against the identical initial params.
- All captured values finite.
- The 100-step trajectory at the pinned `lr = 0.01` did **not** reach the
  Stage 5 exit-gate convergence bound (final < 0.1 × initial): 0.794 vs the
  0.158 bound. **Superseded by the Wave A5 re-capture below** (lr `0.1`),
  which resolves the convergence disclosure: the S5-U7 numbers above are the
  historical record for the pre-A5 capture.

### Wave A5 re-capture (2026-08-04, explicit f32 loss contract + convergent lr)

Wave A5 (Stage 5 findings P0-1 step 2 + P0-2) changed `src/train.fab` in two
places and re-captured the oracle once:
1. **P0-1 step 2** — `mlp_loss` return type `fractus` → `f32`: the arithmetic
   was already f32 (`loss.mse_4x4` returns f32; the strict-f32 replay passed),
   so the declared `fractus` (f64) return hid a latent f64 ABI reject. The
   declared return type now matches the executed contract, so the generated
   companion's upstream is f32. The typing change does **not** alter the
   arithmetic: the initial params, step-0 loss (`1.576448169383708`), and
   step-0 gradients are byte-identical to the pre-change capture.
2. **P0-2** — pinned lr `0.01` → `0.1` (steps stays 100; initial params,
   target, and the gate unchanged). The trajectory now converges under the
   Stage 5 exit-gate bound: final/initial ≈ 0.0114 < 0.1 (8.8× margin), all
   finite, monotone non-increasing.

- source sha256 (`src/train.fab`): `a9367f3b1a7e0ab402f95184809c9017b7f72b51304c4fe1a4c2010366e22c46`; capture runner sha256 (`oracle/capture.fab`): `f17d8197f68914e3afda80025b950d7f16c90399d08b9b90c77eb92a968c3d68`.
- capture.txt sha256 (new): `b0ad783243162d6f53e97c7d1c2af4e42ab8a722d7044826bb54aa950b1b3e0f`
  (`shasum -a 256 oracle/capture.txt` matches `capture.sha256`; verified by two independent fresh re-captures plus the committed file — all byte-identical).
- `loss-trace.json`: 100 steps, monotone from `1.576448169383708` (step 0) to
  `0.017928625511508454` (step 99), all finite. Convergence bound met:
  `0.017928625511508454 / 1.576448169383708 = 0.0114` (< 0.1).
- Loss trace replay (independent f64): all 100 steps pass, worst delta ~2.2e-16 (rule tol ~2.6e-6).
- Strict-f32 trajectory replay (`tools/replay_f32.py`): all 100 loss steps + final params pass under the N1.9 rules, worst loss delta ~2.2e-7, worst param delta ~2.7e-7 — the executed contract is the f32-typed program.
- FD gradient validation: unchanged (lr-independent — validates step-0 gradients of the unchanged initial params): 64/64 elements pass; `fd-validation.json` untouched.
- Device image: still `FAIL` at the device-program signature stage with the same `E_DEVICE_DESCRIPTOR: recipe operand requires a tensor type` diagnostic (re-verified 2026-08-04 — the f32 scalar return is still a scalar; see "Device image build (S5-U7)" below).

## Device image build (S5-U7)

The S5-U7 `done_when` requires the device image to build for Metal and CUDA
through the ordinary product route (`faber run --backend <backend> .`) with
fail-closed diagnostics if any emitter surface is missing. Attempted on burgus
(2026-08-04) with the workspace faber (`faber` @ `a384ff1`, built with the
S5-U1..U5c substrate):

```text
$ faber run --backend metal .   → error: E_DEVICE_DESCRIPTOR: device program
                                  signature: recipe operand requires a tensor type
                                  (fmir image build failed, exit 1)
$ faber run --backend cuda .    → same fail-closed diagnostic (exit 1)
$ faber run -t fmir .           → same fail-closed diagnostic (exit 1)
$ faber run -t fmir oracle/capture.fab  → ok (exit 0) — CPU oracle unaffected
```

This is a **fail-closed missing-surface result**, not a package defect: the
MLP lane returns a scalar (`f32` — the MSE; the Wave A5 typing change from
`fractus` to `f32` does not alter this), and the S5-U1 training-path
decomposition requires tensor-typed data-flow params in the subchain
signatures (`radix-mir` `device_program_plans.rs`, `tensor_element_ty`, line
~551 — "recipe operand requires a tensor type"). A scalar-return primal's
generated companion carries a non-tensor upstream seed, which the
decomposition seam rejects with `recipe operand requires a tensor type`; the
diagnostic is backend-independent and fires before any backend-specific
emitter surface is reached. The U5 constructor tests use a tensor-return
forward for exactly this reason. A relowering probe (lane returning the
squared-residual tensor) progresses past the signature stage but then hits the
next missing surface — the Metal emitter rejects a kernel runtime call
(`MIR-to-Metal unsupported: kernel runtime call`) — so the full MLP device
image needs both (a) scalar-return-lane companion decomposition and (b) the
remaining Metal/CUDA emitter arms. The build was re-verified on 2026-08-04
after the Wave A5 f32 typing change: same fail-closed diagnostic, exit 1.

`reference.json` records the exact device-image status. The `[device] inputs`
keys in `faber.toml` follow the documented convention (kernel parameter
names); the decomposed training-program buffer naming must be reconciled when
the surface lands (U8).

This is the documented residual for S5-U7: the package/oracle CPU side is
complete and pinned (this README), but the device image build is blocked on a
radix-mir device-signature gap (scalar-returning lane admission), not on the
Metal/CUDA emitters. It is `FAIL` (fail-closed), never a skipped pass; the
real-device proofs (S5-U8/U9) and cross-backend acceptance (S5-U10) wait on a
further substrate unit that admits scalar-return lanes (or a fixture
restructure). See the U7 closeout mail for the exact diagnostic and code path.
