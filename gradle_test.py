"""Task-graph tests for the root Gradle build in build.gradle.kts.

Run: python3 -m unittest discover -s . -t . -p "*_test.py".
Only stdlib is used (json, pathlib, shutil, subprocess, unittest).

Four things are asserted here. That every workspace apps.json declares is one
Gradle can actually find, since `workspaceDirs` scans a fixed set of roots and a
workspace moved outside them becomes invisible without any error. That an
API-only selection never reaches npm: `buildNode` depends on npmInstall only
through a real workspace task, so a selection with no JavaScript workspace does
not run a root `npm install` plus the packages' `prepare` builds for artifacts
no service ships. That a workspace used by two apps is built once, since two
`vite build` runs writing one `dist/` would corrupt it. And that a package is
built before the app that bundles it.

Unlike the other *_test.py modules these shell out to `gradle --dry-run` and
take tens of seconds, so every test skips when Gradle cannot start. The bare
`buildAll` path resolves the same dependency edge as `buildNode`, so it is not
asserted separately.
"""

from __future__ import annotations

import json
import pathlib
import shutil
import subprocess
import unittest

from build import gradle_command

ROOT = pathlib.Path(__file__).resolve().parent

# The roots buildSrc's `workspaceDirs` scans. A workspace outside these is
# invisible to Gradle. Kept as data so the test can assert the two agree.
WORKSPACE_ROOTS = ("apps",)

# Workspaces that exist on disk but are deliberately not app workspaces.
#
# `stock-game` is an npm aggregator whose own package.json declares `shared` and
# `app` as its workspaces; it builds nothing itself. `@stock-game/shared` is that
# app's client/server contract, which the root AGENTS.md explicitly calls "not a
# monorepo library". Declaring either as an app workspace would be a lie, so the
# reverse test exempts them rather than forcing one into apps.json.
UNDECLARED_BY_DESIGN = {"stock-game", "@stock-game/shared"}

# Gradle configuration compiles buildSrc on a cold daemon. Be generous.
DRY_RUN_TIMEOUT = 300

GRADLE = gradle_command()


def gradle_available() -> bool:
    """True when the command build.py would run can actually start."""
    if GRADLE[0].endswith(("gradlew", "gradlew.bat")):
        return True  # gradle_command only returns the wrapper when it exists
    return shutil.which(GRADLE[0]) is not None


def dry_run(*args: str) -> str:
    """Return the `gradle <args> --dry-run` task list. Raise on a failed build."""
    command = [*GRADLE, *args, "--dry-run", "--console=plain", "-q"]
    done = subprocess.run(
        command, capture_output=True, text=True, timeout=DRY_RUN_TIMEOUT, check=False
    )
    if done.returncode != 0:
        report = f"{done.stdout}\n{done.stderr}"
        raise AssertionError(f"{' '.join(command)} exited {done.returncode}\n{report}")
    return done.stdout


def declared_workspaces() -> dict[str, list[str]]:
    """Workspace name -> the apps that declare it, from apps.json.

    apps.json holds `"apps": [ {id, workspaces, ...}, ... ]`, so this walks the
    list rather than the top-level keys.
    """
    catalog = json.loads((ROOT / "apps.json").read_text(encoding="utf-8"))
    declared: dict[str, list[str]] = {}
    for app in catalog["apps"]:
        for workspace in app.get("workspaces", []):
            declared.setdefault(workspace, []).append(app["id"])
    return declared


def discoverable_workspaces() -> dict[str, str]:
    """Workspace name -> repo-relative directory, using the roots Gradle scans.

    Deliberately mirrors buildSrc's `workspaceDirs` by re-walking the tree rather
    than asking Gradle: this runs without a daemon, so a guard that needs Gradle
    to start cannot guard the thing that decides which paths Gradle looks at.
    """
    found: dict[str, str] = {}
    for root in WORKSPACE_ROOTS:
        base = ROOT / root
        if not base.is_dir():
            continue
        for manifest in base.rglob("package.json"):
            if "node_modules" in manifest.parts:
                continue
            name = json.loads(manifest.read_text(encoding="utf-8")).get("name")
            if isinstance(name, str):
                found[name] = manifest.parent.relative_to(ROOT).as_posix()
    return found


class WorkspaceDiscoveryTest(unittest.TestCase):
    """apps.json and the roots Gradle scans must agree, in both directions."""

    def test_every_declared_workspace_is_discoverable(self) -> None:
        # A workspace outside the scanned roots vanishes from workspaceDirs with
        # no error: resolveAppName only fails when an APP matches nothing, so
        # -Papps=<app> still succeeds and quietly builds an incomplete task graph.
        declared = declared_workspaces()
        found = discoverable_workspaces()
        self.assertTrue(
            declared, "apps.json declares no workspaces, so this is vacuous"
        )
        missing = sorted(name for name in declared if name not in found)
        self.assertEqual(
            [],
            missing,
            "apps.json declares these workspaces but no package.json for them exists "
            f"under {WORKSPACE_ROOTS}: {missing}",
        )

    def test_every_discovered_workspace_is_declared(self) -> None:
        # The reverse: a package.json nobody declares is built by nothing. This
        # is what caught user-client missing from apps.json, which is how the
        # shared identity client could be a dependency of two apps while no app
        # listed it.
        declared = declared_workspaces()
        undeclared = sorted(
            name
            for name in discoverable_workspaces()
            if name not in declared and name not in UNDECLARED_BY_DESIGN
        )
        self.assertEqual(
            [],
            undeclared,
            f"these workspaces exist but no app declares them: {undeclared}. Add "
            f"them to apps.json, or to UNDECLARED_BY_DESIGN if they are deliberately "
            f"not app workspaces. Known-by-design: {sorted(UNDECLARED_BY_DESIGN)}",
        )

    def test_the_by_design_exemptions_still_exist(self) -> None:
        # Otherwise a renamed or deleted package leaves an exemption that guards
        # nothing, and the reverse test silently stops covering that name.
        found = discoverable_workspaces()
        gone = sorted(name for name in UNDECLARED_BY_DESIGN if name not in found)
        self.assertEqual([], gone, f"exempted but no longer on disk: {gone}")

    def test_the_scanned_roots_match_buildsrc(self) -> None:
        # The list above and WORKSPACE_ROOTS in AppMappings.kt are two copies of
        # one fact. If they drift, this test guards the wrong set.
        mappings = (
            ROOT / "buildSrc" / "src" / "main" / "kotlin" / "AppMappings.kt"
        ).read_text(encoding="utf-8")
        for root in WORKSPACE_ROOTS:
            self.assertIn(
                f'"{root}/**"', mappings, f"{root} is not scanned by buildSrc"
            )


@unittest.skipUnless(gradle_available(), "gradle is not available")
class BuildNodeTaskGraphTest(unittest.TestCase):
    def test_api_only_selection_skips_npm_install(self) -> None:
        # The positive assertion first: it fails if the task-list format ever
        # changes, which would make the negative assertion below vacuous.
        plan = dry_run("buildAll", "-Papps=rss-api")
        self.assertIn(":rss-api:bootJar", plan)
        self.assertNotIn(":npmInstall", plan)

    def test_javascript_selection_still_installs(self) -> None:
        # The other direction, so the fix cannot be over-applied into a skip.
        self.assertIn(":npmInstall", dry_run("buildNode"))

    def test_workspace_shared_by_two_apps_builds_once(self) -> None:
        # vertical-scroll-component is a workspace of both lemmy and clipstack. Two
        # vite builds writing one dist/ would corrupt it, so the task must be
        # registered once, not once per app.
        plan = dry_run("buildNode", "-Papps=lemmy,clipstack")
        self.assertEqual(plan.count(":buildNode-vertical-scroll-component"), 1)

    def test_package_builds_before_the_app_that_imports_it(self) -> None:
        # --dry-run lists tasks in topological order, so this pins the chain
        # that makes a package's dist/ exist before the app bundles it.
        plan = dry_run("buildNode", "-Papps=clipstack")
        self.assertLess(
            plan.index(":buildNode-vertical-scroll-component"),
            plan.index(":buildNode-clipstack"),
        )


if __name__ == "__main__":
    unittest.main()
