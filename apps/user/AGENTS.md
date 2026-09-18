# AGENTS.md

Identity product: accounts landing page (`app`, served at `/auth/`) plus the
shared identity API (`api`). Root `AGENTS.md` covers workflow, git, and
monorepo rules.

- App: Vite + Lit shell (`uw-*`); talks to `api` at origin-absolute `/user-api/`.
- API: Kotlin, Spring Boot Web + Security + JPA. Postgres database `users`.
- Host JDK (`gradle bootJar`); the compose image is JRE-only and copies the
  boot jar.
- Work on both halves together: `./deploy.sh apps/user`, `./build.sh apps/user`.
