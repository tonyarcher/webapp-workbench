"""Doc-rot guard: keep AGENTS.md and README.md from naming things that are gone.

Run: python3 -m unittest discover -s . -t . -p "*_test.py".
Only stdlib is used (collections.abc, json, os, pathlib, re, subprocess, typing,
unittest).

The rot this catches is specific: a sentence that reads as current, costs a
reader a search, and fails nothing. The worst instance found in this repo was
a README listing 7 of 11 apps when the catalog held 16, which no build, test,
or lint would ever have flagged, because every fact in it was individually true
at some point.

Each check below turns one shape of that claim into a failure. Paths, npm
scripts, Gradle tasks, and counts are all compared against the thing that
derives them, never against a second copy, so a check cannot itself go stale
the way the docs did.

Coverage is partial on purpose, and the gaps are deliberate. Only backticked
tokens that contain "/" and end in a known extension count as path claims, so a
bare filename resolving inside one package tree, a directory, and an
extensionless file such as .gitignore are all left alone. The floors in
test_scans_still_match exist because a guard that matches nothing passes
vacuously, which looks identical to a clean result; the count check is pinned on
a synthetic sentence instead, since no doc should state a count at all.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import unittest
from collections.abc import Callable
from pathlib import Path
from typing import Any, ClassVar
from unittest import mock

ROOT = Path(__file__).resolve().parent

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
    """(app count, package count) as the repo itself derives them."""
    catalog: Any = json.loads((ROOT / "apps.json").read_text(encoding="utf-8"))
    apps = catalog["apps"] if isinstance(catalog, dict) else []
    packages = ROOT / "packages"
    count = (
        len([p for p in packages.iterdir() if p.is_dir()]) if packages.is_dir() else 0
    )
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


class DocRotTest(unittest.TestCase):
    """Docs must not name files, scripts, tasks, or counts that no longer exist."""

    docs: ClassVar[list[Path]] = []
    entries: ClassVar[set[str]] = set()
    scripts: ClassVar[set[str]] = set()
    generated: ClassVar[set[str]] = set()
    gradle: ClassVar[str] = ""
    apps: ClassVar[int] = 0
    packages: ClassVar[int] = 0

    @classmethod
    def setUpClass(cls) -> None:
        cls.docs = doc_files()
        cls.entries = repo_entries()
        cls.scripts = npm_scripts()
        cls.generated = ignored_paths(
            {
                candidate
                for doc in cls.docs
                for token in path_claims(doc)
                for candidate in candidate_paths(doc, token)
            }
        )
        cls.gradle = "\n".join(
            read(ROOT / name)
            for name in ("build.gradle.kts", "settings.gradle.kts")
            if (ROOT / name).is_file()
        )
        cls.apps, cls.packages = catalog_counts()

    def dangling_paths(self) -> list[str]:
        """Doc path claims that name nothing a fresh clone would have."""
        out: list[str] = []
        for doc in self.docs:
            rel = doc.relative_to(ROOT).as_posix()
            for token in sorted(path_claims(doc)):
                if (rel, token) in NEGATED:
                    continue
                # A generated path is described, not claimed to be in the tree.
                if candidate_paths(doc, token) & self.generated:
                    continue
                if not resolves(doc, token, self.entries):
                    out.append(f"{rel} names {token!r}, which does not exist")
        return out

    def test_documented_paths_exist(self) -> None:
        """Every backticked repo path in a doc resolves to a real file or dir."""
        self.assertEqual(
            [], self.dangling_paths(), "docs name paths that no longer exist"
        )

    def test_documented_npm_scripts_exist(self) -> None:
        """Every `npm run X` in a doc names a real script or a prefix template."""
        missing = missing_claims(
            self.docs,
            NPM_RUN,
            lambda name: script_claimed(name, self.scripts),
            "{rel} runs npm script {name!r}, which no package.json declares",
        )
        self.assertEqual([], missing, "docs run npm scripts that do not exist")

    def test_documented_gradle_tasks_exist(self) -> None:
        """Every `gradlew TASK` in a doc names a task the build declares."""
        missing = missing_claims(
            self.docs,
            GRADLE_TASK,
            lambda name: bool(re.search(rf"\b{re.escape(name)}\b", self.gradle)),
            "{rel} runs gradle task {name!r}, which the build does not declare",
        )
        self.assertEqual([], missing, "docs run gradle tasks that do not exist")

    def test_documented_counts_agree_with_the_repo(self) -> None:
        """A doc may not state an app or package count the repo contradicts.

        Only a bare count is checked, and only for the two nouns the guard can
        derive. "2 of 16 apps use plain Vite" is accurate and stays allowed.
        """
        problems: list[str] = []
        for doc in self.docs:
            rel = doc.relative_to(ROOT).as_posix()
            for number, noun in COUNT_BARE.findall(read(doc)):
                actual = {"apps": self.apps, "packages": self.packages}.get(noun)
                if actual is not None and int(number) != actual:
                    problems.append(
                        f"{rel} says {number} {noun}, but the repo has {actual}"
                    )
        self.assertEqual([], problems, "docs state a count the repo contradicts")

    def test_count_pattern_matches_a_known_claim(self) -> None:
        """No doc states a count today, so pin the pattern on synthetic ones.

        Without this the count check would pass vacuously and no floor could
        catch that, because requiring a nonzero yield would fail correct docs.
        The second case is the one a stricter rule used to reject: a partial
        count whose total is right is accurate prose, not rot.
        """
        self.assertEqual([("11", "apps")], COUNT_BARE.findall("lists 7 of 11 apps"))
        self.assertEqual(
            [("16", "apps")], COUNT_BARE.findall("2 of 16 apps use plain Vite")
        )
        self.assertEqual([("7", "packages")], COUNT_BARE.findall("all 7 packages"))

    def test_generated_paths_are_recognised_absent_from_disk(self) -> None:
        """Pin how generated output is detected, since getting it wrong is silent.

        Two bugs lived here and neither showed up as a failure, only as a
        false one. Asking git for the files it ignores returned nothing once
        the file was deleted, because that listing only covers what is present,
        so a clean clone failed. And passing the paths as text gave Windows a
        trailing CR, which a directory rule tolerates but an exact file rule
        does not, so the rendered gateway config stopped matching. Deriving the
        answer from a hardcoded list would pass this test and still be wrong
        the next time the repo generates a file somewhere new, which is why
        these paths are checked against git rather than against a fixture.
        """
        candidates = {
            "deploy/nginx/default.conf",
            "dist/sw.js",
            "apps.json",
            "scripts/complete-deploy.bash",
        }
        self.assertEqual(
            {"deploy/nginx/default.conf", "dist/sw.js"}, ignored_paths(candidates)
        )

    def test_generated_detection_passes_paths_as_arguments(self) -> None:
        """Assert the shape of the call that happens, not the text that makes it.

        Feeding git over stdin deadlocks rather than fails. subprocess writes
        stdin from a separate thread, so a text-mode mistake raises TypeError
        inside that thread where no caller can see it, and the parent then
        blocks in communicate() while git waits for input that will never be
        closed. A timeout does not help, because after killing the child
        subprocess rejoins those same broken threads. No behavioural test can
        catch that, because the failure is a hang with nothing to assert
        against. So the property worth protecting is that the call hands git
        arguments and no stdin, and it is checked by watching the real call.

        Inspecting the kwargs the call actually receives is deliberate over
        grepping the source, which would break on a reformat and could pass for
        the wrong reason.
        """
        with mock.patch.object(subprocess, "run", wraps=subprocess.run) as spy:
            ignored_paths({"deploy/nginx/default.conf", "apps.json"})

        self.assertTrue(spy.call_args_list, "ignored_paths made no git call")
        for call in spy.call_args_list:
            cmd = call.args[0]
            self.assertNotIn("input", call.kwargs, "git takes arguments, not stdin")
            self.assertNotEqual(
                True, call.kwargs.get("text"), "text mode turns a stdin bug into a hang"
            )
            self.assertNotIn("--stdin", cmd)
            self.assertIn("check-ignore", cmd)
            for path in ("deploy/nginx/default.conf", "apps.json"):
                self.assertIn(path, cmd, "paths belong in argv, one per entry")

    def test_only_colon_templates_get_prefix_leniency(self) -> None:
        """An unqualified script name must match exactly, never by prefix.

        Prefix matching every name would let `format:check` vouch for
        `format`, so deleting the root `format` script would leave every
        `npm run format` claim in the docs passing. That is the silent miss
        this guard exists to prevent, and it is latent rather than active
        today only because no such rename has happened yet.
        """
        scripts = {"format:check", "dev:baseball", "build"}
        self.assertTrue(script_claimed("format:check", scripts))
        self.assertTrue(script_claimed("build", scripts))
        self.assertTrue(script_claimed("dev:", scripts), "a colon names a family")
        self.assertFalse(script_claimed("format", scripts))
        self.assertFalse(script_claimed("dev", scripts))

    def test_exclusions_state_a_reason(self) -> None:
        """An exclusion with no stated reason is the same rot this guard catches."""
        bare = [
            f"{doc} ignores {token}"
            for (doc, token), why in NEGATED.items()
            if not why.strip()
        ]
        self.assertEqual([], bare, "every doc-rot exclusion must say why it is not rot")

    def test_scans_still_match(self) -> None:
        """Guard the patterns themselves: a scan that matches nothing tests nothing."""
        paths = sum(len(path_claims(d)) for d in self.docs)
        scripts = sum(len(NPM_RUN.findall(read(d))) for d in self.docs)
        tasks = sum(len(GRADLE_TASK.findall(read(d))) for d in self.docs)
        self.assertGreaterEqual(
            paths, MIN_PATHS, f"path scan matched only {paths} claims"
        )
        self.assertGreaterEqual(
            scripts, MIN_SCRIPTS, f"npm scan matched only {scripts} claims"
        )
        self.assertGreaterEqual(
            tasks, MIN_TASKS, f"gradle scan matched only {tasks} claims"
        )


if __name__ == "__main__":
    unittest.main()
