# bert-tiny-fragment — CPU/FMIR Oracle Reference (S0-C)

Pinned deterministic CPU/FMIR oracle references for `examples/training/bert-tiny-fragment/`.
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
| model | single-layer BERT-tiny fragment: pre-LN → Q/K/V projections → scaled dot-product attention → output projection → residual → LN → FFN (linear→GELU→linear) → residual → LN → MSE; B=2, D=8, H=1; 8-step inline SGD (`lr = 0.01`) |
| trainable | 18 trainable tensors (528 floats): `wq,bq,wk,bk,wv,bv,wo,bo,wf1,bf1,wf2,bf2,ln1_s,ln1_o,ln2_s,ln2_o,ln3_s,ln3_o` |
| frozen | `input` [2,8], `dk_scale` [2,2], `target` [2,8] |
| companion | `@ radix backward "bert_tiny_backward"` (AIR-generated, CPU FMIR stepper), 21-slot gradient tuple (18 trainable + input, dk_scale, target) |
| run | `faber run -t fmir .` from the package directory |

## File inventory

| File | Content |
|---|---|
| `capture.fab` | Instrumented capture runner: an exact copy of `src/train.fab` with added `nota` statements (provenance documented in its header). |
| `capture.txt` | Raw, byte-deterministic capture output (marker/value stream, see schema below). |
| `capture.sha256` | SHA-256 of `capture.txt`. |
| `inputs.json` | Initial params/inputs (pinned oracle inputs). |
| `loss-trace.json` | The 8-step loss trace. |
| `gradients.json` | Per-step gradient tensors from the CPU companion, **trainable slots only** (the 18 tensors above). Frozen-slot gradients (`grad_input`, `grad_dk_scale`, `grad_target`) exist only in `capture.txt`. |
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
grad_wq
[64 f64 Display values]
...
final_wq
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
  step is the trainable slot order `(grad_wq, grad_bq, grad_wk, grad_bk,
  grad_wv, grad_bv, grad_wo, grad_bo, grad_wf1, grad_bf1, grad_wf2, grad_bf2,
  grad_ln1_s, grad_ln1_o, grad_ln2_s, grad_ln2_o, grad_ln3_s, grad_ln3_o)`.
  Frozen-slot gradients (`grad_input`, `grad_dk_scale`, `grad_target`) are
  captured in `capture.txt` but not recorded here.
- `final-params.json` — `{"fixture", "after_steps": 8, "final_params": [tensor...]}`.
- `fd-validation.json` — per-element `{index, fd, companion, delta, tol, pass}`.

## Regeneration

```bash
cd examples/training/bert-tiny-fragment
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

- capture.txt sha256: `6a29365450eb2117af6b6fdab8b6ac1c6f6778d3cced98baf15a9f2f23541800`
- fixture run output sha256 (two runs identical): `92b814063d36fc9a185a95c313922cf5a0343fb70c4c988fe2456827360aa7c5`
- fixture output is a byte-identical suffix of capture.txt (cross-check).
- Loss trace replay (independent f64 replay of the trajectory from captured
  gradients): all 8 steps match, worst delta ~2.2e-16 (rule tol ~2.5e-6).
- FD gradient validation: 528/528 trainable elements pass, worst delta
  ~1.49e-6 (rule tol ~1e-4). Per-param worst: ln1_s 1.49e-6, ln1_o 1.18e-6,
  wq 5.9e-7, wk 4.0e-7, all others below 2.4e-7.
- All captured values finite.
