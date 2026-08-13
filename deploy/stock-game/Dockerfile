# Multi-stage build for the stock-game app, served under /stock-game/.
# Stage 1 builds the app with APP_BASE_PATH=/stock-game/; stage 2 runs the
# built fetch handler via a tiny dependency-free node HTTP host.

FROM node:22-alpine AS build
WORKDIR /app
COPY . .
RUN npm ci
RUN APP_BASE_PATH=/stock-game/ npm run build -w @stock-game/app

FROM node:22-alpine
WORKDIR /app/apps/stock-game/app
COPY --from=build /app /app
ENV PORT=3000 STOCK_GAME_DB=/app/data/stock-game.db
COPY deploy/stock-game/server-host.mjs ./server-host.mjs
EXPOSE 3000
CMD ["node", "server-host.mjs"]
