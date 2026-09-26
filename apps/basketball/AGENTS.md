# AGENTS.md

Basketball live scorekeeping. Shared TypeScript / Lit / CSS / workflow:
repo-root `AGENTS.md`. Domain math is in `basketball-core`.

## Rules

- Persistence is the **event log** plus the current game in IndexedDB. Undo and
  redo replay the store — **do not mutate history in place.**
- No raw IndexedDB in components. Go through `src/local-game/`.
- Pluggable rulebooks (NFHS, NCAA, NBA, WNBA) come from `basketball-core`.
  **The app selects a rulebook, it does not fork rules.** A forked rulebook
  silently diverges from the package's.
- Domain math lives in `basketball-core` and is not copied into the app.
- The `bball-*` shells in `src/web-components/` are local UI, not package
  material.
- Visual bar is ESPN broadcast chrome — scorebug and hardwood. Not football's
  pad, not baseball's red skin.
- Honour `prefers-reduced-motion` for all motion.

## Verification

- Engine, rulebook, or court changes need tests in `packages/basketball-core`.
- Store, persist, sim, or court-map changes need tests in `src/local-game/`
  and `src/sim/`.
- Watch playback must not loop outside `bball-game-shell`, and must not write
  into a score-mode game.
