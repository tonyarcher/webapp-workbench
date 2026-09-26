# AGENTS.md

Headless PKCE (RFC 7636) and JWT payload parsing for workbench identity.
No DOM, no Lit, no token storage.

## Rules

- **Do not invent OAuth.** PKCE is S256 only.
- **Do not verify JWTs here.** APIs verify with JWKS; this package only parses
  the payload. Adding verification would put a second, weaker trust path in
  every consumer.
