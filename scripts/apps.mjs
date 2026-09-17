/** Compose services and the npm workspaces that produce them. */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const APPS = [
  {
    id: "baseball",
    service: "baseball",
    workspaces: ["@baseball/web-components", "baseball-tracker"],
    aliases: ["baseball", "baseball-tracker", "tracker", "apps/baseball"],
    summary: "Baseball tracker (also builds @baseball/web-components)",
  },
  {
    id: "rss-reader",
    service: "rss-reader",
    workspaces: ["rss-reader"],
    aliases: ["rss-reader", "rss", "apps/rss/app"],
    summary: "RSS reader (static SPA)",
  },
  {
    id: "rss-api",
    service: "rss-api",
    workspaces: ["rss-api"],
    aliases: ["rss-api", "apps/rss/api"],
    summary: "RSS API (Kotlin / Spring Data JPA)",
  },
  {
    id: "stock-game",
    service: "stock-game",
    workspaces: ["@stock-game/app"],
    aliases: ["stock-game", "stock", "@stock-game/app", "apps/stock-game", "apps/stock-game/app"],
    summary: "Stock game",
  },
  {
    id: "stock-game-api",
    service: "stock-game-api",
    workspaces: ["stock-game-api"],
    aliases: ["stock-game-api", "apps/stock-game/api"],
    summary: "Stock game API (Kotlin / Spring Data JPA)",
  },
  {
    id: "lemmy-vertical-scroll",
    service: "lemmy-vertical-scroll",
    workspaces: ["vertical-scroll-core", "lemmy-vertical-scroll"],
    aliases: ["lemmy-vertical-scroll", "lemmy", "apps/lemmy-vertical-scroll"],
    summary: "Lemmy vertical scroll (also builds vertical-scroll-core)",
  },
  {
    id: "clipstack",
    service: "clipstack",
    workspaces: ["vertical-scroll-core", "clipstack"],
    aliases: ["clipstack", "tiktok", "apps/clipstack"],
    summary: "Clipstack — short-video list scroller (also builds vertical-scroll-core)",
  },
  {
    id: "calendar-sync",
    service: "calendar-sync",
    workspaces: ["calendar-core", "calendar-sync"],
    aliases: ["calendar-sync", "calendar", "cal", "apps/calendar-sync"],
    summary: "Calendar sync (also builds calendar-core)",
  },
  {
    id: "radio-station",
    service: "radio-station",
    workspaces: ["radio-station"],
    aliases: ["radio-station", "radio", "apps/radio-station"],
    summary: "Radio station simulator (static SPA)",
  },
  {
    id: "radio-api",
    service: "radio-api",
    workspaces: ["radio-station"],
    aliases: ["radio-api", "apps/radio-station/server"],
    summary: "Radio station API + playlist generator",
  },
  {
    id: "football",
    service: "football",
    workspaces: ["football-core", "football"],
    aliases: ["football", "apps/football"],
    summary: "Football tracker (also builds football-core)",
  },
  {
    id: "fitness",
    service: "fitness",
    workspaces: ["fitness-core", "fitness"],
    aliases: ["fitness", "apps/fitness/app"],
    summary: "Fitness tracker (also builds fitness-core)",
  },
  {
    id: "fitness-api",
    service: "fitness-api",
    workspaces: ["fitness-api"],
    aliases: ["fitness-api", "apps/fitness/api"],
    summary: "Fitness API (Kotlin / Spring Data JPA)",
  },
  {
    id: "user-web",
    service: "user-web",
    workspaces: ["user-web"],
    aliases: ["user-web", "auth", "accounts", "apps/user/app"],
    summary: "Accounts landing page (static SPA)",
  },
  {
    id: "user-api",
    service: "user-api",
    workspaces: ["user-api"],
    aliases: ["user-api", "apps/user/api"],
    summary: "Identity API (Kotlin / Spring Boot)",
  },
  {
    id: "gitea",
    service: "gitea",
    workspaces: [],
    aliases: ["gitea", "git"],
    summary: "Gitea git + wiki (Docker only)",
  },
  {
    id: "gateway",
    service: "gateway",
    workspaces: [],
    aliases: ["gateway", "hello"],
    summary: "nginx gateway / hello page (Docker only)",
  },
];

export function normalizeAppName(name) {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/\\/g, "/")
    .replace(/\/+$/, "");
}

export function formatAppList() {
  return APPS.map((app) => {
    const aliases = app.aliases.filter((alias) => alias !== app.id).join(", ");
    return aliases ? `  ${app.id.padEnd(24)} ${aliases}` : `  ${app.id}`;
  }).join("\n");
}

export function resolveApp(name) {
  const key = normalizeAppName(name);
  return (
    APPS.find(
      (app) =>
        normalizeAppName(app.id) === key ||
        normalizeAppName(app.service) === key ||
        app.aliases.some((alias) => normalizeAppName(alias) === key),
    ) ?? null
  );
}

export function resolveApps(names) {
  return resolveAppsExpanded(expandFolders(names));
}

function resolveAppsExpanded(names) {
  const found = [];
  const seen = new Set();
  for (const name of names) {
    const app = resolveApp(name);
    if (!app) {
      throw new Error(`Unknown app "${name}". Known names:\n${formatAppList()}`);
    }
    if (!seen.has(app.id)) {
      seen.add(app.id);
      found.push(app);
    }
  }
  return found;
}

/**
 * A folder path like `apps/rss` expands to every app whose path alias lives
 * under it, so one name deploys/builds the UI and the API together.
 * Anything else passes through for normal single-app resolution.
 */
export function expandFolders(names) {
  const out = [];
  for (const name of names) {
    const key = normalizeAppName(name);
    const hits = key.includes("/")
      ? APPS.filter((app) =>
          app.aliases.some((alias) => {
            const a = normalizeAppName(alias);
            return a === key || a.startsWith(`${key}/`);
          }),
        )
      : [];
    if (hits.length > 1) {
      for (const hit of hits) out.push(hit.id);
    } else {
      out.push(name);
    }
  }
  return out;
}

export function workspacesFor(apps) {
  const workspaces = [];
  const seen = new Set();
  for (const app of apps) {
    for (const workspace of app.workspaces) {
      if (!seen.has(workspace)) {
        seen.add(workspace);
        workspaces.push(workspace);
      }
    }
  }
  return workspaces;
}

export function completionWords() {
  const words = new Set();
  for (const app of APPS) {
    words.add(app.id);
    for (const alias of app.aliases) {
      if (alias.startsWith("@")) continue;
      if (!alias.includes("/")) words.add(alias);
      else words.add(alias.split("/").slice(0, 2).join("/"));
    }
  }
  return [...words].sort();
}

function isExecutedDirectly() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(resolve(entry)).href;
  } catch {
    return false;
  }
}

if (isExecutedDirectly() && process.argv.includes("--complete")) {
  process.stdout.write(`${completionWords().join("\n")}\n`);
}
