# Alloy ships container logs to VictoriaLogs.
#
# The config is copied in rather than bind-mounted. Compose runs against a remote
# Docker daemon, where a host path like deploy/alloy does not exist -- and this
# repo already learned that lesson with the gateway image.

FROM grafana/alloy:v1.20.0

COPY deploy/alloy/config.alloy /etc/alloy/config.alloy

EXPOSE 12345
