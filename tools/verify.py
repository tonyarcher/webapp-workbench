#!/usr/bin/env python3
"""Verify entry point: run every formatter and linter in check mode.

Run: `python3 tools/verify.py [--fix] [--strict]` (usually
`python tools/verify.py` on Windows). Covers every format this repo owns: web
(prettier), Python (ruff,
mypy), Kotlin (ktlint), shell (shfmt, shellcheck), SQL (sqlfluff), Dockerfile
(hadolint), TOML (taplo) and PowerShell (PSScriptAnalyzer). `--fix` applies
the formatters instead of checking. `--strict` treats a missing tool as a
failure rather than a skip.

Only stdlib is used (subprocess, sys, pathlib, shutil).
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

HELP = """Run every formatter and linter in check mode.

Usage:
  python tools/verify.py [--fix] [--strict]

Also:
  python tools/verify.py --fix     apply the formatters instead of checking
  python tools/verify.py --strict  a missing tool is a failure, not a skip

Tools: prettier, tsc (via npm), ruff, mypy, ktlint, shfmt, shellcheck,
sqlfluff, hadolint, taplo, pwsh (PSScriptAnalyzer). Installed by the
ops-scripts installers.
""".strip()

# Generated and vendored trees. Anything with one of these path parts is
# skipped, so build/ output never gets linted as if it were source.
SKIP_DIRS = frozenset(
    {
        ".git",
        ".gradle",
        ".kotlin",
        ".mypy_cache",
        ".ruff_cache",
        "__pycache__",
        "build",
        "coverage",
        "dist",
        "node_modules",
        "playwright-report",
        "test-results",
    }
)

# Rough ceiling on one command line. A .bat/.cmd shim routes through cmd.exe,
# which caps near 8k characters, so paths are packed by length not by count.
BUDGET = 5000

TOML = (".toml",)
PYTHON = (".py", ".pyi")
KOTLIN = (".kt", ".kts")
SHELL = (".sh", ".bash")
SQL = (".sql",)
YAML = (".yml", ".yaml")
POWERSHELL = (".ps1", ".psm1")
# Config files that allow // comments, so they are JSONC rather than JSON and
# json.loads rejects them. Named explicitly because the extension is .json.
JSONC = (".oxlintrc.json", ".oxlintrc.jsonc")
SOURCE_SUFFIXES = frozenset(
    {".kt", ".kts", ".ts", ".tsx", ".js", ".mjs", ".cjs", ".py", ".pyi", ".sh", ".bash"}
)

Check = tuple[str, str, list[str]]

# Config files carrying the repo's lint rules. Nothing else validated these:
# prettier does not format .oxlintrc.json, and oxlint only reads a config when
# some app happens to run its own lint. A malformed one therefore passed every
# gate here and then failed confusingly, inside an unrelated app's lint run.
#
# This happened for real: a trailing comma left in apps/baseball/.oxlintrc.json
# survived `verify.py --strict` reporting 0 failed.
LINT_CONFIGS = (".oxlintrc.json",)

# Shared file-length budget. Only oxlint (`max-lines`) and detekt
# (`LargeClass`) can express it natively; ruff and ktlint cannot, so this
# check covers every source file regardless of language.
MAX_FILE_LINES = 500


def collect(root: Path) -> list[Path]:
    """Every file in the repo minus generated and vendored trees."""
    kept: list[Path] = []
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if set(path.relative_to(root).parts) & SKIP_DIRS:
            continue
        kept.append(path)
    return kept


def by_suffix(files: list[Path], suffixes: tuple[str, ...]) -> list[str]:
    """Absolute paths of the files carrying one of the given suffixes."""
    return [str(path) for path in files if path.suffix.lower() in suffixes]


def named(files: list[Path], names: tuple[str, ...]) -> list[str]:
    """Absolute paths of the files whose base name is one of the given names."""
    return [str(path) for path in files if path.name in names]


def quote(path: str) -> str:
    """Single-quote a path for an inline PowerShell string literal."""
    return "'" + path.replace("'", "''") + "'"


def analyzer_argv(paths: list[str], settings: str | None) -> list[str]:
    """One pwsh invocation that analyses every PowerShell file at once."""
    listed = ", ".join(quote(path) for path in paths)
    extra = " -Settings " + quote(settings) if settings else ""
    call = " | ForEach-Object { Invoke-ScriptAnalyzer -Path $_" + extra + " }); "
    scan = "$r = @(" + listed + call
    report = (
        "$r | Format-Table RuleName,Severity,ScriptName,Line -AutoSize | Out-String "
    )
    script = scan + report + "| Write-Host; if ($r.Count -gt 0) { exit 1 }; exit 0"
    return ["pwsh", "-NoProfile", "-Command", script]


def analyzer_settings(root: Path) -> str | None:
    """The repo's PSScriptAnalyzer settings file, when it has one."""
    for candidate in (
        root / "PSScriptAnalyzerSettings.psd1",
        root / "windows" / "PSScriptAnalyzerSettings.psd1",
    ):
        if candidate.exists():
            return str(candidate)
    return None


def overlong(files: list[Path], limit: int = MAX_FILE_LINES) -> list[tuple[str, int]]:
    """Source files over the shared length budget, longest first.

    Counts non-blank lines so the number matches oxlint `max-lines` with
    `skipBlankLines: true`; two checkers must not report different counts.
    """
    tall = [
        (
            str(path),
            sum(
                1
                for line in path.open(encoding="utf-8", errors="replace")
                if line.strip()
            ),
        )
        for path in files
        if path.suffix.lower() in SOURCE_SUFFIXES
    ]
    return sorted((x for x in tall if x[1] > limit), key=lambda x: -x[1])


def multi(label: str, tool: str, head: list[str], paths: list[str]) -> list[Check]:
    """One check per batch of paths, so no single command line overflows."""
    if not paths:
        return []
    fixed = sum(len(part) for part in head)
    groups: list[list[str]] = []
    current: list[str] = []
    used = fixed
    for path in paths:
        if current and used + len(path) > BUDGET:
            groups.append(current)
            current = []
            used = fixed
        current.append(path)
        used += len(path) + 1
    if current:
        groups.append(current)
    total = len(groups)
    return [
        (label if total == 1 else f"{label}[{index}]", tool, [*head, *group])
        for index, group in enumerate(groups, start=1)
    ]


def _strip_jsonc(text: str) -> str:
    """Blank out JSONC comments, keeping every line and column where it was.

    Both comment forms are handled: `/* ... */` blocks, which may span lines, and
    `//` to end of line. A later parse error therefore still points at the line
    and column the author sees in their editor, which is why comment characters
    are replaced by equal-length whitespace rather than removed, and why that
    whitespace keeps any newlines inside it.

    This scans the text rather than running two regexes, because a regex cannot
    tell a comment marker from the same characters inside a JSON string, and
    here that is not hypothetical. The root .oxlintrc.json carries the glob
    "**/node_modules/**", and a naive block-comment regex reads its trailing `*/`
    as closing a block that the leading `**/` never opened, blanking the whole
    ignorePatterns list and turning a valid config into a parse error. Tracking
    whether the scan is inside a string is what keeps that file readable, and it
    also removes the earlier caveat about `//` inside strings for free.

    Backslash escapes are honoured while inside a string, so a string holding an
    escaped quote does not end early and turn the rest of the line into a
    comment. Stated in prose rather than with a literal example on purpose: a
    backslash inside a docstring needs doubling, and getting that count wrong
    silently changes what the example claims.
    """
    out: list[str] = []
    index = 0
    length = len(text)
    in_string = False
    escaped = False

    while index < length:
        char = text[index]
        nxt = text[index + 1] if index + 1 < length else ""

        if in_string:
            out.append(char)
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            index += 1
            continue

        if char == '"':
            in_string = True
            out.append(char)
            index += 1
            continue

        if char == "/" and nxt == "/":
            while index < length and text[index] != "\n":
                out.append(" ")
                index += 1
            continue

        if char == "/" and nxt == "*":
            while index < length:
                if text[index] == "*" and index + 1 < length and text[index + 1] == "/":
                    out.append("  ")
                    index += 2
                    break
                out.append("\n" if text[index] == "\n" else " ")
                index += 1
            continue

        out.append(char)
        index += 1

    return "".join(out)


def lint_config_errors(root: Path, files: list[Path]) -> list[tuple[str, str]]:
    """Parse every oxlint config and report the ones that are not valid.

    Nothing else validated these. Prettier does not format .oxlintrc.json, and
    oxlint only reads a config when some app happens to run its own lint, so a
    malformed one passed every other gate here and then failed confusingly much
    later, inside an unrelated app's lint run. That happened for real: a trailing
    comma in apps/baseball/.oxlintrc.json survived `verify.py --strict`
    reporting 0 failed.

    These files are JSONC, not JSON. The repo's own carry `//` comments saying
    why a rule is off, which json.loads rejects outright, so comments are removed
    before parsing rather than reaching for a permissive parser.

    Comments are replaced with equivalent blank space rather than deleted, so a
    parse error still reports the line and column the author sees in their editor.
    See _strip_jsonc, which does the stripping; it tracks string context, so a
    config may hold a URL or a glob containing "//" or "*/" without either being
    read as a comment.
    """
    errors: list[tuple[str, str]] = []
    for path in files:
        if path.name not in LINT_CONFIGS:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except OSError as exc:  # unreadable is a failure, not a skip
            errors.append((str(path.relative_to(root)), str(exc)))
            continue
        stripped = _strip_jsonc(text)
        try:
            json.loads(stripped)
        except json.JSONDecodeError as exc:
            errors.append(
                (
                    str(path.relative_to(root)),
                    f"line {exc.lineno} column {exc.colno}: {exc.msg}",
                )
            )
    return errors


def specs(root: Path, files: list[Path], fix: bool) -> list[Check]:
    """Label, executable and argv for each check, in run order."""
    config = str(root / ".sqlfluff")
    flag = ["-F"] if fix else []
    edit = ["-w"] if fix else ["-d"]
    entries: list[Check] = [
        ("prettier", "prettier", ["prettier", "--write" if fix else "--check", "."]),
        # tsc, because the bundler strips types instead of checking them, so a
        # type error in TypeScript can pass prettier, the unit tests and the
        # build. It has no fix mode, so it reports in both.
        ("tsc", "npm", ["npm", "run", "typecheck"]),
        ("ruff-check", "ruff", ["ruff", "check", *(["--fix"] if fix else []), "."]),
        ("ruff-format", "ruff", ["ruff", "format", *([] if fix else ["--check"]), "."]),
    ]
    entries += multi("mypy", "mypy", ["mypy", "--strict"], by_suffix(files, PYTHON))
    entries += multi("ktlint", "ktlint", ["ktlint", *flag], by_suffix(files, KOTLIN))
    entries += multi("shfmt", "shfmt", ["shfmt", *edit], by_suffix(files, SHELL))
    entries += multi(
        "shellcheck", "shellcheck", ["shellcheck"], by_suffix(files, SHELL)
    )
    entries += multi(
        "hadolint", "hadolint", ["hadolint"], named(files, ("Dockerfile",))
    )
    entries += multi("yamllint", "yamllint", ["yamllint"], by_suffix(files, YAML))
    if fix:
        entries += multi("taplo", "taplo", ["taplo", "fmt"], by_suffix(files, TOML))
        head = ["sqlfluff", "fix", "--config", config]
        entries += multi("sqlfluff", "sqlfluff", head, by_suffix(files, SQL))
    else:
        entries += multi(
            "taplo", "taplo", ["taplo", "fmt", "--check"], by_suffix(files, TOML)
        )
        head = ["sqlfluff", "lint", "--config", config]
        entries += multi("sqlfluff", "sqlfluff", head, by_suffix(files, SQL))
    # Check-only tools run in both modes: --fix applies formatters but still
    # reports what it cannot fix, instead of exiting 0 unchecked.
    powershell = by_suffix(files, POWERSHELL)
    if powershell:
        entries.append(
            (
                "psscriptanalyzer",
                "pwsh",
                analyzer_argv(powershell, analyzer_settings(root)),
            )
        )
    return entries


def execute(argv: list[str], root: Path) -> tuple[int, str]:
    """Run one tool and report its exit code plus trimmed output.

    argv[0] is a bare name; CreateProcess does not apply PATHEXT the way
    shutil.which does, so the .cmd/.bat shim has to be passed explicitly.
    """
    resolved = shutil.which(argv[0]) or argv[0]
    result = subprocess.run(
        [resolved, *argv[1:]],
        cwd=root,
        check=False,
        capture_output=True,
        text=True,
    )
    return result.returncode, (result.stdout + result.stderr).strip()


def main(argv: list[str]) -> int:
    """Run every check and summarise pass, fail and skip."""
    if any(arg in ("-h", "--help") for arg in argv):
        print(HELP)
        return 0
    fix = "--fix" in argv
    strict = "--strict" in argv
    root = Path(__file__).resolve().parent.parent
    missing: list[str] = []
    failed: list[str] = []
    sources = collect(root)
    long = overlong(sources)
    if long:
        print(f"FAIL max-lines (over {MAX_FILE_LINES} lines)")
        failed.append("max-lines")
        for path, lines in long:
            print(f"  {lines:5d}  {path}")
    else:
        print(f"PASS max-lines (nothing over {MAX_FILE_LINES} lines)")
    broken = lint_config_errors(root, sources)
    if broken:
        print("FAIL oxlint-config")
        failed.append("oxlint-config")
        for path, message in broken:
            print(f"  {path}: {message}")
    else:
        print("PASS oxlint-config")
    for label, tool, command in specs(root, sources, fix):
        if shutil.which(tool) is None:
            print(f"SKIP {label} ({tool} not on PATH)")
            missing.append(label)
            continue
        code, output = execute(command, root)
        if code == 0:
            print(f"PASS {label}")
            continue
        print(f"FAIL {label}")
        failed.append(label)
        if output:
            print(output)
    print(f"\n{len(failed)} failed, {len(missing)} skipped")
    if missing:
        print("skipped (install via ops-scripts): " + ", ".join(missing))
    if failed:
        return 1
    return 1 if (strict and missing) else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
