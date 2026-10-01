# AGENTS.md

Fitness tracker UI. Shared TypeScript / Lit / CSS / workflow: repo-root
`AGENTS.md`. The JSON API is `apps/fitness/api` — see its `AGENTS.md`. Do not
add Node `pg` here.

## Rules

- Shared math and parsers live in `src/core/` and are not copied elsewhere. It
  stays units, 5/3/1 math, formulas, downsampling, and the Health Connect and CSV
  parsers — never screens, persistence, or API calls.
- The `ft-*` elements are this app's local UI.
- `src/services/` is the API client and takes no component imports.
- **Store SI on the server; toggle kg/lb in the UI.** Do not store a
  display-unit value and convert on read. Display-unit conversion is
  `src/core/units.ts` and belongs at the edge, not in the stored value.
- **Do not log sample payloads, in tests either beyond small fixtures.** They are
  health data.
- Import parses in the browser through `src/core/`, then POSTs chunks to
  `/imports`.
- v1 holds the current view in memory and keeps samples and profile on the API.
  A client IndexedDB outbox is later work, not something to start here.

## Verification

- `src/core/` changes need assertions in `scripts/core-smoke.ts`.
- `src/services/*` or app-facing parser changes need assertions in this app's
  `scripts/smoke.ts`.
- API or schema changes need assertions in the `apps/fitness/api` JUnit tests.
