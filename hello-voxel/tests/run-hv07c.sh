#!/usr/bin/env bash
# HV-07C: repeated edit browser proof (dirty drain → host per-chunk replace).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKSPACE="$(cd "$APP_DIR/../.." && pwd)"
FABER_BIN="${FABER:-$WORKSPACE/faber/target/debug/faber}"

if [[ ! -x "$FABER_BIN" ]]; then
  echo "run-hv07c: missing faber binary at $FABER_BIN" >&2
  exit 1
fi

echo "run-hv07c: check application + main"
"$FABER_BIN" check "$APP_DIR/src/application.fab"
"$FABER_BIN" check "$APP_DIR/src/main.fab"

echo "run-hv07c: HV-07A facts still green"
bash "$APP_DIR/tests/run-hv07a.sh"

# Committed package-owned trees under dist/ are not browser product outputs.
# faber product_stale_output rejects them (transform.bin, host proof JSON, …).
# Park outside dist for the product preflight; restore after a green build.
_PRODUCT_ASIDE="$(mktemp -d "${TMPDIR:-/tmp}/hv07c-product-aside.XXXXXX")"
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

echo "run-hv07c: park package-owned dist trees (product_stale_output)"
if [[ -d "$APP_DIR/dist/generated" ]]; then
  mv "$APP_DIR/dist/generated" "$_PRODUCT_ASIDE/generated"
fi
if [[ -d "$APP_DIR/dist/proof" ]]; then
  mv "$APP_DIR/dist/proof" "$_PRODUCT_ASIDE/proof"
fi

echo "run-hv07c: package build + ownership harness"
bash "$APP_DIR/tests/run.sh"

echo "run-hv07c: HV-06C interaction still green"
node --import "$WORKSPACE/examples/browser-app/tests/register-hooks.mjs" \
  "$APP_DIR/tests/hv06c-interaction-test.mjs"

echo "run-hv07c: resource-cycle proof (package attrs + host fake device)"
node --import "$WORKSPACE/examples/browser-app/tests/register-hooks.mjs" \
  "$APP_DIR/tests/hv07c-resource-cycle-test.mjs"

_restore_product_aside
trap - EXIT

echo "run-hv07c: ok"
