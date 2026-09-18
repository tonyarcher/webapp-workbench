"""Compose services and the npm workspaces that produce them.

Run: `python3 scripts/apps.py --complete` prints tab-completion words.
Imported by build.py, deploy.py, and the completion shims.
Only stdlib is used.
"""

from __future__ import annotations

import sys
from dataclasses import dataclass, field


@dataclass
class App:
    """One deployable app: compose service plus npm workspaces that build it."""

    id: str
    service: str
    workspaces: list[str] = field(default_factory=list)
    aliases: list[str] = field(default_factory=list)
    summary: str = ""


APPS: list[App] = [
    App(
        id="baseball",
        service="baseball",
        workspaces=["@baseball/web-components", "baseball-tracker"],
        aliases=["baseball", "baseball-tracker", "tracker", "apps/baseball"],
        summary="Baseball tracker (also builds @baseball/web-components)",
    ),
    App(
        id="rss-reader",
        service="rss-reader",
        workspaces=["rss-reader"],
        aliases=["rss-reader", "rss", "apps/rss/app"],
        summary="RSS reader (static SPA)",
    ),
    App(
        id="rss-api",
        service="rss-api",
        workspaces=["rss-api"],
        aliases=["rss-api", "apps/rss/api"],
        summary="RSS API (Kotlin / Spring Data JPA)",
    ),
    App(
        id="stock-game",
        service="stock-game",
        workspaces=["@stock-game/app"],
        aliases=[
            "stock-game",
            "stock",
            "@stock-game/app",
            "apps/stock-game",
            "apps/stock-game/app",
        ],
        summary="Stock game",
    ),
    App(
        id="stock-game-api",
        service="stock-game-api",
        workspaces=["stock-game-api"],
        aliases=["stock-game-api", "apps/stock-game/api"],
        summary="Stock game API (Kotlin / Spring Data JPA)",
    ),
    App(
        id="lemmy-vertical-scroll",
        service="lemmy-vertical-scroll",
        workspaces=["vertical-scroll-core", "lemmy-vertical-scroll"],
        aliases=["lemmy-vertical-scroll", "lemmy", "apps/lemmy-vertical-scroll"],
        summary="Lemmy vertical scroll (also builds vertical-scroll-core)",
    ),
    App(
        id="clipstack",
        service="clipstack",
        workspaces=["vertical-scroll-core", "clipstack"],
        aliases=["clipstack", "tiktok", "apps/clipstack"],
        summary="Clipstack — short-video list scroller (also builds vertical-scroll-core)",
    ),
    App(
        id="calendar-sync",
        service="calendar-sync",
        workspaces=["calendar-core", "calendar-sync"],
        aliases=["calendar-sync", "calendar", "cal", "apps/calendar-sync"],
        summary="Calendar sync (also builds calendar-core)",
    ),
    App(
        id="radio-station",
        service="radio-station",
        workspaces=["radio-station"],
        aliases=["radio-station", "radio", "apps/radio-station"],
        summary="Radio station simulator (static SPA)",
    ),
    App(
        id="radio-api",
        service="radio-api",
        workspaces=["radio-station"],
        aliases=["radio-api", "apps/radio-station/server"],
        summary="Radio station API + playlist generator",
    ),
    App(
        id="football",
        service="football",
        workspaces=["football-core", "football"],
        aliases=["football", "apps/football"],
        summary="Football tracker (also builds football-core)",
    ),
    App(
        id="fitness",
        service="fitness",
        workspaces=["fitness-core", "fitness"],
        aliases=["fitness", "apps/fitness/app"],
        summary="Fitness tracker (also builds fitness-core)",
    ),
    App(
        id="fitness-api",
        service="fitness-api",
        workspaces=["fitness-api"],
        aliases=["fitness-api", "apps/fitness/api"],
        summary="Fitness API (Kotlin / Spring Data JPA)",
    ),
    App(
        id="user-web",
        service="user-web",
        workspaces=["user-web"],
        aliases=["user-web", "auth", "accounts", "apps/user/app"],
        summary="Accounts landing page (static SPA)",
    ),
    App(
        id="user-api",
        service="user-api",
        workspaces=["user-api"],
        aliases=["user-api", "apps/user/api"],
        summary="Identity API (Kotlin / Spring Boot)",
    ),
    App(
        id="gitea",
        service="gitea",
        workspaces=[],
        aliases=["gitea", "git"],
        summary="Gitea git + wiki (Docker only)",
    ),
    App(
        id="gateway",
        service="gateway",
        workspaces=[],
        aliases=["gateway", "hello"],
        summary="nginx gateway / hello page (Docker only)",
    ),
]


def normalize_app_name(name: str) -> str:
    """Lowercase, forward slashes, no trailing slash."""
    return str(name).strip().lower().replace("\\", "/").rstrip("/")


def format_app_list() -> str:
    """One `id  aliases` line per app, for --help output."""
    lines = []
    for app in APPS:
        rest = ", ".join(a for a in app.aliases if a != app.id)
        lines.append(f"  {app.id:<24} {rest}" if rest else f"  {app.id}")
    return "\n".join(lines)


def resolve_app(name: str) -> App | None:
    """Match an id, service, or alias. Returns None when unknown."""
    key = normalize_app_name(name)
    for app in APPS:
        if normalize_app_name(app.id) == key or normalize_app_name(app.service) == key:
            return app
        if any(normalize_app_name(alias) == key for alias in app.aliases):
            return app
    return None


def resolve_apps(names: list[str]) -> list[App]:
    """Resolve names (after folder expansion), deduped, or raise."""
    found: list[App] = []
    seen: set[str] = set()
    for name in expand_folders(names):
        app = resolve_app(name)
        if app is None:
            raise ValueError(f'Unknown app "{name}". Known names:\n{format_app_list()}')
        if app.id not in seen:
            seen.add(app.id)
            found.append(app)
    return found


def expand_folders(names: list[str]) -> list[str]:
    """Expand a folder path like `apps/rss` to member app ids.

    Anything else passes through for normal single-app resolution.
    """
    out: list[str] = []
    for name in names:
        key = normalize_app_name(name)
        hits = (
            [
                app
                for app in APPS
                if any(
                    (a := normalize_app_name(alias)) == key or a.startswith(f"{key}/")
                    for alias in app.aliases
                )
            ]
            if "/" in key
            else []
        )
        if len(hits) > 1:
            out.extend(hit.id for hit in hits)
        else:
            out.append(name)
    return out


def workspaces_for(apps: list[App]) -> list[str]:
    """Ordered, deduped npm workspaces for the given apps."""
    workspaces: list[str] = []
    seen: set[str] = set()
    for app in apps:
        for workspace in app.workspaces:
            if workspace not in seen:
                seen.add(workspace)
                workspaces.append(workspace)
    return workspaces


def build_waves(apps: list[App], unknown: list[str]) -> list[list[str]]:
    """Group workspaces into parallel waves: wave N holds every app's Nth
    workspace, so a library (`[lib, app]` lists the library first) always
    finishes before its consumers. Raw names keep a trailing wave of their own.
    """
    waves: list[list[str]] = []
    seen: set[str] = set()

    def push(index: int, workspace: str) -> None:
        if workspace in seen:
            return
        seen.add(workspace)
        while len(waves) <= index:
            waves.append([])
        waves[index].append(workspace)

    for app in apps:
        for index, workspace in enumerate(app.workspaces):
            push(index, workspace)
    if unknown:
        tail = [name for name in dict.fromkeys(unknown) if name not in seen]
        if tail:
            waves.append(tail)
    return [wave for wave in waves if wave]


def completion_words() -> list[str]:
    """Tab-completion words: ids plus short aliases and folder shortcuts."""
    words: set[str] = set()
    for app in APPS:
        words.add(app.id)
        for alias in app.aliases:
            if alias.startswith("@"):
                continue
            if "/" not in alias:
                words.add(alias)
            else:
                words.add("/".join(alias.split("/")[:2]))
    return sorted(words)


if __name__ == "__main__":
    if "--complete" in sys.argv[1:]:
        sys.stdout.write("\n".join(completion_words()) + "\n")
