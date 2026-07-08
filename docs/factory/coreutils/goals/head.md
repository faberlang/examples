# Goal: coreutils — `head`

**Status**: stepper-slice
**Campaign**: [`../CAMPAIGN.md`](../CAMPAIGN.md)
**Ledger row**: [`../ledger.md`](../ledger.md) § Stage 4
**Parity contract**: [`../parity-contract.md`](../parity-contract.md)
**Primary surfaces**: `examples/coreutils/packages/head/`

## Utility

GNU coreutils `head` — Stage 4 stdin-only line-oriented stepper slice.

## Objective

Implement a Faber package that matches GNU `head` for declared stdin line
fixtures: default first 10 lines, `-n N` for non-negative integer counts, and
`-n -N` for all-but-final-N line counts.

## Deliverables

- `examples/coreutils/packages/head/faber.toml`
- `examples/coreutils/packages/head/src/main.fab`
- `examples/coreutils/harness/fixtures/head/cases.toml`
- Inline `probandum` / `proba` coverage for pure line-selection logic.

## Capability matrix

| Action / flag | Stepper | Rust | Notes |
| --- | --- | --- | --- |
| stdin default first 10 lines | slice | pending | Reads nullable `lege` until 10 lines or EOF |
| `-n N` non-negative integer count | slice | pending | Numeric CLI option; `0` emits no lines |
| `-n -N` negative integer count | slice | pending | Buffers stdin and emits all but the final N lines for N > 0 |
| stdin shorter than requested count | slice | pending | Emits available lines only |
| file operands | no | pending | Deferred source adapter work |
| byte counts `-c` | no | pending | Deferred |
| invalid count diagnostics | no | pending | Deferred CLI diagnostic parity |
| help/version | no | pending | Deferred |

## Unsupported-in-stepper policy

This slice is stdin-only and line-oriented. It intentionally avoids file
operands, byte counts, invalid count diagnostics, and help/version output.
Fixtures cover only newline-terminated stdin cases that the stepper can
honestly compare against GNU `ghead`.

`lege` returns `textus ∪ nihil`; EOF is handled by stopping the read loop
without unwrapping `nihil`.

## Acceptance

- `faber check examples/coreutils/packages/head` passes.
- Inline package tests pass through `faber test examples/coreutils/packages/head`.
- `./scripta/check-coreutils-parity head --backend stepper` passes declared
  Stage 4 fixtures against GNU `ghead`.

## Validation

```bash
faber check examples/coreutils/packages/head
faber test examples/coreutils/packages/head
./scripta/check-coreutils-parity head --backend stepper
```

## Evidence

Initial stepper slice adds:

- inline `proba` coverage for short input, truncation, zero count, and finite
  GNU-compatible negative count handling.
- parity fixtures for default stdin behavior, truncation at ten lines, `-n 2`,
  `-n 0`, `-n -2`, counts larger than input, negative counts larger than
  input, and empty stdin.

GNU `head -n -0` emits all input lines, but the current numeric CLI path
normalizes `-0` to `0`, so this package cannot distinguish that spelling from
`-n 0` without compiler/runtime CLI support.

Remaining unsupported GNU surfaces: file operands, byte counts, invalid
option/count diagnostics, quiet/verbose headers, help/version, and Rust ship
validation.

## Lowers from

Campaign Stage 4.
