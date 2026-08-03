# AGENTS.md

Guidance for AI agents and humans working in this repository.

## Project overview

A personal **stock game** ("what-if" / paper-trading simulator) for one user owning fewer than 20
stocks. You pick a starting cash amount and a game start date, then simulate buying and selling
stocks **at specific points in time** in two modes:

- **Backdated**: place a trade dated in the past; it fills at that trading day's close.
- **Scheduled**: place a trade for a future timestamp; the server scheduler executes it when that
  time arrives, at the then-current quote.

The app graphs **portfolio performance over time** (cash + holdings valued at each day's close).
Individual stock charts are deliberately *not* built in — we link out to Yahoo Finance now and will
add TradingView embeds later.

## Stack

TanStack for everything, with web components as the UI surface:

- **TanStack Start** (React, **SPA mode** — no SSR). Server functions (`createServerFn`) replace the
  API layer; they run in the same dev server via RPC.
- **TanStack Router** (file-based, zod-validated search params), **TanStack Query** v5,
  **TanStack Table** (`@tanstack/table-core`, framework-agnostic inside Lit).
- **Web components**: [Lit](https://lit.dev). All UI — forms, tables, chart, search — is Lit custom
  elements. React exists only as thin route shells: it owns Router/Query state, feeds data into Lit
  elements via `.prop` bindings, and listens for `sg-*` custom events (ref-bridge in
  `lib/useCustomEvents.ts`).
- **Persistence / data**: `node:sqlite` (`DatabaseSync`) — **no native deps**. The server layer owns
  price-data access (proxies to avoid CORS, centralizes caching + rate limiting).
- **Charting**: TradingView `lightweight-charts` (Apache-2.0), wrapped in `sg-portfolio-chart`.

## Subagent delegation (the primary agent MUST delegate)

The primary agent's model is reserved for orchestrating; **bulk dev work runs on cheaper subagent
models configured globally in `opencode.json`** (`general`/`explore` → `opencode-go/mimo-v2.5`,
`review` → `opencode-go/gpt-5.6-luna`). Do not do large self-contained work inline — hand it off.

- **`explore`** (read-only, cheap): all codebase research — locating files, reading implementations,
  grepping, understanding existing patterns before you write. Never search/read the repo yourself for
  a large task; dispatch `explore`.
- **`general`** (cheap, can edit): any self-contained implementation chunk — a new component, a
  server fn, a service, a test file, a refactor, config wiring, a fix with a clear repro. Write a
  precise spec (exact file paths, function signatures, schema shapes, conventions to follow, the
  verification command to run) and require it to report what it changed and the verification result.
  Review its diff (read the files / `git diff`) before accepting; do not blindly trust a cheap model.
- **`review`** (runs automatically after code changes, before commit): always dispatch it on your
  changes and fix or consciously defer its findings. On this repo the reviewer is a stronger model —
  use it as the quality gate for cheap-subagent output.
- Keep delegation **vertical**: the subagent does a whole coherent task, not one micro-step.
  Batch related edits into a single `general` call with a full spec. Give it every convention it
  needs (see below) so it does not have to ask.

## Repository layout

```
shared/                  zod schemas + TS types shared client/server (the API contract)
app/                     the TanStack Start app (client + server functions)
  src/
    routes/              React shells (file-based routing; thin, data-fed)
    components/          Lit web components (sg-* custom elements)
    lib/                 query client, formatters, useCustomEvents bridge
    server/
      fns/               server functions (createServerFn) — the RPC API
      services/          trading, portfolio, marketData, scheduler
      providers/         PriceProvider platform (modular)
      db.ts              node:sqlite schema + repo
      env.ts             env config (loads app/.env or root .env)
      testing/           fakeProvider + dayBar test helpers
```

## Commands

```
npm install        # install all workspaces
npm run dev        # start dev server at http://localhost:3000
npm run build      # production build (dist/)
npm run start      # run the production server
npm run typecheck  # strict tsc across all workspaces
npm run lint       # ESLint (flat config, strict-type-checked)
npm test           # vitest (server unit tests, network-free)
```

There is no client/server port split and no Vite proxy — Start serves the SPA and the RPC
endpoints (`/_server/…`) from the same dev server.

## Conventions (non-negotiable)

- **TypeScript strict everywhere.** `noEmit` + `strict`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`. No `any`. Never use `!` to silence the compiler (tests may use it
  for fixture access).
- **Type-only imports** use `import type`. Runtime value imports are separated.
- **Every route search param is zod-validated** (`validateSearch`) — no loose `string | undefined`.
- **Every server-function input is zod-validated** in its `.validator()`.
- **Do not add code comments** unless asked.
- **Money**: store integer cents where exact, or rounded 2-dp floats (documented in `shared`); never
  use floats for ledger accumulation across many trades without rounding to cents.
- **Time**: timestamps are stored as epoch milliseconds (integer) in the DB and over the wire.
  "Trading day" rules live in the trading service, not the client.

## Price provider platform (modular by design)

All price access goes through the `PriceProvider` interface in `app/src/server/providers/types.ts`:

```ts
interface PriceProvider {
  readonly id: string;
  getQuote(symbol: string): Promise<Quote>;
  getBars(symbol: string, interval: Interval, from: number, to: number): Promise<Bar[]>;
  search(query: string): Promise<SymbolSearchResult[]>;
}
```

- Implementations: `yahoo.ts` (default, no API key), `twelvedata.ts` and `alphaVantage.ts`
  (key-based fallbacks, ready to activate).
- Providers are wrapped in a **caching decorator** (`caching.ts`) that persists daily/intraday bars
  to the `price_cache` table and short-TTLs quotes in memory.
- Selection is via `PRICE_PROVIDER` env var in `factory.ts` (see `.env.example`).

**To add a provider**: create `app/src/server/providers/<name>.ts` implementing the interface,
register it in `factory.ts`, add its env vars to `env.ts`. No other code changes.

### Data-access reality check

| Provider | Free tier | Notes |
| --- | --- | --- |
| Yahoo (unofficial) | no key, ~2k req/hr, occasional 429s | default; daily + intraday history |
| Twelve Data | 8 req/min, 800/day | key required; official |
| Alpha Vantage | 25 req/day | key required; only viable with caching |

Because all bars are cached forever in SQLite, each symbol is fetched ~once. Keep the fetch pattern:
**fetch-on-miss, cache-then-serve**. Never hammer the provider per-request. Wrap provider errors so
the app degrades gracefully (rate limits surface as a clear user error, not a crash).

## Web component pattern

- Lit elements live in `app/src/components/`. They register themselves via `defineElement`
  (guarded, so imports are SSR-safe even though the app runs in SPA mode).
- **Reactive properties use Lit's decorator-free API**: `static properties = { ... }` + plain class
  fields — NOT `@property` decorators. Decorators are banned because bundler emit broke Lit
  reactivity (blank elements). This requires `useDefineForClassFields: false` in `app/tsconfig.json`
  (class fields compile to assignments that go through Lit's accessors; do not remove it).
- Public data flows in via **properties** (`.results`, `.holdings`, `.quote`, etc.), never via
  direct DOM.
- Actions flow out via **custom events** (`sg-trade-submit`, `sg-symbol-select`, `sg-navigate`).
- React route shells own query hooks/mutations and translate events into mutations/route
  navigation (event listeners attached via the `useCustomEvents` callback-ref bridge — attach in
  the ref callback, not in a `useEffect`).
- Custom elements must render standalone (no React inside Lit) and must be usable with no JS
  framework — that's the point of web components.
- Every element is imported (side-effect) from `app/src/components/index.ts`, which is imported
  once in `__root.tsx`. Register components there, never rely on incidental imports (a type-only
  import gets tree-shaken and the element never registers).

## Testing

- `app/src/**/*.test.ts` run by vitest (`npm test`). Server tests (`src/server/**`) run in node and
  must stay network-free (fixtures/inline JSON, `testing/fakeProvider.ts`). Component tests
  (`src/components/render.test.ts`) run in jsdom and assert each `sg-*` element renders and reacts
  to property changes — the regression guard for Lit reactivity.
- Priority server tests: provider JSON parsing and the portfolio value-series replay (cash +
  holdings math).
- Run `npm test` before considering a change done.

## Gotchas

- `app/src/routeTree.gen.ts` is generated by the TanStack Start plugin on `dev`/`build` and is
  committed. If routes change, regenerate before typechecking.
- `node:sqlite` prints an `ExperimentalWarning` on Node 24 — expected; it is functional. Do not add
  better-sqlite3.
- Provider responses vary (Yahoo's JSON shape is quirky) — keep parsing isolated to the provider
  file and unit-test it. Yahoo daily bars are timestamped ~14:30 UTC, not midnight.
- The app runs in TanStack Start **SPA mode** (`spa: { enabled: true }` in `vite.config.ts`) so Lit
  components and client-only data fetching behave cleanly; server functions still run server-side.
- If a `sg-*` element renders blank, the usual culprit is Lit class-field shadowing — do not "fix"
  it by adding decorators back; re-add `useDefineForClassFields: false` or check the `static
  properties` wiring, and cover it in `render.test.ts`.
