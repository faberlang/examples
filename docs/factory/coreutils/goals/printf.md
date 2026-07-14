# Goal: coreutils — `printf`

**Status**: stepper-slice
**Campaign**: [`../CAMPAIGN.md`](../CAMPAIGN.md)
**Ledger row**: [`../ledger.md`](../ledger.md) § Stage 3
**Parity contract**: [`../parity-contract.md`](../parity-contract.md)
**Primary surfaces**: `coreutils/packages/printf/`

## Utility

GNU coreutils `printf` — Stage 3 deterministic formatter slice.

## Objective

Implement a small Faber package that matches GNU `printf` for the declared
stepper cases, including newline-terminated formats and raw no-newline output.
The current numeric slice supports plain decimal `%d` and `%i` conversions
without flags, widths, or precision.

## Deliverables

- `coreutils/packages/printf/faber.toml`
- `coreutils/packages/printf/src/main.fab`
- `coreutils/harness/fixtures/printf/cases.toml`
- Inline `probandum` / `proba` coverage for pure formatting logic.

## Capability matrix

| Action / flag | Stepper | Rust | Notes |
| --- | --- | --- | --- |
| plain format text | slice | pending | Parity fixtures limited to newline-containing formats |
| `%%` | slice | pending | Emits one literal percent |
| `%s` | slice | pending | Missing string argument becomes empty text |
| repeated format for extra arguments | slice | pending | Covered for one `%s` per format |
| `%b` | slice | pending | Supports basic `\n`, `\t`, `\r`, `\\` escapes |
| raw no-newline output | slice | pending | Uses `norma:consolum.dic` from this package unit |
| missing format operand diagnostic | no | pending | Deferred usage-error surface |
| plain decimal `%d` / `%i` | slice | pending | Parses explicit integer text arguments |
| other numeric formats | no | pending | Deferred |
| field widths / precision | no | pending | Deferred |

## Unsupported-in-stepper policy

GNU `printf` does not append an implicit newline. This slice writes the rendered
text directly through `norma:consolum.dic` from the package unit, so stepper
fixtures can include both newline-terminated and raw no-newline cases.

Unsupported format directives are emitted literally in this slice rather than
claimed as GNU-compatible behavior. No fixture exercises unsupported
directives.

The decimal numeric slice intentionally avoids missing numeric arguments, flags,
width, precision, unsigned/octal/hex/floating formats, quoted-character
operands, and invalid numeric argument diagnostics.

## Acceptance

- `faber check coreutils/packages/printf` passes.
- Inline package tests pass through `faber test coreutils/packages/printf`.
- `./scripta/check-coreutils-parity printf --backend stepper` passes declared
  Tier A fixtures.

## Validation

```bash
faber check coreutils/packages/printf
faber test coreutils/packages/printf
./scripta/check-coreutils-parity printf --backend stepper
```

## Evidence

- Inline `proba` cases cover plain text, `%%`, `%s`, format repetition, missing
  `%s` arguments, `%b` basic escapes, and plain `%d`/`%i` integer formatting.
- Stepper fixtures cover both newline-terminated GNU parity cases and raw
  no-newline output through `norma:consolum.dic`; the numeric slice adds
  explicit decimal integer fixtures.

## Lowers from

Campaign Stage 3.
