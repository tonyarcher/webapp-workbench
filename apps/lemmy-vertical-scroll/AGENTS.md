# AGENTS.md

Lemmy vertical scroll. Shared TypeScript / Lit / CSS / workflow: repo-root
`AGENTS.md`.

## Rules

- A component must not hold shared state in its own fields. Keep it in a
  service, a store, or a cache the provider layer owns.
- Wherever state is cached, the cache key must include every closed-over
  parameter — instance, feed type, sort, nsfw filter, and software version.
  Omitting one pins an observer to a stale provider or filter, which reads as
  wrong data rather than as a bug.
- Writes go to the database first, then the cache is updated or invalidated.
  Reversing that order shows stale data on failure.
- Settings read-modify-write happens inside a single readwrite transaction.
  Splitting it loses a concurrent change.
- No raw IndexedDB in components. Go through `src/db/`.
- Every `href` and `src` derived from instance, post, or community data goes
  through `safeUrl()` in `src/services/url.ts`.
- The `lvs-*` elements in `src/web-components/` are local UI. The shared piece is
  `vertical-scroll-core`, not these screens; other apps must not import them.
- After editing `libs/vertical-scroll-core`, rebuild it before this app
  picks the change up.

## Verification

- Service, database, and query changes need assertions in the matching
  `scripts/*-smoke.ts`.
