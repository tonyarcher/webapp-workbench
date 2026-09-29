#!/usr/bin/env python3
"""Measure a user-api image's boot, split into pre-Spring and Spring phases.

Runs a second container beside the live one, so prod is never restarted. Timing
is taken from the container's own StartedAt to the `ready` line's timestamp;
`ready` also carries Spring's own duration_ms, and the difference is the
pre-Spring window.

A network probe is useless here: the published port lands on the DAEMON's host,
so 127.0.0.1 from this machine is not prod. Three earlier runs of a health
check reported healthy boots as failures for exactly that reason.

Run: python tools/measure_boot.py [image] [runs]
"""

from __future__ import annotations

import os
import re
import subprocess
import sys
import time

NET = "deploy_baseball"
PROBE = "bootmeasure"
PORT = "13000"

ENV = {
    "SPRING_PROFILES_ACTIVE": "prod",
    "LOG_LEVEL": "info",
    "PORT": "3000",
    "SERVICE": "user-api",
    "OAUTH_ISSUER": "http://localhost/user-api",
    "WEBAUTHN_RP_ID": "localhost",
    "WEBAUTHN_ORIGINS": "http://localhost,http://127.0.0.1",
}


def run(*args: str, timeout: int = 600) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["docker", *args], capture_output=True, text=True, timeout=timeout, check=False
    )


def db_url() -> str:
    env = run(
        "inspect",
        "deploy-postgres-1",
        "--format",
        "{{range .Config.Env}}{{println .}}{{end}}",
    ).stdout
    user = pw = "postgres"
    for line in env.splitlines():
        if line.startswith("POSTGRES_USER="):
            user = line.split("=", 1)[1]
        if line.startswith("POSTGRES_PASSWORD="):
            pw = line.split("=", 1)[1]
    return f"postgres://{user}:{pw}@postgres:5432/users"


def measure(image: str, runs: int) -> list[tuple[float, float]]:
    results: list[tuple[float, float]] = []
    for attempt in range(1, runs + 1):
        run("rm", "-f", PROBE)
        args: list[str] = ["run", "-d", "--name", PROBE, "--network", NET]
        for k, v in {**ENV, "DATABASE_URL": db_url()}.items():
            args += ["-e", f"{k}={v}"]
        args += ["-p", f"{PORT}:3000", image]
        run(*args)

        started = run(
            "inspect", PROBE, "--format", "{{.State.StartedAt}}"
        ).stdout.strip()
        found = None
        deadline = time.monotonic() + 180
        while time.monotonic() < deadline:
            logs = run("logs", PROBE).stdout
            found = re.search(
                r'"ts":"([^"]+)".*"msg":"ready".*"duration_ms":(\d+)', logs
            )
            if found:
                break
            if (
                run("inspect", PROBE, "--format", "{{.State.Status}}").stdout.strip()
                == "exited"
            ):
                break
            time.sleep(1)

        if not found:
            print(f"    run {attempt}: no ready line")
            run("rm", "-f", PROBE)
            continue

        from datetime import datetime

        ready_ts, spring_ms = found.group(1), int(found.group(2))
        # Python 3.11+ parses the trailing Z directly.
        start_s = datetime.fromisoformat(started).timestamp()
        ready_s = datetime.fromisoformat(ready_ts).timestamp()
        total = (ready_s - start_s) * 1000
        results.append((total, float(spring_ms)))
        print(
            f"    run {attempt}: end-to-end {total:7.0f}ms  "
            f"spring {spring_ms:>6}ms  pre-spring {total - spring_ms:7.0f}ms"
        )
        run("rm", "-f", PROBE)
        time.sleep(2)
    return results


def main() -> int:
    if not os.environ.get("DOCKER_HOST"):
        print("DOCKER_HOST is not set", file=sys.stderr)
        return 1
    image = sys.argv[1] if len(sys.argv) > 1 else "deploy-user-api"
    runs = int(sys.argv[2]) if len(sys.argv) > 2 else 3

    print(f"=== {image} ===")
    results = measure(image, runs)
    if not results:
        print("  no successful runs")
        return 2

    totals = sorted(t for t, _ in results)
    springs = sorted(s for _, s in results)
    pres = sorted(t - s for t, s in results)
    median = len(totals) // 2
    print()
    print(f"  end-to-end  best={totals[0]:.0f}ms  median={totals[median]:.0f}ms")
    print(f"  spring      best={springs[0]:.0f}ms  median={springs[median]:.0f}ms")
    print(f"  pre-spring  best={pres[0]:.0f}ms  median={pres[median]:.0f}ms")
    return 0


if __name__ == "__main__":
    sys.exit(main())
