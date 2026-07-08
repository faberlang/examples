# Goal: coreutils — `nl`

**Status**: stepper-slice
**Campaign**: [`../CAMPAIGN.md`](../CAMPAIGN.md)
**Ledger row**: [`../ledger.md`](../ledger.md) § Stage 4
**Parity contract**: [`../parity-contract.md`](../parity-contract.md)
**Primary surfaces**: `examples/coreutils/packages/nl/`

## Utility

GNU coreutils `nl` — Stage 4 stdin-only line-oriented stepper slice.

## Objective

Implement a Faber package that matches GNU `nl` for declared stdin fixtures:
default body-line numbering for non-empty lines, blank-line preservation,
supported body-numbering all-lines form accepted by the current CLI parser, and
focused GNU line-number formatting flags for starting number, increment, width,
and left-justified number formatting.

## Deliverables

- `examples/coreutils/packages/nl/faber.toml`
- `examples/coreutils/packages/nl/src/main.fab`
- `examples/coreutils/harness/fixtures/nl/cases.toml`
- Inline `probandum` / `proba` coverage for pure numbering and formatting logic.

## Capability matrix

| Action / flag | Stepper | Rust | Notes |
| --- | --- | --- | --- |
| stdin default body numbering | slice | pending | Reads nullable `lege` until EOF |
| blank line preservation | slice | pending | Blank lines are emitted unnumbered by default |
| `-b a` / `--body-numbering=a` | slice | pending | Current CLI supports short option plus separate value and long inline value |
| `-v N` / `--starting-line-number=N` | slice | pending | Sets first emitted body line number |
| `-i N` / `--line-increment=N` | slice | pending | Advances only after numbered records |
| `-w N` / `--number-width=N` | slice | pending | Positive widths replace default six-column field |
| `-n ln` / `--number-format=ln` | slice | pending | Left-justifies number text within the active width |
| combined GNU `-ba` spelling | no | pending | Deferred until CLI parsing supports attached short option values |
| file operands | no | pending | Deferred source adapter work |
| headers/footers/logical pages | no | pending | Deferred |
| custom separator / other number formats | no | pending | Deferred |
| invalid option diagnostics | no | pending | Deferred CLI diagnostic parity |
| help/version | no | pending | Deferred |

## Unsupported-in-stepper policy

This slice is stdin-only and line-oriented. It intentionally avoids file
operands, logical page delimiters, headers/footers, custom separators, number
formats other than `ln` and the default right-aligned no-leading-zero form,
invalid option diagnostics, and help/version output. The GNU combined short
form `-ba` is not claimed because Faber currently parses text-valued short
options as `-b a`, not attached `-ba`.

## Acceptance

- `faber check examples/coreutils/packages/nl` passes.
- Inline package tests pass through `faber test examples/coreutils/packages/nl`.
- `./scripta/check-coreutils-parity nl --backend stepper` passes declared
  Stage 4 fixtures against GNU `gnl`.

## Validation

```bash
faber check examples/coreutils/packages/nl
faber test examples/coreutils/packages/nl
./scripta/check-coreutils-parity nl --backend stepper
```

## Evidence

Initial stepper slice adds:

- inline `proba` coverage for default non-empty body-line numbering, all-lines
  body numbering, six-column right-aligned number formatting, body-style option
  selection, starting number, line increment, positive width, width fallback,
  and left-justified `ln` number formatting.
- parity fixtures for empty stdin, one non-empty line, multiple non-empty
  lines, default blank-line preservation, `-b a` all-lines numbering, `-v N`,
  `-i N`, `-w N`, and `-n ln`.

Remaining unsupported GNU surfaces: file operands, logical page sections,
custom separators, number formats other than `ln` and default right alignment,
combined `-ba`, invalid option diagnostics, help/version, and Rust ship
validation.

## Lowers from

Campaign Stage 4.
