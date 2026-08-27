# AGENTS.md

Code style and project conventions for Calendar Sync (`apps/calendar-sync`).

## Stack

- TypeScript (strict), Vite, Lit web components
- `calendar-core` for ICS emit, Trakt/Netflix mappers, Google Calendar request helpers
- No TanStack, no IndexedDB, no router — credentials and last-sync stats persist in localStorage
- No framework, no UI library: plain Lit custom elements
- Smoke tests with `tsx`, no test framework
- PWA: manifest + service worker in `public/`, installable from Chrome and Firefox

## Commands

```bash
npm run dev      # Vite dev server (proxies /api/trakt → api.trakt.tv)
npm run build    # tsc --noEmit && vite build && stamp service-worker version
npm run test     # tsx scripts/smoke.ts
npm run verify   # npm run build && npm run test
```

Always run `npm run build` and `npm run test` before finishing a change.
After editing `packages/calendar-core`, rebuild it (`npm run build -w calendar-core`) before the app.

## Architecture

- `src/types.ts` — app settings types
- `src/services/` — settings, Trakt OAuth, Google GIS, download; no component imports
- `src/web-components/<name>/<name>.ts` + `<name>.css` — one folder per component; co-located stylesheet imported with `?inline`
- Event mapping, ICS, Netflix parse, Google insert live in `calendar-core` (pure, no DOM)
- `public/` — PWA files. Paths must be base-relative (`%BASE_URL%` / `import.meta.env.BASE_URL`)
- `scripts/` — smoke tests with `assert(cond, msg)`; `stamp-sw.mjs` bumps the SW cache version

## TypeScript

- Strict: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`
- `target: ES2022`, `moduleResolution: bundler`, imports may use `.ts` extensions (`allowImportingTsExtensions`)
- Prefix unused params with `_`
- Exact optional fields (`field?: T`) for genuinely optional data; never `string | undefined` where `?` works
- Type-only imports: `import type {X} from '...'`
- `override` keyword on Lit lifecycle overrides

## Formatting

- 4-space indentation; LF line endings (enforced by `.gitattributes`)
- Single quotes; semicolons; trailing commas in multiline literals and params
- No space inside braces in value-position object literals (`{keyPath: 'id'}`); spaces inside braces in type literals (`{ kind: 'all' }`)
- Ternary chains for small conditional logic; early-return guards (`if (!ids.length) return;`)

## Naming

- camelCase for functions/vars, PascalCase for classes/types/interfaces, SCREAMING_SNAKE for module-level constants
- Kebab-case for custom element names (`cal-*`), CSS class names, and CSS custom properties
- Component event names: kebab-case strings (`'sync'`); dispatch helper methods named `emit*` (`emitSync`)

## Lit components

- `@customElement('cal-name')`, `@property()` for public API, `@property({attribute: false})` for object/boolean props, `@state() private` for internal state
- `static override styles = unsafeCSS(styles)` with `import styles from './x.css?inline'`
- Private fields declared after decorators, typed explicitly
- `declare global { interface HTMLElementTagNameMap { 'cal-name': CalName; } }` at the bottom of every component file
- Events dispatched as `new CustomEvent('name', {detail, bubbles: true, composed: true})`
- Templates: 6-space indent, property bindings with `.checked=${...}`, handlers with `@click=${this.emitX}`

## Data & state

- Settings persist in localStorage (`settings.ts`); never log client secrets or tokens
- Trakt calls go through `./api/trakt` (Vite proxy in dev, nginx in deploy)
- Floating promises marked with `void` and given `.catch(...)` (no unhandled rejections)

## CSS

- Plain CSS, kebab-case classes, 4-space indent, no nesting
- Theming via CSS custom properties on `:root`; components only reference `var(--...)`, never hardcoded colors
- Honor `prefers-reduced-motion`

## Verification

- `npm run build` and `npm run test` must pass before finishing
- Changes to `calendar-core` need assertions in `packages/calendar-core/scripts/smoke.ts`
- Changes to `src/services/*` need assertions in `scripts/smoke.ts`
- No linter/prettier config — formatting is by hand per this guide
