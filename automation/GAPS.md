# Automation Example Gaps

This document tracks the first gaps exposed by trying to model the sibling `../automations/` executor as a Faber CLI app.

The point is not to hide shortcomings. The point is to name them clearly enough that each one can become a scoped compiler, stdlib, runtime, or example task.

## 1. Package-Aware Checking

Resolved:

- `cargo run -p faber -- check examples/automation` checks the manifest-backed package graph.
- `cargo run -p faber -- test examples/automation` runs package-level `proba` checks through Cargo's Rust test harness.
- `cargo run -p faber -- emit -t rust --package examples/automation` remains the Rust emission gate for mounted command modules.
- `cargo run -p faber -- run examples/automation -- inventory list` builds and executes the generated CLI.

Original gap:

The `check` command did not provide the same obvious package-level confidence as Rust package emit.

Implemented direction:

- Add `check --package <entry.fab>`.
- Make `check` follow package-local imports when the input is a package entry point.

Current recommendation:

Use `check --package` as the package validation gate, and keep Rust package emit as the backend generation gate.

## 2. Front Matter Extraction

Current observation:

The production automation files are Markdown files with TOML front matter (using `+++` delimiters, matching the `explain/` corpus convention):

```markdown
+++
id = "sample-automation"
status = "PAUSED"
+++

Prompt body...
```

Faber now ships stdlib helpers for the automation metadata path:

- `norma:chorda.diducta(documentum, "+++")` — structural split into opaque metadata wire + body wire (`lista<textus> ⇥ textus`)
- `norma:toml.tempta` / `norma:toml.solve` — parse metadata wire to `valor`
- `norma:toml.exige` / `norma:toml.exige_claves` — strict required-key checks (single key or `lista<textus>`, `⇥ textus`)

Gap (narrowed):

Automation still needs local orchestration (read file → `diducta` → `tempta` → validate keys). No Markdown-specific wrapper beyond `chorda` + `toml`.

Near-term recommendation:

Wire `examples/automation` inventory/dry-run stages to `norma:chorda` + `norma:toml` directly; keep automation-specific predicates in exempla, not stdlib.

## 3. Filesystem Traversal

Current observation:

The production executor scans `*/SKILL.md`. The `norma:solum` library has directory listing, path joining, existence checks, reads, writes, and metadata.

Gap (narrowed):

`norma:solum.explora(radix, exemplar) → lista<textus> ⇥ textus` is on the stdlib contract (v1 shallow glob: `*` = one path segment). The native body is **not implemented** yet — blocked on radix parser bug [`DEFER-067`](../../docs/factory/deferred/defer-067.md) (`si expr ≡ "*" { }` fails parse). Calls `iace` with `DEFER-067` until fixed.

Possible directions until DEFER-067 lands:

- Handwrite shallow scanning in `examples/automation` using `solum.enumera` + path helpers.
- After DEFER-067: switch inventory to `solum.explora(fixturaRadix, "*/SKILL.md")`.

Near-term recommendation:

Use `explora` in new package code only for compile/contract smoke; expect runtime failure pre-impl. Prefer `enumera` composition in automation until DEFER-067 closes.

## 4. Time Runtime For Rust

Current observation:

Scheduling needs current epoch time, elapsed interval checks, lock aging, and timestamped log names. The `tempus` stdlib declaration exists, but Rust runtime support is not currently present.

Gap:

Full schedule parity should not be implemented until the Rust target can call stable time functions through `norma:tempus`.

Possible directions:

- Add Rust `norma::tempus` support for epoch seconds and milliseconds.
- Start with only the functions needed by the automation executor.
- Delay async sleep and callback scheduling until a separate use case needs them.

Near-term recommendation:

For Stage 2, avoid real schedule enforcement. For Stage 4, add the minimal Rust time runtime slice.

## 5. Process Result API

Current observation:

The production executor needs:

- command arguments
- cwd
- stdout log path
- stderr capture/filtering
- exit code
- success/failure branching

The current process surface is useful, but `processus.exsequi()` returns stdout and does not model the full result object needed by the executor.

Gap:

Faber needs a status-aware process API before a real automation runner can update state only after successful completion.

Possible directions:

- Add a new function that returns a result record with `codex`, `stdout`, and `stderr`.
- Extend process spawning so callers can redirect stdout and stderr to files.
- Keep simple `exsequi()` unchanged for shell-output convenience.

Near-term recommendation:

Do not overload `exsequi()`. Add a separate status-aware API when implementing the real runner.

## 6. Atomic State And Locking

Current observation:

The production executor uses:

- `state.json`
- lock files
- stale lock cleanup
- temp-file-then-rename state writes

Faber has enough filesystem basics to model part of this, but no explicit atomic-write or lock-file helper.

Gap:

Correct lock/state behavior needs either disciplined example-local code or a small stdlib helper.

Possible directions:

- Implement simple example-local lock files first.
- Add `solum.scribeAtomice()` for temp-write-and-rename.
- Add a lock helper only if several examples or tools need the same pattern.

Near-term recommendation:

Keep Stage 3 side-effect-free. Add lock and state writes only after time and process-result support exist.

## First Discussion Set

The first useful decisions are:

1. Should Stage 2 stay local and educational, or should it start hardening stdlib APIs immediately?
2. Should package-level validation become `check --package`?
3. Should front matter parsing remain example-local for now?
4. What should the process result record look like?
5. What is the minimum Rust `tempus` runtime slice needed for scheduler parity?
