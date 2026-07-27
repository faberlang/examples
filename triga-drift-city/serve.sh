#!/usr/bin/env bash
# Rebuild the browser product and serve dist/ for Stage 2 greybox checks.
#
# Usage:
#   ./serve.sh                 # build package + serve on :8765
#   ./serve.sh --port 9000
#   ./serve.sh --rebuild-faber # cargo build -p faber first
#   ./serve.sh --no-build      # only (re)start server from existing dist/
#
# Always serve from dist/ (not the package root) so /faber-esm/* resolves.
# Open: http://localhost:<port>/pages/index.html
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKSPACE="$(cd "$APP_DIR/../.." && pwd)"
PORT="${PORT:-8765}"
REBUILD_FABER=0
DO_BUILD=1
PID_FILE="${APP_DIR}/.serve.pid"

SHARED_FABER="${HOME}/.cache/faberlang-target/faber/debug/faber"
LOCAL_FABER="${WORKSPACE}/faber/target/debug/faber"

usage() {
  cat <<'EOF'
Rebuild the browser product and serve dist/ for Stage 2 greybox checks.

Usage:
  ./serve.sh                 # build package + serve on :8765
  ./serve.sh --port 9000
  ./serve.sh --rebuild-faber # cargo build -p faber first
  ./serve.sh --no-build      # only (re)start server from existing dist/

Always serve from dist/ (not the package root) so /faber-esm/* resolves.
Open: http://localhost:<port>/pages/index.html
EOF
  exit "${1:-0}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help) usage 0 ;;
    --port)
      PORT="${2:?--port requires a value}"
      shift 2
      ;;
    --rebuild-faber)
      REBUILD_FABER=1
      shift
      ;;
    --no-build)
      DO_BUILD=0
      shift
      ;;
    *)
      echo "triga-drift-city serve: unknown arg: $1" >&2
      usage 1
      ;;
  esac
done

resolve_faber() {
  if [[ -n "${FABER:-}" && -x "${FABER}" ]]; then
    echo "${FABER}"
    return
  fi
  if [[ -x "${SHARED_FABER}" ]]; then
    echo "${SHARED_FABER}"
    return
  fi
  if [[ -x "${LOCAL_FABER}" ]]; then
    echo "${LOCAL_FABER}"
    return
  fi
  return 1
}

write_lockfile() {
  # Same lock shape as tests/run.sh — path-deps for web + triga.
  cat > "${APP_DIR}/faber.lock" <<LOCK

[[package]]
name = "web"
version = "0.1.0"
source = "path"
package_root = "${WORKSPACE}/faber-web"
kind = "lib"
target_language = "ts"
target_triple = "browser"
target_manifest = ""
interface_root = "${WORKSPACE}/faber-web/src"
artifact = ""
crate = "web"
rustc = ""

[[package]]
name = "triga"
version = "0.1.0"
source = "path"
package_root = "${WORKSPACE}/triga"
kind = "lib"
target_language = "ts"
target_triple = "browser"
target_manifest = ""
interface_root = "${WORKSPACE}/triga/src"
artifact = ""
crate = "triga"
rustc = ""
LOCK
}

stop_existing() {
  if [[ -f "${PID_FILE}" ]]; then
    local old
    old="$(cat "${PID_FILE}" 2>/dev/null || true)"
    if [[ -n "${old}" ]] && kill -0 "${old}" 2>/dev/null; then
      echo "stopping previous server (pid ${old})"
      kill "${old}" 2>/dev/null || true
      wait "${old}" 2>/dev/null || true
    fi
    rm -f "${PID_FILE}"
  fi
  # Also free the port if something else holds it (best-effort).
  if command -v lsof >/dev/null 2>&1; then
    local pids
    pids="$(lsof -tiTCP:"${PORT}" -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "${pids}" ]]; then
      echo "freeing port ${PORT}: ${pids}"
      # shellcheck disable=SC2086
      kill ${pids} 2>/dev/null || true
      sleep 0.2
    fi
  fi
}

if [[ "${REBUILD_FABER}" -eq 1 ]]; then
  echo "cargo build -p faber (shared target via faber/.cargo/config.toml)"
  (cd "${WORKSPACE}/faber" && cargo build -p faber)
fi

if [[ "${DO_BUILD}" -eq 1 ]]; then
  if ! FABER_BIN="$(resolve_faber)"; then
    echo "triga-drift-city serve: no faber binary found." >&2
    echo "  Tried:" >&2
    echo "    FABER=${FABER:-<unset>}" >&2
    echo "    ${SHARED_FABER}" >&2
    echo "    ${LOCAL_FABER}" >&2
    echo "  Run: ./serve.sh --rebuild-faber" >&2
    echo "  Or:  cargo build -p faber  (in ${WORKSPACE}/faber)" >&2
    exit 1
  fi
  echo "using faber: ${FABER_BIN}"
  write_lockfile
  echo "building browser product → dist/"
  (
    cd "${APP_DIR}"
    "${FABER_BIN}" build --package .
  )
  if [[ ! -f "${APP_DIR}/dist/pages/index.html" ]]; then
    echo "triga-drift-city serve: dist/pages/index.html missing after build" >&2
    exit 1
  fi
  if [[ ! -f "${APP_DIR}/dist/faber-esm/faber-browser.js" ]]; then
    echo "triga-drift-city serve: dist/faber-esm/faber-browser.js missing after build" >&2
    exit 1
  fi
else
  if [[ ! -f "${APP_DIR}/dist/pages/index.html" ]]; then
    echo "triga-drift-city serve: --no-build but dist/ is incomplete; run without --no-build" >&2
    exit 1
  fi
fi

stop_existing

echo "serving ${APP_DIR}/dist  on http://127.0.0.1:${PORT}/"
echo "open → http://127.0.0.1:${PORT}/pages/index.html"
echo "(hard-refresh the browser after rebuild: Cmd+Shift+R)"
echo "Ctrl+C stops the server"

cd "${APP_DIR}/dist"
# Record PID of this shell's python child via a small wrapper so Ctrl+C works.
python3 -m http.server "${PORT}" &
SERVER_PID=$!
echo "${SERVER_PID}" > "${PID_FILE}"
trap 'kill "${SERVER_PID}" 2>/dev/null || true; rm -f "${PID_FILE}"; exit 0' INT TERM
wait "${SERVER_PID}"
rm -f "${PID_FILE}"
