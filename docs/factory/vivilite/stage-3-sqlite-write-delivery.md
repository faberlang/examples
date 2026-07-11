# ViviLite SQLite Write Delivery

**Status:** Unit A task-to-done move implemented in packet
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

## Later Units

- Need and want completion, only after their exact regular Vivi semantics are
  verified.
- Message creation with the full regular Vivi content/index shape.
- Transactions or batch mutation only when a multi-row invariant requires
  atomicity.
