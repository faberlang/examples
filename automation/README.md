# Automation Example

This package is a Faber CLI example modeled after the sibling `../automations/` repository.

It is intentionally a skeleton. The first goal is to exercise Faber's current CLI/package shape while documenting the runtime gaps that need to close before a faithful automation executor is practical.

## Current Commands

```text
automation inventory list
automation inventory show <id>
automation inventory check <id>
automation runner dry-run <id>
```

The current command bodies print placeholder output. The fixture files under `fixtures/` define the reference data shape for later parsing and dry-run behavior.

The package is manifest-backed by `faber.toml`; use the directory path for normal commands.

## Validate

From the `examples/` repo root (sibling `faber` checkout required):

```bash
cargo run --manifest-path ../faber/Cargo.toml -- check automation
cargo run --manifest-path ../faber/Cargo.toml -- test automation
cargo run --manifest-path ../faber/Cargo.toml -- build automation
cargo run --manifest-path ../faber/Cargo.toml -- run automation -- inventory list
cargo run --manifest-path ../faber/Cargo.toml -- run automation -- runner dry-run sample-automation
cargo run --manifest-path ../faber/Cargo.toml -- emit -t rust --package automation
```

Or use a built `faber` on `PATH` with the same subcommands and paths.

Runnable CLI generation is Rust-only in the active compiler. See `PLAN.md` for the staged path from this skeleton to a closer executor port.
