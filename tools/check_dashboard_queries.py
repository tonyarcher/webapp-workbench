#!/usr/bin/env python3
"""Run every LogsQL query in the generated dashboards against the live instance.

A provisioned dashboard with an unparseable query does not fail loudly. Grafana
renders an empty panel and moves on, so the only way to know a query works is to
run it. Every expr in every dashboard is extracted from the committed JSON and
executed; a parse error is a failure here, not a surprise in the UI.

Run: python tools/check_dashboard_queries.py
Env:  DOCKER_HOST must point at the daemon holding VictoriaLogs.
"""

from __future__ import annotations

import json
import os
import shlex
import subprocess
import sys
from pathlib import Path
from typing import Any

DASHBOARDS = (
    Path(__file__).resolve().parent.parent
    / "deploy"
    / "grafana"
    / "provisioning"
    / "dashboards"
)
URL = "http://victoria-logs:9428/select/logsql/query"


def run_query(expr: str) -> tuple[int, str]:
    """Execute one LogsQL query in a throwaway container on the compose network."""
    cmd = (
        f"export DOCKER_HOST={os.environ.get('DOCKER_HOST', '')}; "
        f"docker run --rm --network deploy_baseball curlimages/curl:latest "
        f"-sS --max-time 25 {shlex.quote(URL)} "
        f"--data-urlencode {shlex.quote('query=' + expr)} "
        f"--data-urlencode 'start=now-24h' --data-urlencode 'end=now' "
        f"--data-urlencode 'limit=5'"
    )
    proc = subprocess.run(
        ["wsl", "-d", "Ubuntu", "-e", "bash", "-c", cmd],
        capture_output=True,
        text=True,
        timeout=180,
        check=False,
    )
    out = proc.stdout.strip()
    if "cannot parse" in out or proc.returncode != 0:
        return 1, out[:200] or proc.stderr[:200]
    return 0, out


def walk(panels: list[dict[str, Any]]) -> list[tuple[str, str]]:
    found: list[tuple[str, str]] = []
    for panel in panels:
        for target in panel.get("targets", []):
            expr = target.get("expr")
            if expr:
                found.append(
                    (f"{panel.get('title', '?')} [{target.get('refId')}]", expr)
                )
    return found


def main() -> int:
    if not os.environ.get("DOCKER_HOST"):
        print("DOCKER_HOST is not set; point it at the deploy tunnel", file=sys.stderr)
        return 1

    total = 0
    bad = 0
    for path in sorted(DASHBOARDS.glob("*.json")):
        board = json.loads(path.read_text())
        print(f"=== {path.name}: {board['title']}")
        queries = walk(board.get("panels", []))
        if not queries:
            print("  (no queries)")
        for label, expr in queries:
            code, detail = run_query(expr)
            total += 1
            if code != 0:
                bad += 1
                print(f"  PARSE FAIL  {label}")
                print(f"              {expr}")
                print(f"              {detail}")
            else:
                rows = detail.count("\n") + 1 if detail else 0
                print(f"  ok ({rows} row(s))  {label}")
        print()

    print(f"{total - bad}/{total} queries parse and execute")
    if bad:
        print("RESULT: FAILED - a provisioned panel would render empty")
        return 1
    print("RESULT: every dashboard query runs against the live instance")
    return 0


if __name__ == "__main__":
    sys.exit(main())
