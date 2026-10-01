"""Fail when a module points Flyway somewhere the migration guard does not read.

flyway_migration_test.py finds migrations by walking for a db/migration
directory. Two API modules set .locations("classpath:db/migration") explicitly
and the rest rely on Spring's default, which is the same path. That agreement is
an assumption, and this is the check on the assumption.

If a module ever moved its migrations elsewhere, the byte and removal checks
would not fail. They would simply stop seeing those files, which is the quietest
possible outcome and the one nobody notices until production will not start.

So this asserts instead of trusting: every location the tree configures must
resolve to the directory the guard actually scans. The matching is on exact path
parts, not a substring, because otherdb/migration and db/migrations both contain
"db/migration" while the scan reads neither.

Run: python3 -m unittest discover -s . -t . -p "*_test.py".
Only stdlib is used (pathlib, re, unittest).
"""

from __future__ import annotations

import pathlib
import re
import unittest
from collections.abc import Iterable, Mapping

from flyway_migration_test import ROOT, SKIP_DIRS, in_migration_dir

# Where a module might declare a location, whatever syntax it uses.
CONFIGS = ("*.kt", "*.java", "*.properties", "*.yml", "*.yaml")

# The key that introduces a location: a Kotlin call .locations(, a properties
# assignment locations=, or a YAML mapping locations:.
LOCATION_KEY = re.compile(r"locations\s*[(:=]", re.IGNORECASE)

# The scheme prefix Flyway accepts, as in classpath: or filesystem:.
SCHEME = re.compile(r"^[a-z][a-z0-9+.-]*:", re.IGNORECASE)

# The YAML block form puts its values on following lines, so this reads them.
BLOCK_ITEM = re.compile(r"^-\s*")

# A Kotlin call may pass several arguments, and a properties or YAML value may be
# a comma-separated list. Both are captured here so neither can hide a location.
QUOTED = re.compile(r'"([^"]*)"|\'([^\']*)\'')


def split_location_values(tail: str) -> list[str]:
    """The individual locations in one configured value.

    Quoted arguments win over a comma split, so a location that legitimately
    contains a comma is not torn apart.
    """
    tail = tail.strip().rstrip(")").strip()
    quoted = [a or b for a, b in QUOTED.findall(tail)]
    if quoted:
        return [value for value in quoted if value]
    return [part.strip().strip("\"'") for part in tail.split(",") if part.strip()]


def extract_locations(text: str) -> list[str]:
    """Every Flyway location a config file sets, across every supported syntax.

    Inline values and YAML block lists are both read. A single-line regex sees
    none of the block form, and missing it would let a relocated migration
    directory pass unchecked.
    """
    lines = text.splitlines()
    values: list[str] = []
    for index, line in enumerate(lines):
        key = LOCATION_KEY.search(line)
        if key is None:
            continue
        tail = line[key.end() :].strip()
        if tail:
            values.extend(split_location_values(tail))
            continue
        for following in lines[index + 1 :]:
            item = following.strip()
            if not item.startswith("-"):
                break
            values.extend(split_location_values(BLOCK_ITEM.sub("", item)))
    return values


def location_parts(value: str) -> tuple[str, ...]:
    """A configured location reduced to the path parts the scan would read."""
    cleaned = SCHEME.sub("", value.strip().strip("\"'")).strip("/")
    return tuple(part for part in cleaned.split("/") if part)


def configured_migration_locations(root: pathlib.Path) -> dict[str, list[str]]:
    """Every Flyway location the tree configures, keyed by the file setting it.

    Scoped to files mentioning Flyway at all, so an unrelated "locations" key
    elsewhere is not mistaken for a migration directory.
    """
    found: dict[str, list[str]] = {}
    for pattern in CONFIGS:
        for path in root.rglob(pattern):
            if SKIP_DIRS.intersection(path.relative_to(root).parts):
                continue
            try:
                text = path.read_text(encoding="utf-8", errors="replace")
            except OSError:
                continue
            if "flyway" not in text.lower():
                continue
            values = extract_locations(text)
            if values:
                found[path.relative_to(root).as_posix()] = values
    return found


def unexpected_locations(locations: Mapping[str, Iterable[str]]) -> list[str]:
    """Configured locations the scan would not read, as "file: value" strings."""
    return [
        f"{rel}: {value}"
        for rel, values in locations.items()
        for value in values
        if not in_migration_dir(location_parts(value))
    ]


class MigrationLocationTest(unittest.TestCase):
    def test_migration_location_has_not_moved(self) -> None:
        """No module may point Flyway somewhere the guard does not look."""
        located = configured_migration_locations(ROOT)
        # Pin that the scan still matches the settings it polices. Two modules
        # set .locations() today; matching nothing would let any future location
        # through without complaint.
        self.assertGreaterEqual(
            len(located),
            1,
            "no explicit Flyway location found; the scan is probably not matching",
        )
        self.assertEqual(
            [],
            unexpected_locations(located),
            "a module reads migrations from a directory the guard does not scan; "
            "update MIGRATION_DIR in flyway_migration_test.py",
        )

    def test_reads_every_supported_syntax(self) -> None:
        """Inline, multi-argument, comma-separated and YAML block forms all read.

        A single-value regex misses the second argument of a Kotlin call and the
        rest of a comma-separated list, which is how a relocated directory would
        have slipped through unnoticed.
        """
        block = "  locations:\n    - classpath:db/migration\n    - classpath:other\n"
        cases = [
            ('.locations("classpath:db/migration")', ["classpath:db/migration"]),
            (
                '.locations("classpath:db/migration", "classpath:other")',
                ["classpath:db/migration", "classpath:other"],
            ),
            (
                "spring.flyway.locations=classpath:db/migration,classpath:other",
                ["classpath:db/migration", "classpath:other"],
            ),
            ("locations: classpath:db/migration", ["classpath:db/migration"]),
            (block, ["classpath:db/migration", "classpath:other"]),
        ]
        for text, expected in cases:
            with self.subTest(text=text):
                self.assertEqual(expected, extract_locations(text))

    def test_near_miss_paths_are_rejected(self) -> None:
        """A location that merely contains the substring is not the scanned dir.

        otherdb/migration and db/migrations both satisfy a substring test, so the
        check has to match exact parts instead.
        """
        for value in (
            "classpath:otherdb/migration",
            "classpath:db/migrations",
            "classpath:other",
        ):
            with self.subTest(value=value):
                self.assertEqual([f"f: {value}"], unexpected_locations({"f": [value]}))
        self.assertEqual([], unexpected_locations({"f": ["classpath:db/migration"]}))


if __name__ == "__main__":
    unittest.main()
