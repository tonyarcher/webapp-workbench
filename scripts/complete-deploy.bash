# Tab completion for the Python entry points (bash / Git Bash).
# Usage from the repo root: source scripts/complete-deploy.bash
_webapp_workbench_apps() {
  local root
  root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  # App names and aliases from build.gradle.kts (appMappings + appAliases).
  grep -oE '"[@a-z0-9/.-]+" to' "$root/build.gradle.kts" 2>/dev/null | tr -d '"' | sed 's/ to$//'
  # Folder shortcuts: the first two path segments of every alias (apps/rss, ...).
  grep -oE '"[a-z0-9.-]+/[a-z0-9/.-]+" to' "$root/build.gradle.kts" 2>/dev/null |
    tr -d '"' | sed 's/ to$//' | awk -F/ '{print $1"/"$2}'
}

_webapp_workbench_build() {
  local cur apps
  cur="${COMP_WORDS[COMP_CWORD]}"
  apps="$(_webapp_workbench_apps | sort -u)"
  COMPREPLY=( $(compgen -W "$apps" -- "$cur") )
}

_webapp_workbench_deploy() {
  local cur apps opts
  cur="${COMP_WORDS[COMP_CWORD]}"
  apps="$(_webapp_workbench_apps | sort -u)"
  opts="--local --remote --no-build --build-only --down --status --help --dry-run"
  COMPREPLY=( $(compgen -W "$opts $apps" -- "$cur") )
}

complete -o default -F _webapp_workbench_build build.py
complete -o default -F _webapp_workbench_deploy deploy.py
