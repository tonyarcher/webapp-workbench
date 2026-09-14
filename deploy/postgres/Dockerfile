# Shared Postgres with first-init seed scripts baked in.
# Built from the deploy/ context (like the gateway) because the remote daemon
# cannot see host bind mounts. initdb/ runs only when pgdata is first created;
# existing volumes need the manual CREATE DATABASE step in deploy/README.md.
FROM postgres:17-alpine
COPY postgres/initdb/ /docker-entrypoint-initdb.d/
