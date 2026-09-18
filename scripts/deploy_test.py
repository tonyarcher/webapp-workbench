"""Unit tests for deploy.py pure helpers.

Run: python3 -m unittest discover -s scripts -t . -p "*_test.py".
Only stdlib is used (unittest, os).
"""

from __future__ import annotations

import os
import unittest

from scripts.deploy import (
    Flags,
    compose_args,
    parse_args,
    parse_docker_host,
    requested_target,
    split_extra,
    tls_hosts,
)


class ParseArgsTest(unittest.TestCase):
    def test_flags_and_passthrough(self) -> None:
        flags = parse_args(["--local", "--no-build", "rss", "--", "--extra"])
        self.assertTrue(flags.local)
        self.assertTrue(flags.no_build)
        self.assertEqual(flags.extra, ["rss", "--extra"])

    def test_help_aliases(self) -> None:
        self.assertTrue(parse_args(["-h"]).help)
        self.assertTrue(parse_args(["--help"]).help)

    def test_unknown_dash_arg_is_compose_passthrough(self) -> None:
        flags = parse_args(["--status", "-q"])
        self.assertTrue(flags.status)
        self.assertEqual(flags.extra, ["-q"])


class RequestedTargetTest(unittest.TestCase):
    def setUp(self) -> None:
        self.prev = os.environ.get("DEPLOY_TARGET")
        os.environ.pop("DEPLOY_TARGET", None)

    def tearDown(self) -> None:
        if self.prev is None:
            os.environ.pop("DEPLOY_TARGET", None)
        else:
            os.environ["DEPLOY_TARGET"] = self.prev

    def test_flags_win_over_env(self) -> None:
        self.assertEqual(requested_target(Flags(local=True)), "local")
        self.assertEqual(requested_target(Flags(remote=True)), "remote")

    def test_env_target(self) -> None:
        os.environ["DEPLOY_TARGET"] = "remote"
        self.assertEqual(requested_target(Flags()), "remote")

    def test_conflicting_flags_error(self) -> None:
        with self.assertRaisesRegex(RuntimeError, "only one"):
            requested_target(Flags(local=True, remote=True))

    def test_bad_env_errors(self) -> None:
        os.environ["DEPLOY_TARGET"] = "moon"
        with self.assertRaisesRegex(RuntimeError, "DEPLOY_TARGET"):
            requested_target(Flags())


class ParseDockerHostTest(unittest.TestCase):
    def test_tcp_host(self) -> None:
        parsed = parse_docker_host("tcp://127.0.0.1:2375")
        self.assertIsNotNone(parsed)
        assert parsed is not None
        self.assertEqual(
            (parsed.protocol, parsed.hostname, parsed.port), ("tcp", "127.0.0.1", 2375)
        )

    def test_empty_and_garbage(self) -> None:
        self.assertIsNone(parse_docker_host(""))
        self.assertIsNone(parse_docker_host("::not a url:::"))


class SplitExtraTest(unittest.TestCase):
    def test_names_and_compose_flags(self) -> None:
        split = split_extra(["rss", "-q"])
        self.assertEqual(split.services, ["rss-reader"])
        self.assertEqual(split.compose_extras, ["-q"])

    def test_folder_expands(self) -> None:
        split = split_extra(["apps/rss"])
        self.assertEqual(split.services, ["rss-reader", "rss-api"])

    def test_unknown_app_errors(self) -> None:
        with self.assertRaisesRegex(ValueError, "Unknown app"):
            split_extra(["nope"])


class ComposeArgsTest(unittest.TestCase):
    def test_up_with_build_by_default(self) -> None:
        args = compose_args(Flags(), ["rss-reader"], [])
        self.assertEqual(args[0], "-f")
        self.assertEqual(args[2:], ["up", "-d", "--build", "rss-reader"])

    def test_no_build_drops_flag(self) -> None:
        args = compose_args(Flags(no_build=True), [], [])
        self.assertNotIn("--build", args)

    def test_down_rejects_services(self) -> None:
        with self.assertRaisesRegex(RuntimeError, "--down"):
            compose_args(Flags(down=True), ["rss-reader"], [])

    def test_status_and_build_only(self) -> None:
        self.assertIn("ps", compose_args(Flags(status=True), ["a"], []))
        self.assertIn("build", compose_args(Flags(build_only=True), ["a"], []))


class TlsHostsTest(unittest.TestCase):
    def test_splits_commas_and_spaces(self) -> None:
        self.assertEqual(
            tls_hosts({"TLS_HOSTS": "a.example, b.example  c.example"}),
            ["a.example", "b.example", "c.example"],
        )

    def test_empty(self) -> None:
        self.assertEqual(tls_hosts({}), [])


if __name__ == "__main__":
    unittest.main()
