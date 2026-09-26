# Fitness

Fitness tracker: a Vite + Lit UI (`app/`) backed by a Kotlin JSON API (`api/`).
`AGENTS.md` has the product notes; `app/AGENTS.md` and `api/AGENTS.md` have the
halves.

- Shared math and parsers live in `packages/fitness-core` and are **not copied
  into the app**. That package stays units, 5/3/1, formulas, and importers.
- SI is stored and computed server-side. The UI toggles kg and lb for display.
- Samples are health data: never log a sample payload.

Run both halves with `python deploy.py apps/fitness`. The per-workspace dev and
test scripts are in each half's `package.json`.
