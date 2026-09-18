"""Gateway TLS certificates (LAN and cloud).

Local-CA mode (default): mints a local CA once, then a leaf cert covering
TLS_HOSTS, into deploy/gateway/certs/ (gitignored). Install ca.crt on each
device once; browsers then trust the gateway with no warnings.

Provided-cert mode (cloud/LE): set TLS_CERT_FILE + TLS_KEY_FILE to PEM
files on this machine; they are copied to leaf.crt/leaf.key.

Idempotent: skips work when the leaf already covers TLS_HOSTS. Delete the
leaf (or set TLS_FORCE=1) to rotate.

Run: `python3 scripts/gen_certs.py` (usually via deploy.py).
Only stdlib is used (pathlib, shutil, subprocess, tempfile).
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from scripts.render_gateway import gateway_env

CERT_DIR = ROOT / "deploy" / "gateway" / "certs"
CA_KEY = CERT_DIR / "ca.key"
CA_CRT = CERT_DIR / "ca.crt"
LEAF_KEY = CERT_DIR / "leaf.key"
LEAF_CRT = CERT_DIR / "leaf.crt"

GIT_WINDOWS_OPENSSL = [
    "C:\\Program Files\\Git\\usr\\bin\\openssl.exe",
    "C:\\Program Files (x86)\\Git\\usr\\bin\\openssl.exe",
]


def find_openssl() -> str:
    """Locate an openssl binary (PATH, then Git-for-Windows fallbacks)."""
    try:
        probed = subprocess.run(
            ["openssl", "version"], capture_output=True, text=True, check=False
        )
    except OSError:
        probed = None
    if probed is not None and probed.returncode == 0:
        return "openssl"
    if sys.platform == "win32":
        for candidate in GIT_WINDOWS_OPENSSL:
            if Path(candidate).exists():
                return candidate
    raise RuntimeError(
        "openssl not found. Install Git for Windows (bundles openssl) or OpenSSL, then retry."
    )


def run(openssl: str, args: list[str]) -> str:
    """Run openssl, raising on failure; returns trimmed stdout."""
    result = subprocess.run(
        [openssl, *args], capture_output=True, text=True, check=False
    )
    if result.returncode != 0:
        raise RuntimeError(f"openssl {args[0]} failed: {result.stderr.strip()}")
    return result.stdout.strip()


def split_hosts(raw: str) -> list[str]:
    """Split comma/space-separated hostnames, dropping empties."""
    return [host.strip() for host in raw.replace(",", " ").split() if host.strip()]


def san_entry(host: str) -> str:
    """SubjectAltName entry: IP: for literals, DNS: for names."""
    if re.fullmatch(r"\d+\.\d+\.\d+\.\d+", host) or ":" in host:
        return f"IP:{host}"
    return f"DNS:{host}"


def parse_san_output(text: str) -> list[str]:
    """Split openssl subjectAltName output into comparable tokens."""
    tokens: list[str] = []
    for line in text.split("\n"):
        line = line.strip()
        if not line or line.startswith("X509v3"):
            continue
        tokens.extend(token.strip() for token in line.split(","))
    return [token for token in tokens if token]


def leaf_covers(openssl: str, hosts: list[str]) -> bool:
    """True when the leaf exists, is unexpired, and covers every host."""
    if not LEAF_CRT.exists() or not LEAF_KEY.exists():
        return False
    try:
        run(openssl, ["x509", "-checkend", "0", "-noout", "-in", str(LEAF_CRT)])
    except RuntimeError:
        return False
    try:
        tokens = parse_san_output(
            run(
                openssl,
                ["x509", "-noout", "-ext", "subjectAltName", "-in", str(LEAF_CRT)],
            )
        )
    except RuntimeError:
        return False
    have = {token.lower() for token in tokens}
    for host in hosts:
        entry = san_entry(host)
        name = entry.split(":", 1)[1].lower()
        want = f"ip address:{name}" if entry.startswith("IP:") else f"dns:{name}"
        if want not in have:
            return False
    return True


def ensure_ca(openssl: str) -> bool:
    """Mint the local CA if missing. Returns True when it was created."""
    if CA_KEY.exists() and CA_CRT.exists():
        return False
    print("==> minting local gateway CA")
    run(
        openssl,
        [
            "req",
            "-x509",
            "-newkey",
            "rsa:2048",
            "-nodes",
            "-keyout",
            str(CA_KEY),
            "-out",
            str(CA_CRT),
            "-days",
            "825",
            "-subj",
            "/CN=workbench-lan-ca",
            "-addext",
            "basicConstraints=critical,CA:TRUE",
            "-addext",
            "keyUsage=critical,keyCertSign,cRLSign",
        ],
    )
    return True


def mint_leaf(openssl: str, hosts: list[str]) -> None:
    """Mint a leaf cert for hosts, cleaning temp files afterwards."""
    csr = Path(tempfile.gettempdir()) / f"gateway-{os.getpid()}.csr"
    ext = Path(tempfile.gettempdir()) / f"gateway-{os.getpid()}.ext"
    try:
        san = ",".join(san_entry(host) for host in hosts)
        run(
            openssl,
            [
                "req",
                "-newkey",
                "rsa:2048",
                "-nodes",
                "-keyout",
                str(LEAF_KEY),
                "-out",
                str(csr),
                "-subj",
                f"/CN={hosts[0]}",
                "-addext",
                f"subjectAltName={san}",
            ],
        )
        ext.write_text(
            f"subjectAltName={san}\nbasicConstraints=CA:FALSE\nextendedKeyUsage=serverAuth\n",
            encoding="utf-8",
        )
        run(
            openssl,
            [
                "x509",
                "-req",
                "-in",
                str(csr),
                "-CA",
                str(CA_CRT),
                "-CAkey",
                str(CA_KEY),
                "-CAcreateserial",
                "-out",
                str(LEAF_CRT),
                "-days",
                "825",
                "-extfile",
                str(ext),
            ],
        )
    finally:
        csr.unlink(missing_ok=True)
        ext.unlink(missing_ok=True)


def installed_provided_cert(env: dict[str, str], hosts: list[str]) -> bool:
    """Install TLS_CERT_FILE/TLS_KEY_FILE when changed. Returns changed."""
    if not env.get("TLS_CERT_FILE") or not env.get("TLS_KEY_FILE"):
        raise RuntimeError(
            "set both TLS_CERT_FILE and TLS_KEY_FILE, or neither (local-CA flow)"
        )
    before = LEAF_CRT.read_bytes() if LEAF_CRT.exists() else None
    before_key = LEAF_KEY.read_bytes() if LEAF_KEY.exists() else None
    cert = Path(env["TLS_CERT_FILE"]).read_bytes()
    key = Path(env["TLS_KEY_FILE"]).read_bytes()
    same = (
        before is not None
        and before_key is not None
        and before == cert
        and before_key == key
    )
    if not same:
        shutil.copyfile(env["TLS_CERT_FILE"], LEAF_CRT)
        shutil.copyfile(env["TLS_KEY_FILE"], LEAF_KEY)
        print(f"==> installed provided TLS cert for: {', '.join(hosts)}")
    else:
        print(f"==> provided TLS cert already installed for: {', '.join(hosts)}")
    return not same


def ensure_gateway_certs() -> dict[str, bool]:
    """Ensure gateway certs; returns {"changed": ...} for deploy."""
    env = gateway_env()
    hosts = split_hosts(env.get("TLS_HOSTS", ""))
    if not hosts:
        print("==> TLS_HOSTS empty, no certificates needed")
        return {"changed": False}
    CERT_DIR.mkdir(parents=True, exist_ok=True)
    if env.get("TLS_CERT_FILE") or env.get("TLS_KEY_FILE"):
        return {"changed": installed_provided_cert(env, hosts)}
    openssl = find_openssl()
    if env.get("TLS_FORCE") == "1":
        LEAF_CRT.unlink(missing_ok=True)
        LEAF_KEY.unlink(missing_ok=True)
    if ensure_ca(openssl):
        # A fresh CA never signed the old leaf: re-mint so devices trust it.
        LEAF_CRT.unlink(missing_ok=True)
        LEAF_KEY.unlink(missing_ok=True)
    if leaf_covers(openssl, hosts):
        print(f"==> gateway leaf cert already covers: {', '.join(hosts)}")
        return {"changed": False}
    print(f"==> minting gateway leaf cert for: {', '.join(hosts)}")
    mint_leaf(openssl, hosts)
    print(f"==> trust this CA on each device once: {CA_CRT}")
    return {"changed": True}


if __name__ == "__main__":
    try:
        ensure_gateway_certs()
    except Exception as error:  # noqa: BLE001 - CLI boundary reports the error and exits 1
        print(f"error: {error}", file=sys.stderr)
        sys.exit(1)
