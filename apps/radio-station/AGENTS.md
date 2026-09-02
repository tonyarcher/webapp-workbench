# AGENTS.md

Code style and project conventions for Radio Station (`apps/radio-station`).

## Stack

- TypeScript (strict), Vite, Lit web components
- `@tanstack/virtual-core` for the 7-day log
- Node `http` + `pg` API (`server/`); Postgres database `radio` on the shared compose instance
- No framework, no UI library: plain Lit custom elements
- Smoke tests with `tsx`, no test framework; integration tests use `embedded-postgres`
- PWA: manifest + service worker in `public/`, installable from Chrome and Firefox

## Commands

```bash
npm run dev          # Vite dev server (proxies /api → :3002)
npm run dev:server   # API on :3002
npm run build        # tsc --noEmit && vite build && stamp service-worker version
npm run build:server # tsc -p server/tsconfig.json → dist-server/
npm run test         # tsx scripts/smoke.ts && tsx scripts/integration.ts
npm run verify       # npm run build && npm run test
```

Always run `npm run build` and `npm run test` before finishing a change.

## Architecture

- `src/types.ts` — all shared client domain types
- `src/services/` — pure, testable logic; no DOM or component imports. Actual modules: `api.ts`, `export-txt.ts`, `now-playing.ts`, `list-items.ts`, `session-store.ts`, `format.ts`
- `src/web-components/<name>/<name>.ts` + `<name>.css` — one folder per component; co-located stylesheet imported with `?inline`
- `server/` — Postgres schema, catalog seed, CHR scheduler, JSON/txt HTTP API. No DOM. NodeNext `.js` import specifiers
- `public/` — PWA files. Paths must be base-relative (`%BASE_URL%` / `import.meta.env.BASE_URL`)
- `scripts/` — smoke tests with `assert(cond, msg)`; `stamp-sw.mjs` bumps the SW cache version; `integration.ts` boots embedded Postgres

## TypeScript

- Strict: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`
- Client: `target: ES2022`, `moduleResolution: bundler`, `allowImportingTsExtensions`
- Server: `module: NodeNext`, `outDir: dist-server`
- Prefix unused params with `_`
- Exact optional fields (`field?: T`) for genuinely optional data; never `string | undefined` where `?` works
- Type-only imports: `import type {X} from '...'`
- `override` keyword on Lit lifecycle overrides

## Formatting

- 4-space indentation; LF line endings (enforced by `.gitattributes`)
- Single quotes; semicolons; trailing commas in multiline literals and params
- No space inside braces in value-position object literals (`{keyPath: 'id'}`); spaces inside braces in type literals (`{ kind: 'all' }`)
- Underscore separators in large numbers (`30_000`, `3_600_000`)
- Ternary chains for small conditional logic; early-return guards (`if (!ids.length) return;`)

## Naming

- camelCase for functions/vars, PascalCase for classes/types/interfaces, SCREAMING_SNAKE for module-level constants
- Kebab-case for custom element names (`rs-*`), CSS class names, and CSS custom properties
- Component event names: kebab-case strings (`'generate'`); dispatch helper methods named `emit*` (`emitGenerate`)

## Lit components

- `@customElement('rs-name')`, `@property()` for public API, `@property({attribute: false})` for object/boolean props, `@state() private` for internal state
- `static override styles = unsafeCSS(styles)` with `import styles from './x.css?inline'`
- Private fields declared after decorators, typed explicitly
- `ref` callbacks must have stable identity (arrow-function fields)
- `declare global { interface HTMLElementTagNameMap { 'rs-name': RsName; } }` at the bottom of every component file
- Events dispatched as `new CustomEvent('name', {detail, bubbles: true, composed: true})`
- Templates: 6-space indent, property bindings with `.checked=${...}`, handlers with `@click=${this.emitX}`

## Data & state

- Last generate (playlist id, seed, weights, startsAt) persists in localStorage (`session-store.ts`)
- Catalog and generated weeks live in Postgres; the client never talks to ranking APIs
- Floating promises marked with `void` and given `.catch(...)` (no unhandled rejections)
- Weights are canonicalized to integers on the server before insert/lookup

## CSS

- Plain CSS, kebab-case classes, 4-space indent, no nesting
- Theming via CSS custom properties on `:root`; components only reference `var(--...)`, never hardcoded colors
- Honor `prefers-reduced-motion`

## Comments

- JSDoc (`/** */`) above non-obvious functions explaining the *why* and the tradeoffs, not the what
- Comment magic numbers and heuristic constants
- No boilerplate comments; no comments on self-explanatory lines

## Verification

- `npm run build` and `npm run test` must pass before finishing
- Changes to `src/services/*` or `server/services/*` need assertions in `scripts/smoke.ts`
- API/schema changes need assertions in `scripts/integration.ts`
- No linter/prettier config — formatting is by hand per this guide

## Agent Flow

- Planner: read-only; produces the implementation plan, touched modules, risks, and required tests.
- Implementer: writes code, adds tests, runs verification, and never commits or pushes.
- Reviewer: uses a different model than the implementer, is read-only, inspects the full diff, runs verification independently, and returns `APPROVE` or `REQUEST-CHANGES`.
- Committer: commits only after reviewer approval and stages files explicitly.

The implementer must not modify `AGENTS.md` or `opencode.json` unless the task explicitly requests it.
