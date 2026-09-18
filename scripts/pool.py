"""Bounded-parallel task pool for spawning child processes across CPUs.

Run: imported by build.py and deploy.py (no CLI).
Only stdlib is used (concurrent.futures, os).
"""

from __future__ import annotations

import os
import re
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from queue import Empty, Queue
from typing import Any, TypeVar

T = TypeVar("T")


def pool_size() -> int:
    """Worker count: $JOBS when it is a positive integer, else CPU count."""
    raw = (os.environ.get("JOBS") or "").strip()
    if re.fullmatch(r"[1-9]\d*", raw):
        return int(raw)
    affinity = getattr(os, "process_cpu_count", None)
    if callable(affinity):
        try:
            count = affinity()
        except OSError:
            pass
        else:
            if isinstance(count, int) and count >= 1:
                return count
    cpus = os.cpu_count() or 4
    return max(1, cpus)


def run_pool(items: list[T], run: Callable[[T], Any]) -> list[tuple[T, BaseException]]:
    """Run every item, at most pool_size() at once. Returns [(item, error)]."""
    pending: Queue[T] = Queue()
    for item in items:
        pending.put(item)
    failed: list[tuple[T, BaseException]] = []
    if pending.empty():
        return failed

    def worker() -> None:
        while True:
            try:
                item = pending.get_nowait()
            except Empty:
                return
            try:
                run(item)
            except Exception as error:  # noqa: BLE001 - collected, like a rejected Promise
                failed.append((item, error))

    workers = min(pool_size(), pending.qsize())
    with ThreadPoolExecutor(max_workers=workers) as pool:
        for _ in range(workers):
            pool.submit(worker)
    return failed
