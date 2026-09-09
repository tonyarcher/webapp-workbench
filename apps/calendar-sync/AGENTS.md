# AGENTS.md

Calendar Sync. Shared TypeScript / Lit / CSS / workflow: repo-root `AGENTS.md`.

## Stack

- Vite + Lit. `calendar-core` for ICS emit, Trakt/Netflix mappers, Google Calendar helpers.
- No TanStack, no IndexedDB, no router — credentials and last-sync stats persist in localStorage.
- Smoke tests: `tsx scripts/smoke.ts`. PWA via `stamp-sw.mjs`.

## Commands

```bash
npm run dev      # Vite (proxies /api/trakt → api.trakt.tv)
npm run build    # tsc --noEmit && vite build && stamp SW version
npm run test     # tsx scripts/smoke.ts
npm run verify   # npm run build && npm run test
```

After editing `packages/calendar-core`, rebuild it before the app.

## Architecture

- `src/types.ts` — settings types.
- `src/services/` — settings, Trakt OAuth, Google GIS, download; no component imports.
- Event mapping, ICS, Netflix parse, Google insert live in `calendar-core` (pure, no DOM).
- Custom elements `cal-*` are local UI. Do not move shells or source cards into `calendar-core`.
- `public/` — PWA files (base-relative paths).

## Data & state

- Settings persist in localStorage (`settings.ts`). Never log client secrets or tokens.
- Trakt calls go through `./api/trakt` (Vite proxy in dev, nginx in deploy).

## Blocking

- `calendar-core` changes need assertions in `packages/calendar-core/scripts/smoke.ts`.
- `src/services/*` changes need assertions in `scripts/smoke.ts`.
