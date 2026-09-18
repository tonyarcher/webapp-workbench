"""Render deploy/nginx/default.conf from default.conf.template.

Tokens live on their own lines; a token that renders empty drops its line,
so the TLS-off output is byte-identical to the plain-HTTP config.
Never edit default.conf by hand. Idempotent: run on every deploy.

Run: `python3 scripts/render_gateway.py` (renders in place).
Env (deploy/.env or process environment, which wins):
  TLS_HOSTS     comma/space-separated hostnames for the TLS block; empty = off.
  TLS_REDIRECT  "1" replaces the port-80 listener with an https redirect stub.
Only stdlib is used.
"""

from __future__ import annotations

import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NGINX_DIR = os.path.join(ROOT, "deploy", "nginx")


def read_dotenv(path: str) -> dict[str, str]:
    """Parse a KEY=value file; missing file yields {}."""
    env: dict[str, str] = {}
    try:
        with open(path, encoding="utf-8") as handle:
            text = handle.read()
    except OSError:
        return env
    for line in text.splitlines():
        trimmed = line.strip()
        if not trimmed or trimmed.startswith("#"):
            continue
        eq = trimmed.find("=")
        if eq < 0:
            continue
        key = trimmed[:eq].strip()
        value = trimmed[eq + 1 :].strip()
        if len(value) >= 2 and (
            (value.startswith('"') and value.endswith('"'))
            or (value.startswith("'") and value.endswith("'"))
        ):
            value = value[1:-1]
        env[key] = value
    return env


def gateway_env() -> dict[str, str]:
    """deploy/.env values overridden by the process environment."""
    merged = read_dotenv(os.path.join(ROOT, "deploy", ".env"))
    merged.update(os.environ)
    return merged


def split_hosts(raw: str) -> list[str]:
    """Split comma/space-separated hostnames, dropping empties."""
    return [host.strip() for host in raw.replace(",", " ").split() if host.strip()]


def redirect_block() -> str:
    """Port-80 https redirect stub (TLS_REDIRECT=1)."""
    return "\n".join(  # noqa: FLY002 - literal nginx block; join mirrors the upstream mjs array
        [
            "server {",
            "    listen 80;",
            "    server_name _;",
            "    return 301 https://$host$request_uri;",
            "}",
            "",
        ]
    )


def cert_block() -> str:
    """In-server TLS certificate stanza."""
    return "\n".join(  # noqa: FLY002 - literal nginx stanza; join mirrors the upstream mjs array
        [
            "    ssl_certificate /etc/nginx/certs/leaf.crt;",
            "    ssl_certificate_key /etc/nginx/certs/leaf.key;",
            "    ssl_protocols TLSv1.2 TLSv1.3;",
        ]
    )


def render_gateway_conf(template: str, env: dict[str, str]) -> str:
    """Substitute @@TOKENS@@; unknown tokens pass through untouched."""
    hosts = split_hosts(env.get("TLS_HOSTS", ""))
    tls = len(hosts) > 0
    redirect = tls and env.get("TLS_REDIRECT", "0") == "1"
    values = {
        "HTTP_LISTEN": "" if redirect else "    listen 80;",
        "TLS_LISTEN": "    listen 443 ssl;" if tls else "",
        "TLS_CERTS": cert_block() if tls else "",
        "TLS_REDIRECT": redirect_block() if redirect else "",
    }
    out: list[str] = []
    for line in template.split("\n"):
        token = line.strip()
        if token.startswith("@@") and token.endswith("@@") and len(token) > 4:
            value = values.get(token[2:-2])
            # Empty renders drop the line, so TLS-off output has no gaps.
            if value is not None:
                if value:
                    out.append(value)
                continue
        out.append(line)
    return "\n".join(out)


def render_gateway() -> dict[str, str]:
    """Render default.conf in place and report the TLS mode."""
    with open(
        os.path.join(NGINX_DIR, "default.conf.template"), encoding="utf-8"
    ) as handle:
        template = handle.read()
    env = gateway_env()
    with open(
        os.path.join(NGINX_DIR, "default.conf"), "w", encoding="utf-8", newline="\n"
    ) as handle:
        handle.write(render_gateway_conf(template, env))
    hosts = split_hosts(env.get("TLS_HOSTS", ""))
    if hosts:
        print(f"==> gateway TLS on for: {', '.join(hosts)}")
    else:
        print("==> gateway plain HTTP (TLS_HOSTS empty)")
    return env


if __name__ == "__main__":
    render_gateway()
