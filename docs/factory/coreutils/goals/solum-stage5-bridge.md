# Goal: coreutils — solum Stage 5 bridge helpers

**Status**: complete
**Campaign**: [`../CAMPAIGN.md`](../CAMPAIGN.md)
**Ledger row**: [`../ledger.md`](../ledger.md) § File / metadata
**Factory artifact dir**: `docs/factory/coreutils/`
**Primary surfaces**: sibling `../norma/src/solum.fab`; sibling radix `crates/radix/src/mir/stepper/kernel/solum.rs` and `crates/radix/src/kernel/manifest.rs`

## Objective

Add the small `norma:solum` filesystem helpers needed to unblock the next
Stage 5 coreutils slices without waiting for full genus materialization.

## Deliverables

- `modum(textus via, numerus modus) → vacuum` for `chmod`.
- `vincula(textus fons, textus destinatio) → vacuum` for symbolic links.
- Scalar metadata helpers: `directoriumne`, `regularene`, `vinculumne`,
  `mensura`, `modus`.
- `funde(textus via, octeti data) → vacuum` route for byte output.
- Stepper kernel implementations and manifest exposure for interpreted package
  bridge use.
- Rust backing parity for compiled package use.

## Out of scope

- Hard-link creation. Add it later if a utility slice needs it.
- Full `SolumStatus` genus materialization.
- `df`/filesystem stats and full recursive disk-usage accounting.

## Acceptance

```bash
timeout 120 cargo test --manifest-path ../radix/Cargo.toml -p radix kernel_solum_supports_manifested_path_and_metadata_verbs
timeout 120 cargo test --manifest-path ../radix/Cargo.toml -p radix kernel_manifest_verbs_are_subset_of_norma_public_surface
timeout 120 cargo test --manifest-path ../faber/Cargo.toml package_mir_bridges_norma_solum_metadata_and_link_verbs
timeout 180 cargo build --manifest-path ../faber/Cargo.toml
timeout 180 cargo build --manifest-path ../radix/Cargo.toml -p radix
```

Completed with the commands above plus:

```bash
timeout 120 ./scripta/check-source  # from ../norma (or: cd ../norma && ./scripta/check-source)
```

## Lowers from

Coreutils campaign Stage 5.
