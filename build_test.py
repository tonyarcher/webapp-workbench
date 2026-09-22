"""Unit tests for build.py's argument mapping.

Run: python3 -m unittest discover -s . -t . -p "*_test.py".
Only stdlib is used (unittest).
"""

from __future__ import annotations

import unittest
from unittest.mock import patch

from build import gradle_argv, gradle_command, main


class GradleArgvTest(unittest.TestCase):
    def test_no_apps_builds_everything(self) -> None:
        self.assertEqual(gradle_argv([]), ["buildAll"])

    def test_app_names_join_into_the_filter(self) -> None:
        self.assertEqual(gradle_argv(["rss"]), ["buildAll", "-Papps=rss"])
        self.assertEqual(
            gradle_argv(["apps/rss", "lemmy"]),
            ["buildAll", "-Papps=apps/rss,lemmy"],
        )

    def test_flags_are_ignored_by_the_mapping(self) -> None:
        self.assertEqual(gradle_argv(["--dry-run", "rss"]), ["buildAll", "-Papps=rss"])


class GradleCommandTest(unittest.TestCase):
    def test_prefers_the_wrapper(self) -> None:
        with patch("os.path.exists", return_value=True):
            self.assertEqual(gradle_command(), ["gradlew.bat"])

    def test_falls_back_to_gradle_without_a_wrapper(self) -> None:
        with patch("os.path.exists", return_value=False):
            self.assertEqual(gradle_command(), ["gradle"])

    def test_uses_gradlew_on_posix(self) -> None:
        with (
            patch("sys.platform", "linux"),
            patch("os.path.exists", return_value=True),
        ):
            self.assertEqual(gradle_command(), ["./gradlew"])


class MainTest(unittest.TestCase):
    def test_help_prints_and_exits_zero(self) -> None:
        self.assertEqual(main(["--help"]), 0)
        self.assertEqual(main(["-h"]), 0)

    def test_unknown_option_fails(self) -> None:
        self.assertEqual(main(["--nope"]), 1)


if __name__ == "__main__":
    unittest.main()
