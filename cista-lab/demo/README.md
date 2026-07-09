# cista-lab demo

Consumer package for the local library store loop (Phase A).

Declares `mathesis = "0.1.0"` in `faber.toml`. Absolute build inputs live in
`faber.lock`, which is produced by `cista install` (not hand-edited).

## Setup

```bash
# from faberlang/cista
cargo run -- install \
  --path ../examples/cista-lab/source/mathesis \
  --target-language rust \
  --store "${CISTAE_HOME:-$HOME/.faber/cistae}" \
  --project ../examples/cista-lab/demo

# from faberlang/faber
cargo run -- check ../examples/cista-lab/demo
cargo run -- build ../examples/cista-lab/demo
```

`faber` reads only `faber.toml` + `faber.lock` paths. It does not use
`CISTAE_HOME` or call `cista`.
