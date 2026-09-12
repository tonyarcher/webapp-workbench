# AGENTS.md

Paper-trading simulator. Root `AGENTS.md` covers workflow, git, and monorepo rules.
This app **does not** follow the shared Vite+Lit decorator conventions — see exceptions below.

## Project

One-user “what-if” game for fewer than 20 stocks. Starting cash + start date, then:

- **Backdated**: trade dated in the past; fills at that trading day’s close.
- **Scheduled**: future timestamp; the API scheduler executes it at the then-current quote.

Graphs **portfolio performance over time** (cash + holdings at each day’s close). Individual
stock charts are out of scope — link out to Yahoo Finance (TradingView embeds later).

## Stack

- **Vite static SPA** (React shells + Lit UI). No server runtime: the JSON API is
  `apps/stock-game-api` (Kotlin, Postgres `stock`). Do not add Node `pg` here.
- **TanStack Router** (code-based routes, hash history, zod-validated search params),
  **TanStack Query** v5, **TanStack Table** (`@tanstack/table-core` inside Lit).
- **Lit** UI (forms, tables, chart, search). React is thin route shells only: owns Router/Query
  state, binds Lit via `.prop`, listens for `sg-*` events (`lib/useCustomEvents.ts`).
- **Auth**: `user-api` OAuth2 Code+PKCE via `user-client` (`lib/auth.ts`). Every player
  signs in; API calls carry `Authorization: Bearer` with one 401 refresh retry.
- **Charting**: TradingView `lightweight-charts` in `sg-portfolio-chart`.
- **Lint**: ESLint (flat, strict-type-checked), not oxlint-only.

## Layout

```
shared/                  zod schemas + TS types (the API contract)
app/                     Vite SPA (static build served by nginx)
  src/
    routes/              React shells (thin, data-fed)
    components/          local Lit UI (sg-*); not a monorepo package
    lib/                 query client, API client, auth, formatters, useCustomEvents
```

## Commands

```
npm install        # all workspaces
npm run dev        # Vite on :3000 (proxies /api → :3005, /user-api → :3004)
npm run build      # static dist/
npm run typecheck  # strict tsc across workspaces
npm run lint       # ESLint
npm test           # vitest (component + lib tests, network-free)
```

API: `npm run dev -w stock-game-api` (`:3005`; `:3004` is user-api).
Identity: `npm run dev -w user-web` plus `npm run dev -w user-api` (`:3004`).

Dev sign-in needs two local rows the gateway seed does not cover: an
`oauth_redirect_uris` row for `http://localhost:3000/`, and user-web served at
`/auth/` (run it and proxy `/auth` to its dev port).

## Exceptions vs root Lit conventions

- **No Lit decorators.** Use `static properties = { ... }` + plain class fields. Decorators
  broke reactivity (blank elements). Requires `useDefineForClassFields: false` in
  `app/tsconfig.json` — do not remove it, and do not “fix” blank elements by adding decorators.
- Register via `defineElement` (guarded, SSR-safe). Side-effect import every element from
  `app/src/components/index.ts`, imported once in `main.tsx`. Type-only imports get tree-shaken
  and the element never registers.
- React shells attach listeners with the `useCustomEvents` callback-ref (not `useEffect`).
- Custom elements must render standalone — no React inside Lit.
- **Do not add code comments unless asked.**
- TypeScript: also `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. No `any`. No `!`
  except tests accessing fixtures.
- Every route search param is zod-validated (`validateSearch`).

## Money, time, prices

- Money: integer cents where exact, or rounded 2-dp floats (documented in `shared`). Never
  accumulate ledger floats across trades without rounding to cents.
- Timestamps: epoch milliseconds (integer) over the wire. Trading-day rules live
  in the API, not the client.
- Price data comes from `apps/stock-game-api` (`/quote`, `/bars`, `/search`).
  Rate limits surface as a user error, not a crash.

## Testing

- `app/src/**/*.test.ts` via vitest (component render + lib unit tests, network-free).
- `src/components/render.test.ts` (jsdom): each `sg-*` renders and reacts to property changes.

## Gotchas

- Hash history keeps routes working under the gateway subpath (`/stock-game/#/trade`).
  Do not switch back to browser history without also changing the gateway strip.
- Blank `sg-*`: class-field shadowing. Restore `useDefineForClassFields: false` / `static properties`, cover in `render.test.ts`.
