# AGENTS.md

Shared identity API. Phase 0 is a skeleton: health, Flyway, JSON logs, compose.
Passwords, TOTP, passkeys, and OAuth come in later phases. Do not add them here.

## Stack

- Kotlin 2.2+ on JVM 21. Ktor (Netty). No Spring. No Keycloak.
- Domain is pure Kotlin: no Ktor/`@Entity` in `db/DatabaseNames.kt` or `log/`.
- Postgres database `users` on the shared compose instance. Flyway under
  `src/main/resources/db/migration/`.
- JSON stdout logs (`service` = `user-api`). Honor `X-Request-ID` / `traceparent`.
- Detekt 2 (`dev.detekt`) floors: LongMethod 30, TooManyFunctions 10, cyclomatic 15,
  nested depth 4, line length 120. Split rather than suppress.

## Commands

```bash
npm test -w user-api          # gradle check (detekt + tests)
npm run build -w user-api     # gradle installDist
npm run dev -w user-api       # :3004 (PORT=3004). DATABASE_URL optional for healthz.
```

JDK 21+ on PATH (toolchain 21). Gradle wrapper is in this directory.

## Layout

- `src/main/kotlin/userapi/` — HTTP wiring, settings, DB boot.
- `src/main/kotlin/userapi/db/` — URL parse, name allow-list, Flyway, pool.
- `src/main/kotlin/userapi/http/` — health, request ids, call log, status pages.
- `src/main/kotlin/userapi/log/` — JSON lines. Do not log DATABASE_URL or tokens.
- `src/test/kotlin/` — JUnit 5. HTTP slice tests use Ktor `testApplication`.

## Blocking

- URL parse, database-name allow-list, and JSON log changes need unit tests.
- HTTP routes need `testApplication` assertions.
- Do not invent OAuth or password hashing in this phase.
