# AGENTS.md

`fitness-core` — SI units, 5/3/1 programming, body formulas, Health Connect/CSV importers, downsample.
Shared TypeScript / formatting / workflow: repo-root `AGENTS.md`.

Consumed by `apps/fitness`.

## Commands

```bash
npm run build   # vite build → dist/
npm test        # tsx scripts/smoke.ts
```

`prepare` builds `dist/` on install. Rebuild after changes before the app picks them up.

## Rules

- Pure library: no DOM, no Lit, no Postgres. Parsing and math happen here; persist/API/screens stay in the app.
- Store and compute in SI; display unit conversion is `units.ts`.
- Importer changes (Health Connect SQLite/CSV) and 5/3/1 / formula changes need assertions in `scripts/smoke.ts`.
- Do not log sample payloads in tests beyond small fixtures.
