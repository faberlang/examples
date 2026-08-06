# bert-tiny-fragment — CPU/FMIR Oracle Reference (S0-C, S6-U8 extended)

Pinned deterministic CPU/FMIR oracle references for `examples/training/bert-tiny-fragment/`.
Part of the `gpu-training-lowering` campaign: Stage 0 unit **S0-C** (exit-gate
bullet 5 — "CPU oracle inputs + expected traces pinned"), regenerated and
**extended to the Stage 6 exit gate** by **S6-U8** (serial integration):
intermediates, all 21 gradient tensors + norms, all 8 parameter-update
states, softmax row sums, and a finite-check pass over every captured value.

The fixture `src/train.fab` is **read-only**; it is the pinned oracle input.
All oracle content below was captured by running the fixture through the FMIR
stepper on CPU (burgus, macOS). No device run was involved.

## S6-U8 migration (2026-08-05)

`src/train.fab` moved to the Stage 5 MLP route and the correct bias
broadcasting (`stage-6-delivery.md` §S6-U8):

- the loss lane gained `@ nucleum` (alongside the existing `@ radix lane "air"`
  + `@ radix backward "bert_tiny_backward"`);
- the loop calls the S6-G1 Gradus surface (`nn.layernorm_2x8` /
  `nn.linear_2x8` / `nn.gelu_2x8`, `attention.scaled_dot_product_2x8`,
  `loss.mse_2x8`, `train.train_step_bert_linear` / `train_step_bert_layernorm`);
- biases are per-channel `[8]` via the S6-C2 `addita_bias` rank-extension add —
  the fragment's `[2,8]` duplicated-row workaround is gone (18 trainable
  tensors, 480 floats);
- `faber.toml` declares the `[device]` section (`backend = "auto"`,
  `steps = 8` validated against the source loop bound, host inputs for all 21
  tensors with the new `[8]` bias shapes, plus the `lr` scalar).

The forward at step 0 is identical to the pinned S0-C trajectory (the
`[2,8]` workaround stored the same per-dim bias twice), so step-0 loss
(`1.6336153358585264`) and the same-shape step-0 gradients match the old
oracle exactly; after the first update the fixed `[8]`-bias model
legitimately diverges from the workaround trajectory — that divergence is the
bias fix. The oracle below is the new reference.

## Purpose

When a later stage (Stage 6+) executes the same training program on Metal/CUDA,
its observed loss trace, intermediates, gradient tensors, update states, and
final parameters are compared per element against these references using the
frozen numeric policy in `numeric-policy.md` (v1.0.0). These files are that
reference.

## Fixture

| | |
|---|---|
| entry | `src/train.fab` |
| model | single-layer BERT-tiny fragment: pre-LN → Q/K/V projections → scaled dot-product attention → output projection → residual → LN → FFN (linear→GELU→linear) → residual → LN → MSE; B=2, D=8, H=1; **8-step** SGD (`lr = 0.01`) via the Gradus surface |
| trainable | 18 trainable tensors (480 floats): `wq,bq,wk,bk,wv,bv,wo,bo,wf1,bf1,wf2,bf2,ln1_s,ln1_o,ln2_s,ln2_o,ln3_s,ln3_o` — biases per-channel `[8]` |
| frozen | `input` [2,8], `dk_scale` [2,2], `target` [2,8] |
| lane | `@ nucleum` + `@ radix lane "air"` + `@ radix backward "bert_tiny_backward"` (S6-U8 device marking; the SEM059 shape) |
| companion | `@ radix backward "bert_tiny_backward"` (AIR-generated, CPU FMIR stepper), 21-slot gradient tuple (18 trainable + input, dk_scale, target) |
| manifest | `[device] backend = "auto"`, `steps = 8`, host inputs for all 21 tensors + `lr` (faber.toml) |
| run (CPU oracle) | `faber run -t fmir oracle/capture.fab` from the package directory |

## File inventory

| File | Content |
|---|---|
| `capture.fab` | Instrumented capture runner: generated from `src/train.fab` (arithmetic byte-identical) with the extended exit-gate `nota` schema; **deliberately omits the `@ nucleum` device marking** so the CPU oracle stays regenerable (the MLP S5-U7 convention). Provenance documented in its header. |
| `capture.txt` | Raw, byte-deterministic capture output (marker/value stream, see schema below). |
| `capture.sha256` | SHA-256 of `capture.txt`. |
| `inputs.json` | Initial params/inputs — all 21 tensors (pinned oracle inputs). |
| `loss-trace.json` | The 8-step loss trace. |
| `gradients.json` | Per-step gradient tensors from the CPU companion, **trainable slots only** (the 18 tensors above). Frozen-slot gradients (`grad_input`, `grad_dk_scale`, `grad_target`) live in `capture.txt` and `gradients-full.json`. |
| `gradients-full.json` | **S6-U8 extension:** all 21 gradient tensors per step **+ per-tensor L2 norm** (`sqrt(sum(x_i^2))`, derived from the captured tensors). |
| `final-params.json` | Trainable params after the 8 SGD steps. |
| `intermediates.json` | **S6-U8 extension:** the selected LayerNorm/score/softmax/context intermediates per step — `ln1` (LayerNorm), `scores` (scaled pre-softmax scores), `attn` (softmax weights), `context` (attn@V), `ln2`, `ln3` (LayerNorm). Family mapping per intermediate in the file. |
| `update-states.json` | **S6-U8 extension:** all 8 parameter-update states — the 18 trainable tensors after each SGD step. |
| `row-sums.json` | **S6-U8 extension:** softmax row sums per step (sum of each row of the captured `attn` tensor; ~1.0, reduction rule). |
| `fd-validation.json` | Per-element finite-difference gradient validation results (N1.9 FD rule). |
| `finiteness.json` | **S6-U8 extension:** finite-check pass over every captured value (capture.txt + all JSON references). |

## Capture schema

`capture.txt` is a marker/value stream, one value per line:

```
initial_input
[0.5, -0.3, 1.2, -0.7, ...]
...
step_loss
<loss at step 0>
intermediate_ln1
[...]
intermediate_scores
[...]
intermediate_attn
[...]
intermediate_context
[...]
intermediate_ln2
[...]
intermediate_ln3
[...]
grad_input
[...]
...
grad_target
[...]
update_wq
[...]
...
update_ln3_o
[...]
...
final_wq
[...]
...
```

Markers are bare lowercase identifiers; the value line that follows is the
stepper `nota` output: a flat, row-major list `[...]` for tensors or a bare
decimal for scalars. Markers repeat per training step (`step_loss`,
`intermediate_*`, `grad_*`, `update_*` appear 8 times, in step order). The
fixture's trailing `nota loss_trace` prints the aggregate loss list with no
marker prefix (a stray value line; skipped by the extractor).

Value encoding: every number is the verbatim stepper Display string. The FMIR
stepper computes float math in f64 (`radix-mir-stepper`), and `nota` emits the
f64 shortest round-trip decimal (`display_fractus`), so each string parses back
to the exact captured f64. The JSON reference files store these strings
verbatim; do not reformat them. The only **derived** values are the gradient
L2 norms and the softmax row sums (formulas in `gradients-full.json` /
`row-sums.json`), computed from the captured tensors and stored as Python
shortest-round-trip f64 reprs.

JSON reference files (shape `{"name", "shape", "values"}` per tensor; `values`
is the flat row-major list of value strings):

- `inputs.json` — `{"fixture", "source", "inputs": [tensor...]}`; all initial
  params/inputs as constructed by `seed.strue(...)` in the fixture.
- `loss-trace.json` — `{"fixture", "steps": 8, "lr": "0.01", "losses": [8
  strings], "rule"}`.
- `gradients.json` — `{"fixture", "rule", "method", "steps": [{"step",
  "gradients": [tensor...]}]}`. Records the **trainable** tensors only;
  gradient order per step is the trainable slot order `(grad_wq, grad_bq,
  grad_wk, grad_bk, grad_wv, grad_bv, grad_wo, grad_bo, grad_wf1, grad_bf1,
  grad_wf2, grad_bf2, grad_ln1_s, grad_ln1_o, grad_ln2_s, grad_ln2_o,
  grad_ln3_s, grad_ln3_o)`.
- `gradients-full.json` — the same 8 steps with all 21 slots (trainable +
  `input`, `dk_scale`, `target`) and a `"norms"` map (L2 per slot, per step).
- `intermediates.json` — `{"fixture", "steps", "intermediates": [{"step",
  "intermediates": [tensor...]}]}` in the order `ln1, scores, attn, context,
  ln2, ln3`, plus a `"families"` map naming each intermediate's numeric-policy
  row.
- `update-states.json` — `{"fixture", "after_steps": 8, "rule", "states":
  [{"step", "params": [tensor...]}]}` — the 18 trainable tensors after each
  of the 8 SGD updates.
- `row-sums.json` — `{"fixture", "steps", "rule", "row_sums": [{"step",
  "row_sums": [2 strings]}]}` — one sum per softmax row.
- `final-params.json` — `{"fixture", "after_steps": 8, "final_params":
  [tensor...]}`.
- `fd-validation.json` — per-element `{index, fd, companion, delta, tol, pass}`.
- `finiteness.json` — `{"fixture", "checked", "non_finite", "pass",
  "by_file"}` — the finite-check receipt.

## Regeneration

```bash
cd examples/training/bert-tiny-fragment
faber run -t fmir oracle/capture.fab > oracle/capture.txt   # regenerate capture
shasum -a 256 oracle/capture.txt                            # must equal capture.sha256

python3 oracle/tools/extract_reference.py  # rebuild the JSON reference files (incl. extensions)
python3 oracle/tools/finiteness.py         # finite-check receipt (oracle/finiteness.json)
python3 oracle/tools/fd_probe.py           # regenerate oracle/fd-validation.json
python3 oracle/tools/replay_loss.py        # independent f64 loss-trace replay
```

The capture is byte-deterministic: two identical runs of the capture runner
produce byte-identical output (verified at 8 steps, S6-U8). If
`src/train.fab` changes, regenerate `capture.fab` (instrumented copy) and all
reference files; the extractor, finiteness, FD probe, and replay scripts in
`oracle/tools/` then regenerate the references and the replay evidence (see
`oracle/tools/README.md` for the `faber` prerequisite and exit codes).

Note: with the S6-U8 `[device]` section declared, `faber run -t fmir .` on the
package entry runs the device route (the entry carries the `@ nucleum` lane).
The CPU oracle is therefore captured through `oracle/capture.fab`, which
carries no `@ nucleum` marking.

## Validation rules (numeric-policy v1.0.0)

Applies elementwise; `b` = reference (these files). Shapes must match.
`|a_i − b_i| ≤ atol + rtol·|b_i|`. Any NaN or ±Inf in observed or reference
value → FAIL (all pinned observations are finite — `finiteness.json`).

| Family | atol | rtol | Applies to |
|---|---|---|---|
| reduction sum/mean (loss trace, softmax row sums) | 1e-6 | 1e-6 | `loss-trace.json`, `row-sums.json` |
| elementwise | 1e-6 | 1e-5 | final params, update states, LayerNorm outputs, softmax weights |
| matmul | 1e-5 | 1e-5 | `scores`, `context` intermediates |
| gradient tensors | 1e-4 | 1e-4 | `gradients.json`, `gradients-full.json` |

Finite-difference validation: central difference, `ε = 1.0e-3`, per-element
perturbation of the actual faber computation (capture runner reused as the
probe); acceptance per element via the gradient rule.

## Determinism evidence (S6-U8, 2026-08-05)

- capture.txt sha256: `6831fbccc5cbfc0ed7616f843da330f57f5d2792acaa017fa428f52cb23a6421`
  (matches `capture.sha256`; verified by two independent fresh re-captures —
  byte-identical).
- `loss-trace.json`: 8 steps, step 0 `1.6336153358585264` → step 7
  `1.4606877132806497`, all finite, monotone non-increasing.
- Loss trace replay (independent f64, `tools/replay_loss.py`, with the
  `[8]`-bias broadcast): all 8 steps pass, worst delta ~2.2e-16 (rule tol
  ~2.6e-6).
- FD gradient validation (step-0 companion vs central-difference probe):
  480/480 trainable elements pass, worst delta ~1.49e-6 (rule tol ~1e-4).
- Finite-check (`tools/finiteness.py`): 23948 values checked across
  `capture.txt` + all JSON references, 0 non-finite → PASS.
- Step-0 loss and the same-shape step-0 gradients match the S0-C pinned
  oracle exactly (the `[8]`-bias forward at step 0 equals the duplicated-row
  workaround); from step 1 the fixed-bias trajectory is the new reference.
- Old `[2,8]` bias literals are gone from `src/train.fab`; the MLP fixture
  (`examples/training/mlp/**`) is byte-identical (untouched).

## Device route status (S6-U8)

The migrated package's `faber run -t fmir .` (device route, Metal on burgus)
is **blocked by a faber substrate gap** until the owner lands the
transformer-recipe signature dispatch in the device constructor:
`E_DEVICE_DESCRIPTOR: device program signature: kernel input and output
resource element types and counts must match; the return-buffer ABI is
elementwise-only — matmul and reduction kernels must use the indexed-view ABI`
(`faber/src/package/device/program.rs`, subchain signature dispatch). The
S6-P1 seam `transformer_subchain_signature_for_emission` exists in radix-mir
but is not wired in faber. Filed as need `b582bf70` (hand-5 → mind). This CPU
oracle is complete and pinned; the device-route acceptance (and U9/U10) waits
on that seam.
