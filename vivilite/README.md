# ViviLite

ViviLite is a Faber-native local mailspace CLI example. This first slice is a
file-backed floor for agent coordination commands; it is not regular Vivi
storage compatibility.

The file-backed lane stores data under `.vivilite/`:

```text
.vivilite/
  mailspace.txt
  identities.tsv
  mail.tsv
  work.tsv
```

It never reads or writes a project `.vivi/mail.sqlite` store. SQLite-backed
regular Vivi read parity belongs to a later stage after the Faber SQLite
package exists.

## Commands

```text
vivilite mailspace init --project <root>
vivilite mailspace status --json --project <root>
vivilite mailspace identity add --name codex --address codex@fixture.local --project <root>
vivilite mailspace identity list --project <root>
vivilite mail send --from codex --to reviewer --subject "..." --body "..." --project <root>
vivilite mail list --for reviewer --project <root>
vivilite task send --from reviewer --to codex --subject "..." --body "..." --project <root>
vivilite task list --for codex --project <root>
vivilite task show <handle> --project <root>
vivilite task done <handle> --project <root>
vivilite board --for codex --json --project <root>
```

The `need` and `want` commands mirror `task` for the same `send`, `list`,
`show`, and `done` operations. `want promote <handle>` changes an open want into
an open task.

## Validate

From the `examples/` repo root:

```bash
cargo run --manifest-path ../faber/Cargo.toml -- check vivilite
cargo run --manifest-path ../faber/Cargo.toml -- test vivilite
cargo run --manifest-path ../faber/Cargo.toml -- run vivilite -- board --for codex --json --project vivilite/fixtures/demo
```
