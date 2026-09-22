# AGENTS.md

Radio Station (Pulse 101). Shared TypeScript / Lit / CSS / workflow: repo-root `AGENTS.md`.

## Stack

- Vite + Lit UI. `@tanstack/virtual-core` for the 7-day log.
- API: Kotlin, Spring Data JPA + Flyway (`api/`). Postgres database `radio`.
- Host JDK (`gradle bootJar`). The compose image is JRE-only and copies the boot jar.
- Smoke tests with `tsx`. PWA via `stamp-sw.mjs`.

## Commands

```bash
npm run dev                 # Vite (proxies /api → :3002)
npm run dev -w radio-api    # API on :3002. DATABASE_URL is required for data routes.
npm run build               # tsc --noEmit && vite build && stamp SW version
npm test                    # client smoke
npm test -w radio-api       # gradle check
```

## Architecture

- `src/types.ts` — client domain types.
- `src/services/` — `api.ts`, `export-txt.ts`, `now-playing.ts`, `list-items.ts`, `session-store.ts`, `format.ts`.
- `api/` — JPA catalog, CHR scheduler, JSON/txt HTTP API. No DOM.
- Custom elements `rs-*` in `src/web-components/` are local UI, not a shared package.

## Data & state

- Last generate (playlist id, seed, weights, startsAt) persists in localStorage (`session-store.ts`).
- Catalog and generated weeks live in Postgres; the client never talks to ranking APIs.
- Weights are canonicalized to integers on the server before insert/lookup.

## Blocking

- `src/services/*` changes need assertions in `scripts/smoke.ts`.
- API/schema changes need JUnit assertions in `api/`.
