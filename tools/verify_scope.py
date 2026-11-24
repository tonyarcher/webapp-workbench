"""Git and npm-workspace discovery for scoped verification."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

Check = tuple[str, str, list[str]]


def changed_files(root: Path, skip_dirs: frozenset[str]) -> list[Path]:
    """Tracked modifications plus untracked files, excluding generated trees."""
    tracked = subprocess.run(
        ["git", "diff", "--name-only", "-z", "HEAD", "--"],
        cwd=root,
        check=True,
        capture_output=True,
    ).stdout
    untracked = subprocess.run(
        ["git", "ls-files", "--others", "--exclude-standard", "-z"],
        cwd=root,
        check=True,
        capture_output=True,
    ).stdout
    names = {
        name.decode("utf-8", errors="replace")
        for blob in (tracked, untracked)
        for name in blob.split(b"\0")
        if name
    }
    return [
        path
        for name in sorted(names)
        if (path := (root / name).resolve()).is_file()
        and path.is_relative_to(root)
        and not (set(path.relative_to(root).parts) & skip_dirs)
    ]


def workspace_typechecks(
    root: Path,
    files: list[Path],
    typescript_suffixes: tuple[str, ...],
) -> list[Check]:
    """Typecheck only npm workspaces represented by the selected files."""
    workspaces: set[str] = set()
    full = False
    config_names = {"package.json"}
    for path in files:
        is_typescript_config = path.suffix == ".json" and path.name.startswith(
            "tsconfig"
        )
        if (
            path.suffix.lower() not in typescript_suffixes
            and path.name not in config_names
            and not is_typescript_config
        ):
            continue
        candidate = path.parent
        manifest: Path | None = None
        while candidate.is_relative_to(root):
            package = candidate / "package.json"
            if package.is_file():
                manifest = package
                break
            if candidate == root:
                break
            candidate = candidate.parent
        if manifest is None or manifest == root / "package.json":
            full = True
            continue
        try:
            name = json.loads(manifest.read_text(encoding="utf-8")).get("name")
        except (OSError, json.JSONDecodeError):
            continue
        if isinstance(name, str) and name:
            workspaces.add(name)
    if full:
        return [("tsc", "npm", ["npm", "run", "typecheck"])]
    return [
        (
            f"tsc[{name}]",
            "npm",
            ["npm", "run", "typecheck", "--workspace", name, "--if-present"],
        )
        for name in sorted(workspaces)
    ]
