import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildWaves,
  completionWords,
  expandFolders,
  resolveApps,
  workspacesFor,
} from "./apps.mjs";

test("folder path expands to member apps", () => {
  assert.deepEqual(
    resolveApps(expandFolders(["apps/rss"])).map((app) => app.id),
    ["rss-reader", "rss-api"],
  );
  assert.deepEqual(
    resolveApps(expandFolders(["apps/fitness"])).map((app) => app.id),
    ["fitness", "fitness-api"],
  );
  assert.deepEqual(
    resolveApps(expandFolders(["apps/user"])).map((app) => app.id),
    ["user-web", "user-api"],
  );
  assert.deepEqual(
    resolveApps(expandFolders(["apps/stock-game"])).map((app) => app.id),
    ["stock-game", "stock-game-api"],
  );
  assert.deepEqual(
    resolveApps(expandFolders(["apps/radio-station"])).map((app) => app.id),
    ["radio-station", "radio-api"],
  );
});

test("single-app names pass through untouched", () => {
  assert.deepEqual(expandFolders(["rss"]), ["rss"]);
  assert.deepEqual(expandFolders(["rss-api"]), ["rss-api"]);
  assert.deepEqual(expandFolders(["apps/baseball"]), ["apps/baseball"]);
  assert.deepEqual(expandFolders(["apps/stock-game/app"]), ["apps/stock-game/app"]);
  assert.deepEqual(
    resolveApps(expandFolders(["rss"])).map((app) => app.id),
    ["rss-reader"],
  );
  assert.deepEqual(
    resolveApps(["apps/stock-game/app"]).map((app) => app.id),
    ["stock-game"],
  );
});

test("unknown names still error", () => {
  assert.throws(() => resolveApps(expandFolders(["nope"])), /Unknown app/);
  assert.throws(() => resolveApps(expandFolders(["apps"])), /Unknown app/);
});

test("folder expansion feeds both services and workspaces", () => {
  const apps = resolveApps(expandFolders(["apps/rss"]));
  assert.deepEqual(
    apps.map((app) => app.service),
    ["rss-reader", "rss-api"],
  );
  assert.deepEqual(workspacesFor(apps), ["rss-reader", "rss-api"]);
});

test("completion includes folder shortcuts", () => {
  const words = completionWords();
  for (const folder of ["apps/rss", "apps/fitness", "apps/user", "apps/stock-game"]) {
    assert.ok(words.includes(folder), `missing completion for ${folder}`);
  }
});

test("buildWaves orders libraries before their apps", () => {
  const apps = resolveApps(["lemmy", "clipstack"]);
  assert.deepEqual(buildWaves(apps, []), [
    ["vertical-scroll-core"],
    ["lemmy-vertical-scroll", "clipstack"],
  ]);
});

test("buildWaves keeps single-workspace apps in wave zero", () => {
  const apps = resolveApps(["rss-reader", "rss-api"]);
  assert.deepEqual(buildWaves(apps, []), [["rss-reader", "rss-api"]]);
});

test("buildWaves puts raw names in a trailing wave", () => {
  assert.deepEqual(buildWaves([], ["foo", "bar"]), [["foo", "bar"]]);
  assert.deepEqual(buildWaves([], ["foo", "foo"]), [["foo"]]);
  assert.deepEqual(buildWaves([], []), []);
});
