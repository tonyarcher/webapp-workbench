#!/usr/bin/env python3
"""Confirm the Postgres 17 -> 18 upgrade in prod.

Read-only. Verifies the server version, checks that no table has lost rows
against a recorded snapshot, and checks every public route.

The row check asserts no LOSS, not equality. Equality held at the instant of the
cutover and is false forever after, because the apps keep writing: sessions,
refresh tokens and rate-limit buckets all grow when someone signs in. Treating
that growth as a failure reported a healthy database as broken.

It compares PER TABLE, not per database. A database total is a weak invariant:
a table that loses rows while another gains the same number sums to no change,
so a total-only floor would call that healthy. Equality would have caught it,
which is why the comparison is per table rather than merely relaxed.

Run: python tools/check_pg_upgrade.py
      python tools/check_pg_upgrade.py --write-snapshot [--force]
Env:  DOCKER_HOST must point at the daemon (the deploy tunnel).
"""

from __future__ import annotations

import json
import os
import shlex
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import UTC, datetime
from pathlib import Path

GATEWAY = "http://10.0.0.63"

# Per-table row counts, recorded from a database that was itself verified
# against a pg_dumpall restore. Regenerate with --write-snapshot only after
# confirming the live data is good, because whatever is written becomes the
# floor that stops being questioned.
SNAPSHOT = Path(__file__).with_name("pg_row_snapshot.json")

# Every application database. Discovered rather than listed so a new service
# cannot be added to the compose stack and quietly left out of the row check.
DATABASES_SQL = (
    "select datname from pg_database where datistemplate = false "
    "and datname not in ('postgres','template0','template1') order by datname;"
)

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


def exact_row_counts(db: str, user: str) -> dict[str, int]:
    """Real counts keyed by table. Estimates are not good enough here.

    pg_stat_user_tables.n_live_tup is a planner estimate and is NOT used:
    comparing it across a long-running 17 and a fresh 18 reports phantom diffs.
    """
    tables = scalar(
        db,
        user,
        "select table_name from information_schema.tables "
        "where table_schema='public' order by table_name;",
    )
    counts: dict[str, int] = {}
    for table in [t for t in tables.splitlines() if t.strip()]:
        name = table.strip().strip('"')
        out = scalar(db, user, f'select count(*) from "{table.strip()}";')
        if out.isdigit():
            counts[name] = int(out)
    return counts


def _root() -> dict[str, object]:
    """The snapshot file parsed, or an empty mapping when it is absent.

    The root is heterogeneous -- provenance is strings, counts is a mapping of
    mappings -- so it cannot be typed as one value type. Narrowing here keeps the
    accessors honest without a cast.
    """
    if not SNAPSHOT.exists():
        return {}
    parsed: object = json.loads(SNAPSHOT.read_text())
    return parsed if isinstance(parsed, dict) else {}


def load_snapshot() -> dict[str, dict[str, int]]:
    """Per-table counts by database, or an empty map when none is recorded."""
    counts = _root().get("counts")
    if not isinstance(counts, dict):
        return {}
    return {db: t for db, t in counts.items() if isinstance(t, dict)}


def snapshot_provenance() -> dict[str, str]:
    """When the floor was recorded and from what, so it can be judged."""
    prov = _root().get("provenance")
    if not isinstance(prov, dict):
        return {}
    return {k: v for k, v in prov.items() if isinstance(v, str)}


def write_snapshot(
    counts: dict[str, dict[str, int]],
    version: str,
    previous: dict[str, dict[str, int]],
) -> None:
    """Record a new floor, printing any table it lowers.

    This file decides whether future row loss is reported, so overwriting it is
    how a real loss gets masked: run the tool against damaged data and the
    damage becomes the new normal. The caller refuses an overwrite unless
    --force was passed; here, a forced write that lowers anything says so, with
    before and after counts, before the file changes so the operator sees the
    consequence in the same order it happens.
    """
    lowered = [
        f"{db}.{t} {c}->{n}"
        for db, tables in previous.items()
        for t, c in tables.items()
        if (n := counts.get(db, {}).get(t, 0)) < c
    ]
    if lowered:
        print(f"  WARNING: {len(lowered)} table(s) LOWERED vs the previous floor:")
        for item in lowered[:10]:
            print(f"    {item}")
        if len(lowered) > 10:
            print(f"    ... and {len(lowered) - 10} more")
    payload = {
        "provenance": {
            "captured_at": datetime.now(UTC).isoformat(timespec="seconds"),
            "server_version": version,
            "note": "row-loss floor; regenerate only from data verified good",
        },
        "counts": counts,
    }
    SNAPSHOT.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n")


def collect(user: str, dbs: list[str]) -> dict[str, dict[str, int]]:
    return {db: exact_row_counts(db, user) for db in dbs}


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


def record_snapshot(user: str, version: str, dbs: list[str]) -> int:
    # Keyed on the file EXISTING, not on it parsing to something non-empty. A
    # deleted or hand-corrupted snapshot would otherwise parse to {} and sail
    # straight through this refusal, installing a fresh floor with no warning --
    # which is precisely the silent lowering the guard exists to stop.
    if SNAPSHOT.exists() and "--force" not in sys.argv:
        print(
            f"  refusing to overwrite the existing floor at {SNAPSHOT}.\n"
            "  Re-run with --force if the live data is verified good and the "
            "floor is genuinely meant to move."
        )
        return 1
    write_snapshot(collect(user, dbs), version, load_snapshot())
    print(f"\nsnapshot written to {SNAPSHOT} for: {', '.join(dbs)}")
    return 0


def check_one_db(
    db: str, counts: dict[str, int] | None, want: dict[str, int] | None
) -> str | None:
    """One database against the floor. Returns a failure line, or None."""
    if counts is None:
        # Recorded in the floor, absent from the cluster. Every table in it is
        # gone, so this is total loss and must not read as "nothing to check".
        print(f"  {db:<8} *** MISSING (in the floor, absent from the cluster)")
        return f"{db}: recorded in the floor but absent from the cluster"
    if want is None:
        print(f"  {db:<8} NOT CHECKED (no snapshot; record one with --write-snapshot)")
        return f"{db}: no snapshot recorded, row loss not checked"
    if not want:
        print(f"  {db:<8} NOT CHECKED (floor records no tables for this database)")
        return f"{db}: floor records no tables, row loss not checked"
    lost = [t for t, c in want.items() if counts.get(t, 0) < c]
    gained = sum(1 for t, c in counts.items() if c > want.get(t, 0))
    if lost:
        detail = ", ".join(f"{t} {want[t]}->{counts.get(t, 0)}" for t in lost)
        print(f"  {db:<8} *** LOST in {len(lost)} table(s): {detail}")
        return f"{db}: rows LOST in {len(lost)} table(s): {detail}"
    print(f"  {db:<8} no loss across {len(counts)} tables (+{gained} grew)")
    return None


def check_rows(user: str, dbs: list[str]) -> list[str]:
    snapshot = load_snapshot()
    prov = snapshot_provenance()
    print("\n=== row counts per table vs snapshot (any loss fails, growth is fine) ===")
    if prov:
        print(
            f"  floor recorded {prov.get('captured_at', '?')} "
            f"from server {prov.get('server_version', '?')}"
        )
    live = collect(user, dbs)
    # The union, not just the live databases. Iterating live alone meant a
    # database dropped from the cluster was never compared at all, and the run
    # still printed "no loss" for the survivors and exited 0 claiming that no
    # table anywhere had lost rows.
    failures = []
    for db in sorted(set(live) | set(snapshot)):
        line = check_one_db(db, live.get(db), snapshot.get(db))
        if line is not None:
            failures.append(line)
    return failures


def check_routes() -> list[str]:
    print("\n=== routes ===")
    failures = []
    for path in ROUTES:
        code = http_status(path)
        if code != 200:
            failures.append(f"{path} -> {code}")
        print(f"  {path:<26} -> {code}")
    return failures


def check_boot() -> list[str]:
    print("\n=== boot failures ===")
    failures = [
        f"{api} logged boot_failed"
        for api in APIS
        if "boot_failed" in docker("logs", f"deploy-{api}-1")
    ]
    for api in failures:
        print(f"  {api}")
    print("  (nothing listed = clean)")
    return failures


def main() -> int:
    if not os.environ.get("DOCKER_HOST"):
        print("DOCKER_HOST is not set; point it at the deploy tunnel", file=sys.stderr)
        return 1

    user = superuser()
    print(f"superuser: {user}")
    version = scalar("postgres", user, "show server_version;")
    print(f"server_version: {version}")

    dbs = sorted(set(scalar("postgres", user, DATABASES_SQL).split())) or ["users"]
    if "--write-snapshot" in sys.argv:
        return record_snapshot(user, version, dbs)

    failures: list[str] = []
    if not version.startswith("18"):
        failures.append(f"expected PostgreSQL 18, found {version}")
    failures += check_rows(user, dbs)
    down = wait_for_apis(user)
    if down:
        failures.append(f"containers not running: {', '.join(down)}")
    failures += check_routes()
    failures += check_boot()

    print()
    if failures:
        print("RESULT: PROBLEMS FOUND")
        for f in failures:
            print(f"  - {f}")
        return 2
    print("RESULT: upgrade verified - no row loss in any table, all routes 200")
    return 0


if __name__ == "__main__":
    sys.exit(main())
