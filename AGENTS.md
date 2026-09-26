# AGENTS.md

Instructions for AI agents working in this monorepo.
Read the workspace `AGENTS.md` before touching that app or package.

## How to maintain this file

This file holds **rules, not inventories**. Apply one test to every sentence: if it
became false, would a build, test, typecheck, or lint fail? If yes, it is a rule and the
repo polices it. If no, it is a copy of something the code already records, and it will
rot silently.

So do not add lists of apps, packages, files, scripts, endpoints, exports, or services
here, and do not restate a count. Put those where they are derived — `apps.json`,
`package.json`, a Gradle or Vite config, or the filesystem — and point at it. When a fact
is only knowable by reading the code, say where to read it instead of copying it.

Two things are exempt, because they are decisions rather than listings: naming a
convention that differs from the norm (stock-game's decorator-free Lit), and stating a
prohibition with its reason. Named gotchas and "do not do X because Y" warnings are the
reason this file exists. Keep them.

Prefer a rule that generalizes over an example that needs updating.

## Project

npm-workspaces monorepo of small TypeScript web apps plus Kotlin APIs.
Most apps are Vite + Lit custom elements (no UI framework). Stock-game is the
exception: plain Vite static SPA with decorator-free Lit.
Shared libraries live in `packages/*`. JVM APIs are Gradle / Kotlin, not Node.

**Services:** `user-api` is a standalone identity provider (OAuth/OIDC, JWKS).
Other apps are clients. Each webapp that needs Postgres has **its own API**
and **its own database** so that API can be cloned into another repo later.
Do not put fitness/rss/radio tables in `user-api`. Do not share Postgres
across APIs. New server data is Spring Data JPA + Flyway, not Node `pg`
and not hand-rolled JDBC. OAuth client ACL (`client_id`, redirect URIs) is
database rows, not a hardcoded app list.

## Layout

Apps live in `apps/<app>/`, shared libraries in `packages/<name>/`, and the Docker
Compose reverse-proxy gateway in `deploy/`. **Do not read an app inventory from this
file.** The app list, npm workspaces, compose services, aliases, `basePath`, build
scripts, boot jar paths, the compose file, and the Docker-only service aliases all live
in `apps.json` at the repo root; `settings.gradle.kts` and `build.gradle.kts` both derive
from it, so adding an app means editing `apps.json`.

Adding an app also means adding its routes to `deploy/nginx/default.conf.template`, which
is hand-authored and renders to `deploy/nginx/default.conf` on every deploy. Only some
apps carry a `basePath` in `apps.json`; the gateway's location blocks are not derived
from it, so the template is where a new subpath gets wired.

Do not assume a uniform app shape. Some apps put the UI at `apps/<app>/src`, others in
`apps/<app>/app/`, and an app with server data adds `apps/<app>/api/` for the Kotlin API.
Read the app's own `AGENTS.md` for its shape. App-specific facts belong there, not here.

Library `prepare` scripts build `dist/` on install. After changing a package, rebuild it
(`npm run build -w <name>`) or reinstall before consumers pick up the change.

## Commands (run from the repo root)

| Task                          | Command                                                                                                                                                                                                                            |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Install all workspaces        | `npm install`                                                                                                                                                                                                                      |
| Build all                     | `npm run build` (delegates `--workspaces --if-present`)                                                                                                                                                                            |
| Test all                      | `npm test`                                                                                                                                                                                                                         |
| Typecheck all                 | `npm run typecheck`                                                                                                                                                                                                                |
| Lint all                      | `npm run lint`                                                                                                                                                                                                                     |
| Dev server (one app)          | `npm run dev:<app>` for any app with a UI or an API (for example `dev:baseball`, `dev:rss-reader`, `dev:rss-api`). The full set is the `dev:*` scripts in the root `package.json`.                                                 |
| Build (entry point)           | `python build.py [app...]` (or `python3`); calls `./gradlew buildAll`                                                                                                                                                              |
| Build everything, one command | `./gradlew buildAll` (root; JS workspaces + all Kotlin APIs). `./gradlew buildJvm` = APIs only, `./gradlew buildNode` = JS only, `./gradlew checkAll` = API tests/detekt/Jacoco. Add `-Papps=rss` (or `apps/rss`) to build one app |
| Deploy compose stack          | `python deploy.py [options] [app...]` (or `python3`); calls `./gradlew deploy`, which builds, renders the gateway, mints certs, then runs compose. Tab completion: `source scripts/complete-deploy.bash`.                          |
| Format everything             | `npm run format` (prettier --write). Check only: `npm run format:check`.                                                                                                                                                           |
| Verify format + lint          | `python verify.py` (check mode) or `python verify.py --fix` (apply the formatters). It owns the tool list.                                                                                                                         |

Per-app commands run inside the app directory (e.g. `cd apps/baseball && npm test`).

`./gradlew buildAll` builds both sides on the host and `./gradlew deploy` does the deploy.
`-Papps` limits either half to one app. The wrapper is local-only (`gradle wrapper`
generates it); the entry points fall back to `gradle` on PATH when it is absent.

An API-only `-Papps` (`rss-api`) runs no `npm install` and no JS build. `buildNode` reaches
`npmInstall` only through a real per-workspace task, so a selection with no JS workspace
never pays for the package `prepare` builds. `gradle_test.py` asserts both directions and
skips when Gradle is absent.

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
6. `AGENTS.md` files may be
   updated to stay in sync with the code — but never to dodge the work. Do not
   weaken a documented rule or floor instead of meeting it. Change the code
   first, then the docs.
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
  existing npm/build script (e.g. `scripts/*.mjs`, `stamp-sw.mjs`, `write-sw.mjs`, `build.py`).
- Scratch scripts stay out of the repo unless the user wants them kept. Kept helpers go in
  root `tools/` as `.py` files, not inside an app.

## Shared conventions (Vite + Lit)

Applies to Vite + Lit apps and Lit packages (`web-components`, `vertical-scroll-core`).
Stock-game documents its own exceptions (decorator-free Lit,
“no comments unless asked”). Pure `*-core` packages follow TypeScript, formatting,
comments, and workflow only — not Lit/CSS/PWA.

### TypeScript

- Strict plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`,
  `noPropertyAccessFromIndexSignature`, `noImplicitReturns`, `useUnknownInCatchVariables`,
  `erasableSyntaxOnly`, `noUncheckedSideEffectImports`, `forceConsistentCasingInFileNames`,
  `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`.
  Keep every workspace tsconfig on this set (`stock-game` inherits it from `tsconfig.base.json`).
- TypeScript 7 via exact `7.0.2` pins in the workspaces; the root `~7.0.2` range
  currently dedupes to that same copy. Root `ttsc` and `vite-plugin-dts` are
  verified against TS 7 (`npx ttsc --version`, full `npm run build`).
- Erasable-only syntax: no enums, namespaces, or parameter properties. Declare fields
  explicitly and assign them in the constructor.
- Client: `target: ES2022`, `moduleResolution: bundler`; `.ts` import specifiers are allowed where `allowImportingTsExtensions` is on.
- Node APIs (`server/`): `module: NodeNext`, `.js` specifiers in compiled output.
- Prefix unused params with `_`. Type-only imports: `import type {X} from '...'`.
- Exact optional fields (`field?: T`); never `string | undefined` where `?` works.
- `as const` when a narrower literal is wanted. `override` on Lit lifecycle methods.
- No `any`. Do not use `!` to silence the compiler (tests may, for fixture access).

### Formatting

- Layout is config, not prose: root `.prettierrc.json`, `.editorconfig`, `.gitattributes`. Run `npm run format`. Do not restate those settings here.
- `oxlint` owns correctness.
- Underscore separators in large numbers (`30_000`). Ternary chains for small conditionals; early-return guards.

### Naming

- camelCase functions/vars, PascalCase types/classes, SCREAMING_SNAKE module constants.
- Kebab-case custom elements, CSS classes, and CSS custom properties. App-specific element prefixes live in that app’s `AGENTS.md`.
- Component events: kebab-case strings; dispatch helpers named `emit*` (`emitClose`).
- Where TanStack Query is used, query-key factories take a `*Key` suffix (`articlesKey`).

### Lit

- `@customElement('prefix-name')`, `@property()` for public API, `@property({attribute: false})` for object/boolean props, `@state() private` for internal state. Two apps deliberately do not use the decorator: stock-game is decorator-free throughout, and baseball registers with `customElements.define`. Check the app's own `AGENTS.md` before adding one. A plain field is not reactive - anything the template reads must be `@state()` or a property. Drop `private` (keep `@state()` on reactive fields) only for members shared with sibling modules through a host interface - Lit reactivity requires the declarations to stay on the element, and `noUnusedLocals` flags class-unread privates.
- `static override styles = unsafeCSS(styles)` with `import styles from './x.css?inline'`.
- Private fields after decorators, typed explicitly.
- Lifecycle: `willUpdate` for prop changes, `updated` for DOM side effects, `connectedCallback` / `disconnectedCallback` for listeners (always remove on disconnect). Abort in-flight timers and loops on disconnect. Do not close over the app store from a helper that can outlive the element.
- `ref` callbacks must have stable identity (arrow-function fields). Inline arrows re-fire every render and can reset scroll.
- `declare global { interface HTMLElementTagNameMap { 'prefix-name': Name; } }` at the bottom of every component file.
- Events: `new CustomEvent('name', {detail, bubbles: true, composed: true})`.
- Templates: 6-space indent, `.checked=${...}`, `@click=${this.emitX}`, ternaries inside `${...}`.

### CSS

- Plain CSS, kebab-case classes, no nesting.
- Theme via CSS custom properties on `:root` / `[data-theme='...']`. Components use `var(--...)`, never hardcoded colors.
- Honor `prefers-reduced-motion`.

### Comments

- JSDoc (`/** */`) on non-obvious functions: the _why_ and tradeoffs, not the what.
- Comment magic numbers and heuristics. No boilerplate or self-explanatory-line comments.

### Data, purity, safety

- `src/services/` is pure and testable: no DOM or component imports. Domain math that already
  lives in a `*-core` package stays there — do not copy it into the app. New packages follow
  **Shared package vs app module** (second consumer, or headless domain — not the first screen).
- Persistence goes through `src/db/` (or the app’s store module), never raw IndexedDB in components.
- **Postgres is Kotlin JPA (or Python), not TypeScript.** One database per service, and
  the `DATABASE_URL` each API receives at run time is the record of which database it
  owns — read it there, since a database name need not match its service name. New tables
  are Spring Data `JpaRepository` + Flyway. Do not grow Node `pg`. Do not merge product
  schemas into `user-api`. IndexedDB in the browser is fine.
- Floating promises: `void` plus `.catch(...)`. IndexedDB writes await `tx.done`. Multi-store writes use one transaction.
- Async work is owned by the UI object that started it (`AbortSignal` + `isConnected`). Headless helpers must not run a loop against the shared game/store. After every `await`, recheck mode and that the element is still connected.
- Untrusted URLs (`href` / `src`) pass through `safeUrl()` (app or `vertical-scroll-core`).
- Do not log tokens, secrets, or raw sample/PII payloads.

### Logging

User-wide JSON-stdout rules apply to every API service — that is, every compose service
that serves JSON. One line per event; `service` is the compose/process name.

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

## Kotlin

- `allWarningsAsErrors` on every API module. Fix the warning instead of suppressing it.
- Explicit types on `const val` declarations. No `explicitApi()` on internal services.
- `-Xjsr305=strict` plus progressive mode on every API module.
- Detekt floors live in each API's `detekt.yml`. Split rather than suppress.
- Coverage floor is **90% lines and 90% branches** on every API module.
  `check` enforces both (`jacocoTestCoverageVerification` for lines,
  `jacocoBranchCoverageVerification` for branches, each with the same
  class filters); `test:coverage` renders the HTML/XML report without the gate.
  Each API declares its own `jacocoExcludes` in its `build.gradle.kts`, and the sets
  differ, so read that list rather than assuming one. They cover the code that needs a
  database or a booted server and is not unit-coverable: the JPA `persist` and `db`
  layers, the data-source and store config, the JPA store implementations, and the
  `main()` entry point. Slice tests cover those paths through fakes.

## API versioning

First-party APIs are versioned with a request header, not URL prefixes.
Every data route requires `X-Api-Version: 1`. `/healthz`, `/readyz`, and
`/oauth/*` stay unversioned: probes, browser navigation, and stock JWT
fetchers cannot send custom headers.

- Kotlin: `headers = ["X-Api-Version=1"]` on each mapping. Once past security,
  a missing or wrong version answers 404, like an unknown route.
- TypeScript clients send the header on every API fetch. Centralize it in the
  app's fetch helper (`services/api.ts`, `lib/api.ts`).
- Kotlin APIs declare `headers = ["X-Api-Version=1"]` on each data mapping.
- Breaking version changes update consumer and API together. No compat shims.

## Verification

- Workspace `npm test` then `npm run build` must pass before finishing.
- `python verify.py` passes. It owns the full tool list; `--fix` applies the formatters.
  Tools come from the `ops-scripts` installers.
- A doc-rot guard runs with the script tests. It checks the claim shapes that rot most
  often here — a backticked path, an `npm run` script, a Gradle task, and an app or
  package count — against whatever derives each one, so a stale claim fails instead of
  misleading. Git decides which paths are generated, so build output and a clean clone
  both pass. Bare filenames, directories, and extensionless files are not checked. When
  it fails on a claim you just wrote, the claim is wrong: fix the doc or the code, but
  never widen the check to make it pass.
- Coverage floor is **90% lines/branches/functions/statements** on every measured
  workspace, and each one owns its own gate: Jacoco line and branch verification in a
  Kotlin API's `build.gradle.kts`, coverage thresholds in that workspace's Vite or vitest
  config, and `wtr` thresholds in `packages/web-components/web-test-runner.config.js`.
  Read the gate where it is configured rather than trusting a list here. Several
  workspaces sit below the floor today
  (untested entry points, Lit shells, branch tails) — raise uncovered areas to
  meet it; exclude only harness-mismatched entry files with a comment saying why.
  Kotlin `npm test` (`gradle check`) enforces its gate. JS `npm test` runs unit
  tests without coverage; run `test:coverage` in the JS workspace you touched
  when changing covered logic.
- Smoke tests (`scripts/smoke.ts`, `db-smoke.ts`, …) cover pure logic — extend them when touching those modules.
- API/schema changes that boot Postgres need assertions in that service's own JUnit and
  Flyway tests. Do not add a Node integration script for new server data: the Node
  servers were replaced by Kotlin APIs, and each API's database is exercised through
  that service's own tests.
- Library changes need tests in that package (`scripts/smoke.ts` or co-located `*.test.ts`).
- Secrets: `gitleaks detect` when touching auth, env, or API code.
- Dependencies: `osv-scanner -r .` or `npm audit` on lockfile changes.
- Structural hunt: `ast-grep` (`sg`) for `unsafeHTML`, concatenated SQL, and `eval`.

## Secrets and environment

User-wide rules apply (never commit/push `.env`; examples only in git). This repo:

- Root `.gitignore` already drops `.env` and `.env.*` and keeps `!.env.example`. Do not weaken that.
- **Deploy secrets:** `deploy/.env` copied from `deploy/.env.example` (Postgres). Compose reads it at run; it must never land in an image layer.
- **Stock-game app** needs no env file; provider config lives on `stock-game-api`.
- **Calendar OAuth** stays in the browser (localStorage), not in `.env`.
- `APP_BASE_PATH` is public and baked at **host** Vite build (`gradle buildAll`) — not a secret, not a reason to commit `.env`.
- Do not log tokens, secrets, or raw sample/PII payloads.

Before commit: staged files must not include `.env` / `.env.*` except `.env.example`.

## Git and monorepo rules

- `main` is the default branch.
- Do not edit root `package.json` workspace globs without checking every app still installs.
- Do not reintroduce per-app `package-lock.json` files; the root lockfile is authoritative.
- Keep `deploy/` at the repo root; compose build contexts assume the repo root.
