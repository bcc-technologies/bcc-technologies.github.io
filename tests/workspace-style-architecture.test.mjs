import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("dashboard pages use scoped layered entrypoints", () => {
  const clientHtml = read("dashboard.html");
  const staffHtml = read("staff-dashboard.html");
  const developerHtml = read("maps-developer.html");
  const clientCss = read("css/pages/dashboard-client.css");
  const staffCss = read("css/pages/dashboard-staff.css");

  assert.match(clientHtml, /css\/pages\/dashboard-client\.css/);
  assert.match(staffHtml, /css\/pages\/dashboard-staff\.css/);
  assert.match(developerHtml, /css\/pages\/maps-developer\.css/);
  for (const html of [clientHtml, staffHtml, developerHtml]) {
    assert.doesNotMatch(html, /css\/pages\/dashboard\.css/);
  }
  assert.match(clientCss, /@layer[\s\S]+workspace\.features[\s\S]+workspace\.experience/);
  assert.match(staffCss, /@layer[\s\S]+workspace\.features[\s\S]+workspace\.experience/);
  assert.match(clientCss, /workspace-customer\.css/);
  assert.doesNotMatch(clientCss, /workspace-internal\.css|workspace-prospects\.css|workspace-intelligence-analytics\.css/);
  assert.match(staffCss, /workspace-internal\.css/);
  assert.doesNotMatch(staffCss, /workspace-customer\.css|workspace-prospects\.css|workspace-intelligence-analytics\.css/);
});

test("workspace resets the public fixed-header rule for semantic section headers", () => {
  const publicLayout = read("css/02-layout.css");
  const workspaceCore = read("css/workspace/workspace-core.css");
  const workspaceEntry = read("css/pages/dashboard-client.css");

  assert.match(publicLayout, /header\s*\{[\s\S]*position:\s*fixed/);
  assert.match(workspaceCore, /\.workspace-shell header\s*\{[\s\S]*position:\s*static;[\s\S]*inset:\s*auto;/);
  assert.ok(workspaceCore.indexOf(".workspace-shell header{") < workspaceCore.indexOf(".workspace-header{"));
  assert.ok(workspaceEntry.indexOf("workspace-core.css") < workspaceEntry.indexOf("workspace-components.css"));
});

test("feature style entrypoints join the declared feature layer", () => {
  const importManifests = ["admin.css", "forms.css", "intelligence.css", "operation.css", "prospects.css"];
  for (const manifest of importManifests) {
    const source = read(`css/workspace/features/${manifest}`);
    assert.match(source, /@import url\("[^"]+"\) layer\(workspace\.features\);/);
  }

  for (const entrypoint of ["client-licenses.css", "maps-licensing.css"]) {
    const source = read(`css/workspace/features/${entrypoint}`);
    assert.match(source, /@layer workspace\.features\s*\{/);
    assert.doesNotMatch(source, /@import/);
  }
});

test("workspace loader resolves styles before scripts and deduplicates shared styles", async () => {
  const appended = [];
  const links = [];
  const scripts = [];
  const createNode = tagName => {
    const listeners = {};
    return {
      tagName,
      dataset: {},
      addEventListener(name, callback) {
        listeners[name] = callback;
      },
      dispatch(name) {
        listeners[name]?.();
      }
    };
  };
  const document = {
    baseURI: "https://example.test/dashboard.html",
    scripts,
    querySelectorAll(selector) {
      return selector === 'link[rel="stylesheet"]' ? links : [];
    },
    createElement(tagName) {
      return createNode(tagName);
    },
    head: {
      append(node) {
        appended.push(node.tagName);
        if (node.tagName === "link") links.push(node);
        if (node.tagName === "script") scripts.push(node);
        queueMicrotask(() => node.dispatch("load"));
      }
    }
  };
  const window = {
    performance: { mark() {} },
    BCCWorkspaceEvents: { emit() {} }
  };
  vm.runInContext(
    read("js/workspace/loader.js"),
    vm.createContext({ window, document, URL, Promise, Map, Object, Array, queueMicrotask }),
    { filename: "loader.js" }
  );

  window.BCCWorkspaceLoader.register(
    { one: ["one.js"], two: ["two.js"] },
    {},
    { one: ["shared.css"], two: ["shared.css"] }
  );
  await window.BCCWorkspaceLoader.load("one");
  await window.BCCWorkspaceLoader.load("two");

  assert.deepEqual(appended, ["link", "script", "script"]);
  assert.equal(links.length, 1);
  assert.equal(links[0].dataset.workspaceFeatureStyle, "true");
});

test("feature registry declares styles for every visual feature and static intelligence views", () => {
  const registry = read("js/workspace/feature-registry.js");
  for (const feature of [
    "features/operation.css",
    "features/forms.css",
    "features/admin.css",
    "features/intelligence.css",
    "features/maps-licensing.css",
    "features/prospects.css",
    "features/client-licenses.css"
  ]) {
    assert.match(registry, new RegExp(feature.replace(".", "\\.")));
  }
  assert.match(registry, /id: "intelligence-static"[\s\S]+views:[\s\S]+business-radar[\s\S]+marketing-intelligence/);
  assert.match(registry, /loader\.register\(scripts, dependencies, styles\)/);
});


test("dashboard page headers stay semantic and unboxed", () => {
  const clientHtml = read("dashboard.html");
  const staffHtml = read("staff-dashboard.html");
  const clientMaps = read("js/workspace/client-map-licenses.js");
  const staffMaps = read("js/workspace/maps-licensing.js");
  const compositions = read("css/workspace/primitives/compositions.css");
  const legacyStyles = [
    read("css/workspace/workspace-customer.css"),
    read("css/workspace/workspace-internal.css"),
    read("css/workspace/features/client-licenses.css"),
    read("css/workspace/features/maps-licensing.css")
  ].join("\n");

  assert.match(compositions, /\.workspace-page-header\{/);
  assert.match(compositions, /\.workspace-page-header[\s\S]+border-bottom: 1px solid var\(--line\)/);
  assert.match(compositions, /@media \(max-width: 900px\)\{[\s\S]+\.workspace-page-header\{[\s\S]+flex-direction: column/);
  assert.match(clientHtml, /<header class="workspace-page-header">/);
  assert.match(staffHtml, /<header class="workspace-page-header">/);
  assert.match(clientMaps, /className: "workspace-page-header"/);
  assert.match(staffMaps, /className: "workspace-page-header"/);
  assert.doesNotMatch(clientHtml + staffHtml, /module-surface[^"\n]*(?:hero|intro)/);
  assert.doesNotMatch(clientMaps + staffMaps, /module-surface (?:client|maps)-license-hero/);
  assert.doesNotMatch(legacyStyles, /\.(?:staff-hub-hero|customer-record-hero|client-license-hero|maps-license-hero)/);
});
