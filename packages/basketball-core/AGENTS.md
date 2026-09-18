# AGENTS.md

`basketball-core` — types, pluggable rulebooks, court geometry, shot clock, reducer.
Shared TypeScript / formatting / workflow: repo-root `AGENTS.md`.

Consumed by `apps/basketball`.

## Commands

```bash
npm run build       # vite build → dist/
npm test            # vitest run
npm run typecheck   # tsc --noEmit
```

`prepare` builds `dist/` on install. Rebuild after changes before the app picks them up.

## Rules

- Pure library: no DOM, no Lit. Rulebooks (NFHS / NCAA / NBA / WNBA) stay data + reducer, not UI.
  Do not absorb `bball-*` shells from the app.
- Co-located `src/*.test.ts`. Engine, clock, court, and rulebook changes need tests here.
- Do not copy reducer/clock/court math into `apps/basketball`.
