# Multi-stage build for the Baseball app, served under /baseball/.
# Stage 1 builds the Vite app with APP_BASE_PATH=/baseball/; stage 2 serves
# the static output via nginx.

# glibc (slim, not alpine): vite's native binaries (rolldown, rollup,
# esbuild) ship glibc and musl linux builds, but using one uniform base keeps
# every image consistent.
FROM node:22-slim AS build
WORKDIR /app
# npm 11 (pinned): the bundled npm 10.9.8 skips optional platform binaries of
# nested workspace deps (@rollup/*, @esbuild/*).
RUN npm install -g npm@11.19.0 --no-audit --no-fund
COPY . .
# The committed lockfile is generated on Windows, so npm ci/install on
# linux cannot fetch platform-specific optional binaries — an npm limitation
# (issue #4828). Resolving fresh from the manifests inside the container
# installs the correct linux binaries; the lockfile remains authoritative for
# local/dev installs.
RUN rm -f package-lock.json && npm install --no-audit --no-fund
RUN npm run build --prefix packages/web-components
RUN APP_BASE_PATH=/baseball/ npm run build -w baseball-tracker

FROM nginx:alpine AS runtime
COPY --from=build /app/apps/baseball/dist /usr/share/nginx/html
COPY deploy/baseball/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
