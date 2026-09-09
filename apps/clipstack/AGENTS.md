# AGENTS.md

Clipstack. Shared TypeScript / Lit / CSS / workflow: repo-root `AGENTS.md`.

## Stack

- Vite + Lit. `vertical-scroll-core` for the scroller and embed players.
- No TanStack, no IndexedDB, no router — list + position persist in localStorage so a refresh resumes.
- Smoke tests: `tsx scripts/smoke.ts`. PWA via `stamp-sw.mjs`.

## Commands

```bash
npm run dev      # Vite
npm run build    # tsc --noEmit && vite build && stamp SW version
npm run test     # tsx scripts/smoke.ts
npm run verify   # npm run build && npm run test
```

After editing `packages/vertical-scroll-core`, rebuild it before the app.

## Architecture

- `src/types.ts` — domain types.
- `src/services/` — `parse-list.ts` (URL extraction + classification), `to-scroll-item.ts`, `session-store.ts` (localStorage list + position), `resolve-oembed.ts`.
- Custom elements `cs-*` in `src/web-components/` are local UI (import/watch shells). The shared piece is `vertical-scroll-core`, not these screens.
- `public/` — PWA files (base-relative paths).

## Data & state

- New list clears the saved session.
- Every `href` / `src` from user input goes through `safeUrl()` from `vertical-scroll-core`.

## Blocking

- Service changes need assertions in `scripts/smoke.ts`.
