# AGENTS.md

Fitness product: tracker UI (`app`) plus JSON API (`api`). Root `AGENTS.md`
covers workflow, git, and monorepo rules.

- UI: Vite + Lit; `fitness-core` for units, 5/3/1 math, formulas, parsers.
  API: Kotlin, Spring Data JPA.
- One Postgres database `fitness`, owned by `api`. Uses the legacy local user
  id until the UI sends a `user-api` JWT.
- Host JDK `bootJar`; JRE image copies the jar.
- Work on both halves together: `./deploy.sh apps/fitness`, `./build.sh apps/fitness`.
