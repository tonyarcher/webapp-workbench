# Stock Game

A personal "what-if" / paper-trading simulator. Pick a starting cash amount and a game start date,
then simulate buying and selling stocks **at specific points in time** in two modes:

- **Backdated** — place a trade dated in the past; it fills at that trading day's close.
- **Scheduled** — place a trade for a future timestamp; the server scheduler executes it when that
  time arrives, at the then-current quote.

The app graphs **portfolio performance over time** (cash + holdings valued at each day's close).
Individual stock charts aren't built in — the app links out to Yahoo Finance (TradingView embeds
planned later).

Built with the TanStack suite and web components: **TanStack Start** (React, SPA mode, server
functions as the RPC layer), **TanStack Router** (zod-validated search params), **TanStack Query**,
**TanStack Table** core, and **Lit** custom elements for all UI. Persistence is `node:sqlite`
(no native deps). Price data comes through a swappable provider platform (Yahoo by default).

## Requirements

- Node >= 22.5 (developed on Node 24)

## Getting started

```
npm install
npm run dev
```

Open http://localhost:3000. Set your starting cash and game start date under **Settings** before
placing backdated trades.

## Commands

| Command             | What it does                                       |
| ------------------- | -------------------------------------------------- |
| `npm run dev`       | Start the dev server at http://localhost:3000      |
| `npm run build`     | Production build (`app/dist`)                      |
| `npm run start`     | Run the production server (`node app/dist/server/server.js`) |
| `npm run typecheck` | Strict `tsc` across all workspaces                 |
| `npm run lint`      | ESLint (flat config, `strict-type-checked`)        |
| `npm test`          | Vitest server unit tests (network-free)            |

## Configuration

Copy `.env.example` to `.env` to customize:

| Variable | Default | Description |
| --- | --- | --- |
| `PRICE_PROVIDER` | `yahoo` | `yahoo`, `twelvedata`, or `alphaVantage` |
| `TWELVEDATA_API_KEY` | — | Required if using `twelvedata` |
| `ALPHAVANTAGE_API_KEY` | — | Required if using `alphaVantage` |
| `STOCK_GAME_DB` | `<cwd>/data/stock-game.db` | SQLite database location |
| `QUOTE_TTL_MS` | `900000` | In-memory quote cache TTL |

The default provider (Yahoo Finance, unofficial) needs **no API key** and provides daily + intraday
history. Because all bars are cached in SQLite, each symbol is fetched roughly once — comfortable
within free-tier limits even with the keyed fallbacks (Twelve Data: 800 req/day; Alpha Vantage:
25 req/day).

## Repository layout

```
shared/                  zod schemas + TS types shared client/server (the API contract)
app/
  src/
    routes/              React route shells (thin, data-fed)
    components/          Lit web components (sg-* custom elements)
    lib/                 query client, formatters, custom-event bridge
    server/
      fns/               server functions (createServerFn) — the RPC API
      services/          trading, portfolio, marketData, scheduler
      providers/         PriceProvider platform (Yahoo, TwelveData, AlphaVantage)
      db.ts              node:sqlite schema + repository
      env.ts             env config
      testing/           fake provider + bar test helpers
```

## Adding a price provider

Implement the `PriceProvider` interface in `app/src/server/providers/types.ts`, add the file under
`app/src/server/providers/`, register it in `factory.ts`, and add its env vars to `env.ts`. No other
code changes are needed.

## More

See `AGENTS.md` for the full engineering conventions (strict TypeScript, web-component patterns,
money/time rules, provider guidelines).
