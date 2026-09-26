# AGENTS.md

Fitness tracker UI. Shared TypeScript / Lit / CSS / workflow: repo-root
`AGENTS.md`. The JSON API is `apps/fitness/api` — see its `AGENTS.md`. Do not
add Node `pg` here.

## Rules

- Shared math and parsers live in `fitness-core` and are not copied into the
  app. That package stays units, 5/3/1 math, formulas, and the Health Connect and
  CSV parsers — never screens.
- The `ft-*` elements are this app's local UI.
- `src/services/` is the API client and takes no component imports.
- **Store SI on the server; toggle kg/lb in the UI.** Do not store a
  display-unit value and convert on read.
- **Do not log sample payloads.** They are health data.
- Import parses in the browser through `fitness-core`, then POSTs chunks to
  `/imports`.
- v1 holds the current view in memory and keeps samples and profile on the API.
  A client IndexedDB outbox is later work, not something to start here.
- After editing `packages/fitness-core`, rebuild it before this app picks the
  change up.

## Verification

- `fitness-core` changes need assertions in that package's `scripts/smoke.ts`.
- `src/services/*` or app-facing parser changes need assertions in this app's
  `scripts/smoke.ts`.
- API or schema changes need assertions in the `apps/fitness/api` JUnit tests.
