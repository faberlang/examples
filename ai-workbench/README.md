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
python3 examples/ai-workbench/harness/check-index.py
python3 examples/ai-workbench/harness/check-query.py
python3 examples/ai-workbench/harness/check-package-reuse.py
python3 examples/ai-workbench/harness/check-product-install-path.py
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

## Stage 8 Package And Model Reuse

`package-reuse.toml` is the Stage 8 install/reuse contract for the workbench. It
keeps the campaign alias map as the hermetic fixture, `/Users/ianzepp/ai/models`
as the live inventory root, and future Cista package/model metadata as the
possible install-time mirror. The contract separates product CLI install from
future systems reuse and explicitly excludes duplicate model downloads, model
blobs in git, GPU claims, Faber-owned inference claims, and shipping a PyTorch
replacement binary.

Validate the contract with:

```bash
python3 examples/ai-workbench/harness/check-package-reuse.py
```

Stage 8B keeps the current operator path package-invoked until Cista bin
packages and `cista run` are selected:

```bash
cargo run --manifest-path faber/Cargo.toml -- run examples/ai-workbench/packages/faber-ai -- model inspect basic/minilm --format json --alias-map docs/campaigns/ai-workbench/model-aliases.toml
```

Validate that path and its missing-inventory diagnostic with:

```bash
python3 examples/ai-workbench/harness/check-product-install-path.py
```

Stage 1 consumes only a minimal alias-map field subset: `[[tiers]]` blocks may
contain many campaign inventory fields, but the package reads `alias`, `source`,
`status`, `local_path`, and `router_model_id` only when those assignments are
single-line quoted `key = "value"` entries. General TOML parsing is deferred to
the Norma metadata/parser work. The harness includes package-local map fixtures
for the accepted subset and for a valid-TOML shape outside the consumed subset;
the latter must fail closed with a structured diagnostic instead of being
silently misread.

## Stage 2 Embed Floor

`faber-ai embed <texts> --model <alias> --out <vectors.fvi>` is wired as the
embedding command contract. Stage 2 uses `basic/minilm`; Stage 4 reuses the
same product shape for `mid/qwen3-embed-0.6b`. The default path resolves local
aliases, checks input/model file readability, writes a parseable Stage 2 `.fvi`
JSON artifact, and returns an honest `blocked` status until an explicit oracle
artifact is provided.

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
fixtures and does not require the live `/Users/ianzepp/ai` MiniLM or Qwen3
inventory. The Stage 4B Qwen3 cases use a package-local alias map and a fake
oracle fixture to prove fail-closed behavior and `oracle-backed` labeling
without loading the real Tier 2 model.

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

Stage 4C adds the Tier 2 Qwen3 local-ops oracle:

```bash
python3 examples/ai-workbench/harness/check-qwen3-embed-oracle.py
```

That harness requires `/Users/ianzepp/ai/models/Qwen3-Embedding-0.6B` and the
operator-local `/Users/ianzepp/ai/venvs/qwen3-embed-py313` environment. The
runner loads Qwen3 through Transformers with `local_files_only=True`, left
padding, last-token pooling, and L2 normalization, then writes an
`oracle-backed` Stage 2 `.fvi` artifact with 1024-dimensional vectors and batch
metadata. Validation runs offline and compares the CLI artifact with a direct
oracle artifact at `1e-6` tolerance; it does not claim Faber-owned tokenizer or
transformer execution.

## Stage 3 Index Floor

`faber-ai index <vectors.fvi> --out <index.fvi>` is wired as the Stage 3 index
artifact floor. It consumes the compact Stage 2 `.fvi` JSON shape, requires
`format = "fvi-stage2"`, positive dimensions, positive input vector count, L2
normalization, and a vector record count that matches `input_count`.

The initial index artifact is compact JSON with:

- `format = "fvi-stage3-index"`
- `source_format = "fvi-stage2"`
- `model` and `source`
- `input_vectors`
- `dimensions`
- `metric`, currently `cosine`
- `normalization = "l2"`
- `vectors`
- `diagnostics`

The default index harness is hermetic and uses tiny checked-in parser fixtures,
not live MiniLM model files. The parser is intentionally narrow: malformed
input, blocked Stage 2 artifacts, unsupported metrics, missing vector files,
empty indexes, and dimension mismatches fail closed with structured diagnostics.

`faber-ai query <index.fvi> "search text" --query-vector <query.fvi>` is wired
as the Stage 3 query floor. The first hermetic path requires an explicit
checked-in query vector fixture, computes cosine as a dot product over
L2-normalized vectors, and orders results by score descending with record-id
ascending order for equal scores.

The query-vector fixture floor is compact JSON with:

- `format = "fvi-stage3-query-vector"`
- `model`
- `dimensions`
- `normalization = "l2"`
- `query`
- `values`
- `diagnostics`

The default query harness builds a temporary Stage 3 index from the checked-in
Stage 2 vector fixture, then verifies deterministic ranking and fail-closed
behavior for missing query vectors, invalid `--top`, malformed/empty indexes,
unsupported formats/metrics, and dimension mismatches. It does not embed query
text or use the local MiniLM inventory.

## Stage 5 Cosine Batch Floor

Stage 5 selects the existing query path's batched cosine scoring operation for
systems-lane promotion:

```bash
python3 examples/ai-workbench/harness/check-cosine-batch.py
```

The harness independently computes dot-product scores over L2-normalized
Stage 3 index/query-vector artifacts, compares `faber-ai query` results under
`1e-6` tolerance, and preserves score-descending plus id-ascending tie order.
It is CPU/reference evidence only; GPU or systems-target claims require the
Stage 5 delivery spec's later parity gates.
