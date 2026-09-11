# AGENTS.md

Accounts landing page (`/auth/`). Shared TypeScript / Lit / CSS / workflow:
repo-root `AGENTS.md`. Phase 0 is an empty shell that pings `user-api`.

## Stack

- Vite + Lit. Custom elements `uw-*`.
- Talks to `user-api` at origin-absolute `/user-api/` (gateway). Vite proxies
  that prefix to `:3004` in dev.
- No PWA in phase 0. No passwords or OAuth UI yet.

## Commands

```bash
npm run dev -w user-web
npm test -w user-web
npm run build -w user-web
```

## Architecture

- `src/services/api.ts` — health URL helpers. No DOM.
- `src/web-components/app-shell/` — landing shell. Abort fetch on disconnect.

## Blocking

- Service changes need assertions in `scripts/smoke.ts`.
