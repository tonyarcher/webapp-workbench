#!/usr/bin/env node
/**
 * Gateway TLS certificates (LAN and cloud).
 *
 * Local-CA mode (default): mints a local CA once, then a leaf cert covering
 * TLS_HOSTS, into deploy/gateway/certs/ (gitignored). Install ca.crt on each
 * device once; browsers then trust the gateway with no warnings.
 *
 * Provided-cert mode (cloud/LE): set TLS_CERT_FILE + TLS_KEY_FILE to PEM
 * files on this machine; they are copied to leaf.crt/leaf.key.
 *
 * Idempotent: skips work when the leaf already covers TLS_HOSTS. Delete the
 * leaf (or set TLS_FORCE=1) to rotate.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gatewayEnv } from "./render-gateway.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CERT_DIR = join(ROOT, "deploy", "gateway", "certs");
const CA_KEY = join(CERT_DIR, "ca.key");
const CA_CRT = join(CERT_DIR, "ca.crt");
const LEAF_KEY = join(CERT_DIR, "leaf.key");
const LEAF_CRT = join(CERT_DIR, "leaf.crt");

const GIT_WINDOWS_OPENSSL = [
  "C:\\Program Files\\Git\\usr\\bin\\openssl.exe",
  "C:\\Program Files (x86)\\Git\\usr\\bin\\openssl.exe",
];

function findOpenssl() {
  const probed = spawnSync("openssl", ["version"], { encoding: "utf8" });
  if (probed.status === 0) return "openssl";
  if (process.platform === "win32") {
    for (const candidate of GIT_WINDOWS_OPENSSL) {
      if (existsSync(candidate)) return candidate;
    }
  }
  throw new Error(
    "openssl not found. Install Git for Windows (bundles openssl) or OpenSSL, then retry.",
  );
}

function run(openssl, args, opts = {}) {
  const result = spawnSync(openssl, args, { encoding: "utf8", ...opts });
  if (result.status !== 0) {
    throw new Error(`openssl ${args[0]} failed: ${(result.stderr || "").trim()}`);
  }
  return (result.stdout || "").trim();
}

function splitHosts(raw) {
  return raw
    .split(/[\s,]+/)
    .map((h) => h.trim())
    .filter(Boolean);
}

function sanEntry(host) {
  return /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(":") ? `IP:${host}` : `DNS:${host}`;
}

function parseSanOutput(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("X509v3"))
    .flatMap((line) => line.split(","))
    .map((token) => token.trim())
    .filter(Boolean);
}

function leafCovers(openssl, hosts) {
  if (!existsSync(LEAF_CRT) || !existsSync(LEAF_KEY)) return false;
  try {
    run(openssl, ["x509", "-checkend", "0", "-noout", "-in", LEAF_CRT]);
  } catch {
    return false;
  }
  let tokens;
  try {
    tokens = parseSanOutput(run(openssl, ["x509", "-noout", "-ext", "subjectAltName", "-in", LEAF_CRT]));
  } catch {
    return false;
  }
  const have = new Set(tokens.map((t) => t.toLowerCase()));
  return hosts.every((h) => {
    const entry = sanEntry(h);
    const name = entry.slice(entry.indexOf(":") + 1).toLowerCase();
    return have.has(entry.startsWith("IP:") ? `ip address:${name}` : `dns:${name}`);
  });
}

function ensureCa(openssl) {
  if (existsSync(CA_KEY) && existsSync(CA_CRT)) return false;
  console.log("==> minting local gateway CA");
  run(openssl, [
    "req", "-x509", "-newkey", "rsa:2048", "-nodes",
    "-keyout", CA_KEY, "-out", CA_CRT, "-days", "825",
    "-subj", "/CN=workbench-lan-ca",
    "-addext", "basicConstraints=critical,CA:TRUE",
    "-addext", "keyUsage=critical,keyCertSign,cRLSign",
  ]);
  return true;
}

function mintLeaf(openssl, hosts) {
  const csr = join(tmpdir(), `gateway-${process.pid}.csr`);
  const ext = join(tmpdir(), `gateway-${process.pid}.ext`);
  try {
    const san = hosts.map(sanEntry).join(",");
    run(openssl, [
      "req", "-newkey", "rsa:2048", "-nodes",
      "-keyout", LEAF_KEY, "-out", csr,
      "-subj", `/CN=${hosts[0]}`,
      "-addext", `subjectAltName=${san}`,
    ]);
    writeFileSync(ext, `subjectAltName=${san}\nbasicConstraints=CA:FALSE\nextendedKeyUsage=serverAuth\n`);
    run(openssl, [
      "x509", "-req", "-in", csr,
      "-CA", CA_CRT, "-CAkey", CA_KEY, "-CAcreateserial",
      "-out", LEAF_CRT, "-days", "825", "-extfile", ext,
    ]);
  } finally {
    rmSync(csr, { force: true });
    rmSync(ext, { force: true });
  }
}

function main() {
  const env = gatewayEnv();
  const hosts = splitHosts(env.TLS_HOSTS ?? "");
  if (!hosts.length) {
    console.log("==> TLS_HOSTS empty, no certificates needed");
    return { changed: false };
  }
  mkdirSync(CERT_DIR, { recursive: true });
  if (env.TLS_CERT_FILE || env.TLS_KEY_FILE) {
    if (!env.TLS_CERT_FILE || !env.TLS_KEY_FILE) {
      throw new Error("set both TLS_CERT_FILE and TLS_KEY_FILE, or neither (local-CA flow)");
    }
    const before = existsSync(LEAF_CRT) ? readFileSync(LEAF_CRT) : null;
    const beforeKey = existsSync(LEAF_KEY) ? readFileSync(LEAF_KEY) : null;
    const cert = readFileSync(env.TLS_CERT_FILE);
    const key = readFileSync(env.TLS_KEY_FILE);
    const same = before !== null && beforeKey !== null && before.equals(cert) && beforeKey.equals(key);
    if (!same) {
      copyFileSync(env.TLS_CERT_FILE, LEAF_CRT);
      copyFileSync(env.TLS_KEY_FILE, LEAF_KEY);
      console.log(`==> installed provided TLS cert for: ${hosts.join(", ")}`);
    } else {
      console.log(`==> provided TLS cert already installed for: ${hosts.join(", ")}`);
    }
    return { changed: !same };
  }
  const openssl = findOpenssl();
  if (env.TLS_FORCE === "1") {
    rmSync(LEAF_CRT, { force: true });
    rmSync(LEAF_KEY, { force: true });
  }
  if (ensureCa(openssl)) {
    // A fresh CA never signed the old leaf: re-mint so devices trust it.
    rmSync(LEAF_CRT, { force: true });
    rmSync(LEAF_KEY, { force: true });
  }
  if (leafCovers(openssl, hosts)) {
    console.log(`==> gateway leaf cert already covers: ${hosts.join(", ")}`);
    return { changed: false };
  }
  console.log(`==> minting gateway leaf cert for: ${hosts.join(", ")}`);
  mintLeaf(openssl, hosts);
  console.log(`==> trust this CA on each device once: ${CA_CRT}`);
  return { changed: true };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`error: ${error.message}`);
    process.exit(1);
  }
}

export { main as ensureGatewayCerts, parseSanOutput, sanEntry };
