# Multi-stage build for the stock-game app, served under /stock-game/.
# Stage 1 builds the app with APP_BASE_PATH=/stock-game/; stage 2 runs the
# built fetch handler via a tiny dependency-free node HTTP host.

# glibc (slim, not alpine): vite's native binaries (rolldown, rollup,
# esbuild) ship glibc and musl linux builds, but using one uniform base keeps
# every image consistent.
FROM node:22-slim AS build
WORKDIR /app
# npm 11 (pinned): the bundled npm 10.9.8 skips optional platform binaries of
# nested workspace deps (@rollup/*, @esbuild/*).
RUN npm install -g npm@11.19.0 --no-audit --no-fund
COPY . .
# The committed lockfile is generated on Windows, so npm ci/install on linux
# cannot fetch platform-specific optional binaries — an npm limitation
# (issue #4828). Resolve fresh from manifests.
RUN rm -f package-lock.json && npm install --no-audit --no-fund
# TanStack Start's prerender starts a vite preview server on `localhost` and
# fetches it; on Debian, listen binds ::1 while fetch tries 127.0.0.1. Force
# ipv4first so both agree.
RUN APP_BASE_PATH=/stock-game/ NODE_OPTIONS=--dns-result-order=ipv4first npm run build -w @stock-game/app

FROM node:22-slim
WORKDIR /app/apps/stock-game/app
COPY --from=build /app /app
ENV PORT=3000 STOCK_GAME_DB=/app/data/stock-game.db APP_BASE_PATH=/stock-game/
COPY deploy/stock-game/server-host.mjs ./server-host.mjs
RUN mkdir -p /app/data && chown -R node:node /app
USER node
EXPOSE 3000
CMD ["node", "server-host.mjs"]
