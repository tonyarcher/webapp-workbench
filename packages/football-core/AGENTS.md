# AGENTS.md

`football-core` — types, pluggable rulebooks, play-by-play reducer, clock, and
notation. Shared TypeScript / formatting / workflow: repo-root `AGENTS.md`.

## Rules

- Pure library: no DOM, no Lit. Rulebooks (NFL, NCAA, MN, CO) stay data plus
  reducer, never UI. Do not absorb the app's `fb-*` shells here.
- Do not copy reducer or clock math into the app.
- `prepare` builds `dist/` on install, and the consumer app needs a rebuild to
  pick up a change.

## Verification

- Engine, clock, down-and-distance, and rulebook changes need tests in the
  co-located `src/*.test.ts` files here.
