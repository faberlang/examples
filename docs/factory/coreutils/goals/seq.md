# Goal: coreutils — `seq`

**Status**: stepper-slice
**Campaign**: [`../CAMPAIGN.md`](../CAMPAIGN.md)
**Ledger row**: [`../ledger.md`](../ledger.md) § Tier 0
**Parity contract**: [`../parity-contract.md`](../parity-contract.md)
**Primary surfaces**: `coreutils/packages/seq/`

## Utility

GNU coreutils `seq` — Tier A integer-only stepper slice.

## Objective

Implement the focused `seq` stepper slice as a Faber package that emits integer
ranges for the one-, two-, and three-operand forms, with GNU-compatible integer
custom separators and equal-width output for the covered integer subset.

## Capability matrix

| Action / flag | Stepper | Rust | Notes |
| --- | --- | --- | --- |
| `seq LAST` | yes | pending | Emits `1..LAST` inclusively |
| `seq FIRST LAST` | yes | pending | Emits inclusive unit-step range |
| `seq FIRST INCREMENT LAST` | yes | pending | Positive and negative integer increments |
| `seq -s SEP ...` | yes | pending | Joins rendered integers with `SEP`, then emits the final newline |
| `seq -w ...` | yes | pending | Equal-width integer output with zero padding, including negative sign handling |
| empty finite range | yes | pending | Emits no output |
| zero increment | unsupported | pending | Returns no output to avoid nontermination in this slice |
| non-integer operands | no | pending | Diagnostic parity deferred |
| options such as `-f`, help, version | no | pending | Later Tier B/C slice |
| floating-point operands | no | pending | Later slice |

## Unsupported-in-stepper policy

The current stepper slice is integer-only and does not declare GNU diagnostic
parity for invalid operand counts, invalid numbers, or zero increment. It also
excludes printf-style formatting, floating-point surfaces, help/version, and
diagnostic parity. Fixtures cover finite integer ranges, `-s SEP`, and integer
`-w`.

## Acceptance

- `faber check coreutils/packages/seq` passes.
- Inline package tests pass through `faber test coreutils/packages/seq`.
- `./scripta/check-coreutils-parity seq --backend stepper` passes declared
  Tier A integer range fixtures against GNU `gseq`.

## Validation

```bash
faber check coreutils/packages/seq
faber test coreutils/packages/seq
faber run --interpret coreutils/packages/seq -- 2 2 6
./scripta/check-coreutils-parity seq --backend stepper
cargo run -q --manifest-path ../faber/Cargo.toml -- format --check coreutils/packages/seq/src/main.fab
```

## Evidence

Initial stepper slice added:

- inline `proba` coverage for one operand, two operands, positive increment,
  negative increment, empty finite ranges, and zero increment avoiding hangs.
- parity fixtures for `seq 3`, `seq 3 5`, `seq 2 2 6`, `seq 5 -2 1`, and
  direction-mismatched empty ranges.

Follow-on integer formatting slice adds:

- line-start implementation comments in `main.fab` for range generation,
  operand parsing, separator behavior, and equal-width zero padding.
- inline `proba` coverage for comma separators, empty separators, positive
  equal-width output, and negative sign-aware equal-width output.
- parity fixtures for `seq -s , 1 3`, `seq -s '' 1 3`, and `seq -w 8 10`.

Remaining unsupported GNU surfaces: diagnostic parity, floating-point operands,
zero increment diagnostics, printf-style formatting, help/version, and Rust ship
validation.

## Lowers from

Campaign Stage 3.
