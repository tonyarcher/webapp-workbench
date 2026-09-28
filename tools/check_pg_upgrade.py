#!/usr/bin/env python3
"""Confirm the Postgres 17 -> 18 upgrade in prod.

Read-only. Verifies the server version, compares exact row counts against the
figures captured before the cutover, and checks every public route.

Run: python tools/check_pg_upgrade.py
Env:  DOCKER_HOST must point at the daemon (the deploy tunnel).
"""

from __future__ import annotations

import os
import shlex
import subprocess
import sys
import time
import urllib.error
import urllib.request

GATEWAY = "http://10.0.0.63"

# Exact totals measured before the cutover, from SELECT count(*) per table.
# pg_stat_user_tables.n_live_tup is a planner estimate and is NOT used here:
# comparing it across a long-running 17 and a fresh 18 reports phantom diffs.
EXPECTED_ROWS = {
    "rss": 158106,
    "fitness": 60884,
    "users": 81,
    "stock": 3,
    "radio": 6097,
    "gitea": 8,
}

ROUTES = [
    "/user-api/healthz",
    "/auth/",
    "/rss-reader/",
    "/fitness/",
    "/stock-game/",
    "/radio-station/",
    "/basketball/",
    "/football/",
    "/baseball/",
    "/clipstack/",
    "/calendar-sync/",
    "/lemmy-vertical-scroll/",
    "/logs/login",
    "/git/",
]

APIS = ["user-api", "rss-api", "fitness-api", "stock-game-api", "radio-api"]


def docker(*args: str, check: bool = False) -> str:
    """Run docker and return stdout. Never raises unless check is set."""
    proc = subprocess.run(
        ["docker", *args],
        capture_output=True,
        text=True,
        timeout=120,
        check=False,
    )
    if check and proc.returncode != 0:
        raise RuntimeError(f"docker {' '.join(args)} failed: {proc.stderr.strip()}")
    return proc.stdout


def superuser() -> str:
    """POSTGRES_USER is whatever compose set; there is no guaranteed 'postgres'."""
    env = docker(
        "inspect",
        "deploy-postgres-1",
        "--format",
        "{{range .Config.Env}}{{println .}}{{end}}",
    )
    for line in env.splitlines():
        if line.startswith("POSTGRES_USER="):
            return line.split("=", 1)[1]
    return "postgres"


def scalar(db: str, user: str, sql: str) -> str:
    """Run psql inside the container.

    On Windows this host, `docker exec` returns rc=0 with EMPTY stdout and
    stderr, so its output cannot be trusted: a query that really failed looks
    exactly like a query that returned nothing. WSL gets a working exec, so it
    is tried first there. Empty output raises rather than being read as a
    count, because that mistake silently reports zero rows for every table.
    """
    args = ["psql", "-U", user, "-d", db, "-t", "-A", "-c", sql]
    if sys.platform == "win32":
        quoted = " ".join(shlex.quote(a) for a in args)
        via_wsl = subprocess.run(
            [
                "wsl",
                "-d",
                "Ubuntu",
                "-e",
                "bash",
                "-c",
                (
                    f"export DOCKER_HOST={os.environ.get('DOCKER_HOST', '')}; "
                    f"docker exec deploy-postgres-1 {quoted}"
                ),
            ],
            capture_output=True,
            text=True,
            timeout=120,
            check=False,
        )
        if via_wsl.stdout.strip():
            return via_wsl.stdout.strip()
    out = docker("exec", "deploy-postgres-1", *args).strip()
    if not out:
        raise RuntimeError(
            f"psql returned nothing (db={db!r}, sql={sql!r}); docker exec is "
            "producing empty output on this host, so this is a failure, not a zero"
        )
    return out


def exact_row_total(db: str, user: str) -> int:
    """Sum real counts, one query per table. Estimates are not good enough here."""
    tables = scalar(
        db,
        user,
        "select table_name from information_schema.tables "
        "where table_schema='public' order by table_name;",
    )
    total = 0
    for table in [t for t in tables.splitlines() if t.strip()]:
        out = scalar(db, user, f'select count(*) from "{table.strip()}";')
        total += int(out) if out.isdigit() else 0
    return total


def http_status(path: str, timeout: int = 10) -> int:
    try:
        with urllib.request.urlopen(GATEWAY + path, timeout=timeout) as resp:
            return int(resp.status)
    except urllib.error.HTTPError as exc:
        return exc.code
    except (urllib.error.URLError, TimeoutError, OSError):
        return 0


def wait_for_apis(user: str, budget_s: int = 180) -> list[str]:
    """Boot is slow, so give the JVMs their time before declaring failure."""
    deadline = time.monotonic() + budget_s
    while time.monotonic() < deadline:
        if http_status("/user-api/healthz") == 200:
            break
        time.sleep(5)
    down = []
    for api in APIS:
        state = docker(
            "inspect", f"deploy-{api}-1", "--format", "{{.State.Status}}"
        ).strip()
        if state != "running":
            down.append(f"{api}={state or 'missing'}")
    return down


def main() -> int:
    if not os.environ.get("DOCKER_HOST"):
        print("DOCKER_HOST is not set; point it at the deploy tunnel", file=sys.stderr)
        return 1

    user = superuser()
    print(f"superuser: {user}")
    version = scalar("postgres", user, "show server_version;")
    print(f"server_version: {version}")

    print("\n=== exact row counts vs pre-upgrade ===")
    failures = []
    if not version.startswith("18"):
        failures.append(f"expected PostgreSQL 18, found {version}")
    for db, want in EXPECTED_ROWS.items():
        got = exact_row_total(db, user)
        ok = got == want
        if not ok:
            failures.append(f"{db}: {got} rows, expected {want}")
        print(f"  {db:<8} {got:<8} {'MATCH' if ok else '*** MISMATCH ***'}")

    down = wait_for_apis(user)
    if down:
        failures.append(f"containers not running: {', '.join(down)}")

    print("\n=== routes ===")
    for path in ROUTES:
        code = http_status(path)
        if code != 200:
            failures.append(f"{path} -> {code}")
        print(f"  {path:<26} -> {code}")

    print("\n=== boot failures ===")
    for api in APIS:
        logs = docker("logs", f"deploy-{api}-1")
        if "boot_failed" in logs:
            failures.append(f"{api} logged boot_failed")
            print(f"  {api}: boot_failed")
    print("  (nothing listed = clean)")

    print()
    if failures:
        print("RESULT: PROBLEMS FOUND")
        for f in failures:
            print(f"  - {f}")
        return 2
    print("RESULT: upgrade verified - all row counts match, all routes 200")
    return 0


if __name__ == "__main__":
    sys.exit(main())
