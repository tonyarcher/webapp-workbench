"""The four dashboards: Fleet Overview, Errors, Auth and OAuth, Services.

Each function returns the panel list for one board; grafana_panels.py holds the
panel shapes. Kept apart from the writer so neither file grows past the line
ceiling, and so adding a panel is a local edit.

The queries were chosen from what this stack actually logs, not from a template.
Two distinctions matter and are easy to lose: 5xx and 502 are different faults
(the app failed versus the gateway could not reach it), and 499 is a client
hanging up, not a server error. A default time range of one hour is deliberate
-- see dashboard() in grafana_panels.py for why a wider one misleads here.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

# Runs both as `python tools/grafana_dashboards.py` (repo root not on sys.path) and
# as `tools.grafana_dashboards` under mypy (it is). See build_grafana_dashboards.py.
if __package__:
    from tools.grafana_panels import (
        ALL,
        ERRORS,
        GATEWAY,
        USER_API,
        barchart,
        dashboard,
        grid,
        logs_panel,
        row,
        series_target,
        stat,
        table,
        timeseries,
    )
else:  # direct execution: put the repo root on the path first
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from tools.grafana_panels import (
        ALL,
        ERRORS,
        GATEWAY,
        USER_API,
        barchart,
        dashboard,
        grid,
        logs_panel,
        row,
        series_target,
        stat,
        table,
        timeseries,
    )


def handler_quantile(q: str, alias: str) -> str:
    """One percentile of the Kotlin services' own handler time.

    duration_ms comes from the services' request line, so it excludes the
    gateway hop that nginx's own timings include. Having both panels is the
    point: a gap between them is proxy overhead rather than slow code.

    The alias is distinct per percentile on purpose. Three targets in one panel
    that all return a field of the same name can collide and drop series, and
    the legend text does not prevent it.
    """
    base = f"{USER_API} AND msg:request | stats quantile({q}, duration_ms)"
    return f"{base} as {alias}"


# --------------------------------------------------------------------------
# 1. Overview: is the fleet up, and is anything broken
# --------------------------------------------------------------------------


def overview() -> dict[str, Any]:
    p: list[dict[str, Any]] = [
        row(1, "Fleet at a glance", 0),
        stat(
            2,
            "Requests",
            f"{GATEWAY} | stats count() as c",
            grid(0, 1, 4, 4),
            desc="Every request line the gateway has logged in this window.",
        ),
        stat(
            3,
            "Non-2xx/3xx",
            f"{GATEWAY} AND NOT status:200 AND NOT status:302 "
            f"AND NOT status:301 AND NOT status:304 | stats count() as c",
            grid(4, 1, 4, 4),
            desc="4xx and 5xx. Zero is the healthy state.",
        ),
        stat(
            4,
            "5xx",
            f"{GATEWAY} AND status:500 AND NOT status:502 "
            f"AND NOT status:503 AND NOT status:504 | stats count() as c",
            grid(8, 1, 4, 4),
            desc="Server faults from the apps behind the gateway, excluding the "
            "502s the gateway itself raises when an upstream is down.",
        ),
        stat(
            5,
            "502 upstream down",
            f"{GATEWAY} AND status:502 | stats count() as c",
            grid(12, 1, 4, 4),
            desc="The gateway could not reach a backing service. A burst here "
            "with no matching 5xx below means a container is down or booting.",
        ),
        stat(
            6,
            "Containers seen",
            f"{ALL} | stats by (container) count() as c",
            grid(16, 1, 4, 4),
            desc="Distinct containers that emitted at least one line.",
        ),
        stat(
            7,
            "Warnings",
            f"{ERRORS} | stats count() as c",
            grid(20, 1, 4, 4),
            desc="warn, error and critical lines from every service.",
        ),
        row(8, "Traffic", 5),
        timeseries(
            9,
            "Request rate by status",
            [
                series_target(
                    f"{GATEWAY} | stats by (_time:1m, status) count() as c", "A"
                ),
            ],
            grid(0, 6, 16, 8),
            desc="One series per HTTP status, per minute.",
        ),
        barchart(
            10,
            "Requests by path",
            f"{GATEWAY} | stats by (path) count() as c",
            grid(16, 6, 8, 8),
        ),
        row(11, "Where the time goes", 14),
        timeseries(
            12,
            "Upstream response time p50 / p95 / p99",
            [
                series_target(
                    f"{GATEWAY} | stats quantile(0.50, request_time) as p50", "A", "p50"
                ),
                series_target(
                    f"{GATEWAY} | stats quantile(0.95, request_time) as p95", "B", "p95"
                ),
                series_target(
                    f"{GATEWAY} | stats quantile(0.99, request_time) as p99", "C", "p99"
                ),
            ],
            grid(0, 15, 12, 8),
            unit="s",
            desc="nginx's own upstream timings. The p99 is the one that finds "
            "a slow dependency; the p50 hides it.",
        ),
        timeseries(
            13,
            "API handler time p50 / p95 / p99",
            [
                series_target(handler_quantile("0.50", "p50"), "A", "p50"),
                series_target(handler_quantile("0.95", "p95"), "B", "p95"),
                series_target(handler_quantile("0.99", "p99"), "C", "p99"),
            ],
            grid(12, 15, 12, 8),
            unit="ms",
            desc="duration_ms from the Kotlin services' own request line, which "
            "excludes the gateway hop.",
        ),
        row(14, "Log volume", 23),
        timeseries(
            15,
            "Lines per minute by container",
            [
                series_target(
                    f"{ALL} | stats by (_time:1m, container) count() as c", "A"
                ),
            ],
            grid(0, 24, 24, 8),
            stack=True,
            desc="A container that starts producing nothing has usually died; "
            "one that starts producing a lot is usually looping.",
        ),
        table(
            16,
            "Lines by container",
            f"{ALL} | stats by (container) count() as c",
            grid(0, 32, 12, 9),
        ),
        table(
            17,
            "Top client agents",
            f"{GATEWAY} | stats by (ua) count() as c",
            grid(12, 32, 12, 9),
            desc="Useful for telling a real user from a health probe.",
        ),
    ]
    return dashboard(
        "fleet-overview",
        "Fleet Overview",
        ["logs", "overview"],
        p,
        "Is the stack up, and is anything broken. Start here.",
    )


# --------------------------------------------------------------------------
# 2. Errors: what is broken, and since when
# --------------------------------------------------------------------------


def errors() -> dict[str, Any]:
    p: list[dict[str, Any]] = [
        row(1, "Error budget", 0),
        stat(
            2,
            "4xx",
            f"{GATEWAY} AND status:400 AND NOT status:401 "
            f"AND NOT status:403 AND NOT status:404 AND NOT status:405 "
            f"AND NOT status:409 AND NOT status:422 | stats count() as c",
            grid(0, 1, 6, 4),
        ),
        stat(
            3,
            "5xx",
            f"{GATEWAY} AND status:500 AND NOT status:502 "
            f"AND NOT status:503 | stats count() as c",
            grid(6, 1, 6, 4),
        ),
        stat(
            4,
            "502",
            f"{GATEWAY} AND status:502 | stats count() as c",
            grid(12, 1, 6, 4),
        ),
        stat(
            5,
            "499 client closed",
            f"{GATEWAY} AND status:499 | stats count() as c",
            grid(18, 1, 6, 4),
            desc="The client hung up before the response. Usually a slow page "
            "or a cancelled navigation, not a server fault.",
        ),
        row(6, "What is failing", 5),
        timeseries(
            7,
            "Error rate by status class",
            [
                series_target(
                    f"{GATEWAY} AND status:400 AND NOT status:401 "
                    f"AND NOT status:403 AND NOT status:404 "
                    f"AND NOT status:405 AND NOT status:409 "
                    f"AND NOT status:422 | stats by (_time:5m) count() as c",
                    "A",
                    "4xx",
                ),
                series_target(
                    f"{GATEWAY} AND status:500 AND NOT status:502 "
                    f"AND NOT status:503 | stats by (_time:5m) count() as c",
                    "B",
                    "5xx",
                ),
                series_target(
                    f"{GATEWAY} AND status:502 | stats by (_time:5m) count() as c",
                    "C",
                    "502",
                ),
            ],
            grid(0, 6, 12, 8),
        ),
        barchart(
            8,
            "Errors by path",
            f"{GATEWAY} AND (status:500 OR status:502 OR status:503) "
            f"| stats by (path) count() as c",
            grid(12, 6, 12, 8),
        ),
        row(9, "Application errors", 14),
        table(
            10,
            "Non-2xx by path, all statuses",
            f"{GATEWAY} AND NOT status:200 AND NOT status:301 AND NOT status:302 "
            f"AND NOT status:304 | stats by (path, status) count() as c",
            grid(0, 15, 12, 9),
        ),
        logs_panel(
            11,
            "warn and error lines",
            f"{ERRORS}",
            grid(12, 15, 12, 9),
            desc="Every warn/error/critical line, newest first. This is "
            "the panel to read when a number above moves.",
        ),
        row(12, "Recent failures", 24),
        logs_panel(
            13,
            "Failed requests",
            f"{GATEWAY} AND status:500 OR (service:gateway AND status:502)",
            grid(0, 25, 24, 10),
            desc="The raw lines behind the counts above, so a spike can "
            "be traced to a request_id without leaving the dashboard.",
        ),
    ]
    return dashboard(
        "errors",
        "Errors",
        ["logs", "errors"],
        p,
        "What is broken, which path, and since when.",
    )


# --------------------------------------------------------------------------
# 3. Auth: the OAuth flow, which is the fiddliest part of this stack
# --------------------------------------------------------------------------


def auth() -> dict[str, Any]:
    p: list[dict[str, Any]] = [
        row(1, "Sign-in activity", 0),
        stat(
            2,
            "Authorize calls",
            f"{USER_API} AND path:/oauth/authorize | stats count() as c",
            grid(0, 1, 6, 4),
        ),
        stat(
            3,
            "Token calls",
            f"{USER_API} AND path:/oauth/token | stats count() as c",
            grid(6, 1, 6, 4),
        ),
        stat(
            4,
            "Token rejections",
            f"{USER_API} AND msg:token_rejected | stats count() as c",
            grid(12, 1, 6, 4),
            desc="invalid_grant. Any non-zero value here is worth reading: the "
            "log records which fields arrived and whether a PKCE verifier "
            "was present, never its value.",
        ),
        stat(
            5,
            "Sessions opened",
            f"{USER_API} AND path:/oauth/token AND status:200 | stats count() as c",
            grid(18, 1, 6, 4),
        ),
        row(6, "Flow", 5),
        timeseries(
            7,
            "OAuth calls per minute",
            [
                series_target(
                    f"{USER_API} AND path:/oauth/authorize "
                    f"| stats by (_time:1m) count() as c",
                    "A",
                    "authorize",
                ),
                series_target(
                    f"{USER_API} AND path:/oauth/token "
                    f"| stats by (_time:1m) count() as c",
                    "B",
                    "token",
                ),
            ],
            grid(0, 6, 12, 8),
        ),
        timeseries(
            8,
            "Token outcome",
            [
                series_target(
                    f"{USER_API} AND path:/oauth/token "
                    f"| stats by (_time:1m, status) count() as c",
                    "A",
                ),
            ],
            grid(12, 6, 12, 8),
            desc="A 400 here paired with a token_rejected is a rejected grant, "
            "not a broken endpoint.",
        ),
        row(9, "Rate limiting", 14),
        timeseries(
            10,
            "oauth endpoint calls per minute",
            [
                series_target(
                    f"{USER_API} AND path:/oauth/authorize "
                    f"| stats by (_time:1m) count() as c",
                    "A",
                    "authorize",
                ),
                series_target(
                    f"{USER_API} AND path:/oauth/token "
                    f"| stats by (_time:1m) count() as c",
                    "B",
                    "token",
                ),
            ],
            grid(0, 15, 12, 8),
            desc="The token endpoint is rate limited in Postgres. A flat ceiling "
            "here with 429s in the raw log means the limiter is working.",
        ),
        row(11, "Detail", 23),
        logs_panel(
            12,
            "Token rejections",
            f"{USER_API} AND msg:token_rejected",
            grid(0, 24, 24, 9),
            desc="fields lists which form keys arrived, verifier_present "
            "says whether a PKCE verifier came at all, and "
            "verifier_len its length. The verifier itself is never "
            "logged.",
        ),
        table(
            13,
            "Calls by path and status",
            f"{USER_API} AND path:/oauth/* | stats by (path, status) count() as c",
            grid(0, 33, 12, 9),
        ),
        table(
            14,
            "Readiness",
            f"{USER_API} AND msg:ready | stats by (service) count() as c",
            grid(12, 33, 12, 9),
            desc="One per boot. A gap here is a restart.",
        ),
    ]
    return dashboard(
        "auth",
        "Auth and OAuth",
        ["logs", "auth"],
        p,
        "The OAuth sign-in flow, which is the most failure-prone part of this "
        "stack and the hardest to debug from a terminal.",
    )


# --------------------------------------------------------------------------
# 4. Services: per-container behaviour across the whole stack
# --------------------------------------------------------------------------


def services() -> dict[str, Any]:
    p: list[dict[str, Any]] = [
        row(1, "Throughput", 0),
        timeseries(
            2,
            "Log lines per minute, all containers",
            [
                series_target(
                    f"{ALL} | stats by (_time:1m, container) count() as c", "A"
                ),
            ],
            grid(0, 1, 24, 9),
            stack=True,
        ),
        row(3, "Who is talking", 10),
        barchart(
            4,
            "Lines by container",
            f"{ALL} | stats by (container) count() as c",
            grid(0, 11, 12, 10),
        ),
        barchart(
            5,
            "Request sources",
            f"{GATEWAY} | stats by (remote_addr) count() as c",
            grid(12, 11, 12, 10),
            desc="remote_addr as the gateway saw it.",
        ),
        row(6, "The JVMs", 21),
        table(
            7,
            "API requests by service and path",
            f"{USER_API} AND msg:request | stats by (service, path) count() as c",
            grid(0, 22, 12, 9),
        ),
        timeseries(
            8,
            "API handler time p95 by service",
            [
                series_target(
                    "msg:request AND duration_ms:* "
                    "| stats quantile(0.95, duration_ms) as p95",
                    "A",
                ),
            ],
            grid(12, 22, 12, 9),
            unit="ms",
            desc="Across every Kotlin service that logs duration_ms. Boot is "
            "about 31s, so a service well above that on a health check is "
            "worth a look.",
        ),
        row(9, "Raw", 31),
        logs_panel(
            10,
            "Everything, newest first",
            f"{ALL}",
            grid(0, 32, 24, 12),
            desc="The firehose. Filter with the container field or a "
            "LogsQL term like service:gateway.",
        ),
    ]
    return dashboard(
        "services",
        "Services",
        ["logs", "services"],
        p,
        "Per-container behaviour across the whole stack.",
    )
