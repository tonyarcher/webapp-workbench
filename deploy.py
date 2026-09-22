#!/usr/bin/env python3
"""Deploy entry point: kick the root Gradle deploy task.

Run: `python3 deploy.py [options] [app...] [-- <compose args>]`
(usually `python deploy.py` on Windows). Gradle builds the host artifacts,
renders the gateway config, mints TLS certs, and drives `docker compose`; this
file only maps arguments.

Only stdlib is used (subprocess, sys).
"""

from __future__ import annotations

import os
import subprocess
import sys

FLAGS = (
    "--local",
    "--remote",
    "--no-build",
    "--build-only",
    "--down",
    "--status",
    "--help",
)

# The same flags after mapping to bare tokens (used to tell flags from app names).
BARE_FLAGS = tuple(flag[2:] for flag in FLAGS)

HELP = """Deploy the compose stack with docker compose.

Usage:
  python deploy.py [options] [app...] [-- <compose args>]

Options:
  --local        Force the local Docker engine
  --remote       Force the tunneled remote engine
  --no-build     Start the stack without rebuilding images
  --build-only   Build images only (do not start containers)
  --down         Stop and remove the whole stack
  --status       Show compose service status
  --help         Show this help
  --dry-run      Print the Gradle command instead of running it

Apps:
  Deploy ids or aliases (rss, stock, lemmy, ...), or folders (apps/rss).
  No app names rebuilds every service.

Environment: DOCKER_HOST, DOCKER_TUNNEL (default tcp://127.0.0.1:2375),
DEPLOY_TARGET (auto|local|remote). TLS_HOSTS drives the gateway certs.
""".strip()


def gradle_argv(argv: list[str]) -> list[str]:
    """Map deploy arguments to the `gradle deploy` command line (mapping only)."""
    tokens: list[str] = []
    passthrough: list[str] = []
    after_separator = False
    for arg in argv:
        if arg == "--dry-run":
            continue
        if after_separator:
            passthrough.append(arg)
        elif arg == "--":
            after_separator = True
        elif arg in FLAGS:
            tokens.append(arg[2:])
        elif arg.startswith("-"):
            passthrough.append(arg)
        else:
            tokens.append(arg)
    # Plain console: the rich progress bar hides compose lines.
    args = ["deploy", "--console=plain"]
    if tokens:
        args.append(f"-Pargs={' '.join(tokens)}")
    if passthrough:
        args.append(f"-Ppassthrough={' '.join(passthrough)}")
    # Build only the named apps (Docker-only names are ignored by the build).
    apps = [arg for arg in tokens if arg not in BARE_FLAGS]
    if apps:
        args.append(f"-Papps={','.join(apps)}")
    return args


def gradle_command() -> list[str]:
    """The repo wrapper when present (gradlew.bat on Windows, ./gradlew
    elsewhere), else `gradle` from PATH (the wrapper is local-only)."""
    wrapper = "gradlew.bat" if sys.platform == "win32" else "./gradlew"
    if os.path.exists(wrapper):
        return [wrapper]
    return ["gradle"]


def main(argv: list[str]) -> int:
    """Print help or run the mapped Gradle deploy."""
    if any(arg in ("-h", "--help") for arg in argv):
        print(HELP)
        return 0
    args = gradle_argv(argv)
    command = [*gradle_command(), *args]
    if "--dry-run" in argv:
        print(" ".join(command))
        return 0
    # gradlew.bat needs the shell on Windows; ./gradlew is a script elsewhere.
    return subprocess.run(
        command, cwd=".", check=False, shell=sys.platform == "win32"
    ).returncode


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
