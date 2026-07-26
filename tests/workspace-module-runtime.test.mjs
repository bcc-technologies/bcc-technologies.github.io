import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../js/workspace/module-runtime.js", import.meta.url), "utf8");

function loadRuntime() {
  const window = {};
  vm.runInContext(source, vm.createContext({ window, AbortController, Object, Error }));
  return window.BCCWorkspaceModuleRuntime;
}

test("module runtime initializes once and activates subsequent contexts", async () => {
  const runtime = loadRuntime();
  const root = { dataset: {} };
  const calls = [];
  const module = {
    init(context) {
      calls.push(["init", context.panelId, context.root === root, context.signal.aborted]);
    },
    activate(context) {
      calls.push(["activate", context.panelId, context.root === root, context.signal.aborted]);
    }
  };

  await runtime.mount({ id: "sample", root, module, context: { panelId: "one" } });
  await runtime.mount({ id: "sample", root, module, context: { panelId: "two" } });

  assert.deepEqual(calls, [
    ["init", "one", true, false],
    ["activate", "two", true, false]
  ]);
  assert.equal(root.dataset.workspaceModuleReady, "true");
  assert.equal(root.dataset.workspaceModuleId, "sample");
});

test("module runtime aborts module work and calls destroy during unmount", async () => {
  const runtime = loadRuntime();
  const root = { dataset: {} };
  let signal = null;
  let destroyed = false;
  const module = {
    init(context) {
      signal = context.signal;
      return { destroy() { destroyed = true; } };
    }
  };

  await runtime.mount({ id: "disposable", root, module });
  assert.equal(signal.aborted, false);
  assert.equal(await runtime.unmount(root), true);
  assert.equal(signal.aborted, true);
  assert.equal(destroyed, true);
  assert.equal(root.dataset.workspaceModuleReady, undefined);
  assert.equal(runtime.instanceFor(root), null);
});

test("failed initialization is aborted and does not leave a mounted instance", async () => {
  const runtime = loadRuntime();
  const root = { dataset: {} };
  let signal = null;

  await assert.rejects(
    runtime.mount({
      id: "broken",
      root,
      module: {
        init(context) {
          signal = context.signal;
          throw new Error("broken");
        }
      }
    }),
    /broken/
  );

  assert.equal(signal.aborted, true);
  assert.equal(runtime.instanceFor(root), null);
});


test("in-flight initialization is aborted and fully torn down before remount", async () => {
  const runtime = loadRuntime();
  const root = { dataset: {} };
  const calls = [];
  let firstSignal = null;

  const firstModule = {
    init(context) {
      firstSignal = context.signal;
      calls.push("first:init");
      return new Promise(resolve => {
        context.signal.addEventListener("abort", () => {
          calls.push("first:abort");
          resolve();
        }, { once: true });
      });
    },
    destroy() {
      calls.push("first:destroy");
    }
  };
  const secondModule = {
    init() {
      calls.push("second:init");
    }
  };

  const firstMount = runtime.mount({ id: "first", root, module: firstModule });
  await Promise.resolve();
  const teardown = runtime.unmount(root);
  const secondMount = runtime.mount({ id: "second", root, module: secondModule });
  await Promise.all([firstMount, teardown, secondMount]);

  assert.equal(firstSignal.aborted, true);
  assert.deepEqual(calls, ["first:init", "first:abort", "first:destroy", "second:init"]);
  assert.equal(runtime.instanceFor(root).module, secondModule);
  assert.equal(root.dataset.workspaceModuleId, "second");
});
