# AGENTS.md

`@baseball/web-components` — Lit scorebook and scoreboard library.
Shared TypeScript / Lit / CSS / workflow: repo-root `AGENTS.md`.

## Rules

- Scorebook and scoreboard widgets only. Do not move baseball app shells,
  routing, or persistence here, and do not add UI from another app. A custom
  element written inside an app is not a candidate for this package.
- Data goes in as JSON string attributes parsed by Lit `converter`s
  (`slots-json`, `game-json`). Events go out via `CustomEvent`.
- Co-located CSS is imported with Vite `?inline` and installed with
  `CSSStyleSheet.replaceSync`. Always define `:host` in `static styles`.
- **`basePointX` and `basePointY` in
  `src/scorebook/baseball-scorebook-grid.ts` must stay in sync with
  `apps/baseball/src/local-game/scorebook-path.ts`.** Nothing enforces this, and
  drift shows up as a misdrawn base path rather than a test failure.
- `prepare` builds `dist/` on install, and the consumer app needs a rebuild to
  pick up a change.

## Verification

- Tests live in `test/` and run in real Chromium with `@esm-bundle/chai`.
  `no-unused-expressions` warnings there are chai patterns — do not "fix" them.
