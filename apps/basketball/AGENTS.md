# AGENTS.md

Basketball live scorekeeping. Shared TypeScript / Lit / CSS / workflow: repo-root `AGENTS.md`.

## Stack

- Vite + Lit. `basketball-core` for rulebooks, court geometry, shot clock, and reducer.
- Client-side IndexedDB. PWA manifest + service worker.
- Unit tests: vitest, co-located `*.test.ts`.

## Commands

```bash
npm run dev      # Vite
npm run build    # tsc --noEmit && vite build
npm run test     # vitest run
```

After editing `packages/basketball-core`, rebuild it before the app.

## Architecture

- `src/local-game/` — GameStore (event-sourced undo/redo) and IndexedDB save-state. No raw IDB in components.
- `src/web-components/<name>/` — local `bball-*` shells (setup, game, court, scorebug). Not package material.
- Domain math lives in `basketball-core`, not copied into the app.
- Visual bar is ESPN broadcast chrome (scorebug + hardwood), not football’s pad and not baseball’s red skin.
- Global motion: honor `prefers-reduced-motion` via `src/styles`.

## Data & state

- Persistence is the event log + current game in IndexedDB. Undo/redo replays the store; do not mutate history in place.
- Pluggable rulebooks (NFHS / NCAA / NBA / WNBA) come from `basketball-core`; the app selects, it does not fork rules.

## Blocking

- Engine/rulebook/court changes need tests in `packages/basketball-core/src/*.test.ts`.
- Store/persist/sim/court-map changes need tests in `src/local-game/*.test.ts` and `src/sim/*.test.ts`.
- Watch playback looping outside `bball-game-shell` or writing into a score-mode game.
