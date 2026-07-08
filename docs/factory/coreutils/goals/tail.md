# Goal: coreutils — `tail`

**Status**: stepper-slice
**Campaign**: [`../CAMPAIGN.md`](../CAMPAIGN.md)
**Ledger row**: [`../ledger.md`](../ledger.md) § Stage 4
**Parity contract**: [`../parity-contract.md`](../parity-contract.md)
**Primary surfaces**: `examples/coreutils/packages/tail/`

## Utility

GNU coreutils `tail` — Stage 4 stdin-only stepper slice.

## Objective

Implement a Faber package that matches GNU `tail` for declared stdin line
fixtures: default last 10 lines, `-n N` last-count mode, and `-n +N`
one-based start-line mode.

## Deliverables

- `examples/coreutils/packages/tail/faber.toml`
- `examples/coreutils/packages/tail/src/main.fab`
- `examples/coreutils/harness/fixtures/tail/cases.toml`
- Inline `probandum` / `proba` coverage for pure line-selection logic.

## Capability matrix

| Action / flag | Stepper | Rust | Notes |
| --- | --- | --- | --- |
| stdin default last 10 lines | slice | pending | Reads nullable `lege` until EOF, then selects the final window |
| `-n N` non-negative integer count | slice | pending | Raw parser keeps unsigned counts in last-line mode; `0` emits no lines |
| `-n +N` one-based start line | slice | pending | `+1` emits all stdin, positions beyond EOF emit nothing |
| `-n -N` explicit last count | slice | pending | Parsed as GNU's signed last-line count form |
| stdin shorter than requested count | slice | pending | Emits available lines only |
| file operands | no | pending | Deferred source adapter work |
| byte counts `-c` | no | pending | Deferred |
| follow mode `-f` | no | pending | Deferred streaming/runtime behavior |
| invalid count diagnostics | no | pending | Deferred CLI diagnostic parity |
| help/version | no | pending | Deferred |

## Unsupported-in-stepper policy

This slice is stdin-only and line-oriented. It intentionally avoids file
operands, byte counts, follow mode, invalid count diagnostics, and help/version
output. Fixtures cover only newline-terminated stdin cases that the stepper can
honestly compare against GNU `gtail`.

`lege` returns `textus ∪ nihil`; EOF is handled by stopping the read loop
before selecting either the final bounded line window or the one-based
`-n +N` start-line window.

## Acceptance

- `faber check examples/coreutils/packages/tail` passes.
- Inline package tests pass through `faber test examples/coreutils/packages/tail`.
- `./scripta/check-coreutils-parity tail --backend stepper` passes declared
  Stage 4 fixtures against GNU `gtail`.

## Validation

```bash
faber check examples/coreutils/packages/tail
faber test examples/coreutils/packages/tail
./scripta/check-coreutils-parity tail --backend stepper
```

## Evidence

Initial stepper slice adds:

- inline `proba` coverage for short input, last-ten truncation, `-n`-style
  truncation, zero count, GNU `-n +N` start-line selection, and signed last-count
  parsing.
- parity fixtures for default stdin behavior, truncation to last ten lines,
  `-n 2`, `-n +3`, `-n +1`, `-n +N` beyond EOF, `-n -2`, `-n 0`, counts larger
  than input, and empty stdin.

Remaining unsupported GNU surfaces: file operands, byte counts, follow mode,
invalid option/count diagnostics, quiet/verbose headers, help/version, and Rust
ship validation.

## Lowers from

Campaign Stage 4.
