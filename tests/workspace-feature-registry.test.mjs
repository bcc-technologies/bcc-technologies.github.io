import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../js/workspace/feature-registry.js", import.meta.url), "utf8");

function loadRegistry(overrides = {}, documentOverride = null) {
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
    BCCAccessContracts: {
      canAccess(user, permission) {
        return !permission || user?.role === "admin" || user?.permissions?.includes(permission);
      }
    },
    BCCWorkspaceModuleRuntime: {
      async mount({ id, root, module, context, initialize }) {
        if (root.dataset.workspaceModuleReady === "true") {
          await module.activate?.(context);
          return;
        }
        await initialize({ ...context, root, signal: new AbortController().signal });
        root.dataset.workspaceModuleReady = "true";
        root.dataset.workspaceModuleId = id;
      }
    },
    ...overrides
  };
  const document = documentOverride || { querySelector: () => null };
  vm.runInContext(source, vm.createContext({ window, document, console, AbortController }), { filename: "feature-registry.js" });
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
  vm.runInContext(source, vm.createContext({ window: localWindow, document: contextDocument, console, AbortController }), { filename: "feature-registry.js" });
  await localWindow.BCCWorkspaceFeatureRegistry.initialize("client", "licenses", { user: { id: "user-1", permissions: ["dashboard:view"] } });
  await localWindow.BCCWorkspaceFeatureRegistry.initialize("client", "licenses", { user: { id: "user-1", permissions: ["dashboard:view"] } });

  assert.equal(initCount, 1);
  assert.equal(root.dataset.workspaceModuleReady, "true");
});


test("feature transitions mount compound operation roots and unmount inactive modules", async () => {
  const roots = {
    "[data-productivity-workspace]": { dataset: {} },
    "[data-calendar-workspace]": { dataset: {} },
    "[data-forms-workspace]": { dataset: {} }
  };
  const mounted = [];
  const unmounted = [];
  const runtime = {
    async mount({ id, root, module, initialize, context }) {
      mounted.push(id);
      await initialize({ ...context, root, signal: new AbortController().signal });
      root.mountedModule = module;
    },
    async unmount(root) {
      if (!root.mountedModule) return false;
      unmounted.push(root.mountedModule.name);
      root.mountedModule = null;
      return true;
    }
  };
  const modules = {
    BCCWorkspaceProductivity: { name: "tasks", init() {} },
    BCCWorkspaceCalendar: { name: "calendar", init() {} },
    BCCWorkspaceForms: { name: "forms", init() {} }
  };
  const { registry } = loadRegistry(
    { ...modules, BCCWorkspaceModuleRuntime: runtime },
    { querySelector: selector => roots[selector] || null }
  );
  const user = { id: "staff-1", role: "staff", permissions: [] };

  await registry.transition("staff", ["operation", "forms"], { user, viewId: "trabajo", panelId: "formularios" });
  assert.deepEqual(mounted, ["operation:tasks", "operation:calendar", "forms:forms"]);

  await registry.transition("staff", [], { user, viewId: "perfil" });
  assert.deepEqual(unmounted, ["forms", "calendar", "tasks"]);
});

test("operational modules expose lifecycle hooks and pass signals to repositories", () => {
  const productivity = fs.readFileSync(new URL("../js/workspace/productivity.js", import.meta.url), "utf8");
  const calendar = fs.readFileSync(new URL("../js/workspace/calendar.js", import.meta.url), "utf8");
  const forms = fs.readFileSync(new URL("../js/workspace/forms.js", import.meta.url), "utf8");

  for (const source of [productivity, calendar, forms]) {
    assert.match(source, /function activate\(context = \{\}\)/);
    assert.match(source, /function destroy\(\)/);
    assert.match(source, /requestOptions\(signal/);
    assert.match(source, /error\?\.code === "cancelled"/);
  }
});


test("a stale compound transition cannot mount its remaining roots", async () => {
  const roots = {
    "[data-productivity-workspace]": { dataset: {} },
    "[data-calendar-workspace]": { dataset: {} }
  };
  const mounted = [];
  let releaseTasks = null;
  let markTasksStarted = null;
  const tasksReady = new Promise(resolve => { releaseTasks = resolve; });
  const tasksStarted = new Promise(resolve => { markTasksStarted = resolve; });
  const runtime = {
    async mount({ id }) {
      mounted.push(id);
      if (id === "operation:tasks") {
        markTasksStarted();
        await tasksReady;
      }
    },
    async unmount() {
      return true;
    }
  };
  const { registry } = loadRegistry(
    {
      BCCWorkspaceModuleRuntime: runtime,
      BCCWorkspaceProductivity: { init() {} },
      BCCWorkspaceCalendar: { init() {} }
    },
    { querySelector: selector => roots[selector] || null }
  );
  const user = { id: "staff-1", role: "staff", permissions: [] };

  const stale = registry.transition("staff", ["operation"], { user, viewId: "trabajo" });
  await tasksStarted;
  const latest = registry.transition("staff", [], { user, viewId: "perfil" });
  releaseTasks();
  await Promise.all([stale, latest]);

  assert.deepEqual(mounted, ["operation:tasks"]);
});
