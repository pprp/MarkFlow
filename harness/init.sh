#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="${1:---smoke}"

usage() {
  cat <<'EOF'
Usage: ./harness/init.sh [--smoke|--editor-dev|--desktop-dev|--install]

  --smoke       Validate harness files and run workspace smoke tests.
  --editor-dev  Start the browser editor dev server.
  --desktop-dev Start the Electron desktop workflow.
  --install     Install workspace dependencies.
EOF
}

ensure_dependencies() {
  if [ ! -d "$ROOT_DIR/node_modules" ]; then
    echo "[harness] Installing workspace dependencies..."
    (cd "$ROOT_DIR" && pnpm install)
  fi
}

ensure_dependencies

case "$MODE" in
  --smoke)
    echo "[harness] Repo: $ROOT_DIR"
    (cd "$ROOT_DIR" && pnpm harness:verify)
    (cd "$ROOT_DIR" && pnpm test)
    ;;
  --editor-dev)
    (cd "$ROOT_DIR" && pnpm dev)
    ;;
  --desktop-dev)
    (cd "$ROOT_DIR" && pnpm desktop)
    ;;
  --install)
    (cd "$ROOT_DIR" && pnpm install)
    ;;
  *)
    usage
    exit 1
    ;;
esac
