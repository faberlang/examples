# Goal: coreutils — solum Stage 5 bridge helpers

**Status**: complete
**Campaign**: [`../CAMPAIGN.md`](../CAMPAIGN.md)
**Ledger row**: [`../ledger.md`](../ledger.md) § File / metadata
**Factory artifact dir**: `docs/factory/coreutils/`
**Primary surfaces**: `stdlib/norma/solum.fab`, `crates/radix/src/mir/stepper/kernel/solum.rs`, `crates/radix/src/kernel/manifest.rs`, `crates/norma/solum.rs`

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
timeout 120 cargo test -p radix kernel_solum_supports_manifested_path_and_metadata_verbs
timeout 120 cargo test -p radix kernel_manifest_verbs_are_subset_of_norma_public_surface
timeout 120 cargo test -p faber-cli package_mir_bridges_norma_solum_metadata_and_link_verbs
timeout 180 cargo build -p faber-cli -p radix
```

Completed with the commands above plus:

```bash
timeout 120 cargo test -p norma scalar_metadata_mode_symlink_and_byte_write_helpers_work
```

## Lowers from

Coreutils campaign Stage 5.
