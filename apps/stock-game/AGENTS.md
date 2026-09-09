# AGENTS.md

Paper-trading simulator. Root `AGENTS.md` covers workflow, git, and monorepo rules.
This app **does not** follow the shared Vite+Lit decorator conventions — see exceptions below.

## Project

One-user “what-if” game for fewer than 20 stocks. Starting cash + start date, then:

- **Backdated**: trade dated in the past; fills at that trading day’s close.
- **Scheduled**: future timestamp; the server scheduler executes it at the then-current quote.

Graphs **portfolio performance over time** (cash + holdings at each day’s close). Individual
stock charts are out of scope — link out to Yahoo Finance (TradingView embeds later).

## Stack

- **TanStack Start** (React, SPA mode — no SSR). Server functions (`createServerFn`) are the API.
- **TanStack Router** (file-based, zod-validated search params), **TanStack Query** v5,
  **TanStack Table** (`@tanstack/table-core` inside Lit).
- **Lit** UI (forms, tables, chart, search). React is thin route shells only: owns Router/Query
  state, binds Lit via `.prop`, listens for `sg-*` events (`lib/useCustomEvents.ts`).
- **Persistence**: `node:sqlite` (`DatabaseSync`) — no native deps. Server owns price access
  (CORS proxy, cache, rate limits).
- **Charting**: TradingView `lightweight-charts` in `sg-portfolio-chart`.
- **Lint**: ESLint (flat, strict-type-checked), not oxlint-only.

## Layout

```
shared/                  zod schemas + TS types (the API contract)
app/                     TanStack Start app (client + server functions)
  src/
    routes/              React shells (thin, data-fed)
    components/          local Lit UI (sg-*); not a monorepo package
    lib/                 query client, formatters, useCustomEvents
    server/
      fns/               createServerFn RPC
      services/          trading, portfolio, marketData, scheduler
      providers/         PriceProvider platform
      db.ts              node:sqlite schema + repo
      env.ts             env (app/.env or root .env)
      testing/           fakeProvider + dayBar helpers
```

## Commands

```
npm install        # all workspaces
npm run dev        # http://localhost:3000 (SPA + /_server RPC, no Vite proxy)
npm run build      # production (dist/)
npm run start      # production server
npm run typecheck  # strict tsc across workspaces
npm run lint       # ESLint
npm test           # vitest (server unit tests, network-free)
```

## Exceptions vs root Lit conventions

- **No Lit decorators.** Use `static properties = { ... }` + plain class fields. Decorators
  broke reactivity (blank elements). Requires `useDefineForClassFields: false` in
  `app/tsconfig.json` — do not remove it, and do not “fix” blank elements by adding decorators.
- Register via `defineElement` (guarded, SSR-safe). Side-effect import every element from
  `app/src/components/index.ts`, imported once in `__root.tsx`. Type-only imports get tree-shaken
  and the element never registers.
- React shells attach listeners with the `useCustomEvents` callback-ref (not `useEffect`).
- Custom elements must render standalone — no React inside Lit.
- **Do not add code comments unless asked.**
- TypeScript: also `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. No `any`. No `!`
  except tests accessing fixtures.
- Every route search param is zod-validated (`validateSearch`). Every server-fn input is
  zod-validated in `.validator()`.

## Money, time, prices

- Money: integer cents where exact, or rounded 2-dp floats (documented in `shared`). Never
  accumulate ledger floats across trades without rounding to cents.
- Timestamps: epoch milliseconds (integer) in the DB and over the wire. Trading-day rules live
  in the trading service, not the client.
- All price access goes through `PriceProvider` in `app/src/server/providers/types.ts`
  (`getQuote` / `getBars` / `search`). Implementations: `yahoo.ts` (default, no key),
  `twelvedata.ts`, `alphaVantage.ts`. Caching decorator persists bars to `price_cache` and
  short-TTLs quotes in memory. Select with `PRICE_PROVIDER` (see `.env.example`).
- Add a provider: implement the interface, register in `factory.ts`, add env vars in `env.ts`.
- Fetch-on-miss, cache-then-serve. Never hammer the provider per-request. Rate limits must
  surface as a user error, not a crash.

| Provider | Free tier | Notes |
| --- | --- | --- |
| Yahoo (unofficial) | no key, ~2k req/hr, occasional 429s | default; daily + intraday |
| Twelve Data | 8 req/min, 800/day | key required |
| Alpha Vantage | 25 req/day | key required; only viable with caching |

## Testing

- `app/src/**/*.test.ts` via vitest. Server tests stay network-free (`testing/fakeProvider.ts`).
- `src/components/render.test.ts` (jsdom): each `sg-*` renders and reacts to property changes.
- Priority: provider JSON parsing and portfolio value-series replay.

## Gotchas

- `app/src/routeTree.gen.ts` is generated and committed. Regenerate after route changes before typecheck.
- `node:sqlite` `ExperimentalWarning` on Node 24 is expected. Do not add better-sqlite3.
- Isolate Yahoo JSON quirks in the provider file and unit-test them. Daily bars are ~14:30 UTC, not midnight.
- SPA mode (`spa: { enabled: true }` in `vite.config.ts`) is required for Lit + client fetching; server functions still run server-side.
- Blank `sg-*`: class-field shadowing. Restore `useDefineForClassFields: false` / `static properties`, cover in `render.test.ts`.
