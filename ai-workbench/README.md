# AI Workbench Application Exempla

Faber AI command-line application proofs for local model inventory, metadata
inspection, embedding, indexing, and later local inference workflows.

Campaign control plane:
`docs/campaigns/ai-workbench/CAMPAIGN.md` from the workspace root.

## Layout

```text
examples/ai-workbench/
  packages/
    faber-ai/
      faber.toml
      src/
        main.fab
        commands/
          embed.fab
          model.fab
  harness/
    check-embed.py
    check-embed-oracle.py
    check-model-inspect.py
    minilm_oracle.py
    fixtures/
      embed/
        cases.toml
        texts.txt
      model-inspect/
        cases.toml
        files/
          README.md
        maps/
          subset-aliases.toml
          outside-subset-valid.toml
```

## DevCycle

From the workspace root:

```bash
cargo run --manifest-path faber/Cargo.toml -- check examples/ai-workbench/packages/faber-ai
cargo run --manifest-path faber/Cargo.toml -- test examples/ai-workbench/packages/faber-ai
cargo run --manifest-path faber/Cargo.toml -- run examples/ai-workbench/packages/faber-ai -- model inspect basic/minilm --format json
python3 examples/ai-workbench/harness/check-model-inspect.py
python3 examples/ai-workbench/harness/check-embed.py
```

The initial package reports router-backed/missing status for the campaign model
aliases. The harness compares JSON output against
`docs/campaigns/ai-workbench/model-aliases.toml` so campaign/code divergence
fails validation.

Operator-local absolute model paths are intentionally redacted from portable
examples; live local path validation belongs to the workspace inventory. Binary
safetensors and GGUF metadata parsing is deliberately routed to the Stage 1
delivery spec before it is claimed complete.

`model inspect` reads the alias map with `norma:solum`, so the map-backed
runtime path uses compiled `faber run`; the interpreter does not yet support
that provider route.

The harness is workspace-level validation, not standalone `examples` repo CI:
it requires the campaign map under `docs/campaigns/ai-workbench/`. It checks
`source`, `status`, and `router_model_id` against the campaign map and requires
portable output to redact `local_path` to an empty string.

Stage 1 consumes only a minimal alias-map field subset: `[[tiers]]` blocks may
contain many campaign inventory fields, but the package reads `alias`, `source`,
`status`, `local_path`, and `router_model_id` only when those assignments are
single-line quoted `key = "value"` entries. General TOML parsing is deferred to
the Norma metadata/parser work. The harness includes package-local map fixtures
for the accepted subset and for a valid-TOML shape outside the consumed subset;
the latter must fail closed with a structured diagnostic instead of being
silently misread.

## Stage 2 Embed Floor

`faber-ai embed <texts> --model basic/minilm --out <vectors.fvi>` is wired as
the Stage 2 command contract. The default path resolves local aliases, checks
input/model file readability, writes a parseable Stage 2 `.fvi` JSON artifact,
and returns an honest `blocked` status until an explicit oracle artifact is
provided.

`--oracle-runner <path>` is the local-ops bridge for Stage 2 Option A. It runs
a labelled oracle script to produce the vector artifact, labels the result
`oracle-backed`, and keeps the diagnostic explicit that Faber-owned transformer
execution is not implemented.

The temporary `.fvi` floor is compact JSON with:

- `format = "fvi-stage2"`
- `model` and `source`
- `status`
- `input_count`
- `dimensions`
- `normalization`
- `oracle` when an oracle artifact is used
- `vectors`
- `diagnostics`

The default embed harness remains hermetic: it uses tiny checked-in text/model
fixtures and does not require the live `/Users/ianzepp/ai` MiniLM inventory.

Local oracle validation is intentionally separate:

```bash
python3 examples/ai-workbench/harness/check-embed-oracle.py
```

That script requires `/Users/ianzepp/ai/models/all-MiniLM-L6-v2`, uses the
default Python `tokenizers`, `torch`, and `numpy` packages, reads
`model.safetensors` directly, runs the MiniLM encoder with mean pooling and L2
normalization, and verifies the CLI artifact against a `1e-6` tolerance. It
does not use `transformers`, `sentence_transformers`, `safetensors`, network
fetches, or repo-local model blobs.

Independent Transformers parity is also local-ops-only:

```bash
python3 examples/ai-workbench/harness/check-embed-transformers-oracle.py
```

That script requires a Python environment with `transformers` available, loads
the same durable MiniLM directory with `local_files_only=True`, computes mean
pooled and L2-normalized embeddings through `AutoModel`, and compares those
vectors with the CLI artifact produced by the explicit manual oracle runner.
