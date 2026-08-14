#!/usr/bin/env bash
# Production-build workspaces (Linux / macOS / Git Bash).
# Usage: ./build.sh [app...]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

if ! command -v node >/dev/null 2>&1; then
  echo "error: node is required to run build.sh" >&2
  exit 1
fi

exec node "$ROOT/scripts/build.mjs" "$@"
