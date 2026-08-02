# AGENTS.md

Code style and project conventions. Copy this file into new projects that should follow the same conventions.

## Stack

- TypeScript (strict), Vite, Lit web components
- `@tanstack/query-core` (TanStack Query) as the data-layer glue, `@tanstack/virtual-core` for virtualized lists, `@tanstack/history` for hash routing, `idb` for IndexedDB
- No framework, no UI library: plain Lit custom elements
- Smoke tests with `tsx`, no test framework

## Commands

```bash
npm run dev      # Vite dev server
npm run build    # tsc --noEmit && vite build && node scripts/write-sw.mjs  (typecheck before finishing; generates dist/sw.js)
npm run preview  # serve the production build (PWA checks, install tests)
npm run test     # tsx scripts/smoke.ts && tsx scripts/db-smoke.ts
```

## Architecture

- `src/types.ts` — all shared domain types in one file (interfaces + discriminated unions + string-literal types)
- `src/db/` — persistence layer (idb); all reads/writes go through functions here, never raw IndexedDB in components
- `src/services/` — pure, testable logic (parser, ranking, sync, opml, proxy); no DOM or component imports
- `src/web-components/<name>/<name>.ts` + `<name>.css` — one folder per component; co-located stylesheet imported with `?inline`
- `src/query.ts` — query keys, QueryClient, reactive query controller; `src/mutations.ts` — mutations/events that update data
- `src/router.ts` — hash routing; a `View` discriminated union drives the whole app
- `scripts/` — smoke tests, plus Windows helpers (`install-firefox.ps1`, `make-icons.ps1`) and the PWA build step (`sw.template.js` → `dist/sw.js` via `write-sw.mjs`)
- PWA: `public/manifest.webmanifest`, `public/icon-*.png`; the service worker is generated at build time — never edit `dist/sw.js`, edit `scripts/sw.template.js`

## TypeScript

- Strict: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`
- `target: ES2022`, `moduleResolution: bundler`, imports may use `.ts` extensions (`allowImportingTsExtensions`)
- Prefix unused params with `_`: `upgrade(db, _oldVersion, _newVersion, tx)`
- `as const` for literal values where a narrower type is wanted (`read: 1 as const`)
- Exact optional fields (`field?: T`) for genuinely optional data; never `string | undefined` where `?` works
- Type-only imports: `import type {Article} from '../types'` or inline `import {type DBSchema} from 'idb'`
- `override` keyword on Lit lifecycle overrides: `override willUpdate(changed: Map<string, unknown>)`

## Formatting

- 4-space indentation; LF line endings
- Single quotes; semicolons; trailing commas in multiline literals and params
- No space inside braces in value-position object literals (`{keyPath: 'id'}`, `{rootMargin: '500px 0px'}`); spaces inside braces in type literals (`{ kind: 'all' }`)
- Underscore separators in large numbers (`30_000`, `3_600_000`, `1_134_028_003`)
- Multiline call chains/destructured params indent one extra level (8 spaces):
  ```ts
  export async function queryArticles({
                                          feedId,
                                          unreadOnly,
                                          sort = 'newest',
                                      }: ArticleQuery): Promise<{items: Article[]; hasMore: boolean}> {
  ```
- Ternary chains for small conditional logic; early-return guards (`if (!ids.length) return;`)

## Naming

- camelCase for functions/vars, PascalCase for classes/types/interfaces, SCREAMING_SNAKE for module-level constants
- Kebab-case for custom element names, CSS class names, and CSS custom properties (`--row-border`)
- Component event names: kebab-case strings (`'unread-only-change'`); dispatch helper methods named `emit*` (`emitClose`, `emitDelete`)
- `*Key` suffix for query key factories (`articlesKey`, `libraryKey`)

## Lit components

- `@customElement('x-name')`, `@property()` for public API, `@property({attribute: false})` for object/boolean props, `@state() private` for internal state
- `static override styles = unsafeCSS(styles)` with `import styles from './x.css?inline'`
- Private fields declared after decorators, typed explicitly (`private img: HTMLImageElement | null = null`)
- Lifecycle: `willUpdate` for reacting to prop changes, `updated` for DOM side effects, `connectedCallback`/`disconnectedCallback` for global listeners (always remove in disconnect)
- `declare global { interface HTMLElementTagNameMap { 'x-name': XName; } }` at the bottom of every component file
- Events dispatched as `new CustomEvent('name', {detail, bubbles: true, composed: true})`
- Templates: 6-space indent, property bindings with `.checked=${...}`, handlers with `@click=${this.emitX}`, conditional branches via ternaries inside `${...}`

## Data & state

- All state flows through TanStack Query: components never hold shared data; query keys are typed and centralized in `query.ts`
- Mutations update the DB, then `invalidateQueries`; optimistic cache patches go through helpers like `updateArticlesInCache`
- Floating promises marked with `void` (`void recomputeHotIfNeeded()`); IndexedDB writes await `tx.done`
- Multi-store writes go through a single transaction; counters are reconciled, not trusted (`reconcileUnreadCounts`)

## CSS

- Plain CSS, kebab-case classes, 4-space indent, no nesting
- Theming via CSS custom properties on `:root` / `[data-theme='...']` blocks; components only reference `var(--...)`, never hardcoded colors
- Keyframes and state classes (`class=".lazy-placeholder.lazy-error"`) for visual states; small fade/pulse animations for polish

## Comments

- JSDoc (`/** */`) above non-obvious functions explaining the *why* and the tradeoffs, not the what
- Section dividers for file regions: `// ---- meta (key/value signals) ----`
- Comment magic numbers and heuristic constants (`// ~10x edge offsets roughly a day of age`)
- No boilerplate comments; no comments on self-explanatory lines

## Workflow: implementer + reviewer

Two roles on every change:

- **Implementer** (Deepseek): writes the change, runs the checks, reports changed files.
- **Reviewer** (OpenCode): audits the finished diff — including untracked files — and files findings. The reviewer never edits code silently or commits on the implementer's behalf.

Ordering:

1. Start from a clean or explicitly scoped worktree; `git status` shows exactly what the change owns.
2. Implementer reads `AGENTS.md` + affected files, implements, runs `npm run test` then `npm run build`.
3. Reviewer inspects `git status`, `git diff --stat`, `git diff`, and every new/untracked file, re-runs `npm run test` and `npm run build`, and files blocking/non-blocking findings.
4. Implementer fixes all blocking findings; repeat until the review is clean.
5. Final gate before handoff/commit: `npm run test`, then `npm run build`, then `git diff --check`.
6. Do not commit unless explicitly requested.

## Review standards

- Read the whole diff, not the summary; include untracked release files (PWA assets, scripts).
- Check each hunk against this file: TypeScript strictness, formatting, naming, Lit, data & state, CSS, comments.
- Blocking rejections: raw IndexedDB outside `src/db/`, new UI frameworks/libraries, hardcoded colors outside `:root`/`[data-theme]` vars, floating promises without `void`, IndexedDB writes not awaiting `tx.done`, multi-store writes outside a single transaction, destructive DB upgrades (`deleteObjectStore` in `upgrade`), unsafe feed URLs reaching `unsafeHTML`/`href`/`img`, and any test or build failure.
- Changes to `src/services/*`, `src/db/*`, `src/util.ts`, `src/ai.ts`, or `src/types.ts` must come with new/extended assertions in `scripts/smoke.ts` or `scripts/db-smoke.ts`.
- PWA changes: confirm `dist/` contains `sw.js`, `manifest.webmanifest`, and icons after build; test `npm run preview` + a fresh offline relaunch; the generated `CACHE` name in `dist/sw.js` must change when bundles change.

## Verification

- `npm run build` (typecheck + build + SW generation) must pass before finishing
- Smoke tests in `scripts/` cover the pure logic (parser, ranking, db, ai); add assertions there when touching those modules
- No linter/prettier config — formatting is by hand per this guide
- Line endings: LF everywhere (`*.png` binary); `.gitattributes` enforces this — don't convert files to CRLF
