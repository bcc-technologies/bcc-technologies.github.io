import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { WORKSPACE_DASHBOARD_ASSETS } from "../scripts/workspace-assets.manifest.mjs";

const rootUrl = new URL("../", import.meta.url);
const read = path => fs.readFileSync(new URL(path, rootUrl), "utf8");
const manifest = JSON.parse(read("shared/access-contracts.json"));

function browserContracts() {
  const window = {};
  vm.runInContext(read("js/access-contracts.js"), vm.createContext({ window, Object, Number }));
  return window.BCCAccessContracts;
}

test("browser access artifact is generated from the canonical manifest", () => {
  const result = spawnSync(process.execPath, ["scripts/render-access-contracts.mjs", "--check"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  const contracts = browserContracts();
  assert.equal(contracts.manifest.version, manifest.version);
  assert.deepEqual(
    Array.from(contracts.STAFF_ROLE_PERMISSIONS.maps_license_manager),
    manifest.staffRoles.maps_license_manager.permissions
  );
  assert.equal(contracts.ROLE_LABELS.maps_product_analyst, "Analista de producto MAP");
  assert.equal(contracts.ROLE_LABELS.maps_developer, "Desarrollador MAPs");
  assert.equal(contracts.STAFF_ROLE_OPTIONS.find(item => item.value === "maps_developer").label, "Desarrollador MAP");
});

test("auth, workspace utilities and local server consume the canonical access contract", () => {
  const auth = read("js/auth.js");
  const utils = read("js/workspace/utils.js");
  const server = read("accounts-server.mjs");

  assert.match(auth, /const ACCESS_CONTRACTS = window\.BCCAccessContracts/);
  assert.doesNotMatch(auth, /const ROLE_PERMISSIONS = \{/);
  assert.match(utils, /WORKSPACE_PERMISSION_LABELS: PERMISSION_LABELS/);
  assert.match(server, /accessManifest from "\.\/shared\/access-contracts\.json"/);
  assert.doesNotMatch(server, /const STAFF_ROLE_PERMISSIONS = \{/);
});

test("every page loads access contracts before auth", () => {
  const pages = [
    "auth-callback.html",
    "dashboard.html",
    "forgot-password.html",
    "login.html",
    "reset-password.html",
    "signup.html",
    "staff-dashboard.html",
    "maps-developer.html",
    "en/login.html",
    "en/signup.html",
    "admin-local/public/index.html"
  ];

  const workspacePages = new Map(Object.values(WORKSPACE_DASHBOARD_ASSETS).map(dashboard => [dashboard.page, dashboard]));
  pages.forEach(path => {
    const html = read(path);
    const dashboard = workspacePages.get(path);
    if (dashboard) {
      const bundle = read(dashboard.scriptFile);
      assert.match(html, new RegExp(`${dashboard.scriptFile.replaceAll("/", "\\/").replaceAll(".", "\\.")}\\?v=[a-f0-9]{16}`));
      assert.ok(bundle.indexOf("/* Source: js/access-contracts.js */") < bundle.indexOf("/* Source: js/auth.js */"));
      return;
    }
    const contractsIndex = html.indexOf("access-contracts.js");
    const authIndex = html.indexOf("auth.js");
    assert.ok(contractsIndex >= 0, `${path} debe cargar access-contracts.js`);
    assert.ok(contractsIndex < authIndex, `${path} debe cargar contratos antes de auth.js`);
  });
});

test("workspace bootstrap loads contracts and lifecycle services before their consumers", () => {
  for (const dashboard of Object.values(WORKSPACE_DASHBOARD_ASSETS)) {
    const bundle = read(dashboard.scriptFile);
    const sourceIndex = source => bundle.indexOf(`/* Source: ${source} */`);
    assert.ok(sourceIndex("js/access-contracts.js") < sourceIndex("js/workspace/utils.js"));
    assert.ok(sourceIndex("js/workspace/events.js") < sourceIndex("js/workspace/icons.js"));
    assert.ok(sourceIndex("js/workspace/module-runtime.js") < sourceIndex("js/workspace/feature-registry.js"));
  }
});

test("capability checks consume effective permissions without deriving server authority", () => {
  const contracts = browserContracts();
  assert.equal(contracts.canAccess({ role: "admin", permissions: [] }, "users:manage"), true);
  assert.equal(contracts.canAccess({ role: "staff", permissions: ["platform.licenses.read"] }, "platform.licenses.read"), true);
  assert.equal(contracts.canAccess({ role: "staff", permissions: [] }, "platform.licenses.read"), false);
});
