# Deployment

Docker Compose stack that runs a reverse-proxy gateway in front of four
SPA apps (Baseball, RSS Reader, Stock Game, Lemmy Vertical Scroll). It is
designed to run on a remote Ubuntu host with Docker (or K3s / a
Docker-compatible container runtime) already installed.

## Layout

- `docker-compose.yml` — the stack definition.
- `nginx/default.conf` — gateway config copied into the `gateway` image.
- `hello/index.html` — static hello-world page copied into the `gateway` image and served at the root `/`.
- `gateway/` — Dockerfile that builds the `gateway` image from the `deploy/` context.
- `baseball/`, `rss-reader/`, `lemmy-vertical-scroll/` — Dockerfiles + nginx configs for the static apps.
- `stock-game/` — Dockerfile + `server-host.mjs`, a tiny dependency-free Node HTTP host that runs the built TanStack Start fetch handler.

All app Dockerfiles use the repo root as the build context (`context: ..` in
compose). Inside the containers the Windows-generated lockfile is discarded
and dependencies are resolved fresh (npm records only the generating
platform's native binaries — issue npm/cli#4828), so the images install the
correct Linux binaries. Each app container listens on port `3000` internally;
the gateway strips the prefix for the static apps and passes `/stock-game/`
through unchanged. The `gateway` image is built from the `deploy/` context.

## Routes

| Route | Target |
|---|---|
| `/` | hello-world page |
| `/baseball/` | Baseball app (nginx static, prefix stripped) |
| `/rss-reader/` | RSS Reader (nginx static, prefix stripped) |
| `/stock-game/` | Stock Game (node server, basepath-aware, prefix NOT stripped) |
| `/lemmy-vertical-scroll/` | Lemmy Vertical Scroll (nginx static, prefix stripped) |

The bare paths (e.g. `/stock-game`) redirect to their trailing-slash forms.
Each app is served under its own subpath with the base baked in at build time
(`APP_BASE_PATH`), so relative assets, manifests, and service workers resolve
correctly behind the gateway.

## How each app is served

- **Baseball, RSS Reader, Lemmy Vertical Scroll** are static Vite builds served
  by an nginx container. The gateway strips the app's prefix and nginx serves
  the built `dist/` at the root, with gzip, an SPA fallback to `index.html`,
  no-cache for the shell/service worker, and long-lived immutable caching for
  hashed `/assets/`.
- **Stock Game** runs a TanStack Start app (SPA mode with server functions).
  Its build is served by the built-in fetch handler, hosted by
  `server-host.mjs` (a plain Node HTTP server with no dependencies). It reads
  `PORT` (default `3000`), `STOCK_GAME_DB` for its SQLite database, and
  `APP_BASE_PATH` (`/stock-game/`) so static client files are served under the
  base path.

## Build and run

From the `deploy/` directory (or from the repo root with
`docker compose -f deploy/docker-compose.yml`):

```sh
docker compose up -d --build
```

The gateway listens on port `80`. Visit `http://<host>/` for the hello page and
`http://<host>/baseball/` (plus `/rss-reader/`, `/stock-game/`,
`/lemmy-vertical-scroll/`) for the apps. Use `docker compose ps` to inspect
state and `docker compose logs -f <service>` to tail a service's logs.

## Remote Docker daemon (SSH tunnel)

The gateway config and hello page are baked into the `gateway` image (no bind
mounts), and each app build uses a build context from the repo root. All of it
is pushed through the Docker client to the remote daemon, so you can drive a
remote server from WSL or any machine.

Set `DOCKER_HOST` to point at the SSH-tunneled daemon, then build/up from the
repo root or the `deploy/` directory:

```sh
# In a terminal with an SSH tunnel exposing the remote daemon on
# 127.0.0.1:2375, point the Docker client at it:
export DOCKER_HOST=tcp://127.0.0.1:2375

# From the deploy/ directory:
docker compose up -d --build

# Or from the repo root:
docker compose -f deploy/docker-compose.yml up -d --build
```

Image builds send the whole build context through the tunnel to the remote
daemon, which assembles and runs the builds there.

## Data

Stock Game stores its SQLite database at `/app/data/stock-game.db` inside its
container (ephemeral unless a volume is mounted there). The nginx-served apps
are stateless.
