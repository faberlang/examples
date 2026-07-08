# Goal: coreutils — `tac`

**Status**: stepper-slice
**Campaign**: [`../CAMPAIGN.md`](../CAMPAIGN.md)
**Ledger row**: [`../ledger.md`](../ledger.md) § Stage 4
**Parity contract**: [`../parity-contract.md`](../parity-contract.md)
**Primary surfaces**: `examples/coreutils/packages/tac/`

## Utility

GNU coreutils `tac` — Stage 4 stdin-only line-oriented stepper slice.

## Objective

Implement a Faber package that matches GNU `tac` for declared stdin line
fixtures: read all newline-terminated stdin records and write them in reverse
line order.

## Deliverables

- `examples/coreutils/packages/tac/faber.toml`
- `examples/coreutils/packages/tac/src/main.fab`
- `examples/coreutils/harness/fixtures/tac/cases.toml`
- Inline `probandum` / `proba` coverage for pure reverse-line logic.

## Capability matrix

| Action / flag | Stepper | Rust | Notes |
| --- | --- | --- | --- |
| stdin line reversal | slice | pending | Reads nullable `lege` until EOF, reverses buffered lines, emits via GNU stdio helper |
| empty stdin | slice | pending | Emits no output |
| blank line preservation | slice | pending | Preserves empty line payloads in the reversed stream |
| repeated lines | slice | pending | Reversal does not deduplicate |
| file operands | no | pending | Deferred source adapter work |
| separator options `-s` / `--separator` | no | pending | Deferred record-separator behavior |
| regex separators `-r` | no | pending | Deferred |
| before mode `-b` | no | pending | Deferred |
| invalid option diagnostics | no | pending | Deferred CLI diagnostic parity |
| help/version | no | pending | Deferred |

## Unsupported-in-stepper policy

This slice is stdin-only and line-oriented. It intentionally avoids file
operands, custom separators, regex separators, before-mode behavior, invalid
option diagnostics, and help/version output. Fixtures cover only
newline-terminated stdin cases that the stepper can honestly compare against
GNU `gtac`.

`lege` returns `textus ∪ nihil`; EOF is handled by stopping the read loop
before applying the pure reverse-line helper.

## Acceptance

- `faber check examples/coreutils/packages/tac` passes.
- Inline package tests pass through `faber test examples/coreutils/packages/tac`.
- `./scripta/check-coreutils-parity tac --backend stepper` passes declared
  Stage 4 fixtures against GNU `gtac`.

## Validation

```bash
faber check examples/coreutils/packages/tac
faber test examples/coreutils/packages/tac
./scripta/check-coreutils-parity tac --backend stepper
```

## Evidence

Initial stepper slice adds:

- inline `proba` coverage for empty input, single-line input, multi-line
  reversal, and preservation of blank and repeated line payloads.
- parity fixtures for empty stdin, one line, multiple lines, blank line
  preservation, and repeated lines.

Remaining unsupported GNU surfaces: file operands, custom separators, regex
separators, before-mode output, invalid option diagnostics, help/version, and
Rust ship validation.

## Lowers from

Campaign Stage 4.
