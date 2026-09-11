# AGENTS.md

RSS **API microservice**. Own process, own image, own Postgres database `rss`.
The Lit UI lives in `apps/rss-reader`. Identity cookie is `rss_uid` (anonymous
per-browser user). Do not collapse to a single local user id.

Do not put RSS tables in `user-api`. Do not add Node `pg` here.

## Stack

- Kotlin 2.2+ / JVM 21. Spring Boot Web + Spring Data JPA + Flyway.
- `@Entity` + `JpaRepository` for tables. Do not write JDBC DAOs.
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
`GET /opml` is `text/xml`. Cookie `rss_uid` HttpOnly SameSite=Lax Path=/;
`Secure` when `X-Forwarded-Proto: https`.

## Blocking

- Domain (ranking, cursor, SSRF, sanitize, feed parse) needs unit tests.
- HTTP routes need MockMvc / slice tests.
- Poller must stop on application dispose.
