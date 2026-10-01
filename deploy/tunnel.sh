#!/usr/bin/env bash
# Robust SSH tunnel to the remote Docker engine for deploys.
#
# The deploy script expects a tunnel on tcp://127.0.0.1:2375. This sets one up,
# clearing out any stale tunnel on that port first, and retries on failure so a
# transient SSH hiccup does not leave the deploy blocked.
#
# Usage: bash deploy/tunnel.sh [up|down|status]
#   up     (default) clear the port, start the tunnel, verify it answers
#   down   stop the tunnel and clear the port
#   status report whether the tunnel is listening
#
# Config comes from ops-scripts/sites/vpn/.env (VPN_HOST, VPN_DEPLOY_USER,
# VPN_DEPLOY_SSH_PORT, VPN_DEPLOY_SSH_KEY). Override any of them inline.
#
# This is a bash script. Run it on WSL (bash deploy/tunnel.sh, or via
# ubuntu.exe) or from git bash on Windows.

set -euo pipefail

LOCAL_PORT="${DOCKER_TUNNEL_PORT:-2375}"
REMOTE_SOCK="${REMOTE_DOCKER_SOCK:-/var/run/docker.sock}"
CONFIG="${VPN_CONFIG:-/mnt/c/Users/tony/projects/ops-scripts/sites/vpn/.env}"
ACTION="${1:-up}"

# Read a value from the config without bash's backslash processing, so a
# Windows path like C:\Users\tony\.ssh\id_ed25519 survives intact.
env_value() {
    [[ -f "$CONFIG" ]] || return 0
    grep "^$1=" "$CONFIG" 2>/dev/null | head -1 | cut -d= -f2- || true
}

# Convert a Windows path (C:\Users\...) to a WSL path (/mnt/c/Users/...).
# Leaves paths that are already POSIX untouched.
to_wsl_path() {
    local win="$1"
    if [[ "$win" == [A-Za-z]:* ]]; then
        local drive="${win:0:1}"
        local rest="${win:2}"
        rest="${rest//\\//}"
        echo "/mnt/$(echo "$drive" | tr '[:upper:]' '[:lower:]')$rest"
    else
        echo "$win"
    fi
}

HOST="${VPN_HOST:-$(env_value VPN_HOST)}"
HOST="${HOST:?VPN_HOST not set (set it inline or point VPN_CONFIG at the vpn .env)}"
USER_NAME="${VPN_DEPLOY_USER:-$(env_value VPN_DEPLOY_USER)}"
USER_NAME="${USER_NAME:-tony}"
PORT="${VPN_DEPLOY_SSH_PORT:-$(env_value VPN_DEPLOY_SSH_PORT)}"
PORT="${PORT:-22}"
KEY="$(env_value VPN_DEPLOY_SSH_KEY)"
KEY="${KEY:-$HOME/.ssh/id_ed25519}"
KEY=$(to_wsl_path "$KEY")

# /mnt/c does not support the private permissions ssh requires, so a key on the
# Windows filesystem is copied to the WSL filesystem with 600 first.
if [[ "$KEY" == /mnt/c/* ]]; then
    mkdir -p "$HOME/.ssh"
    wsl_key="$HOME/.ssh/$(basename "$KEY")"
    cp "$KEY" "$wsl_key"
    chmod 600 "$wsl_key"
    KEY="$wsl_key"
fi

tunnel_listening() {
    ss -tln 2>/dev/null | grep -q ":${LOCAL_PORT} "
}

# Clear whatever currently holds the local port, so a stale or half-open tunnel
# from a previous run does not make the new one look broken. fuser is the
# reliable path; fall back to lsof, then to ss.
clear_port() {
    if command -v fuser >/dev/null 2>&1; then
        fuser -k "${LOCAL_PORT}/tcp" >/dev/null 2>&1 || true
    elif command -v lsof >/dev/null 2>&1; then
        lsof -ti "tcp:${LOCAL_PORT}" 2>/dev/null | xargs -r kill 2>/dev/null || true
    else
        local pid
        pid=$(ss -tlnp 2>/dev/null | grep ":${LOCAL_PORT} " | grep -oP 'pid=\K[0-9]+' | head -1)
        if [[ -n "${pid:-}" ]]; then
            kill "$pid" 2>/dev/null || true
        fi
    fi
    sleep 1
}

case "$ACTION" in
down)
    clear_port
    echo "tunnel on :${LOCAL_PORT} cleared"
    ;;
status)
    if tunnel_listening; then
        echo "tunnel on :${LOCAL_PORT} is up"
    else
        echo "tunnel on :${LOCAL_PORT} is down"
    fi
    ;;
up)
    clear_port
    for attempt in 1 2 3; do
        echo "tunnel attempt ${attempt}/3 to ${USER_NAME}@${HOST}:${PORT} (key ${KEY}) ..."
        # setsid detaches ssh from this shell so it survives the script
        # exiting; without it the tunnel gets SIGHUP and dies with the
        # wsl -e invocation that started it.
        setsid ssh -N -L "${LOCAL_PORT}:${REMOTE_SOCK}" -p "$PORT" -i "$KEY" \
            -o ServerAliveInterval=30 -o ServerAliveCountMax=3 \
            -o ExitOnForwardFailure=yes \
            "${USER_NAME}@${HOST}" >/dev/null 2>&1 &
        tunnel_pid=$!
        sleep 4
        if tunnel_listening; then
            echo "tunnel up (pid ${tunnel_pid}); remote docker engine at tcp://127.0.0.1:${LOCAL_PORT}"
            exit 0
        fi
        echo "  attempt ${attempt} did not come up; clearing and retrying"
        kill "$tunnel_pid" 2>/dev/null || true
        wait "$tunnel_pid" 2>/dev/null || true
        clear_port
    done
    echo "tunnel failed after 3 attempts; check VPN connectivity to ${HOST}:${PORT}" >&2
    exit 1
    ;;
*)
    echo "usage: bash deploy/tunnel.sh [up|down|status]" >&2
    exit 2
    ;;
esac
