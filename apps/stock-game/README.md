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
Persistence is Postgres (`stock` database) behind `apps/stock-game-api`
(Kotlin); price data comes from that API.

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
| `npm run dev`       | Vite dev server at http://localhost:3000           |
| `npm run build`     | Static production build (`app/dist`)               |
| `npm run typecheck` | Strict `tsc` across all workspaces                 |
| `npm run lint`      | `oxlint` (size, complexity, type-aware rules)      |
| `npm test`          | Vitest component + lib unit tests (network-free)   |

## Configuration

The app itself needs no env files. Run the API alongside it:
`npm run dev -w stock-game-api` (`:3005`), plus `npm run dev -w user-api`
(`:3004`) for sign-in. Price providers are configured server-side on the API.

## Repository layout

```
shared/                  TS types plus hand validators shared client/server (the API contract)
app/
  src/
    router.ts            hash router (View union, path parse/emit)
    main.ts              boot (auth callback, mounts `sg-app-shell`)
    components/          Lit web components (sg-* custom elements)
    lib/                 query client, API client, auth, formatters
```

Sign-in is OAuth2 Code+PKCE against `user-api` (same flow as the RSS reader);
API calls carry the Bearer token.

## More

See `AGENTS.md` for the full engineering conventions (strict TypeScript, web-component patterns,
money/time rules).
