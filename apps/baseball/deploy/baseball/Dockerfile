# Multi-stage build for the Baseball app, served under /baseball/.
# Stage 1 builds the web-components library and the Vite app with
# APP_BASE_PATH=/baseball/; stage 2 serves the static output via nginx.

FROM node:22-alpine AS build
WORKDIR /app

# Install root dependencies (layer cached by lockfiles)
COPY package.json package-lock.json ./
COPY web-components/package.json web-components/package-lock.json ./web-components/
RUN npm ci

# Install web-components dependencies for its standalone build
RUN npm --prefix web-components ci

# Copy source and build
COPY . .
RUN npm run build:components && APP_BASE_PATH=/baseball/ npm run build

# Runtime stage
FROM nginx:alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY deploy/baseball/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
