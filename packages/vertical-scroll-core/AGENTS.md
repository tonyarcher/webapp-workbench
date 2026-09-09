# AGENTS.md

`vertical-scroll-core` — Lit vertical scroller, media slides, and embed players.
Shared TypeScript / Lit / CSS / workflow: repo-root `AGENTS.md`.

Consumed by `apps/lemmy-vertical-scroll` and `apps/clipstack`.

## Commands

```bash
npm run build   # vite build → dist/
npm test        # tsx scripts/smoke.ts
```

`prepare` builds `dist/` on install. Rebuild after changes before consumer apps pick them up.

## Rules

- Scroller primitive shared by lemmy **and** clipstack. No app-specific feed/import/account UI.
  Consumers map their types onto `ScrollItem`. Do not absorb app screens into this package.
- Importing the package must register the custom elements (side-effect imports in `src/index.ts`).
- Untrusted URLs go through `safeUrl()` in `src/url.ts` (`http:` / `https:` only).
- Embed providers stay in `src/embeds/`; add a provider there rather than in an app.
- Service/URL/media changes need assertions in `scripts/smoke.ts`.
