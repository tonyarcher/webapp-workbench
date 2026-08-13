# Multi-stage build for the Lemmy vertical scroll feed, served under
# /lemmy-vertical-scroll/. The app is already subpath-safe (base './',
# %BASE_URL%, scope-relative SW), so it builds with the default base. Stage 2
# serves the static output via nginx.

FROM node:22-alpine AS build
WORKDIR /app
COPY . .
RUN npm ci
RUN npm run build -w lemmy-vertical-scroll

FROM nginx:alpine AS runtime
COPY --from=build /app/apps/lemmy-vertical-scroll/dist /usr/share/nginx/html
COPY deploy/lemmy-vertical-scroll/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
