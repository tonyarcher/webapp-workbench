# Static SPA. TypeScript is compiled on the host; this image copies dist.
# gradle buildAll sets APP_BASE_PATH=/baseball/ before compose build.

FROM nginx:alpine
COPY apps/baseball/dist /usr/share/nginx/html
COPY deploy/baseball/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
