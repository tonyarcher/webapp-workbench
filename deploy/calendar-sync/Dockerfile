# Static SPA. TypeScript is compiled on the host; this image copies dist.
# nginx also reverse-proxies /api/trakt/ (see nginx.conf).

FROM nginx:alpine
COPY apps/calendar-sync/dist /usr/share/nginx/html
COPY deploy/calendar-sync/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
