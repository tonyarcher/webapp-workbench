# AGENTS.md

Baseball scorekeeping (`baseball-tracker`). Shared TypeScript / Lit / CSS / workflow:
repo-root `AGENTS.md`.

## Stack

- Vite + TypeScript + Lit. Entirely client-side; no backend.
- `@baseball/web-components` for reusable scorebook/scoreboard widgets only.
  App shells (`app-shell`, `game-shell`, setup) stay in `src/local-game/` — they are not package material.
- `@tanstack/query-core`, `@tanstack/virtual-core`, `@tanstack/history`, `idb`.
- Unit tests: vitest (`src/**/*.test.ts`). Components: @web/test-runner in Chromium.
- E2E: Playwright against `http://localhost:5199`.

## Commands

| Task | Command |
|---|---|
| Dev server | `npm run dev` |
| Build + type check | `npm run build` (`tsc --noEmit && vite build`) |
| Lint | `npm run lint` (oxlint) |
| Unit tests | `npm test` (vitest) |
| Component tests | `npm --prefix ../../packages/web-components run test` |
| Component build | `npm run build:components` |
| E2E | `npm run test:e2e` (builds components, then Playwright) |

After editing `packages/web-components`, rebuild it before the app.

## Architecture

- `src/local-game/rule-engine.ts` — pure reducer. `app-shell.ts` is the top-level app; `game-shell.ts` is in-game UI; persistence via `game-store.ts` / `save-state.ts`.
- Notation: `src/local-game/notation.ts`. SVG base-point coordinates in `src/local-game/scorebook-path.ts` **must** stay in sync with `basePointX` / `basePointY` in `packages/web-components/src/scorebook/baseball-scorebook-grid.ts`.
- App shells register with `customElements.define('baseball-*', …)` (not `@customElement`). Library components use Lit converters on JSON attributes (`slots-json`, `game-json`, …) and `CSSStyleSheet.replaceSync` for co-located CSS.
- Global tokens: `styles/styles.css` (`:root` variables).

## Testing

- `src/`: co-located `*.test.ts`, vitest.
- `packages/web-components/test/`: `@esm-bundle/chai` in real Chromium. `no-unused-expressions` warnings in those tests are chai patterns — do not “fix” them.
- `e2e/`: Playwright config starts Vite on 5199 with `--strictPort`. A stale server on that port hangs the run.

## Blocking

- Scorebook path coordinates drifting from the grid component.
- App logic leaking into `@baseball/web-components`.
