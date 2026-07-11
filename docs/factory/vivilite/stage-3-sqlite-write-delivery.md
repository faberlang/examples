# ViviLite SQLite Write Delivery

**Status:** Units A-C task/need/want-to-done moves implemented in packet
**Consumer stage:** ViviLite Stage 3 (SQLite package goal Stage 4)
**Fixture policy:** mutate disposable regular Vivi fixtures only

## Invariant

Once a project selects `.vivi/mail.sqlite`, supported ViviLite mutations use
bound SQLite parameters and either perform exactly the requested state change
or report an error. They never fall back to the file-backed `.vivilite` lane.

## Unit A — Complete One Task

`vivilite task done <handle> --for <identity>` moves exactly one open task from
`tasks` to `done`. The update binds identity and handle, constrains the original
role, and rejects zero or multiple affected rows. Other work-item transitions
remain on the Stage 3 map rather than sharing an implicit generic mutation.

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
to an open `needs` row. The SQLite statement binds the identity, handle, and
original role; a task with the same handle prefix cannot satisfy the update.
The regular Vivi status oracle must report `needs_open = 0`, `done = 1`, and
unchanged task/want totals.

## Unit C — Complete One Want

`vivilite want done <handle> --for <identity>` moves exactly one open `wants`
row to `done`. The same identity, handle, and original-role constraints prevent
the command from closing another work-item kind. The regular Vivi status oracle
must report `wants_open = 0`, `done = 1`, and unchanged task/need totals.

## Later Units

- Message creation with the full regular Vivi content/index shape.
- Transactions or batch mutation only when a multi-row invariant requires
  atomicity.
