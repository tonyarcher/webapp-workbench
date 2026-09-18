"""Unit tests for pool.py. Run: python3 -m unittest discover -s scripts -t . -p "*_test.py"."""

from __future__ import annotations

import os
import threading
import time
import unittest
from collections.abc import Callable

from scripts.pool import pool_size, run_pool


class PoolSizeTest(unittest.TestCase):
    def with_jobs(self, value: str | None, fn: Callable[[], None]) -> None:
        prev = os.environ.get("JOBS")
        try:
            if value is None:
                os.environ.pop("JOBS", None)
            else:
                os.environ["JOBS"] = value
            fn()
        finally:
            if prev is None:
                os.environ.pop("JOBS", None)
            else:
                os.environ["JOBS"] = prev

    def test_honors_jobs_and_defaults_sanely(self) -> None:
        seen: dict[str, int] = {}

        def capture_default() -> None:
            seen["def"] = pool_size()

        self.with_jobs(None, capture_default)
        default = seen["def"]
        self.assertIsInstance(default, int)
        self.assertGreaterEqual(default, 1)
        self.with_jobs("3", lambda: self.assertEqual(pool_size(), 3))
        self.with_jobs("0", lambda: self.assertEqual(pool_size(), default))
        self.with_jobs("2x", lambda: self.assertEqual(pool_size(), default))
        self.with_jobs(" 4 ", lambda: self.assertEqual(pool_size(), 4))


class RunPoolTest(unittest.TestCase):
    def test_runs_everything_within_limit(self) -> None:
        os.environ["JOBS"] = "2"
        try:
            live = 0
            peak = 0
            seen: list[int] = []
            lock = threading.Lock()

            def run(n: int) -> None:
                nonlocal live, peak
                with lock:
                    live += 1
                    peak = max(peak, live)
                time.sleep(0.005)
                with lock:
                    live -= 1
                    seen.append(n)

            failed = run_pool([1, 2, 3, 4, 5], run)
            self.assertEqual(failed, [])
            self.assertEqual(sorted(seen), [1, 2, 3, 4, 5])
            self.assertEqual(peak, 2)
        finally:
            os.environ.pop("JOBS", None)

    def test_collects_failures_and_keeps_going(self) -> None:
        os.environ["JOBS"] = "1"
        try:
            seen: list[str] = []

            def run(item: str) -> None:
                seen.append(item)
                if item == "b":
                    raise RuntimeError("boom")

            failed = run_pool(["a", "b", "c"], run)
            self.assertEqual(seen, ["a", "b", "c"])
            self.assertEqual(len(failed), 1)
            self.assertEqual(failed[0][0], "b")
            self.assertRegex(str(failed[0][1]), "boom")
        finally:
            os.environ.pop("JOBS", None)

    def test_empty_list(self) -> None:
        def never(item: object) -> None:
            raise AssertionError("must not run")

        self.assertEqual(run_pool([], never), [])


if __name__ == "__main__":
    unittest.main()
