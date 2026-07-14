# document-extract

Deterministic Faber proof package for local document research and structured
extraction.

This first slice only reads repository-local plain text Markdown fixtures and
emits deterministic JSON or JSONL. It intentionally avoids PDF, OCR, DOCX,
HTML, HTTP fetches, database state, embeddings, and model inference.

## Fixtures

- `fixtures/atlas.md`: route-parity research note
- `fixtures/brief.md`: experiment brief
- `fixtures/standup.md`: status note

Golden outputs live in `fixtures/expected/`.

## Commands

From the examples repository root:

```sh
cargo run --manifest-path ../faber/Cargo.toml -- check document-extract
cargo run --manifest-path ../faber/Cargo.toml -- test document-extract
cargo run --manifest-path ../faber/Cargo.toml -- build document-extract
cargo run --manifest-path ../faber/Cargo.toml -- run document-extract -- fixtures/atlas.md --format json
cargo run --manifest-path ../faber/Cargo.toml -- run document-extract -- fixtures/brief.md --format jsonl
```

Unsupported document classes should be added as new packages or later stages
only after this local Markdown proof remains stable.
