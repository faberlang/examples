# Goal: coreutils — `uniq`

**Status**: stepper-slice
**Campaign**: [`../CAMPAIGN.md`](../CAMPAIGN.md)
**Ledger row**: [`../ledger.md`](../ledger.md) § Stage 4
**Parity contract**: [`../parity-contract.md`](../parity-contract.md)
**Primary surfaces**: `coreutils/packages/uniq/`

## Utility

GNU coreutils `uniq` — Stage 4 stdin-only line-oriented stepper slice.

## Objective

Implement a Faber package that matches GNU `uniq` for declared stdin fixtures:
default adjacent duplicate filtering plus `-c`, `-d`, `-u`, and ASCII
`-i` / `--ignore-case`, `-s N`, and `-w N` option selection for
newline-terminated streams.

## Deliverables

- `coreutils/packages/uniq/faber.toml`
- `coreutils/packages/uniq/src/main.fab`
- `coreutils/harness/fixtures/uniq/cases.toml`
- Inline `probandum` / `proba` coverage for pure grouping and output logic.

## Capability matrix

| Action / flag | Stepper | Rust | Notes |
| --- | --- | --- | --- |
| stdin adjacent duplicate filtering | slice | pending | Reads nullable `lege` until EOF |
| separated non-adjacent repeats | slice | pending | Distinct runs, matching GNU `uniq` |
| `-c` occurrence counts | slice | pending | Boolean CLI option; seven-column GNU count prefix |
| `-d` repeated groups only | slice | pending | Emits one line per adjacent duplicate group |
| `-u` singleton groups only | slice | pending | Emits groups with count one |
| `-i` / `--ignore-case` comparison | slice | pending | ASCII fixture coverage via `textus.minuscula()`; first input spelling is preserved |
| `-s N` skip leading characters | slice | pending | Comparison-key only; full first input line is emitted |
| `-w N` compare N characters | slice | pending | Applied after `-s`; non-positive or absent width leaves key unlimited |
| file operands | no | pending | Deferred source adapter work |
| field skipping | no | pending | Deferred comparison-key behavior |
| locale-sensitive case folding | no | pending | Deferred |
| invalid option diagnostics | no | pending | Deferred CLI diagnostic parity |
| help/version | no | pending | Deferred |

## Unsupported-in-stepper policy

This slice is stdin-only and line-oriented. It intentionally avoids file
operands, field comparison-key flags, locale-sensitive case folding, invalid
option diagnostics, and help/version output. Fixtures cover newline-terminated
stdin cases that the stepper can honestly compare against GNU `guniq`.

`lege` returns `textus ∪ nihil`; EOF is handled by stopping the read loop
without producing a synthetic final line.

## Acceptance

- `faber check coreutils/packages/uniq` passes.
- Inline package tests pass through `faber test coreutils/packages/uniq`.
- `./scripta/check-coreutils-parity uniq --backend stepper` passes declared
  Stage 4 fixtures against GNU `guniq`.

## Validation

```bash
faber check coreutils/packages/uniq
faber test coreutils/packages/uniq
./scripta/check-coreutils-parity uniq --backend stepper
```

## Evidence

Initial stepper slice adds:

- inline `proba` coverage for empty input, adjacent duplicate grouping,
  separated repeat preservation, GNU count formatting, duplicate-only output,
  and unique-only output.
- parity fixtures for empty stdin, no duplicates, adjacent duplicates,
  separated non-adjacent repeats, `-c`, `-d`, and `-u`.

Follow-on stdin-only slice adds:

- inline `proba` coverage for `-i` adjacent ASCII grouping, `-i -c`, and
  `-i -d`.
- parity fixtures for `-i`, `-i -c`, and `-i -d` in the stepper lane.

Character-key stdin-only slice adds:

- inline `proba` coverage for pure comparison keys with `-s`, `-w`,
  `-i -s`, `-c -w`, and non-positive width behavior.
- parity fixtures for `-s`, `-w`, `-i -s`, `-c -w`, `-d -s`, and `-u -w` in
  the stepper lane.

Remaining unsupported GNU surfaces: file operands, field skip comparison,
locale-sensitive case folding, all-repeated/all-unique variants, invalid option
diagnostics, help/version, and Rust ship validation.

No blocker was found for `-c`, `-d`, or `-u`; existing boolean CLI option
support covers this slice and the `-i` / `--ignore-case` follow-on.

## Lowers from

Campaign Stage 4.
