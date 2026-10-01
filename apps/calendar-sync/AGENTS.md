# AGENTS.md

Calendar Sync. Shared TypeScript / Lit / CSS / workflow: repo-root `AGENTS.md`.

## Rules

- No TanStack, no IndexedDB, and no router. Credentials and last-sync stats
  persist in localStorage. Do not add a store to "fix" state; localStorage is the
  design, because the only secrets this app holds are provider tokens.
- Event mapping, ICS output, the Netflix parse, and the Google insert all live
  in `src/core/` and stay pure — no DOM, no Lit, and **no tokens or secrets**.
  Do not absorb OAuth UI or app shells there; the provider credentials stay in
  `src/services/`.
- The `cal-*` elements are this app's local UI. Do not move shells or source
  cards into `src/core/`.
- `src/services/` holds the Trakt OAuth and Google GIS flows and takes no
  component imports.
- **Never log client secrets or tokens.**
- PWA paths in `public/` are base-relative, or the app breaks under a subpath.
- `src/core/` is pure TypeScript: inject `fetch` for HTTP rather than reaching
  for a global, so it stays testable outside a browser.

## Verification

- `src/core/` changes need assertions in `scripts/calendar-core-smoke.ts`.
- `src/services/*` changes need assertions in this app's `scripts/smoke.ts`.
