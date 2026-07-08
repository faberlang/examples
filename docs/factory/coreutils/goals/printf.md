# Goal: coreutils — `printf`

**Status**: stepper-slice
**Campaign**: [`../CAMPAIGN.md`](../CAMPAIGN.md)
**Ledger row**: [`../ledger.md`](../ledger.md) § Stage 3
**Parity contract**: [`../parity-contract.md`](../parity-contract.md)
**Primary surfaces**: `examples/coreutils/packages/printf/`

## Utility

GNU coreutils `printf` — Stage 3 deterministic formatter slice.

## Objective

Implement a small Faber package that matches GNU `printf` for the declared
newline-terminated stepper cases while keeping the pure formatter logic ready
for raw-output parity once the stdout surface supports it.

## Deliverables

- `examples/coreutils/packages/printf/faber.toml`
- `examples/coreutils/packages/printf/src/main.fab`
- `examples/coreutils/harness/fixtures/printf/cases.toml`
- Inline `probandum` / `proba` coverage for pure formatting logic.

## Capability matrix

| Action / flag | Stepper | Rust | Notes |
| --- | --- | --- | --- |
| plain format text | slice | pending | Parity fixtures limited to newline-containing formats |
| `%%` | slice | pending | Emits one literal percent |
| `%s` | slice | pending | Missing string argument becomes empty text |
| repeated format for extra arguments | slice | pending | Covered for one `%s` per format |
| `%b` | slice | pending | Supports basic `\n`, `\t`, `\r`, `\\` escapes |
| raw no-newline output | ready | pending | `norma:consolum.dic` package-MIR bridge landed 2026-07-08; call from package entry unit (not only via `common/gnu`) |
| missing format operand diagnostic | no | pending | Deferred usage-error surface |
| numeric formats | no | pending | Deferred |
| field widths / precision | no | pending | Deferred |

## Unsupported-in-stepper policy

GNU `printf` does not append an implicit newline. The current coreutils package
stdout helper is line-oriented (`gnu_stdio.scribe_linea` delegates to `nota`),
so stepper parity fixtures only cover formats whose GNU output already ends in
a newline; the package trims that final newline before delegating to the line
writer. `norma:consolum.dic` is the intended raw text primitive, but
`faber run --interpret` currently rejects package MIR library imports such as
`norma:consolum`, so raw no-newline parity waits on that compiler/runtime gap.

Unsupported format directives are emitted literally in this slice rather than
claimed as GNU-compatible behavior. No fixture exercises unsupported
directives.

## Acceptance

- `faber check examples/coreutils/packages/printf` passes.
- Inline package tests pass through `faber test examples/coreutils/packages/printf`.
- `./scripta/check-coreutils-parity printf --backend stepper` passes declared
  Tier A fixtures.

## Validation

```bash
faber check examples/coreutils/packages/printf
faber test examples/coreutils/packages/printf
./scripta/check-coreutils-parity printf --backend stepper
```

## Evidence

- Inline `proba` cases cover plain text, `%%`, `%s`, format repetition, missing
  `%s` arguments, and `%b` basic escapes.
- Stepper fixtures cover only newline-terminated GNU parity cases because raw
  no-newline stdout is blocked outside this package scope.

## Lowers from

Campaign Stage 3.
