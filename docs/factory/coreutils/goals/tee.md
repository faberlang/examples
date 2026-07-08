# Goal: coreutils — `tee`

**Status**: stepper-slice
**Campaign**: [`../CAMPAIGN.md`](../CAMPAIGN.md)
**Ledger row**: [`../ledger.md`](../ledger.md) § Stage 4
**Parity contract**: [`../parity-contract.md`](../parity-contract.md)
**Primary surfaces**: `coreutils/packages/tee/`

## Utility

GNU coreutils `tee` — Stage 4 stdin-only stdout passthrough stepper slice.

## Objective

Implement a Faber package that matches GNU `gtee` for declared stdin fixtures
with no file operands: copy stdin lines to stdout, preserve blank lines in the
line-oriented stepper lane, and accept `-a` as a no-op when there are no output
files.

## Deliverables

- `coreutils/packages/tee/faber.toml`
- `coreutils/packages/tee/src/main.fab`
- `coreutils/harness/fixtures/tee/cases.toml`
- Inline `probandum` / `proba` coverage for pure no-file subset and stdout
  passthrough helper logic.

## Capability matrix

| Action / flag | Stepper | Rust | Notes |
| --- | --- | --- | --- |
| stdin to stdout passthrough | slice | pending | Reads nullable `lege` until EOF |
| empty stdin | slice | pending | Emits no output |
| single newline-terminated line | slice | pending | Emits the input line once |
| blank line preservation | slice | pending | Empty input lines are emitted as empty output lines |
| multiple lines | slice | pending | Emits one output line per input line |
| `-a` without file operands | slice | pending | Accepted as a no-op for declared fixtures |
| file operands | no | pending | Deferred output sink work |
| append behavior with files | no | pending | Deferred until file outputs exist |
| ignore interrupts / `-i` | no | pending | Deferred GNU surface |
| diagnostics | no | pending | Deferred CLI diagnostic parity |
| help/version | no | pending | Deferred |
| byte-exact missing-final-newline behavior | no | pending | Stepper uses line reads and newline writer |
| multibyte semantics | no | pending | Deferred; fixtures are simple text |

## Unsupported-in-stepper policy

This slice is stdin-only and line-oriented. It intentionally avoids file
operands, file output sinks, append behavior with files, ignore-interrupts,
diagnostics, help/version, byte-exact missing-final-newline behavior, and
multibyte semantics. The only supported option is `-a`, and only for the
declared no-file fixtures where it has no observable effect.

`lege` returns `textus ∪ nihil`; EOF stops processing without producing a
synthetic final line. Each non-EOF line is emitted through the harness newline
writer, so this Stage 4 slice validates newline-terminated stdin behavior rather
than byte-exact stream copying.

## Acceptance

- `faber check coreutils/packages/tee` passes.
- Inline package tests pass through `faber test coreutils/packages/tee`.
- `./scripta/check-coreutils-parity tee --backend stepper` passes declared
  Stage 4 fixtures against GNU `gtee`.

## Validation

```bash
cargo run -q --manifest-path ../faber/Cargo.toml -- format coreutils/packages/tee/src/main.fab
timeout 120 cargo run --manifest-path ../faber/Cargo.toml -- check coreutils/packages/tee
timeout 120 cargo run --manifest-path ../faber/Cargo.toml -- test coreutils/packages/tee
timeout 120 ./scripta/check-coreutils-parity tee --backend stepper
git diff --check
```

## Evidence

Initial stepper slice adds:

- inline `proba` coverage for no-file subset detection, `-a` no-op
  classification, and line passthrough.
- parity fixtures for empty stdin, a single line, blank line preservation,
  multiple lines, and `-a` no-file passthrough.

Remaining unsupported GNU surfaces: file operands, append behavior with files,
ignore-interrupts, diagnostics, help/version, byte-exact missing-final-newline
behavior, multibyte semantics, and Rust ship validation.

## Lowers from

Campaign Stage 4.
