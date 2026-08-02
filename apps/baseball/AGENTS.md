# AGENTS.md

Instructions for AI agents working in this repository. Keep responses concise and direct.

## Project

Vite + TypeScript + Lit baseball scorekeeping app. Entirely client-side; no backend.

- `src/` — app code (Lit components, `local-game` rule engine/state, box score)
- `web-components/` — standalone Lit component library `@baseball/web-components` (see `web-components/.agents/AGENTS.md`)
- `e2e/` — Playwright end-to-end tests
- `styles/styles.css` — global design tokens (`:root` CSS variables)

## Commands

| Task | Command |
|---|---|
| Dev server | `npm run dev` |
| Build + type check | `npm run build` (`tsc --noEmit && vite build`) |
| Lint | `npm run lint` (oxlint) |
| Unit tests (`src/`) | `npm test` (vitest) |
| Component tests | `npm --prefix web-components run test` (@web/test-runner, real Chromium) |
| Component build | `npm --prefix web-components run build` |
| E2E tests | `npm run test:e2e` (builds components, then Playwright) |

## Architecture notes

- `src/local-game/rule-engine.ts` is a pure reducer; the top-level `BaseballApp` lives in `app-shell.ts`, the in-game UI shell in `game-shell.ts`; persistence via `game-store.ts`/`save-state.ts`.
- Notation strings: `src/local-game/notation.ts`. SVG base-point coordinates in `src/local-game/scorebook-path.ts` MUST stay in sync with `basePointX`/`basePointY` in `web-components/src/scorebook/baseball-scorebook-grid.ts`.
- Web components receive data as JSON attributes (`slots-json`, `game-json`, ...) parsed with Lit `converter`s; events are standard `CustomEvent`s.
- Component CSS is co-located `*.css` imported via Vite `?inline` and installed with `CSSStyleSheet.replaceSync` (see `web-components/src/scorebook/baseball-scorebook-grid.ts`).

## Testing

- `src/`: co-located `*.test.ts`, run with vitest.
- `web-components/`: tests in `web-components/test/` with `@esm-bundle/chai`, run in Chromium via @web/test-runner.
- `e2e/`: Playwright against `http://localhost:5199`. The Playwright config starts its own Vite server on port 5199 with `--strictPort`; a stale dev server on that port can hang the run — kill it first.
- Known lint state: `no-unused-expressions` warnings in web-component tests are expected chai patterns; do not "fix" them.

## Workflow (mandatory)

1. Make focused changes; for bug fixes, write a failing regression test before/with the fix.
2. Run the full suite: lint, unit tests, component tests, e2e tests, and `npm run build`.
3. Always run the review agent (the built-in `review` subagent) on the changes and address its findings.
4. Once review passes, commit with a conventional message (`feat:`, `fix:`, `refactor:`, `chore:`, `test:`, `docs:`) and push to `main` — no separate approval needed.
