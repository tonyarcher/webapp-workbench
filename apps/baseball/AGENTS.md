# AGENTS.md

Baseball scorekeeping (`baseball-tracker`). Shared TypeScript / Lit / CSS /
workflow: repo-root `AGENTS.md`. Entirely client-side; there is no backend.

## Rules

- `@baseball/web-components` is for reusable scorebook and scoreboard widgets
  only. App shells (`app-shell`, `game-shell`, setup) stay in `src/local-game/`.
  Do not move app logic into the package.
- The `rule-engine.ts` reducer is pure. Keep it free of DOM and persistence.
- **SVG base-point coordinates in `src/local-game/scorebook-path.ts` must stay
  in sync with `basePointX` and `basePointY` in
  `packages/web-components/src/scorebook/baseball-scorebook-grid.ts`.** Nothing
  enforces this, and drift shows up as a misdrawn base path, not a failure.
- App shells register with `customElements.define('baseball-*', ...)`, **not**
  `@customElement`. This app does not use Lit decorators.
- Library components take JSON through Lit converters on string attributes
  (`slots-json`, `game-json`) and install co-located CSS with
  `CSSStyleSheet.replaceSync`.
- After editing `packages/web-components`, rebuild it before this app picks the
  change up.

## Testing

- `no-unused-expressions` warnings in `packages/web-components/test/` are chai
  patterns. Do not "fix" them.
- The Playwright config starts Vite on port 5199 with `--strictPort`. A stale
  server on that port hangs the run — kill it first.

## Blocking

- Scorebook path coordinates drifting from the grid component.
- App logic leaking into `@baseball/web-components`.
- Watch playback looping outside `baseball-game-shell`, or writing into a
  score-mode game.
