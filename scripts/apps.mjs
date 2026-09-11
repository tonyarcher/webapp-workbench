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
    aliases: ["rss-reader", "rss", "apps/rss-reader"],
    summary: "RSS reader (static SPA)",
  },
  {
    id: "rss-api",
    service: "rss-api",
    workspaces: ["rss-reader"],
    aliases: ["rss-api", "api", "apps/rss-reader/server"],
    summary: "RSS reader API + feed poller",
  },
  {
    id: "stock-game",
    service: "stock-game",
    workspaces: ["@stock-game/app"],
    aliases: ["stock-game", "stock", "@stock-game/app", "apps/stock-game"],
    summary: "Stock game",
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
    aliases: ["clipstack", "tiktok-scroll", "tiktok", "apps/clipstack", "apps/tiktok-scroll"],
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
    aliases: ["fitness", "apps/fitness"],
    summary: "Fitness tracker (also builds fitness-core)",
  },
  {
    id: "fitness-api",
    service: "fitness-api",
    workspaces: ["fitness-core", "fitness"],
    aliases: ["fitness-api", "apps/fitness/server"],
    summary: "Fitness API + ingest",
  },
  {
    id: "user-web",
    service: "user-web",
    workspaces: ["user-web"],
    aliases: ["user-web", "auth", "accounts", "apps/user-web"],
    summary: "Accounts landing page (static SPA)",
  },
  {
    id: "user-api",
    service: "user-api",
    workspaces: ["user-api"],
    aliases: ["user-api", "apps/user-api"],
    summary: "Identity API (Kotlin / Ktor)",
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
      if (!alias.includes("/")) words.add(alias);
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
