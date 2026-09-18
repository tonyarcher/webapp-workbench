# Static SPA. TypeScript is compiled on the host; this image copies dist.
# App is subpath-safe (base './').

FROM nginx:alpine
COPY apps/clipstack/dist /usr/share/nginx/html
COPY deploy/clipstack/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
