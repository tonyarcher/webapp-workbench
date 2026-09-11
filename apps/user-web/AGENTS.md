# AGENTS.md

Accounts landing page (`/auth/`). Shared TypeScript / Lit / CSS / workflow:
repo-root `AGENTS.md`. Phase 3: register, login, TOTP, passkeys.

## Stack

- Vite + Lit. Custom elements `uw-*`.
- Talks to `user-api` at origin-absolute `/user-api/` (gateway). Vite proxies
  that prefix to `:3004` in dev. `credentials: 'include'` for the session cookie.
- CSRF: `GET /v1/csrf` then `X-CSRF-Token` on POSTs.
- Landing redirect: `?return=/fitness/` (same-origin path only).
- No PWA. No OAuth UI yet.

## Commands

```bash
npm run dev -w user-web
npm test -w user-web
npm run build -w user-web
```

## Architecture

- `src/services/api.ts` — URLs and JSON parsers. No DOM.
- `src/services/return-path.ts` — allow-list `return` query values.
- `src/web-components/app-shell/` — session bootstrap. Abort fetch on disconnect.
- `src/web-components/login-form/` — register/login form.

## Blocking

- Service changes need assertions in `scripts/smoke.ts`.
