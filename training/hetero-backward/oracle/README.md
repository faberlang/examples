# hetero-backward — CPU/FMIR Oracle Reference (3R U7 G3 heterogeneous-output fixture)

Pinned deterministic CPU/FMIR oracle references for
`examples/training/hetero-backward/` — the differentiable-GPU campaign's
3R U7 G3 fixture. The fixture is the **heterogeneous-output backward case**:
the AIR-generated companion `hetero_backward(x, w, nil(), upstream)` returns
`iuncta(grad_x, grad_w)` with genuinely unequal extents `tf32[4]` and
`tf32[2]`, from Faber source through the common device program, the packaged
FMIR image, the composite host, and real Metal/CUDA sessions via the ordinary
`faber run --backend <metal|cuda>` command.

The fixture `src/hetero_backward.fab` is **read-only**; it is the pinned
oracle input. All oracle content was captured by running the loss + companion
chain arithmetic through the MIR stepper on CPU (burgus, macOS) **before any
device result was observed** (numeric-policy.md v1.0.0 immutability + S0-C
convention). Determinism was verified by capturing **twice**; both captures
produce byte-identical output (same `capture.sha256`).

## Purpose

When the device route executes the heterogeneous backward on Metal (burgus)
or CUDA (pharos), each readback element is compared against these references
using the frozen numeric policy (numeric-policy v1.0.0, §3.1 reduction-sum
row). Both gradient buffers must carry exactly their declared element counts
with per-output bounds evidence (G3).

## Fixture

| | |
|---|---|
| entry | `src/hetero_backward.fab` (`@ nucleum` + `@ radix lane "air"` + `@ radix backward "hetero_backward"`; kernels `hetero_loss`, `hetero_backward`) |
| forward | `hetero_loss(x[4], w[2]) → f32` — `loss = sum(x)`; TreeReduction recipe |
| backward | `hetero_backward(x[4], w[2], nil(), upstream) → iuncta(grad_x[4], grad_w[2])` — elementwise multi-output ABI, **union dispatch 4 with per-output guards** |
| inputs | `x = [1.0, 2.0, 3.0, 4.0]`, `w = [5.0, 6.0]` (declared in `faber.toml` `[device] inputs`) |
| expected loss | `10.0` (sum of x; exact in f32) |
| expected grad_x | `[1.0, 1.0, 1.0, 1.0]` (`d sum(x)/dx_i = 1`; exact) |
| expected grad_w | `[0.0, 0.0]` (w is a selected-but-unused parameter; `d loss/d w = 0`; exact) |
| run (device) | `faber run --backend metal .` / `faber run --backend cuda .` |
| run (CPU oracle) | `faber run -t fmir oracle/capture.fab` (from the package directory, pinned binary) |

## Why an unused second parameter?

G3 requires at least two different output extents in a generated backward.
The current device substrate combines different-shaped parameters only
through broadcast or matmul, and the elementwise device-kernel ABI accepts
only same-element-count kernels. An unused selected parameter is the
source-expressible route to a smaller second gradient extent; its zero
gradient is mathematically exact. The G3 substance is the heterogeneous
**bounds** on real devices — the union `[4]` dispatch must never overrun the
`[2]` buffer and the `[4]` buffer must never be left partial (per-output
guards, R6/P1; U3 emitter proofs in `crates/radix-mir-metal` and
`crates/radix-mir-llvm/tests/device_mode.rs`).

## Numeric policy citation

- Policy version: **numeric-policy v1.0.0**
- Applied row (§3.1): **reduction sum** (`atol=1e-6, rtol=1e-6`) for all
  readback elements.
- All values are exactly representable in f32, so the observed device output
  is expected to match bit-for-bit (`max_delta = 0`), with the policy
  tolerances as the backstop.
- NaN/Inf rule (§5.1): all pinned and observed values are finite by contract.

## Determinism evidence

`capture.txt` was generated twice from `capture.fab`; both runs produced
byte-identical output and the same SHA-256:

```
bd1ffee7a70ba3ba94647b0fb4a7ba7d358e68fd19ba9421b4ff354c30e7df49  oracle/capture.txt
```

The arithmetic is exact (no rounding anywhere in the chain), so the oracle is
deterministic by construction as well as by observation.
