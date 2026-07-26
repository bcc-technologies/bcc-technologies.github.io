import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("dashboard bootstraps visual registries, modules and stable facades in dependency order", () => {
  for (const page of ["dashboard.html", "staff-dashboard.html"]) {
    const html = read(page);
    const order = [
      "workspace/events.js",
      "workspace/icons/registry.js",
      "workspace/icons/catalogs/core.js",
      "workspace/icons.js",
      "workspace/utils.js",
      "workspace/ui/registry.js",
      "workspace/ui/foundation.js",
      "workspace/ui/content.js",
      "workspace/ui/states.js",
      "workspace/ui/interactions.js",
      "workspace/ui.js",
      "workspace/loader.js"
    ].map(fragment => html.indexOf(fragment));

    assert.ok(order.every(index => index >= 0), `${page} must load every visual module`);
    assert.deepEqual(order, [...order].sort((a, b) => a - b));
  }
});

test("icon catalogs register without conflicts and cover audited dashboard names", () => {
  const window = {};
  const context = vm.createContext({ window, Map, Set, Object, TypeError, Error, String });
  vm.runInContext(read("js/workspace/icons/registry.js"), context);
  for (const catalog of ["core", "operations", "admin", "maps", "prospects"]) {
    vm.runInContext(read(`js/workspace/icons/catalogs/${catalog}.js`), context);
  }

  const available = new Set(window.BCCWorkspaceIconLibrary.iconNames());
  const workspaceModules = fs.readdirSync(new URL("../js/workspace/", import.meta.url))
    .filter(file => file.endsWith(".js"))
    .map(file => `js/workspace/${file}`);
  const auditedSources = [
    "dashboard.html",
    "staff-dashboard.html",
    ...workspaceModules
  ].map(read).join("\n");
  const declared = new Set([
    ...[...auditedSources.matchAll(/data-lucide=["']([a-z0-9-]+)["']/gi)].map(match => match[1]),
    ...[...auditedSources.matchAll(/\bicon:\s*["']([a-z0-9-]+)["']/gi)].map(match => match[1])
  ]);

  for (const name of declared) assert.ok(available.has(name), `missing registered icon: ${name}`);
  for (const name of ["circle-help", "triangle-alert", "circle-check", "search-x", "wifi-off"]) {
    assert.ok(available.has(name), `missing required state icon: ${name}`);
  }
  assert.deepEqual(
    Array.from(window.BCCWorkspaceIconLibrary.catalogNames()),
    ["core", "operations", "admin", "maps", "prospects"]
  );
});

test("feature registry loads domain icon catalogs before feature controllers", () => {
  const registry = read("js/workspace/feature-registry.js");
  const expected = [
    ["icons/catalogs/operations.js", "workspace/productivity.js"],
    ["icons/catalogs/admin.js", "workspace/admin-users.js"],
    ["icons/catalogs/maps.js", "workspace/maps-licensing.js"],
    ["icons/catalogs/prospects.js", "workspace/prospects.js"]
  ];
  for (const [catalog, controller] of expected) {
    assert.ok(registry.indexOf(catalog) < registry.indexOf(controller), `${catalog} must precede ${controller}`);
  }
});

test("public UI and CSS entrypoints are manifests rather than implementation monoliths", () => {
  const uiFacade = read("js/workspace/ui.js");
  const cssManifest = read("css/workspace/workspace-components.css");
  const account = read("css/workspace/workspace-account.css");
  const compositions = read("css/workspace/primitives/compositions.css");

  assert.match(uiFacade, /library\.compose/);
  assert.doesNotMatch(uiFacade, /function\s+(?:sectionHeader|dataState|bindTabs)/);
  for (const module of ["icons", "content", "states", "interactions", "layers", "compositions"]) {
    assert.match(cssManifest, new RegExp(`primitives/${module}\\.css`));
  }
  assert.match(account, /\.account-workspace-grid\{[\s\S]*?display: grid;/);
  assert.match(account, /\.account-trigger\{/);
  assert.doesNotMatch(compositions, /\.account-workspace-grid/);
});

test("administration and MAP controllers consume icon markup through the visual library", () => {
  for (const file of [
    "js/workspace/admin-users.js",
    "js/workspace/admin-roles.js",
    "js/workspace/maps-licensing.js",
    "js/workspace/client-map-licenses.js"
  ]) {
    const source = read(file);
    assert.doesNotMatch(source, /<i\s+data-lucide=/, `${file} contains raw icon markup`);
    assert.match(source, /ui\.(?:icon|action|sectionHeader|dataState|emptyState)/);
    if (/map-licenses|maps-licensing/.test(file)) assert.doesNotMatch(source, /style="width:/);
  }
});


test("operational controllers consume icon markup and empty states through the visual library", () => {
  for (const file of ["js/workspace/productivity.js", "js/workspace/calendar.js"]) {
    const source = read(file);
    assert.doesNotMatch(source, /<i\s+data-lucide=/, `${file} contains raw icon markup`);
    assert.match(source, /const ui = window\.BCCWorkspaceUI/);
    assert.match(source, /ui\.icon/);
  }
  assert.match(read("js/workspace/productivity.js"), /ui\.emptyState/);
});


test("forms and prospects consume icon markup through the visual library", () => {
  for (const file of [
    "js/workspace/forms.js",
    "js/workspace/prospects.js",
    "js/workspace/prospects.layout.js"
  ]) {
    const source = read(file);
    assert.doesNotMatch(source, /<i\s+data-lucide=/, `${file} contains raw icon markup`);
    assert.match(source, /const ui = window\.BCCWorkspaceUI/);
  }
});
