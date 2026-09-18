# Static SPA. TypeScript is compiled on the host; this image copies dist.
# App is subpath-safe (base './'), served under /auth/.

FROM nginx:alpine
COPY apps/user/app/dist /usr/share/nginx/html
COPY deploy/user-web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
