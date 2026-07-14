#!/usr/bin/env python3
from __future__ import annotations

import pathlib
import sys
import tomllib


def workspace_root() -> pathlib.Path:
    return pathlib.Path(__file__).resolve().parents[3]


def main() -> int:
    root = workspace_root()
    map_path = root / "examples/ai-workbench/local-inventory-gaps.toml"
    package_path = root / "examples/ai-workbench/package-reuse.toml"
    inventory = tomllib.loads(map_path.read_text())
    package = tomllib.loads(package_path.read_text())

    gaps = inventory["local_inventory_gaps"]
    reuse_alias = package["alias_contract"]
    install_path = package["product_install_path"]
    failures: list[str] = []

    if gaps["status"] != "blocked-live-inventory":
        failures.append("local inventory gap status must remain blocked-live-inventory")
    if gaps["tour_blocked_exit"] != 2:
        failures.append("local inventory tour blocked exit must be 2")
    if gaps["campaign_fixture"] != reuse_alias["campaign_fixture"]:
        failures.append("campaign fixture must match package-reuse alias contract")
    if gaps["workspace_campaign_fixture"] != reuse_alias["workspace_campaign_fixture"]:
        failures.append("workspace campaign fixture must match package-reuse alias contract")
    if gaps["live_inventory_root"] != reuse_alias["live_inventory_root"]:
        failures.append("live inventory root must match package-reuse alias contract")
    if gaps["operator_smoke"] != install_path["operator_smoke"]:
        failures.append("operator smoke must match package-reuse product install path")
    if gaps["missing_inventory_smoke"] != install_path["missing_inventory_smoke"]:
        failures.append("missing-inventory smoke must match package-reuse product install path")

    for claim, value in inventory["guarded_claims"].items():
        if value is not False:
            failures.append(f"guarded claim {claim} must be false")

    blockers = {blocker["id"]: blocker for blocker in inventory["blockers"]}
    for required_id in ("operator-minilm-local-metadata",):
        blocker = blockers.get(required_id)
        if blocker is None:
            failures.append(f"missing blocker {required_id}")
        elif blocker.get("blocked_exit") != 2:
            failures.append(f"blocker {required_id} must use blocked exit 2")
    for retired_id in (
        "campaign-alias-map",
        "package-reuse-campaign-alias-map",
        "product-install-campaign-alias-map",
    ):
        if retired_id in blockers:
            failures.append(f"campaign alias-map blocker should be retired: {retired_id}")

    campaign_path = pathlib.Path(gaps["campaign_fixture"])
    if campaign_path.is_absolute():
        failures.append("campaign fixture must remain a workspace-relative path")
    if not str(campaign_path).startswith("examples/ai-workbench/"):
        failures.append("campaign fixture must be examples-owned")
    if not (root / campaign_path).exists():
        failures.append(f"campaign fixture absent: {campaign_path}")
    workspace_campaign_path = pathlib.Path(gaps["workspace_campaign_fixture"])
    if workspace_campaign_path.is_absolute():
        failures.append("workspace campaign fixture must remain a workspace-relative path")

    missing_fixture = root / gaps["missing_inventory_smoke"].split("--alias-map ", 1)[1]
    if not missing_fixture.exists():
        failures.append(f"missing-inventory fixture absent: {missing_fixture}")

    if failures:
        for failure in failures:
            print(f"FAIL {failure}", file=sys.stderr)
        return 1
    print("ok: local inventory gaps")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
