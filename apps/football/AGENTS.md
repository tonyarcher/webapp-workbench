# AGENTS.md

Football live scorekeeping. Shared TypeScript / Lit / CSS / workflow:
repo-root `AGENTS.md`. Domain math is in `src/core/`.

## Rules

- Persistence is the **event log** plus the current game in IndexedDB. Undo and
  redo replay the store — **do not mutate history in place.**
- No raw IndexedDB in components. Go through `src/local-game/`.
- Pluggable rulebooks (NFL, NCAA, MN, CO) come from `src/core/`. **The app
  selects a rulebook, it does not fork rules.** A forked rulebook silently
  diverges from the reducer's.
- Domain math lives in `src/core/` and is not copied elsewhere. Do not copy the
  reducer or clock math into the app.
- The `fb-*` shells in `src/web-components/` are local UI, not engine
  material. `src/core/` stays headless: no DOM, no Lit.
- `src/core/` holds data plus the reducer; rulebooks stay data. Do not absorb UI
  there.
- Honour `prefers-reduced-motion` for all motion.

## Verification

- Engine, clock, down-and-distance, or rulebook changes need tests in the
  co-located `src/core/*.test.ts` files.
- Store or persist changes need tests in `src/local-game/`.
- Watch playback must not loop outside `fb-game-shell`, and must not write into a
  score-mode game.
