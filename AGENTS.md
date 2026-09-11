# AGENTS.md

Instructions for AI agents working in this monorepo.
Read the workspace `AGENTS.md` before touching that app or package.

## Project

npm-workspaces monorepo of small TypeScript web apps plus a Kotlin identity API.
Most apps are Vite + Lit custom elements (no UI framework). Stock-game is the
exception: TanStack Start (SPA) with React route shells and decorator-free Lit.
Shared libraries live in `packages/*`. `user-api` is Gradle / Ktor, not Node.

## Layout

- `apps/baseball/` — baseball scorekeeping (`baseball-tracker`), client-side only. Depends on `@baseball/web-components`.
- `apps/rss-reader/` — RSS reader (TanStack core, hash router, PWA, Postgres API).
- `apps/stock-game/` — paper-trading simulator; nested workspaces `app/` (`@stock-game/app`) and `shared/` (`@stock-game/shared`); SQLite server layer.
- `apps/lemmy-vertical-scroll/` — vertical feed scroller. Depends on `vertical-scroll-core`.
- `apps/clipstack/` — short-video list scroller. Depends on `vertical-scroll-core`.
- `apps/calendar-sync/` — Trakt + Netflix → ICS / Google Calendar. Depends on `calendar-core`.
- `apps/radio-station/` — radio-station simulator. Postgres catalog + node API.
- `apps/football/` — football live scorekeeping. Pluggable NFL/NCAA/MN/CO rulebooks; IndexedDB. Depends on `football-core`.
- `apps/fitness/` — fitness tracker. Health Connect/CSV import, 5/3/1; Postgres API. Depends on `fitness-core`.
- `apps/user-web/` — accounts landing page (`/auth/`). Lit shell; talks to `user-api`.
- `apps/user-api/` — shared identity API (Kotlin 2.2 / JVM 21 / Ktor). Postgres database `users`.
- `packages/web-components/` — `@baseball/web-components` Lit library.
- `packages/vertical-scroll-core/` — Lit scroller + embed players.
- `packages/calendar-core/` — ICS / Trakt / Netflix / Google Calendar helpers.
- `packages/football-core/` — rulebooks, play-by-play reducer, clock, notation.
- `packages/fitness-core/` — units, 5/3/1, body formulas, importers.
- `deploy/` — Docker Compose reverse-proxy gateway (`/` hello page; apps under `/baseball/`, `/rss-reader/`, `/stock-game/`, `/lemmy-vertical-scroll/`, `/clipstack/`, `/calendar-sync/`, `/radio-station/`, `/football/`, `/fitness/`, `/auth/`, `/user-api/`).

Library `prepare` scripts build `dist/` on install. After changing a package, rebuild it
(`npm run build -w <name>`) or reinstall before consumers pick up the change.

## Commands (run from the repo root)

| Task | Command |
|---|---|
| Install all workspaces | `npm install` |
| Build all | `npm run build` (delegates `--workspaces --if-present`) |
| Test all | `npm test` |
| Typecheck all | `npm run typecheck` |
| Lint all | `npm run lint` |
| Dev server (one app) | `npm run dev:baseball` / `dev:rss-reader` / `dev:stock-game` / `dev:lemmy` / `dev:clipstack` / `dev:calendar-sync` / `dev:radio-station` / `dev:radio-api` / `dev:football` / `dev:fitness` / `dev:fitness-api` / `dev:user-web` / `dev:user-api` |
| Build (OS script) | `./build.sh` or `.\build.ps1` (`./build.sh rss` for one app) |
| Deploy compose stack | `./deploy.sh` or `.\deploy.ps1` (auto local Docker vs SSH tunnel; `./deploy.sh rss` rebuilds one app). PowerShell tab-completes app names on `.\deploy.ps1`; bash: `source scripts/complete-deploy.bash`. |

Per-app commands run inside the app directory (e.g. `cd apps/baseball && npm test`).
RSS API: `npm run dev:server -w rss-reader` (not a root `dev:*` alias).

`packages/web-components` tests use @web/test-runner in real Chromium; `apps/baseball` e2e
uses Playwright on `:5199` (`headless: true`). Fresh machine: `npx playwright install`.
A stale Vite process on 5199 hangs baseball e2e — kill it first.

## Workflow

1. Read this file and the workspace `AGENTS.md`. Make a focused change.
2. Bug fixes: add a failing regression test with the fix. Core / data / API / service
   changes need new or extended tests in that workspace.
3. Verify in the workspace you touched: `npm test`, then `npm run build` (or `npm run verify`
   when the app has it). Then `git diff --check`.
4. Dispatch the `review` subagent on the **full uncommitted diff** (including untracked files).
   Fix blocking findings and re-dispatch until `APPROVE`. The reviewer does not edit or commit.
5. Do not commit or push unless the user explicitly asks. Conventional commits
   (`feat:`, `fix:`, `chore:`, `test:`, `docs:`, `refactor:`). Stage files explicitly.
6. Do not edit `AGENTS.md` or `opencode.json` unless the task asks.
7. Large research: dispatch `explore`. Large self-contained implementation: dispatch `general`
   with a precise spec, then read the diff yourself — do not blindly trust it.

## Shared package vs app module

Default to an **app-local module**. A Lit custom element is an implementation detail, not a
sharing strategy. `apps/*/src/web-components/` and stock-game `app/src/components/` are that
app’s UI — screens, shells, dialogs, lists — not a staging area for `packages/`.

Put something in `packages/` only when **both** are true:

1. Two or more apps already need it, **or** it is headless domain logic with a stable API
   (reducers, parsers, ICS, units) — not a screen.
2. It has no app-specific routing, persistence, copy, or product rules.

Do **not** extract because it is a custom element, because it “might be reused later”, or
because the folder is named `web-components`. Prefer a function in `src/services/` (or
`src/local-game/`) over a new workspace.

Existing split:

- `*-core` packages — pure domain (no DOM except `vertical-scroll-core`, which is a scroller
  primitive used by lemmy **and** clipstack).
- `@baseball/web-components` — scorebook/scoreboard widgets only. App shells stay in
  `apps/baseball`. Do not pour other apps’ UI into this package.
- `apps/stock-game/shared/` — contract for that app’s client/server, not a monorepo library.

When starting a feature: implement it in the app. Extract on the second consumer, not the first.

## Agent tools (Python)

Python 3 is the language for tools **you** write to get work done: one-off analysis, fixture
generators, data munging, log scraping, experiments. Prefer the stdlib. Do not add Python as
an app runtime or a workspace dependency.

- Do not reach for Node, bash, or PowerShell for a new helper unless you are extending an
  existing npm/deploy script (e.g. `scripts/*.mjs`, `stamp-sw.mjs`, `write-sw.mjs`, `build.ps1`).
- Scratch scripts stay out of the repo unless the user wants them kept. Kept helpers go in
  root `tools/` as `.py` files, not inside an app.

## Shared conventions (Vite + Lit)

Applies to Vite + Lit apps and Lit packages (`web-components`, `vertical-scroll-core`).
Stock-game documents its own exceptions (decorator-free Lit, React shells, ESLint,
“no comments unless asked”). Pure `*-core` packages follow TypeScript, formatting,
comments, and workflow only — not Lit/CSS/PWA.

### TypeScript

- Strict: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`.
- Client: `target: ES2022`, `moduleResolution: bundler`; `.ts` import specifiers are allowed where `allowImportingTsExtensions` is on.
- Node APIs (`server/`): `module: NodeNext`, `.js` specifiers in compiled output.
- Prefix unused params with `_`. Type-only imports: `import type {X} from '...'`.
- Exact optional fields (`field?: T`); never `string | undefined` where `?` works.
- `as const` when a narrower literal is wanted. `override` on Lit lifecycle methods.
- No `any`. Do not use `!` to silence the compiler (tests may, for fixture access).

### Formatting

- 4-space indent; LF line endings (`.gitattributes`; `*.png` binary). Do not convert to CRLF.
- Single quotes; semicolons; trailing commas in multiline literals and params.
- No space inside braces in value-position objects (`{keyPath: 'id'}`); spaces in type literals (`{ kind: 'all' }`).
- Underscore separators in large numbers (`30_000`). Ternary chains for small conditionals; early-return guards.
- No Prettier/ESLint config on these apps (root `oxlint` plus hand formatting). Stock-game uses ESLint.

### Naming

- camelCase functions/vars, PascalCase types/classes, SCREAMING_SNAKE module constants.
- Kebab-case custom elements, CSS classes, and CSS custom properties. App-specific element prefixes live in that app’s `AGENTS.md`.
- Component events: kebab-case strings; dispatch helpers named `emit*` (`emitClose`).
- Where TanStack Query is used, query-key factories take a `*Key` suffix (`articlesKey`).

### Lit

- `@customElement('prefix-name')`, `@property()` for public API, `@property({attribute: false})` for object/boolean props, `@state() private` for internal state. A plain field is not reactive — anything the template reads must be `@state()` or a property.
- `static override styles = unsafeCSS(styles)` with `import styles from './x.css?inline'`.
- Private fields after decorators, typed explicitly.
- Lifecycle: `willUpdate` for prop changes, `updated` for DOM side effects, `connectedCallback` / `disconnectedCallback` for listeners (always remove on disconnect). Abort in-flight timers and loops on disconnect. Do not close over the app store from a helper that can outlive the element.
- `ref` callbacks must have stable identity (arrow-function fields). Inline arrows re-fire every render and can reset scroll.
- `declare global { interface HTMLElementTagNameMap { 'prefix-name': Name; } }` at the bottom of every component file.
- Events: `new CustomEvent('name', {detail, bubbles: true, composed: true})`.
- Templates: 6-space indent, `.checked=${...}`, `@click=${this.emitX}`, ternaries inside `${...}`.

### CSS

- Plain CSS, kebab-case classes, 4-space indent, no nesting.
- Theme via CSS custom properties on `:root` / `[data-theme='...']`. Components use `var(--...)`, never hardcoded colors.
- Honor `prefers-reduced-motion`.

### Comments

- JSDoc (`/** */`) on non-obvious functions: the *why* and tradeoffs, not the what.
- Comment magic numbers and heuristics. No boilerplate or self-explanatory-line comments.

### Data, purity, safety

- `src/services/` is pure and testable: no DOM or component imports. Domain math that already
  lives in a `*-core` package stays there — do not copy it into the app. New packages follow
  **Shared package vs app module** (second consumer, or headless domain — not the first screen).
- Persistence goes through `src/db/` (or the app’s store module), never raw IndexedDB in components.
- Floating promises: `void` plus `.catch(...)`. IndexedDB writes await `tx.done`. Multi-store writes use one transaction.
- Async work is owned by the UI object that started it (`AbortSignal` + `isConnected`). Headless helpers must not run a loop against the shared game/store. After every `await`, recheck mode and that the element is still connected.
- Untrusted URLs (`href` / `src`) pass through `safeUrl()` (app or `vertical-scroll-core`).
- Do not log tokens, secrets, or raw sample/PII payloads.

### Logging

User-wide JSON-stdout rules apply to **APIs** (`rss-api`, `radio-api`, `fitness-api`,
`user-api`, stock-game server). One line per event; `service` is the compose/process name.

- Honor inbound `X-Request-ID` (or `traceparent`); generate a UUID if missing; echo it
  on the response. Pass that id through poller/scheduler work derived from the request.
- HTTP: one `info` line per request (`method`, `path` without raw query, `status`,
  `duration_ms`). `error` with `err` on 5xx. Startup/listen is `info`.
- `LOG_LEVEL` from the environment. Do not log article bodies, feed XML, Health
  Connect samples, or Authorization cookies.
- Lit apps stay on `console` in the browser. Do not add a telemetry pipeline from the client.

When adding or changing API error paths, emit JSON lines as above instead of
bare `console.error(err)`. A local 20-line helper is enough; do not add pino
or a `packages/log` workspace until a second language needs the same code.

### PWA

- Manifest + icons in `public/`. Paths are base-relative (`%BASE_URL%` / `import.meta.env.BASE_URL`) so subpath deploys work.
- Never edit `dist/sw.js`. rss-reader generates it from `scripts/sw.template.js` via `write-sw.mjs`; most others stamp a cache version with `stamp-sw.mjs`.

## Verification

- Workspace `npm test` then `npm run build` must pass before finishing.
- Smoke tests (`scripts/smoke.ts`, `db-smoke.ts`, …) cover pure logic — extend them when touching those modules.
- API/schema changes that boot Postgres need assertions in `scripts/integration.ts`.
- Library changes need tests in that package (`scripts/smoke.ts` or co-located `*.test.ts`).
- Architecture: use the `ttsc-graph` MCP (`opencode.json`) for callers, callees, and hotspots. Do not grep the graph.
- Secrets: `gitleaks detect` when touching auth, env, or API code.
- Dependencies: `osv-scanner -r .` or `npm audit` on lockfile changes.
- Structural hunt: `ast-grep` (`sg`) for `unsafeHTML`, concatenated SQL, and `eval`.

## Secrets and environment

User-wide rules apply (never commit/push `.env`; examples only in git). This repo:

- Root `.gitignore` already drops `.env` and `.env.*` and keeps `!.env.example`. Do not weaken that.
- **Deploy secrets:** `deploy/.env` copied from `deploy/.env.example` (Postgres). Compose reads it at run; it must never land in an image layer.
- **Stock-game keys:** `apps/stock-game/.env` (or `apps/stock-game/app/.env`) from `apps/stock-game/.env.example`. Not in `shared/`.
- **Calendar OAuth** stays in the browser (localStorage), not in `.env`.
- `APP_BASE_PATH` is public and baked at image build — not a secret, not a reason to commit `.env`.
- Do not log tokens, secrets, or raw sample/PII payloads.

Before commit: staged files must not include `.env` / `.env.*` except `.env.example`.

## Git and monorepo rules

- `main` is the default branch.
- Do not edit root `package.json` workspace globs without checking every app still installs.
- Do not reintroduce per-app `package-lock.json` files; the root lockfile is authoritative.
- Keep `deploy/` at the repo root; compose build contexts assume the repo root.
