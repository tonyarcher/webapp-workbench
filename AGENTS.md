# AGENTS.md

Instructions for AI agents working in this monorepo. Keep responses concise and direct.

## Project

npm-workspaces monorepo of small TypeScript web apps (tools and portfolio pieces). All apps are TypeScript + Vite; each app
directory carries its own `AGENTS.md` with its conventions — read it before touching that app.

## Layout

- `apps/baseball/` — Vite + Lit baseball scorekeeping app (`baseball-tracker`), client-side only.
  Depends on `@baseball/web-components` from `packages/web-components`.
- `apps/rss-reader/` — Vite + Lit RSS reader (TanStack core libs, hash router, PWA).
- `apps/stock-game/` — TanStack Start (SPA) + React + Lit paper-trading simulator; nested npm
  workspaces `app/` (`@stock-game/app`) and `shared/` (`@stock-game/shared`); SQLite server layer.
- `apps/lemmy-vertical-scroll/` — Vite + Lit vertical feed scroller. Depends on
  `vertical-scroll-core` from `packages/vertical-scroll-core` (workspace link, was a GitHub git dep).
- `apps/clipstack/` — Clipstack (Vite + Lit short-video list scroller). Depends on
  `vertical-scroll-core`. Import a txt/csv of TikTok/Instagram links and scroll them.
- `apps/calendar-sync/` — Vite + Lit calendar sync (Trakt + Netflix → ICS / Google Calendar).
  Depends on `calendar-core` from `packages/calendar-core`.
- `apps/radio-station/` — Vite + Lit radio-station simulator (`radio-station`). Postgres
  catalog + node API; generate a 7-day Top 40 log.
- `packages/web-components/` — `@baseball/web-components` Lit component library.
- `packages/vertical-scroll-core/` — `vertical-scroll-core` Lit library; `prepare` builds `dist/`
  on install, so consumers must reinstall (or run its `build`) after changes.
- `packages/calendar-core/` — `calendar-core` ICS/Trakt/Netflix/Google Calendar helpers;
  `prepare` builds `dist/` on install.
- `deploy/` — Docker Compose reverse-proxy gateway stack (hello world at `/`, apps under
  `/baseball/`, `/rss-reader/`, `/stock-game/`, `/lemmy-vertical-scroll/`,
  `/clipstack/`, `/calendar-sync/`, `/radio-station/`).

## Commands (run from the repo root)

| Task | Command |
|---|---|
| Install all workspaces | `npm install` |
| Build all | `npm run build` (delegates `--workspaces --if-present`) |
| Test all | `npm test` |
| Typecheck all | `npm run typecheck` |
| Lint all | `npm run lint` |
| Dev server (one app) | `npm run dev:baseball` / `dev:rss-reader` / `dev:stock-game` / `dev:lemmy` / `dev:clipstack` / `dev:calendar-sync` / `dev:radio-station` / `dev:radio-api` |
| Build (OS script) | `./build.sh` or `.\build.ps1` (`./build.sh rss` for one app) |
| Deploy compose stack | `./deploy.sh` or `.\deploy.ps1` (auto local Docker vs SSH tunnel; `./deploy.sh rss` rebuilds one app) |

Per-app commands run inside the app directory (e.g. `cd apps/baseball && npm test`).

Note: root `npm test` also runs `packages/web-components` component tests via
@web/test-runner in real Chromium — on a fresh machine run `npx playwright install`
first (see `packages/web-components/package.json`).

## Git

- `main` holds the migrated monorepo history. Commits are conventional (`feat:`, `fix:`,
  `chore:`, `test:`, `docs:`, `refactor:`).
- Only commit and push when the user explicitly approves. Run the review agent on changes before
  committing.
- History: the repo's original history lives under `apps/baseball/`; the other apps were imported
  with their full histories under their own paths.

## Rules

- Do not edit root `package.json` workspace globs without checking every app still installs.
- Do not reintroduce per-app `package-lock.json` files; the root lockfile is authoritative.
- Keep `deploy/` at the repo root; the compose build contexts assume the repo root.
