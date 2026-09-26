# AGENTS.md

Paper-trading simulator: a static SPA (`app/`), a shared contract (`shared/`),
and a JSON API (`api/`, see its `AGENTS.md`). Root `AGENTS.md` covers workflow,
git, and monorepo rules.

**This app does not follow the shared Vite + Lit decorator conventions.** Read
"Exceptions" below before writing any component.

## Product

A one-user "what-if" game over fewer than 20 stocks. Set starting cash and a
start date, then:

- **Backdated** trades fill at that trading day's close.
- **Scheduled** trades are executed by the API scheduler at the then-current quote.

The graph is portfolio performance over time (cash plus holdings at each day's
close). Individual stock charts are out of scope — link out to Yahoo Finance.

## Exceptions to the root Lit conventions

- **No Lit decorators.** Use `static properties = { ... }` with plain class
  fields. Decorators broke reactivity and rendered elements blank. This requires
  `useDefineForClassFields: false` in `app/tsconfig.json` — **do not remove it,
  and do not "fix" a blank element by adding decorators.**
- Register elements through `defineElement`, which is guarded and SSR-safe.
- **Side-effect import every element from `app/src/components/index.ts`, imported
  once in `main.ts`.** A type-only import gets tree-shaken and the element never
  registers.
- Views bind `sg-*` events in the lit-html template. `sg-auth-*` window listeners
  live in `sg-app-shell`, not in the views.
- Custom elements must render standalone.
- **Do not add code comments unless asked.**
- No `any`, and no `!` outside tests reaching for fixtures.
- Every route search param is hand-validated.

## Money, time, prices

- Money is integer cents where exact, otherwise floats rounded to two decimal
  places (documented in `shared/`). **Never accumulate ledger floats across
  trades without rounding to cents.**
- Timestamps cross the wire as integer epoch milliseconds.
- Trading-day rules live in the API, not the client. Do not re-derive them in the UI.
- Rate limits from the price provider surface as a user-visible error, never as
  an unhandled crash.
- `shared/` holds the TS types and hand validators that form the API contract.
  Keep app screens out of it.

## Gotchas

- Hash history is what keeps routes working under the gateway subpath
  (`/stock-game/#/trade`). Do not switch to browser history without also changing
  the gateway's prefix strip.
- **A blank `sg-*` element means class-field shadowing.** Restore
  `useDefineForClassFields: false` and the `static properties` map, then cover it
  in `render.test.ts`.
- Dev sign-in needs two local rows the gateway seed does not provide: an
  `oauth_redirect_uris` row for `http://localhost:3000/`, and `user-web` served
  at `/auth/` with a dev proxy.
- Every player signs in through `user-api` (Code + PKCE via `user-client`).
  There is no anonymous mode, and there is one 401 refresh retry per call.
- Charting uses TradingView `lightweight-charts`, which has no house equivalent.
  It stays in `sg-portfolio-chart`.
