"""Contract tests for apps.json, the Gradle app catalog.

Run: python3 -m unittest discover -s . -t . -p "*_test.py".
Only stdlib is used (json, pathlib, typing, unittest).
"""

from __future__ import annotations

import json
import unittest
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
CATALOG = ROOT / "apps.json"


def load_catalog() -> dict[str, Any]:
    """Parse apps.json and require the top-level object."""
    raw: Any = json.loads(CATALOG.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise TypeError("apps.json must contain a JSON object")
    return raw


def app_entries(catalog: dict[str, Any]) -> list[dict[str, Any]]:
    """The app list, each entry required to be an object."""
    apps = catalog["apps"]
    if not isinstance(apps, list) or not apps:
        raise AssertionError("apps.json.apps must be a non-empty list")
    entries: list[dict[str, Any]] = []
    for entry in apps:
        if not isinstance(entry, dict):
            raise TypeError("apps.json.apps entries must be objects")
        entries.append(entry)
    return entries


class AppCatalogTest(unittest.TestCase):
    def test_top_level_shape(self) -> None:
        catalog = load_catalog()
        for key in ("composeFile", "dockerOnly", "apiJars", "apps"):
            self.assertIn(key, catalog)

    def test_app_ids_unique(self) -> None:
        # Array order is the build order (shared packages before consumers),
        # so ids must also be unique for that order to be well-defined.
        ids = [entry["id"] for entry in app_entries(load_catalog())]
        self.assertEqual(len(ids), len(set(ids)))

    def test_app_entries_use_known_keys(self) -> None:
        allowed = {"id", "workspaces", "services", "basePath", "buildScript", "aliases"}
        for entry in app_entries(load_catalog()):
            self.assertEqual(set(entry.keys()) - allowed, set())

    def test_each_app_has_workspaces_and_services(self) -> None:
        for entry in app_entries(load_catalog()):
            for key in ("workspaces", "services"):
                values = entry[key]
                self.assertIsInstance(values, list)
                self.assertTrue(values)
                for value in values:
                    self.assertIsInstance(value, str)
                    self.assertTrue(value)
                self.assertEqual(len(values), len(set(values)))
            for key in ("aliases",):
                if key in entry:
                    for value in entry[key]:
                        self.assertIsInstance(value, str)
                        self.assertTrue(value)
            for key in ("basePath", "buildScript"):
                if key in entry:
                    self.assertIsInstance(entry[key], str)

    def test_aliases_resolve(self) -> None:
        catalog = load_catalog()
        ids = {str(entry["id"]) for entry in app_entries(catalog)}
        docker_only = catalog["dockerOnly"]
        self.assertIsInstance(docker_only, dict)
        services = set(docker_only.values())
        seen: dict[str, str] = {}
        for entry in app_entries(catalog):
            for alias in entry.get("aliases", []):
                self.assertNotIn(alias, ids)
                self.assertNotIn(alias, seen)
                seen[str(alias)] = str(entry["id"])
        for alias, service in docker_only.items():
            self.assertNotIn(alias, ids)
            self.assertNotIn(alias, seen)
            seen[str(alias)] = str(service)
            self.assertTrue(service)
        for alias, target in seen.items():
            self.assertIn(target, ids | services, f"alias {alias!r}")

    def test_services_unique(self) -> None:
        services: list[str] = []
        for entry in app_entries(load_catalog()):
            services.extend(str(service) for service in entry["services"])
        self.assertEqual(len(services), len(set(services)))

    def test_api_jars_reference_known_services(self) -> None:
        catalog = load_catalog()
        services: set[str] = set()
        for entry in app_entries(catalog):
            services.update(str(service) for service in entry["services"])
        jars = catalog["apiJars"]
        self.assertIsInstance(jars, dict)
        self.assertTrue(jars)
        for service, path in jars.items():
            self.assertIn(service, services)
            self.assertIsInstance(path, str)
            self.assertTrue(path)

    def test_api_jar_layout_supports_settings_derivation(self) -> None:
        # settings.gradle.kts derives each API module from its jar path:
        # apps/<app>/api/build/libs/<name>.jar. The directory must exist and
        # hold that API's own build file for standalone builds.
        jars = load_catalog()["apiJars"]
        self.assertIsInstance(jars, dict)
        for service, path in jars.items():
            self.assertIsInstance(path, str)
            # Pin exactly what settings.gradle.kts enforces: the path must
            # contain "/build/" and the derived project dir must end in /api.
            self.assertIn("/build/", str(path))
            parts = str(path).split("/")
            self.assertGreater(len(parts), 4, f"jar path for {service!r}")
            self.assertEqual(parts[-2], "libs")
            self.assertTrue(str(path).endswith(".jar"))
            project_dir = ROOT.joinpath(*parts[:-3])
            self.assertEqual(project_dir.name, "api", f"project dir for {service!r}")
            self.assertTrue(project_dir.is_dir(), f"missing dir for {service!r}")
            self.assertTrue(
                (project_dir / "build.gradle.kts").is_file(),
                f"missing build file for {service!r}",
            )

    def test_base_paths_are_subpaths(self) -> None:
        for entry in app_entries(load_catalog()):
            base = entry.get("basePath", "")
            self.assertIsInstance(base, str)
            if base:
                self.assertTrue(base.startswith("/"))
                self.assertTrue(base.endswith("/"))


if __name__ == "__main__":
    unittest.main()
