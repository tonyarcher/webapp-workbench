# Tab completion for the Python entry points (bash / Git Bash).
# Usage from the repo root: source scripts/complete-deploy.bash
# python3 preferred, bare python as fallback (Git Bash ships either).
_webapp_workbench_python() {
    if command -v python3 >/dev/null 2>&1; then
        echo python3
    elif command -v python >/dev/null 2>&1; then
        echo python
    fi
}

# App names and aliases from apps.json (the Gradle app catalog).
_webapp_workbench_catalog() {
    local root py
    root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
    py="$(_webapp_workbench_python)"
    [ -n "$py" ] || return 0
    "$py" - "$root/apps.json" 2>/dev/null <<'EOF'
import json
import sys
with open(sys.argv[1], encoding="utf-8") as handle:
    catalog = json.load(handle)
names = [app["id"] for app in catalog["apps"]]
for app in catalog["apps"]:
    names.extend(app.get("aliases", []))
names.extend(catalog.get("dockerOnly", {}).keys())
print("\n".join(names))
EOF
}

_webapp_workbench_apps() {
    # App names and aliases from apps.json (the Gradle app catalog).
    _webapp_workbench_catalog
    # Folder shortcuts: the first two path segments of every alias (apps/rss, ...).
    _webapp_workbench_catalog | awk -F/ 'NF>1 {print $1"/"$2}'
}

_webapp_workbench_build() {
    local cur apps
    cur="${COMP_WORDS[COMP_CWORD]}"
    apps="$(_webapp_workbench_apps | sort -u)"
    # mapfile is bash 4+; this is the portable completion idiom.
    # shellcheck disable=SC2207
    COMPREPLY=($(compgen -W "$apps" -- "$cur"))
}

_webapp_workbench_deploy() {
    local cur apps opts
    cur="${COMP_WORDS[COMP_CWORD]}"
    apps="$(_webapp_workbench_apps | sort -u)"
    opts="--local --remote --no-build --build-only --down --status --help --dry-run"
    # mapfile is bash 4+; this is the portable completion idiom.
    # shellcheck disable=SC2207
    COMPREPLY=($(compgen -W "$opts $apps" -- "$cur"))
}

complete -o default -F _webapp_workbench_build build.py
complete -o default -F _webapp_workbench_deploy deploy.py
