# AGENTS.md

Headless PKCE (RFC 7636) and JWT payload parse for workbench identity.
No DOM, no Lit, no token storage.

## Commands

```bash
npm test -w user-client
```

## Rules

- Do not invent OAuth. PKCE is S256 only.
- Do not verify JWTs here; APIs use JWKS. This package only parses the payload.
- Changes need assertions in `scripts/smoke.ts`.
