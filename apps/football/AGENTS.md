# AGENTS.md

Football live scorekeeping. Shared TypeScript / Lit / CSS / workflow: repo-root `AGENTS.md`.

## Stack

- Vite + Lit. `football-core` for rulebooks, play-by-play reducer, clock, and notation.
- Client-side IndexedDB; no PWA service worker yet.
- Unit tests: vitest, co-located `*.test.ts`.

## Commands

```bash
npm run dev      # Vite
npm run build    # tsc --noEmit && vite build
npm run test     # vitest run
```

After editing `packages/football-core`, rebuild it before the app.

## Architecture

- `src/local-game/` — GameStore (event-sourced undo/redo) and IndexedDB save-state. No raw IDB in components.
- `src/web-components/<name>/` — local `fb-*` shells (setup, game). Not package material; `football-core` stays headless.
- Domain math lives in `football-core`, not copied into the app.
- Global motion: honor `prefers-reduced-motion` via `src/styles`.

## Data & state

- Persistence is the event log + current game in IndexedDB. Undo/redo replays the store; do not mutate history in place.
- Pluggable rulebooks (NFL / NCAA / MN / CO) come from `football-core`; the app selects, it does not fork rules.

## Blocking

- Engine/rulebook changes need tests in `packages/football-core/src/*.test.ts`.
- Store/persist changes need tests in `src/local-game/*.test.ts`.
- Watch playback looping outside `fb-game-shell` or writing into a score-mode game.
