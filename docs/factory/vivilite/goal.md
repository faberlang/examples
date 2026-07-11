# Goal: ViviLite Application Exemplum

**Status**: Stage 0-1 file-backed scaffold landed
**Created**: 2026-07-09
**Refreshed**: 2026-07-10
**Target repo**: `/Users/ianzepp/work/faberlang/examples`
**Factory artifact dir**: `docs/factory/vivilite/`
**Primary surfaces**: `vivilite/` package, project-local `.vivi/` fixtures,
regular `vivi` oracle commands, future `sqlite:sqlite` library package.

---

## Summary

Build ViviLite as a Faber-native local mailspace CLI that demonstrates Faber can
manage agent-to-agent project communication in the same language used by the
agents it coordinates. ViviLite is not a full Vivarium replacement. It is an
application-lane proof focused on local mailspace tasks, needs, wants, mail,
and board output.

ViviLite can start with a file-backed scaffold and fixture store. Full
compatibility with regular Vivi's current project mailspace directory is gated
by a Faber SQLite library package because regular Vivi stores local mailspace
state in `.vivi/mail.sqlite`.

## Problem

Regular Vivi has become a useful inter-agent communication layer for Faber work,
but it is implemented in Rust and depends on infrastructure that is too broad
for an early Faber port: external mail, Proton, IMAP/SMTP, PGP, embeddings, and
SQLite-backed storage.

The useful application-lane target is narrower: local project mailspaces for
agent coordination. A Faber implementation should prove CLI ergonomics, local
state management, JSON output for agents, and oracle parity with regular Vivi
without dragging in remote mail or full Vivarium internals.

## Goals

- Create a Faber package for a `vivilite` CLI under `examples/vivilite/`.
- Support local mailspace discovery and explicit `--project` roots.
- Support identities, local mail, tasks, needs, wants, and board summaries.
- Provide `--json` output for agent control-plane commands.
- Use regular `vivi` as the behavioral oracle wherever possible.
- Allow early file-backed fixtures before SQLite is available.
- Add SQLite-backed read parity once the `sqlite` Faber library package exists.
- Add SQLite-backed write compatibility only after read parity is stable.

## Non-goals

- Proton, IMAP, SMTP, external sending, queues, remote mailbox mutation, PGP,
  embeddings, semantic search, or agent polling.
- Replacing the production `vivi` binary.
- Reimplementing Vivarium's full storage engine in Faber.
- Mutating real project `.vivi/` stores before fixture parity exists.
- Shelling out to `sqlite3` as the main compatibility strategy.
- Blocking all ViviLite scaffolding on SQLite.

## Ground Truth Researched

| Source | Evidence |
| --- | --- |
| `~/work/ianzepp/vivarium/README.md` | Current Vivi local mailspace commands and user-facing semantics. |
| `~/work/ianzepp/vivarium/src/local_mailspace_command.rs` | Command routing for mailspace, mail, task, need, want, and board local paths. |
| `~/work/ianzepp/vivarium/src/mailspace.rs` | Mailspace config, identity resolution, status totals, and `.vivi/mail.sqlite` store path. |
| `~/work/ianzepp/vivarium/src/mailspace/delivery.rs` | Send/list/move local mailspace semantics. |
| `../../../../faber/docs/factory/sqlite-library-package/goal.md` | SQLite package dependency and compatibility path. |
| Live `vivi board --project /Users/ianzepp/work/faberlang --for codex --json` | Current JSON shape for agent intake. |

## Reference Packet

- `~/work/ianzepp/vivarium/src/local_mailspace_command.rs`
- `~/work/ianzepp/vivarium/src/local_work_command.rs`
- `~/work/ianzepp/vivarium/src/local_work_list.rs`
- `~/work/ianzepp/vivarium/src/local_board_command.rs`
- `~/work/ianzepp/vivarium/src/mailspace.rs`
- `~/work/ianzepp/vivarium/src/mailspace/delivery.rs`
- `../../../../faber/docs/factory/sqlite-library-package/goal.md`
- `../../../../faber/docs/factory/unified-package-manifest/goal.md`
- `../../../automation/` for a smaller Faber CLI skeleton pattern
- `../../../ai-workbench/` for oracle-backed application proof posture

## Constraints And Invariants

- ViviLite is an application exemplum, not standard library code.
- The command surface should stay local-only and side-effect-contained.
- Regular `vivi` is the oracle for behavior and JSON shapes.
- Early file-backed storage is a bootstrap floor, not the final compatibility
  claim.
- SQLite-backed compatibility must use a Faber SQLite library package once that
  package exists.
- Read parity precedes write compatibility.
- Fixture project mailspaces must be used for destructive or mutating tests.
- `--json` outputs should be semantically comparable even if object field order
  differs.

## Architecture Direction

ViviLite has two storage lanes:

1. **File-backed floor** for early Faber implementation:

   ```text
   .vivilite/
     mailspace.toml
     messages.jsonl
     events.jsonl
   ```

   This lane proves command parsing, identity rules, message/work item state,
   and board rendering without requiring SQLite.

2. **Vivi-compatible lane** gated by `sqlite:sqlite`:

   ```text
   .vivi/
     mailspace.toml
     mail.sqlite
     blobs/
   ```

   This lane reads regular Vivi fixture mailspaces and later writes changes
   regular Vivi can read.

The CLI may expose the same user command names in both lanes, but compatibility
claims must name the active lane. Do not silently treat file-backed behavior as
regular Vivi compatibility.

## Dependency Order

| Dependency | Impact |
| --- | --- |
| Current Faber CLI/package support | Enough for command scaffold and file-backed floor. |
| `norma:solum`, `norma:json`, `norma:chorda` | Enough for file-backed fixture storage and JSON output. |
| SQLite library package | Required for reading regular Vivi `.vivi/mail.sqlite`. |
| Unified package manifest Phase 4 | Complete for binding-manifest and Rust ABI verification. |
| Unified package manifest Phase 3 | Open; required to link the verified SQLite library shim and dependencies into an application build unless research proves an equivalent path. |
| Regular Vivi oracle fixtures | Required for parity claims. |

ViviLite should start before SQLite only on lanes that do not claim regular Vivi
storage compatibility.

## Implementation Shape

### Stage 0 - Scaffold And Fixture Contract

Create `examples/vivilite/` with:

- `faber.toml`;
- package entrypoint and command modules;
- fixture mailspace data;
- README explaining file-backed vs Vivi-compatible lanes;
- no dependency on SQLite yet.

Acceptance:

- `faber check examples/vivilite` passes;
- `faber run examples/vivilite -- mailspace status --json --project <fixture>`
  emits deterministic JSON from file-backed fixtures.

### Stage 1 - File-Backed Local Work Floor

Implement local-only commands against the file-backed floor:

- `mailspace init/status`;
- `mailspace identity add/list`;
- `mail send/list/show`;
- `task send/list/show/done`;
- `need send/list/show/done`;
- `want send/list/show/promote/done`;
- `board --for <identity> --json`.

Acceptance:

- package tests cover state transitions;
- fixture validation covers board totals and handle stability;
- docs say this is not yet regular Vivi storage compatibility.

### Stage 2 - Regular Vivi Read Oracle

Delivery chart: [`stage-2-sqlite-read-delivery.md`](stage-2-sqlite-read-delivery.md).
Unit A now proves SQLite-backed board totals against a regular Vivi fixture.
The output labels its lane `sqlite-read` and leaves item arrays empty until the
remaining list/board parity units land.

After `sqlite:sqlite` read support exists, generate fixture mailspaces with
regular `vivi`, then read them with ViviLite:

```bash
vivi mailspace init --project <fixture>
vivi mailspace identity add codex --project <fixture>
vivi task send --project <fixture> --from codex --to codex --subject "..." --body "..."
vivi board --project <fixture> --for codex --json > expected.json
faber run examples/vivilite -- board --project <fixture> --for codex --json > actual.json
```

Acceptance:

- semantic JSON parity for status, task/need/want lists, and board;
- no writes to regular Vivi fixtures from ViviLite in this stage.

### Stage 3 - Regular Vivi Write Compatibility

Add writes to regular Vivi-compatible storage only after read parity:

- send a task/need/want with ViviLite;
- list/show/done with regular `vivi`;
- move a work item with ViviLite;
- verify regular `vivi board --json` reflects the mutation.

Acceptance:

- fixture-only mutation tests pass;
- no test touches `/Users/ianzepp/work/faberlang/.vivi` or other live mailspace
  stores.

## Acceptance Criteria

- ViviLite has a runnable Faber package in `examples/vivilite/`.
- File-backed floor supports local identities, messages, tasks, needs, wants,
  and `board --json`.
- The goal and README clearly separate file-backed floor from regular Vivi
  compatibility.
- SQLite-backed read parity matches regular `vivi` JSON outputs on generated
  fixtures once the SQLite package is available.
- SQLite-backed write compatibility is added only after read parity and is
  validated by regular `vivi`.

## Validation

File-backed floor:

```bash
cargo run --manifest-path ../faber/Cargo.toml -- check vivilite
cargo run --manifest-path ../faber/Cargo.toml -- test vivilite
cargo run --manifest-path ../faber/Cargo.toml -- run vivilite -- board --for codex --json --project <fixture>
```

Regular Vivi oracle:

```bash
vivi board --project <fixture> --for codex --json > expected.json
cargo run --manifest-path ../faber/Cargo.toml -- run vivilite -- board --project <fixture> --for codex --json > actual.json
```

Compare JSON semantically.

## Open Questions

- Should the package name be `vivilite`, `vivi-lite`, or `vivi-lite-exemplum`?
- Should early file-backed fixtures use `.vivilite/` to avoid confusion, or a
  `.vivi-lite/` directory that mirrors `.vivi/` naming?
- Which regular Vivi JSON fields are compatibility requirements versus display
  conveniences?
- Should regular Vivi compatibility start read-only forever, or should write
  compatibility become a required milestone?

## Stop Conditions

- Stop if implementation starts mutating a live project `.vivi/` store instead
  of a fixture.
- Stop if agents try to satisfy compatibility by parsing SQLite files ad hoc or
  shelling out to `sqlite3` instead of routing through the SQLite library
  package.
- Stop if the CLI grows external mail or Proton features.
- Stop if file-backed floor is described as regular Vivi compatibility before
  SQLite oracle parity exists.
