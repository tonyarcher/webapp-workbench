# Static SPA. TypeScript is compiled on the host; this image copies dist.
# deploy.py sets APP_BASE_PATH=/stock-game/ before compose build.

FROM nginx:alpine
COPY apps/stock-game/app/dist /usr/share/nginx/html
COPY deploy/stock-game/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
