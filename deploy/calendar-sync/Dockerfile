# Multi-stage build for Calendar Sync, served under /calendar-sync/. The app
# is subpath-safe (base './', %BASE_URL%, scope-relative SW), so it builds
# with the default base. Stage 2 serves the static output via nginx, which
# also reverse-proxies /api/trakt/ to api.trakt.tv.

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
RUN npm run build -w calendar-core
RUN npm run build -w calendar-sync

FROM nginx:alpine AS runtime
COPY --from=build /app/apps/calendar-sync/dist /usr/share/nginx/html
COPY deploy/calendar-sync/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
