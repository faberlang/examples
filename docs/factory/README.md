# Factory documentation (examples)

Open factory tracks for public **application examples** (coreutils campaign).

Relocated from private Radix on 2026-07-08.

## Layout (current)

```text
examples/
  coreutils/           packages + harness fixtures
  docs/factory/        this control plane
  fixtures/            boundary fixtures
# siblings
  ../faber             public CLI
  ../norma             public stdlib source
  ../radix             private compiler + parity scripta
```

Common commands from this repo:

```bash
cargo run --manifest-path ../faber/Cargo.toml -- check coreutils/packages/<util>
# from ../radix:
# ./scripta/check-coreutils-parity <util> --backend stepper
```

Each `goal.md` / `CAMPAIGN.md` owns its **Status** line.

## Open goals

| Goal | Status | Entry |
| ---- | ------ | ----- |
| Coreutils application exempla | active | [`coreutils/CAMPAIGN.md`](coreutils/CAMPAIGN.md) |
| ViviLite application exemplum | Stage 0–1 file-backed scaffold landed; SQLite lane deferred | [`vivilite/goal.md`](vivilite/goal.md) |
