# AGENTS.md

`fitness-core` — SI units, 5/3/1 programming, body formulas, the Health Connect
and CSV importers, and downsampling. Shared TypeScript / formatting / workflow:
repo-root `AGENTS.md`.

## Rules

- Pure library: no DOM, no Lit, no Postgres. Parsing and math happen here;
  persistence, API calls, and screens stay in the app.
- **Store and compute in SI.** Display-unit conversion is `units.ts` and belongs
  at the edge, not in the stored value.
- **Do not log sample payloads in tests beyond small fixtures.** They are health
  data.
- `prepare` builds `dist/` on install, and the consumer app needs a rebuild to
  pick up a change.

## Verification

- Importer changes (Health Connect SQLite and CSV) and 5/3/1 or formula changes
  need assertions in `scripts/smoke.ts`.
