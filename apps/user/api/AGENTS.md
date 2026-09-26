# AGENTS.md

Standalone identity provider (IdP). OAuth2 Authorization Code + PKCE, JWKS,
JWT, passkeys, TOTP, passwords. Do not invent OAuth.

This service must stay cloneable to another repo. It stores accounts and
auth only. No fitness, RSS, or radio tables. Other apps are HTTP clients.
Register those apps as OAuth clients in `oauth_clients` /
`oauth_redirect_uris` (and later scopes), not in Kotlin.

## Stack

- Kotlin 2.2+ on JVM 21. Spring Boot Web + Spring Security + Spring Data JPA + Flyway.
- Domain is pure Kotlin (`domain/`): usernames, password rules, lockout, tokens,
  return paths. No Spring/`@Entity` there.
- Passwords: Argon2id via password4j. Do not invent a hasher.
- Session cookie `wb_session`: HttpOnly, SameSite=Lax, Path=/. `Secure` only when
  `COOKIE_SECURE=true` (HTTP gateway is not Secure). Spring Security runs a
  session-cookie filter plus the `wb_csrf` equality filter in its chain.
- CSRF: cookie `wb_csrf` + header `X-CSRF-Token` on POSTs.
- Postgres database `users`. Flyway under `src/main/resources/db/migration/`.
- JSON stdout logs (`service` = `user-api`). Do not log passwords or session tokens.
- Detekt floors live in `detekt.yml`: LongMethod 25, TooManyFunctions 10, cyclomatic 10,
  nested depth 3, ComplexCondition 3. Line length is not one of them — ktlint owns 120
  from `.editorconfig`, and detekt's `MaxLineLength` is inactive so the two cannot
  disagree. Split rather than suppress.

## Commands

```bash
npm test -w user-api          # gradle check (detekt + tests)
npm run build -w user-api     # gradle bootJar
npm run dev -w user-api       # :3004 (PORT=3004). DATABASE_URL required.
```

JDK 21+ on PATH (toolchain 21). npm scripts call `gradle` directly.
Deploy compiles here on the **host JDK**, then copies the boot jar into a **JRE** image.
Do not run Gradle inside Docker. Do not use a JDK base image for runtime.

## Layout

- `src/main/kotlin/userapi/domain/` — pure rules.
- `src/main/kotlin/userapi/persist/` — `@Entity` rows + `JpaRepository` stores.
- `src/main/kotlin/userapi/accounts/` — store interfaces + services (OAuth, passkeys).
- `src/main/kotlin/userapi/crypto/` — Argon2id wrapper.
- `src/main/kotlin/userapi/web/` — controllers, security filters, cookies, rate limit.
- `src/test/kotlin/` — JUnit 5. HTTP slice tests are `@WebMvcTest` with fakes, not Postgres.

## Blocking

- Username, password, lockout, token, return-path, and hasher changes need unit tests.
- HTTP routes need `@WebMvcTest` assertions (CSRF, register, login, me, logout).
- Do not invent OAuth in this phase.
