# AGENTS.md

`@baseball/web-components` — Lit scorebook/scoreboard library consumed by `apps/baseball`.
Shared TypeScript / Lit / CSS / workflow: repo-root `AGENTS.md`.

## Commands (from this directory, or `-w @baseball/web-components` from repo root)

```bash
npm run build           # vite build
npm test                # @web/test-runner in real Chromium
npm run test:coverage   # wtr --coverage
```

`prepare` builds `dist/` on install. Rebuild after changes before the baseball app picks them up.

## Rules

- Scorebook/scoreboard widgets only. Do not move baseball app shells, routing, or persistence here.
  Do not add UI from other apps. A custom element in an app is not a candidate for this package.
- Data in via JSON string attributes parsed with Lit `converter`s (`slots-json`, `game-json`, …).
  Events out via `CustomEvent`.
- Co-located `*.css` imported with Vite `?inline` and installed with `CSSStyleSheet.replaceSync`
  (see `src/scorebook/baseball-scorebook-grid.ts`). Always define `:host` in `static styles`.
- `basePointX` / `basePointY` in `src/scorebook/baseball-scorebook-grid.ts` **must** stay in sync
  with `apps/baseball/src/local-game/scorebook-path.ts`.
- Tests live in `test/` with `@esm-bundle/chai`. `no-unused-expressions` warnings are chai
  patterns — do not “fix” them.
