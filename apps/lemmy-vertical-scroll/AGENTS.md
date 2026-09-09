# AGENTS.md

Lemmy vertical scroll. Shared TypeScript / Lit / CSS / workflow: repo-root `AGENTS.md`.

## Stack

- Vite + Lit. `@tanstack/query-core`, `@tanstack/virtual-core`, `@tanstack/history`, `idb`.
- `vertical-scroll-core` for the scroller. Smoke tests with `tsx`. PWA via `stamp-sw.mjs`.

## Commands

```bash
npm run dev      # Vite
npm run build    # tsc --noEmit && vite build && stamp SW version
npm run test     # tsx scripts/smoke.ts && tsx scripts/db-smoke.ts && tsx scripts/query-smoke.ts
npm run verify   # npm run build && npm run test
```

After editing `packages/vertical-scroll-core`, rebuild it before the app.

## Architecture

- `src/types.ts` — domain types (unions + string literals).
- `src/db/` — IndexedDB via `idb`. No raw IDB in components.
- `src/services/` — `lemmy.ts`, `piefed.ts`, `post-media.ts`, `format.ts`, `url.ts` (`safeUrl`).
- `src/query.ts` / `src/mutations.ts` — query keys and mutations.
- `src/router.ts` — hash router; `View` union.
- Custom elements `lvs-*` in `src/web-components/` are local UI (feed, community, settings). The shared piece is `vertical-scroll-core`, not these screens.
- `scripts/` — `smoke.ts` (services), `db-smoke.ts` (idb), `query-smoke.ts` (query/hydration).

## Data & state

- All shared state through TanStack Query.
- Query and idb cache keys must include every closed-over parameter (instance, feed type, sort, nsfw filter, software) — omitting one pins an observer to a stale provider or filter.
- Mutations update the DB, then `setQueryData` / `invalidateQueries`.
- Settings read-modify-write happens inside one readwrite transaction.
- Every `href` / `src` from instance/post/community data goes through `safeUrl()` in `src/services/url.ts`.

## Blocking

- Service / db / query changes need assertions in the matching `scripts/*-smoke.ts`.
