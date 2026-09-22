# Static SPA. TypeScript is compiled on the host; this image copies dist.
# gradle buildAll sets APP_BASE_PATH=/rss-reader/ before compose build.

FROM nginx:alpine
COPY apps/rss/app/dist /usr/share/nginx/html
COPY deploy/rss-reader/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
