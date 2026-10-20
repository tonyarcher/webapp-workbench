# AGENTS.md

Coldwater: a browser clone of the 1986 MECC lake-survival game. Shared
TypeScript / Lit / CSS / workflow: repo-root `AGENTS.md`.

## Rules

- **Original work only.** The game is a clone of the rules and the food-web
  lesson, not of the original MECC art, prose, audio, or code. Do not copy
  screenshots, sprites, manual text, or sounds into this app.
- `src/core/` is headless and pure: data, seeded RNG, encounter resolution, and
  the run state machine. No DOM, Lit, `window`, or `localStorage` there.
- The UI owns the points-mode clock. `src/web-components/app-shell/` starts,
  stops, and aborts the timer in `connectedCallback` / `disconnectedCallback`,
  and never leaves a `setInterval` behind after a run ends or the element is
  removed.
- The core is deterministic for a seed. Do not replace the seeded roll with
  `Math.random()` inside `src/core/`; resolve outcomes through
  `resolveEncounter` or `chooseAction`.
- Practice names are visible. Points names stay hidden until the outcome, which
  is the identification challenge. Do not add a name to the points clue.
- The lake is one screen with no history routing; S3 serves the base path only,
  with no SPA fallback.
- High scores use `localStorage` through `src/services/high-score.ts`. Do not
  write raw storage keys from a component.
- Art is inline SVG in `src/web-components/fish-art/`; it is decorative and
  `aria-hidden`, so every screen must carry the animal's name in text.
- Honour `prefers-reduced-motion`.

## Verification

- Core changes need tests in the co-located `src/core/*.test.ts` files.
- UI state, keyboard shortcuts, and timer ownership need tests in the
  component's `*.test.ts`.
- `npm test`, `npm run build`, and `npm run test:coverage` from this directory
  must pass. E2E and the axe audit run with `npm run test:e2e` on port `5210`.
