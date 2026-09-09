# AGENTS.md

Radio Station (Pulse 101). Shared TypeScript / Lit / CSS / workflow: repo-root `AGENTS.md`.

## Stack

- Vite + Lit. `@tanstack/virtual-core` for the 7-day log.
- Node `http` + `pg` API (`server/`); Postgres database `radio` on the shared compose instance.
- Smoke tests with `tsx`; integration tests use `embedded-postgres`. PWA via `stamp-sw.mjs`.

## Commands

```bash
npm run dev          # Vite (proxies /api → :3002)
npm run dev:server   # API on :3002
npm run build        # tsc --noEmit && vite build && stamp SW version
npm run build:server # tsc -p server/tsconfig.json → dist-server/
npm run test         # tsx scripts/smoke.ts && tsx scripts/integration.ts
npm run verify       # npm run build && npm run test
```

## Architecture

- `src/types.ts` — client domain types.
- `src/services/` — `api.ts`, `export-txt.ts`, `now-playing.ts`, `list-items.ts`, `session-store.ts`, `format.ts`.
- `server/` — Postgres schema, catalog seed, CHR scheduler, JSON/txt HTTP API. No DOM. NodeNext `.js` specifiers.
- Custom elements `rs-*` in `src/web-components/` are local UI, not a shared package.
- `scripts/integration.ts` boots embedded Postgres.

## Data & state

- Last generate (playlist id, seed, weights, startsAt) persists in localStorage (`session-store.ts`).
- Catalog and generated weeks live in Postgres; the client never talks to ranking APIs.
- Weights are canonicalized to integers on the server before insert/lookup.

## Blocking

- `src/services/*` or `server/services/*` changes need assertions in `scripts/smoke.ts`.
- API/schema changes need assertions in `scripts/integration.ts`.
