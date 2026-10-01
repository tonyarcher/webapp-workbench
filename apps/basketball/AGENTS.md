# AGENTS.md

Basketball live scorekeeping. Shared TypeScript / Lit / CSS / workflow:
repo-root `AGENTS.md`. Domain math is in `src/core/`.

## Rules

- Persistence is the **event log** plus the current game in IndexedDB. Undo and
  redo replay the store — **do not mutate history in place.**
- No raw IndexedDB in components. Go through `src/local-game/`.
- Pluggable rulebooks (NFHS, NCAA, NBA, WNBA) come from `src/core/`. **The app
  selects a rulebook, it does not fork rules.** A forked rulebook silently
  diverges from the reducer's.
- Domain math lives in `src/core/` and is not copied elsewhere. Do not copy the
  reducer, clock, or court math into the app.
- `src/core/` is pure: no DOM, no Lit. Rulebooks stay data plus the reducer, so
  do not absorb UI there.
- The `bball-*` shells in `src/web-components/` are local UI, not engine
  material.
- Visual bar is ESPN broadcast chrome — scorebug and hardwood. Not football's
  pad, not baseball's red skin.
- Honour `prefers-reduced-motion` for all motion.

## Verification

- Engine, clock, court, or rulebook changes need tests in the co-located
  `src/core/*.test.ts` files.
- Store, persist, sim, or court-map changes need tests in `src/local-game/`
  and `src/sim/`.
- Watch playback must not loop outside `bball-game-shell`, and must not write
  into a score-mode game.
