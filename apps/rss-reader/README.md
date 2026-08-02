# rss-reader

A client-side RSS reader. Subscriptions, folders, articles, and read state live in IndexedDB; feeds are fetched through
a public CORS proxy and parsed in the browser.

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

## Install on Windows

The app is a PWA (manifest + service worker), so Chrome and Edge can install it as a
standalone desktop app, and Firefox gets a desktop shortcut that opens the app in its
own window.

```bash
npm run build
npm run preview    # serve the build at http://localhost:4173
```

If 4173 is already taken by another app, `vite preview` picks the next free port
(e.g. 4174) — use that URL for the steps below, and pass it to the Firefox script:
`powershell -File scripts/install-firefox.ps1 -Url http://localhost:4174`.

- **Chrome / Edge**: open http://localhost:4173, then use the install icon in the address
  bar if offered (or `⋮` → *Install RSS Reader*). It launches from the Start menu /
  taskbar, runs in its own window, and works offline once loaded.
- **Firefox**: desktop Firefox doesn't support installing manifest PWAs (no native
  install UI), so run `powershell -File scripts/install-firefox.ps1` to create a
  "RSS Reader (Firefox)" desktop shortcut that opens the app in a dedicated Firefox
  window — a browser window, not a stripped-down app window.

Notes:

- Installability requires a secure context — use `http://localhost` or HTTPS.
- `npm run build` generates `dist/sw.js` from `scripts/sw.template.js`, precaching
  every hashed bundle automatically — no cache-version constant to bump by hand, and
  fresh installs work fully offline on the first relaunch.
- Offline you get the app shell plus everything already stored in IndexedDB; feed
  syncing and article images still need a network.
- If you change the icon design, update the glyph geometry in `scripts/make-icons.ps1`
  and re-run `powershell -File scripts/make-icons.ps1`.

## Features

- Left sidebar: folders with collapsible sources and unread counts
- Right pane: headline list sorted by hot/newest/oldest, infinite scroll, unread-only filter, mark all as read, star
- Click a headline to read the article inline
- Settings (gear icon): theme (light / dark grey / lights-out OLED), add feed, OPML import/export
- Daily Brief (sidebar): summarizes today's articles with Chrome's built-in Gemini Nano
- Per-article "Summarize" button using the same on-device AI
- Local popularity ranking: syndication across your feeds + feed-reported comment counts feed a Reddit-style hot sort —
  no external APIs

## AI summaries

The Daily Brief and per-article summaries use Chrome's built-in Gemini Nano (the Prompt/Model API — `window.model` /
`window.ai`). No network calls are made; the model runs on-device. Enable it in Chrome (built-in AI flags / origin
trial) and reload. If unavailable, the UI shows how to enable it.

Note: because this is a purely client-side app, feed fetching relies on a CORS proxy (see `src/services/proxy.ts`).
