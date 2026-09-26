"""Task-graph tests for the root Gradle build in build.gradle.kts.

Run: python3 -m unittest discover -s . -t . -p "*_test.py".
Only stdlib is used (shutil, subprocess, unittest).

Three things are asserted here. That an API-only selection never reaches npm:
`buildNode` depends on npmInstall only through a real workspace task, so a
selection with no JavaScript workspace does not run a root `npm install` plus
the six packages' `prepare` builds for artifacts no service ships. That a
workspace used by two apps is built once, since two `vite build` runs writing
one `dist/` would corrupt it. And that a package is built before the app that
bundles it.

Unlike the other *_test.py modules these shell out to `gradle --dry-run` and
take tens of seconds, so every test skips when Gradle cannot start. The bare
`buildAll` path resolves the same dependency edge as `buildNode`, so it is not
asserted separately.
"""

from __future__ import annotations

import shutil
import subprocess
import unittest

from build import gradle_command

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
        # vertical-scroll-core is a workspace of both lemmy and clipstack. Two
        # vite builds writing one dist/ would corrupt it, so the task must be
        # registered once, not once per app.
        plan = dry_run("buildNode", "-Papps=lemmy,clipstack")
        self.assertEqual(plan.count(":buildNode-vertical-scroll-core"), 1)

    def test_package_builds_before_the_app_that_imports_it(self) -> None:
        # --dry-run lists tasks in topological order, so this pins the chain
        # that makes a package's dist/ exist before the app bundles it.
        plan = dry_run("buildNode", "-Papps=clipstack")
        self.assertLess(
            plan.index(":buildNode-vertical-scroll-core"),
            plan.index(":buildNode-clipstack"),
        )


if __name__ == "__main__":
    unittest.main()
