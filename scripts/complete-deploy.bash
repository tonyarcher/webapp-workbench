# Tab completion for ./deploy.sh (bash / Git Bash).
# Usage from the repo root: source scripts/complete-deploy.bash
_webapp_workbench_deploy() {
  local cur root apps opts
  cur="${COMP_WORDS[COMP_CWORD]}"
  root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  apps="$(node "$root/scripts/apps.mjs" --complete 2>/dev/null || true)"
  opts="--local --remote --no-build --build-only --down --status --help"
  COMPREPLY=( $(compgen -W "$opts $apps" -- "$cur") )
}
complete -o default -F _webapp_workbench_deploy deploy.sh
complete -o default -F _webapp_workbench_deploy ./deploy.sh
