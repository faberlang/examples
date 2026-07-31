# Package fixtures (language corpus moved)

**Language keyword exempla** now live under **`radix/corpus/`**
(see `radix/docs/factory/corpus-split-radix-faber/goal.md`).

This directory only retains **package-shaped** fixtures that still need a
`faber.toml` layout. They move next to `faber/corpus/` in a follow-on slice.

| Path | Role |
| --- | --- |
| `tensor-fragment/tiny-linear/` | Package MIR / tensor fragment |
| `tensor-fragment/tiny-linear-dense/` | Dense device package fragment |
| `tensor-package/fmir-matmul/` | Package FMIR matmul |

Do not add single-file keyword programs here. Put those in `radix/corpus/`.
