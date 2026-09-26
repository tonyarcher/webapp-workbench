# AGENTS.md

Football live scorekeeping. Shared TypeScript / Lit / CSS / workflow:
repo-root `AGENTS.md`. Domain math is in `football-core`.

## Rules

- Persistence is the **event log** plus the current game in IndexedDB. Undo and
  redo replay the store — **do not mutate history in place.**
- No raw IndexedDB in components. Go through `src/local-game/`.
- Pluggable rulebooks (NFL, NCAA, MN, CO) come from `football-core`. **The app
  selects a rulebook, it does not fork rules.** A forked rulebook silently
  diverges from the package's.
- Domain math lives in `football-core` and is not copied into the app.
- The `fb-*` shells in `src/web-components/` are local UI, not package
  material. `football-core` stays headless.
- Honour `prefers-reduced-motion` for all motion.

## Verification

- Engine, rulebook, or clock changes need tests in `packages/football-core`.
- Store or persist changes need tests in `src/local-game/`.
- Watch playback must not loop outside `fb-game-shell`, and must not write into a
  score-mode game.
