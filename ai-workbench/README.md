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
          model.fab
  harness/
    check-model-inspect.py
    fixtures/
      model-inspect/
        cases.toml
        files/
          README.md
```

## DevCycle

From the workspace root:

```bash
cargo run --manifest-path faber/Cargo.toml -- check examples/ai-workbench/packages/faber-ai
cargo run --manifest-path faber/Cargo.toml -- test examples/ai-workbench/packages/faber-ai
cargo run --manifest-path faber/Cargo.toml -- run examples/ai-workbench/packages/faber-ai -- model inspect basic/minilm --format json
python3 examples/ai-workbench/harness/check-model-inspect.py
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
