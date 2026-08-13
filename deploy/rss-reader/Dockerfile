# Multi-stage build for the RSS reader, served under /rss-reader/.
# Stage 1 builds the Vite app with APP_BASE_PATH=/rss-reader/; stage 2 serves
# the static output via nginx.

FROM node:22-alpine AS build
WORKDIR /app
COPY . .
RUN npm ci
RUN APP_BASE_PATH=/rss-reader/ npm run build -w rss-reader

FROM nginx:alpine AS runtime
COPY --from=build /app/apps/rss-reader/dist /usr/share/nginx/html
COPY deploy/rss-reader/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
