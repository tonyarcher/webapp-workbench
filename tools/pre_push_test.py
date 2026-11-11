"""Unit tests for the pre-push gate's pure mapping (no subprocesses run)."""

from __future__ import annotations

import io
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

from tools.pre_push import ref_range, workspace_of

ROOT = Path(__file__).resolve().parent.parent


class WorkspaceOfTest(unittest.TestCase):
    def test_rss_app_file_maps_to_workspace_name(self) -> None:
        found = workspace_of("apps/rss/app/src/web-components/app-shell/app-shell.ts")
        assert found is not None
        name, directory = found
        self.assertEqual(name, "rss-reader")
        self.assertEqual(directory, ROOT / "apps" / "rss" / "app")

    def test_tool_file_maps_to_no_workspace(self) -> None:
        self.assertIsNone(workspace_of("tools/pre_push.py"))

    def test_root_manifest_maps_to_no_workspace(self) -> None:
        self.assertIsNone(workspace_of("package.json"))


class RefRangeTest(unittest.TestCase):
    def test_branch_push_yields_remote_to_local(self) -> None:
        line = "refs/heads/main abc123 refs/heads/main def456\n"
        with patch.object(sys, "stdin", io.StringIO(line)):
            self.assertEqual(ref_range(), [("abc123", "def456")])

    def test_tty_stdin_yields_no_range(self) -> None:
        class Tty(io.StringIO):
            def isatty(self) -> bool:
                return True

        with patch.object(sys, "stdin", Tty("")):
            self.assertEqual(ref_range(), [])

    def test_garbage_lines_are_ignored(self) -> None:
        with patch.object(sys, "stdin", io.StringIO("not a ref\n")):
            self.assertEqual(ref_range(), [])


if __name__ == "__main__":
    unittest.main()
