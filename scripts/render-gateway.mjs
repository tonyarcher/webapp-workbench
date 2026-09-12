#!/usr/bin/env node
/**
 * Render deploy/nginx/default.conf from default.conf.template.
 *
 * Tokens live on their own lines; a token that renders empty drops its line,
 * so the TLS-off output is byte-identical to the plain-HTTP config.
 * Never edit default.conf by hand. Idempotent: run on every deploy.
 *
 * Env (deploy/.env or process environment, which wins):
 *   TLS_HOSTS     comma/space-separated hostnames for the TLS block; empty = off.
 *   TLS_REDIRECT  "1" replaces the port-80 listener with an https redirect stub.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const NGINX_DIR = join(ROOT, "deploy", "nginx");

export function readDotEnv(path) {
  const env = {};
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return env;
  }
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

export function gatewayEnv() {
  return { ...readDotEnv(join(ROOT, "deploy", ".env")), ...process.env };
}

function splitHosts(raw) {
  return raw
    .split(/[\s,]+/)
    .map((h) => h.trim())
    .filter(Boolean);
}

function redirectBlock() {
  return [
    "server {",
    "    listen 80;",
    "    server_name _;",
    "    return 301 https://$host$request_uri;",
    "}",
    "",
  ].join("\n");
}

function certBlock() {
  return [
    "    ssl_certificate /etc/nginx/certs/leaf.crt;",
    "    ssl_certificate_key /etc/nginx/certs/leaf.key;",
    "    ssl_protocols TLSv1.2 TLSv1.3;",
  ].join("\n");
}

export function renderGatewayConf(template, env) {
  const hosts = splitHosts(env.TLS_HOSTS ?? "");
  const tls = hosts.length > 0;
  const redirect = tls && (env.TLS_REDIRECT ?? "0") === "1";
  const values = {
    HTTP_LISTEN: redirect ? "" : "    listen 80;",
    TLS_LISTEN: tls ? "    listen 443 ssl;" : "",
    TLS_CERTS: tls ? certBlock() : "",
    TLS_REDIRECT: redirect ? redirectBlock() : "",
  };
  return template
    .split("\n")
    .map((line) => {
      const token = line.trim();
      if (token.startsWith("@@") && token.endsWith("@@")) {
        const value = values[token.slice(2, -2)];
        // Empty renders drop the line, so TLS-off output has no gaps.
        if (value !== undefined) return value || null;
      }
      return line;
    })
    .filter((line) => line !== null)
    .join("\n");
}

function main() {
  renderGateway();
}

export function renderGateway() {
  const template = readFileSync(join(NGINX_DIR, "default.conf.template"), "utf8");
  const env = gatewayEnv();
  writeFileSync(join(NGINX_DIR, "default.conf"), renderGatewayConf(template, env));
  const hosts = (env.TLS_HOSTS ?? "").split(/[\s,]+/).filter(Boolean);
  console.log(
    hosts.length
      ? `==> gateway TLS on for: ${hosts.join(", ")}`
      : "==> gateway plain HTTP (TLS_HOSTS empty)",
  );
  return env;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
