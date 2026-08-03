# device-summa — CPU/FMIR Oracle Reference (S1-6 vertical slice)

Pinned deterministic CPU/FMIR oracle references for
`examples/training/device-summa/` — the differentiable-GPU campaign's S1-6
vertical-slice proof (stage-0-delivery.md §10.4). The fixture carries one
already-proven collection kernel (a tree reduction, the `summa` recipe floor
R2) from Faber source through the common device program, the packaged FMIR
image, the composite host, and real Metal/CUDA sessions via the ordinary
`faber run --backend <metal|cuda>` command.

The fixture `src/device_summa.fab` is **read-only**; it is the pinned oracle
input. All oracle content was captured by running the same `a.summa()`
collection op through the MIR stepper on CPU (burgus, macOS) **before any
device result was observed** (numeric-policy.md v1.0.0 immutability + S0-C
convention).

## Purpose

When the device route executes the kernel on Metal (burgus) or CUDA (pharos),
its readback is compared per element against these references using the frozen
numeric policy (numeric-policy v1.0.0, §3.1 reduction-sum row).

## Fixture

| | |
|---|---|
| entry | `src/device_summa.fab` (`@ nucleum` kernel `summa`) |
| kernel | `summa(tf32[256] a, tf32[1] out, u32 id) → vacuum` — `out[id] ← a.summa()` |
| recipe | `CollectionKernelPlan::TreeReduction`, 256-lane workgroup → 1 workgroup, 1 output element |
| inputs | `a[i] = i * 0.5 + 1.0` for `i in 0..256` (declared in `faber.toml` `[device] inputs`) |
| expected sum | **16576.0** (exact; every value and every partial is exactly representable in f32) |
| run (device) | `faber run --backend metal .` / `faber run --backend cuda .` |
| run (CPU oracle) | `faber script oracle/capture.fab` |

## File inventory

| File | Content |
|---|---|
| `capture.fab` | CPU-only capture runner: the same `a.summa()` op with the same 256 inputs, no `@ nucleum` annotation, printed via `nota` (provenance documented in its header). |
| `capture.txt` | Raw, byte-deterministic stepper capture (the f32 sum). |
| `capture.sha256` | SHA-256 of `capture.txt`. |
| `reference.json` | Pinned reference: input shape/formula, expected sum, policy version + family row. |

## Validation rules (frozen numeric-policy v1.0.0)

Applies elementwise; `b` = reference (this file). Shapes must match.
`|a_i − b_i| ≤ atol + rtol·|b_i|`. Any NaN or ±Inf in observed or reference
value → FAIL (all pinned observations are finite).

| Family | atol | rtol |
|---|---|---|
| reduction sum/mean (loss trace + this kernel) | 1e-6 | 1e-6 |

The reference value is exact (16576.0): every input `i*0.5+1.0` is exactly
representable in f32 (magnitude ≤ 127.5, half-integer), and every partial sum
is exactly representable up to the total (16576.0 ≤ 2^24), so the device tree
reduction and the CPU reference agree bit-for-bit. The tolerance row is the
policy backstop (R2 `summa` floor), not a ceiling the exact proof approaches.

## Determinism evidence (2026-08-03)

- capture.txt sha256: `bd04aff0d90e92c61c230ab40d8340d3609be012a4f146023e12f71148499ac0`
- CPU oracle value: `16576.0` (f64-stepper display; parses back exactly).
- Two identical `faber script oracle/capture.fab` runs produce byte-identical
  output.

## Regeneration

```bash
cd examples/training/device-summa
faber script oracle/capture.fab > oracle/capture.txt
shasum -a 256 oracle/capture.txt   # must equal capture.sha256
```

If `src/device_summa.fab` or the inputs change, regenerate `capture.fab`
(instrumented copy), `capture.txt`, and `reference.json`.
