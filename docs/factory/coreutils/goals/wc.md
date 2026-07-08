# Goal: coreutils — `wc`

**Status**: stepper-slice
**Campaign**: [`../CAMPAIGN.md`](../CAMPAIGN.md)
**Ledger row**: [`../ledger.md`](../ledger.md) § Stage 4
**Parity contract**: [`../parity-contract.md`](../parity-contract.md)
**Primary surfaces**: `coreutils/packages/wc/`

## Utility

GNU coreutils `wc` — Stage 4 stdin-only line-oriented stepper slice.

## Objective

Implement a Faber package that matches GNU `wc` for declared stdin fixtures:
default line/word/byte output plus `-l`, `-w`, and `-c` boolean flag selection
for newline-terminated ASCII streams.

## Deliverables

- `coreutils/packages/wc/faber.toml`
- `coreutils/packages/wc/src/main.fab`
- `coreutils/harness/fixtures/wc/cases.toml`
- Inline `probandum` / `proba` coverage for pure counting and formatting logic.

## Capability matrix

| Action / flag | Stepper | Rust | Notes |
| --- | --- | --- | --- |
| stdin default line/word/byte counts | slice | pending | Reads nullable `lege` until EOF |
| `-l` line counts | slice | pending | Boolean CLI option |
| `-w` word counts | slice | pending | ASCII space/tab word boundaries in this slice |
| `-c` byte counts | slice | pending | Newline-terminated ASCII fixtures only |
| combined selected counts | slice | pending | GNU order: lines, words, bytes |
| file operands | no | pending | Deferred source adapter work |
| missing-final-newline byte parity | no | pending | `lege` exposes line text without delimiter |
| multibyte byte parity | no | pending | Deferred raw/byte-oriented slice |
| invalid option diagnostics | no | pending | Deferred CLI diagnostic parity |
| help/version | no | pending | Deferred |

## Unsupported-in-stepper policy

This slice is stdin-only and line-oriented. It intentionally avoids file
operands, missing-final-newline byte parity, multibyte byte parity, invalid
option diagnostics, and help/version output. Fixtures cover newline-terminated
ASCII stdin cases that the stepper can honestly compare against GNU `gwc`.

`lege` returns line text without the delimiter. The stepper slice therefore
accounts for one newline byte per returned line and limits byte-count parity to
newline-terminated ASCII fixtures.

## Acceptance

- `faber check coreutils/packages/wc` passes.
- Inline package tests pass through `faber test coreutils/packages/wc`.
- `./scripta/check-coreutils-parity wc --backend stepper` passes declared
  Stage 4 fixtures against GNU `gwc`.

## Validation

```bash
faber check coreutils/packages/wc
faber test coreutils/packages/wc
./scripta/check-coreutils-parity wc --backend stepper
```

## Evidence

Initial stepper slice adds:

- inline `proba` coverage for ASCII word counting, delimiter byte accounting,
  default GNU-style formatting, bare single-count formatting, and combined
  selected-count formatting.
- parity fixtures for empty stdin, one line, multiple lines, space-separated
  words, `-l`, `-w`, `-c`, and combined `-l -c`.

Remaining unsupported GNU surfaces: file operands, missing-final-newline byte
parity, multibyte byte parity, invalid option diagnostics, help/version, and
Rust ship validation.

## Lowers from

Campaign Stage 4.
