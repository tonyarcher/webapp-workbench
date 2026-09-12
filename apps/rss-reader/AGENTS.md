# AGENTS.md

RSS reader UI. Shared TypeScript / Lit / CSS / workflow: repo-root `AGENTS.md`.

The JSON API is `apps/rss-api` (Kotlin, Spring Data JPA, Postgres `rss`).
Every reader signs in through `user-api` (OAuth2 Code + PKCE, `user-client`
helpers). API calls carry `Authorization: Bearer`. Do not add Node `pg` here.

## Stack

- Vite + Lit. `@tanstack/query-core`, `@tanstack/virtual-core`, `@tanstack/history`, `idb`.
- Smoke tests with `tsx` (`assert`). Client IndexedDB tests in `db-smoke.ts`.
- PWA: `write-sw.mjs` embeds hashed assets into `dist/sw.js` from `scripts/sw.template.js`.

## Commands

```bash
npm run dev          # Vite (proxies /api → :3001, /user-api → :3004)
npm run build        # tsc --noEmit && vite build && node scripts/write-sw.mjs
npm run preview      # production build (PWA / install checks)
npm run test         # smoke + db-smoke
```

API: `npm run dev -w rss-api` (or root `npm run dev:rss-api`).
Identity: `npm run dev -w user-api` (`:3004`, same port the Vite proxy uses).

## Auth

- `src/services/auth.ts` — PKCE login, token storage (localStorage), refresh.
  `app-shell` gates on a session and clears IndexedDB + query cache on sign-out
  or session death so cached articles never leak across accounts on one browser.
  Ingest skips IDB writes when the auth epoch changed mid-sync.
- Plain-HTTP LAN origins have no WebCrypto: `user-client` falls back to its
  built-in SHA-256 for the S256 challenge (same proof, no new dependency).
  Every origin still needs its own `oauth_redirect_uris` row for client
  `rss-reader` (production adds rows, not code).
- The OAuth `redirect_uri` is the app root (`/rss-reader/` behind the gateway).
  It must match a row in `oauth_redirect_uris` for client `rss-reader`
  (production adds rows, not code). `npm run dev` on another origin needs its
  own row in the local `users` database.

## Architecture

- `src/types.ts` — shared domain types.
- `src/db/` — IndexedDB via `idb`. All client reads/writes go through here.
- `src/services/` — parser, ranking, sync, opml, proxy; no DOM.
- `src/web-components/<name>/` — local unprefixed UI (`app-shell`, `today-view`, …). Not a shared library.
- `src/query.ts` / `src/mutations.ts` — query keys and mutations.
- `src/router.ts` — hash router; a `View` union drives the app.

## Data & state

- Client state flows through TanStack Query; components do not hold shared data.
- Query / idb keys must include every parameter the queryFn closes over.
- Mutations update the DB, then `invalidateQueries`.
- Feed URLs are untrusted: never pass them to `unsafeHTML` / `href` / `img` without sanitizing.

## Blocking

- Raw IndexedDB outside `src/db/`.
- API/schema changes need assertions in `apps/rss-api` tests.
- Changes to `src/services/*`, `src/db/*` need assertions in `scripts/smoke.ts` or `scripts/db-smoke.ts`.
