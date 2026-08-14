#!/usr/bin/env bash
# Deploy the compose stack (Linux / macOS / Git Bash).
# Auto-selects the SSH-tunneled remote Docker daemon or local Docker.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

if ! command -v node >/dev/null 2>&1; then
  echo "error: node is required to run deploy.sh" >&2
  exit 1
fi

exec node "$ROOT/scripts/deploy.mjs" "$@"
