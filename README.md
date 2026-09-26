# webapp-workbench

A sandbox of small webapp ideas — personal tools and a portfolio. Every app is
an SPA focused on one thing, served behind the same reverse-proxy gateway.

## What is in here

Apps live in `apps/`, shared libraries in `packages/`, and the Compose gateway
stack in `deploy/`. **This file deliberately does not list them** — the app map,
its workspaces, compose services, aliases, subpaths, and boot jar paths all live
in `apps.json`, and the directories on disk are the truth for what exists. Read
those rather than trusting a table that can only go stale.

Each app directory carries its own `AGENTS.md` with the conventions and gotchas
that apply to it.

## Getting started

```sh
npm install        # installs all workspaces and builds the library dists
npm run build      # builds every workspace
npm test           # runs every workspace's tests
python verify.py   # formatters and linters, in check mode
```

Everything that can build on a host, JS workspaces and Kotlin APIs together, in
one command from the repo root:

```sh
./gradlew buildAll              # JS workspaces + all APIs
./gradlew buildJvm              # Kotlin APIs only (bootJar)
./gradlew buildNode             # JS workspaces only
./gradlew checkAll              # API tests, detekt, Jacoco gates
./gradlew buildAll -Papps=rss   # one app, by id, alias, or folder path
```

The Gradle wrapper is local-only (`gradle wrapper` generates it; nothing is
committed), and the Python entry points fall back to `gradle` on PATH.

Per-app dev servers are `npm run dev:<app>`. The full set is the `dev:*` scripts
in the root `package.json`; read that rather than a list here.

## Deployment

`deploy/` holds the nginx reverse-proxy gateway stack: a hello page at `/` and
each app under its own subpath, with one path per UI and per API. The routes are
hand-authored in `deploy/nginx/default.conf.template`, which the deploy task
renders to `default.conf` on every run.

```sh
python deploy.py             # build, render the gateway, mint certs, compose up
python deploy.py rss         # one service
python deploy.py --status
```

Both Python entry points are thin wrappers over the root Gradle build. See
`deploy/README.md` for TLS, the remote-daemon tunnel, and data volumes, and
`deploy/AGENTS.md` for the rules that govern the stack.
