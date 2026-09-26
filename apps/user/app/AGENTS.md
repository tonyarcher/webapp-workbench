# AGENTS.md

Accounts landing page, served at `/auth/`. Shared TypeScript / Lit / CSS /
workflow: repo-root `AGENTS.md`. Covers register, login, TOTP, and passkeys.
The API is `apps/user/api` — see its `AGENTS.md`.

## Rules

- The `uw-*` elements are this app's local UI. Do not move them into a package.
- Every `user-api` call goes to the origin-absolute `/user-api/` prefix, which
  the gateway routes. Do not build an absolute origin in code; the Vite dev
  proxy maps the same prefix, so both environments agree.
- Send `credentials: 'include'` on those calls; the session is a cookie.
- CSRF is two steps: `GET /csrf` first, then send the returned `X-CSRF-Token`
  on the POST.
- Every `user-api` fetch carries `X-Api-Version: 1`.
- `?return=` is an allow-list of same-origin paths (`src/services/return-path.ts`).
  Never redirect to a value that is not on the list.
- Abort in-flight fetches on disconnect. `app-shell` bootstraps the session and
  must not resolve into a torn-down element.
- No PWA, and no OAuth UI. Do not add either without being asked.

## Verification

- Service changes need assertions in `scripts/smoke.ts`.
