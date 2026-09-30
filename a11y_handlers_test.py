"""Warn about pointer handlers on elements a keyboard cannot reach.

Run: python3 -m unittest discover -s . -t . -p "*_test.py".
Only stdlib is used (pathlib, re, unittest).

A `<div @click=...>` works with a mouse and nothing else. The element is not
in the tab order, has no role, and no key handler, so a keyboard user cannot
perform the action at all. That is a WCAG 2.1.1 failure, and it is invisible
to the axe audits in apps/baseball and apps/basketball: axe's
click-events-have-key-events rule reads the `onclick` property, while a Lit
`@click` binding compiles to addEventListener, so the audit is blind to every
handler written the Lit way.

This warns rather than fails, for the reason code_hygiene_test.py gives. A
hard failure over a standing backlog pushes the backlog into an allowlist,
which is the same rot in a different costume. The list below is the deliverable:
each entry is a real finding to fix by using a <button> or <a>, or by giving
the element a role, a tabindex and a keydown path.

ast-grep would be the better tool and is already in the tool table, but the
markup sits inside a template string, so there is no AST node to attach a rule
to. Revisit this if that changes.
"""

from __future__ import annotations

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent

# Directories pruned from the walk. Mirrors code_hygiene_test.py.
SKIP_DIRS = frozenset(
    {".git", "build", "coverage", "dist", "node_modules", "out", "target"}
)

# Fixtures, not components. Verified rather than assumed: the skipped trees
# (the e2e specs, each app's scripts/, packages/web-components/test) hold no
# @click or @pointerdown at all, and only one of them mentions a Lit template,
# so nothing that could carry a finding is excluded.
SKIP_PARTS = frozenset({"e2e", "scripts", "stories", "test", "tests", "__tests__"})

# Roots that hold component source.
SOURCE_ROOTS = ("apps", "packages")

# A pointer handler on an element that carries no semantics of its own. Native
# controls are absent on purpose: a <button> or <a> is already reachable.
STATIC_ELEMENT = r"(?:div|span|li|tr|td|th|section|p)"
ELEMENT_START = re.compile(rf"<{STATIC_ELEMENT}\b", re.IGNORECASE)
POINTER_HANDLER = re.compile(r"@(?:click|pointerdown)\s*=", re.IGNORECASE)
# Focusability escape hatches, in either attribute order.
HAS_SEMANTICS = re.compile(r"\b(?:role|tabindex)\s*=", re.IGNORECASE)

# Floors for the anti-vacuity test. A guard that scans nothing, or that
# matches nothing, looks identical to a clean result.
MIN_FILES = 40
MAX_BYTES = 2_000_000

# How far into a file a tag's close may be sought. An opening tag longer than
# this is malformed, and bounding the search keeps one bad row from making the
# scan quadratic.
MAX_TAG_LENGTH = 4_000


def source_files() -> list[tuple[Path, str]]:
    """(path, text) for every non-test component source file."""
    out: list[tuple[Path, str]] = []
    for root_name in SOURCE_ROOTS:
        root = ROOT / root_name
        if not root.is_dir():
            continue
        for path in root.rglob("*.ts"):
            parts = path.relative_to(ROOT).parts
            if SKIP_DIRS & set(parts) or SKIP_PARTS & set(parts):
                continue
            if path.name.endswith(".d.ts") or ".test." in path.name:
                continue
            out.append((path, path.read_text(encoding="utf-8", errors="replace")))
    return out


def is_reachable(tag: str) -> bool:
    """True when the opening tag names a role or takes focus."""
    return HAS_SEMANTICS.search(tag) is not None


# An intentional case states why next to the handler, in whichever comment
# syntax reaches it: a `//` line in the script, or an HTML comment inside a Lit
# template, which is the only comment syntax that survives into the markup.
# This turns a backlog of unexplained findings into a list of documented
# decisions, which is the only way a warning stays worth reading. The reason is
# required: a bare marker is not a reason, so "pointer-only:" alone does not
# suppress.
SUPPRESSED = re.compile(r"pointer-only\s*:\s*\S*[A-Za-z]{3}", re.IGNORECASE)

# Lines that continue a comment block above a match, so a three-line
# explanation is seen the same as a one-line one. Only the two documented
# annotation syntaxes count. A JSDoc " * " line is deliberately excluded: JSDoc
# is habitually written above a template section and would silence whatever
# handler follows it, which is not what the convention says it means.
COMMENT_LINE = re.compile(r"^\s*(?://|<!--|-->)")


def tag_end(text: str, start: int) -> int:
    """Index just past the ">" that closes the tag opening at start.

    Two things can hide a ">" that is not the close, and both must be tracked or
    a real handler goes unreported, which is the one failure this check must not
    have:

      - it can sit inside a binding, "${...}", so brace depth is tracked and a
        ">" only closes at depth zero;
      - it can sit inside a quoted attribute value, as in title="a > b", so the
        quote state is tracked too.

    Regexes cannot express either, and every form tried failed one way or the
    other: a plain [^>]* and a comparator that only admits "=>" both stop at a
    comparison inside a binding, and a negated form admits every ">" and runs the
    match across unrelated elements.

    Returns -1 when no close is found, because a caller that treats an
    unbounded extent as a tag would search the rest of the file for role= and
    suppress a real finding.
    """
    depth = 0
    quote = ""
    index = start + 1
    limit = min(len(text), start + MAX_TAG_LENGTH)
    while index < limit:
        char = text[index]
        if quote:
            if char == "\\":
                index += 2
                continue
            if char == quote:
                quote = ""
        elif char in "\"'":
            quote = char
        elif char == "{":
            depth += 1
        elif char == "}":
            depth = max(0, depth - 1)
        elif char == ">" and depth == 0:
            return index + 1
        index += 1
    return -1


def is_suppressed(text: str, index: int) -> bool:
    """True when the handler's line, or the comment around it, explains why.

    Handles both comment syntaxes. Inside a Lit template the only thing that
    reaches the markup is an HTML comment, which may span several lines and
    whose continuation lines do not start with a delimiter, so an open
    `<!--` is located first and searched as a unit. In script code the walk
    stops at the first line that is not a comment, so an explanation for one
    handler cannot silence a different handler further up the same template.
    """
    start = text.rfind("\n", 0, index) + 1
    end = text.find("\n", index)
    if end < 0:
        end = len(text)
    if SUPPRESSED.search(text[start:end]):
        return True

    before = text[:start]
    # An HTML comment adjacent to the handler, whether it is still open or was
    # closed on the line above. The block may wrap, and its continuation lines
    # carry no delimiter, so the opener is located and the block searched whole.
    tail = before.rstrip()
    if tail.endswith(("-->", "<!--")):
        open_at = before.rfind("<!--")
        if open_at >= 0:
            return SUPPRESSED.search(before[open_at:]) is not None

    # In script code, walk back over adjacent comment lines only.
    prev_end = before.rfind("\n")
    while prev_end > 0:
        prev_start = before.rfind("\n", 0, prev_end) + 1
        if prev_start >= prev_end:
            break
        line = before[prev_start:prev_end]
        if not COMMENT_LINE.match(line):
            break
        if SUPPRESSED.search(line):
            return True
        prev_end = before.rfind("\n", 0, prev_start)
    return False


def findings(files: list[tuple[Path, str]]) -> list[str]:
    """One line per pointer handler on a static element with no role."""
    hits: list[str] = []
    for path, text in files:
        for start in ELEMENT_START.finditer(text):
            end = tag_end(text, start.start())
            if end < 0:
                # No close was found, so the tag's extent is unknown. Report the
                # line rather than skipping it, and skip the reachability test
                # rather than guess: an unknown extent must not be read as
                # "reachable" just because a role= appears later in the file.
                line_end = text.find("\n", start.start())
                tag = text[start.start() : line_end if line_end > 0 else None]
                bounded = False
            else:
                tag = text[start.start() : end]
                bounded = True
            if bounded and not POINTER_HANDLER.search(tag):
                continue
            if bounded and is_reachable(tag):
                continue
            if is_suppressed(text, start.start()):
                continue
            line = text.count("\n", 0, start.start()) + 1
            rel = path.relative_to(ROOT).as_posix()
            snippet = " ".join(tag.split())[:100]
            hits.append(f"{rel}:{line}: {snippet}")
    return hits


class PointerHandlerReachabilityTest(unittest.TestCase):
    def test_pointer_handlers_are_reachable(self) -> None:
        """Warn on a click or pointerdown on an element a keyboard cannot reach.

        A div, span, li, tr, td, th, section or p with a pointer handler and
        no role and no tabindex. Fix it by using a button or anchor, or by
        giving the element a role, a tabindex and a keydown path.
        """
        files = source_files()
        hits = findings(files)
        if hits:
            print("\n" + "=" * 78)
            print(
                f"WARNING: {len(hits)} pointer handlers on keyboard-unreachable"
                " elements:"
            )
            print(
                "A div, span, li, tr, td, th, section or p with @click or"
                " @pointerdown is"
            )
            print(
                "not in the tab order and has no key path. Use a <button> or <a>, or"
                " add"
            )
            print("role, tabindex and a keydown handler. role and tabindex are")
            print("necessary but not sufficient: the key path is the actual fix.")
            print("This warns rather than fails, so the backlog stays visible.")
            for hit in hits:
                # The snippet can carry any character the source had, and a
                # Windows console defaults to cp1252, which cannot encode a
                # symbol or an emoji. A crash here would fail the suite on the
                # very file it is reporting.
                safe = hit.encode("ascii", "replace").decode("ascii")
                print(f"  {safe}")
            print("=" * 78 + "\n")
        # Warn only, per the convention in code_hygiene_test.py. The list above
        # is the deliverable; the count is not a gate.
        self.assertTrue(True, "reachability warning emitted; see the list above")

    def test_scan_is_not_vacuous(self) -> None:
        """Pin the scan and the pattern, so a green light cannot mean nothing.

        Three ways this could rot into a pass that means nothing: the source
        roots move, a rename drops the tree, or the pattern is edited until it
        matches nothing. Each is pinned here, on the pattern itself rather than
        on the live tree, so the check stays honest when the backlog empties.
        """
        files = source_files()
        self.assertGreaterEqual(
            len(files), MIN_FILES, f"only {len(files)} component files scanned"
        )
        self.assertLess(
            sum(len(text.encode("utf-8", "replace")) for _, text in files),
            MAX_BYTES,
            "scanned set grew unexpectedly; check the walk is still pruned",
        )

        # Whether a given source snippet is reported, at all. Every case below
        # is expressed through this, so the tests exercise the same path the
        # real scan uses rather than a parallel one.
        def flagged(sample: str) -> bool:
            return bool(findings([(ROOT / "sample.ts", sample)]))

        # Matches the case it must catch.
        zone = '<div class="zone" @click=${() => this.pick()}>x</div>'
        self.assertTrue(flagged(zone))
        self.assertFalse(is_reachable(zone))

        # Excluded: native controls, and semantics in either attribute order.
        for ok in (
            "<button @click=${x}>go</button>",
            "<a href=${u} @click=${x}>go</a>",
            '<div role="button" tabindex="0" @click=${x}>go</div>',
            '<div @click=${x} tabindex="0">go</div>',
        ):
            with self.subTest(tag=ok[:28]):
                self.assertFalse(flagged(ok), f"should not be reported: {ok}")

        # A handler on something that is not an element at all is out of scope.
        self.assertEqual(ELEMENT_START.findall("el.addEventListener('click')"), [])

        # A ">" inside a binding before the handler must not hide it. This is
        # the miss that made "not listed" mean "not checked", and it took two
        # attempts to close: a regex cannot tell a tag's own ">" from one inside
        # "${...}", because the only difference is the brace depth around it.
        # The comparison form is the one that survives naive fixes, and it is
        # live in the rss source list at source-list-render.ts:92.
        compare_before = (
            "<div class=${feed.unread > 0 ? 'has-unread' : ''} data-id=${feed.id}"
            " @click=${() => onSelect(feed)}>"
        )
        self.assertTrue(flagged(compare_before))
        self.assertFalse(
            flagged(
                "<div class=${feed.unread > 0 ? 'has-unread' : ''}"
                ' role="button" tabindex="0" @click=${() => onSelect(feed)}>'
            ),
            "the role after a comparison binding must still be seen",
        )
        # The arrow form, which the first fix handled and the second regressed.
        arrow_before = (
            "<li @dragstart=${(e: DragEvent) => go(e)} @click=${() => pick()}>"
        )
        self.assertTrue(flagged(arrow_before))
        self.assertFalse(
            flagged(
                "<li @dragstart=${(e: DragEvent) => go(e)} @click=${() => pick()}"
                ' role="button" tabindex="0">'
            )
        )
        # Nested braces inside a binding, which a one-level regex would miss.
        self.assertTrue(
            flagged("<li @click=${items.map((x) => ({ id: x.id }))}>go</li>")
        )
        # role= after the handler is the false-positive direction.
        self.assertFalse(flagged('<li @click=${() => pick()} role="button">'))
        self.assertFalse(flagged('<li @click=${() => pick()} tabindex="0">'))
        # The extent stops at a real tag close and not inside a binding. In
        # "<li @click=${() => a > b}>z</li>" the ">" of "a > b" is at 21, inside
        # the binding, and the tag's own ">" is at 25, so the extent is 26.
        self.assertEqual(tag_end("<a href=${u}>x</a>", 0), 13)
        self.assertEqual(tag_end("<li @click=${() => pick()}>z</li>", 0), 27)
        self.assertEqual(tag_end("<li @click=${() => a > b}>z</li>", 0), 26)
        # And it never runs past one element into the next, which is what a
        # match spanning two tags would look like.
        two = '<div class="a">t</div><button @click=${x}>go</button>'
        self.assertEqual(findings([(ROOT / "s.ts", two)]), [])
        # A ">" inside a quoted attribute value is not the close either. It
        # sits before the handler here, so treating it as the close would drop
        # the row entirely rather than merely over-report it.
        self.assertTrue(flagged('<div title="a > b" @click=${x}>go</div>'))
        self.assertFalse(flagged('<div title="a > b" role="button" @click=${x}>'))
        # An unterminated tag has an unknown extent, so it is reported and the
        # reachability test is skipped rather than guessed from the file's tail.
        self.assertTrue(flagged('<div class="a" @click=${x}\n<p>later</p>\n'))
        self.assertTrue(flagged('<div class="a" @click=${x} role="button"'))

        # The suppression must work, and must not work by accident. An empty
        # reason is not a reason, so a bare marker does not suppress.
        at = '<div class="backdrop" @click=${x}>'

        # Same line, and the line above, in script comment syntax.
        self.assertTrue(flagged(f"    {at}\n"))
        self.assertFalse(flagged(f"    {at} // pointer-only: why\n"))
        self.assertFalse(flagged("    // pointer-only: why\n" + f"    {at}\n"))
        # A multi-line script comment, which is how a reason gets explained.
        self.assertFalse(
            flagged(
                "    // pointer-only: why this is fine,\n    // and more.\n"
                + f"    {at}\n"
            )
        )
        # HTML comment syntax, the only kind that survives into a Lit template,
        # both on one line and wrapped across lines.
        self.assertFalse(flagged("    <!-- pointer-only: why -->\n" + f"    {at}\n"))
        self.assertFalse(
            flagged(
                "    <!-- pointer-only: why\n         and more -->\n" + f"    {at}\n"
            )
        )
        # An empty reason is not a reason, in either syntax.
        self.assertTrue(flagged("    // pointer-only:\n" + f"    {at}\n"))
        self.assertTrue(flagged("    <!-- pointer-only: -->\n" + f"    {at}\n"))
        # A closed HTML comment directly above an element is that element's
        # documentation, so it counts. What must not count is an explanation
        # separated from the handler by intervening code: adjacency is the rule,
        # and distance is what the walk-back enforces.
        self.assertTrue(
            flagged(
                "    // pointer-only: about an earlier handler\n"
                "    const x = compute();\n" + f"    {at}\n"
            )
        )
        # JSDoc is not one of the two annotation syntaxes. A "* " continuation
        # line used to count, so a block written out of habit above a template
        # section would silence whatever handler followed it.
        self.assertTrue(
            flagged(
                "    /**\n     * pointer-only: about something else\n     */\n"
                + f"    {at}\n"
            )
        )


if __name__ == "__main__":
    unittest.main()
