# AGENTS.md

Shared identity API. Phase 2: TOTP (RFC 6238) and hashed backup codes.
Passkeys and OAuth come later. Do not add them here.

## Stack

- Kotlin 2.2+ on JVM 21. Ktor (Netty). No Spring. No Keycloak.
- Domain is pure Kotlin (`domain/`): usernames, password rules, lockout, tokens,
  return paths. No Ktor/`@Entity` there.
- Passwords: Argon2id via password4j. Do not invent a hasher.
- Session cookie `wb_session`: HttpOnly, SameSite=Lax, Path=/. `Secure` only when
  `COOKIE_SECURE=true` (HTTP gateway is not Secure).
- CSRF: cookie `wb_csrf` + header `X-CSRF-Token` on POSTs.
- Postgres database `users`. Flyway under `src/main/resources/db/migration/`.
- JSON stdout logs (`service` = `user-api`). Do not log passwords or session tokens.
- Detekt 2 floors: LongMethod 30, TooManyFunctions 10, cyclomatic 15, nested
  depth 4, line length 120. Split rather than suppress.

## Commands

```bash
npm test -w user-api          # gradle check (detekt + tests)
npm run build -w user-api     # gradle installDist
npm run dev -w user-api       # :3004 (PORT=3004). DATABASE_URL optional for healthz.
```

JDK 21+ on PATH (toolchain 21). Gradle wrapper is in this directory.
Deploy compiles here on the **host JDK**, then copies jars into a **JRE** image.
Do not run Gradle inside Docker. Do not use a JDK base image for runtime.

## Layout

- `src/main/kotlin/userapi/domain/` — pure rules.
- `src/main/kotlin/userapi/accounts/` — store + JDBC.
- `src/main/kotlin/userapi/crypto/` — Argon2id wrapper.
- `src/main/kotlin/userapi/http/` — health, accounts, cookies, CSRF, rate limit.
- `src/test/kotlin/` — JUnit 5. HTTP slice tests use a fake store, not Postgres.

## Blocking

- Username, password, lockout, token, return-path, and hasher changes need unit tests.
- HTTP routes need `testApplication` assertions (CSRF, register, login, me, logout).
- Do not invent OAuth in this phase.
