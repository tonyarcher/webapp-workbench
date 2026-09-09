# AGENTS.md

`calendar-core` — calendar event types, ICS emit, Trakt/Netflix mappers, Google Calendar helpers.
Shared TypeScript / formatting / workflow: repo-root `AGENTS.md`.

Consumed by `apps/calendar-sync`.

## Commands

```bash
npm run build   # vite build → dist/
npm test        # tsx scripts/smoke.ts
```

`prepare` builds `dist/` on install. Rebuild after changes before the app picks them up.

## Rules

- Pure library: no DOM, no Lit, no tokens or secrets. Do not absorb app shells or OAuth UI.
- ICS/Trakt/Netflix/Google mapping lives here, not in the app.
- Changes need assertions in `scripts/smoke.ts`.
