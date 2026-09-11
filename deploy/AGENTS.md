# AGENTS.md

Docker Compose reverse-proxy stack. Workflow and monorepo rules: repo-root `AGENTS.md`.

## Layout

- `docker-compose.yml` — gateway + app services.
- `nginx/default.conf` — gateway routes. Prefix stripped for static apps; `/stock-game/` is not.
- `hello/index.html` — page at `/`. Link **text** is the project name (Baseball, RSS Reader, …); `href` stays the subpath (`/auth/` for Accounts).
- Per-app Dockerfiles under `deploy/<app>/`. Build context is the **repo root**.

## Commands

From repo root: `./deploy.sh` or `.\deploy.ps1` (optional app name to rebuild one service).

## Rules

- Do not move `deploy/` or change compose contexts without checking every image still builds.
- App images listen on `3000` internally. Gateway publishes `80`.
- `APP_BASE_PATH` is baked in at image build so assets and service workers work under the subpath.
- Secrets: `deploy/.env` from `deploy/.env.example` (gitignored). Compose interpolates `${POSTGRES_*}` from that file at **run** (project-directory `.env`, not an image `COPY`). Never commit it.
