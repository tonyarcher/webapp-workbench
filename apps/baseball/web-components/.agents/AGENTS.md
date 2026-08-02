## Scope

You are developing `@baseball/web-components`, the standalone Lit component library consumed by the Vite app. Components must stay framework-agnostic and self-contained.

## Commands (run from the repo root)

- Build: `npm --prefix web-components run build`
- Tests: `npm --prefix web-components run test` (@web/test-runner in real Chromium)
- Coverage: `npm --prefix web-components run test:coverage`

## Rules

- Keep components pure web standards (Lit, custom elements, `CustomEvent`s, JSON string attributes parsed with Lit `converter`s). No app, server, or framework-specific logic inside components.
- Structure, layout, and visual CSS lives inside the component; co-located `*.css` files are imported via Vite `?inline` and installed with `CSSStyleSheet.replaceSync` (see `src/scorebook/baseball-scorebook-grid.ts`).
- Always define a `:host` selector in `static styles` for the element's default block behavior.
- Global design tokens live in `styles/styles.css` at the repo root; component styles currently define their own values.
- Test changes in `web-components/test/` with `@esm-bundle/chai`. The `no-unused-expressions` lint warnings in tests are expected chai patterns — do not "fix" them.
