"""Unit tests for build.py pure helpers.

Run: python3 -m unittest discover -s scripts -t . -p "*_test.py".
Only stdlib is used (unittest, unittest.mock).
"""

from __future__ import annotations

import os
import unittest
from unittest.mock import patch

from scripts.build import (
    BuildError,
    build_workspace,
    js_bare_build_args,
    js_build_args,
    parse_args,
    select_js_runtime,
    spawn_npm,
)


class ParseArgsTest(unittest.TestCase):
    def test_help_flags(self) -> None:
        self.assertTrue(parse_args(["-h"])["help"])
        self.assertTrue(parse_args(["--help"])["help"])
        self.assertFalse(parse_args(["rss"])["help"])

    def test_names_passthrough(self) -> None:
        parsed = parse_args(["rss", "lemmy"])
        self.assertEqual(parsed["names"], ["rss", "lemmy"])
        self.assertIsNone(parsed["js_runtime"])

    def test_js_runtime_equals_form(self) -> None:
        parsed = parse_args(["--js-runtime=bun", "rss"])
        self.assertEqual(parsed["js_runtime"], "bun")
        self.assertEqual(parsed["names"], ["rss"])

    def test_js_runtime_space_form(self) -> None:
        parsed = parse_args(["--js-runtime", "bun", "rss"])
        self.assertEqual(parsed["js_runtime"], "bun")
        self.assertEqual(parsed["names"], ["rss"])

    def test_js_runtime_missing_value_errors(self) -> None:
        with self.assertRaisesRegex(RuntimeError, "--js-runtime"):
            parse_args(["--js-runtime"])
        with self.assertRaisesRegex(RuntimeError, "--js-runtime"):
            parse_args(["--js-runtime="])
        with self.assertRaisesRegex(RuntimeError, "--js-runtime"):
            parse_args(["--js-runtime= "])


class SelectJsRuntimeTest(unittest.TestCase):
    def setUp(self) -> None:
        self.prev = os.environ.get("JS_RUNTIME")

    def tearDown(self) -> None:
        if self.prev is None:
            os.environ.pop("JS_RUNTIME", None)
        else:
            os.environ["JS_RUNTIME"] = self.prev

    def test_default_is_npm(self) -> None:
        os.environ.pop("JS_RUNTIME", None)
        self.assertEqual(select_js_runtime(None), "npm")

    def test_flag_wins_over_env(self) -> None:
        os.environ["JS_RUNTIME"] = "npm"
        self.assertEqual(select_js_runtime("bun"), "bun")

    def test_env_fallback(self) -> None:
        os.environ["JS_RUNTIME"] = "bun"
        self.assertEqual(select_js_runtime(None), "bun")

    def test_invalid_errors(self) -> None:
        with self.assertRaisesRegex(RuntimeError, "npm or bun"):
            select_js_runtime("pnpm")


class JsArgsTest(unittest.TestCase):
    def test_npm_workspace_args(self) -> None:
        self.assertEqual(
            js_build_args("npm", "rss-reader"), ["run", "build", "-w", "rss-reader"]
        )

    def test_bun_workspace_args(self) -> None:
        self.assertEqual(
            js_build_args("bun", "rss-reader"),
            ["run", "--filter", "rss-reader", "build"],
        )

    def test_bare_args(self) -> None:
        self.assertEqual(js_bare_build_args("npm"), ["run", "build"])
        self.assertEqual(js_bare_build_args("bun"), ["run", "--filter", "*", "build"])


class BuildWorkspaceTest(unittest.TestCase):
    def test_npm_success_calls_spawn(self) -> None:
        with patch("scripts.build.spawn_js", return_value=0) as spawn:
            build_workspace("rss-reader", "npm")
            spawn.assert_called_once_with("npm", ["run", "build", "-w", "rss-reader"])

    def test_bun_success_calls_spawn(self) -> None:
        with patch("scripts.build.spawn_js", return_value=0) as spawn:
            build_workspace("rss-reader", "bun")
            spawn.assert_called_once_with(
                "bun", ["run", "--filter", "rss-reader", "build"]
            )

    def test_failure_raises_with_code(self) -> None:
        with patch("scripts.build.spawn_js", return_value=3):
            with self.assertRaises(BuildError) as ctx:
                build_workspace("rss-reader", "npm")
            self.assertEqual(ctx.exception.code, 3)

    def test_spawn_npm_delegates(self) -> None:
        with patch("scripts.build.spawn_js", return_value=0) as spawn:
            self.assertEqual(spawn_npm(["--version"]), 0)
            spawn.assert_called_once_with("npm", ["--version"])


class EnsureInstalledTest(unittest.TestCase):
    def test_skips_install_when_node_modules_present(self) -> None:
        with (
            patch("os.path.exists", return_value=True),
            patch("scripts.build.spawn_js") as spawn,
        ):
            from scripts.build import ensure_installed

            self.assertEqual(ensure_installed("npm"), 0)
            spawn.assert_not_called()

    def test_installs_when_node_modules_missing(self) -> None:
        with (
            patch("os.path.exists", return_value=False),
            patch("scripts.build.spawn_js", return_value=0) as spawn,
        ):
            from scripts.build import ensure_installed

            self.assertEqual(ensure_installed("bun"), 0)
            spawn.assert_called_once_with("bun", ["install"])


class RunBareBuildTest(unittest.TestCase):
    def test_delegates_to_runtime_all(self) -> None:
        with patch("scripts.build.spawn_js", return_value=0) as spawn:
            from scripts.build import run_bare_build

            self.assertEqual(run_bare_build("npm"), 0)
            spawn.assert_called_once_with("npm", ["run", "build"])


if __name__ == "__main__":
    unittest.main()
