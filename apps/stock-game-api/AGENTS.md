# AGENTS.md

Stock game **API microservice**. Own process, own image, own Postgres database
`stock`. The UI lives in `apps/stock-game`. Do not add Node `pg` here.

## Stack

- Kotlin 2.2+ / JVM 21. Spring Boot Web + Spring Data JPA + Flyway.
- `@Entity` + `JpaRepository` for tables. Do not write JDBC DAOs.
- Domain: fills, NYSE hours, positions, cash. Price providers in `provider/`.
- Scheduler is a Spring `@Scheduled` bean. Cancel work on shutdown.

## Commands

```bash
npm test -w stock-game-api
npm run dev -w stock-game-api   # :3004
```

`DATABASE_URL` is required for data routes. Example:
`postgres://rss:rss@localhost:5432/stock`.

Host JDK + Gradle on PATH. `scripts/gradlew.mjs` runs `gradle`. Do not commit
`gradle-wrapper.jar`. JRE image copies the boot jar.

## Contract

JSON routes: `/healthz`, `/config`, `/trades`, `/orders`, `/holdings`, `/cash`,
`/portfolio`, `/quote`, `/bars`, `/search`. Error envelope `{error:string}`.
Portfolios are per user: `Authorization: Bearer <user-api JWT>` is required
except `/healthz` and `/readyz`; without it the API answers
`401 {"error":"unauthorized"}`. Env: `OAUTH_JWKS_URI`, `OAUTH_ISSUER`,
`STOCK_CLIENT_ID` (defaults suit local dev against user-api on `:3004`).

## Blocking

- Domain (fills, hours, backdated/scheduled fills) needs unit tests.
- HTTP routes need MockMvc assertions.
