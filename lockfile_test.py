"""Guard the lockfile against losing a platform's native optional dependencies.

Run: python3 -m unittest discover -s . -t . -p "*_test.py".
Only stdlib is used (json, pathlib, unittest).

Rollup and esbuild ship prebuilt native bindings as optionalDependencies, one
package per platform. npm resolves optional dependencies for the platform it is
running on, so a lockfile generated on Windows records only the Windows
packages. That lockfile then installs cleanly on Windows and fails on Linux,
because `npm ci` finds no `@rollup/rollup-linux-x64-gnu` and rollup cannot load
its native binding at import time. The first CI run failed exactly that way:
packages/web-components' @web/test-runner could not import rollup at all.

The lockfile therefore has to carry the bindings for every platform this repo
runs on: linux-x64 for the GitHub runners and the Docker image builds, and
win32-x64 for developer machines. Regenerating the lockfile on one platform
silently drops the other, and nothing else in the suite notices, because the
build passes on whichever machine produced it. These assertions read the
lockfile itself, so they hold on every platform and fail the moment it narrows.
"""

from __future__ import annotations

import json
import unittest
from pathlib import Path
from typing import Any

# One lockfile entry. The values are heterogeneous, so they stay `object` and the
# helpers below narrow what they use.
LockEntry = dict[str, Any]

LOCKFILE = Path(__file__).resolve().parent / "package-lock.json"

# The packages that ship one native binding per platform, and the binding each
# platform needs from them.
NATIVE_BINDINGS: dict[str, dict[str, str]] = {
    "node_modules/rollup": {
        "linux-x64": "@rollup/rollup-linux-x64-gnu",
        "win32-x64": "@rollup/rollup-win32-x64-msvc",
    },
    "node_modules/esbuild": {
        "linux-x64": "@esbuild/linux-x64",
        "win32-x64": "@esbuild/win32-x64",
    },
}


def packages() -> dict[str, LockEntry]:
    """Return the lockfile's package map, keyed by install path."""
    with LOCKFILE.open(encoding="utf-8") as handle:
        data: dict[str, dict[str, LockEntry]] = json.load(handle)["packages"]
        return data


def optional_dependencies(entry: LockEntry) -> dict[str, str]:
    """The package's declared optionalDependencies; empty when it declares none."""
    declared = entry.get("optionalDependencies")
    if not isinstance(declared, dict):
        return {}
    return {str(name): str(version) for name, version in declared.items()}


class LockfilePlatformTest(unittest.TestCase):
    def setUp(self) -> None:
        self.packages = packages()

    def entry_for(self, package: str) -> LockEntry:
        """The lockfile entry for a package, failing the test when it is absent."""
        entry = self.packages.get(f"node_modules/{package}")
        if entry is None:
            self.fail(f"{package} is not in the lockfile")
        return entry

    def test_every_native_binding_for_every_platform_is_locked(self) -> None:
        """Each platform's binding is present, not just the one being developed on."""
        missing: list[str] = []
        for host, bindings in NATIVE_BINDINGS.items():
            self.assertIn(host, self.packages, f"{host} is not in the lockfile")
            for platform, package in bindings.items():
                if f"node_modules/{package}" not in self.packages:
                    missing.append(f"{package} ({platform}, for {host})")
        self.assertEqual(
            missing,
            [],
            "lockfile is missing native optional dependencies. A lockfile written"
            " on one platform records only that platform's optional dependencies."
            " Regenerate it where every platform's bindings are recorded, or add"
            " the missing packages explicitly.\n  " + "\n  ".join(missing),
        )

    def test_bindings_are_marked_optional(self) -> None:
        """They must stay optional, or `npm ci` demands them on every platform."""
        for bindings in NATIVE_BINDINGS.values():
            for package in bindings.values():
                entry = self.entry_for(package)
                self.assertTrue(
                    entry.get("optional"),
                    f"{package} is no longer optional; npm will try to install it"
                    " on platforms it does not build for",
                )

    def test_declared_optional_dependencies_are_recorded(self) -> None:
        """The bindings are really optionalDependencies of their host package.

        Guards the other direction: if a future npm stops recording optional
        dependencies at all, the two tests above would pass vacuously on an
        empty set.
        """
        for host, bindings in NATIVE_BINDINGS.items():
            declared = optional_dependencies(self.packages[host])
            self.assertTrue(declared, f"{host} declares no optional deps")
            for package in bindings.values():
                self.assertIn(
                    package,
                    declared,
                    f"{package} is not an optional dependency of {host}",
                )


if __name__ == "__main__":
    unittest.main()
