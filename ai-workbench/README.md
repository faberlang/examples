# AI Workbench Application Exempla

Faber AI command-line application proofs for local model inventory, metadata
inspection, embedding, indexing, and later local inference workflows.

Campaign control plane:
`../docs/campaigns/ai-workbench/CAMPAIGN.md` from the workspace root.

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
```

## DevCycle

From the workspace root:

```bash
cargo run --manifest-path faber/Cargo.toml -- check examples/ai-workbench/packages/faber-ai
cargo run --manifest-path faber/Cargo.toml -- run --interpret examples/ai-workbench/packages/faber-ai -- model inspect basic/minilm --format json
```

The initial package resolves the campaign aliases and reports local/missing
status. Binary safetensors and GGUF metadata parsing is deliberately routed to
the Stage 1 delivery spec before it is claimed complete.
