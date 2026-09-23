# webapp-workbench

A sandbox of small webapp ideas collected over the years — personal tools and a
portfolio. Every app is an SPA, focused on one thing, and served behind the
same reverse-proxy gateway.

## Apps

| Path                          | App              | Stack                                     | Focus                                        |
| ----------------------------- | ---------------- | ----------------------------------------- | -------------------------------------------- |
| `apps/baseball/`              | Baseball tracker | Vite + Lit + TanStack core                | Scorekeeping, client-side only               |
| `apps/rss/`                   | RSS reader + API | Vite + Lit + TanStack core / Kotlin + JPA | Feed reading, PWA, hash routing              |
| `apps/stock-game/`            | Stock game       | Vite + Lit + TanStack core                | Paper trading, hash routing                  |
| `apps/lemmy-vertical-scroll/` | Lemmy scroller   | Vite + Lit + TanStack core                | Vertical feed scrolling                      |
| `apps/clipstack/`             | Clipstack        | Vite + Lit + vertical-scroll-core         | Import a short-video link list and scroll it |
| `apps/calendar-sync/`         | Calendar Sync    | Vite + Lit + calendar-core                | Trakt + Netflix → ICS / Google Calendar      |
| `apps/radio-station/`         | Radio Station    | Vite + Lit + Kotlin API                   | 7-day Top 40 log generator                   |

## Packages

| Path                             | Package                    | Purpose                                                  |
| -------------------------------- | -------------------------- | -------------------------------------------------------- |
| `packages/web-components/`       | `@baseball/web-components` | Baseball UI component library                            |
| `packages/vertical-scroll-core/` | `vertical-scroll-core`     | Generic vertical-scroller components                     |
| `packages/calendar-core/`        | `calendar-core`            | ICS emit, Trakt/Netflix mappers, Google Calendar helpers |

## Getting started

```sh
npm install        # installs all workspaces (builds library dists)
npm run build      # builds every workspace
npm test           # runs every workspace's tests
```

Everything that can build on a host (JS workspaces + the Kotlin/Spring APIs) in
one command from the repo root:

```sh
./gradlew buildAll   # JS workspaces + all APIs
./gradlew buildJvm   # Kotlin APIs only (bootJar)
./gradlew buildNode  # JS workspaces only
./gradlew checkAll   # API tests, detekt, Jacoco gates
./gradlew buildAll -Papps=rss   # one app (ids, aliases, or folders)
```

The wrapper is local-only (`gradle wrapper` generates it, nothing committed); the
Python entry points below fall back to `gradle` on PATH when it is absent.

`python build.py` / `python deploy.py` are thin entry points over Gradle:
deploy builds the host artifacts, renders the gateway config, and mints TLS
certs before calling `docker compose`. Pass an app name to do one service:
`python deploy.py rss`. See `deploy/README.md` for details.

One app at a time:

```sh
npm run dev:baseball
npm run dev:rss-reader
npm run dev:stock-game
npm run dev:lemmy
npm run dev:clipstack
npm run dev:calendar-sync
npm run dev:radio-station
npm run dev:radio-api
```

Each app directory carries its own `AGENTS.md` with detailed conventions.

## Deployment

`deploy/` holds the nginx reverse-proxy gateway stack: hello world at `/` and
each app under its own path (`/baseball/`, `/rss-reader/`, `/stock-game/`,
`/lemmy-vertical-scroll/`, `/clipstack/`, `/calendar-sync/`, `/radio-station/`). From the repo root, `python build.py`
builds workspaces locally and `python deploy.py` brings the compose stack up
(auto-selects a local Docker engine or an SSH-tunneled remote daemon). Both are
thin entry points over the root Gradle build: deploy builds the host artifacts,
renders the gateway config, and mints TLS certs before calling `docker compose`.
Pass an app name to do one service: `python deploy.py rss`.
See `deploy/README.md` for details.
