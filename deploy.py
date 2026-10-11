#!/usr/bin/env python3
"""Deploy entry point: kick the root Gradle deploy task.

Run: `python3 deploy.py [options] [app...] [-- <compose args>]`
(usually `python deploy.py` on Windows). Gradle builds the host artifacts,
renders the gateway config, mints TLS certs, and drives `docker compose`; this
file maps arguments and preflights the SSH tunnel before Gradle boots.

Only stdlib is used (socket, shutil, subprocess, os, sys).
"""

from __future__ import annotations

import os
import shutil
import socket
import subprocess
import sys

FLAGS = (
    "--local",
    "--remote",
    "--no-build",
    "--build-only",
    "--down",
    "--status",
    "--help",
)

# The same flags after mapping to bare tokens (used to tell flags from app names).
BARE_FLAGS = tuple(flag[2:] for flag in FLAGS)

HELP = """Deploy the compose stack with docker compose.

Usage:
  python deploy.py [options] [app...] [-- <compose args>]

Options:
  --local        Force the local Docker engine
  --remote       Force the tunneled remote engine
  --no-build     Start the stack without rebuilding images
  --build-only   Build images only (do not start containers)
  --down         Stop and remove the whole stack
  --status       Show compose service status
  --help         Show this help
  --dry-run      Print the Gradle command instead of running it

Apps:
  Deploy ids or aliases (rss, stock, lemmy, ...), or folders (apps/rss).
  No app names rebuilds every service.

Environment: DOCKER_HOST, DOCKER_TUNNEL (default tcp://127.0.0.1:2375),
DEPLOY_TARGET (auto|local|remote). TLS_HOSTS drives the gateway certs.

Tunnel: a bare deploy targets the remote engine. Before Gradle boots,
deploy.py probes the Docker tunnel (and the object-store forward when a
publish will run) and runs tunnel.sh up itself when either is down. When the
tunnel cannot come up it stops before building -- it never falls through to
a surprise local deploy. Pass --local to deploy locally without a tunnel.
""".strip()


def gradle_argv(argv: list[str]) -> list[str]:
    """Map deploy arguments to the `gradle deploy` command line (mapping only)."""
    tokens: list[str] = []
    passthrough: list[str] = []
    after_separator = False
    for arg in argv:
        if arg == "--dry-run":
            continue
        if after_separator:
            passthrough.append(arg)
        elif arg == "--":
            after_separator = True
        elif arg in FLAGS:
            tokens.append(arg[2:])
        elif arg.startswith("-"):
            passthrough.append(arg)
        else:
            tokens.append(arg)
    # Plain console: the rich progress bar hides compose lines.
    args = ["deploy", "--console=plain"]
    if tokens:
        args.append(f"-Pargs={' '.join(tokens)}")
    if passthrough:
        args.append(f"-Ppassthrough={' '.join(passthrough)}")
    # Build only the named apps (Docker-only names are ignored by the build).
    apps = [arg for arg in tokens if arg not in BARE_FLAGS]
    if apps:
        args.append(f"-Papps={','.join(apps)}")
    return args


def gradle_command() -> list[str]:
    """The repo wrapper when present (gradlew.bat on Windows, ./gradlew
    elsewhere), else `gradle` from PATH (the wrapper is local-only)."""
    wrapper = "gradlew.bat" if sys.platform == "win32" else "./gradlew"
    if os.path.exists(wrapper):
        return [wrapper]
    return ["gradle"]


TUNNEL_DEFAULT = "tcp://127.0.0.1:2375"
PROBE_TIMEOUT_SECONDS = 2
TUNNEL_UP_TIMEOUT_SECONDS = 120

DOCKER_DOWN = """error: remote Docker tunnel is down and could not be started.
  Bring it up (bash deploy/tunnel.sh up from WSL or git-bash),
  or pass --local to deploy locally."""

STORE_DOWN = """error: object-store forward is down and could not be started.
  The publish step needs S3_ENDPOINT reachable from this host. If a local store
  holds the port, stop it or move STORE_HOST_PORT (see deploy/README.md)."""


def tcp_open(host: str, port: int, timeout: float = PROBE_TIMEOUT_SECONDS) -> bool:
    """True when host:port accepts a TCP connection within the timeout."""
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def split_endpoint(value: str, default_port: int) -> tuple[str, int]:
    """Split a tcp:// or http(s):// endpoint URL into host and port."""
    rest = value
    for scheme in ("tcp://", "http://", "https://"):
        if rest.startswith(scheme):
            rest = rest[len(scheme) :]
            break
    host, _, port = rest.partition(":")
    return host or "127.0.0.1", int(port) if port.isdigit() else default_port


def tunnel_endpoint() -> tuple[str, int]:
    """Docker tunnel host/port from DOCKER_TUNNEL, else the default."""
    return split_endpoint(os.environ.get("DOCKER_TUNNEL", TUNNEL_DEFAULT), 2375)


def read_dotenv(path: str) -> dict[str, str]:
    """Minimal KEY=VALUE read (blanks, # comments, first-= split only)."""
    values: dict[str, str] = {}
    try:
        # utf-8-sig drops a BOM: PowerShell's Set-Content writes one, and
        # without this the first key parses with a hidden prefix.
        with open(path, encoding="utf-8-sig") as handle:
            lines = handle.readlines()
    except OSError:
        return values
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, _, raw = stripped.partition("=")
        value = raw.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        values[key.strip()] = value
    return values


def is_loopback(host: str) -> bool:
    """True for hostnames that can only mean this machine."""
    return host in ("localhost", "127.0.0.1", "::1")


def store_endpoint() -> tuple[str, int] | None:
    """Host-side store endpoint from S3_ENDPOINT (deploy/.env, with a non-empty
    process value winning), or None for real AWS, which needs no forward."""
    endpoint = os.environ.get("S3_ENDPOINT", "")
    if not endpoint:
        endpoint = read_dotenv(os.path.join("deploy", ".env")).get("S3_ENDPOINT", "")
    if not endpoint:
        return None
    default_port = 443 if endpoint.startswith("https://") else 80
    return split_endpoint(endpoint, default_port)


def find_bash() -> list[str] | None:
    """bash argv prefix for the tunnel script, or None when bash is absent."""
    if shutil.which("bash"):
        return ["bash"]
    return None


def tunnel_up(timeout: int = TUNNEL_UP_TIMEOUT_SECONDS) -> bool:
    """Run tunnel.sh up (bounded) and report whether the docker port answers."""
    bash = find_bash()
    if bash is None:
        print(
            "error: cannot start the tunnel: no `bash` on PATH (git-bash or WSL).",
            file=sys.stderr,
        )
        return False
    try:
        proc = subprocess.run(
            [*bash, os.path.join("deploy", "tunnel.sh"), "up"],
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        print(f"error: tunnel.sh up failed to complete: {exc}", file=sys.stderr)
        return False
    if proc.returncode != 0:
        tail = "\n".join(proc.stderr.strip().splitlines()[-4:])
        print(f"error: tunnel.sh up exited {proc.returncode}:\n{tail}", file=sys.stderr)
    host, port = tunnel_endpoint()
    return tcp_open(host, port)


def ensure_open(name: str, host: str, port: int) -> bool:
    """Probe host:port; when closed, heal once via tunnel.sh up and re-probe."""
    if tcp_open(host, port):
        return True
    print(f"==> {name} at {host}:{port} is down; starting the tunnel ...")
    if tunnel_up():
        return tcp_open(host, port)
    return False


def wants_remote(argv: list[str]) -> bool:
    """False when the run names its engine explicitly local, or pins one via
    DOCKER_HOST: Gradle owns validation there, so preflight stays out."""
    if "--local" in argv:
        return False
    if os.environ.get("DOCKER_HOST", ""):
        return False
    return os.environ.get("DEPLOY_TARGET", "auto").lower() != "local"


def wants_publish(argv: list[str]) -> bool:
    """True when this run publishes dists to the store (everything except down,
    status, and build-only; --no-build still publishes)."""
    return not any(flag in argv for flag in ("--down", "--status", "--build-only"))


def preflight(argv: list[str]) -> int:
    """Ensure the tunnel (and the store forward, when publishing) before Gradle
    boots. Returns 0, or 1 after printing the fix. A dead tunnel stops here,
    never halfway through a build or on the wrong engine."""
    if not wants_remote(argv):
        return 0
    host, port = tunnel_endpoint()
    if not ensure_open("remote Docker tunnel", host, port):
        print(DOCKER_DOWN, file=sys.stderr)
        return 1
    if wants_publish(argv):
        store = store_endpoint()
        if store is not None and not ensure_open("object-store forward", *store):
            print(STORE_DOWN, file=sys.stderr)
            return 1
    return 0


def main(argv: list[str]) -> int:
    """Print help, or preflight the tunnel and run the mapped Gradle deploy."""
    if any(arg in ("-h", "--help") for arg in argv):
        print(HELP)
        return 0
    args = gradle_argv(argv)
    command = [*gradle_command(), *args]
    if "--dry-run" in argv:
        print(" ".join(command))
        return 0
    if preflight(argv) != 0:
        return 1
    # gradlew.bat needs the shell on Windows; ./gradlew is a script elsewhere.
    return subprocess.run(
        command, cwd=".", check=False, shell=sys.platform == "win32"
    ).returncode


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
