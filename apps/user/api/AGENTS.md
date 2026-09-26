# AGENTS.md

Standalone identity provider (IdP). OAuth2 Authorization Code + PKCE, JWKS,
JWT, passkeys, TOTP, passwords.

**This service must stay cloneable to another repo.** It stores accounts and
auth only — never fitness, RSS, radio, or any other product's tables. Other apps
are HTTP clients of it, not tables inside it. Register those apps as OAuth
clients in `oauth_clients` and `oauth_redirect_uris` (and later, scopes), not in
Kotlin.

## Rules

- **Do not invent OAuth.** Use what the framework gives you.
- **Do not invent a hasher.** Passwords are Argon2id via password4j.
- `domain/` is pure Kotlin — usernames, password rules, lockout, tokens, return
  paths. No Spring types and no `@Entity` there.
- `persist/` holds `@Entity` rows and their `JpaRepository` stores. Keep the
  boundary: a rule belongs in `domain/`, a query belongs in `persist/`.
- Session cookie `wb_session` is HttpOnly, SameSite=Lax, Path=/, and `Secure`
  only when `COOKIE_SECURE=true` — the HTTP gateway is not Secure, so forcing it
  breaks local and LAN use.
- CSRF is the `wb_csrf` cookie plus an `X-CSRF-Token` header on POSTs, enforced by
  a Spring Security filter chain. Do not bypass the chain per route.
- JSON stdout logs carry `service` = `user-api`. **Never log a password or a
  session token.**
- Detekt floors live in `detekt.yml`. Line length is deliberately not one of
  them: ktlint owns 120 from `.editorconfig`, and detekt's `MaxLineLength` is
  inactive so the two cannot disagree. Split a method rather than suppress.

## Build

Compiles on the **host JDK**; the deploy copies the boot jar into a **JRE**
image. Do not run Gradle inside Docker, and do not use a JDK base image at
runtime.

## Verification

- Changes to usernames, passwords, lockout, tokens, return paths, or the hasher
  need unit tests.
- HTTP routes need `@WebMvcTest` assertions with fakes, not Postgres. Cover CSRF,
  register, login, me, and logout.
