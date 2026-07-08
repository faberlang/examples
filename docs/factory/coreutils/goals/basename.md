# Goal: coreutils — `basename`

**Status**: stepper-slice
**Campaign**: [`../CAMPAIGN.md`](../CAMPAIGN.md)
**Ledger row**: [`../ledger.md`](../ledger.md) § Tier 0
**Parity contract**: [`../parity-contract.md`](../parity-contract.md)
**Primary surfaces**: `coreutils/packages/basename/`

## Utility

GNU coreutils `basename` — Tier A operand slice.

## Objective

Implement the focused `basename` stepper slices as a Faber package that prints
the final path component, removes one proper suffix operand, and covers the
conservative GNU `-s`/`--suffix` option path supported by current CLI parsing.

## Capability matrix

| Action / flag | Stepper | Rust | Notes |
| --- | --- | --- | --- |
| `basename PATH` | yes | pending | Tier A |
| trailing slash normalization | yes | pending | Tier A |
| repeated trailing slash normalization | yes | pending | Tier A/B stepper phase 2 |
| empty path operand | yes | pending | Tier A/B stepper phase 2 |
| root path `/` | yes | pending | Tier A |
| `basename PATH SUFFIX` | yes | pending | Proper suffix only; whole-name suffix is retained |
| `basename -s SUFFIX PATH` | yes | pending | Current CLI parser supports short text option values |
| `basename --suffix=SUFFIX PATH` | yes | pending | Current CLI parser supports inline long text option values |
| `basename -s SUFFIX PATH...` | yes | pending | `-s` option emits one basename per path |
| missing operand diagnostics | no | pending | Later Tier A/B slice |
| extra operand diagnostics | no | pending | Later Tier A/B slice |
| `-a`, `--multiple`, `-z` | no | pending | Later Tier B/C slice |

## Unsupported-in-stepper policy

The current slice declares operand behavior for one path and an optional suffix
operand, plus `-s`/`--suffix` text options for one or more paths. It does not
declare GNU diagnostic parity for missing operands, extra operands without
`-s`, `--multiple`/`-a`, or NUL-terminated `-z` output, so fixtures avoid those
cases.

## Acceptance

- `faber check coreutils/packages/basename` passes.
- Inline package tests pass through `faber test coreutils/packages/basename`.
- `./scripta/check-coreutils-parity basename --backend stepper` passes declared
  Tier A operand and suffix-option fixtures against GNU `gbasename`.
- Shared `common/gnu/*` helpers are imported directly, without package-local
  symlink workarounds.

## Validation

```bash
faber check coreutils/packages/basename
faber test coreutils/packages/basename
faber run --interpret coreutils/packages/basename -- /usr/bin/sort rt
faber run --interpret coreutils/packages/basename -- -s rt /usr/bin/sort
./scripta/check-coreutils-parity basename --backend stepper
```

## Evidence

Stepper phase 2 adds:

- inline `proba` coverage for empty path operands, repeated trailing slash
  collapse, short/long suffix-option removal, and multiple suffix-option paths.
- parity fixtures for `""`, `//usr//bin//`, `-s rt /usr/bin/sort`,
  `--suffix=rt /usr/bin/sort`, and `-s .c src/foo.c src/bar.c`.

Remaining unsupported GNU surfaces: missing operand diagnostics, extra operand
diagnostics outside `-s`, `-a`/`--multiple`, and `-z`.

## Lowers from

Campaign Stage 2.
