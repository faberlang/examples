# ViviLite SQLite Write Delivery

**Status:** Units A-C task/need/want-to-done moves and event-note parity implemented; Unit D mail/work-item creation has repeatable regular Vivi oracle and rollback proof; want-to-need promotion with optional event notes implemented
**Consumer stage:** ViviLite Stage 3 (SQLite package goal Stage 4)
**Fixture policy:** mutate disposable regular Vivi fixtures only

## Invariant

Once a project selects `.vivi/mail.sqlite`, supported ViviLite mutations use
bound SQLite parameters and either perform exactly the requested state change
or report an error. They never fall back to the file-backed `.vivilite` lane.

## Unit A — Complete One Task

`vivilite task done <handle> --for <identity>` moves exactly one open task from
`tasks` to `done`. The update binds identity and handle, constrains the original
role, and rejects zero or multiple matches. The move and its regular Vivi
`task done` event commit in one batch, preserving optional `--note` text.
Other work-item transitions remain on the Stage 3 map rather than sharing an
implicit generic mutation.

Product proof uses a fresh regular Vivi fixture:

```bash
vivi mailspace init --project <fixture>
vivi mailspace identity add codex --project <fixture>
vivi task send --project <fixture> --from codex --to codex --subject task --body body
faber run vivilite -- task done <handle> --for codex --project <fixture>
vivi mailspace status --project <fixture> --json
```

The regular Vivi status oracle must report `tasks_open = 0`, `done = 1`, and no
other identity or total changes. Tests and product proof must never point at a
live project mailspace.

## Unit B — Complete One Need

`vivilite need done <handle> --for <identity>` applies the same exact-one move
and `need done` event to an open `needs` row. The SQLite statements bind the
identity, handle, and original role; a task with the same handle prefix cannot
satisfy the update.
The regular Vivi status oracle must report `needs_open = 0`, `done = 1`, and
unchanged task/want totals.

## Unit C — Complete One Want

`vivilite want done <handle> --for <identity>` moves exactly one open `wants`
row to `done` and appends the matching `want done` event. The same identity,
handle, and original-role constraints prevent the command from closing another
work-item kind. The regular Vivi status oracle
must report `wants_open = 0`, `done = 1`, and unchanged task/need totals.

## Unit D — Chart Message and Work-Item Creation

Regular Vivi creation is not a single `messages` insert. One logical send
creates shared RFC 5322 bytes and their SHA-256 content identity, persists the
blob, upserts `blobs` and `message_metadata`, creates one recipient row plus a
sent-copy row in `messages`, and appends the corresponding `mailspace_events`.
Work-item creation additionally writes `X-Vivi-Kind` and selects the open role
for that kind (`tasks`, `needs`, or `wants`).

The `sqlite:sqlite.exsequi_batch` binding now keeps one connection and one
transaction across a list of parameterized statements, commits only after all
statements succeed, and rolls the entire batch back when any statement fails.
The `sqlite:sqlite.sha256_hex` binding now exposes canonical bytes-to-lowercase-
hex SHA-256 hashing to Faber. Directly inventing IDs or omitting blob/event rows
would create storage that regular Vivi cannot treat as a faithful send.

The implementation sequence is therefore:

1. **Complete:** add a SQLite transaction/batch binding that keeps one
   connection, binds all values, commits only after every statement succeeds,
   and rolls back on any error.
2. **Complete:** expose canonical SHA-256 bytes-to-hex hashing to Faber through
   the SQLite package binding seam rather than ViviLite-specific Rust.
3. **Complete:** compose the exact regular Vivi message bytes, including
   `X-Vivi-Kind` only for work items, then write the blob, recipient row, sender's
   read `sent` row, and matching catalog/event rows as one logical operation.
4. **Complete:** prove each `mail|task|need|want send` against a fresh regular Vivi fixture:
   regular Vivi must list/show the created item, report the expected sent copy
   and open-role totals, and read the persisted body bytes. A forced mid-write
   failure must leave every table and blob path unchanged. The send path now
   creates a new content-addressed blob only after the catalog transaction
   commits, so a rejected batch cannot orphan a blob. Run
   `./scripta/verify-vivilite-sqlite-writes.sh` from the examples repository to
   exercise the product oracle on a disposable fixture.

Until those prerequisites land, creation commands continue on the file-backed
lane even when `.vivi/mail.sqlite` exists. They must not partially populate the
regular Vivi database.

## Later Units

- **Complete:** promote exactly one open want to `needs` and append the regular
  Vivi `want promote` move event, including optional `--note` text (or SQL
  `NULL` when omitted).
- Message and work-item creation after the Unit D prerequisites land.
- Transactions or batch mutation only when a multi-row invariant requires
  atomicity.
