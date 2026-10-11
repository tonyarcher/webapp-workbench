"""Unit tests for deploy.py's argument mapping and tunnel preflight.

Run: python3 -m unittest discover -s tools -t . -p "*_test.py".
Only stdlib is used (unittest).
"""

from __future__ import annotations

import contextlib
import io
import os
import socket
import tempfile
import unittest
from unittest.mock import patch

from deploy import (
    ensure_open,
    gradle_argv,
    gradle_command,
    main,
    preflight,
    read_dotenv,
    split_endpoint,
    wants_publish,
    wants_remote,
)


class GradleArgvTest(unittest.TestCase):
    def test_no_args_deploys_everything(self) -> None:
        self.assertEqual(gradle_argv([]), ["deploy", "--console=plain"])

    def test_flags_become_bare_tokens(self) -> None:
        self.assertEqual(
            gradle_argv(["--local", "rss"]),
            ["deploy", "--console=plain", "-Pargs=local rss", "-Papps=rss"],
        )
        self.assertEqual(
            gradle_argv(["--remote", "--no-build"]),
            ["deploy", "--console=plain", "-Pargs=remote no-build"],
        )

    def test_app_names_pass_through(self) -> None:
        self.assertEqual(
            gradle_argv(["rss"]),
            ["deploy", "--console=plain", "-Pargs=rss", "-Papps=rss"],
        )
        self.assertEqual(
            gradle_argv(["apps/rss", "stock"]),
            [
                "deploy",
                "--console=plain",
                "-Pargs=apps/rss stock",
                "-Papps=apps/rss,stock",
            ],
        )

    def test_app_after_a_flag_is_kept(self) -> None:
        self.assertEqual(
            gradle_argv(["--remote", "rss"]),
            ["deploy", "--console=plain", "-Pargs=remote rss", "-Papps=rss"],
        )

    def test_unknown_dash_args_go_to_compose(self) -> None:
        self.assertEqual(
            gradle_argv(["-q", "rss"]),
            [
                "deploy",
                "--console=plain",
                "-Pargs=rss",
                "-Ppassthrough=-q",
                "-Papps=rss",
            ],
        )

    def test_separator_routes_the_rest_to_compose(self) -> None:
        self.assertEqual(
            gradle_argv(["rss", "--status", "--", "--force-recreate", "-q"]),
            [
                "deploy",
                "--console=plain",
                "-Pargs=rss status",
                "-Ppassthrough=--force-recreate -q",
                "-Papps=rss",
            ],
        )

    def test_dry_run_is_not_mapped(self) -> None:
        self.assertEqual(
            gradle_argv(["--dry-run", "rss"]),
            ["deploy", "--console=plain", "-Pargs=rss", "-Papps=rss"],
        )


class GradleCommandTest(unittest.TestCase):
    def test_prefers_the_wrapper(self) -> None:
        # sys.platform decides which wrapper name is returned, so patch it too.
        # Without that this only passes on Windows.
        with (
            patch("sys.platform", "win32"),
            patch("os.path.exists", return_value=True),
        ):
            self.assertEqual(gradle_command(), ["gradlew.bat"])

    def test_uses_gradlew_on_posix(self) -> None:
        with (
            patch("sys.platform", "linux"),
            patch("os.path.exists", return_value=True),
        ):
            self.assertEqual(gradle_command(), ["./gradlew"])

    def test_falls_back_to_gradle_without_a_wrapper(self) -> None:
        with patch("os.path.exists", return_value=False):
            self.assertEqual(gradle_command(), ["gradle"])


class MainTest(unittest.TestCase):
    def test_help_prints_and_exits_zero(self) -> None:
        # The help text is long, and deploy.py prints its own HELP constant to
        # stdout. Captured here so it does not land in the middle of a passing
        # run: on CI it buried the result line, which made a green suite look like
        # a failure.
        with contextlib.redirect_stdout(io.StringIO()) as out:
            self.assertEqual(main(["--help"]), 0)
            self.assertEqual(main(["-h"]), 0)
        self.assertIn("usage", out.getvalue().lower())


class SplitEndpointTest(unittest.TestCase):
    def test_tcp_scheme(self) -> None:
        self.assertEqual(
            split_endpoint("tcp://127.0.0.1:2375", 9000), ("127.0.0.1", 2375)
        )

    def test_http_with_port(self) -> None:
        self.assertEqual(
            split_endpoint("http://127.0.0.1:9000", 80), ("127.0.0.1", 9000)
        )

    def test_https_without_port_uses_scheme_default(self) -> None:
        self.assertEqual(
            split_endpoint("https://store.example.com", 443), ("store.example.com", 443)
        )

    def test_bare_host_uses_default_port(self) -> None:
        self.assertEqual(
            split_endpoint("store.example.com", 9000), ("store.example.com", 9000)
        )


class ReadDotenvTest(unittest.TestCase):
    def write_env(self, text: str) -> str:
        handle, path = tempfile.mkstemp(suffix=".env")
        with os.fdopen(handle, "w", encoding="utf-8") as out:
            out.write(text)
        self.addCleanup(os.remove, path)
        return path

    def test_pairs_blanks_comments_and_quotes(self) -> None:
        path = self.write_env(
            "# comment\n\nS3_BUCKET=workbench-assets\n"
            "QUOTED=\"http://127.0.0.1:9000\"\nSINGLE='x'\nNOT_A_PAIR\n"
        )
        self.assertEqual(
            read_dotenv(path),
            {
                "S3_BUCKET": "workbench-assets",
                "QUOTED": "http://127.0.0.1:9000",
                "SINGLE": "x",
            },
        )

    def test_bom_first_key_parses_cleanly(self) -> None:
        handle, path = tempfile.mkstemp(suffix=".env")
        with os.fdopen(handle, "w", encoding="utf-8-sig") as out:
            out.write("S3_BUCKET=workbench-assets\n")
        self.addCleanup(os.remove, path)
        self.assertEqual(read_dotenv(path), {"S3_BUCKET": "workbench-assets"})

    def test_missing_file_reads_empty(self) -> None:
        self.assertEqual(
            read_dotenv(os.path.join(tempfile.gettempdir(), "no-such.env")), {}
        )


class TcpOpenTest(unittest.TestCase):
    def test_closed_port_is_false(self) -> None:
        from deploy import tcp_open

        # Nothing listens on port 1; refusal is instant, so no slow timeout.
        self.assertFalse(tcp_open("127.0.0.1", 1, timeout=2))

    def test_listening_socket_is_true(self) -> None:
        from deploy import tcp_open

        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            listener.listen(1)
            self.assertTrue(tcp_open("127.0.0.1", listener.getsockname()[1], timeout=2))


class WantsRemoteTest(unittest.TestCase):
    def test_bare_run_wants_remote(self) -> None:
        with patch.dict(os.environ, {}, clear=True):
            self.assertTrue(wants_remote([]))

    def test_local_flag_skips(self) -> None:
        with patch.dict(os.environ, {}, clear=True):
            self.assertFalse(wants_remote(["--local"]))

    def test_docker_host_pins_the_engine(self) -> None:
        with patch.dict(
            os.environ, {"DOCKER_HOST": "tcp://127.0.0.1:2375"}, clear=True
        ):
            self.assertFalse(wants_remote([]))
            self.assertFalse(wants_remote(["--remote"]))

    def test_deploy_target_local_skips(self) -> None:
        with patch.dict(os.environ, {"DEPLOY_TARGET": "local"}, clear=True):
            self.assertFalse(wants_remote([]))

    def test_deploy_target_remote_wants_remote(self) -> None:
        with patch.dict(os.environ, {"DEPLOY_TARGET": "remote"}, clear=True):
            self.assertTrue(wants_remote([]))


class WantsPublishTest(unittest.TestCase):
    def test_bare_and_scoped_runs_publish(self) -> None:
        self.assertTrue(wants_publish([]))
        self.assertTrue(wants_publish(["rss"]))
        self.assertTrue(wants_publish(["--no-build"]))

    def test_down_status_and_build_only_skip(self) -> None:
        self.assertFalse(wants_publish(["--down"]))
        self.assertFalse(wants_publish(["--status"]))
        self.assertFalse(wants_publish(["--build-only", "rss"]))


def quiet_preflight(argv: list[str]) -> int:
    with (
        contextlib.redirect_stdout(io.StringIO()),
        contextlib.redirect_stderr(io.StringIO()),
    ):
        return preflight(argv)


class PreflightTest(unittest.TestCase):
    def test_local_runs_skip_probing(self) -> None:
        with (
            patch.dict(os.environ, {}, clear=True),
            patch("deploy.tcp_open") as probe,
            patch("deploy.tunnel_up") as heal,
        ):
            self.assertEqual(quiet_preflight(["--local"]), 0)
            probe.assert_not_called()
            heal.assert_not_called()

    def test_open_tunnel_never_heals(self) -> None:
        with (
            patch.dict(os.environ, {}, clear=True),
            patch("deploy.tcp_open", return_value=True),
            patch("deploy.tunnel_up") as heal,
            patch("deploy.store_endpoint", return_value=None),
        ):
            self.assertEqual(quiet_preflight([]), 0)
            heal.assert_not_called()

    def test_closed_tunnel_heals_then_proceeds(self) -> None:
        with (
            patch.dict(os.environ, {}, clear=True),
            patch("deploy.tcp_open", side_effect=[False, True]),
            patch("deploy.tunnel_up", return_value=True) as heal,
            patch("deploy.store_endpoint", return_value=None),
        ):
            self.assertEqual(quiet_preflight([]), 0)
            heal.assert_called_once_with()

    def test_unhealable_tunnel_fails_before_gradle(self) -> None:
        with (
            patch.dict(os.environ, {}, clear=True),
            patch("deploy.tcp_open", return_value=False),
            patch("deploy.tunnel_up", return_value=False),
        ):
            self.assertEqual(quiet_preflight([]), 1)

    def test_store_down_heals_then_proceeds(self) -> None:
        with (
            patch.dict(os.environ, {}, clear=True),
            patch("deploy.tcp_open", side_effect=[True, False, True]),
            patch("deploy.tunnel_up", return_value=True),
            patch("deploy.store_endpoint", return_value=("127.0.0.1", 9000)),
        ):
            self.assertEqual(quiet_preflight([]), 0)

    def test_store_down_unhealable_fails(self) -> None:
        with (
            patch.dict(os.environ, {}, clear=True),
            patch("deploy.tcp_open", side_effect=[True, False, False]),
            patch("deploy.tunnel_up", return_value=True),
            patch("deploy.store_endpoint", return_value=("127.0.0.1", 9000)),
        ):
            self.assertEqual(quiet_preflight([]), 1)

    def test_status_skips_the_store_check(self) -> None:
        with (
            patch.dict(os.environ, {}, clear=True),
            patch("deploy.tcp_open", return_value=True),
            patch("deploy.store_endpoint") as store,
        ):
            self.assertEqual(quiet_preflight(["--status"]), 0)
            store.assert_not_called()

    def test_ensure_open_skips_heal_when_already_open(self) -> None:
        with (
            patch("deploy.tcp_open", return_value=True),
            patch("deploy.tunnel_up") as heal,
        ):
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertTrue(ensure_open("x", "127.0.0.1", 1))
            heal.assert_not_called()


if __name__ == "__main__":
    unittest.main()
