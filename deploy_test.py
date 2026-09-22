"""Unit tests for deploy.py's argument mapping.

Run: python3 -m unittest discover -s . -t . -p "*_test.py".
Only stdlib is used (unittest).
"""

from __future__ import annotations

import unittest
from unittest.mock import patch

from deploy import gradle_argv, gradle_command, main


class GradleArgvTest(unittest.TestCase):
    def test_no_args_deploys_everything(self) -> None:
        self.assertEqual(gradle_argv([]), ["deploy"])

    def test_flags_become_bare_tokens(self) -> None:
        self.assertEqual(
            gradle_argv(["--local", "rss"]),
            ["deploy", "-Pargs=local rss", "-Papps=rss"],
        )
        self.assertEqual(
            gradle_argv(["--remote", "--no-build"]),
            ["deploy", "-Pargs=remote no-build"],
        )

    def test_app_names_pass_through(self) -> None:
        self.assertEqual(
            gradle_argv(["rss"]),
            ["deploy", "-Pargs=rss", "-Papps=rss"],
        )
        self.assertEqual(
            gradle_argv(["apps/rss", "stock"]),
            ["deploy", "-Pargs=apps/rss stock", "-Papps=apps/rss,stock"],
        )

    def test_app_after_a_flag_is_kept(self) -> None:
        self.assertEqual(
            gradle_argv(["--remote", "rss"]),
            ["deploy", "-Pargs=remote rss", "-Papps=rss"],
        )

    def test_unknown_dash_args_go_to_compose(self) -> None:
        self.assertEqual(
            gradle_argv(["-q", "rss"]),
            ["deploy", "-Pargs=rss", "-Ppassthrough=-q", "-Papps=rss"],
        )

    def test_separator_routes_the_rest_to_compose(self) -> None:
        self.assertEqual(
            gradle_argv(["rss", "--status", "--", "--force-recreate", "-q"]),
            [
                "deploy",
                "-Pargs=rss status",
                "-Ppassthrough=--force-recreate -q",
                "-Papps=rss",
            ],
        )

    def test_dry_run_is_not_mapped(self) -> None:
        self.assertEqual(
            gradle_argv(["--dry-run", "rss"]),
            ["deploy", "-Pargs=rss", "-Papps=rss"],
        )


class GradleCommandTest(unittest.TestCase):
    def test_prefers_the_wrapper(self) -> None:
        with patch("os.path.exists", return_value=True):
            self.assertEqual(gradle_command(), ["gradlew.bat"])

    def test_falls_back_to_gradle_without_a_wrapper(self) -> None:
        with patch("os.path.exists", return_value=False):
            self.assertEqual(gradle_command(), ["gradle"])


class MainTest(unittest.TestCase):
    def test_help_prints_and_exits_zero(self) -> None:
        self.assertEqual(main(["--help"]), 0)
        self.assertEqual(main(["-h"]), 0)


if __name__ == "__main__":
    unittest.main()
