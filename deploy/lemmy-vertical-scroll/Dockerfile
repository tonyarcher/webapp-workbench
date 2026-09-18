# Static SPA. TypeScript is compiled on the host; this image copies dist.
# App is subpath-safe (base './').

FROM nginx:alpine
COPY apps/lemmy-vertical-scroll/dist /usr/share/nginx/html
COPY deploy/lemmy-vertical-scroll/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
