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

When `<root>/.vivi/mail.sqlite` exists, `board --json` reads task, need, and
want totals through the `sqlite:sqlite` package and reports lane
`sqlite-read`. The read-only lane also fills task, need, and want item arrays
from regular Vivi message metadata. `mailspace status --json` reads every
configured identity and emits the same identity rows and aggregate totals as
regular Vivi. Mail, task, need, and want sends compose canonical UTF-8 messages,
store SHA-256-addressed blobs, and atomically insert the corresponding blob,
metadata, recipient, sender `sent` copy, and event catalog rows. Other commands
continue to use the file-backed lane.

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

The compiled test harness uses runtime filesystem routes for disposable fixture
setup. The SQLite write lane supports exact-one completion for open tasks,
needs, and wants, plus regular-Vivi-readable creation and sender sent-copy
parity for every send kind. SQLite-backed want promotion moves exactly one open
want into `needs` and records the regular Vivi move event, including an optional
`--note`. Other mutations remain
file-backed until their regular Vivi storage semantics are implemented and proven
against disposable fixtures.
