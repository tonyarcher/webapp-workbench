# AGENTS.md

RSS reader UI. Shared TypeScript / Lit / CSS / workflow: repo-root `AGENTS.md`.

The JSON API is `apps/rss-api` (Kotlin, Spring Data JPA, Postgres `rss`).
Do not add Node `pg` here.

## Stack

- Vite + Lit. `@tanstack/query-core`, `@tanstack/virtual-core`, `@tanstack/history`, `idb`.
- Smoke tests with `tsx` (`assert`). Client IndexedDB tests in `db-smoke.ts`.
- PWA: `write-sw.mjs` embeds hashed assets into `dist/sw.js` from `scripts/sw.template.js`.

## Commands

```bash
npm run dev          # Vite (proxies /api → :3001)
npm run build        # tsc --noEmit && vite build && node scripts/write-sw.mjs
npm run preview      # production build (PWA / install checks)
npm run test         # smoke + db-smoke
```

API: `npm run dev -w rss-api` (or root `npm run dev:rss-api`).

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
