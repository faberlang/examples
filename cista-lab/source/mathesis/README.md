# Mathesis Cista Fixture

`mathesis` is a small source-distributed cista package used to exercise the
package-management manifest shape before the full resolver and installer exist.

The package intentionally mirrors the Norma-style case:

- Faber-facing interfaces live under `interfaces/`.
- Hand-written Rust implementation source lives under `targets/rust/`.
- `cista.toml` uses `mode = "compile"` and `binding_policy = "manifest"`.
- Bindings use structured `source_module` and `source_symbol` fields.

This fixture is not wired into `faber build` yet. It is a concrete shape for the
first `cista check`, `cista install --path`, and resolver work.

For application scalar math, use the native stdlib catalog:

```fab
importa ex "norma:mathesis" privata mathesis
```

See [`docs/stdlib/mathesis-methods.md`](../../../../docs/stdlib/mathesis-methods.md).

Current validation commands:

```bash
cargo run -p cista -- check examples/cista-lab/source/mathesis --target-language rust
cargo run -p cista -- check examples/cista-lab/source/mathesis --target-language rust --verify-target-build
```
