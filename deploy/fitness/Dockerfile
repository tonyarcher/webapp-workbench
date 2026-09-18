# Static SPA. TypeScript is compiled on the host; this image copies dist.
# App is subpath-safe (base './').

FROM nginx:alpine
COPY apps/fitness/app/dist /usr/share/nginx/html
COPY deploy/fitness/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
