# ViviLite SQLite Read Delivery

**Status:** Units A-C board reads and multi-identity status parity proven
**Consumer stage:** ViviLite Stage 2 (SQLite package goal Stage 3)
**Write policy:** read-only fixture databases; no ViviLite mutation

## Invariant

When a project contains `.vivi/mail.sqlite`, ViviLite reads it through
`sqlite:sqlite`; it never parses the database file directly, shells out to
`sqlite3`, or silently reports file-backed `.vivilite` data as Vivi-compatible.

## Resume Gate

The consumer patch begins after a real application package proves all of these:

1. `faber.toml` declares `sqlite = "0.1.0"`.
2. `faber.lock` selects the local SQLite library package.
3. emitted Rust may call `sqlite::sqlite::*`.
4. the generated application `Cargo.toml` contains the emitted SQLite crate as
   a path dependency.
5. `faber run` links bundled `rusqlite` and executes the binary.

The attachment gate landed in Faber at `d9dd406`. A real ViviLite product run
now compiles the generated SQLite crate, links bundled `rusqlite`, and reads
regular Vivi fixture totals.

## Read Model

Regular Vivi identities remain authoritative in `.vivi/mailspace.toml`.
SQLite provides per-identity message state from `messages`:

| Output | SQL predicate |
| --- | --- |
| open tasks | `account = ?1 AND local_role = 'tasks'` |
| open needs | `account = ?1 AND local_role = 'needs'` |
| open wants | `account = ?1 AND local_role = 'wants'` |
| done | `account = ?1 AND local_role = 'done'` |
| unread inbox | `account = ?1 AND local_role = 'inbox' AND read_state = 0` |
| actionable | open tasks + open needs |

All identity and role values are bound parameters. Counts and item rows use
`sqlite.quaere`; count rows avoid the still-open `valor ∪ nihil` scalar
narrowing limitation. Lists use deterministic ordering by the same stable
fields regular Vivi uses.

## Delivery Units

### Unit A — status totals

Status: board totals proof complete (2026-07-10). The first product slice reads
task, need, and want totals for `--for`, reports `lane = "sqlite-read"`, and
keeps item arrays empty so partial parity is visible. Full multi-identity
`mailspace status --json` remains with Units B-C.

- Read `mailspace.toml` for name and identities.
- Query the six counts above for every identity.
- Emit regular Vivi's `mailspace status --json` shape.
- Label errors as SQLite read errors; do not fall back to the file lane after a
  `.vivi` store was selected.

### Unit B — work lists

Status: complete in packet (2026-07-10). Board task, need, and want arrays now
come from a parameterized `messages` + `message_metadata` join with stable
`updated_at DESC, message_id ASC` ordering.

- Query task, need, and want message rows by identity and role.
- Join `messages`, `blobs`, and `message_metadata` only for fields required by
  regular Vivi JSON.
- Preserve handle, subject, sender, recipient, and ordering.

### Unit C — multi-identity mailspace status

Status: complete in packet (2026-07-10). A two-identity regular Vivi fixture
matches ViviLite semantically for the complete status JSON object, including
per-identity counts and aggregate totals.

Read `.vivi/mailspace.toml` for the authoritative mailspace name and ordered
identity names. For every identity, emit:

| JSON field | Source |
| --- | --- |
| `identity` | config identity name |
| `address` | `<identity>@<mailspace>.local` |
| `actionable_open` | tasks + needs |
| `inbox_unread` | unread inbox count |
| `tasks_open` | tasks count |
| `needs_open` | needs count |
| `wants_open` | wants count |
| `done` | done count |

The root object is exactly `found`, `name`, `root`, `store`, `identities`, and
`totals`. Totals sum actionable, unread, task, need, and want counts across all
identities; regular Vivi does not include `done` in totals. Paths use the
operator-supplied project spelling, matching the oracle rather than forcing
canonicalization. Compare JSON semantically; object field order is not an
acceptance requirement.

Keep the file-backed status lane explicit for projects without `.vivi`. Once a
`.vivi/mail.sqlite` store is selected, parsing or query failures are errors and
must not silently fall back to `.vivilite`.

## Fixture And Oracle

Use a new temporary project for every run:

```bash
vivi mailspace init --project <fixture>
vivi mailspace identity add codex --project <fixture>
vivi mailspace identity add reviewer --project <fixture>
vivi task send --project <fixture> --from reviewer --to codex --subject task --body body
vivi need send --project <fixture> --from codex --to reviewer --subject need --body body
vivi want send --project <fixture> --from codex --to codex --subject want --body body
vivi mailspace status --project <fixture> --json > expected.json
faber run vivilite -- mailspace status --project <fixture> --json > actual.json
```

Compare parsed JSON values, not serialized field order. ViviLite must not write
to the fixture during this stage.

## Known Independent Evidence

- SQLite binding verification: three declarations and three Rust bindings.
- SQLite shim tests: parameterized write/query/scalar round trip and aggregate
  parameter rejection.
- ViviLite baseline build: passes after `b24f1ff` fixes borrowed-text moves.
- ViviLite baseline tests: one passes; two remain environment-gated on the
  unsupported `solum:temporarium` frame route. The Radix kernel manifest and
  MIR stepper already define the route, but pinned `faber-runtime` `8b9e938`
  does not dispatch it. Runtime ownership is outside this packet lane; need
  `ee6d44f` routes the focused implementation and test to hunter-1. The tests
  remain enabled so this gap stays visible.
- `SQLiteEffect` remains represented as `valor` at the Stage 2 binding boundary;
  this read-only delivery uses `quaere` and `scalar` and does not depend on that
  return ABI.
