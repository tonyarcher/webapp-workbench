# AGENTS.md

Baseball scorekeeping (`baseball-tracker`). Shared TypeScript / Lit / CSS /
workflow: repo-root `AGENTS.md`. Entirely client-side; there is no backend.

## Rules

- `src/widgets/` is for reusable scorebook and scoreboard widgets only. App
  shells (`app-shell`, `game-shell`, setup) stay in `src/local-game/`. Do not
  move app logic into `src/widgets/`, and do not add UI from another app there.
  A custom element written inside an app is not a candidate for that directory.
- The `rule-engine.ts` reducer is pure. Keep it free of DOM and persistence.
- **SVG base-point coordinates in `src/local-game/scorebook-path.ts` must stay
  in sync with `basePointX` and `basePointY` in
  `src/widgets/scorebook/baseball-scorebook-grid.ts`.** Nothing enforces this,
  and drift shows up as a misdrawn base path, not a failure.
- Lit decorators are available here, as in every other app in this repo; they
  are how the widget components declare their reactive surface. App shells also
  register with `customElements.define('baseball-*', ...)`, which is equally
  valid. Do not rewrite a working shell just to add decorators.
- Widget components take JSON through Lit converters on string attributes
  (`slots-json`, `game-json`) and install co-located CSS with
  `CSSStyleSheet.replaceSync`. Always define `:host` in `static styles`.
- `src/main.ts` imports `./widgets/index`, which exists only to register the
  elements. Adding a widget means adding its side-effect import there.

## Testing

- The widget tests live in `test/` and run in real Chromium under
  `npm run test:browser` (`@web/test-runner` with `@esm-bundle/chai`), not
  under vitest. `no-unused-expressions` warnings there are chai patterns — do
  not "fix" them.
- `npm test` runs both: vitest for `test:unit`, wtr for the widgets. `npm run
typecheck` uses `tsconfig.test.json`, which is what type-checks `test/`; the
  build config deliberately leaves it out, and wtr strips types without checking
  them, so a test error can otherwise reach a commit with every gate green.
- The widget coverage floor is checked on every widget run, because
  `test:browser` passes `--coverage` and `npm test` runs it. `test:coverage` adds
  the vitest half. A floor failure is a real failure, not a reporting artefact;
  close the gap with tests rather than by lowering the number in the config.
- The Playwright config starts Vite on port 5199 with `--strictPort`. A stale
  server on that port hangs the run — kill it first.

## Blocking

- Scorebook path coordinates drifting from the grid component.
- App logic leaking into `src/widgets/`.
- Watch playback looping outside `baseball-game-shell`, or writing into a
  score-mode game.
