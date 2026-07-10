FROM nginx:alpine
COPY webApp/build/dist/wasmJs/productionExecutable /usr/share/nginx/html
COPY webApp/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
