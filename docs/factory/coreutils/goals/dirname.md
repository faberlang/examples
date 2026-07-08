# Goal: coreutils — `dirname`

**Status**: stepper-slice
**Campaign**: [`../CAMPAIGN.md`](../CAMPAIGN.md)
**Ledger row**: [`../ledger.md`](../ledger.md) § Tier 0
**Parity contract**: [`../parity-contract.md`](../parity-contract.md)
**Primary surfaces**: `examples/coreutils/packages/dirname/`

## Utility

GNU coreutils `dirname` — Tier A simple-path plus conservative
slash-normalization stepper slice.

## Objective

Extend the `dirname` stepper slice so the package prints the directory portion
of simple path operands and handles the highest-value GNU slash normalization
cases that fit without shared helper or CLI-runtime changes.

## Capability matrix

| Action / flag | Stepper | Rust | Notes |
| --- | --- | --- | --- |
| plain filename returns `.` | yes | pending | Tier A |
| relative path with one slash | yes | pending | Tier A |
| nested relative path | yes | pending | Tier A |
| absolute path under `/` | yes | pending | Tier A |
| absolute nested path | yes | pending | Tier A |
| multiple path operands | yes | pending | Same helper, one output line per operand |
| trailing slash after basename, `foo/bar/` | yes | pending | Trims final slash run before selecting dirname |
| repeated trailing slash after basename, `foo/bar//` | yes | pending | Same normalization as single trailing slash |
| root path `/` | yes | pending | Preserved as `/` |
| repeated separator before basename, `foo//bar` | yes | pending | Returned dirname collapses to `foo` |
| no operand usage error | no | pending | Requires usage diagnostic + non-zero exit |
| options such as `--zero`, `--help`, `--version` | no | pending | Later slice |
| implementation-defined double-slash root spelling, `//` | no | pending | Later edge-case slice if the parity contract needs it |

## Unsupported-in-stepper policy

The current stepper slice intentionally excludes option parsing and no-operand
usage diagnostics because those require CLI-runtime behavior outside this
package slice. It also does not promise full GNU/POSIX double-slash root
semantics for `//`; the package normalizes root-like slash runs to `/`.

## Acceptance

- `faber check examples/coreutils/packages/dirname` passes.
- Inline package tests pass through `faber test examples/coreutils/packages/dirname`.
- `./scripta/check-coreutils-parity dirname --backend stepper` passes declared
  Tier A simple-path and slash-normalization fixtures.

## Validation

```bash
faber check examples/coreutils/packages/dirname
faber test examples/coreutils/packages/dirname
faber run --interpret examples/coreutils/packages/dirname -- usr/bin
./scripta/check-coreutils-parity dirname --backend stepper
```

## Evidence

Second focused phase adds inline `proba` coverage and parity fixtures for:

- `foo/bar/` → `foo`
- `foo/bar//` → `foo`
- `/` → `/`
- `foo//bar` → `foo`

## Lowers from

Campaign Stage 2.
