"""Unit tests for deploy.py pure helpers.

Run: python3 -m unittest discover -s scripts -t . -p "*_test.py".
Only stdlib is used (unittest, os).
"""

from __future__ import annotations

import os
import unittest

from scripts.deploy import (
    HOST_JS_APPS,
    Flags,
    compose_args,
    host_js_apps_for,
    js_workspace_waves,
    npm_env,
    parse_args,
    parse_docker_host,
    requested_target,
    skip_host_build,
    split_extra,
    tls_hosts,
)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def read_repo(path: str) -> str:
    """Read a repo-relative file as text."""
    with open(os.path.join(ROOT, path), encoding="utf-8") as handle:
        return handle.read()


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


class HostJsAppsTest(unittest.TestCase):
    def test_filter_and_all(self) -> None:
        self.assertEqual(host_js_apps_for([]), list(HOST_JS_APPS))
        names = [item.service for item in host_js_apps_for(["basketball", "radio-api"])]
        self.assertEqual(names, ["radio-api", "basketball"])

    def test_base_path_and_radio_script(self) -> None:
        basketball = next(item for item in HOST_JS_APPS if item.service == "basketball")
        radio_api = next(item for item in HOST_JS_APPS if item.service == "radio-api")
        self.assertEqual(basketball.base_path, "/basketball/")
        self.assertEqual(radio_api.script, "build:server")

    def test_shared_lib_is_one_wave_before_consumers(self) -> None:
        items = host_js_apps_for(["lemmy-vertical-scroll", "clipstack"])
        waves = js_workspace_waves(items)
        self.assertEqual([job.workspace for job in waves[0]], ["vertical-scroll-core"])
        self.assertEqual(
            sorted(job.workspace for job in waves[1]),
            ["clipstack", "lemmy-vertical-scroll"],
        )

    def test_radio_spa_and_api_share_a_workspace_two_scripts(self) -> None:
        items = host_js_apps_for(["radio-station", "radio-api"])
        waves = js_workspace_waves(items)
        self.assertEqual(len(waves), 1)
        self.assertEqual(
            sorted((job.workspace, job.script) for job in waves[0]),
            [("radio-station", "build"), ("radio-station", "build:server")],
        )

    def test_subpath_spa_sets_base_on_the_app_workspace(self) -> None:
        waves = js_workspace_waves(host_js_apps_for(["basketball"]))
        self.assertEqual(waves[0][0].workspace, "basketball-core")
        self.assertEqual(waves[0][0].base_path, "")
        self.assertEqual(waves[1][0].workspace, "basketball-tracker")
        self.assertEqual(waves[1][0].base_path, "/basketball/")

    def test_skip_host_build_flags(self) -> None:
        self.assertTrue(skip_host_build(Flags(no_build=True)))
        self.assertTrue(skip_host_build(Flags(down=True)))
        self.assertFalse(skip_host_build(Flags()))

    def test_npm_env_sets_and_clears_base_path(self) -> None:
        previous = os.environ.get("APP_BASE_PATH")
        os.environ["APP_BASE_PATH"] = "/stale/"
        try:
            self.assertEqual(npm_env("/basketball/")["APP_BASE_PATH"], "/basketball/")
            self.assertNotIn("APP_BASE_PATH", npm_env(""))
        finally:
            if previous is None:
                os.environ.pop("APP_BASE_PATH", None)
            else:
                os.environ["APP_BASE_PATH"] = previous


class HostJsDockerfilesTest(unittest.TestCase):
    def test_images_copy_dist_without_compiling_typescript(self) -> None:
        dockerignore = read_repo(".dockerignore")
        for item in HOST_JS_APPS:
            dockerfile = read_repo(os.path.join("deploy", item.service, "Dockerfile"))
            for line in dockerfile.splitlines():
                if line.startswith("RUN") or line.startswith("CMD"):
                    self.assertNotIn("rm -f package-lock.json", line)
                    self.assertNotIn("npm run build", line)
                    self.assertNotIn("tsc", line)
            self.assertIn("COPY ", dockerfile)
            dist = item.dist.replace("\\", "/")
            self.assertIn(f"!{dist}", dockerignore)
            self.assertIn(f"!{dist}/**", dockerignore)


if __name__ == "__main__":
    unittest.main()
