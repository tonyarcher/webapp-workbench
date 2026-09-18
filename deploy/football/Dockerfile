# Static SPA. TypeScript is compiled on the host; this image copies dist.
# deploy.py sets APP_BASE_PATH=/football/ before compose build.

FROM nginx:alpine
COPY apps/football/dist /usr/share/nginx/html
COPY deploy/football/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
