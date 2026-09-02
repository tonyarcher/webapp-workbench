# rss-api: JSON API + feed poller for the RSS reader. API-only image — the
# SPA is served by the separate rss-reader nginx container.
#
# Stage 1 compiles server/ TypeScript with tsc (NodeNext output in
# dist-server/). Stage 2 runs it with node + production deps only.

# glibc (slim, not alpine): matches the other app images so native/vite
# binaries behave identically across the stack.
FROM node:22-slim AS build
WORKDIR /app
# npm 11 (pinned): the bundled npm 10.9.8 skips optional platform binaries of
# nested workspace deps (@rollup/*, @esbuild/*).
RUN npm install -g npm@11.19.0 --no-audit --no-fund
COPY . .
# The committed lockfile is generated on Windows; resolve fresh on linux
# (same workaround as the other app images — npm issue #4828).
RUN rm -f package-lock.json && npm install --no-audit --no-fund
RUN npm run build:server -w rss-reader
# Prune MUST stay after build:server — typescript is a devDependency.
# Dropping it first would break compilation. Runtime needs only pg + linkedom.
RUN npm prune --omit=dev

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /app/package.json /app/package.json
COPY --from=build /app/apps/rss-reader/package.json /app/apps/rss-reader/package.json
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/rss-reader/dist-server /app/apps/rss-reader/dist-server
USER node
EXPOSE 3000
CMD ["node", "apps/rss-reader/dist-server/index.js"]
