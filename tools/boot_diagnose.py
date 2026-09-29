#!/usr/bin/env python3
"""How much of user-api's boot is class loading, and how much is GC?

Answers "is the CPU ours?" for a boot. Loads the real image against a throwaway
Postgres on the LOCAL daemon, so the live service is never restarted, and
counts the classes the JVM loads plus the total GC pause.

Known limitation: the local copy does not reach `ready` -- it fails in
AppConfig.dataSource against a database it was not given working credentials
for. That does not matter here, because the class-load and GC logs are written
as the JVM goes and are read regardless. If you need a boot that completes, use
measure_boot.py against the compose network instead.

Run: python tools/boot_diagnose.py
"""

from __future__ import annotations

import os
import re
import subprocess
import sys
import time

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NET = "bootprof"
PG = "bootprof-pg"
APP = "bootprof-app"
IMG = "deploy-user-api"

ENV = {
    "SPRING_PROFILES_ACTIVE": "prod",
    "LOG_LEVEL": "info",
    "PORT": "3000",
    "SERVICE": "user-api",
    "OAUTH_ISSUER": "http://localhost/user-api",
    "WEBAUTHN_RP_ID": "localhost",
    "WEBAUTHN_ORIGINS": "http://localhost,http://127.0.0.1",
}


def run(*args: str, timeout: int = 300) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["docker", *args], capture_output=True, text=True, timeout=timeout, check=False
    )


def collect(container: str, remote: str) -> str | None:
    """Copy a log out of a container. Returns None when it is not there."""
    local = os.path.join(REPO, f"_boot_{container}_{os.path.basename(remote)}")
    if run("cp", f"{container}:{remote}", local).returncode != 0:
        return None
    return local


def main() -> int:
    os.environ.pop("DOCKER_HOST", None)
    os.environ.pop("DOCKER_CONTEXT", None)
    run("rm", "-f", APP, PG)
    run("network", "create", NET)

    run(
        "run",
        "-d",
        "--name",
        PG,
        "--network",
        NET,
        "-e",
        "POSTGRES_PASSWORD=verify",
        "-e",
        "POSTGRES_DB=users",
        "postgres:18-alpine",
    )
    for _ in range(60):
        if run("exec", PG, "pg_isready", "-U", "postgres").returncode == 0:
            break
        time.sleep(1)
    print("postgres ready")

    args: list[str] = []
    for k, v in ENV.items():
        args += ["-e", f"{k}={v}"]
    args += [
        "--network",
        NET,
        IMG,
        "sh",
        "-c",
        (
            "java -Xlog:class+load:file=/tmp/classload.log "
            "-Xlog:gc:file=/tmp/gc.log -jar /app/app.jar"
        ),
    ]
    run("run", "-d", "--name", APP, *args)
    print("app starting; sampling for 60s\n")

    for i in range(1, 13):
        time.sleep(5)
        state = run("inspect", APP, "--format", "{{.State.Status}}").stdout.strip()
        logs = run("logs", APP).stdout
        ready = "ready" in logs
        print(
            f"  t+{i * 5:>3}s  {state:<10} loglines={len(logs.splitlines())}"
            f"{'  READY' if ready else ''}"
        )
        if ready:
            break

    print("\n=== the last thing the app said ===")
    for line in run("logs", "--tail", "8", APP).stdout.splitlines()[-6:]:
        print(f"  {line[:150]}")

    print("\n=== was the database ever reached? ===")
    acts = run(
        "exec",
        PG,
        "psql",
        "-U",
        "postgres",
        "-t",
        "-A",
        "-c",
        "select count(*) from pg_stat_activity;",
    ).stdout.strip()
    print(f"  connections seen by postgres: {acts or 'unknown'}")

    print("\n=== class loading (this is the answer) ===")
    path = collect(APP, "/tmp/classload.log")
    if path:
        with open(path, encoding="utf-8", errors="ignore") as fh:
            lines = fh.read().splitlines()
        ours = [x for x in lines if " userapi" in x]
        spring = [x for x in lines if " org.springframework" in x]
        print(f"  classes loaded total: {len(lines)}")
        print(f"    from Spring:      {len(spring)}")
        print(f"    from our code:    {len(ours)}")
        last = lines[-1][-40:] if lines else ""
        print(f"  log ends with: ...{last}")
        os.remove(path)
    else:
        print("  no class-load log produced")

    print("\n=== GC ===")
    path = collect(APP, "/tmp/gc.log")
    if path:
        with open(path, encoding="utf-8", errors="ignore") as fh:
            text = fh.read()
        pauses = [float(m) for m in re.findall(r"(\d+\.\d+)ms", text)]
        print(f"  GC events: {len(pauses)}")
        print(f"  total GC pause: {sum(pauses):.1f} ms")
        os.remove(path)
    else:
        print("  no GC log produced")

    run("rm", "-f", APP, PG)
    run("network", "rm", NET)
    print("\ncleaned up; prod untouched")
    return 0


if __name__ == "__main__":
    sys.exit(main())
