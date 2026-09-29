"""Panel builders for the Grafana dashboards, and the query vocabulary.

Grafana's dashboard JSON is deeply nested and easy to get subtly wrong, so the
dashboards are generated rather than hand-written and these are the shapes they
are assembled from. Split out from build_grafana_dashboards.py purely to keep
each file under the line ceiling; the two are one concern.

Every query constant here was run against the live VictoriaLogs before being
written down, because the LogsQL that works is not the LogsQL that looks right:
the aggregation is | stats by (field) count() as c, and | fields by (x) is
a parse error.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "deploy" / "grafana" / "provisioning" / "dashboards"
DS_UID = "victorialogs"

# The app JSON log shape, from the user-wide stdout-is-the-API contract:
# ts, level, msg, service, then event-specific scalars. duration_ms is on every
# request line; the gateway's app_json carries nginx's own fields instead.
ALL = "*"
GATEWAY = "service:gateway"
USER_API = "service:user-api"
ERRORS = "level:error OR level:warn OR level:critical"


def target(query: str, ref: str, legend: str = "{{status}}") -> dict[str, Any]:
    """One LogsQL query, in the shape the logs datasource expects."""
    return {
        "refId": ref,
        "datasource": {"type": "victoriametrics-logs-datasource", "uid": DS_UID},
        "queryType": "instant",
        "expr": query,
        "legendFormat": legend,
    }


def series_target(query: str, ref: str, legend: str = "{{status}}") -> dict[str, Any]:
    """Same as target(), but flagged as a time series so the panel buckets it."""
    t = target(query, ref, legend)
    t["queryType"] = "range"
    return t


def grid(x: int, y: int, w: int, h: int) -> dict[str, int]:
    return {"x": x, "y": y, "w": w, "h": h}


def stat(
    panel_id: int,
    title: str,
    query: str,
    pos: dict[str, int],
    unit: str = "short",
    desc: str = "",
    legend: str = "value",
) -> dict[str, Any]:
    return {
        "id": panel_id,
        "type": "stat",
        "title": title,
        "description": desc,
        "datasource": {"type": "victoriametrics-logs-datasource", "uid": DS_UID},
        "gridPos": pos,
        "targets": [target(query, "A", legend)],
        "options": {
            "reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False},
            "colorMode": "value",
            "graphMode": "none",
            "textMode": "auto",
            "justifyMode": "auto",
        },
        "fieldConfig": {
            "defaults": {
                "unit": unit,
                "color": {"mode": "thresholds"},
                "thresholds": {
                    "mode": "absolute",
                    "steps": [
                        {"color": "green", "value": None},
                        {"color": "yellow", "value": 1},
                        {"color": "red", "value": 10},
                    ],
                },
            },
            "overrides": [],
        },
    }


def timeseries(
    panel_id: int,
    title: str,
    queries: list[dict[str, Any]],
    pos: dict[str, int],
    unit: str = "short",
    desc: str = "",
    stack: bool = False,
) -> dict[str, Any]:
    return {
        "id": panel_id,
        "type": "timeseries",
        "title": title,
        "description": desc,
        "datasource": {"type": "victoriametrics-logs-datasource", "uid": DS_UID},
        "gridPos": pos,
        "targets": queries,
        "options": {
            "legend": {
                "displayMode": "table",
                "placement": "bottom",
                "showLegend": True,
                "calcs": ["max", "mean", "sum"],
            },
            "tooltip": {"mode": "multi", "sort": "desc"},
        },
        "fieldConfig": {
            "defaults": {
                "unit": unit,
                "custom": {
                    "drawStyle": "line",
                    "lineWidth": 1,
                    "fillOpacity": 8 if stack else 0,
                    "showPoints": "never",
                    "spanNulls": True,
                    "stacking": {"mode": "normal" if stack else "none", "group": "A"},
                },
            },
            "overrides": [],
        },
    }


def barchart(
    panel_id: int,
    title: str,
    query: str,
    pos: dict[str, int],
    unit: str = "short",
    desc: str = "",
) -> dict[str, Any]:
    return {
        "id": panel_id,
        "type": "barchart",
        "title": title,
        "description": desc,
        "datasource": {"type": "victoriametrics-logs-datasource", "uid": DS_UID},
        "gridPos": pos,
        "targets": [target(query, "A", "{{path}}")],
        "options": {
            "orientation": "horizontal",
            "showValue": "always",
            "legend": {"displayMode": "hidden", "showLegend": False},
            "xTickLabelRotation": 0,
        },
        "fieldConfig": {"defaults": {"unit": unit}, "overrides": []},
    }


def table(
    panel_id: int,
    title: str,
    query: str,
    pos: dict[str, int],
    desc: str = "",
) -> dict[str, Any]:
    return {
        "id": panel_id,
        "type": "table",
        "title": title,
        "description": desc,
        "datasource": {"type": "victoriametrics-logs-datasource", "uid": DS_UID},
        "gridPos": pos,
        "targets": [target(query, "A")],
        "transformations": [
            {
                "id": "organize",
                "options": {
                    "excludeByName": {"Time": True},
                    "indexByName": {},
                },
            },
        ],
        "options": {
            "showHeader": True,
            "footer": {"show": False},
            "sortBy": [{"desc": True, "displayName": "Value"}],
        },
        "fieldConfig": {
            "defaults": {"custom": {"align": "auto", "filterable": True}},
            "overrides": [],
        },
    }


def logs_panel(
    panel_id: int,
    title: str,
    query: str,
    pos: dict[str, int],
    desc: str = "",
) -> dict[str, Any]:
    return {
        "id": panel_id,
        "type": "logs",
        "title": title,
        "description": desc,
        "datasource": {"type": "victoriametrics-logs-datasource", "uid": DS_UID},
        "gridPos": pos,
        "targets": [target(query, "A")],
        "options": {
            "showTime": True,
            "wrapLogMessage": True,
            "sortOrder": "Descending",
            "enableLogDetails": True,
        },
        "fieldConfig": {"defaults": {}, "overrides": []},
    }


def row(panel_id: int, title: str, y: int) -> dict[str, Any]:
    return {
        "id": panel_id,
        "type": "row",
        "title": title,
        "collapsed": False,
        "gridPos": {"x": 0, "y": y, "w": 24, "h": 1},
        "panels": [],
    }


def dashboard(
    uid: str,
    title: str,
    tags: list[str],
    panels: list[dict[str, Any]],
    description: str,
    seconds: str = "now-1h",
) -> dict[str, Any]:
    """Assemble a dashboard.

    The default range is one hour, not the usual six or twenty-four. Retention
    is 30 days, but the pipeline only started on the day this was written, so a
    wider default spends most of the graph on the deploys that got it running.
    The 400s on /logs/api/live/ws were the websocket bug this branch fixed; the
    502s on /oauth/authorize were user-api mid-boot at roughly 31s a boot. Both
    read as live incidents on a 24h view and neither is. An operator can widen
    the range at will; the default should not open by lying about what broke.
    """
    return {
        "uid": uid,
        "title": title,
        "description": description,
        "tags": tags,
        "editable": True,
        "graphTooltip": 1,
        "schemaVersion": 41,
        "version": 1,
        "refresh": "30s",
        "time": {"from": seconds, "to": "now"},
        "timepicker": {"refresh_intervals": ["10s", "30s", "1m", "5m", "15m", "1h"]},
        "annotations": {
            "list": [
                {
                    "builtIn": 1,
                    "datasource": {"type": "grafana", "uid": "-- Grafana --"},
                    "enable": True,
                    "hide": True,
                    "iconColor": "rgba(0, 211, 255, 1)",
                    "name": "Annotations & Alerts",
                    "type": "dashboard",
                }
            ]
        },
        "templating": {
            "list": [
                {
                    "name": "ds",
                    "label": "Datasource",
                    "type": "datasource",
                    "query": "victoriametrics-logs-datasource",
                    "current": {},
                    "hide": 2,
                    "refresh": 1,
                }
            ]
        },
        "panels": panels,
    }
