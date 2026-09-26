# AGENTS.md

Radio Station (Pulse 101). Shared TypeScript / Lit / CSS / workflow: repo-root
`AGENTS.md`. There is no separate `api/AGENTS.md`; the API rules live here.

## Rules

- `src/services/*` stays free of DOM and component imports. Persistence goes
  through those services, never raw from a component.
- The `rs-*` elements in `src/web-components/` are local UI. They are not a
  shared package and other apps must not import them.
- The client never calls a ranking API. The catalog and generated weeks live in
  Postgres, read through the API.
- Weights are canonicalized to integers on the server before insert or lookup.
  Do not compare or send fractional weights.
- The last generate (playlist id, seed, weights, startsAt) persists in
  localStorage via `session-store.ts`, so a refresh resumes the same week.
- After editing a `packages/*` dependency, rebuild it before this app picks the
  change up.

## Verification

- `src/services/*` changes need assertions in `scripts/smoke.ts`.
- API or schema changes need JUnit assertions in `api/`.
