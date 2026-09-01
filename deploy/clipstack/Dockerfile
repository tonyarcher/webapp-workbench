# Multi-stage build for Clipstack, served under /clipstack/. The app is
# already subpath-safe (base './', %BASE_URL%, scope-relative SW), so it
# builds with the default base. Stage 2 serves the static output via nginx.

# glibc (slim, not alpine): typescript 7's native compiler is glibc-only, and
# vite's native binaries (rollup, esbuild) need linux placements.
FROM node:22-slim AS build
WORKDIR /app
# npm 11 (pinned): the bundled npm 10.9.8 skips optional platform binaries of
# nested workspace deps (typescript 7 native compiler, @rollup/*, @esbuild/*).
RUN npm install -g npm@11.19.0 --no-audit --no-fund
COPY . .
# The committed lockfile is generated on Windows, so npm ci/install on linux
# cannot fetch platform-specific optional binaries — an npm limitation
# (issue #4828). Resolve fresh from manifests.
# --ignore-scripts: workspace prepare scripts run tsc/vite before the linux
# TypeScript 7 native compiler is present, and that install never finishes.
# Build explicitly after the compiler is installed.
RUN rm -f package-lock.json && npm install --ignore-scripts --no-audit --no-fund
# npm skips optional platform binaries of nested packages: typescript 7's
# native compiler (@typescript/typescript-linux-x64) is an optional dep of the
# nested typescript@7 in apps/clipstack and is not installed.
# Install it explicitly (tsc finds it via import.meta.resolve from the root).
# Bump the version together with clipstack's typescript dependency.
# --ignore-scripts: a second npm install would otherwise re-run every
# workspace prepare (another hang).
RUN npm install --no-save --ignore-scripts --no-audit --no-fund @typescript/typescript-linux-x64@7.0.2
RUN npm run build --prefix packages/vertical-scroll-core
RUN npm run build -w clipstack

FROM nginx:alpine AS runtime
COPY --from=build /app/apps/clipstack/dist /usr/share/nginx/html
COPY deploy/clipstack/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
