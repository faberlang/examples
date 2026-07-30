#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKSPACE="$(cd "$APP_DIR/../.." && pwd)"
PORT="${PORT:-8770}"
REBUILD_FABER=0
DO_BUILD=1
PID_FILE="${APP_DIR}/.serve.pid"

SHARED_FABER="${HOME}/.cache/faberlang-target/faber/debug/faber"
LOCAL_FABER="${WORKSPACE}/faber/target/debug/faber"

usage() {
  cat <<'EOF'
Rebuild the Triga Budapest browser product and serve dist/.

Usage:
  ./serve.sh
  ./serve.sh --port 9000
  ./serve.sh --rebuild-faber
  ./serve.sh --no-build
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
      echo "triga-budapest serve: unknown arg: $1" >&2
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
      kill "${old}" 2>/dev/null || true
      wait "${old}" 2>/dev/null || true
    fi
    rm -f "${PID_FILE}"
  fi
  if command -v lsof >/dev/null 2>&1; then
    local pids
    pids="$(lsof -tiTCP:"${PORT}" -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "${pids}" ]]; then
      kill ${pids} 2>/dev/null || true
      sleep 0.2
    fi
  fi
}

if [[ "${REBUILD_FABER}" -eq 1 ]]; then
  (cd "${WORKSPACE}/faber" && cargo build -p faber)
fi

if [[ "${DO_BUILD}" -eq 1 ]]; then
  if ! FABER_BIN="$(resolve_faber)"; then
    echo "triga-budapest serve: no faber binary found." >&2
    exit 1
  fi
  write_lockfile
  (
    cd "${APP_DIR}"
    "${FABER_BIN}" build --package .
  )
fi

if [[ ! -f "${APP_DIR}/dist/pages/index.html" ]]; then
  echo "triga-budapest serve: dist/pages/index.html missing" >&2
  exit 1
fi

stop_existing
echo "serving ${APP_DIR}/dist on http://127.0.0.1:${PORT}/pages/index.html"
cd "${APP_DIR}/dist"
python3 -m http.server "${PORT}" &
SERVER_PID=$!
echo "${SERVER_PID}" > "${PID_FILE}"
trap 'kill "${SERVER_PID}" 2>/dev/null || true; rm -f "${PID_FILE}"; exit 0' INT TERM
wait "${SERVER_PID}"
rm -f "${PID_FILE}"
