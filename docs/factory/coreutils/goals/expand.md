# Goal: coreutils — `expand`

**Status**: stepper-slice
**Campaign**: [`../CAMPAIGN.md`](../CAMPAIGN.md)
**Ledger row**: [`../ledger.md`](../ledger.md) § Stage 4
**Parity contract**: [`../parity-contract.md`](../parity-contract.md)
**Primary surfaces**: `coreutils/packages/expand/`

## Utility

GNU coreutils `expand` — Stage 4 stdin-only line-oriented stepper slice.

## Objective

Implement a Faber package that matches GNU `expand` for declared stdin
fixtures: default tab stop 8, `-t N` for a single positive integer tab stop,
and comma/list absolute tab stops such as `-t 4,8` on newline-terminated ASCII
streams, plus GNU-compatible initial-only expansion for `-i` / `--initial`.

## Deliverables

- `coreutils/packages/expand/faber.toml`
- `coreutils/packages/expand/src/main.fab`
- `coreutils/harness/fixtures/expand/cases.toml`
- Inline `probandum` / `proba` coverage for pure tab-expansion helper logic.

## Capability matrix

| Action / flag | Stepper | Rust | Notes |
| --- | --- | --- | --- |
| stdin default tab stop 8 | slice | pending | Reads nullable `lege` until EOF |
| `-t N` positive integer tab stop | slice | pending | Single integer stops repeat every N columns |
| comma/list tab stops | slice | pending | Finite absolute stops; later tabs collapse to one space |
| `-i`, `--initial` initial-only mode | slice | pending | Expands only tabs in the leading blank prefix |
| multiple stdin lines | slice | pending | Expands each line independently |
| file operands | no | pending | Deferred source adapter work |
| backspace/display-column semantics | no | pending | This slice counts ASCII scalar positions |
| invalid option/tab diagnostics | no | pending | Deferred CLI diagnostic parity |
| help/version | no | pending | Deferred |

## Unsupported-in-stepper policy

This slice is stdin-only and line-oriented. It intentionally avoids file
operands, backspace and terminal display-column semantics, diagnostics, and
help/version output. Fixtures are newline-terminated ASCII cases that the
stepper can honestly compare against GNU `gexpand`.

`lege` returns `textus ∪ nihil`; EOF is handled by stopping the read loop
without producing a synthetic final line. The implementation counts scalar
positions and expands tab characters to ASCII spaces; it does not claim
multibyte or terminal-column behavior. With `-i` / `--initial`, only tabs in
the leading blank prefix are expanded; tabs after the first nonblank scalar are
preserved. With comma/list tab stops, tabs advance to the next listed absolute
stop, and tabs after the final listed stop become one space.

## Acceptance

- `faber check coreutils/packages/expand` passes.
- Inline package tests pass through `faber test coreutils/packages/expand`.
- `./scripta/check-coreutils-parity expand --backend stepper` passes declared
  Stage 4 fixtures against GNU `gexpand`.

## Validation

```bash
faber check coreutils/packages/expand
faber test coreutils/packages/expand
./scripta/check-coreutils-parity expand --backend stepper
```

## Evidence

Initial stepper slice adds:

- inline `proba` coverage for lines without tabs, leading tabs, interior tabs,
  custom positive tab stops, initial-only behavior, and non-positive tab-stop
  fallback in pure helper logic.
- parity fixtures for empty stdin, no-tab lines, leading tab default behavior,
  interior tab default behavior, `-t 4`, `-t 4,8`, post-final-list single-space
  fallback, `-i`, composed `-i -t 4`, composed `-i -t 4,8`, and multiple input
  lines.

Remaining unsupported GNU surfaces: file operands, backspace and display-column
semantics, diagnostics, help/version, and Rust ship validation.

## Lowers from

Campaign Stage 4.
