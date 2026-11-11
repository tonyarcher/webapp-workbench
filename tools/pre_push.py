"""Local pre-push gate: repo checks plus the test suites of changed workspaces.

Run automatically by .git/hooks/pre-push (bypass with `git push --no-verify`).
Only stdlib is used (pathlib, subprocess, shutil, sys).

What it runs, fail-fast in this order:
  1. git diff --check (whitespace the repo never lands)
  2. python tools/verify.py (the repo's own formatter/linter gate)
  3. npm run typecheck (every workspace; mirrors the CI Web job)
  4. for each changed workspace: its `test` script, then `test:e2e` when present

Changed means pushed by this push (from the hook's ref range), so an RSS-only
push never pays for baseball's browser suite. When the range cannot be
determined (deleted refs, no upstream), it falls back to working-tree files.
Full `npm run build` and Gradle stay CI-side: they are minutes long and a
push gate that slow gets bypassed forever.
"""

from __future__ import annotations

import json
import pathlib
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
ZERO = "0" * 40


def run(argv: list[str], cwd: pathlib.Path) -> int:
    """Run argv, streaming output, returning the exit code."""
    resolved = shutil.which(argv[0])
    if resolved is None:
        print(f"pre-push: {argv[0]} not on PATH, cannot gate on it")
        return 1
    proc = subprocess.run([resolved, *argv[1:]], cwd=cwd, check=False)
    return proc.returncode


def ref_range() -> list[tuple[str, str]]:
    """(local_sha, remote_sha) pairs from the hook's stdin, if any."""
    pairs: list[tuple[str, str]] = []
    if sys.stdin.isatty():
        return pairs
    for line in sys.stdin.read().splitlines():
        parts = line.split()
        if len(parts) == 4:
            pairs.append((parts[1], parts[3]))
    return pairs


def merge_base(a: str, b: str) -> str | None:
    proc = subprocess.run(
        ["git", "merge-base", a, b],
        cwd=ROOT,
        check=False,
        capture_output=True,
        text=True,
    )
    return proc.stdout.strip() or None if proc.returncode == 0 else None


def push_ranges() -> list[tuple[str, str]]:
    """(base, tip) pairs this push carries, from the hook's stdin."""
    ranges: list[tuple[str, str]] = []
    for local, remote in ref_range():
        if local == ZERO:
            continue  # deleted ref: nothing to test
        if remote == ZERO:
            base = merge_base(local, "origin/main") or merge_base(
                local, "origin/master"
            )
            if base:
                ranges.append((base, local))
        else:
            ranges.append((remote, local))
    return ranges


def collect_names(args: list[str], into: set[str]) -> None:
    proc = subprocess.run(
        ["git", *args],
        cwd=ROOT,
        check=False,
        capture_output=True,
        text=True,
    )
    if proc.returncode == 0:
        into.update(proc.stdout.split())


def changed_files(ranges: list[tuple[str, str]]) -> list[str]:
    """Files the push carries, falling back to working-tree files."""
    names: set[str] = set()
    for base, tip in ranges:
        collect_names(["diff", "--name-only", f"{base}..{tip}", "--"], names)
    if not ranges:
        for args in (
            ["diff", "--name-only", "--"],
            ["diff", "--name-only", "--cached", "--"],
        ):
            collect_names(args, names)
    return sorted(names)


def workspace_of(path: str) -> tuple[str, pathlib.Path] | None:
    """(npm name, dir) of the nearest ancestor holding a package.json, if any."""
    candidate = (ROOT / path).parent
    while candidate != ROOT and ROOT in candidate.parents:
        manifest = candidate / "package.json"
        if manifest.is_file():
            try:
                name = json.loads(manifest.read_text(encoding="utf-8")).get("name")
            except (OSError, ValueError):
                name = None
            if isinstance(name, str) and name:
                return name, candidate
            return candidate.name, candidate
        candidate = candidate.parent
    return None


def main() -> int:
    ranges = push_ranges()
    workspaces: dict[str, pathlib.Path] = {}
    for name in changed_files(ranges):
        found = workspace_of(name)
        if found is not None:
            ws_name, ws_dir = found
            workspaces.setdefault(ws_name, ws_dir)
    if workspaces:
        print(f"pre-push: changed workspaces: {', '.join(sorted(workspaces))}")
    else:
        print("pre-push: no workspace changes detected")

    steps: list[tuple[str, list[str], pathlib.Path]] = [
        ("tools/verify.py", [sys.executable, "tools/verify.py"], ROOT),
        ("npm run typecheck", ["npm", "run", "typecheck"], ROOT),
    ]
    # Whitespace over exactly what this push carries; a manual run with no
    # ref range checks the working tree instead.
    if ranges:
        for base, tip in ranges:
            steps.insert(
                0,
                (
                    f"git diff --check {base[:7]}..{tip[:7]}",
                    ["git", "diff", "--check", f"{base}..{tip}", "--"],
                    ROOT,
                ),
            )
    else:
        steps.insert(0, ("git diff --check", ["git", "diff", "--check", "--"], ROOT))
    for ws_name in sorted(workspaces):
        steps.append(
            (
                f"npm test -w {ws_name} (if present)",
                ["npm", "test", "--workspace", ws_name, "--if-present"],
                ROOT,
            )
        )
        steps.append(
            (
                f"npm run test:e2e -w {ws_name} (if present)",
                ["npm", "run", "test:e2e", "--workspace", ws_name, "--if-present"],
                ROOT,
            )
        )
    for label, argv, cwd in steps:
        print(f"pre-push: {label}")
        if run(argv, cwd) != 0:
            print(f"pre-push: FAILED: {label}")
            print("pre-push: fix it, or bypass once with `git push --no-verify`")
            return 1
    print("pre-push: all gates passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
