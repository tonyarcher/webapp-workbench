/** Compose services and the npm workspaces that produce them. */

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
    id: "tiktok-scroll",
    service: "tiktok-scroll",
    workspaces: ["vertical-scroll-core", "clipstack"],
    aliases: ["tiktok-scroll", "tiktok", "clipstack", "apps/tiktok-scroll"],
    summary: "Clipstack — short-video list scroller (also builds vertical-scroll-core)",
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
