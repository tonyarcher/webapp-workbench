# rss-reader

A client-side RSS reader. Subscriptions, folders, articles, and read state live in IndexedDB; feeds are fetched through a public CORS proxy and parsed in the browser.

## Stack

- [Lit](https://lit.dev) web components in `src/web-components/`
- [TanStack Query](https://tanstack.com/query) (`@tanstack/query-core`) as the data layer glue
- [TanStack Virtual](https://tanstack.com/virtual) (`@tanstack/virtual-core`) for the article list
- [TanStack History](https://tanstack.com/router) for hash-based routing
- [idb](https://github.com/jakearchibald/idb) for IndexedDB

## Getting started

```bash
npm install
npm run dev        # start Vite dev server
npm run test       # parser + IndexedDB smoke tests
npm run build      # typecheck + production build
```

## Features

- Left sidebar: folders with collapsible sources and unread counts
- Right pane: headline list sorted by hot/newest/oldest, infinite scroll, unread-only filter, mark all as read, star
- Click a headline to read the article inline
- Settings (gear icon): theme (light / dark grey / lights-out OLED), add feed, OPML import/export
- Daily Brief (sidebar): summarizes today's articles with Chrome's built-in Gemini Nano
- Per-article "Summarize" button using the same on-device AI
- Local popularity ranking: syndication across your feeds + feed-reported comment counts feed a Reddit-style hot sort — no external APIs

## AI summaries

The Daily Brief and per-article summaries use Chrome's built-in Gemini Nano (the Prompt/Model
API — `window.model` / `window.ai`). No network calls are made; the model runs on-device.
Enable it in Chrome (built-in AI flags / origin trial) and reload. If unavailable, the UI
shows how to enable it.

Note: because this is a purely client-side app, feed fetching relies on a CORS proxy (see `src/services/proxy.ts`).
