# AGENTS.md

`vertical-scroll-core` — Lit vertical scroller, media slides, and embed players.
Shared TypeScript / Lit / CSS / workflow: repo-root `AGENTS.md`.

## Rules

- This is a scroller primitive shared by more than one app. It carries no
  app-specific feed, import, or account UI. Consumers map their own types onto
  `ScrollItem`; do not absorb an app screen here.
- Importing the package must register the custom elements, via the side-effect
  imports in `src/index.ts`. A type-only import gets tree-shaken and nothing
  renders.
- Untrusted URLs go through `safeUrl()` in `src/url.ts`, which allows `http:`
  and `https:` only. Do not bypass it.
- Embed providers belong in `src/embeds/`. Add a provider there rather than in
  an app.
- `prepare` builds `dist/` on install, and consumer apps need a rebuild to pick
  up a change.

## Verification

- Service, URL, and media changes need assertions in `scripts/smoke.ts`.
