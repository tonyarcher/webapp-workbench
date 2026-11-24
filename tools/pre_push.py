"""Local pre-push gate: scoped verification plus tests for what this push carries.

Run automatically by .git/hooks/pre-push (bypass with `git push --no-verify`).
Only stdlib is used (json, os, pathlib, shutil, subprocess, sys).

Fail-fast order:
  1. git diff --check over the pushed range
  2. python tools/verify.py --changed over the exact pushed files
  3. npm run build / test / test:e2e for each changed npm workspace
  4. tools' own unittest suite when tooling changed
  5. ./gradlew :<api>:check for each changed Kotlin API

Changed means pushed by this push (from the hook's ref range), so an Times
Up-only push never pays for baseball's browser suite. When the range cannot be
determined (deleted refs, no upstream), it falls back to working-tree files.
"""

from __future__ import annotations

import json
import os
import pathlib
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
ZERO = "0" * 40


def run(argv: list[str], cwd: pathlib.Path, env: dict[str, str] | None = None) -> int:
    """Run argv, streaming output, returning the exit code."""
    resolved = shutil.which(argv[0])
    if resolved is None:
        print(f"pre-push: {argv[0]} not on PATH, cannot gate on it")
        return 1
    merged = os.environ.copy()
    if env:
        merged.update(env)
    proc = subprocess.run([resolved, *argv[1:]], cwd=cwd, env=merged, check=False)
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
            ["ls-files", "--others", "--exclude-standard"],
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


def all_workspaces() -> dict[str, tuple[pathlib.Path, set[str]]]:
    """Every npm workspace under apps/, with its direct workspace dependencies."""
    found: dict[str, tuple[pathlib.Path, set[str]]] = {}
    for manifest in sorted(ROOT.glob("apps/**/package.json")):
        parts = set(manifest.relative_to(ROOT).parts)
        if parts & {"node_modules", "dist", "build"}:
            continue
        try:
            data = json.loads(manifest.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        name = data.get("name")
        if not isinstance(name, str) or not name:
            continue
        deps: set[str] = set()
        for field in ("dependencies", "devDependencies", "peerDependencies"):
            values = data.get(field)
            if isinstance(values, dict):
                deps.update(key for key in values if isinstance(key, str))
        found[name] = (manifest.parent, deps)
    return found


def affected_workspaces(changed_names: list[str]) -> dict[str, pathlib.Path]:
    """Changed workspaces plus every workspace that depends on them."""
    catalog = all_workspaces()
    seeds: set[str] = set()
    for name in changed_names:
        found = workspace_of(name)
        if found is not None:
            seeds.add(found[0])
    if "package.json" in changed_names or "package-lock.json" in changed_names:
        seeds.update(catalog)

    result: dict[str, pathlib.Path] = {}
    queue = sorted(seeds)
    while queue:
        name = queue.pop(0)
        if name in result:
            continue
        entry = catalog.get(name)
        if entry is None:
            continue
        result[name] = entry[0]
        for candidate, (_, deps) in catalog.items():
            if name in deps and candidate not in result:
                queue.append(candidate)
    return result


def ordered_workspaces(names: set[str]) -> list[str]:
    """Workspace names with dependencies before the workspaces that consume them."""
    catalog = all_workspaces()
    ordered: list[str] = []
    visiting: set[str] = set()
    visited: set[str] = set()

    def visit(name: str) -> None:
        if name in visited or name in visiting:
            return
        visiting.add(name)
        deps = catalog.get(name, (None, set()))[1]
        for dep in sorted(deps):
            if dep in names:
                visit(dep)
        visiting.discard(name)
        visited.add(name)
        ordered.append(name)

    for name in sorted(names):
        visit(name)
    return ordered


def build_inputs_changed(files: list[str]) -> bool:
    """Root build inputs that validate app catalogs and every Gradle module."""
    roots = {
        "apps.json",
        "build.gradle.kts",
        "settings.gradle.kts",
        "gradlew",
        "gradlew.bat",
        "package.json",
        "package-lock.json",
    }
    return any(
        name in roots or name.startswith(("buildSrc/", "gradle/")) for name in files
    )


def api_services_for_files(files: list[str]) -> list[str]:
    """Gradle module names whose apps/<app>/api tree changed."""
    try:
        catalog = json.loads((ROOT / "apps.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []
    jars = catalog.get("apiJars")
    if not isinstance(jars, dict):
        return []
    services: set[str] = set()
    for service, jar in jars.items():
        if not isinstance(service, str) or not isinstance(jar, str):
            continue
        prefix = jar.split("/build/", 1)[0] + "/"
        if any(name.startswith(prefix) for name in files):
            services.add(service)
    return sorted(services)


def gradlew() -> list[str]:
    """Cross-platform invocation of the committed Gradle wrapper."""
    if os.name == "nt":
        return ["cmd", "/c", str(ROOT / "gradlew.bat")]
    return [str(ROOT / "gradlew")]


def main() -> int:
    ranges = push_ranges()
    files = changed_files(ranges)
    workspaces = affected_workspaces(files)
    apis = api_services_for_files(files)
    build_inputs = build_inputs_changed(files)
    ws_label = ", ".join(sorted(workspaces)) or "none"
    print(f"pre-push: {len(files)} changed files, workspaces: {ws_label}")
    if build_inputs:
        print("pre-push: build inputs changed")
    if apis:
        print(f"pre-push: changed APIs: {', '.join(apis)}")

    steps: list[tuple[str, list[str], pathlib.Path, dict[str, str] | None]] = []
    if ranges:
        for base, tip in ranges:
            steps.append(
                (
                    f"git diff --check {base[:7]}..{tip[:7]}",
                    ["git", "diff", "--check", f"{base}..{tip}", "--"],
                    ROOT,
                    None,
                )
            )
    else:
        steps.append(("git diff --check", ["git", "diff", "--check", "--"], ROOT, None))

    scoped_env = {"VERIFY_CHANGED_FILES": json.dumps(files)} if ranges else None
    steps.append(
        (
            "tools/verify.py --changed",
            [sys.executable, "tools/verify.py", "--changed"],
            ROOT,
            scoped_env,
        )
    )

    if any(name.startswith("tools/") for name in files) or build_inputs:
        steps.append(
            ("npm run test:scripts", ["npm", "run", "test:scripts"], ROOT, None)
        )
    if build_inputs:
        steps.append(("./gradlew checkAll", [*gradlew(), "checkAll"], ROOT, None))

    for ws_name in ordered_workspaces(set(workspaces)):
        for script in ("typecheck", "build", "test", "test:e2e"):
            steps.append(
                (
                    f"npm run {script} -w {ws_name} (if present)",
                    ["npm", "run", script, "--workspace", ws_name, "--if-present"],
                    ROOT,
                    None,
                )
            )
    for service in apis:
        steps.append(
            (
                f"./gradlew :{service}:check",
                [*gradlew(), f":{service}:check"],
                ROOT,
                None,
            )
        )

    for label, argv, cwd, env in steps:
        print(f"pre-push: {label}")
        if run(argv, cwd, env) != 0:
            print(f"pre-push: FAILED: {label}")
            print("pre-push: fix it, or bypass once with `git push --no-verify`")
            return 1
    print("pre-push: all gates passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
