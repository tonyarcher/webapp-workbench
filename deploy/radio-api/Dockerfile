# radio-api: JSON API + playlist generator for Radio Station.

FROM node:22-slim AS build
WORKDIR /app
RUN npm install -g npm@11.19.0 --no-audit --no-fund
COPY . .
RUN rm -f package-lock.json && npm install --ignore-scripts --no-audit --no-fund
RUN npm install --no-save --ignore-scripts --no-audit --no-fund @typescript/typescript-linux-x64@7.0.2
RUN npm run build:server -w radio-station
RUN npm prune --omit=dev

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /app/package.json /app/package.json
COPY --from=build /app/apps/radio-station/package.json /app/apps/radio-station/package.json
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/radio-station/dist-server /app/apps/radio-station/dist-server
USER node
EXPOSE 3000
CMD ["node", "apps/radio-station/dist-server/index.js"]
