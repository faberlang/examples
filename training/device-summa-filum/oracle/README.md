# device-summa-filum — SFR-6 DistributedSum Oracle Reference (Metal native collective)

Pinned deterministic CPU oracle references for
`examples/training/device-summa-filum/` — the summa-filum-reduction
campaign's SFR-6 proof (delivery.md §SFR-6). The fixture carries the
declared distributed sum (`summa ex … filum …`, the SFR-5 plan entry)
through the Metal **native collective arm**: cyclic per-lane term-body
inline with private register accumulation, exactly one `simd_sum` at group
exit, broadcast result.

The fixture `src/device_summa_filum.fab` is **read-only**; it is the pinned
oracle input. All oracle content was captured by running the **sequential
spelling** of the same column-dot term through the CPU stepper (burgus,
macOS) **before any device result was observed** (S0-C convention;
numeric-policy v1.0.0).

## Purpose

When the device route executes the kernel on Metal (burgus), its readback
is compared per element against these references using the frozen numeric
policy (numeric-policy v1.0.0, §3.1 reduction-sum row). The comparison is
**never bit-exact**: the two spellings sum in different orders (the filum
form is cyclic per-lane + simdgroup collective; the oracle form is a
sequential fold), so the tolerance row is the contract even when this
fixture's values happen to land exactly.

## Fixture

| | |
|---|---|
| entry | `src/device_summa_filum.fab` (`@ nucleum` kernel `column_dot`) |
| kernel | `column_dot(tf32[32] a, tf32[1] out, u32 id) → vacuum` — F16 column-dot via the filum declaration |
| recipe | `CollectionKernelPlan::DistributedSum` (W = 32, K = 32 → 1 workgroup, 1 partial slot) |
| term | `t = s * 1.4140625` — every input value, the F16-grid weight, and every per-term product sit exactly on the binary16 grid (f16 column-dot semantics); lane accumulation is f32 |
| inputs | `a[i] = (i % 8) * 0.25 + 0.5` for `i in 0..32` (declared in `faber.toml` `[device] inputs`) |
| expected sum | **62.21875** |
| run (device) | `faber run --backend metal .` |
| run (CPU oracle) | `faber run oracle/capture.fab` |

## File inventory

| File | Content |
|---|---|
| `capture.fab` | CPU-only capture runner: the SEQUENTIAL spelling (`summa ex a apud [i] fixum s { … }`, no `filum`, no `@ nucleum`) with the same 32 inputs (provenance documented in its header). |
| `capture.txt` | Raw, byte-deterministic stepper capture (the f32 column-dot). |
| `capture.sha256` | SHA-256 of `capture.txt`. |
| `reference.json` | Pinned reference: input shape/formula, expected sum, policy version + family row, oracle spelling. |

## Validation rules (frozen numeric-policy v1.0.0)

Applies elementwise; `b` = reference (this file). Shapes must match.
`|a_i − b_i| ≤ atol + rtol·|b_i|`. Any NaN or ±Inf in observed or reference
value → FAIL (all pinned observations are finite).

| Family | atol | rtol |
|--- | ---: | ---: |
| reduction sum/mean (loss trace + this kernel) | 1e-6 | 1e-6 |

## Determinism evidence (2026-08-23)

- capture.txt sha256: `2d1dbf1d39c13183fd1f5f2b57673161fc6e5e378a2bcb227711030c5b9f2708`
- CPU oracle value: `62.21875` (f32 stepper display; parses back exactly).
- Two identical `faber run oracle/capture.fab` runs produce byte-identical
  output.

## Regeneration

```bash
cd examples/training/device-summa-filum
faber run oracle/capture.fab > oracle/capture.txt
shasum -a 256 oracle/capture.txt   # must equal capture.sha256
```

If `src/device_summa_filum.fab` or the inputs change, regenerate
`capture.fab` (instrumented copy), `capture.txt`, and `reference.json`.
