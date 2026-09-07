# AGENTS.md

Code style and project conventions for Football (`apps/football`).

## Stack

- TypeScript (strict), Vite, Lit web components
- `football-core` for rulebooks, the play-by-play reducer, clock, and notation
- Client-side scorekeeping with IndexedDB; Postgres API comes later
- No framework, no UI library: plain Lit custom elements
- Unit tests with vitest (co-located `*.test.ts`)

## Commands

```bash
npm run dev          # Vite dev server
npm run build        # tsc --noEmit && vite build
npm run test         # vitest run
```

Always run `npm run build` and `npm run test` before finishing a change.
After editing `packages/football-core`, rebuild it (`npm run build -w football-core`) before the app.

## Architecture

- `src/local-game/` — GameStore (event-sourced undo/redo) and IndexedDB save-state
- `src/web-components/<name>/<name>.ts` + `<name>.css` — one folder per component; co-located stylesheet imported with `?inline`
- Domain math lives in `football-core`, not copied into the app

## TypeScript

- Strict: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`
- Prefix unused params with `_`
- Exact optional fields (`field?: T`)
- Type-only imports: `import type {X} from '...'`
- `override` keyword on Lit lifecycle overrides

## Formatting

- 4-space indentation; LF line endings
- Single quotes; semicolons; trailing commas in multiline literals and params
- Custom elements: `fb-*`

## Lit components

- `@customElement('fb-name')`, `@property()` for public API, `@state() private` for internal state
- `static override styles = unsafeCSS(styles)` with `import styles from './x.css?inline'`
- Events: `new CustomEvent('name', {detail, bubbles: true, composed: true})`
- Honor `prefers-reduced-motion` via global CSS

## Verification

- `npm run build` and `npm run test` must pass before finishing
- Engine/rulebook changes need tests in `packages/football-core/src/*.test.ts`
- Store/persist changes need tests in `src/local-game/*.test.ts`
