# Goal: coreutils — `echo`

**Status**: stepper-slice (`-n` landed 2026-07-08; `-e` subset landed 2026-07-14)
**Campaign**: [`../CAMPAIGN.md`](../CAMPAIGN.md)
**Ledger row**: [`../ledger.md`](../ledger.md) § Tier 0
**Parity contract**: [`../parity-contract.md`](../parity-contract.md)
**Primary surfaces**: `coreutils/packages/echo/`

## Utility

GNU coreutils `echo` — Tier A operand slice, leading `-E` no-op, `-n` raw
no-newline stdout, and a small leading `-e` escape subset.

## Objective

Implement `echo` as a Faber package that prints operands joined by spaces,
supports leading `-E` as a no-op, and supports leading `-n` without a trailing
newline via `norma:consolum.dic` on the package-MIR host bridge. The current
`-e` slice expands `\n`, `\t`, and `\\`.

## Capability matrix

| Action / flag | Stepper | Rust | Notes |
| --- | --- | --- | --- |
| no operands prints newline | yes | pending | Tier A |
| operands joined by one space | yes | pending | Tier A |
| leading `-E` | yes | pending | Consumed as a no-op before operands |
| `-E` after first operand | yes | pending | Treated as an operand |
| leading `-n` | yes | pending | Package entry calls `consolum.dic` |
| `-n` after first operand | yes | pending | Treated as an operand |
| leading `-e` escapes | slice | pending | Expands `\n`, `\t`, and `\\` |

## Unsupported-in-stepper policy

The `-e` slice intentionally covers only `\n`, `\t`, and `\\`. GNU's `\c`,
octal/hex escapes, alert/backspace/form-feed/carriage-return/vertical-tab
escapes, and combined short options such as `-ne` are not declared in this
slice.

Raw no-newline write must be invoked from the **package entry unit** (or a
module linked so package MIR rewrites `norma:consolum` providers). A helper in
`common/gnu/stdio.fab` that imports `norma:consolum` still leaves an unresolved
package provider under `--interpret` today — residual linker gap, not a missing
verb.

## Acceptance

- `faber check coreutils/packages/echo` passes.
- Inline package tests pass through `faber test coreutils/packages/echo`.
- `./scripta/check-coreutils-parity echo --backend stepper` passes declared
  Tier A fixtures including `stdout_newline = false` cases.

## Validation

```bash
faber check coreutils/packages/echo
faber test coreutils/packages/echo
faber run --interpret coreutils/packages/echo -- hello world
faber run --interpret coreutils/packages/echo -- -n hello
./scripta/check-coreutils-parity echo --backend stepper
```

## Evidence

- 2026-07-08: `echo -n` stepper parity 11/11 after `KernelModule::Consolum`
  (`dic`/`scribe`/`mone`) + host `write_stdout_raw` landed in radix/`faber`.
- 2026-07-14: leading `-e` expands the declared `\n`, `\t`, and `\\` subset.
- Inline `proba` covers operand join, `-E`, `-n` flag parsing, `-e` escape
  expansion, and combinations.
- Harness `stdout_newline = false` is strict (does not strip trailing newlines).

## Lowers from

Campaign Stage 2–3.
