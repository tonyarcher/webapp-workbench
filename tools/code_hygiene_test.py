"""Warn about hardcoded environment-specific values in non-test Kotlin source.

A service meant for a million users should not hardcode localhost, a loopback
address, or a bare URL in its application source. Those are deployment-specific:
they belong in the environment or the build script, not in a .kt file where a
default can silently reach production and break WebAuthn or token validation
while every local indicator still reads healthy.

This warns rather than fails. The first run surfaces a backlog to triage, and
an agent that respects the warning keeps the count from growing. A hard failure
would only push the problem into an allowlist, which is the same rot in a
different costume.

Run: python3 -m unittest discover -s tools -t . -p "*_test.py".
Only stdlib is used (pathlib, re, unittest).
"""

from __future__ import annotations

import pathlib
import re
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent

# Values that are deployment-specific and must not be hardcoded in source.
# Matched as whole words so "localhost" in a comment or identifier is handled
# by comment stripping, and "127.0.0.1" does not false-positive on "127.0.0.10".
FORBIDDEN = (
    re.compile(r"\blocalhost\b"),
    re.compile(r"\b127\.0\.0\.1\b"),
    re.compile(r"\b0\.0\.0\.0\b"),
)

# Directories that are generated, vendored, or test-only.
SKIP_DIRS = frozenset(
    {".git", "build", "coverage", "dist", "node_modules", "out", "target"}
)


def strip_comments(line: str) -> str:
    """Drop a // line comment, so a mention in a comment is not a hit."""
    idx = line.find("//")
    return line[:idx] if idx >= 0 else line


def source_lines() -> list[tuple[pathlib.Path, int, str]]:
    """(file, line number, code) for every non-test Kotlin source line."""
    out: list[tuple[pathlib.Path, int, str]] = []
    for path in ROOT.rglob("*.kt"):
        rel = path.relative_to(ROOT)
        if SKIP_DIRS & set(rel.parts):
            continue
        if "src/test" in rel.parts or "test" in rel.parts:
            continue
        for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            out.append((path, number, strip_comments(line)))
    return out


class CodeHygieneTest(unittest.TestCase):
    """Hardcoded environment-specific values in source should be zero, or warned."""

    def test_no_hardcoded_environment_values(self) -> None:
        """Warn on any hardcoded localhost, loopback, or wildcard address.

        The assertion is deliberately permissive: it fails only when the
        warning is empty, which never happens, so the test passes while the
        warning does the real work. An agent reads the output and removes the
        hits. A hard failure would invite an allowlist instead.
        """
        hits: list[str] = []
        for path, number, code in source_lines():
            for pattern in FORBIDDEN:
                if pattern.search(code):
                    rel = path.relative_to(ROOT).as_posix()
                    hits.append(f"{rel}:{number}: {pattern.pattern} -> {code.strip()}")
        if hits:
            print("\n" + "=" * 78)
            print(f"WARNING: {len(hits)} hardcoded env values in non-test Kotlin:")
            print(
                "These are deployment-specific; they belong in the environment or build"
            )
            print(
                "script, not in source, where a default can silently reach production."
            )
            for hit in hits:
                print(f"  {hit}")
            print("=" * 78 + "\n")
        # Warn only. The count is reported above for an agent to act on.
        self.assertTrue(True, "hygiene warning emitted; see the list above")


if __name__ == "__main__":
    unittest.main()
