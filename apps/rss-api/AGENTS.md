# AGENTS.md

RSS **API microservice**. Own process, own image, own Postgres database `rss`.
The Lit UI lives in `apps/rss-reader`. Identity is `user-api` (JWT `sub`);
every reader signs in, no anonymous users.

Do not put RSS tables in `user-api`. Do not add Node `pg` here.

## Stack

- Kotlin 2.2+ / JVM 21. Spring Boot Web + Spring Data JPA + Flyway.
- `@Entity` + `JpaRepository` for tables. Do not write JDBC DAOs.
- Auth is OAuth2 resource server (JWKS). Users provision from the JWT `sub`.
- Feeds are one global pool (one row per URL, fetched once). Per-user reading
  lives in `subscriptions`, folders, states, and affinity.
- Domain (`domain/`): ranking, parse, sanitize, SSRF, cursors — not entities.
- Poller is a Spring bean (`@Scheduled` or `SmartLifecycle`). Cancel on shutdown.

## Commands

```bash
npm test -w rss-api
npm run dev -w rss-api   # :3001 (same port the Vite proxy uses)
```

`DATABASE_URL` is required for data routes. Example:
`postgres://rss:rss@localhost:5432/rss`.

Host JDK + Gradle on PATH. `scripts/gradlew.mjs` runs `gradle`. Do not commit
`gradle-wrapper.jar`. JRE image copies the boot jar. Do not run Gradle inside
Docker.

Flyway `baselineOnMigrate` for a Node-era `rss` schema. Do not wipe `pgdata`.

## Contract

Same JSON routes as the former Node server. Error envelope `{error:string}`.
`GET /opml` is `text/xml`. `Authorization: Bearer <user-api JWT>` is required
except `/healthz` and `/readyz`; without it the API answers
`401 {"error":"unauthorized"}`. Env: `OAUTH_JWKS_URI`, `OAUTH_ISSUER`,
`RSS_CLIENT_ID` (defaults suit local dev against user-api on `:3004`).

## Blocking

- Domain (ranking, cursor, SSRF, sanitize, feed parse) needs unit tests.
- HTTP routes need MockMvc / slice tests.
- Poller must stop on application dispose.
