"""Tests for the oxlint-config validity check in verify.py.

These live in the repo rather than in a scratch script because the check guards
every other tool's configuration, and a guard with no test is a guard nobody can
tell is still working. The specific failure this exists to prevent: a scanner that
stops tracking string context and quietly treats a glob or URL as a comment, which
would report a perfectly valid .oxlintrc.json as broken.

The scanner had exactly that bug twice while it was being written. A regex reading
/* ... */ blanked the root config's own "**/node_modules/**" glob, because the
trailing */ closed a block the leading **/ never opened. Both shapes are below.

Run: python3 -m unittest discover -s tools -t . -p "*_test.py"
"""

from __future__ import annotations

import json
import pathlib
import tempfile
import unittest

from tools import verify


class StripJsoncTest(unittest.TestCase):
    """_strip_jsonc must blank comments without touching strings."""

    def stripped(self, text: str) -> str:
        """Blank one input's comments, leaving the rest byte-identical."""
        return verify._strip_jsonc(text)

    def test_line_comment_is_blanked(self) -> None:
        # A comment is blanked, not deleted, so the object still parses.
        out = self.stripped('{\n    // note\n    "a": 1\n}\n')
        self.assertEqual(json.loads(out), {"a": 1})

    def test_end_of_line_comment_is_blanked(self) -> None:
        out = self.stripped('{\n    "a": 1 // why\n}\n')
        self.assertEqual(json.loads(out), {"a": 1})

    def test_block_comment_is_blanked(self) -> None:
        out = self.stripped('{\n    /* note */\n    "a": 1\n}\n')
        self.assertEqual(json.loads(out), {"a": 1})

    def test_multi_line_block_does_not_shift_lines(self) -> None:
        # A block comment spanning lines must keep the lines below it where they
        # were, so a later parse error still points at the line holding the
        # defect. The trailing comma sits on line 4 of this fixture.
        fixture = '{\n    /* note\n       over lines */\n    "a": 1,\n}\n'
        out = self.stripped(fixture)

        # The contract, checked directly: same number of lines, and the line
        # carrying the defect is still that line. Counts alone are not enough --
        # a scanner that deleted the newline inside the comment and appended one
        # at the end would keep both the total length and the newline count while
        # sliding every line above it up by one. Comparing line 4 to the input is
        # what rules that out.
        self.assertEqual(out.count("\n"), 5)
        self.assertEqual(out.split("\n")[3], fixture.split("\n")[3])

        # Which line json names is then a decoder detail, not the check's
        # business: 3.12 anchors a trailing comma at the closing brace and 3.14
        # at the comma, so the two disagree by one line and both are correct.
        # Pinning either number made this test hold only on the interpreter that
        # wrote it. CI pins python 3.12 and ruff.toml targets py312.
        with self.assertRaises(json.JSONDecodeError) as caught:
            json.loads(out)
        self.assertIn(caught.exception.lineno, (4, 5))

    def test_glob_ending_in_star_slash_survives(self) -> None:
        # The real root .oxlintrc.json carries this glob. A regex reading /* */
        # treated the trailing */ as closing a block that **/ never opened, and
        # blanked the whole ignorePatterns list.
        out = self.stripped('{\n    "ignorePatterns": ["**/node_modules/**"]\n}\n')
        self.assertEqual(json.loads(out), {"ignorePatterns": ["**/node_modules/**"]})

    def test_glob_before_a_real_block_comment(self) -> None:
        out = self.stripped('{\n    "a": ["**/x/**"],\n    /* note */\n    "b": 1\n}\n')
        self.assertEqual(json.loads(out), {"a": ["**/x/**"], "b": 1})

    def test_url_in_a_string_survives(self) -> None:
        out = self.stripped('{\n    "a": "https://example.com/x"\n}\n')
        self.assertEqual(json.loads(out), {"a": "https://example.com/x"})

    def test_comment_markers_inside_a_string_survive(self) -> None:
        out = self.stripped(
            '{\n    "a": "// not a comment",\n    "b": "/* nor this */"\n}\n'
        )
        self.assertEqual(
            json.loads(out), {"a": "// not a comment", "b": "/* nor this */"}
        )

    def test_escaped_quote_does_not_end_the_string_early(self) -> None:
        # The case the docstring describes in prose: an escaped quote inside a
        # string must not close it, so the // after it is still string content.
        out = self.stripped('{\n    "a": "he said \\"// hi\\""\n}\n')
        self.assertEqual(json.loads(out), {"a": 'he said "// hi"'})

    def test_escaped_backslash_does_not_escape_the_closing_quote(self) -> None:
        out = self.stripped('{\n    "a": "back\\\\ // still in string"\n}\n')
        self.assertEqual(json.loads(out), {"a": "back\\ // still in string"})

    def test_unterminated_string_fails_loudly(self) -> None:
        # The safe direction: an unterminated string must not be read as a comment
        # and then quietly accepted.
        with self.assertRaises(json.JSONDecodeError):
            json.loads(self.stripped('{\n    "a": "never closed\n}\n'))

    def test_output_length_equals_input_length(self) -> None:
        # Equal length is what makes a reported column meaningful.
        for text in (
            '{\n    // note\n    "a": 1\n}\n',
            '{\n    "a": "**/node_modules/**"\n}\n',
            '{\n    /* one\n       two */\n    "a": 1\n}\n',
        ):
            with self.subTest(text=text):
                self.assertEqual(len(self.stripped(text)), len(text))

    def test_newlines_are_preserved(self) -> None:
        # A 3-line block comment sits inside a 6-line document. Neither the
        # comment's own newlines nor any below it may be removed, or every
        # reported position after it shifts.
        text = '{\n    /* one\n       two\n       three */\n    "a": 1\n}\n'
        self.assertEqual(text.count("\n"), 6)
        self.assertEqual(self.stripped(text).count("\n"), 6)

    def test_block_comment_at_end_of_file_without_newline(self) -> None:
        out = self.stripped('{\n    "a": 1\n} /* trailing */')
        self.assertEqual(json.loads(out), {"a": 1})


class LintConfigErrorsTest(unittest.TestCase):
    """The check must reject what is broken and accept what is not."""

    def call(self, text: str) -> list[tuple[str, str]]:
        """Run the check against a scratch file and return its errors.

        newline="" keeps the bytes on disk identical to the text passed in, which
        is tidy but is NOT why the assertions here are shaped the way they are.
        The original failures were blamed on this and that was wrong: the check
        reads with read_text(encoding="utf-8"), whose universal-newline handling
        returns any CRLF to \\n before json.loads sees it, and on Linux both forms
        write identical bytes. The real cause was the two decoders disagreeing on
        where a trailing-comma error is anchored, which is why the assertions
        below match a position rather than pin a line.
        """
        with tempfile.TemporaryDirectory() as tmp:
            target = pathlib.Path(tmp) / ".oxlintrc.json"
            target.write_text(text, encoding="utf-8", newline="")
            return verify.lint_config_errors(pathlib.Path(tmp), [target])

    def test_valid_config_is_accepted(self) -> None:
        self.assertEqual(self.call('{\n    "plugins": ["typescript"]\n}\n'), [])

    def test_trailing_comma_is_rejected(self) -> None:
        # Asserts the error names a line at all, not which one. The line a json
        # decoder blames for a trailing comma moved between 3.12 and 3.14, so a
        # hardcoded number tested the decoder rather than the check. What matters
        # is that the file is rejected and the message carries a position.
        errors = self.call('{\n    "plugins": ["typescript"],\n}\n')
        self.assertEqual(len(errors), 1)
        self.assertRegex(errors[0][1], r"^line \d+ column \d+:")

    def test_unclosed_brace_is_rejected(self) -> None:
        errors = self.call('{\n    "plugins": ["typescript"]\n')
        self.assertEqual(len(errors), 1)

    def test_unquoted_key_is_rejected(self) -> None:
        errors = self.call('{\n    plugins: ["typescript"]\n}\n')
        self.assertEqual(len(errors), 1)
        self.assertRegex(errors[0][1], r"^line \d+ column \d+:")

    def test_unrelated_json_is_not_checked(self) -> None:
        # tsconfig.json is not this check's business, broken or not.
        with tempfile.TemporaryDirectory() as tmp:
            other = pathlib.Path(tmp) / "tsconfig.json"
            # No newline= needed: the content holds no newline for pathlib to
            # translate, so the file is byte-identical on every platform.
            other.write_text("{ broken", encoding="utf-8")
            self.assertEqual(verify.lint_config_errors(pathlib.Path(tmp), [other]), [])

    def test_every_real_oxlint_config_in_the_repo_parses(self) -> None:
        # The regression guard for the glob bug: the repo's own configs must
        # survive the strip, or the check rejects the whole tree.
        #
        # ROOT is computed inside main() rather than exposed, so derive it the
        # same way main() does: tools/ is one level below the repo root.
        root = pathlib.Path(verify.__file__).resolve().parent.parent
        errors = verify.lint_config_errors(root, verify.collect(root))
        self.assertEqual(errors, [], f"repo configs must parse: {errors}")


if __name__ == "__main__":
    unittest.main()
