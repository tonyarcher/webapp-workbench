"""Doc-rot guard: keep AGENTS.md and README.md from naming things that are gone.

Run: python3 -m unittest discover -s tools -t . -p "*_test.py".

Each check turns one shape of a stale claim into a failure, comparing against the
thing that derives it rather than a second copy, so a check cannot itself go
stale. The extraction and lookup are in doc_claims.py.

Coverage is partial on purpose. Only backticked tokens that contain "/" and end
in a known extension count as path claims; a glob is caught by its fixed prefix
instead, since NOT_A_PATH excludes "*". The floors in test_scans_still_match
exist because a guard that matches nothing passes vacuously, which looks
identical to a clean result.
"""

from __future__ import annotations

import re
import subprocess
import tempfile
import unittest
from pathlib import Path
from typing import ClassVar
from unittest import mock

from tools.doc_claims import (
    COUNT_BARE,
    GRADLE_TASK,
    MIN_PATHS,
    MIN_SCRIPTS,
    MIN_TASKS,
    NEGATED,
    NPM_RUN,
    ROOT,
    candidate_paths,
    catalog_counts,
    doc_files,
    glob_claims,
    ignored_paths,
    ignored_prefix_candidates,
    missing_claims,
    npm_scripts,
    path_claims,
    read,
    repo_entries,
    resolves,
    script_claimed,
)


class DocRotTest(unittest.TestCase):
    """Docs must not name files, scripts, tasks, or counts that no longer exist."""

    docs: ClassVar[list[Path]] = []
    entries: ClassVar[set[str]] = set()
    scripts: ClassVar[set[str]] = set()
    generated: ClassVar[set[str]] = set()
    ignored_globs: ClassVar[set[str]] = set()
    gradle: ClassVar[str] = ""
    apps: ClassVar[int] = 0

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
        # repo_entries prunes dist, build and node_modules, so a doc globbing
        # generated output would fail the glob check while the equivalent path
        # claim is exempted above. Both checks ask git, so they agree. The
        # trailing slash matters: a `dist/` ignore rule only matches a directory,
        # and git infers that from disk, so the bare name matched on a machine
        # that had built and missed on a fresh clone.
        cls.ignored_globs = ignored_paths(
            {
                candidate
                for doc in cls.docs
                for prefix in glob_claims(doc)
                for candidate in ignored_prefix_candidates(doc, prefix)
            }
        )
        cls.gradle = "\n".join(
            read(ROOT / name)
            for name in ("build.gradle.kts", "settings.gradle.kts")
            if (ROOT / name).is_file()
        )
        cls.apps = catalog_counts()

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

    def test_documented_glob_prefixes_exist(self) -> None:
        """A backticked glob's fixed prefix names a directory that exists.

        `packages/*` is not a path claim (NOT_A_PATH excludes `*`) and carries no
        file extension, so the dangling-path check cannot see it. Checking the
        static prefix is what makes a deleted directory fail a doc test.
        """
        problems: list[str] = []
        for doc in self.docs:
            rel = doc.relative_to(ROOT).as_posix()
            for prefix in sorted(glob_claims(doc)):
                if (rel, prefix) in NEGATED:
                    continue
                # A glob over generated output names something a fresh clone
                # lacks on purpose, exactly as a path claim does.
                if ignored_prefix_candidates(doc, prefix) & self.ignored_globs:
                    continue
                if not resolves(doc, prefix, self.entries):
                    problems.append(f"{rel} globs {prefix}/*, which does not exist")
        self.assertEqual([], problems, "docs glob a directory that no longer exists")

    def test_glob_prefix_extraction(self) -> None:
        """Pin the prefix rule, since the check above is otherwise vacuous.

        Without this, a bug that made glob_claims return nothing would leave the
        directory check passing on every doc.
        """
        with tempfile.TemporaryDirectory() as tmp:
            doc = Path(tmp) / "AGENTS.md"
            doc.write_text(
                "Real: `apps/*` and `apps/*/src/web-components/` and `tools/*`.\n"
                "Widened filename: `scripts/complete-*.bash`.\n"
                "Not a claim: `<app>/*`, `a|b/*`, `${x}/*`, `.env.*`.\n"
                "Deleted: `packages/*` and `libs/*`.\n",
                encoding="utf-8",
            )
            # The prefix is the DIRECTORY holding the first wildcard, so the
            # middle segment of apps/*/src/web-components/ is not part of it,
            # and a widened filename reports the directory holding it.
            self.assertEqual(
                {"apps", "tools", "scripts", "packages", "libs"}, glob_claims(doc)
            )

    def test_glob_over_generated_output_is_not_a_finding(self) -> None:
        """A doc may glob `dist/*`, which a fresh clone does not have.

        repo_entries prunes the generated trees, so without asking git the glob
        check would fail a claim the path check already accepts. The live set is
        empty today because no doc globs generated output, so the exemption is
        proved against git directly rather than against the derived set.
        """
        self.assertNotIn("dist", self.entries, "dist is pruned from the walk")
        self.assertFalse(resolves(ROOT / "AGENTS.md", "dist", self.entries))
        self.assertIn("dist/", ignored_paths({"dist/"}), "git does not report dist/")

        # The bare name is what this got wrong, and the difference is the
        # filesystem: a `playwright-report/` rule matches only a directory, and
        # that directory has never been created here, so the bare name gets no
        # match while the slashed form does. CI has no dist/ either, which is
        # how the unslashed version passed locally and failed on the runner.
        self.assertFalse(
            (ROOT / "playwright-report").exists(),
            "this case needs a generated directory that does not exist",
        )
        self.assertNotIn(
            "playwright-report",
            ignored_paths({"playwright-report"}),
            "the bare name should not match without the directory",
        )
        self.assertIn(
            "playwright-report/",
            ignored_paths({"playwright-report/"}),
            "the slashed form must match whether or not the directory exists",
        )
        with tempfile.TemporaryDirectory() as tmp:
            doc = Path(tmp) / "AGENTS.md"
            doc.write_text("Build output lands in `dist/*`.\n", encoding="utf-8")
            self.assertEqual({"dist"}, glob_claims(doc))
            self.assertEqual({"dist/"}, ignored_prefix_candidates(doc, "dist"))

    def test_a_deleted_directory_fails_the_glob_check(self) -> None:
        """The regression this check exists for, proved on a planted claim."""
        with tempfile.TemporaryDirectory() as tmp:
            doc = Path(tmp) / "AGENTS.md"
            doc.write_text("Shared libraries live in `packages/*`.\n", encoding="utf-8")
            self.assertEqual({"packages"}, glob_claims(doc))
            self.assertFalse(resolves(doc, "packages", {"apps/", "apps/basketball/"}))

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
        """A doc may not state an app count the repo contradicts.

        Only a bare count is checked, and only for the one noun the guard can
        derive. "2 of 16 apps use plain Vite" is accurate and stays allowed.
        The other nouns in COUNT_NOUNS are recognised but not policed, because
        nothing in the repo derives them.
        """
        problems: list[str] = []
        for doc in self.docs:
            rel = doc.relative_to(ROOT).as_posix()
            for number, noun in COUNT_BARE.findall(read(doc)):
                actual = {"apps": self.apps}.get(noun)
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
