# Multi-stage build for the Baseball app, served under /baseball/.
# Stage 1 builds the Vite app with APP_BASE_PATH=/baseball/; stage 2 serves
# the static output via nginx.

FROM node:22-alpine AS build
WORKDIR /app
COPY . .
RUN npm ci
RUN npm run build --prefix packages/web-components
RUN APP_BASE_PATH=/baseball/ npm run build -w baseball-tracker

FROM nginx:alpine AS runtime
COPY --from=build /app/apps/baseball/dist /usr/share/nginx/html
COPY deploy/baseball/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
