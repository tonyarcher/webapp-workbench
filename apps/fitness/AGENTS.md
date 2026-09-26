# AGENTS.md

Fitness product: tracker UI (`app`) plus JSON API (`api`). Root `AGENTS.md`
covers workflow, git, and monorepo rules.

- `app/` — see `apps/fitness/app/AGENTS.md` for the tracker UI, the SI/kg
  toggle, and the import flow.
- `api/` — see `apps/fitness/api/AGENTS.md`. It owns the `fitness` database; do
  not put fitness tables in `user-api`.
- Units, 5/3/1 math, body formulas, and parsers live in `fitness-core`. Do not
  copy them into the app.
- Until the UI sends a `user-api` JWT, the API falls back to a legacy local user
  id so the existing screen keeps working. Do not remove that path.
- Work on both halves together: `python deploy.py apps/fitness`, `python build.py apps/fitness`.
