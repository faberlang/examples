# mul-mean — Non-Exact Oracle Reference (S3-B1, the C3 honesty gate)

Pinned deterministic CPU/FMIR oracle references for
`examples/training/mul-mean/` — Stage 3 unit **S3-B1**
(`stage-3-delivery.md` §4 S3-B1) of the `gpu-training-lowering` campaign. The
fixture is the differentiable device workload `loss = mean(x · w)` over
N = 1000 elements: a device-resident forward kernel (elementwise mul +
tree-reduction mean) with the AIR-generated backward companion
`loss_backward(x, w, nil(), upstream) → (grad_x, grad_w)`.

**This is the C3 honesty gate.** Unlike the S0-D / S2-8 receipts (delta-0,
structurally exact — inadmissible per `stage-3-delivery.md` N3.7), this
fixture's inputs are **non-half-integer / non-structurally-exact**: no
analytic gradient element is exactly representable in f32, and the wide mean
reduction accumulates real f32 rounding. The numeric-policy v1.0.0 gradient
floor (`atol = rtol = 1e-4`, FD central `ε = 1e-3`) is a real limit, not a
backstop.

The fixture `src/mul_mean.fab` is **read-only**; it is the pinned oracle
input (S2-5 convention). All oracle content was captured by running the CPU
variant (`oracle/capture.fab`, no `@ nucleum`) through the FMIR stepper on
CPU (burgus, macOS) **before any device result was observed** (S0-C
convention; numeric-policy v1.0.0 immutability). Determinism was verified by
capturing **three times**; all captures are byte-identical (same
`capture.sha256`).

## Fixture

| | |
|---|---|
| entry | `src/mul_mean.fab` (`@ nucleum` + `@ radix lane "air"` + `@ radix backward "loss_backward"` — the SEM059-admitted differentiable device kernel) |
| forward | `simple_loss(x, w) = mean(x · w)` — elementwise mul + reduction over `tf32[1000]` |
| backward | `loss_backward(x, w, nil(), upstream) → iuncta(grad_x, grad_w)` — scalar 1/N division, fill/broadcast, elementwise gradient accumulation, tuple outputs |
| inputs | `x[i] = (10·(i+1)+3)/100`, `w[i] = (10·(i+1)+7)/100`, `i in 0..1000` (declared in `faber.toml` `[device] inputs`) |
| run (device) | `faber run --backend metal .` / `faber run --backend cuda .` (device observation is S3-A5/S3-A8's gate, NOT this unit) |
| run (CPU oracle) | `faber run -t fmir oracle/capture.fab` (pinned binary, from the package directory) |

## Non-exactness argument (representability)

Analytic gradients of `mean(x · w)` are `grad_w[i] = x[i]/N` and
`grad_x[i] = w[i]/N`. With the chosen construction every element is
**provably not exactly representable in f32**:

- `N = 1000 = 2³·5³` — not a power of two (so `1/N` itself is not a dyadic
  rational and the division rounds).
- `x[i] = (10·(i+1)+3)/100`, so `grad_w[i] = (10·(i+1)+3)/100000`
  (denominator `2⁵·5⁵`). The numerator is `≡ 3 (mod 5)`, hence never
  divisible by 5 — the `5⁵` factor of the denominator can never cancel, so
  the reduced denominator is never a power of two: **not representable**.
- `w[i] = (10·(i+1)+7)/100`, so `grad_x[i] = (10·(i+1)+7)/100000`; the
  numerator is `≡ 7 (mod 5)` — same argument, **not representable**.
- The inputs themselves are likewise non-dyadic (same modulus argument), so
  the fixture is non-half-integer in the strongest sense.

`oracle/tools/honesty_check.py` proves this in **exact rational arithmetic**
(a reduced fraction is f32-representable iff its denominator is a power of
two and its magnitude is in range) — no float round-trip can mask it. On the
pinned fixture it reports `0/2000` gradient elements representable and an f32
forward mean that differs from the exact mean by `5.43e-3` (the wide
reduction's accumulation rounds — the floor is exercised, delta is never 0).

## Numeric policy citation

- Policy version: **numeric-policy v1.0.0**
- Applied row (§3.1): **gradient** (`atol = rtol = 1e-4`, R4 council G6) for
  `grad_x`/`grad_w`; **reduction sum/mean** (`atol = rtol = 1e-6`) would
  apply to the forward loss when a later stage compares it.
- FD method (§4): central difference, `ε = 1.0e-3`
  (`FINITE_DIFFERENCE_EPSILON`), per-element perturbation.
- NaN/Inf rule (§5.1): every pinned value is finite by contract.

## File inventory

| File | Content |
|---|---|
| `src/mul_mean.fab` | The read-only device fixture (pinned oracle input). |
| `capture.fab` | CPU-only capture runner (no `@ nucleum`); same arithmetic + companion call, `nota` markers `loss` / `grad_x` / `grad_w`. |
| `capture.txt` | Raw byte-deterministic capture (marker/value stream; the f64 stepper's shortest-round-trip Display strings). |
| `capture.sha256` | SHA-256 of `capture.txt` (three captures, identical). |
| `gradients.json` | Pinned companion gradients, both slots (`grad_x`, `grad_w`), S0-C schema. |
| `reference.json` | Machine-readable fixture metadata: formulas, non-exactness counts, policy citation, expected values, capture hash. |
| `honesty-check.json` | Honesty-gate verdict for the real fixture (regenerate with `honesty_check.py`). |
| `fd-validation.json` | FD spot-check results (24 sampled elements, numeric-policy §4). |
| `tools/honesty_check.py` | **The unit's check** — proves non-exactness and REJECTS structurally-exact alternatives (exit 2). |
| `tools/fd_probe.py` | FD probe (central difference, `ε = 1e-3`) reusing the capture runner as the perturbed probe. |
| `tools/exact-alt.fab` | The structurally-exact alternative (S0-D pattern scaled wide: N=1024, half-integer inputs) — used only to demonstrate the REJECTION. |

## Determinism evidence

`capture.txt` was generated **three times** with the pinned binary; all three
runs produced byte-identical output and the same SHA-256:

```
d7896537693a1a2d50097a5cfc8bba05a9273932e4dae6c4e02ceb3809e691df  oracle/capture.txt
```

## Oracle self-check (CPU, before any device observation)

The pinned companion gradients pass two independent-reference legs:

| Leg | Reference | Coverage | Result |
|---|---|---|---|
| Exact analytic | `grad_w[i] = x[i]/N`, `grad_x[i] = w[i]/N` (exact rationals) | all 2000 elements | pass; worst delta 1.39e-17; 544 non-zero deltas (rule bound ≈ 1e-4) |
| Finite difference | numeric-policy §4 central difference, `ε = 1e-3`, perturbing the actual faber computation | 24 sampled elements (12 per slot, spread incl. first/last) | 24/24 pass; worst delta 2.30e-10 |

All values finite. The floor is exercised honestly — observed/reference
deltas are non-zero but six+ orders of magnitude inside the bound.

## Structurally-exact rejection evidence (done_when 4)

The unit's check rejects the S0-D exactness pattern reproduced at the same
workload shape (`oracle/tools/exact-alt.fab`: N=1024 power-of-two, half-
integer inputs, all gradients dyadic):

```
$ python3 oracle/tools/honesty_check.py \
    --capture oracle/tools/exact-alt.fab --no-gradients
REJECTED (structurally exact / delta-0):
  - N=1024 is a power of two (1/N division exact -> structurally-exact-eligible)
  - 2048/2048 input elements are exactly representable in f32 (half-integer / dyadic inputs -> S0-D pattern)
  - 2048/2048 analytic gradient elements are exactly representable in f32 -> the oracle would be structurally exact (delta-0); REJECTED as the S0-D exactness pattern
exit 2
```

## Regeneration

```bash
# pinned binary pre-check (N3.8): the on-PATH ~/.cargo/bin/faber debug build
# is stale and rejects SEM059; use a freshly built release binary.
FABER=/path/to/fresh/release/faber
$FABER check .                                        # ok (SEM059 shape admitted)
cd oracle
$FABER run -t fmir capture.fab > capture.txt          # regenerate capture
shasum -a 256 capture.txt                             # must equal capture.sha256
python3 tools/honesty_check.py --capture capture.fab --gradients gradients.json
python3 tools/fd_probe.py --faber "$FABER" --samples 12
```

The capture is byte-deterministic: two identical runs of the capture runner
produce byte-identical output. If `src/mul_mean.fab` or the inputs change,
regenerate `capture.fab` and all reference files.

## Forward note for S3-A8 (honest disclosure)

The **gradient tuple** is this unit's oracle subject and has orders of
magnitude of headroom under the gradient row (`1e-4`). The **forward loss**
is pinned too, but on a 1000-element non-exact reduction an f32 device mean
rounds at the `~1e-3` absolute level against the f64-exact oracle (the
sequential-f32 vs exact mean delta is `5.43e-3`; the reduction row bound at
`|b| ≈ 3343` is `≈ 3.3e-3`). S3-A8 should compare the loss with this in
mind (the reduction row was calibrated on exact S2-5-style receipts) or
treat the gradient tuple as the acceptance comparison — never weaken the
policy, just record the real deltas.
