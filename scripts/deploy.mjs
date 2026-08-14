#!/usr/bin/env node
/**
 * Deploy the compose stack to whichever Docker engine is actually reachable:
 * an already-set DOCKER_HOST, the SSH-tunneled remote daemon, or local Docker.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { formatAppList, resolveApps } from "./apps.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const COMPOSE_FILE = join("deploy", "docker-compose.yml");
const DEFAULT_TUNNEL = "tcp://127.0.0.1:2375";
const DOCKER_INFO_TIMEOUT_MS = 4000;
const TCP_PROBE_TIMEOUT_MS = 800;

const HELP = `
Deploy the gateway stack with docker compose.

Pass one or more app names to rebuild and roll out only those services.
Dockerfiles compile the app inside the image, so a local ./build.sh is
optional (useful to catch errors before sending context over the tunnel).

The script picks a Docker engine automatically:
  1. --local / --remote / DEPLOY_TARGET
  2. DOCKER_HOST, if it already answers \`docker info\`
  3. The SSH tunnel URL (DOCKER_TUNNEL, default ${DEFAULT_TUNNEL})
  4. The local Docker engine

Usage:
  deploy.sh | deploy.ps1 [options] [app...]

Apps:
${formatAppList()}

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
  DOCKER_TUNNEL    Remote daemon URL (default ${DEFAULT_TUNNEL})
  DEPLOY_TARGET    auto | local | remote

Examples:
  ./deploy.sh
  ./deploy.sh rss
  ./deploy.sh --remote baseball
  ./deploy.sh lemmy stock
  ./deploy.sh --local
  ./deploy.sh --no-build
  ./deploy.sh --down
`.trim();

function parseArgs(argv) {
  const flags = {
    local: false,
    remote: false,
    noBuild: false,
    buildOnly: false,
    down: false,
    status: false,
    help: false,
    extra: [],
  };
  let passthrough = false;
  for (const arg of argv) {
    if (passthrough) {
      flags.extra.push(arg);
      continue;
    }
    if (arg === "--") {
      passthrough = true;
      continue;
    }
    switch (arg) {
      case "--local":
        flags.local = true;
        break;
      case "--remote":
        flags.remote = true;
        break;
      case "--no-build":
        flags.noBuild = true;
        break;
      case "--build-only":
        flags.buildOnly = true;
        break;
      case "--down":
        flags.down = true;
        break;
      case "--status":
        flags.status = true;
        break;
      case "-h":
      case "--help":
        flags.help = true;
        break;
      default:
        flags.extra.push(arg);
    }
  }
  return flags;
}

function requestedTarget(flags) {
  const envTarget = (process.env.DEPLOY_TARGET || "auto").toLowerCase();
  if (flags.local && flags.remote) {
    throw new Error("Use only one of --local or --remote.");
  }
  if (flags.local) return "local";
  if (flags.remote) return "remote";
  if (envTarget === "local" || envTarget === "remote" || envTarget === "auto") {
    return envTarget;
  }
  throw new Error(`DEPLOY_TARGET must be auto, local, or remote (got ${process.env.DEPLOY_TARGET}).`);
}

function tunnelUrl() {
  return process.env.DOCKER_TUNNEL || DEFAULT_TUNNEL;
}

function parseDockerHost(host) {
  if (!host) return null;
  try {
    const url = new URL(host);
    return {
      protocol: url.protocol.replace(/:$/, ""),
      hostname: url.hostname,
      port: url.port ? Number(url.port) : 2375,
    };
  } catch {
    return null;
  }
}

function tcpOpen(hostname, port, timeoutMs = TCP_PROBE_TIMEOUT_MS) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: hostname, port });
    const finish = (ok) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

function spawnCommand(command, args, { env, timeoutMs, inherit = false } = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      env,
      stdio: inherit ? "inherit" : ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    if (!inherit) {
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
    }

    let timedOut = false;
    const timer =
      timeoutMs == null
        ? null
        : setTimeout(() => {
            timedOut = true;
            child.kill();
          }, timeoutMs);

    child.on("error", (error) => {
      if (timer) clearTimeout(timer);
      resolve({ code: 1, stdout, stderr: error.message, timedOut: false });
    });
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, stderr, timedOut });
    });
  });
}

function dockerEnv(dockerHost) {
  const env = { ...process.env };
  if (dockerHost) {
    env.DOCKER_HOST = dockerHost;
    delete env.DOCKER_CONTEXT;
  } else {
    delete env.DOCKER_HOST;
  }
  return env;
}

async function dockerInfo(dockerHost) {
  const result = await spawnCommand("docker", ["info", "--format", "{{.ServerVersion}}"], {
    env: dockerEnv(dockerHost),
    timeoutMs: DOCKER_INFO_TIMEOUT_MS,
  });
  const version = result.stdout.trim();
  return {
    ok: result.code === 0 && Boolean(version),
    version,
    timedOut: result.timedOut,
    stderr: result.stderr.trim(),
  };
}

function describeDockerFailure(info) {
  if (info.timedOut) return "docker info timed out";
  const line = (info.stderr || "").split(/\r?\n/).find((entry) => entry.trim());
  return line || "docker info failed";
}

async function resolveTarget(wanted) {
  const existingHost = process.env.DOCKER_HOST || "";
  const tunnel = tunnelUrl();

  if (wanted === "local") {
    const info = await dockerInfo("");
    if (!info.ok) {
      throw new Error(
        `Local Docker is not reachable (${describeDockerFailure(info)}). Start Rancher Desktop / Docker Desktop (or the local daemon) and retry.`,
      );
    }
    return { kind: "local", dockerHost: "", label: "local Docker", version: info.version };
  }

  if (wanted === "remote") {
    const host = existingHost || tunnel;
    const parsed = parseDockerHost(host);
    if (parsed?.protocol === "tcp") {
      const open = await tcpOpen(parsed.hostname, parsed.port);
      if (!open) {
        throw new Error(
          `Remote Docker tunnel is not listening at ${host}. Start the SSH tunnel (remote daemon on port ${parsed.port}) and retry.`,
        );
      }
    }
    const info = await dockerInfo(host);
    if (!info.ok) {
      throw new Error(
        `Remote Docker at ${host} did not answer (${describeDockerFailure(info)}). Is the tunneled daemon running without TLS?`,
      );
    }
    return { kind: "remote", dockerHost: host, label: `remote Docker (${host})`, version: info.version };
  }

  const notes = [];

  if (existingHost) {
    const info = await dockerInfo(existingHost);
    if (info.ok) {
      return {
        kind: "explicit",
        dockerHost: existingHost,
        label: `DOCKER_HOST (${existingHost})`,
        version: info.version,
      };
    }
    notes.push(`DOCKER_HOST=${existingHost}: ${describeDockerFailure(info)}`);
    console.warn(`==> DOCKER_HOST=${existingHost} did not answer; trying auto-detect.`);
  }

  const parsedTunnel = parseDockerHost(tunnel);
  const tunnelPortOpen =
    parsedTunnel?.protocol === "tcp" ? await tcpOpen(parsedTunnel.hostname, parsedTunnel.port) : true;
  if (tunnelPortOpen) {
    const info = await dockerInfo(tunnel);
    if (info.ok) {
      return {
        kind: "remote",
        dockerHost: tunnel,
        label: `remote Docker via tunnel (${tunnel})`,
        version: info.version,
      };
    }
    notes.push(`${tunnel}: ${describeDockerFailure(info)}`);
    if (parsedTunnel?.protocol === "tcp") {
      console.warn(
        `==> ${tunnel} is open but is not a Docker daemon; falling back to local Docker.`,
      );
    }
  } else {
    notes.push(`${tunnel}: not listening`);
  }

  const local = await dockerInfo("");
  if (local.ok) {
    return { kind: "local", dockerHost: "", label: "local Docker", version: local.version };
  }
  notes.push(`local Docker: ${describeDockerFailure(local)}`);

  throw new Error(
    `No Docker engine is reachable. Start the SSH tunnel to the remote daemon (${tunnel}) or start local Docker.\n  ${notes.join("\n  ")}`,
  );
}

async function composeInvocation() {
  const plugin = await spawnCommand("docker", ["compose", "version"], { timeoutMs: 5000 });
  if (plugin.code === 0) return { command: "docker", prefix: ["compose"] };

  const standalone = await spawnCommand("docker-compose", ["version"], { timeoutMs: 5000 });
  if (standalone.code === 0) return { command: "docker-compose", prefix: [] };

  throw new Error("Neither `docker compose` nor `docker-compose` is available on PATH.");
}

function splitExtra(extra) {
  const names = [];
  const composeExtras = [];
  for (const arg of extra) {
    if (arg.startsWith("-")) composeExtras.push(arg);
    else names.push(arg);
  }
  const services = resolveApps(names).map((app) => app.service);
  return { services, composeExtras };
}

function composeArgs(flags, services, composeExtras) {
  const base = ["-f", COMPOSE_FILE];
  if (flags.down) {
    if (services.length) {
      throw new Error("--down stops the whole stack; omit app names (or use --status / redeploy a single app).");
    }
    return [...base, "down", ...composeExtras];
  }
  if (flags.status) return [...base, "ps", ...services, ...composeExtras];
  if (flags.buildOnly) return [...base, "build", ...services, ...composeExtras];
  const up = ["up", "-d"];
  if (!flags.noBuild) up.push("--build");
  return [...base, ...up, ...services, ...composeExtras];
}

function printHelp() {
  console.log(HELP);
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) {
    printHelp();
    return 0;
  }

  if (flags.down && (flags.buildOnly || flags.noBuild || flags.status)) {
    throw new Error("--down cannot be combined with --build-only, --no-build, or --status.");
  }
  if (flags.buildOnly && flags.noBuild) {
    throw new Error("Use only one of --build-only or --no-build.");
  }
  if (flags.status && (flags.buildOnly || flags.noBuild)) {
    throw new Error("--status cannot be combined with --build-only or --no-build.");
  }

  if (!existsSync(join(ROOT, COMPOSE_FILE))) {
    throw new Error(`Missing ${COMPOSE_FILE} (run this from the tonyarcher-apps repo).`);
  }

  const { services, composeExtras } = splitExtra(flags.extra);
  const target = await resolveTarget(requestedTarget(flags));
  const compose = await composeInvocation();
  const args = [...compose.prefix, ...composeArgs(flags, services, composeExtras)];
  const printed = [compose.command, ...args].join(" ");
  if (services.length) {
    console.log(`==> Apps: ${services.join(", ")}`);
  }

  console.log(`==> Using ${target.label} (engine ${target.version})`);
  console.log(`==> ${printed}`);

  const result = await spawnCommand(compose.command, args, {
    env: dockerEnv(target.dockerHost),
    inherit: true,
  });
  return result.code;
}

main()
  .then((code) => {
    process.exit(code);
  })
  .catch((error) => {
    console.error(`error: ${error.message}`);
    process.exit(1);
  });
