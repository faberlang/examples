# Goal: coreutils — `unexpand`

**Status**: stepper-slice
**Campaign**: [`../CAMPAIGN.md`](../CAMPAIGN.md)
**Ledger row**: [`../ledger.md`](../ledger.md) § Stage 4
**Parity contract**: [`../parity-contract.md`](../parity-contract.md)
**Primary surfaces**: `coreutils/packages/unexpand/`

## Utility

GNU coreutils `unexpand` — Stage 4 stdin-only line-oriented stepper slice.

## Objective

Implement a Faber package that matches GNU `unexpand` for declared stdin
fixtures: default leading ASCII spaces to tabs with tab stop 8, plus `-a` for
all ASCII space runs, `-t N` for positive integer tab stops, and GNU-style
comma/list tab stops for the declared ASCII stepper subset.

## Deliverables

- `coreutils/packages/unexpand/faber.toml`
- `coreutils/packages/unexpand/src/main.fab`
- `coreutils/harness/fixtures/unexpand/cases.toml`
- Inline `probandum` / `proba` coverage for pure unexpand helper logic.

## Capability matrix

| Action / flag | Stepper | Rust | Notes |
| --- | --- | --- | --- |
| stdin default leading spaces, tab stop 8 | slice | pending | Reads nullable `lege` until EOF |
| `-a` all ASCII space runs | slice | pending | Scalar-position counted |
| `-t N` positive integer tab stop | slice | pending | Single integer stops only |
| `-t A,B,...` finite absolute tab stops | slice | pending | Declared ASCII fixtures; no periodic stops after final listed stop |
| file operands | no | pending | Deferred source adapter work |
| first-only/all subtle GNU edge cases | no | pending | Deferred beyond declared fixtures |
| backspace/display-column semantics | no | pending | This slice counts ASCII scalar positions |
| invalid option/tab diagnostics | no | pending | Deferred CLI diagnostic parity |
| help/version | no | pending | Deferred |

## Unsupported-in-stepper policy

This slice is stdin-only and line-oriented. It intentionally avoids file
operands, subtle first-only/all GNU edge cases outside the declared fixtures,
backspace and terminal display-column semantics, diagnostics, and help/version
output. Fixtures are newline-terminated ASCII cases that the stepper can
honestly compare against GNU `gunexpand`.

`lege` returns `textus ∪ nihil`; EOF is handled by stopping the read loop
without producing a synthetic final line. The implementation counts scalar
positions and treats ASCII spaces as the conversion source; it does not claim
multibyte or terminal-column behavior.

## Acceptance

- `faber check coreutils/packages/unexpand` passes.
- Inline package tests pass through `faber test coreutils/packages/unexpand`.
- `./scripta/check-coreutils-parity unexpand --backend stepper` passes declared
  Stage 4 fixtures against GNU `gunexpand`.

## Validation

```bash
faber check coreutils/packages/unexpand
faber test coreutils/packages/unexpand
./scripta/check-coreutils-parity unexpand --backend stepper
```

## Evidence

Initial stepper slice adds:

- inline `proba` coverage for empty/no-space lines, default leading-space
  conversion, default interior-space preservation, `-a`, `-t 4`, `-t 4,8`, raw
  local flag parsing, and non-positive tab-stop fallback in pure helper logic.
- parity fixtures for empty stdin, no spaces, leading 8 spaces default, leading
  shorter spaces default, interior spaces default behavior, `-a`, `-t 4`, and
  combined `-a -t 4`.

Comma/list tab-stop slice adds:

- parity fixtures for `-a -t 4,8`, default leading-only `-t 4,8`, and finite
  final-stop behavior that preserves spaces after the last listed stop.
- raw `@ operandus ceteri textus` parsing so `-t 4`, `-t4`, `--tabs=4,8`,
  `-a`, and `--all` remain visible to package logic.

Remaining unsupported GNU surfaces: file operands, first-only/all subtle GNU
edge cases outside declared fixtures, backspace and display-column semantics,
diagnostics, help/version, and Rust ship validation.

## Lowers from

Campaign Stage 4.
