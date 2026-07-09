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
    fixtures/
      model-inspect/
        cases.toml
        model-aliases.toml
        files/
          README.md
```

## DevCycle

From the workspace root:

```bash
cargo run --manifest-path faber/Cargo.toml -- check examples/ai-workbench/packages/faber-ai
cargo run --manifest-path faber/Cargo.toml -- test examples/ai-workbench/packages/faber-ai
cargo run --manifest-path faber/Cargo.toml -- run --interpret examples/ai-workbench/packages/faber-ai -- model inspect basic/minilm --format json
python3 examples/ai-workbench/harness/check-model-inspect.py
```

The initial package resolves a checked-in Stage 1 alias fixture derived from the
workspace campaign map and reports router-backed/missing status. The harness
compares JSON output against `model-aliases.toml` so fixture/code divergence
fails validation.

Operator-local absolute model paths are intentionally redacted from portable
examples; live local path validation belongs to the workspace inventory. Binary
safetensors and GGUF metadata parsing is deliberately routed to the Stage 1
delivery spec before it is claimed complete.
