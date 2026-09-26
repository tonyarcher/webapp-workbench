# AGENTS.md

`calendar-core` — calendar event types, ICS emit, the Trakt and Netflix mappers,
and Google Calendar helpers. Shared TypeScript / formatting / workflow:
repo-root `AGENTS.md`.

## Rules

- Pure library: no DOM, no Lit, and **no tokens or secrets**. Do not absorb app
  shells or OAuth UI here — the provider credentials stay in the app.
- ICS, Trakt, Netflix, and Google mapping lives here, not in the app.
- `prepare` builds `dist/` on install, and the consumer app needs a rebuild to
  pick up a change.

## Verification

- Changes need assertions in `scripts/smoke.ts`.
