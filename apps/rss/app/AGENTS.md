# AGENTS.md

RSS reader UI. Shared TypeScript / Lit / CSS / workflow: repo-root `AGENTS.md`.
The JSON API and poller are `apps/rss/api` — see its `AGENTS.md`. Do not add
Node `pg` here.

## Auth

- Every reader signs in through `user-api` (OAuth2 Code + PKCE via
  `user-client`). API calls carry `Authorization: Bearer`.
- `app-shell` gates on a session and clears IndexedDB and the query cache on
  sign-out or session death, so cached articles never leak across accounts on
  one browser. Ingest skips IndexedDB writes when the auth epoch changed
  mid-sync.
- Plain-HTTP LAN origins have no WebCrypto, so `user-client` falls back to its
  built-in SHA-256 for the S256 challenge. Same proof, no new dependency.
- The OAuth `redirect_uri` is the app root (`/rss-reader/` behind the gateway)
  and must match an `oauth_redirect_uris` row for client `rss-reader`. Every
  origin needs its own row, including a different `npm run dev` port. Production
  adds rows, not code.

## Rules

- `src/services/` and `src/db/` are pure: no DOM, no component imports. All
  client reads and writes go through them, never raw IndexedDB in a component.
- Client state flows through TanStack Query. Components do not hold shared data.
- Query and idb keys must include every parameter the query function closes
  over. A missing one pins an observer to stale data.
- Mutations write the database first, then `invalidateQueries`.
- Feed URLs are untrusted. Never pass one to `unsafeHTML`, `href`, or `img`
  without sanitising it.
- Never edit `dist/sw.js`. This app generates it with `write-sw.mjs` from
  `scripts/sw.template.js`, which embeds the hashed asset list.
- PWA paths are base-relative, or the app breaks under the `/rss-reader/` subpath.

## Verification

- API or schema changes need assertions in the `apps/rss/api` tests.
- Changes under `src/services/` or `src/db/` need assertions in the matching
  `scripts/smoke.ts` or `scripts/db-smoke.ts`.
