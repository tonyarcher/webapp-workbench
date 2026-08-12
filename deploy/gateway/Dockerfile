# Reverse-proxy gateway for the Baseball deployment.
# Built from the deploy/ context so nginx config and static content are copied
# into the image rather than bind-mounted, which is required when Compose runs
# against a remote Docker daemon (host paths don't exist on the remote server).

FROM nginx:alpine
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY hello/ /usr/share/nginx/hello/
EXPOSE 80
