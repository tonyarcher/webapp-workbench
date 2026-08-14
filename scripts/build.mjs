#!/usr/bin/env node
/**
 * Local npm production build for every workspace, or only the named apps.
 * App names match deploy (baseball, rss, stock, lemmy, …) and pull in
 * library workspaces those apps need.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { formatAppList, resolveApp, resolveApps, workspacesFor } from "./apps.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const HELP = `
Build npm workspaces locally from the repo root.

Docker image builds happen in deploy, not here. To rebuild and roll out one
app:  ./deploy.sh rss-reader   (or .\\deploy.ps1 rss-reader)

Usage:
  build.sh | build.ps1 [app...]

Apps:
${formatAppList()}

Examples:
  ./build.sh
  ./build.sh baseball
  ./build.sh rss lemmy
`.trim();

function spawnNpm(args) {
  return new Promise((resolve) => {
    const child = spawn("npm", args, {
      cwd: ROOT,
      stdio: "inherit",
      shell: process.platform === "win32",
      windowsHide: true,
    });
    child.on("error", (error) => {
      console.error(`error: ${error.message}`);
      resolve(1);
    });
    child.on("close", (code) => resolve(code ?? 1));
  });
}

function parseArgs(argv) {
  const names = [];
  for (const arg of argv) {
    if (arg === "-h" || arg === "--help") return { help: true, names: [] };
    names.push(arg);
  }
  return { help: false, names };
}

async function main() {
  const { help, names } = parseArgs(process.argv.slice(2));
  if (help) {
    console.log(HELP);
    return 0;
  }

  if (!existsSync(join(ROOT, "node_modules"))) {
    console.log("==> npm install (node_modules missing)");
    const installed = await spawnNpm(["install"]);
    if (installed !== 0) return installed;
  }

  if (names.length === 0) {
    console.log("==> npm run build");
    return spawnNpm(["run", "build"]);
  }

  const known = names.filter((name) => resolveApp(name));
  const unknown = names.filter((name) => !resolveApp(name));
  const apps = resolveApps(known);
  const workspaces = [...workspacesFor(apps), ...unknown];

  if (workspaces.length === 0) {
    const onlyGateway = apps.length > 0 && apps.every((app) => app.workspaces.length === 0);
    if (onlyGateway) {
      console.log("==> gateway has no npm workspace; use ./deploy.sh --build-only gateway");
      return 0;
    }
    throw new Error(`Nothing to build for: ${names.join(", ")}`);
  }

  for (const workspace of workspaces) {
    console.log(`==> npm run build -w ${workspace}`);
    const code = await spawnNpm(["run", "build", "-w", workspace]);
    if (code !== 0) return code;
  }
  return 0;
}

main()
  .then((code) => {
    process.exit(code);
  })
  .catch((error) => {
    console.error(`error: ${error.message}`);
    process.exit(1);
  });
