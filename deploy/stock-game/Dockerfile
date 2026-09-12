# Multi-stage build for the stock-game app, served under /stock-game/.
# Stage 1 builds the static Vite SPA with APP_BASE_PATH=/stock-game/;
# stage 2 serves it via nginx. The JSON API is stock-game-api (Kotlin).

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
RUN APP_BASE_PATH=/stock-game/ npm run build -w @stock-game/app

FROM nginx:alpine AS runtime
COPY --from=build /app/apps/stock-game/app/dist /usr/share/nginx/html
COPY deploy/stock-game/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
