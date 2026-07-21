#!/usr/bin/env bash
# HV-06C: browser interaction proof (pointer lock, focus, selection, edit).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKSPACE="$(cd "$APP_DIR/../.." && pwd)"
FABER_BIN="${FABER:-$WORKSPACE/faber/target/debug/faber}"

if [[ ! -x "$FABER_BIN" ]]; then
  echo "run-hv06c: missing faber binary at $FABER_BIN" >&2
  exit 1
fi

echo "run-hv06c: check application + main"
"$FABER_BIN" check "$APP_DIR/src/application.fab"
"$FABER_BIN" check "$APP_DIR/src/main.fab"

echo "run-hv06c: HV-06A/B facts still green"
bash "$APP_DIR/tests/run-hv06a.sh"
bash "$APP_DIR/tests/run-hv06b.sh"

# Committed package-owned trees under dist/ are not browser product outputs.
# faber product_stale_output rejects them (transform.bin, host proof JSON, …).
# Park outside dist for the product preflight; restore after a green build.
# Geometry is not re-emitted here: HV-06C first-person no longer rotates the
# model matrix across frames, so emit-package-geometry's frame-delta gate fails.
# Interaction harness only needs the fresh ESM product from faber build.
_PRODUCT_ASIDE="$(mktemp -d "${TMPDIR:-/tmp}/hv06c-product-aside.XXXXXX")"
_restore_product_aside() {
  local st=$?
  mkdir -p "$APP_DIR/dist"
  if [[ -d "$_PRODUCT_ASIDE/generated" ]]; then
    rm -rf "$APP_DIR/dist/generated"
    mv "$_PRODUCT_ASIDE/generated" "$APP_DIR/dist/generated"
  fi
  if [[ -d "$_PRODUCT_ASIDE/proof" ]]; then
    rm -rf "$APP_DIR/dist/proof"
    mv "$_PRODUCT_ASIDE/proof" "$APP_DIR/dist/proof"
  fi
  rm -rf "$_PRODUCT_ASIDE"
  return "$st"
}
trap _restore_product_aside EXIT

echo "run-hv06c: park package-owned dist trees (product_stale_output)"
if [[ -d "$APP_DIR/dist/generated" ]]; then
  mv "$APP_DIR/dist/generated" "$_PRODUCT_ASIDE/generated"
fi
if [[ -d "$APP_DIR/dist/proof" ]]; then
  mv "$APP_DIR/dist/proof" "$_PRODUCT_ASIDE/proof"
fi

echo "run-hv06c: package build + ownership harness"
bash "$APP_DIR/tests/run.sh"

echo "run-hv06c: interaction structural proof"
node --import "$WORKSPACE/examples/browser-app/tests/register-hooks.mjs" \
  "$APP_DIR/tests/hv06c-interaction-test.mjs"

# Success: restore parked geometry + host proof; leave build products in place.
_restore_product_aside
trap - EXIT

echo "run-hv06c: ok"
