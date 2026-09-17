# AGENTS.md

RSS product: reader UI (`app`) plus JSON API + poller (`api`). Root `AGENTS.md`
covers workflow, git, and monorepo rules.

- UI: Vite + Lit (TanStack core, hash router, PWA). API: Kotlin, Spring Data JPA.
- One Postgres database `rss`, owned by `api`. Cookie `rss_uid` per browser.
- Readers sign in through `user-api` (OAuth2 Code + PKCE, `user-client`
  helpers). API calls carry `Authorization: Bearer`.
- Host JDK + Gradle on PATH. JRE image copies the boot jar.
- Work on both halves together: `./deploy.sh apps/rss`, `./build.sh apps/rss`.
