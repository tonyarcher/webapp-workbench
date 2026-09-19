#!/usr/bin/env python3
"""Deploy the compose stack to whichever Docker engine is actually reachable:
an already-set DOCKER_HOST, the SSH-tunneled remote daemon, or local Docker.

Run: `python3 scripts/deploy.py [options] [app...]` (usually via
deploy.sh / deploy.ps1).
Only stdlib is used (socket, subprocess, concurrent via scripts.pool).
"""

from __future__ import annotations

import os
import re
import socket
import subprocess
import sys
import urllib.parse
from dataclasses import dataclass, field

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from scripts.apps import expand_folders, format_app_list, resolve_app, resolve_apps
from scripts.build import ensure_installed
from scripts.gen_certs import ensure_gateway_certs
from scripts.pool import run_pool
from scripts.render_gateway import render_gateway

COMPOSE_FILE = os.path.join("deploy", "docker-compose.yml")
DEFAULT_TUNNEL = "tcp://127.0.0.1:2375"
DOCKER_INFO_TIMEOUT = 4.0
TCP_PROBE_TIMEOUT = 0.8

HELP = f"""Deploy the gateway stack with docker compose.

Pass one or more app names to rebuild and roll out only those services.
TypeScript compiles on the host (Vite / tsc, same as Gradle bootJar).
Images only copy dist or jars — no tsc, vite, or lockfile rm in Docker.
The gateway nginx config renders from deploy/nginx/default.conf.template
on every run (TLS block when TLS_HOSTS is set); certificates come from a
local CA or TLS_CERT_FILE/TLS_KEY_FILE (see deploy/README.md).

The script picks a Docker engine automatically:
  1. --local / --remote / DEPLOY_TARGET
  2. DOCKER_HOST, if it already answers `docker info`
  3. The SSH tunnel URL (DOCKER_TUNNEL, default {DEFAULT_TUNNEL})
  4. The local Docker engine

Usage:
  deploy.sh | deploy.ps1 [options] [app...]

Apps:
{format_app_list()}

Options:
  --local        Force the local Docker engine
  --remote       Force the tunneled remote engine
  --no-build     Start the stack without rebuilding images
  --build-only   Build images only (do not start containers)
  --down         Stop and remove the whole stack
  --status       Show compose service status
  --help         Show this help

Environment:
  DOCKER_HOST      Used as-is when it is already set (unless --local)
  DOCKER_TUNNEL    Remote daemon URL (default {DEFAULT_TUNNEL})
  DEPLOY_TARGET    auto | local | remote
  JOBS             Max parallel host builds (default: CPU count)

Examples:
  ./deploy.sh
  ./deploy.sh rss
  ./deploy.sh apps/rss   (UI and API together)
  ./deploy.sh --remote baseball
  ./deploy.sh lemmy stock
  ./deploy.sh --local
  ./deploy.sh --no-build
  ./deploy.sh --down
""".strip()


@dataclass
class Flags:
    """Parsed CLI flags plus passthrough app names."""

    local: bool = False
    remote: bool = False
    no_build: bool = False
    build_only: bool = False
    down: bool = False
    status: bool = False
    help: bool = False
    extra: list[str] = field(default_factory=list)


@dataclass
class CommandResult:
    """A finished child process."""

    code: int
    stdout: str = ""
    stderr: str = ""
    timed_out: bool = False


@dataclass
class Target:
    """The Docker engine to talk to."""

    kind: str
    docker_host: str
    label: str
    version: str


@dataclass
class DockerHost:
    """Parsed Docker host URL."""

    protocol: str
    hostname: str
    port: int


@dataclass
class DockerInfo:
    """Result of probing `docker info`."""

    ok: bool
    version: str
    timed_out: bool
    stderr: str


@dataclass
class ComposeInvocation:
    """How to invoke compose (plugin or standalone)."""

    command: str
    prefix: list[str]


@dataclass
class SplitExtra:
    """App services plus `-` compose passthrough flags."""

    services: list[str]
    compose_extras: list[str]


@dataclass
class JvmApi:
    """Kotlin API compiled on the host JDK before compose builds."""

    service: str
    dir: str
    task: str
    artifact: str


@dataclass
class HostJsApp:
    """TypeScript app compiled on the host before compose copies dist."""

    service: str
    dist: str
    base_path: str = ""
    script: str = "build"


HOST_JS_APPS: list[HostJsApp] = [
    HostJsApp("baseball", os.path.join("apps", "baseball", "dist"), "/baseball/"),
    HostJsApp("rss-reader", os.path.join("apps", "rss", "app", "dist"), "/rss-reader/"),
    HostJsApp(
        "stock-game", os.path.join("apps", "stock-game", "app", "dist"), "/stock-game/"
    ),
    HostJsApp(
        "lemmy-vertical-scroll", os.path.join("apps", "lemmy-vertical-scroll", "dist")
    ),
    HostJsApp("clipstack", os.path.join("apps", "clipstack", "dist")),
    HostJsApp("calendar-sync", os.path.join("apps", "calendar-sync", "dist")),
    HostJsApp("radio-station", os.path.join("apps", "radio-station", "dist")),
    HostJsApp(
        "radio-api",
        os.path.join("apps", "radio-station", "dist-server"),
        script="build:server",
    ),
    HostJsApp("football", os.path.join("apps", "football", "dist"), "/football/"),
    HostJsApp("basketball", os.path.join("apps", "basketball", "dist"), "/basketball/"),
    HostJsApp("fitness", os.path.join("apps", "fitness", "app", "dist")),
    HostJsApp("user-web", os.path.join("apps", "user", "app", "dist")),
]


def host_js_apps_for(services: list[str]) -> list[HostJsApp]:
    """HOST_JS_APPS filtered to the named compose services, or all."""
    if not services:
        return list(HOST_JS_APPS)
    wanted = set(services)
    return [item for item in HOST_JS_APPS if item.service in wanted]


JVM_APIS: list[JvmApi] = [
    JvmApi(
        service="user-api",
        dir=os.path.join("apps", "user", "api"),
        task="bootJar",
        artifact=os.path.join(
            "apps", "user", "api", "build", "libs", "user-api-0.1.0.jar"
        ),
    ),
    JvmApi(
        service="fitness-api",
        dir=os.path.join("apps", "fitness", "api"),
        task="bootJar",
        artifact=os.path.join(
            "apps", "fitness", "api", "build", "libs", "fitness-api-0.1.0.jar"
        ),
    ),
    JvmApi(
        service="rss-api",
        dir=os.path.join("apps", "rss", "api"),
        task="bootJar",
        artifact=os.path.join(
            "apps", "rss", "api", "build", "libs", "rss-api-0.1.0.jar"
        ),
    ),
    JvmApi(
        service="stock-game-api",
        dir=os.path.join("apps", "stock-game", "api"),
        task="bootJar",
        artifact=os.path.join(
            "apps", "stock-game", "api", "build", "libs", "stock-game-api-0.1.0.jar"
        ),
    ),
]


def parse_args(argv: list[str]) -> Flags:
    """Parse CLI flags; everything after `--` (and unknown args) passes through."""
    flags = Flags()
    passthrough = False
    for arg in argv:
        if passthrough:
            flags.extra.append(arg)
            continue
        if arg == "--":
            passthrough = True
            continue
        if arg == "--local":
            flags.local = True
        elif arg == "--remote":
            flags.remote = True
        elif arg == "--no-build":
            flags.no_build = True
        elif arg == "--build-only":
            flags.build_only = True
        elif arg == "--down":
            flags.down = True
        elif arg == "--status":
            flags.status = True
        elif arg in ("-h", "--help"):
            flags.help = True
        else:
            flags.extra.append(arg)
    return flags


def requested_target(flags: Flags) -> str:
    """Resolve local/remote/auto from flags plus DEPLOY_TARGET."""
    env_target = (os.environ.get("DEPLOY_TARGET") or "auto").lower()
    if flags.local and flags.remote:
        raise RuntimeError("Use only one of --local or --remote.")
    if flags.local:
        return "local"
    if flags.remote:
        return "remote"
    if env_target in ("local", "remote", "auto"):
        return env_target
    raise RuntimeError(
        f"DEPLOY_TARGET must be auto, local, or remote (got {os.environ.get('DEPLOY_TARGET')})."
    )


def tunnel_url() -> str:
    """Remote daemon URL, defaulting to the localhost SSH tunnel."""
    return os.environ.get("DOCKER_TUNNEL") or DEFAULT_TUNNEL


def parse_docker_host(host: str) -> DockerHost | None:
    """Split a Docker host URL; returns None when unparseable."""
    if not host:
        return None
    try:
        url = urllib.parse.urlparse(host)
        if not url.scheme:
            return None
        return DockerHost(
            protocol=url.scheme,
            hostname=url.hostname or "",
            port=url.port or 2375,
        )
    except ValueError:
        return None


def tcp_open(hostname: str, port: int, timeout: float = TCP_PROBE_TIMEOUT) -> bool:
    """True when a TCP connection succeeds within the timeout."""
    try:
        with socket.create_connection((hostname, port), timeout=timeout):
            return True
    except OSError:
        return False


def spawn_command(
    command: str,
    args: list[str],
    env: dict[str, str] | None = None,
    timeout: float | None = None,
    inherit: bool = False,
    shell: bool = False,
) -> CommandResult:
    """Run a child process from ROOT, capturing output unless inherit."""
    try:
        proc = subprocess.run(
            [command, *args],
            cwd=ROOT,
            env=env,
            shell=shell,
            stdin=sys.stdin if inherit else subprocess.DEVNULL,
            stdout=None if inherit else subprocess.PIPE,
            stderr=None if inherit else subprocess.PIPE,
            timeout=timeout,
            text=True,
            check=False,
        )
    except FileNotFoundError as error:
        return CommandResult(code=1, stderr=str(error))
    except subprocess.TimeoutExpired as error:
        out = error.stdout if isinstance(error.stdout, str) else ""
        err = error.stderr if isinstance(error.stderr, str) else ""
        return CommandResult(code=1, stdout=out, stderr=err, timed_out=True)
    return CommandResult(
        code=proc.returncode,
        stdout=proc.stdout if isinstance(proc.stdout, str) else "",
        stderr=proc.stderr if isinstance(proc.stderr, str) else "",
    )


def docker_env(docker_host: str) -> dict[str, str]:
    """Process env adjusted for the target daemon (no leaked context)."""
    env = dict(os.environ)
    if docker_host:
        env["DOCKER_HOST"] = docker_host
        env.pop("DOCKER_CONTEXT", None)
    else:
        env.pop("DOCKER_HOST", None)
    return env


def docker_info(docker_host: str) -> DockerInfo:
    """Probe `docker info`; returns ok/version/timedOut/stderr."""
    result = spawn_command(
        "docker",
        ["info", "--format", "{{.ServerVersion}}"],
        env=docker_env(docker_host),
        timeout=DOCKER_INFO_TIMEOUT,
    )
    version = result.stdout.strip()
    return DockerInfo(
        ok=result.code == 0 and bool(version),
        version=version,
        timed_out=result.timed_out,
        stderr=result.stderr.strip(),
    )


def describe_docker_failure(info: DockerInfo) -> str:
    """One-line reason a docker probe failed."""
    if info.timed_out:
        return "docker info timed out"
    for entry in info.stderr.splitlines():
        if entry.strip():
            return entry.strip()
    return "docker info failed"


def target_local() -> Target:
    """Require the local Docker engine."""
    info = docker_info("")
    if not info.ok:
        raise RuntimeError(
            f"Local Docker is not reachable ({describe_docker_failure(info)}). "
            "Start Rancher Desktop / Docker Desktop (or the local daemon) and retry."
        )
    return Target(
        kind="local", docker_host="", label="local Docker", version=info.version
    )


def target_remote(host: str) -> Target:
    """Require the remote (possibly tunneled) Docker engine."""
    parsed = parse_docker_host(host)
    if (
        parsed
        and parsed.protocol == "tcp"
        and not tcp_open(parsed.hostname, parsed.port)
    ):
        raise RuntimeError(
            f"Remote Docker tunnel is not listening at {host}. "
            f"Start the SSH tunnel (remote daemon on port {parsed.port}) and retry."
        )
    info = docker_info(host)
    if not info.ok:
        raise RuntimeError(
            f"Remote Docker at {host} did not answer ({describe_docker_failure(info)}). "
            "Is the tunneled daemon running without TLS?"
        )
    return Target(
        kind="remote",
        docker_host=host,
        label=f"remote Docker ({host})",
        version=info.version,
    )


def resolve_target(wanted: str) -> Target:
    """Pick the Docker engine: explicit host, tunnel, then local."""
    existing_host = os.environ.get("DOCKER_HOST") or ""
    tunnel = tunnel_url()
    if wanted == "local":
        return target_local()
    if wanted == "remote":
        return target_remote(existing_host or tunnel)

    notes: list[str] = []
    if existing_host:
        info = docker_info(existing_host)
        if info.ok:
            return Target(
                kind="explicit",
                docker_host=existing_host,
                label=f"DOCKER_HOST ({existing_host})",
                version=info.version,
            )
        notes.append(f"DOCKER_HOST={existing_host}: {describe_docker_failure(info)}")
        print(f"==> DOCKER_HOST={existing_host} did not answer; trying auto-detect.")

    parsed_tunnel = parse_docker_host(tunnel)
    tunnel_open = (
        tcp_open(parsed_tunnel.hostname, parsed_tunnel.port)
        if parsed_tunnel and parsed_tunnel.protocol == "tcp"
        else True
    )
    if tunnel_open:
        info = docker_info(tunnel)
        if info.ok:
            return Target(
                kind="remote",
                docker_host=tunnel,
                label=f"remote Docker via tunnel ({tunnel})",
                version=info.version,
            )
        notes.append(f"{tunnel}: {describe_docker_failure(info)}")
        if parsed_tunnel and parsed_tunnel.protocol == "tcp":
            print(
                f"==> {tunnel} is open but is not a Docker daemon; falling back to local Docker."
            )
    else:
        notes.append(f"{tunnel}: not listening")

    local = docker_info("")
    if local.ok:
        return Target(
            kind="local", docker_host="", label="local Docker", version=local.version
        )
    notes.append(f"local Docker: {describe_docker_failure(local)}")
    raise RuntimeError(
        "No Docker engine is reachable. Start the SSH tunnel to the remote "
        f"daemon ({tunnel}) or start local Docker.\n  " + "\n  ".join(notes)
    )


def compose_invocation() -> ComposeInvocation:
    """Prefer `docker compose`, fall back to standalone `docker-compose`."""
    plugin = spawn_command("docker", ["compose", "version"], timeout=5.0)
    if plugin.code == 0:
        return ComposeInvocation(command="docker", prefix=["compose"])
    standalone = spawn_command("docker-compose", ["version"], timeout=5.0)
    if standalone.code == 0:
        return ComposeInvocation(command="docker-compose", prefix=[])
    raise RuntimeError(
        "Neither `docker compose` nor `docker-compose` is available on PATH."
    )


def split_extra(extra: list[str]) -> SplitExtra:
    """Split app names from `-` compose passthrough flags."""
    names = [arg for arg in extra if not arg.startswith("-")]
    compose_extras = [arg for arg in extra if arg.startswith("-")]
    services = [app.service for app in resolve_apps(expand_folders(names))]
    return SplitExtra(services=services, compose_extras=compose_extras)


def compose_args(
    flags: Flags, services: list[str], compose_extras: list[str]
) -> list[str]:
    """Build the compose argument list for the requested operation."""
    base = ["-f", COMPOSE_FILE]
    if flags.down:
        if services:
            raise RuntimeError(
                "--down stops the whole stack; omit app names (or use --status / redeploy a single app)."
            )
        return [*base, "down", *compose_extras]
    if flags.status:
        return [*base, "ps", *services, *compose_extras]
    if flags.build_only:
        return [*base, "build", *services, *compose_extras]
    up = ["up", "-d"]
    if not flags.no_build:
        up.append("--build")
    return [*base, *up, *services, *compose_extras]


def tls_hosts(env: dict[str, str]) -> list[str]:
    """Hostnames from TLS_HOSTS."""
    return [host for host in re.split(r"[\s,]+", env.get("TLS_HOSTS", "")) if host]


def prepare_gateway(flags: Flags, services: list[str]) -> None:
    """Render nginx config and certs (skipped for down/status/help)."""
    if flags.help:
        return
    env = render_gateway()
    hosts = tls_hosts(env)
    if not hosts or flags.down or flags.status:
        return
    result = ensure_gateway_certs()
    changed = result["changed"]
    gateway_stale = flags.no_build or (services and "gateway" not in services)
    if changed and gateway_stale:
        print(
            "==> certs changed: rebuild the gateway (include it in this deploy) to pick it up"
        )
    print(
        "==> TLS reminder: browse https, trust deploy/gateway/certs/ca.crt per device, "
        "and add oauth_redirect_uris + WEBAUTHN rows for your origin (see deploy/README.md)"
    )


def skip_host_build(flags: Flags) -> bool:
    """True when deploy should not compile on the host."""
    return flags.down or flags.status or flags.no_build


def npm_env(base_path: str) -> dict[str, str]:
    """Process env, with APP_BASE_PATH when the SPA is served on a subpath."""
    env = dict(os.environ)
    if base_path:
        env["APP_BASE_PATH"] = base_path
    else:
        env.pop("APP_BASE_PATH", None)
    return env


@dataclass
class JsWorkspaceJob:
    """One npm workspace build in a host-JS wave."""

    workspace: str
    script: str
    base_path: str


def js_workspace_waves(items: list[HostJsApp]) -> list[list[JsWorkspaceJob]]:
    """Group unique (workspace, script) jobs so libraries finish before apps."""
    waves: list[list[JsWorkspaceJob]] = []
    seen: set[tuple[str, str]] = set()
    for item in items:
        _push_item_jobs(item, waves, seen)
    return [wave for wave in waves if wave]


def _push_item_jobs(
    item: HostJsApp,
    waves: list[list[JsWorkspaceJob]],
    seen: set[tuple[str, str]],
) -> None:
    app = resolve_app(item.service)
    if app is None:
        raise RuntimeError(f"Unknown host JS app {item.service}.")
    last = len(app.workspaces) - 1
    for index, workspace in enumerate(app.workspaces):
        job = JsWorkspaceJob(
            workspace,
            item.script if index == last else "build",
            item.base_path if index == last else "",
        )
        key = (job.workspace, job.script)
        if key in seen:
            continue
        seen.add(key)
        while len(waves) <= index:
            waves.append([])
        waves[index].append(job)


def npm_run_workspace(workspace: str, script: str, base_path: str) -> None:
    """Run `npm run <script> -w <workspace>` in ROOT."""
    print(f"==> npm run {script} -w {workspace}")
    result = spawn_command(
        "npm",
        ["run", script, "-w", workspace],
        env=npm_env(base_path),
        inherit=True,
        shell=sys.platform == "win32",
    )
    if result.code != 0:
        raise RuntimeError(f"npm run {script} -w {workspace} failed ({result.code}).")


def run_js_wave(jobs: list[JsWorkspaceJob]) -> None:
    """Parallel workspaces; sequential scripts that share a workspace."""
    by_ws: dict[str, list[JsWorkspaceJob]] = {}
    for job in jobs:
        by_ws.setdefault(job.workspace, []).append(job)

    def run_workspace(workspace: str) -> None:
        for job in by_ws[workspace]:
            npm_run_workspace(job.workspace, job.script, job.base_path)

    failed = run_pool(list(by_ws), run_workspace)
    for workspace, error in failed:
        print(f"error: {workspace}: {error}", file=sys.stderr)
    if failed:
        raise RuntimeError(
            f"host JS builds failed: {', '.join(name for name, _ in failed)}."
        )


def prepare_js_host_build(services: list[str], flags: Flags) -> None:
    """Compile TypeScript on the host before compose copies dist into images."""
    if skip_host_build(flags):
        return
    items = host_js_apps_for(services)
    if not items:
        return
    if ensure_installed("npm") != 0:
        raise RuntimeError("npm install failed.")
    for wave in js_workspace_waves(items):
        run_js_wave(wave)
    for item in items:
        if not os.path.exists(os.path.join(ROOT, item.dist)):
            raise RuntimeError(f"Missing {item.dist} after host JS build.")


def prepare_jvm_host_build(services: list[str], flags: Flags) -> None:
    """Compile Kotlin boot jars on the host JDK before compose builds images."""
    if skip_host_build(flags):
        return
    apis = [api for api in JVM_APIS if not services or api.service in services]

    def build(api: JvmApi) -> None:
        print(f"==> gradle {api.task} (host JVM → {api.service})")
        result = spawn_command(
            "gradle",
            ["-p", api.dir, api.task],
            shell=sys.platform == "win32",
        )
        if result.code != 0:
            print(f"--- {api.service} output ---\n{result.stdout}")
            print(f"--- {api.service} errors ---\n{result.stderr}", file=sys.stderr)
            raise RuntimeError(f"{api.service} host build failed (gradle {api.task}).")
        if not os.path.exists(os.path.join(ROOT, api.artifact)):
            raise RuntimeError(f"Missing {api.artifact} after {api.task}.")

    failed = run_pool(apis, build)
    for item, error in failed:
        print(f"error: {item.service}: {error}", file=sys.stderr)
    if failed:
        raise RuntimeError(
            f"host builds failed: {', '.join(item.service for item, _ in failed)}."
        )


def main() -> int:
    """Deploy entry point; returns the process exit code."""
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    flags = parse_args(sys.argv[1:])
    if flags.help:
        print(HELP)
        return 0
    if flags.down and (flags.build_only or flags.no_build or flags.status):
        raise RuntimeError(
            "--down cannot be combined with --build-only, --no-build, or --status."
        )
    if flags.build_only and flags.no_build:
        raise RuntimeError("Use only one of --build-only or --no-build.")
    if flags.status and (flags.build_only or flags.no_build):
        raise RuntimeError(
            "--status cannot be combined with --build-only or --no-build."
        )
    if not os.path.exists(os.path.join(ROOT, COMPOSE_FILE)):
        raise RuntimeError(
            f"Missing {COMPOSE_FILE} (run this from the webapp-workbench repo)."
        )

    split = split_extra(flags.extra)
    target = resolve_target(requested_target(flags))
    prepare_gateway(flags, split.services)
    prepare_js_host_build(split.services, flags)
    prepare_jvm_host_build(split.services, flags)
    compose = compose_invocation()
    args = [*compose.prefix, *compose_args(flags, split.services, split.compose_extras)]
    printed = " ".join([compose.command, *args])
    if split.services:
        print(f"==> Apps: {', '.join(split.services)}")
    print(f"==> Using {target.label} (engine {target.version})")
    print(f"==> {printed}")

    result = spawn_command(
        compose.command, args, env=docker_env(target.docker_host), inherit=True
    )
    return result.code


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as error:  # noqa: BLE001 - CLI boundary reports the error and exits 1
        print(f"error: {error}", file=sys.stderr)
        sys.exit(1)
