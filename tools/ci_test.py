r"""Guard the one workflow line that keeps a database test running.

The rate limiter's Postgres slice test is opt-in behind a `-Pintegration` Gradle
flag, because the default `check` excludes it so that `check` needs no Docker
daemon. That makes a single line in .github/workflows/ci.yml load bearing: if
the flag goes missing, or is set to a value the parser reads as off, the build
still passes with the test skipped.

Two failures are detected: the flag absent, and the flag present but disabled.
Known limits, deliberately not handled, because each would need real YAML
parsing in a guard whose whole job is to notice one missing flag:

- A `run: |` block scalar that wraps the flag mid-token (`-Pintegration=` then
  `false` at the same indent). YAML strips the block indent, so the shell really
  passes `false`, but a line-based scan keeps the indentation and the value does
  not match. Writing a step this way by hand is not a thing people do.
- A command split across a `\` continuation. Not joined; each line is read on its
  own, so a wrapped flag reads as absent.
"""

from __future__ import annotations

import re
import unittest
from pathlib import Path
from typing import ClassVar

ROOT = Path(__file__).resolve().parent.parent
WORKFLOW = ROOT / ".github/workflows/ci.yml"
BUILD = ROOT / "apps/user/api/build.gradle.kts"

# The task whose verification needs the profile.
JVM_TASK = "checkAll"

# A shell token ends at whitespace, a separator, or end of line. Requiring one
# keeps `-PintegrationProfile=true`, a different property, from matching.
# The value is optional so a bare `-Pintegration` reads as present.
FLAG = re.compile(
    r"-Pintegration(?:=(?P<value>[^\s;&|()]*))?(?=$|[\s;&|()])",
    re.IGNORECASE,
)

DISABLED_IN_BUILD = re.compile(r"val disabledFlagValues = setOf\((?P<values>[^)]*)\)")


def gradle_steps(text: str) -> list[tuple[int, str]]:
    """(line number, command) for each `./gradlew` step in the workflow.

    Keyed on the binary rather than the YAML prefix, because a step is written
    either as `- run: ./gradlew ...` or as `- name: ...` followed by
    `run: ./gradlew ...`. Matching only the first let the second slip through
    unchecked while a correctly flagged step kept the count above zero.

    Comment lines are skipped, so prose mentioning gradlew is not a step.
    """
    out: list[tuple[int, str]] = []
    for number, line in enumerate(text.splitlines(), 1):
        if line.strip().startswith("#") or "./gradlew" not in line:
            continue
        out.append((number, line.split("./gradlew", 1)[1]))
    return out


def jvm_steps(text: str) -> list[tuple[int, str]]:
    """The steps that run the JVM verification task."""
    return [(n, c) for n, c in gradle_steps(text) if JVM_TASK in command(c)]


def command(args: str) -> str:
    """The part of a step the shell would run, without a trailing comment.

    A `#` preceded by whitespace starts a shell comment, so
    `./gradlew checkAll # -Pintegration=true` enables nothing. Reading the whole
    line would let the flag be parked in a comment.
    """
    return re.split(r"\s#", args, maxsplit=1)[0]


def flag_values(command_text: str) -> list[str]:
    """Every value the shell would pass for `-Pintegration`, lowercased.

    The shell strips quotes before Gradle reads the property, so `"false"` and
    `false` are the same value here.
    """
    return [
        (m.group("value") or "").strip("\"'").lower()
        for m in FLAG.finditer(command_text)
    ]


def disabled_flag_values(build: str) -> set[str]:
    """The spellings the Gradle parser treats as off, read from the parser.

    Read rather than restated, so this and the Kotlin cannot disagree. An empty
    result means the parser was renamed, which the test treats as a failure.
    """
    match = DISABLED_IN_BUILD.search(build)
    if match is None:
        return set()
    return set(re.findall(r'"([^"]*)"', match.group("values")))


class CiGradleFlagsTest(unittest.TestCase):
    """CI must ask for the coverage it would otherwise silently skip."""

    text: ClassVar[str] = ""
    build: ClassVar[str] = ""

    @classmethod
    def setUpClass(cls) -> None:
        cls.text = WORKFLOW.read_text(encoding="utf-8")
        cls.build = BUILD.read_text(encoding="utf-8")

    def test_the_scan_finds_the_jvm_step(self) -> None:
        """A scan matching nothing would pass every other test here."""
        self.assertIn("jobs:", self.text)
        self.assertTrue(jvm_steps(self.text), "no ./gradlew checkAll step found in CI")

    def test_the_scan_finds_both_step_spellings(self) -> None:
        """Pin the scan, so it cannot quietly stop matching a form."""
        synthetic = """      - run: ./gradlew checkAll --console=plain
      - name: JVM
        run: ./gradlew checkAll -Pintegration=true
      # ./gradlew checkAll is prose only
      - run: ./gradlew buildAll"""
        self.assertEqual([1, 3, 5], [n for n, _ in gradle_steps(synthetic)])
        self.assertEqual([1, 3], [n for n, _ in jvm_steps(synthetic)])

    def test_every_jvm_step_enables_the_profile(self) -> None:
        for number, args in jvm_steps(self.text):
            with self.subTest(line=number):
                self.assertTrue(
                    flag_values(command(args)),
                    f"ci.yml line {number} runs {JVM_TASK} without "
                    f"-Pintegration, so the Postgres slice test is excluded and "
                    f"the build passes without it",
                )

    def test_no_jvm_step_disables_the_profile(self) -> None:
        """Any spelling the parser reads as off must not appear.

        The parser lowercases the value, so `=False` and `=OFF` disable it too.
        """
        disabled = disabled_flag_values(self.build)
        self.assertTrue(
            disabled, "could not read the disabled spellings from the build"
        )
        for number, args in jvm_steps(self.text):
            for value in flag_values(command(args)):
                with self.subTest(line=number, value=value):
                    self.assertNotIn(
                        value,
                        disabled,
                        f"ci.yml line {number} sets -Pintegration={value}, which "
                        f"disables the profile and excludes the slice test",
                    )


if __name__ == "__main__":
    unittest.main(verbosity=2)
