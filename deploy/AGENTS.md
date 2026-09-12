# AGENTS.md

Docker Compose reverse-proxy stack. Workflow and monorepo rules: repo-root `AGENTS.md`.

## Layout

- `docker-compose.yml` — gateway + app services.
- `nginx/default.conf` — gateway routes. Generated from
  `default.conf.template` on every deploy run (never edit it); the template
  gains a 443 server + cert paths only when `TLS_HOSTS` is set. Prefix stripped
  for static apps (including `/stock-game/`).
- `gateway/certs/` — leaf cert/key baked into the image, plus the local CA.
  Generated, gitignored (`.gitkeep` keeps the dir). Never commit keys.
- `hello/index.html` — page at `/`. Link **text** is the project name (Baseball, RSS Reader, …); `href` stays the subpath (`/auth/` for Accounts).
- Per-app Dockerfiles under `deploy/<app>/`. Build context is the **repo root**.
- Node/static images compile inside Linux. **user-api** compiles on the host
  JDK (`gradlew installDist`); **fitness-api**, **rss-api**, and **stock-game-api**
  use `bootJar`. Each image is **JRE only**. Do not run Gradle or install a JDK
  in those images.

## Commands

From repo root: `./deploy.sh` or `.\deploy.ps1` (optional app name to rebuild one service).

## Services

Identity is `user-api`. Each product API is its own compose service and
database (`fitness-api` / `fitness`, `rss-api` / `rss`, `stock-game-api` / `stock`, …). Gateway: one
prefix per UI and per API. Do not route product data through `user-api`.
OAuth redirect URIs live in `oauth_redirect_uris`. If `WEBAUTHN_ORIGINS`
is not localhost/127.0.0.1, add matching redirect rows for that origin;
do not expect Kotlin to derive them from the env.

## Rules

- Do not move `deploy/` or change compose contexts without checking every image still builds.
- App images listen on `3000` internally. Gateway publishes host `80` always
  and `443` (bound even with TLS off — free the host port or drop the mapping
  if something else holds 443).
- `APP_BASE_PATH` is baked in at image build so assets and service workers work under the subpath.
- Secrets: `deploy/.env` from `deploy/.env.example` (gitignored). Compose interpolates `${POSTGRES_*}` from that file at **run** (project-directory `.env`, not an image `COPY`). Never commit it.
