# Grafana log viewer over VictoriaLogs.
#
# Provisioning is copied in rather than bind-mounted: Compose runs against a
# remote Docker daemon where host paths do not exist, same as the gateway image.

FROM grafana/grafana:13.2.2

COPY deploy/grafana/provisioning /etc/grafana/provisioning
