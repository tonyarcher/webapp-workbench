#!/usr/bin/env python3
"""Build entry point: kick the root Gradle build (JS workspaces + Kotlin APIs).

Run: `python3 build.py [app...]` (usually `python build.py` on Windows). App
names are deploy ids, aliases, or folders; no names builds everything. Gradle
owns the build logic; this file only maps arguments.

Only stdlib is used (subprocess, sys).
"""

from __future__ import annotations

import os
import subprocess
import sys

HELP = """Build every workspace (JS + Kotlin APIs) through Gradle.

Usage:
  python build.py [app...] [--dry-run]

Apps:
  Deploy ids or aliases (rss, stock, lemmy, ...), or folders (apps/rss).
  No app names builds everything: `./gradlew buildAll`.
  A folder selects both halves, e.g. apps/rss = rss-reader + rss-api.

Also:
  ./gradlew buildJvm   Kotlin APIs only
  ./gradlew buildNode  JS workspaces only
  ./gradlew checkAll   API tests, detekt, Jacoco gates
""".strip()


def gradle_argv(argv: list[str]) -> list[str]:
    """Map build arguments to the Gradle command line (mapping only)."""
    apps = [arg for arg in argv if not arg.startswith("-")]
    args = ["buildAll"]
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
    """Print help or run the mapped Gradle build."""
    if any(arg in ("-h", "--help") for arg in argv):
        print(HELP)
        return 0
    unknown = [arg for arg in argv if arg.startswith("-") and arg != "--dry-run"]
    if unknown:
        print(f"error: unknown option {unknown[0]}", file=sys.stderr)
        return 1
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
