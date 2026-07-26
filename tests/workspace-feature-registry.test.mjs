import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../js/workspace/feature-registry.js", import.meta.url), "utf8");

function loadRegistry(overrides = {}) {
  const registered = [];
  const loaded = [];
  const window = {
    BCCWorkspaceLoader: {
      register(features, dependencies) {
        registered.push({ features, dependencies });
      },
      async load(featureId) {
        loaded.push(featureId);
      }
    },
    BCCWorkspaceUtils: { refreshIcons() {} },
    ...overrides
  };
  const document = { querySelector: () => null };
  vm.runInContext(source, vm.createContext({ window, document, console }), { filename: "feature-registry.js" });
  return { registry: window.BCCWorkspaceFeatureRegistry, registered, loaded, window };
}

test("feature registry derives loader definitions and view mappings from one contract", () => {
  const { registry, registered } = loadRegistry();
  registry.register("staff");

  assert.equal(registered.length, 1);
  assert.ok(registered[0].features["maps-licensing"].includes("js/workspace/map-repository.js"));
  assert.deepEqual(Array.from(registered[0].dependencies.forms), ["operation"]);
  assert.equal(registry.featureForView("staff", "maps-licensing").id, "maps-licensing");
  assert.equal(registry.featureForView("client", "licencias").id, "licenses");
});

test("feature registry loads and mounts a default feature exactly once", async () => {
  let initCount = 0;
  const root = { dataset: {}, querySelectorAll: () => [] };
  const { registry, loaded, window } = loadRegistry({
    BCCWorkspaceClientMapLicenses: { init() { initCount += 1; } }
  });
  const contextDocument = { querySelector: () => root };

  // Re-evaluate with a mounted root because vm globals are isolated.
  const registered = [];
  const localWindow = {
    ...window,
    BCCWorkspaceLoader: {
      register(features, dependencies) { registered.push({ features, dependencies }); },
      async load(featureId) { loaded.push(featureId); }
    }
  };
  vm.runInContext(source, vm.createContext({ window: localWindow, document: contextDocument, console }), { filename: "feature-registry.js" });
  await localWindow.BCCWorkspaceFeatureRegistry.initialize("client", "licenses", { user: { id: "user-1", permissions: ["dashboard:view"] } });
  await localWindow.BCCWorkspaceFeatureRegistry.initialize("client", "licenses", { user: { id: "user-1", permissions: ["dashboard:view"] } });

  assert.equal(initCount, 1);
  assert.equal(root.dataset.workspaceModuleReady, "true");
});
