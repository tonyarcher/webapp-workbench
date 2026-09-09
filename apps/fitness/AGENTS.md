# AGENTS.md

Fitness tracker. Shared TypeScript / Lit / CSS / workflow: repo-root `AGENTS.md`.

## Stack

- Vite + Lit. `fitness-core` for units, 5/3/1 math, formulas, Health Connect/CSV parsers, downsample.
- Node `http` + `pg` API (`server/`); Postgres database `fitness` on the shared compose instance.
- Client IndexedDB/outbox comes later; v1 holds the current view in memory and profile/samples on the server.
- Smoke tests with `tsx`; integration tests use `embedded-postgres`. PWA via `stamp-sw.mjs`.

## Commands

```bash
npm run dev          # Vite (proxies /api → :3003)
npm run dev:server   # API on :3003
npm run build        # tsc --noEmit && vite build && stamp SW version
npm run build:server # tsc -p server/tsconfig.json → dist-server/
npm run test         # tsx scripts/smoke.ts && tsx scripts/integration.ts
npm run verify       # npm run build && npm run test
```

After editing `packages/fitness-core`, rebuild it before the app.

## Architecture

- `src/types.ts` — view/profile types.
- `src/services/` — API client; no component imports.
- `server/` — Postgres schema, ingest, profile, JSON HTTP API. No DOM. NodeNext `.js` specifiers.
- Custom elements `ft-*` (dashboard, charts, import, lifts) are local UI. `fitness-core` stays parsers and math, not screens.
- Shared math and parsers live in `fitness-core`, not copied into the app.

## Data & state

- Samples, profile, phases, and completed workouts live in Postgres; the client never talks to Health Connect APIs.
- Import parses in the browser (`fitness-core`) then POSTs chunks to `/imports`.
- Store SI on the server; toggle kg/lb in the UI.
- Do not log sample payloads.

## Blocking

- `fitness-core` changes need assertions in `packages/fitness-core/scripts/smoke.ts`.
- `src/services/*` or parsers used by the app need assertions in `scripts/smoke.ts`.
- API/schema changes need assertions in `scripts/integration.ts`.
