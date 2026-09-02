# Multi-stage build for Radio Station, served under /radio-station/.
# glibc (slim, not alpine): typescript 7's native compiler is glibc-only.

FROM node:22-slim AS build
WORKDIR /app
RUN npm install -g npm@11.19.0 --no-audit --no-fund
COPY . .
RUN rm -f package-lock.json && npm install --ignore-scripts --no-audit --no-fund
RUN npm install --no-save --ignore-scripts --no-audit --no-fund @typescript/typescript-linux-x64@7.0.2
RUN npm run build -w radio-station

FROM nginx:alpine AS runtime
COPY --from=build /app/apps/radio-station/dist /usr/share/nginx/html
COPY deploy/radio-station/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
