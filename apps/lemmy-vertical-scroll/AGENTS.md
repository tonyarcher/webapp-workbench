# AGENTS.md

Code style and project conventions for lemmy-vertical-scroll.

## Stack

- TypeScript (strict), Vite, Lit web components
- `@tanstack/query-core` (TanStack Query) as the data-layer glue, `@tanstack/virtual-core` for virtualized lists, `@tanstack/history` for hash routing, `idb` for IndexedDB
- No framework, no UI library: plain Lit custom elements
- Smoke tests with `tsx`, no test framework
- PWA: manifest + service worker in `public/`, installable from Chrome and Firefox

## Commands

```bash
npm run dev      # Vite dev server
npm run build    # tsc --noEmit && vite build && stamp service-worker version
npm run test     # tsx scripts/smoke.ts && tsx scripts/db-smoke.ts && tsx scripts/query-smoke.ts
npm run verify   # npm run build && npm run test
```

Always run `npm run build` and `npm run test` before finishing a change.

## Architecture

- `src/types.ts` — all shared domain types in one file (interfaces + discriminated unions + string-literal types)
- `src/db/` — persistence layer (idb); all reads/writes go through functions here, never raw IndexedDB in components
- `src/services/` — pure, testable logic; no DOM or component imports. Actual modules: `lemmy.ts` (Lemmy API client), `piefed.ts` (PieFed API client), `post-media.ts` (content classification, image extraction, embed resolution), `format.ts` (time/number formatting), `url.ts` (safe URL allow-listing)
- `src/web-components/<name>/<name>.ts` + `<name>.css` — one folder per component; co-located stylesheet imported with `?inline`
- `src/query.ts` — query keys, QueryClient, reactive query controllers; `src/mutations.ts` — mutations/events that update data
- `src/router.ts` — hash routing; a `View` discriminated union drives the whole app
- `public/` — PWA files (manifest, icons, service worker). All PWA paths must be base-relative (`%BASE_URL%` / `import.meta.env.BASE_URL`) so the app works from a subpath
- `scripts/` — smoke tests (`smoke.ts` services, `db-smoke.ts` idb, `query-smoke.ts` query/hydration) with a simple `assert(cond, msg)` helper, no framework; `stamp-sw.mjs` bumps the service-worker cache version at build time

## TypeScript

- Strict: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`
- `target: ES2022`, `moduleResolution: bundler`, imports may use `.ts` extensions (`allowImportingTsExtensions`)
- Prefix unused params with `_`: `upgrade(db, _oldVersion, _newVersion, tx)`
- `as const` for literal values where a narrower type is wanted (`read: 1 as const`)
- Exact optional fields (`field?: T`) for genuinely optional data; never `string | undefined` where `?` works
- Type-only imports: `import type {Settings} from '../types'` or inline `import {type DBSchema} from 'idb'`
- `override` keyword on Lit lifecycle overrides: `override willUpdate(changed: Map<string, unknown>)`

## Formatting

- 4-space indentation; LF line endings (enforced by `.gitattributes`)
- Single quotes; semicolons; trailing commas in multiline literals and params
- No space inside braces in value-position object literals (`{keyPath: 'id'}`, `{rootMargin: '500px 0px'}`); spaces inside braces in type literals (`{ kind: 'all' }`)
- Underscore separators in large numbers (`30_000`, `3_600_000`, `1_134_028_003`)
- Ternary chains for small conditional logic; early-return guards (`if (!ids.length) return;`)

## Naming

- camelCase for functions/vars, PascalCase for classes/types/interfaces, SCREAMING_SNAKE for module-level constants
- Kebab-case for custom element names, CSS class names, and CSS custom properties (`--row-border`)
- Component event names: kebab-case strings (`'unread-only-change'`); dispatch helper methods named `emit*` (`emitClose`, `emitDelete`)
- `*Key` suffix for query key factories (`articlesKey`, `libraryKey`)

## Lit components

- `@customElement('x-name')`, `@property()` for public API, `@property({attribute: false})` for object/boolean props, `@state() private` for internal state (a plain field is not reactive — anything the template reads must be `@state()` or a property)
- `static override styles = unsafeCSS(styles)` with `import styles from './x.css?inline'`
- Private fields declared after decorators, typed explicitly (`private img: HTMLImageElement | null = null`)
- Lifecycle: `willUpdate` for reacting to prop changes, `updated` for DOM side effects, `connectedCallback`/`disconnectedCallback` for global listeners (always remove in disconnect, including window pointer listeners installed mid-gesture)
- `ref` callbacks must have stable identity (arrow-function fields) so they only fire on attach/detach — inline arrows re-invoke on every render and can reset scroll positions
- `declare global { interface HTMLElementTagNameMap { 'x-name': XName; } }` at the bottom of every component file
- Events dispatched as `new CustomEvent('name', {detail, bubbles: true, composed: true})`
- Templates: 6-space indent, property bindings with `.checked=${...}`, handlers with `@click=${this.emitX}`, conditional branches via ternaries inside `${...}`

## Data & state

- All state flows through TanStack Query: components never hold shared data; query keys are typed and centralized in `query.ts`
- Query and idb cache keys must include every parameter the queryFn closes over (instance, feed type, sort, nsfw filter, software) — omitting one can pin an observer to a stale provider or filter
- Mutations update the DB, then `setQueryData`/`invalidateQueries`; optimistic cache patches go through helpers
- Floating promises marked with `void` and given `.catch(...)` (no unhandled rejections); IndexedDB writes await `tx.done`
- Multi-store writes go through a single transaction; settings read-modify-write happens inside one readwrite transaction
- All URLs from instance/post/community data are untrusted: every `href`/`src` binding must pass through `safeUrl()` from `src/services/url.ts`

## CSS

- Plain CSS, kebab-case classes, 4-space indent, no nesting
- Theming via CSS custom properties on `:root` / `[data-theme='...']` blocks; components only reference `var(--...)`, never hardcoded colors
- Keyframes and state classes for visual states; small fade/pulse animations for polish; honor `prefers-reduced-motion`

## Comments

- JSDoc (`/** */`) above non-obvious functions explaining the *why* and the tradeoffs, not the what
- Section dividers for file regions: `// ---- meta (key/value signals) ----`
- Comment magic numbers and heuristic constants
- No boilerplate comments; no comments on self-explanatory lines

## Verification

- `npm run build` (typecheck + build + SW stamping) and `npm run test` must pass before finishing
- Smoke tests in `scripts/` cover the pure logic (services, db, query/hydration); add assertions there when touching those modules
- No linter/prettier config — formatting is by hand per this guide

## Agent Flow

- Planner: read-only; produces the implementation plan, touched modules, risks, and required tests.
- Implementer: writes code, adds tests, runs verification, and never commits or pushes.
- Reviewer: uses a different model than the implementer, is read-only, inspects the full diff, runs verification independently, and returns `APPROVE` or `REQUEST-CHANGES`.
- Committer: commits only after reviewer approval and stages files explicitly.

The implementer must not modify `AGENTS.md` or `opencode.json` unless the task explicitly requests it.
