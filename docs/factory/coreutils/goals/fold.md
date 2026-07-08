# Goal: coreutils — `fold`

**Status**: stepper-slice
**Campaign**: [`../CAMPAIGN.md`](../CAMPAIGN.md)
**Ledger row**: [`../ledger.md`](../ledger.md) § Stage 4
**Parity contract**: [`../parity-contract.md`](../parity-contract.md)
**Primary surfaces**: `examples/coreutils/packages/fold/`

## Utility

GNU coreutils `fold` — Stage 4 stdin-only line-oriented stepper slice.

## Objective

Implement a Faber package that matches GNU `fold` for declared stdin fixtures:
default width 80, `-w N` for positive integer widths, and the stdin-only
ASCII subset of `-s` / `--spaces` on newline-terminated text.

## Deliverables

- `examples/coreutils/packages/fold/faber.toml`
- `examples/coreutils/packages/fold/src/main.fab`
- `examples/coreutils/harness/fixtures/fold/cases.toml`
- Inline `probandum` / `proba` coverage for pure line folding logic.

## Capability matrix

| Action / flag | Stepper | Rust | Notes |
| --- | --- | --- | --- |
| stdin default width 80 | slice | pending | Reads nullable `lege` until EOF |
| `-w N` positive integer width | slice | pending | Character-counted `textus` folding |
| `-s` / `--spaces` ASCII stdin | slice | pending | Prefers the last literal space before/at width and preserves it |
| multiple stdin lines | slice | pending | Folds each line independently |
| file operands | no | pending | Deferred source adapter work |
| byte/column-exact folding | no | pending | Deferred raw/terminal column slice |
| `-b`, tab, backspace behavior | no | pending | Deferred GNU option parity |
| non-positive `-w` diagnostics | no | pending | This slice falls back to 80 internally |
| invalid option diagnostics | no | pending | Deferred CLI diagnostic parity |
| help/version | no | pending | Deferred |

## Unsupported-in-stepper policy

This slice is stdin-only and character-counted. Its `-s` support is limited to
declared ASCII fixtures where a literal space inside the scalar width window is
the only break preference. It intentionally avoids file operands, byte-exact
column behavior, tab expansion, backspace handling, `-b`, non-positive width
diagnostics, invalid option diagnostics, and help/version output. Fixtures
cover newline-terminated ASCII stdin cases that the stepper can honestly
compare against GNU `gfold`.

GNU rejects non-positive widths; this stepper slice does not claim those cases.
The implementation normalizes non-positive values to the default width so pure
helper tests stay finite, but no parity fixture depends on that behavior.

## Acceptance

- `faber check examples/coreutils/packages/fold` passes.
- Inline package tests pass through `faber test examples/coreutils/packages/fold`.
- `./scripta/check-coreutils-parity fold --backend stepper` passes declared
  Stage 4 fixtures against GNU `gfold`.

## Validation

```bash
faber check examples/coreutils/packages/fold
faber test examples/coreutils/packages/fold
./scripta/check-coreutils-parity fold --backend stepper
```

## Evidence

Initial stepper slice adds:

- inline `proba` coverage for short, exact-width, long, empty, and fallback-width
  pure folding behavior.
- parity fixtures for empty stdin, short line unchanged, default width no wrap
  for a short line, `-w 4` wrapping, and multiple input lines.

Follow-on stdin-only `-s` slice adds:

- inline `proba` coverage for simple space-preferred wrapping, long-word
  fallback, double-space trailing-space preservation, and blank input handling.
- parity fixtures for `-w 8 -s` simple space wrapping, `--spaces` long-word
  fallback, and `-w 6 -s` double-space trailing-space behavior.

Remaining unsupported GNU surfaces: file operands, byte/column-exact folding,
`-b`, tab and backspace behavior, non-positive width diagnostics, invalid option
diagnostics, help/version, and Rust ship validation.

## Lowers from

Campaign Stage 4.
