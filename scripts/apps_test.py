"""Unit tests for apps.py. Run: python3 -m unittest discover -s scripts -t . -p "*_test.py"."""

from __future__ import annotations

import os
import unittest

from scripts.apps import (
    build_waves,
    completion_words,
    expand_folders,
    resolve_app,
    resolve_apps,
    workspaces_for,
)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def read_repo(path: str) -> str:
    """Read a repo-relative file as text."""
    with open(os.path.join(ROOT, path), encoding="utf-8") as handle:
        return handle.read()


class ExpandFoldersTest(unittest.TestCase):
    def test_folder_path_expands_to_member_apps(self) -> None:
        self.assertEqual(
            [a.id for a in resolve_apps(expand_folders(["apps/rss"]))],
            ["rss-reader", "rss-api"],
        )
        self.assertEqual(
            [a.id for a in resolve_apps(expand_folders(["apps/fitness"]))],
            ["fitness", "fitness-api"],
        )
        self.assertEqual(
            [a.id for a in resolve_apps(expand_folders(["apps/user"]))],
            ["user-web", "user-api"],
        )
        self.assertEqual(
            [a.id for a in resolve_apps(expand_folders(["apps/stock-game"]))],
            ["stock-game", "stock-game-api"],
        )
        self.assertEqual(
            [a.id for a in resolve_apps(expand_folders(["apps/radio-station"]))],
            ["radio-station", "radio-api"],
        )

    def test_single_app_names_pass_through(self) -> None:
        self.assertEqual(expand_folders(["rss"]), ["rss"])
        self.assertEqual(expand_folders(["rss-api"]), ["rss-api"])
        self.assertEqual(expand_folders(["apps/baseball"]), ["apps/baseball"])
        self.assertEqual(
            expand_folders(["apps/stock-game/app"]), ["apps/stock-game/app"]
        )
        self.assertEqual(
            [a.id for a in resolve_apps(expand_folders(["rss"]))], ["rss-reader"]
        )
        self.assertEqual(
            [a.id for a in resolve_apps(["apps/stock-game/app"])], ["stock-game"]
        )

    def test_unknown_names_still_error(self) -> None:
        with self.assertRaisesRegex(ValueError, "Unknown app"):
            resolve_apps(expand_folders(["nope"]))
        with self.assertRaisesRegex(ValueError, "Unknown app"):
            resolve_apps(expand_folders(["apps"]))

    def test_folder_expansion_feeds_services_and_workspaces(self) -> None:
        apps = resolve_apps(expand_folders(["apps/rss"]))
        self.assertEqual([a.service for a in apps], ["rss-reader", "rss-api"])
        self.assertEqual(workspaces_for(apps), ["rss-reader", "rss-api"])

    def test_completion_includes_folder_shortcuts(self) -> None:
        words = completion_words()
        for folder in ["apps/rss", "apps/fitness", "apps/user", "apps/stock-game"]:
            self.assertIn(folder, words)


class BuildWavesTest(unittest.TestCase):
    def test_orders_libraries_before_apps(self) -> None:
        apps = resolve_apps(["lemmy", "clipstack"])
        self.assertEqual(
            build_waves(apps, []),
            [["vertical-scroll-core"], ["lemmy-vertical-scroll", "clipstack"]],
        )

    def test_basketball_orders_core_before_app(self) -> None:
        apps = resolve_apps(["basketball"])
        self.assertEqual(
            build_waves(apps, []),
            [["basketball-core"], ["basketball-tracker"]],
        )

    def test_single_workspace_apps_share_wave_zero(self) -> None:
        apps = resolve_apps(["rss-reader", "rss-api"])
        self.assertEqual(build_waves(apps, []), [["rss-reader", "rss-api"]])

    def test_raw_names_get_trailing_wave(self) -> None:
        self.assertEqual(build_waves([], ["foo", "bar"]), [["foo", "bar"]])
        self.assertEqual(build_waves([], ["foo", "foo"]), [["foo"]])
        self.assertEqual(build_waves([], []), [])


class GiteaRegistrationTest(unittest.TestCase):
    def test_resolves_gitea_and_git_alias(self) -> None:
        app = resolve_app("gitea")
        self.assertIsNotNone(app)
        assert app is not None
        self.assertEqual(app.service, "gitea")
        git = resolve_app("git")
        self.assertIsNotNone(git)
        assert git is not None
        self.assertEqual(git.service, "gitea")


class GiteaComposeTest(unittest.TestCase):
    compose: str

    @classmethod
    def setUpClass(cls) -> None:
        cls.compose = read_repo("deploy/docker-compose.yml")

    def test_pinned_image_on_shared_postgres(self) -> None:
        self.assertRegex(self.compose, r"gitea/gitea:\d+\.\d+\.\d+")
        self.assertIn("GITEA__database__HOST: postgres:5432", self.compose)
        self.assertIn("GITEA__database__NAME: gitea", self.compose)

    def test_ssh_port_and_volume(self) -> None:
        self.assertIn("${GITEA_SSH_PORT:-2222}:22", self.compose)
        self.assertIn("${GITEA_SSH_BIND:-127.0.0.1}", self.compose)
        self.assertIn("gitea-data:/data", self.compose)
        self.assertRegex(self.compose, r"\n  gitea-data:")

    def test_root_url_subpath(self) -> None:
        self.assertIn(
            "GITEA__server__ROOT_URL: ${GITEA_ROOT_URL:-http://localhost/git/}",
            self.compose,
        )

    def test_skips_web_installer(self) -> None:
        self.assertIn("GITEA__security__INSTALL_LOCK: 'true'", self.compose)

    def test_gateway_network_behind_postgres_health(self) -> None:
        gitea = self.compose[self.compose.index("\n  gitea:") :]
        self.assertIn("condition: service_healthy", gitea)
        self.assertIn("- baseball", gitea)

    def test_seeds_postgres_volume(self) -> None:
        self.assertIn("dockerfile: postgres/Dockerfile", self.compose)
        self.assertIn("postgres/initdb/", read_repo("deploy/postgres/Dockerfile"))
        self.assertIn(
            "CREATE DATABASE gitea", read_repo("deploy/postgres/initdb/10-gitea.sql")
        )


class GiteaGatewayRouteTest(unittest.TestCase):
    template: str

    @classmethod
    def setUpClass(cls) -> None:
        cls.template = read_repo("deploy/nginx/default.conf.template")

    def test_git_prefix_routing(self) -> None:
        self.assertIn("location = /git", self.template)
        self.assertIn("location /git/", self.template)
        block = self.template[self.template.index("location /git/") :]
        self.assertIn("rewrite ^/git/(.*)$ /$1 break;", block[:800])
        self.assertIn("proxy_pass $upstream_gitea;", block)


class GiteaEnvDocsTest(unittest.TestCase):
    def test_env_example(self) -> None:
        example = read_repo("deploy/.env.example")
        self.assertIn("GITEA_ROOT_URL=", example)
        self.assertIn("/git/", example)
        self.assertIn("GITEA_SSH_BIND=", example)
        self.assertIn("CREATE DATABASE gitea", example)


if __name__ == "__main__":
    unittest.main()
