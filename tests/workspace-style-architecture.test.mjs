import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { WORKSPACE_DASHBOARD_ASSETS } from "../scripts/workspace-assets.manifest.mjs";

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("dashboard pages use scoped layered entrypoints", () => {
  const clientHtml = read("dashboard.html");
  const staffHtml = read("staff-dashboard.html");
  const developerHtml = read("maps-developer.html");
  const clientCss = read("css/pages/dashboard-client.css");
  const staffCss = read("css/pages/dashboard-staff.css");

  assert.match(clientHtml, new RegExp(`${WORKSPACE_DASHBOARD_ASSETS.client.cssFile.replaceAll("/", "\\/").replaceAll(".", "\\.")}\\?v=[a-f0-9]{16}`));
  assert.match(staffHtml, new RegExp(`${WORKSPACE_DASHBOARD_ASSETS.staff.cssFile.replaceAll("/", "\\/").replaceAll(".", "\\.")}\\?v=[a-f0-9]{16}`));
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
  for (const dashboard of Object.values(WORKSPACE_DASHBOARD_ASSETS)) {
    const compiled = read(dashboard.cssFile);
    assert.doesNotMatch(compiled, /@import/);
    assert.match(compiled, /@layer bcc\.tokens/);
  }
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

test("workspace loader starts ordered feature scripts together without relaxing execution order", async () => {
  const source = read("js/workspace/loader.js");
  const scripts = [];
  const pending = [];
  const createNode = tagName => {
    const listeners = {};
    return {
      tagName,
      dataset: {},
      addEventListener(name, callback) { listeners[name] = callback; },
      dispatch(name) { listeners[name]?.(); }
    };
  };
  const document = {
    baseURI: "https://example.test/dashboard.html",
    scripts,
    querySelectorAll() { return []; },
    createElement: createNode,
    head: {
      append(node) {
        scripts.push(node);
        pending.push(node);
      }
    }
  };
  const window = {
    performance: { mark() {} },
    BCCWorkspaceEvents: { emit() {} }
  };
  vm.runInContext(source, vm.createContext({ window, document, URL, Promise, Map, Object, Array }), { filename: "loader.js" });
  window.BCCWorkspaceLoader.register({ sample: ["first.js", "second.js", "third.js"] });

  const loading = window.BCCWorkspaceLoader.load("sample");
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(pending.length, 3);
  assert.ok(pending.every(script => script.async === false));
  pending.forEach(script => script.dispatch("load"));
  await loading;
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

test("client account views reserve cards for activity and records, not page structure", () => {
  const clientHtml = read("dashboard.html");
  const staffHtml = read("staff-dashboard.html");
  const accountStyles = read("css/workspace/workspace-account.css");
  const accountScript = read("js/workspace/account.js");
  const compositions = read("css/workspace/primitives/compositions.css");
  const view = (id, nextId) => clientHtml.match(new RegExp(
    `<section class="workspace-view" id="${id}"[\\s\\S]*?(?=<section class="workspace-view" id="${nextId}")`
  ))?.[0] || "";
  const overview = view("resumen", "licencias");
  const account = view("cuenta", "operacion");
  const operation = view("operacion", "comercial");
  const commercial = clientHtml.match(/<section class="workspace-view" id="comercial"[\s\S]*?<\/main>/)?.[0] || "";

  assert.equal((overview.match(/module-surface/g) || []).length, 0);
  assert.match(overview, /class="client-briefing"/);
  assert.match(overview, /class="client-service-lane"/);
  assert.match(overview, /class="client-account-brief"/);
  assert.match(overview, /class="client-support-inline"/);
  assert.match(account, /class="account-settings-workspace"/);
  assert.match(account, /workspace-section-index/);
  assert.match(account, /account-email-disclosure/);
  assert.match(account, /data-email-confirmation/);
  assert.doesNotMatch(account, /account-permission-disclosure|Capacidades activas|data-permissions/);
  assert.match(staffHtml, /<h2>Permisos activos<\/h2>[\s\S]*?data-permissions/);
  assert.doesNotMatch(account, /Sesión protegida/);
  assert.doesNotMatch(account, /module-surface/);
  assert.equal((operation.match(/module-surface/g) || []).length, 0);
  assert.match(operation, /class="client-operation-board"/);
  assert.match(operation, /class="[^"]*client-requirements-flow"/);
  assert.equal((commercial.match(/module-surface/g) || []).length, 0);
  assert.match(commercial, /class="workspace-ledger commercial-ledger"/);
  assert.match(commercial, /class="commercial-context-block"/);
  assert.match(accountStyles, /\.account-settings-section\{[\s\S]+border-top: 1px solid var\(--line\)/);
  assert.match(accountStyles, /\.account-email-disclosure\{/);
  assert.doesNotMatch(accountStyles, /account-permission-disclosure/);
  assert.match(accountStyles, /\.profile-form \.btn:disabled/);
  assert.match(accountStyles, /\.account-email-row\.is-primary/);
  assert.match(accountStyles, /\.account-profile-section \.profile-form/);
  assert.match(accountScript, /item\.primary && "is-primary"/);
  assert.match(compositions, /\.workspace-ledger\{/);
});

test("client operation is an assigned-form inbox, not a form-management surface", () => {
  const clientHtml = read("dashboard.html");
  const registry = read("js/workspace/feature-registry.js");
  const inbox = read("js/workspace/forms-inbox.js");
  const customerStyles = read("css/workspace/workspace-customer.css");
  const staffForms = read("js/workspace/forms.js");
  const workspaceApi = read("js/auth-workspace-api.js");
  const migration = read("supabase/migrations/20260728060000_client_form_delivery.sql");
  const operation = clientHtml.match(/<section class="workspace-view" id="operacion"[\s\S]*?(?=<section class="workspace-view" id="comercial")/)?.[0] || "";

  assert.match(operation, /data-client-form-inbox/);
  assert.doesNotMatch(operation, /data-forms-workspace|Crear solicitud/);
  assert.match(registry, /id: "form-inbox"[\s\S]+forms-inbox\.js[\s\S]+data-client-form-inbox/);
  assert.doesNotMatch(inbox, /repository\.(?:create|update|listResponses)/);
  assert.match(inbox, /repository\.listReceived/);
  assert.match(inbox, /form-inbox-eyebrow/);
  assert.match(inbox, /inbox-form-sequence/);
  assert.match(customerStyles, /\.customer-workspace \.form-inbox--received\{/);
  assert.match(customerStyles, /--form-inbox-gutter: clamp\(22px, 2\.6vw, 30px\)/);
  assert.match(customerStyles, /--form-inbox-gutter-start: calc\(var\(--form-inbox-gutter\) \+ 3px\)/);
  assert.match(customerStyles, /\.customer-workspace \.inbox-form-sequence\{/);
  assert.match(staffForms, /repository\.listRecipients/);
  assert.match(workspaceApi, /\/api\/workspace\/forms\/received/);
  assert.match(migration, /recipient_ids uuid\[\]/);
  assert.match(migration, /create or replace function private\.can_manage_workspace_forms/);
  assert.match(migration, /grant execute on function private\.can_manage_workspace_forms\(\) to authenticated/);
  assert.match(migration, /Recipients read delivered workspace forms/);
  assert.match(migration, /Recipients submit delivered workspace forms/);
});

test("page descriptions stay available as discreet title disclosures", () => {
  const clientHtml = read("dashboard.html");
  const staffHtml = read("staff-dashboard.html");
  const compositions = read("css/workspace/primitives/compositions.css");
  const content = read("js/workspace/ui/content.js");
  const clientMaps = read("js/workspace/client-map-licenses.js");
  const staffMaps = read("js/workspace/maps-licensing.js");

  assert.match(clientHtml, /<details class="workspace-context">[\s\S]*?<summary><h1>Cuenta<\/h1>/);
  assert.match(staffHtml, /<details class="workspace-context">[\s\S]*?<summary><h1>Operación<\/h1>/);
  assert.match(compositions, /\.workspace-context > summary\{/);
  assert.match(compositions, /\.workspace-context > summary h1::after/);
  assert.doesNotMatch(clientHtml + staffHtml + content, /workspace-context-label/);
  assert.match(content, /collapsibleDescription = false/);
  assert.match(clientMaps, /collapsibleDescription: true/);
  assert.match(staffMaps, /collapsibleDescription: true/);
});
