#!/usr/bin/env bash
# Deploy the compose stack (Linux / macOS / Git Bash).
# Auto-selects the SSH-tunneled remote Docker daemon or local Docker.
# Tab completion: source scripts/complete-deploy.bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

if ! command -v python3 >/dev/null 2>&1; then
  echo "error: python3 is required to run deploy.sh" >&2
  exit 1
fi

exec python3 "$ROOT/scripts/deploy.py" "$@"
