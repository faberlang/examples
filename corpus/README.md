# Faber language corpus

Keyword-oriented language reference programs for Faber.

This tree is the public **language dictionary**: one top-level directory per
keyword, operator group, or language type surface. It is the development source
for `faber explain` and the primary input for multi-target compile matrices in
the private Radix harness.

## Layout

```text
corpus/
  <keyword>/           # e.g. si/, vel/, functio/
    <keyword>.fab      # primary smoke
    …
  operatores/          # glyph / operator groups
  lista/ tabula/ …     # language types and compiler-owned method surfaces
  index.toml           # generated explain manifest
```

## Not here

| Content | Location |
| ------- | -------- |
| Application packages | sibling dirs under `examples/` (`coreutils/`, …) |
| GPU workload rungs | `examples/gpu-workload/` |
| AIR lane demos | `examples/air/` |
| Script-kernel (`faber:*`) demos | `examples/script-kernel/` |
| Norma stdlib tours | sibling `norma/exempla/` |

## Regenerate index

From the private Radix checkout:

```bash
./scripta/generate-exempla-index.py
```
