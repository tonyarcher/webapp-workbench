#!/usr/bin/env python3
"""Local JS production build for every workspace, or only the named apps.

App names match deploy (baseball, rss, stock, lemmy, …) and pull in
library workspaces those apps need.

Run: `python3 scripts/build.py [app...]` (usually via build.sh / build.ps1).
JS runtime: npm by default, `bun` opt-in via `--js-runtime` or `JS_RUNTIME`.
Docker image builds stay on npm regardless; this flag is local-only.
Only stdlib is used (subprocess, concurrent via scripts.pool).
"""

from __future__ import annotations

import os
import subprocess
import sys
from functools import partial
from typing import Any

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from scripts.apps import (
    build_waves,
    expand_folders,
    format_app_list,
    resolve_app,
    resolve_apps,
)
from scripts.pool import run_pool

HELP = f"""Build JS workspaces locally from the repo root (npm by default, bun opt-in).

Docker image builds happen in deploy, not here (images stay on npm).
To rebuild and roll out one app:  ./deploy.sh rss-reader   (or .\\deploy.ps1 rss-reader)

Usage:
  build.sh | build.ps1 [--js-runtime npm|bun] [app...]

Named workspaces build in parallel across CPUs (JOBS caps it, default: CPU
count). A bare run still delegates to the runtime's serial build-all.

  npm:  npm run build                      (root --workspaces --if-present)
  bun:  bun run --filter '*' build         (experimental)

JS runtime: --js-runtime flag wins, then JS_RUNTIME env, else npm.

Apps:
{format_app_list()}

Examples:
  ./build.sh
  ./build.sh baseball
  ./build.sh --js-runtime bun rss lemmy
  JS_RUNTIME=bun ./build.sh rss
  ./build.sh apps/rss   (UI and API together)
""".strip()

JS_RUNTIMES = ("npm", "bun")
DEFAULT_JS_RUNTIME = "npm"


def spawn_js(runtime: str, args: list[str]) -> int:
    """Run the JS runtime in ROOT, inheriting stdio. Returns the exit code."""
    try:
        proc = subprocess.run(
            [runtime, *args],
            cwd=ROOT,
            stdin=sys.stdin,
            stdout=sys.stdout,
            stderr=sys.stderr,
            check=False,
            shell=sys.platform == "win32",
        )
    except OSError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    return proc.returncode


def spawn_npm(args: list[str]) -> int:
    """Run npm in ROOT (kept for backward compat); prefer spawn_js."""
    return spawn_js("npm", args)


def parse_args(argv: list[str]) -> dict[str, Any]:
    """Split -h/--help and --js-runtime from app names."""
    names: list[str] = []
    js_runtime: str | None = None
    index = 0
    while index < len(argv):
        arg = argv[index]
        if arg in ("-h", "--help"):
            return {"help": True, "names": [], "js_runtime": js_runtime}
        if arg.startswith("--js-runtime="):
            js_runtime = arg.split("=", 1)[1]
            if not js_runtime.strip():
                raise RuntimeError("Missing value for --js-runtime (want npm|bun).")
        elif arg == "--js-runtime":
            index += 1
            if index >= len(argv):
                raise RuntimeError("Missing value for --js-runtime (want npm|bun).")
            js_runtime = argv[index]
        else:
            names.append(arg)
        index += 1
    return {"help": False, "names": names, "js_runtime": js_runtime}


def select_js_runtime(cli_value: str | None) -> str:
    """Resolve the JS runtime: --js-runtime flag, then JS_RUNTIME env, else npm."""
    raw = cli_value if cli_value is not None else os.environ.get("JS_RUNTIME", "")
    runtime = raw.strip().lower() or DEFAULT_JS_RUNTIME
    if runtime not in JS_RUNTIMES:
        raise RuntimeError(f'JS runtime must be npm or bun (got "{raw}").')
    return runtime


def js_install_args(runtime: str) -> list[str]:
    """Install args for the runtime."""
    return ["install"]


def js_build_args(runtime: str, workspace: str) -> list[str]:
    """Build-one-workspace args: npm uses -w, bun uses --filter."""
    if runtime == "bun":
        return ["run", "--filter", workspace, "build"]
    return ["run", "build", "-w", workspace]


def js_bare_build_args(runtime: str) -> list[str]:
    """Build-everything args for a bare run."""
    if runtime == "bun":
        return ["run", "--filter", "*", "build"]
    return ["run", "build"]


class BuildError(RuntimeError):
    """A failed workspace build carrying npm's exit code."""

    def __init__(self, message: str, code: int) -> None:
        super().__init__(message)
        self.code = code


def build_workspace(workspace: str, runtime: str = DEFAULT_JS_RUNTIME) -> None:
    """Build one workspace with the selected runtime, raising on failure."""
    args = js_build_args(runtime, workspace)
    print(f"==> {runtime} {' '.join(args)}")
    code = spawn_js(runtime, args)
    if code != 0:
        raise BuildError(f"{runtime} {' '.join(args)} failed with code {code}.", code)


def ensure_installed(runtime: str) -> int:
    """Install deps when node_modules is missing. Returns the exit code."""
    if os.path.exists(os.path.join(ROOT, "node_modules")):
        return 0
    print(f"==> {runtime} install (node_modules missing)")
    return spawn_js(runtime, js_install_args(runtime))


def run_bare_build(runtime: str) -> int:
    """Serial build-all via the runtime. Returns the exit code."""
    args = js_bare_build_args(runtime)
    print(f"==> {runtime} {' '.join(args)}")
    return spawn_js(runtime, args)


def run_named_build(names: list[str], runtime: str) -> int:
    """Build the waves for named apps. Returns the exit code."""
    expanded = expand_folders(names)
    known = [name for name in expanded if resolve_app(name)]
    unknown = [name for name in expanded if not resolve_app(name)]
    apps = resolve_apps(known)
    waves = build_waves(apps, unknown)

    if not waves:
        if apps and all(not app.workspaces for app in apps):
            services = " ".join(app.service for app in apps)
            print(
                f"==> {', '.join(names)} has no JS workspace; use ./deploy.sh --build-only {services}"
            )
            return 0
        raise RuntimeError(f"Nothing to build for: {', '.join(names)}")

    for wave in waves:
        failed = run_pool(wave, partial(build_workspace, runtime=runtime))
        if failed:
            for _, error in failed:
                print(f"error: {error}", file=sys.stderr)
            code = getattr(failed[0][1], "code", None)
            return code if isinstance(code, int) and code else 1
    return 0


def main() -> int:
    """Build entry point; returns the process exit code."""
    parsed = parse_args(sys.argv[1:])
    if parsed["help"]:
        print(HELP)
        return 0
    runtime = select_js_runtime(parsed["js_runtime"])

    installed = ensure_installed(runtime)
    if installed != 0:
        return installed

    names: list[str] = parsed["names"]
    if not names:
        return run_bare_build(runtime)
    return run_named_build(names, runtime)


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as error:  # noqa: BLE001 - CLI boundary reports the error and exits 1
        print(f"error: {error}", file=sys.stderr)
        sys.exit(1)
