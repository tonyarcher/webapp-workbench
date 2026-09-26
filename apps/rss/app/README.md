# rss-reader

A client-side RSS reader. Subscriptions, folders, articles, and read state live
in IndexedDB; feeds are fetched through a public CORS proxy and parsed in the
browser. `AGENTS.md` has the engineering rules.

## Getting started

```bash
npm install
npm run dev        # Vite dev server
npm test           # smoke tests
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
  bar if offered (or `⋮` → _Install RSS Reader_). It launches from the Start menu /
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

A sidebar of folders with collapsible sources and unread counts; a headline list
sorted by hot, newest, or oldest with infinite scroll, an unread-only filter,
mark-all-read, and starring; inline article reading; a settings dialog for theme
(light, dark grey, lights-out OLED), adding a feed, and OPML import and export;
a Daily Brief in the sidebar; and a per-article summarize button. Ranking is
local — syndication and feed-reported comment counts drive a hot sort, with no
external ranking API.

## AI summaries

The Daily Brief and per-article summaries use Chrome's on-device Prompt API
(`LanguageModel`, with a fallback to the older `window.model` / `window.ai`
APIs). No network calls are made; the model runs on-device. This is not the cloud
"Ask Gemini" button, and downloading Gemma in `chrome://components` is not enough
by itself.

This needs a recent Chrome on `https://` or `http://localhost`, with the
on-device-model and prompt-api flags enabled. Confirm with
`await LanguageModel.availability()` in DevTools; if it is unavailable the UI
shows diagnostics. Because the app is purely client-side, feed fetching relies on
a CORS proxy (see `src/services/proxy.ts`).
