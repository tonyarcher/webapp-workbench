# fitness-api: JSON API for Fitness samples, profile, and ingest.

FROM node:22-slim AS build
WORKDIR /app
RUN npm install -g npm@11.19.0 --no-audit --no-fund
COPY . .
RUN rm -f package-lock.json && npm install --ignore-scripts --no-audit --no-fund
RUN npm install --no-save --ignore-scripts --no-audit --no-fund @typescript/typescript-linux-x64@7.0.2
RUN npm run build -w fitness-core
RUN npm run build:server -w fitness
RUN npm prune --omit=dev

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /app/package.json /app/package.json
COPY --from=build /app/apps/fitness/package.json /app/apps/fitness/package.json
COPY --from=build /app/packages/fitness-core/package.json /app/packages/fitness-core/package.json
COPY --from=build /app/packages/fitness-core/dist /app/packages/fitness-core/dist
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/fitness/dist-server /app/apps/fitness/dist-server
USER node
EXPOSE 3000
CMD ["node", "apps/fitness/dist-server/index.js"]
