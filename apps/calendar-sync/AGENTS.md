# AGENTS.md

Calendar Sync. Shared TypeScript / Lit / CSS / workflow: repo-root `AGENTS.md`.

## Rules

- No TanStack, no IndexedDB, and no router. Credentials and last-sync stats
  persist in localStorage. Do not add a store to "fix" state; localStorage is the
  design, because the only secrets this app holds are provider tokens.
- Event mapping, ICS output, the Netflix parse, and the Google insert all live
  in `calendar-core` and stay pure — no DOM, no component imports.
- The `cal-*` elements are this app's local UI. Do not move shells or source
  cards into `calendar-core`.
- `src/services/` holds the Trakt OAuth and Google GIS flows and takes no
  component imports.
- **Never log client secrets or tokens.**
- PWA paths in `public/` are base-relative, or the app breaks under a subpath.
- After editing `packages/calendar-core`, rebuild it before this app picks the
  change up.

## Verification

- `calendar-core` changes need assertions in that package's `scripts/smoke.ts`.
- `src/services/*` changes need assertions in this app's `scripts/smoke.ts`.
