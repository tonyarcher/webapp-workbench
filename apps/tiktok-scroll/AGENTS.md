# AGENTS.md

Code style and project conventions for Clipstack (`apps/tiktok-scroll`).

## Stack

- TypeScript (strict), Vite, Lit web components
- `vertical-scroll-core` for the vertical scroller and TikTok embed player
- No TanStack, no IndexedDB, no router — list + position persist in localStorage so a refresh resumes
- No framework, no UI library: plain Lit custom elements
- Smoke tests with `tsx`, no test framework
- PWA: manifest + service worker in `public/`, installable from Chrome and Firefox

## Commands

```bash
npm run dev      # Vite dev server
npm run build    # tsc --noEmit && vite build && stamp service-worker version
npm run test     # tsx scripts/smoke.ts
npm run verify   # npm run build && npm run test
```

Always run `npm run build` and `npm run test` before finishing a change.

## Architecture

- `src/types.ts` — all shared domain types in one file (interfaces + string-literal types)
- `src/services/` — pure, testable logic; no DOM or component imports. Actual modules: `parse-list.ts` (URL extraction + TikTok classification), `to-scroll-item.ts` (TikTokLink → ScrollItem), `session-store.ts` (localStorage list + position), `resolve-oembed.ts`
- `src/web-components/<name>/<name>.ts` + `<name>.css` — one folder per component; co-located stylesheet imported with `?inline`
- `public/` — PWA files (manifest, icon, service worker). All PWA paths must be base-relative (`%BASE_URL%` / `import.meta.env.BASE_URL`) so the app works from a subpath
- `scripts/` — smoke tests (`smoke.ts` services) with a simple `assert(cond, msg)` helper, no framework; `stamp-sw.mjs` bumps the service-worker cache version at build time

## TypeScript

- Strict: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`
- `target: ES2022`, `moduleResolution: bundler`, imports may use `.ts` extensions (`allowImportingTsExtensions`)
- Prefix unused params with `_`
- Exact optional fields (`field?: T`) for genuinely optional data; never `string | undefined` where `?` works
- Type-only imports: `import type {X} from '...'`
- `override` keyword on Lit lifecycle overrides: `override willUpdate(changed: Map<string, unknown>)`

## Formatting

- 4-space indentation; LF line endings (enforced by `.gitattributes`)
- Single quotes; semicolons; trailing commas in multiline literals and params
- No space inside braces in value-position object literals (`{keyPath: 'id'}`); spaces inside braces in type literals (`{ kind: 'all' }`)
- Ternary chains for small conditional logic; early-return guards (`if (!ids.length) return;`)

## Naming

- camelCase for functions/vars, PascalCase for classes/types/interfaces, SCREAMING_SNAKE for module-level constants
- Kebab-case for custom element names, CSS class names, and CSS custom properties (`--row-border`)
- Component event names: kebab-case strings (`'import-parsed'`); dispatch helper methods named `emit*` (`emitImportParsed`)

## Lit components

- `@customElement('cs-name')`, `@property()` for public API, `@property({attribute: false})` for object/boolean props, `@state() private` for internal state (a plain field is not reactive — anything the template reads must be `@state()` or a property)
- `static override styles = unsafeCSS(styles)` with `import styles from './x.css?inline'`
- Private fields declared after decorators, typed explicitly
- Lifecycle: `willUpdate` for reacting to prop changes, `updated` for DOM side effects, `connectedCallback`/`disconnectedCallback` for global listeners (always remove in disconnect)
- `ref` callbacks must have stable identity (arrow-function fields) so they only fire on attach/detach — inline arrows re-invoke on every render and can reset scroll positions
- `declare global { interface HTMLElementTagNameMap { 'cs-name': CsName; } }` at the bottom of every component file
- Events dispatched as `new CustomEvent('name', {detail, bubbles: true, composed: true})`
- Templates: 6-space indent, property bindings with `.checked=${...}`, handlers with `@click=${this.emitX}`, conditional branches via ternaries inside `${...}`

## Data & state

- List + last position persist in localStorage (`session-store.ts`); New list clears the saved session
- All URLs from user input are untrusted: every `href`/`src` binding must pass through `safeUrl()` from `vertical-scroll-core`
- Floating promises marked with `void` and given `.catch(...)` (no unhandled rejections)

## CSS

- Plain CSS, kebab-case classes, 4-space indent, no nesting
- Theming via CSS custom properties on `:root`; components only reference `var(--...)`, never hardcoded colors
- Honor `prefers-reduced-motion`

## Comments

- JSDoc (`/** */`) above non-obvious functions explaining the *why* and the tradeoffs, not the what
- Comment magic numbers and heuristic constants
- No boilerplate comments; no comments on self-explanatory lines

## Verification

- `npm run build` (typecheck + build + SW stamping) and `npm run test` must pass before finishing
- Smoke tests in `scripts/` cover the pure logic (services); add assertions there when touching those modules
- No linter/prettier config — formatting is by hand per this guide

## Agent Flow

- Planner: read-only; produces the implementation plan, touched modules, risks, and required tests.
- Implementer: writes code, adds tests, runs verification, and never commits or pushes.
- Reviewer: uses a different model than the implementer, is read-only, inspects the full diff, runs verification independently, and returns `APPROVE` or `REQUEST-CHANGES`.
- Committer: commits only after reviewer approval and stages files explicitly.

The implementer must not modify `AGENTS.md` or `opencode.json` unless the task explicitly requests it.