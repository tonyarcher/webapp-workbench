# Deployment

Docker Compose stack that runs a reverse-proxy gateway in front of seven
SPA apps (Baseball, RSS Reader, Stock Game, Lemmy Vertical Scroll, Clipstack,
Calendar Sync, Radio Station). It is
designed to run on a remote Ubuntu host with Docker (or K3s / a
Docker-compatible container runtime) already installed.

## Layout

- `docker-compose.yml` — the stack definition.
- `nginx/default.conf` — gateway config copied into the `gateway` image.
- `hello/index.html` — static hello-world page copied into the `gateway` image and served at the root `/`.
- `gateway/` — Dockerfile that builds the `gateway` image from the `deploy/` context.
- `baseball/`, `rss-reader/`, `lemmy-vertical-scroll/`, `clipstack/`, `calendar-sync/`, `radio-station/` — Dockerfiles + nginx configs for the static apps. Calendar Sync also proxies `/api/trakt/` to api.trakt.tv.
- `radio-api/` — Dockerfile for the Radio Station node API. On startup it creates the `radio` Postgres database if the volume predates this service.
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
| `/clipstack/` | Clipstack (nginx static, prefix stripped) |
| `/calendar-sync/` | Calendar Sync (nginx static + Trakt proxy, prefix stripped) |
| `/radio-station/` | Radio Station (nginx static, prefix stripped) |
| `/radio-station/api/` | Radio Station API (node, prefix stripped). Creates Postgres database `radio` on startup. |

The bare paths (e.g. `/stock-game`) redirect to their trailing-slash forms.
Each app is served under its own subpath with the base baked in at build time
(`APP_BASE_PATH`), so relative assets, manifests, and service workers resolve
correctly behind the gateway.

## How each app is served

- **Baseball, RSS Reader, Lemmy Vertical Scroll, Clipstack, Calendar Sync, Radio Station** are static Vite builds served
  by an nginx container. The gateway strips the app's prefix and nginx serves
  the built `dist/` at the root, with gzip, an SPA fallback to `index.html`,
  no-cache for the shell/service worker, and long-lived immutable caching for
  hashed `/assets/`. Calendar Sync's nginx also reverse-proxies `/api/trakt/`
  to `https://api.trakt.tv` (Trakt has no CORS).
- **Stock Game** runs a TanStack Start app (SPA mode with server functions).
  Its build is served by the built-in fetch handler, hosted by
  `server-host.mjs` (a plain Node HTTP server with no dependencies). It reads
  `PORT` (default `3000`), `STOCK_GAME_DB` for its SQLite database, and
  `APP_BASE_PATH` (`/stock-game/`) so static client files are served under the
  base path.

## Build and run

From the repo root, use the OS deploy script. It rebuilds images and starts
the stack, and it picks a Docker engine automatically (see below):

```sh
./deploy.sh            # Linux / macOS / Git Bash
.\deploy.ps1           # Windows PowerShell
npm run deploy         # same entry point
```

Useful flags:

```sh
./deploy.sh --local            # force the local Docker engine
./deploy.sh --remote           # force the SSH-tunneled remote engine
./deploy.sh --no-build         # start without rebuilding images
./deploy.sh --build-only       # build images only
./deploy.sh --status           # docker compose ps
./deploy.sh --down             # stop and remove the stack
```

## One app

Pass an app name to rebuild that image and recreate only that service.
Do this from the repo root — not from `apps/<name>/`. The Dockerfiles use
the monorepo as the build context, and tunnel vs local Docker lives in
one place.

```sh
./deploy.sh rss                # rebuild + roll out rss-reader
./deploy.sh baseball           # also accepted: baseball-tracker
./deploy.sh lemmy stock
./deploy.sh --remote rss
./deploy.sh --build-only lemmy
```

Short names: `baseball`, `rss`, `stock`, `lemmy`, `clipstack`, `calendar`, `gateway`.

A local `./build.sh rss` compiles that workspace on this machine. It is
optional before deploy: each image already runs `npm install` / `npm run
build` inside Docker (needed for Linux native binaries). Use the local
build when you want a faster typecheck/compile before sending context
through the tunnel.

The gateway listens on port `80`. Visit `http://<host>/` for the hello page and
`http://<host>/baseball/` (plus `/rss-reader/`, `/stock-game/`,
`/lemmy-vertical-scroll/`, `/clipstack/`, `/calendar-sync/`, `/radio-station/`) for the apps.

## Remote Docker daemon (SSH tunnel)

The gateway config and hello page are baked into the `gateway` image (no bind
mounts), and each app build uses a build context from the repo root. All of it
is pushed through the Docker client to the remote daemon, so you can drive a
remote server from WSL or any machine.

If an SSH tunnel is already exposing the remote daemon on `127.0.0.1:2375`,
`./deploy.sh` / `.\deploy.ps1` uses it. Otherwise they fall back to local
Docker. Override with `--local`, `--remote`, `DEPLOY_TARGET`, or `DOCKER_HOST`.

```sh
# Optional: expose the remote daemon yourself, then deploy.
# The script also detects this tunnel without setting DOCKER_HOST.
ssh -N -L 2375:/var/run/docker.sock user@remote-host

./deploy.sh --remote
```

`DOCKER_TUNNEL` changes the tunnel URL (default `tcp://127.0.0.1:2375`). A
root `.dockerignore` keeps `node_modules/`, `dist/`, and `.git` out of the
build context so tunnel uploads stay small.

## Data

Stock Game stores its SQLite database at `/app/data/stock-game.db` inside its
container (ephemeral unless a volume is mounted there). The nginx-served apps
are stateless.
