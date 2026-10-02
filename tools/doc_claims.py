"""Reading the claims a doc makes, and deciding whether they still hold.

Imported by docs_test.py, which holds the tests. Only the extraction and lookup
lives here, so a check that needs a new way to read a claim adds a function
rather than a method on the test class.

Only stdlib is used.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
from collections.abc import Callable
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent

# Directories pruned from the walk. This list is an optimisation, NOT the
# definition of generated output: it keeps the walk fast, and nothing tracked
# lives under these names (checked with `git ls-files`). What a fresh clone
# actually lacks is decided by git_ignored, which catches generated files that
# sit in ordinary directories.
SKIP_DIRS = frozenset(
    {
        ".git",
        ".gradle",
        ".kotlin",
        ".mypy_cache",
        ".ruff_cache",
        "__pycache__",
        "build",
        "coverage",
        "dist",
        "node_modules",
        "out",
        "target",
    }
)

DOC_NAMES = ("AGENTS.md", "README.md")

# An extension is what makes a backticked token a path claim rather than prose.
FILE_EXT = (
    r"(?:ts|tsx|kt|kts|json|jsonc|yml|yaml|md|js|mjs|cjs|py|css|html"
    r"|conf|template|sh|bash|ps1|sql|xml|properties|toml|txt)"
)
BACKTICKED = re.compile(r"`([^`\n]+)`")
IS_FILE_PATH = re.compile(rf"\.{FILE_EXT}$")
# Placeholders, globs, template expressions, and prose punctuation are not claims.
NOT_A_PATH = re.compile(r"[<>*${}()|\\]|\.\.\.|\s")
NPM_RUN = re.compile(r"npm run ([A-Za-z0-9:_-]+)")
GRADLE_TASK = re.compile(r"gradlew ([A-Za-z][A-Za-z0-9]*)")
COUNT_NOUNS = r"(?:apps|packages|workspaces|services|endpoints|routes)"
# Only a bare count is checked. A doc may legitimately say "2 of 16 apps use
# plain Vite", so requiring N == M in an "N of M" phrase would fail accurate
# prose; the rot it targeted ("listed 7 of 11 apps" when the repo has 16) is
# still caught, because both 7 and 11 disagree with the real count.
COUNT_BARE = re.compile(rf"\b(\d+)\s+({COUNT_NOUNS})\b")

# A doc may assert that a file does not exist, naming it in order to deny it.
# Every entry must carry the reason it is not rot, checked by its own test, so
# this cannot decay into a bare ignore list.
NEGATED: dict[tuple[str, str], str] = {
    ("apps/radio-station/AGENTS.md", "api/AGENTS.md"): (
        "the doc states there is no separate api/AGENTS.md, naming the path to deny it"
    ),
}

# A scan that quietly stops matching passes every test while checking nothing.
# These floors are the measured yield of the patterns above, set well below it.
MIN_PATHS = 40
MIN_SCRIPTS = 10
MIN_TASKS = 8

# Paths per git call, to stay clear of the Windows command-line length limit,
# and a ceiling on how long git may take, so a wedged git fails the suite
# instead of stalling it.
ARG_CHUNK = 100
GIT_TIMEOUT = 60


def walk(root: Path) -> list[tuple[Path, list[str], list[str]]]:
    """(dir, subdirs, files) for real source dirs, with SKIP_DIRS pruned away.

    The pruned subdir list is returned rather than re-read with listdir, so a
    vendored or generated directory never contributes an entry to the index.
    """
    out: list[tuple[Path, list[str], list[str]]] = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = sorted(d for d in dirnames if d not in SKIP_DIRS)
        out.append((Path(dirpath), list(dirnames), list(filenames)))
    return out


def doc_files() -> list[Path]:
    """Every AGENTS.md and README.md in the repo, excluding generated trees."""
    found: list[Path] = []
    for name in DOC_NAMES:
        found.extend(ROOT.rglob(name))
    return sorted(p for p in found if not SKIP_DIRS & set(p.relative_to(ROOT).parts))


def read(path: Path) -> str:
    """Read a doc as text, tolerating a byte some earlier tool mangled.

    A decode error here surfaces as an unrelated test error and buries the rot
    the test exists to report, so bad bytes are replaced rather than raised.
    """
    return path.read_text(encoding="utf-8", errors="replace")


def repo_entries() -> set[str]:
    """Repo-relative posix paths of every real file and directory.

    Subdirectories come from the pruned walk, so `node_modules` and `dist` are
    absent and a doc cannot pass by naming one.
    """
    entries: set[str] = set()
    for dirpath, subdirs, files in walk(ROOT):
        rel = dirpath.relative_to(ROOT).as_posix()
        base = "" if rel == "." else f"{rel}/"
        entries.update(base + name for name in files)
        entries.update(base + name for name in subdirs)
    return entries


def npm_scripts() -> set[str]:
    """Every script name declared by any package.json in the repo."""
    names: set[str] = set()
    for dirpath, _subdirs, files in walk(ROOT):
        if "package.json" not in files:
            continue
        raw: Any = json.loads((dirpath / "package.json").read_text(encoding="utf-8"))
        scripts = raw.get("scripts") if isinstance(raw, dict) else None
        if isinstance(scripts, dict):
            names.update(str(key) for key in scripts)
    return names


def catalog_counts() -> tuple[int, int]:
    """(app count, package count) as the repo itself derives them.

    A package is a directory with a package.json under packages/ or libs/. Both
    roots count: shared code that has been relocated out of packages/ is still a
    package, and dropping the root would make a doc claim about the count rot the
    moment a module moves.
    """
    catalog: Any = json.loads((ROOT / "apps.json").read_text(encoding="utf-8"))
    apps = catalog["apps"] if isinstance(catalog, dict) else []
    count = 0
    for root in ("packages", "libs"):
        directory = ROOT / root
        if directory.is_dir():
            count += len([p for p in directory.iterdir() if p.is_dir()])
    return (len(apps) if isinstance(apps, list) else 0), count


# A doc often writes a shell command rather than a bare path, as in
# `source scripts/complete-deploy.bash`. Without stripping the launcher the
# token holds whitespace and is dropped, so deleting that file would go
# unnoticed. Only exact launchers are stripped, to avoid inventing matches.
COMMAND_PREFIX = (
    "source ",
    "bash ",
    "sh ",
    "./",
    "python ",
    "python3 ",
    "npm ",
    "node ",
)


def strip_command(raw: str) -> str:
    """Drop a leading shell launcher, so `source x/y.sh` yields `x/y.sh`."""
    for prefix in COMMAND_PREFIX:
        if raw.startswith(prefix):
            return raw[len(prefix) :]
    return raw


def path_claims(doc: Path) -> set[str]:
    """Backticked tokens in one doc that assert a repo path exists."""
    text = read(doc)
    claims: set[str] = set()
    for raw in BACKTICKED.findall(text):
        token = strip_command(raw)
        if "/" not in token or not IS_FILE_PATH.search(token):
            continue
        if NOT_A_PATH.search(token) or token.startswith("/") or ":" in token:
            continue
        claims.add(token.removeprefix("./"))
    return claims


def glob_claims(doc: Path) -> set[str]:
    """Backticked globs in one doc, reduced to the directory they must sit in.

    NOT_A_PATH excludes ``*``, so a glob is never a path claim and the dangling
    check cannot see it. That is how ``packages/*`` survived in three docs long
    after the directory was deleted: the token was skipped as a glob, and it
    carries no file extension, so nothing else claimed it either.

    What a glob does assert is that the directory before the first ``*`` exists.
    ``apps/*/src/web-components/`` claims something about ``apps``, and that is
    checkable even though the rest is a pattern. Only the static prefix is
    required to exist, so a doc may keep using a glob for the dynamic tail.
    """
    claims: set[str] = set()
    for raw in BACKTICKED.findall(read(doc)):
        token = strip_command(raw)
        if "*" not in token or token.startswith("/") or ":" in token:
            continue
        if NOT_A_PATH.sub(" ", token) != token.replace("*", " "):
            continue  # another metacharacter, so this is not a plain glob
        head = token.split("*", 1)[0]
        # A directory glob has a path component before the first wildcard.
        # `.env.*` has none, and is a filename pattern meaning "any dotenv
        # variant", not a claim that a directory exists.
        if "/" not in head or re.search(r"\s", head):
            continue
        # Cut at the last separator, so a glob that widens a FILENAME, as in
        # `scripts/complete-*.bash`, yields `scripts` rather than the
        # not-a-directory `scripts/complete-`.
        prefix = head.rsplit("/", 1)[0]
        if prefix:
            claims.add(prefix)
    return claims


def resolves(doc: Path, token: str, entries: set[str]) -> bool:
    """True when the token names a real file or directory.

    Docs use two readings, so both are accepted. A relative token is resolved
    against the directory holding the doc, which is what `../AGENTS.md` means
    to the file that writes it. A bare token is matched as a path suffix, so a
    root doc may point at an app-relative path such as `scripts/smoke.ts`
    without owning it. The claim under test is that the path exists, not which
    app owns it.
    """
    tail = f"/{token}"
    if any(e == token or e.endswith(tail) for e in entries):
        return True
    target = (doc.parent / token).resolve()
    try:
        return target.relative_to(ROOT).as_posix() in entries
    except ValueError:
        return False


def ignored_paths(candidates: set[str]) -> set[str]:
    """Which of these paths git's ignore rules exclude from the source tree.

    check-ignore answers from the ignore rules rather than from what is on
    disk, so a generated path is recognised as generated on a machine where
    the build never ran. That is the property that matters: a fresh clone has
    no dist and no rendered gateway config, and the guard must not depend on
    either being present.

    The paths go on the command line, never on stdin. A line-based stdin
    protocol is what brought two silent bugs here. Windows appended a CR to
    every path, which a directory rule like `dist/` tolerates but an exact
    file rule like `deploy/nginx/default.conf` does not, so the rendered
    config quietly stopped counting as generated. And subprocess writes stdin
    from a separate thread, so handing it text-mode bytes raised TypeError in
    that thread where nothing can observe it; the parent then blocked in
    communicate() while git waited for input that would never be closed. A
    timeout does not rescue that, because after killing the child it rejoins
    the same broken threads. Arguments have neither failure mode.
    """
    paths = sorted(candidates)
    out: set[str] = set()
    for start in range(0, len(paths), ARG_CHUNK):
        chunk = paths[start : start + ARG_CHUNK]
        try:
            done = subprocess.run(
                ["git", "check-ignore", *chunk],
                cwd=ROOT,
                capture_output=True,
                check=False,
                timeout=GIT_TIMEOUT,
            )
        except subprocess.TimeoutExpired as exc:
            raise RuntimeError(
                f"git check-ignore did not finish in {GIT_TIMEOUT}s, so the "
                "guard cannot tell generated output from source"
            ) from exc
        # Exit 1 means none of these paths is ignored, which is a normal empty
        # answer rather than a failure.
        if done.returncode not in (0, 1):
            raise RuntimeError(
                "git check-ignore failed, so the guard cannot tell generated "
                f"output from source: {done.stderr.decode(errors='replace').strip()}"
            )
        out.update(
            line.strip()
            for line in done.stdout.decode(errors="replace").splitlines()
            if line.strip()
        )
    return out


def candidate_paths(doc: Path, token: str) -> set[str]:
    """The repo-relative paths a doc's token could mean, under both readings.

    A token in a subdirectory doc may be relative to that doc, as in
    `nginx/default.conf` in deploy/README.md, or already repo-relative, as the
    same file writes it as `deploy/nginx/default.conf`. Both are offered to
    git, because only git can say whether either is generated.
    """
    out: set[str] = set()
    for base in (doc.parent, ROOT):
        try:
            out.add((base / token).resolve().relative_to(ROOT).as_posix())
        except ValueError:
            continue
    return out


def missing_claims(
    docs: list[Path],
    pattern: re.Pattern[str],
    claimed: Callable[[str], bool],
    template: str,
) -> list[str]:
    """One report line per name a doc claims that `claimed` rejects.

    Shared by the npm and Gradle checks, which differ only in the pattern they
    match, the test they apply, and the sentence they report with.
    """
    return [
        template.format(rel=doc.relative_to(ROOT).as_posix(), name=name)
        for doc in docs
        for name in sorted(set(pattern.findall(read(doc))))
        if not claimed(name)
    ]


def script_claimed(name: str, scripts: set[str]) -> bool:
    """True when the name is a real script, or a documented prefix template.

    Docs write families such as `npm run dev:<app>`, which captures as `dev:`
    and can only match by prefix. Only a name ending in `:` gets that
    leniency: an unqualified name like `format` is a concrete claim, and
    letting `format:check` vouch for it would hide a renamed script.
    """
    if name in scripts:
        return True
    return name.endswith(":") and any(s.startswith(name) for s in scripts)
