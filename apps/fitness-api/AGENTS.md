# AGENTS.md

Fitness **API microservice**. Own process, own image, own Postgres database
`fitness`. The Lit UI lives in `apps/fitness`. Identity is `user-api` (JWT `sub`).

Do not put fitness tables in `user-api`. Do not add Node `pg` here.

## Stack

- Kotlin 2.2+ / JVM 21. Spring Boot Web + Spring Data JPA + Flyway.
- `@Entity` + `JpaRepository` for tables. Do not write JDBC DAOs.
- Domain (`domain/`): metric aliases, import collect, LTTB, profile normalize.
- Without a Bearer token, uses the legacy local user id so the existing UI works.

## Commands

```bash
npm test -w fitness-api
npm run dev -w fitness-api   # :3003 (same port the Vite proxy uses)
```

`DATABASE_URL` is required for data routes (otherwise `/healthz` is 200 and
the rest is `503 {"error":"database offline"}`). Example:
`postgres://rss:rss@localhost:5432/fitness`.

Host JDK + Gradle on PATH. `scripts/gradlew.mjs` runs `gradle`. Do not commit
`gradle-wrapper.jar`. JRE image copies the boot jar. Do not run Gradle inside
Docker.

Flyway `baselineOnMigrate` so an existing Node-era `fitness` schema
(tables, no `flyway_schema_history`) is recorded and kept; do not wipe
`pgdata` to cut over.

## Contract

Same JSON routes as the former Node server: `/healthz`, `/profile`, `/stats`,
`/samples`, `/samples/latest`, `/series`, `/rollups`, `/imports`.
Error envelope `{error:string}`.

## Blocking

- Domain (metric aliases, import collect, LTTB, profile normalize) needs unit tests.
- HTTP routes need MockMvc assertions with a fake store (import upsert,
  hide/override, profile round-trip, invalid `limit`).
