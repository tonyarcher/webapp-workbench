# webapp-workbench

A sandbox of small webapp ideas collected over the years — personal tools and a
portfolio. Every app is an SPA, focused on one thing, and served behind the
same reverse-proxy gateway.

## Apps

| Path | App | Stack | Focus |
|---|---|---|---|
| `apps/baseball/` | Baseball tracker | Vite + Lit + TanStack core | Scorekeeping, client-side only |
| `apps/rss-reader/` | RSS reader | Vite + Lit + TanStack core | Feed reading, PWA, hash routing |
| `apps/stock-game/` | Stock game | TanStack Start (SPA) + React + Lit | Paper trading, SQLite server layer |
| `apps/lemmy-vertical-scroll/` | Lemmy scroller | Vite + Lit + TanStack core | Vertical feed scrolling |
| `apps/tiktok-scroll/` | Clipstack | Vite + Lit + vertical-scroll-core | Import a short-video link list and scroll it |

## Packages

| Path | Package | Purpose |
|---|---|---|
| `packages/web-components/` | `@baseball/web-components` | Baseball UI component library |
| `packages/vertical-scroll-core/` | `vertical-scroll-core` | Generic vertical-scroller components |

## Getting started

```sh
npm install        # installs all workspaces (builds library dists)
npm run build      # builds every workspace
npm test           # runs every workspace's tests
```

One app at a time:

```sh
npm run dev:baseball
npm run dev:rss-reader
npm run dev:stock-game
npm run dev:lemmy
npm run dev:tiktok
```

Each app directory carries its own `AGENTS.md` with detailed conventions.

## Deployment

`deploy/` holds the nginx reverse-proxy gateway stack: hello world at `/` and
each app under its own path (`/baseball/`, `/rss-reader/`, `/stock-game/`,
`/lemmy-vertical-scroll/`, `/tiktok-scroll/`). From the repo root, `./build.sh` / `.\build.ps1`
builds workspaces locally and `./deploy.sh` / `.\deploy.ps1` brings the
compose stack up (auto-selects a local Docker engine or an SSH-tunneled
remote daemon). Pass an app name to do one service: `./deploy.sh rss`.
See `deploy/README.md` for details.
