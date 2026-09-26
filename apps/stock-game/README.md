# Stock Game

A personal "what-if" / paper-trading simulator. Pick a starting cash amount and a game start date,
then simulate buying and selling stocks **at specific points in time** in two modes:

- **Backdated** — place a trade dated in the past; it fills at that trading day's close.
- **Scheduled** — place a trade for a future timestamp; the server scheduler executes it when that
  time arrives, at the then-current quote.

The app graphs **portfolio performance over time** (cash + holdings valued at each day's close).
Individual stock charts aren't built in — the app links out to Yahoo Finance (TradingView embeds
planned later).

Built with web components: **Vite** static SPA, hash router plus **TanStack QueryClient**,
hand-rolled tables, and **Lit** custom elements for all UI.
Persistence is Postgres (`stock` database) behind `apps/stock-game/api`
(Kotlin); price data comes from that API.

## Requirements

Node with a `vite`-compatible version. The repo pins no Node version, so check
`vite`'s engine range rather than trusting a number here.

## Getting started

```
npm install
npm run dev
```

Open http://localhost:3000. Set your starting cash and game start date under
**Settings** before placing backdated trades.

Sign-in needs the API alongside it: `npm run dev -w stock-game-api` and
`npm run dev -w user-api`. Dev sign-in also needs an `oauth_redirect_uris` row
for `http://localhost:3000/`, which the gateway seed does not provide.

The app itself needs no env file. Price providers are configured server-side on
the API.

## Conventions

`AGENTS.md` has the engineering rules. The one that surprises people: this app
has **no Lit decorators** and needs `useDefineForClassFields: false`. Read it
before writing a component.
