# AGENTS.md

`basketball-core` — types, pluggable rulebooks, court geometry, shot clock, and
the play reducer. Shared TypeScript / formatting / workflow: repo-root
`AGENTS.md`.

## Rules

- Pure library: no DOM, no Lit. Rulebooks (NFHS, NCAA, NBA, WNBA) stay data
  plus reducer, never UI. Do not absorb the app's `bball-*` shells here.
- Do not copy reducer, clock, or court math into the app.
- `prepare` builds `dist/` on install, and the consumer app needs a rebuild to
  pick up a change.

## Verification

- Engine, clock, court, and rulebook changes need tests in the co-located
  `src/*.test.ts` files here.
