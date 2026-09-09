# AGENTS.md

`football-core` — types, pluggable rulebooks, play-by-play reducer, clock, notation.
Shared TypeScript / formatting / workflow: repo-root `AGENTS.md`.

Consumed by `apps/football`.

## Commands

```bash
npm run build       # vite build → dist/
npm test            # vitest run
npm run typecheck   # tsc --noEmit
```

`prepare` builds `dist/` on install. Rebuild after changes before the app picks them up.

## Rules

- Pure library: no DOM, no Lit. Rulebooks (NFL / NCAA / MN / CO) stay data + reducer, not UI.
  Do not absorb `fb-*` shells from the app.
- Co-located `src/*.test.ts`. Engine, clock, down-and-distance, and rulebook changes need tests here.
- Do not copy reducer/clock math into `apps/football`.
