# Goal: coreutils — `cat`

**Status**: stepper-slice
**Campaign**: [`../CAMPAIGN.md`](../CAMPAIGN.md)
**Ledger row**: [`../ledger.md`](../ledger.md) § Stage 4
**Parity contract**: [`../parity-contract.md`](../parity-contract.md)
**Primary surfaces**: `coreutils/packages/cat/`

## Utility

GNU coreutils `cat` — Stage 4 stdin-only stepper slice.

## Objective

Implement a focused Faber package that reads standard input line by line with
nullable `lege` and writes each line through the existing GNU line-output
helper.

## Deliverables

- `coreutils/packages/cat/faber.toml`
- `coreutils/packages/cat/src/main.fab`
- `coreutils/harness/fixtures/cat/cases.toml`
- Inline `probandum` / `proba` coverage for operand-mode helper logic.

## Capability matrix

| Action / flag | Stepper | Rust | Notes |
| --- | --- | --- | --- |
| no operands, one newline-terminated stdin line | slice | pending | Reads nullable `lege`, writes with `scribe_linea` |
| empty stdin | slice | pending | Emits no output |
| single blank stdin line | slice | pending | Preserved as an empty output line |
| multi-line stdin | slice | pending | Repeated nullable `lege` calls preserve newline-terminated records |
| file operands | no | pending | Out of scope for this stdin slice |
| options such as `-n`, `-b`, `-s`, `-E`, `-T`, `-v` | no | pending | Later option slices |
| raw byte preservation | no | pending | Current slice is line-oriented text |
| missing trailing newline preservation | blocked | pending | Line writer always writes newline-terminated records |

## Unsupported-in-stepper policy

This slice claims only zero-operand, line-oriented stdin parity for empty stdin,
blank lines, and newline-terminated one-line or multi-line input. File operands,
diagnostics, byte-exact output, raw no-newline behavior, and display/numbering
options are excluded until the coreutils runtime surface can represent those
behaviors honestly.

## Acceptance

- `faber check coreutils/packages/cat` passes.
- Inline package tests pass through `faber test coreutils/packages/cat`.
- `./scripta/check-coreutils-parity cat --backend stepper` passes declared
  newline-terminated stdin fixtures.

## Validation

```bash
faber check coreutils/packages/cat
faber test coreutils/packages/cat
./scripta/check-coreutils-parity cat --backend stepper
```

## Evidence

Initial Stage 4 slice adds:

- inline `proba` coverage for zero-operand stdin mode and unsupported file
  operands.
- parity fixtures for empty stdin, one newline-terminated text line, one blank
  line, and multiple newline-terminated lines.

Remaining unsupported GNU surfaces: file operands, option handling,
diagnostic parity, byte-exact output, help/version, raw missing-final-newline
parity, and Rust ship validation.

## Lowers from

Campaign Stage 4.
