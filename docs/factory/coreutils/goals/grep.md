# Goal: coreutils — `grep`

**Status**: stepper-slice
**Campaign**: [`../CAMPAIGN.md`](../CAMPAIGN.md)
**Ledger row**: [`../ledger.md`](../ledger.md) § Stage 4
**Parity contract**: [`../parity-contract.md`](../parity-contract.md)
**Primary surfaces**: `coreutils/packages/grep/`

## Utility

GNU coreutils `grep` — Stage 4 stdin-only literal substring stepper slice.

## Objective

Implement a Faber package that matches GNU `ggrep` for declared stdin fixtures:
literal substring selection over newline-terminated ASCII lines with positional
PATTERN or repeated `-e PATTERN`, plus simple `-i`, `-v`, `-c`, and `-n`
modes.

## Deliverables

- `coreutils/packages/grep/faber.toml`
- `coreutils/packages/grep/src/main.fab`
- `coreutils/harness/fixtures/grep/cases.toml`
- Inline `probandum` / `proba` coverage for pure literal matching, inversion,
  count, line-number formatting, repeated option-pattern OR behavior, and
  pattern selection helper logic.

## Capability matrix

| Action / flag | Stepper | Rust | Notes |
| --- | --- | --- | --- |
| stdin positional PATTERN | slice | pending | First operand is the literal pattern |
| `-e PATTERN` | slice | pending | Repeated option patterns win over positional pattern |
| multiple `-e` patterns | slice | pending | Literal OR over all supplied option patterns |
| literal substring matching | slice | pending | No regex semantics in this slice |
| `-i` ignore case | slice | pending | Uses `textus.minuscula()`; fixtures are ASCII |
| `-v` invert match | slice | pending | Declared fixtures still have selected lines |
| `-c` selected line count | slice | pending | Emits a single count line |
| `-n` line numbers | slice | pending | One-based input positions with `N:` prefix |
| no-match exit status 1 | no | pending | Deferred dynamic exit modeling |
| regex / BRE / ERE / fixed-mode distinctions | no | pending | Deferred matcher families |
| file operands | no | pending | Deferred source adapter work |
| binary input policy | no | pending | Deferred |
| context output / color / recursive search | no | pending | Deferred GNU surfaces |
| diagnostics | no | pending | Deferred CLI diagnostic parity |
| help/version | no | pending | Deferred |
| locale-sensitive case folding | no | pending | ASCII fixtures only |

## Unsupported-in-stepper policy

This slice is stdin-only and line-oriented. It intentionally avoids regex
semantics, file operands, binary input policy, context output, color, recursive
search, diagnostics, help/version, and locale-sensitive case folding. Pattern
matching is a plain substring test; metacharacters are ordinary characters for
this Stage 4 package.

`lege` returns `textus ∪ nihil`; EOF stops the stream without producing a
synthetic final line. Fixtures are newline-terminated ASCII cases where GNU
`ggrep` exits 0. GNU's no-match exit status 1 is explicitly deferred because the
current stepper package entry emits output but does not model a dynamic process
exit status cleanly.

## Acceptance

- `faber check coreutils/packages/grep` passes.
- Inline package tests pass through `faber test coreutils/packages/grep`.
- `./scripta/check-coreutils-parity grep --backend stepper` passes declared
  Stage 4 fixtures against GNU `ggrep`.

## Validation

```bash
cargo run -q --manifest-path ../faber/Cargo.toml -- format coreutils/packages/grep/src/main.fab
timeout 120 cargo run --manifest-path ../faber/Cargo.toml -- check coreutils/packages/grep
timeout 120 cargo run --manifest-path ../faber/Cargo.toml -- test coreutils/packages/grep
timeout 120 ./scripta/check-coreutils-parity grep --backend stepper
git diff --check
```

## Evidence

Initial stepper slice adds:

- inline `proba` coverage for literal substring matching, ASCII ignore-case
  behavior, invert mode, count mode, line-number prefixes, repeated `-e`
  literal OR matching, and `-e` versus positional pattern selection.
- parity fixtures for positional literal match, `-e`, repeated `-e` OR,
  repeated `-e` with `-c`, repeated `-e` with `-v`, repeated `-e` with `-n`,
  `-i`, `-v` with selected output lines, `-c`, and `-n`.

Repeated `-e` stepper update adds a local raw-operand parser because the
generated CLI option parser exposes one value per option binding. It preserves
the current supported flags and treats all supplied `-e PATTERN` values as an OR
list.

Remaining unsupported GNU surfaces: regex semantics, file operands, binary input
policy, context output, color, recursive search, diagnostics, help/version,
locale-sensitive case folding, no-match exit status, and Rust ship validation.

## Lowers from

Campaign Stage 4.
