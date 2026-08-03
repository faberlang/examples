# device-summa-recollige — CPU/FMIR Oracle Reference (S2-5 two-kernel fixture)

Pinned deterministic CPU/FMIR oracle references for
`examples/training/device-summa-recollige/` — the differentiable-GPU
campaign's S2-5 ordinary two-kernel fixture. The fixture carries **two
dependent ordinary collection kernels** (two tree reductions, the proven
`summa` recipe) sharing a **device-resident intermediate**, from Faber source
through the common device program, the packaged FMIR image, the composite
host, and real Metal/CUDA sessions via the ordinary
`faber run --backend <metal|cuda>` command.

The fixture `src/device_summa_recollige.fab` is **read-only**; it is the
pinned oracle input. All oracle content was captured by running the two-kernel
chain arithmetic through the MIR stepper on CPU (burgus, macOS) **before any
device result was observed** (numeric-policy.md v1.0.0 immutability + S0-C
convention). Determinism was verified by capturing **twice**; both captures
produce byte-identical output (same `capture.sha256`).

## Purpose

When the device route executes the two-kernel chain on Metal (burgus) or CUDA
(pharos), each readback element is compared against these references using
the frozen numeric policy (numeric-policy v1.0.0, §3.1 reduction-sum row).

## Fixture

| | |
|---|---|
| entry | `src/device_summa_recollige.fab` (`@ nucleum` kernels `collige`, `recollige`) |
| kernel 1 | `collige(tf32[1024] a, tf32[4] medius, u32 id)` — `medius[id] ← a.summa()`; `CollectionKernelPlan::TreeReduction`, 256-lane workgroup → 4 per-workgroup partials |
| kernel 2 | `recollige(tf32[4] medius, tf32[1] exitus, u32 id)` — `exitus[id] ← medius.summa()`; `TreeReduction`, 4 lanes → 1 partial |
| intermediate | `medius` — one `BufferId` (InOut role, PerStep lifetime) unified across both kernels by the constructor (same name + shape); device-resident, never read back |
| inputs | `a[i] = i * 0.5 + 1.0` for `i in 0..1024` (declared in `faber.toml` `[device] inputs`) |
| expected medius | `[16576.0, 49344.0, 82112.0, 114880.0]` (each = sum of one 256-element segment; exact in f32) |
| expected exitus | `262912.0` (sum of the 4 partials = sum of all 1024 elements; exact in f32) |
| run (device) | `faber run --backend metal .` / `faber run --backend cuda .` |
| run (CPU oracle) | `faber script oracle/capture.fab` (from the package directory, dev faber) |

Kernel 2 is a reduction rather than an elementwise kernel because the Metal
emitter's collection-op surface deliberately stops at Sum/Mean and matmul
(elementwise `TensorAdd` "waits for its own recipe" — D-W6-A1 U3); the spec
sanctions "reduction + elementwise, or two reductions" (N2.6).

## Numeric policy citation

- Policy version: **numeric-policy v1.0.0**
- Applied row (§3.1): **reduction sum** (`atol=1e-6, rtol=1e-6`) for both
  `medius` and `exitus`.
- The fixture values are exactly representable in f32 (every input is a
  half-integer; every segment sum, partial, and the final total is exact), so
  the observed device output is expected to match bit-for-bit
  (`max_delta = 0`), with the policy tolerances as the backstop.
- NaN/Inf rule (§5.1): all pinned and observed values are finite by contract.

## Determinism evidence

`capture.txt` was generated twice from `capture.fab`; both runs produced
byte-identical output and the same SHA-256:

```
318f3683bfc5c7347a6116f4a5a9d1cb6e388f5eecf327fd05381e59cd229fce  oracle/capture.txt
```

The arithmetic is exact (no rounding anywhere in the chain), so the oracle is
deterministic by construction as well as by observation.
