# Deployment

Docker Compose stack that runs a reverse-proxy gateway in front of nine
SPA apps (Baseball, RSS Reader, Stock Game, Lemmy Vertical Scroll, Clipstack,
Calendar Sync, Radio Station, Football, Fitness). It is
designed to run on a remote Ubuntu host with Docker (or K3s / a
Docker-compatible container runtime) already installed.

## Layout

- `docker-compose.yml` — the stack definition. The gateway always publishes
  host ports `80` and `443`; with TLS off nothing listens on 443, but Docker
  still binds the host port — if yours is taken, comment out the `443:443`
  mapping (or stop the other listener) before `up`.
- `nginx/default.conf.template` — gateway config template. Rendered to
  `nginx/default.conf` (gitignored, never edit it) on every deploy run;
  direct `docker compose` on a fresh clone needs `node scripts/render-gateway.mjs` first.
- `hello/index.html` — static hello-world page copied into the `gateway` image and served at the root `/`.
- `gateway/` — Dockerfile that builds the `gateway` image from the `deploy/` context.
- `baseball/`, `rss-reader/`, `lemmy-vertical-scroll/`, `clipstack/`, `calendar-sync/`, `radio-station/`, `football/`, `fitness/` — Dockerfiles + nginx configs for the static apps. Calendar Sync also proxies `/api/trakt/` to api.trakt.tv.
- `radio-api/` — Dockerfile for the Radio Station node API. On startup it creates the `radio` Postgres database if the volume predates this service.
- `fitness-api/` — JRE image for the Fitness Kotlin API. Compile on the host JDK (`gradle bootJar`); the image copies the jar. Creates the `fitness` Postgres database on startup.
- `stock-game-api/` — JRE image for the Stock Game Kotlin API. Compile on the host JDK (`gradle bootJar`); the image copies the jar. Creates the `stock` Postgres database on startup.
- `stock-game/` — Dockerfile + `nginx.conf`, a static Vite SPA build served
  under `/stock-game/` (prefix stripped by the gateway). The JSON API is
  `stock-game-api` (Kotlin, Postgres `stock`).

All app Dockerfiles use the repo root as the build context (`context: ..` in
compose). Inside the containers the Windows-generated lockfile is discarded
and dependencies are resolved fresh (npm records only the generating
platform's native binaries — issue npm/cli#4828), so the images install the
correct Linux binaries. Each app container listens on port `3000` internally;
the gateway strips the prefix for the static apps. The `gateway` image is
built from the `deploy/` context.

## Routes

| Route | Target |
|---|---|
| `/` | hello-world page |
| `/baseball/` | Baseball app (nginx static, prefix stripped) |
| `/rss-reader/` | RSS Reader (nginx static, prefix stripped) |
| `/stock-game/` | Stock Game (nginx static, prefix stripped; hash routes) |
| `/lemmy-vertical-scroll/` | Lemmy Vertical Scroll (nginx static, prefix stripped) |
| `/clipstack/` | Clipstack (nginx static, prefix stripped) |
| `/calendar-sync/` | Calendar Sync (nginx static + Trakt proxy, prefix stripped) |
| `/radio-station/` | Radio Station (nginx static, prefix stripped) |
| `/radio-station/api/` | Radio Station API (node, prefix stripped). Creates Postgres database `radio` on startup. |
| `/football/` | Football tracker (nginx static, prefix stripped) |
| `/fitness/` | Fitness (nginx static, prefix stripped) |
| `/fitness/api/` | Fitness API (Kotlin, prefix stripped). Creates Postgres database `fitness` on startup. |

The bare paths (e.g. `/stock-game`) redirect to their trailing-slash forms.
Each app is served under its own subpath with the base baked in at build time
(`APP_BASE_PATH`), so relative assets, manifests, and service workers resolve
correctly behind the gateway.

## How each app is served

- **Baseball, RSS Reader, Stock Game, Lemmy Vertical Scroll, Clipstack, Calendar Sync, Radio Station, Football, Fitness** are static Vite builds served
  by an nginx container. The gateway strips the app's prefix and nginx serves
  the built `dist/` at the root, with gzip, an SPA fallback to `index.html`,
  no-cache for the shell/service worker, and long-lived immutable caching for
  hashed `/assets/`. Calendar Sync's nginx also reverse-proxies `/api/trakt/`
  to `https://api.trakt.tv` (Trakt has no CORS).

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

The gateway listens on port `80` (plus `443` when `TLS_HOSTS` is set — see
HTTPS below). Visit `http://<host>/` for the hello page and
`http://<host>/baseball/` (plus `/rss-reader/`, `/stock-game/`,
`/lemmy-vertical-scroll/`, `/clipstack/`, `/calendar-sync/`, `/radio-station/`, `/football/`, `/fitness/`) for the apps.

## HTTPS: LAN deploy vs cloud deploy

The gateway serves plain HTTP unless `TLS_HOSTS` is set (comma/space-separated
hostnames) in `deploy/.env`. Every deploy renders
`deploy/nginx/default.conf` from `default.conf.template` — never edit the
rendered file — and mints or installs certificates before building the gateway
image, so remote daemons work too. Use a **hostname**, never a bare IP:
browsers only do passkeys on a registrable hostname. Passkeys additionally need
`https://` (or `localhost`); plain HTTP on a LAN IP gets passwords only.

### LAN deploy (local CA)

Pick a hosts-file name, e.g. `workbench.lan`:

1. Point it at the host. On each device, as admin:
   - Windows: `Add-Content "$env:SystemRoot\System32\drivers\etc\hosts" "`n10.0.0.63`tworkbench.lan"`
   - Linux/macOS: `echo '10.0.0.63 workbench.lan' | sudo tee -a /etc/hosts`
2. In `deploy/.env`:
   ```
   TLS_HOSTS=workbench.lan
   WEBAUTHN_RP_ID=workbench.lan
   WEBAUTHN_ORIGINS=https://workbench.lan
   ```
3. Deploy. The script mints a local CA and a leaf cert into
   `deploy/gateway/certs/` (gitignored) and bakes the leaf into the image.
4. Trust the CA once per device:
   - Windows (admin): `certutil -addstore Root deploy\gateway\certs\ca.crt`
   - Linux: copy `ca.crt` to `/usr/local/share/ca-certificates/` then `sudo update-ca-certificates`
   - macOS: `sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain deploy/gateway/certs/ca.crt`
5. Register the origin with identity (DB rows, not code):
   ```sql
   INSERT INTO oauth_redirect_uris (client_id, redirect_uri)
     VALUES ('rss-reader', 'https://workbench.lan/rss-reader/') ON CONFLICT DO NOTHING;
   ```
   (Repeat per app origin; run with `docker compose exec postgres psql -U rss -d users`.)
6. Browse `https://workbench.lan/`. Set `TLS_REDIRECT=1` to send port-80 stragglers to https.

Delete the leaf (or set `TLS_FORCE=1`) to rotate; the CA persists so devices
keep trusting it.

### Cloud deploy (provided certs)

Point real DNS at the host, terminate issuance wherever you like (e.g.
certbot), and hand the PEM files to the deploy:

```
TLS_HOSTS=app.example.com
TLS_CERT_FILE=/path/to/fullchain.pem
TLS_KEY_FILE=/path/to/privkey.pem
WEBAUTHN_RP_ID=app.example.com
WEBAUTHN_ORIGINS=https://app.example.com
```

Same redirect-row step as LAN, with the `https://` origin. The local CA is
skipped entirely in this mode.

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

Stock Game state lives in the `stock` Postgres database owned by
`stock-game-api`. The nginx-served apps are stateless.
