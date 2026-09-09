# AGENTS.md

RSS reader. Shared TypeScript / Lit / CSS / workflow: repo-root `AGENTS.md`.

## Stack

- Vite + Lit. `@tanstack/query-core`, `@tanstack/virtual-core`, `@tanstack/history`, `idb`.
- Node `http` + `pg` API (`server/`); Postgres on the shared compose instance.
- Smoke tests with `tsx` (`assert`); API integration uses `embedded-postgres`.
- PWA: `write-sw.mjs` embeds hashed assets into `dist/sw.js` from `scripts/sw.template.js`.

## Commands

```bash
npm run dev          # Vite
npm run dev:server   # API (tsx watch server/index.ts)
npm run build        # tsc --noEmit && vite build && node scripts/write-sw.mjs
npm run build:server # tsc -p server/tsconfig.json → dist-server/
npm run preview      # production build (PWA / install checks)
npm run test         # tsc -p scripts/tsconfig.json && smoke + db-smoke + server-smoke + integration
```

## Architecture

- `src/types.ts` — shared domain types.
- `src/db/` — IndexedDB via `idb`. All client reads/writes go through here.
- `src/services/` — parser, ranking, sync, opml, proxy; no DOM.
- `src/web-components/<name>/` — local unprefixed UI (`app-shell`, `today-view`, …). Not a shared library.
- `src/query.ts` / `src/mutations.ts` — query keys and mutations.
- `src/router.ts` — hash router; a `View` union drives the app.
- `server/` — Postgres schema, poller, JSON API. NodeNext `.js` specifiers. No DOM.
- `scripts/` — smoke tests plus `write-sw.mjs`, `sw.template.js`.

## Data & state

- Client state flows through TanStack Query; components do not hold shared data.
- Query / idb keys must include every parameter the queryFn closes over.
- Mutations update the DB, then `invalidateQueries`. Optimistic patches go through helpers like `updateArticlesInCache`.
- Counters are reconciled (`reconcileUnreadCounts`), not trusted.
- Do not `deleteObjectStore` in IndexedDB `upgrade`.
- Feed URLs are untrusted: never pass them to `unsafeHTML` / `href` / `img` without sanitizing.

## Blocking

- Raw IndexedDB outside `src/db/`.
- New UI frameworks or libraries.
- Destructive DB upgrades.
- Unsafe feed URLs in DOM bindings.
- PWA: after build, `dist/` must contain `sw.js`, `manifest.webmanifest`, and icons; the generated `CACHE` name in `dist/sw.js` must change when bundles change. Never edit `dist/sw.js` — edit `scripts/sw.template.js`.
- Changes to `src/services/*`, `src/db/*`, `src/util.ts`, `src/ai.ts`, `src/types.ts` need assertions in `scripts/smoke.ts` or `scripts/db-smoke.ts`.
- Server/schema changes need `scripts/server-smoke.ts` and/or `scripts/integration.ts`.
