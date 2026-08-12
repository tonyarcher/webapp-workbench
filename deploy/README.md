# Deployment

Docker Compose stack that runs a reverse-proxy gateway in front of the Baseball
app. It is designed to run on a remote Ubuntu host with Docker (or K3s / a
Docker-compatible container runtime) already installed.

> Status: the monorepo migration moved Baseball to `apps/baseball/` and the
> gateway stack paths (Dockerfile `COPY`/`npm ci` steps, compose build contexts)
> still need updating for the new layout. Deployment work is deferred; do not
> use this stack until `deploy/` is reworked for the monorepo structure.

## Layout

- `docker-compose.yml` — the stack definition.
- `nginx/default.conf` — gateway config copied into the `gateway` image.
- `hello/index.html` — static hello-world page copied into the `gateway` image and served at the root `/`.
- `gateway/` — Dockerfile that builds the `gateway` image from the `deploy/` context.
- `baseball/` — Dockerfile + nginx config for the Baseball app.

## Routes

| Route | Target |
|---|---|
| `/` | hello-world page |
| `/baseball/` | Baseball app (prefix stripped) |
| `/stock-game/` | placeholder — no service yet |
| `/lemmy-vertical-scroll/` | placeholder — no service yet |
| `/rss-reader/` | placeholder — no service yet |

The three placeholder routes are defined in the gateway config and resolved at
runtime via Docker DNS. The gateway starts even though those services are not
defined; requests to them return `502` until a matching service exists.

## Build and run

From the `deploy/` directory (or from the repo root with
`docker compose -f deploy/docker-compose.yml`):

```sh
docker compose build
docker compose up -d
```

The gateway listens on port `80`. Visit `http://<host>/` for the hello page and
`http://<host>/baseball/` for the app.

## Remote Docker daemon (SSH tunnel)

The gateway config and hello page are baked into the `gateway` image (no bind
mounts), and the `baseball` build uses a build context from the repo root. Both
are pushed through the Docker client to the remote daemon, so you can drive a
remote server from WSL or any machine.

Set `DOCKER_HOST` to point at the SSH-tunneled daemon, then build/up from the
repo root or the `deploy/` directory:

```sh
# In a terminal with an SSH tunnel exposing the remote daemon on
# 127.0.0.1:2375, point the Docker client at it:
export DOCKER_HOST=tcp://127.0.0.1:2375

# From the deploy/ directory:
docker compose build
docker compose up -d

# Or from the repo root:
docker compose -f deploy/docker-compose.yml build
docker compose -f deploy/docker-compose.yml up -d
```

Image builds send the whole build context through the tunnel to the remote
daemon, which assembles and runs the builds there. Use `docker compose up -d
--build` to rebuild and recreate, and `docker compose ps` to inspect state.

## Enabling a placeholder route

Each placeholder expects a service whose hostname matches the route name and
which listens on port `3000`. To enable one, add a service to
`docker-compose.yml`. For example, for `/stock-game/`:

```yaml
  stock-game:
    image: your-stock-game-image:tag   # or build: ...
    restart: unless-stopped
    networks:
      - baseball
```

No gateway changes are required — the route name and service name already
match. If a service needs a different hostname or port, update the matching
`set $upstream_*` variable in `deploy/nginx/default.conf` accordingly.
