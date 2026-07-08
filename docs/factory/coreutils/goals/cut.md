# Goal: coreutils — `cut`

**Status**: stepper-slice
**Campaign**: [`../CAMPAIGN.md`](../CAMPAIGN.md)
**Ledger row**: [`../ledger.md`](../ledger.md) § Stage 4
**Parity contract**: [`../parity-contract.md`](../parity-contract.md)
**Primary surfaces**: `coreutils/packages/cut/`

## Utility

GNU coreutils `cut` — Stage 4 stdin-only field-selection stepper slice.

## Objective

Implement a Faber package that matches GNU `cut` for declared stdin fixtures:
default tab-delimited `-f LIST` and custom single-character ASCII delimiters via
`-d DELIM -f LIST`, with positive numeric field selectors, simple ranges,
`-s` / `--only-delimited`, and `--complement`.

## Deliverables

- `coreutils/packages/cut/faber.toml`
- `coreutils/packages/cut/src/main.fab`
- `coreutils/harness/fixtures/cut/cases.toml`
- Inline `probandum` / `proba` coverage for pure field-selection helper logic.

## Capability matrix

| Action / flag | Stepper | Rust | Notes |
| --- | --- | --- | --- |
| stdin `-f LIST`, default tab delimiter | slice | pending | Reads nullable `lege` until EOF |
| `-d DELIM -f LIST` | slice | pending | DELIM is scoped to one ASCII scalar |
| positive single field selectors | slice | pending | Examples: `1`, `2` |
| comma field lists | slice | pending | Example: `1,3`; output follows input field order |
| closed ranges | slice | pending | Example: `1-2` |
| open-ended ranges | slice | pending | Example: `2-` |
| no-delimiter line passthrough | slice | pending | Matches GNU default `cut -f` behavior |
| `-s`, `--only-delimited` | slice | pending | Suppresses lines without the active delimiter |
| `--complement` | slice | pending | Emits fields not selected by the positive selector/range subset |
| byte mode `-b` | no | pending | Deferred |
| character mode `-c` | no | pending | Deferred |
| file operands | no | pending | Deferred source adapter work |
| `--output-delimiter` | no | pending | Deferred |
| `-z` zero-terminated mode | no | pending | Deferred |
| diagnostics | no | pending | Deferred CLI diagnostic parity |
| help/version | no | pending | Deferred |
| multibyte/display semantics | no | pending | This slice counts Faber scalar positions |

## Unsupported-in-stepper policy

This slice is stdin-only and line-oriented. It intentionally avoids byte mode,
character mode, file operands, output delimiter rewriting, zero-terminated
records, diagnostics, help/version, and multibyte/display semantics. Delimiters
are accepted only for the declared one-scalar ASCII fixtures. Field list parsing
is limited to positive numeric selectors, comma lists, closed ranges, and
open-ended ranges; `--complement` inverts that subset only.

`lege` returns `textus ∪ nihil`; EOF stops the stream without producing a
synthetic final line. Lines that do not contain the active delimiter are passed
through unchanged, matching GNU `cut -f` default behavior, unless `-s` /
`--only-delimited` is present.

## Acceptance

- `faber check coreutils/packages/cut` passes.
- Inline package tests pass through `faber test coreutils/packages/cut`.
- `./scripta/check-coreutils-parity cut --backend stepper` passes declared
  Stage 4 fixtures against GNU `gcut`.

## Validation

```bash
cargo run -q --manifest-path ../faber/Cargo.toml -- format coreutils/packages/cut/src/main.fab
timeout 120 cargo run --manifest-path ../faber/Cargo.toml -- check coreutils/packages/cut
timeout 120 cargo run --manifest-path ../faber/Cargo.toml -- test coreutils/packages/cut
timeout 120 ./scripta/check-coreutils-parity cut --backend stepper
git diff --check
```

## Evidence

Initial stepper slice added:

- inline `proba` coverage for splitting with empty fields, single selectors,
  comma lists, closed ranges, open-ended ranges, and no-delimiter passthrough.
- parity fixtures for default tab field selection, custom comma delimiter with
  field 2, comma list `1,3`, range `1-2`, open-ended range `2-`, and
  no-delimiter passthrough.

Follow-on stepper slice adds:

- inline `proba` coverage for `-s` suppression and `--complement` selection.
- parity fixtures for `-s`, `--complement` with a single field, and
  `--complement` with a closed range.

Remaining unsupported GNU surfaces: byte mode, character mode, file operands,
output delimiter rewriting, zero-terminated records, diagnostics, help/version,
multibyte/display semantics, and Rust ship validation.

## Lowers from

Campaign Stage 4.
