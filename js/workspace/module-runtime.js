/* Uniform lifecycle runtime for lazily mounted workspace modules. */
(() => {
  const mounted = new WeakMap();
  const tearingDown = new WeakMap();

  function contextFor(root, context = {}, controller = null) {
    return Object.freeze({
      ...context,
      root,
      controller,
      signal: controller?.signal
    });
  }

  async function mount(options = {}) {
    const { root, module, id = "workspace-module", context = {} } = options;
    if (!root || !module) return null;

    const pendingTeardown = tearingDown.get(root);
    if (pendingTeardown) await pendingTeardown;
    const current = mounted.get(root);
    if (current?.module === module) {
      await current.ready;
      if (current.abortController.signal.aborted || mounted.get(root) !== current) return null;
      const nextContext = contextFor(root, context, current.abortController);
      await (options.activate || module.activate)?.(nextContext);
      current.context = nextContext;
      return current;
    }

    if (current) await unmount(root);
    const abortController = new AbortController();
    const moduleContext = contextFor(root, context, abortController);
    const initialize = options.initialize || module.init;
    if (typeof initialize !== "function") {
      abortController.abort();
      throw new Error(`El módulo ${id} no expuso un inicializador.`);
    }

    const instance = {
      id,
      root,
      module,
      abortController,
      context: moduleContext,
      value: null,
      ready: null
    };
    mounted.set(root, instance);
    instance.ready = (async () => {
      instance.value = await initialize(moduleContext);
      if (abortController.signal.aborted || mounted.get(root) !== instance) return instance;
      window.BCCWorkspaceI18n?.localizeTree?.(root);
      root.dataset.workspaceModuleReady = "true";
      root.dataset.workspaceModuleId = id;
      return instance;
    })();

    try {
      return await instance.ready;
    } catch (error) {
      abortController.abort();
      if (mounted.get(root) === instance) mounted.delete(root);
      delete root.dataset.workspaceModuleReady;
      delete root.dataset.workspaceModuleId;
      throw error;
    }
  }

  async function unmount(root) {
    const instance = root ? mounted.get(root) : null;
    if (!instance) {
      await tearingDown.get(root);
      return false;
    }
    instance.abortController.abort();
    if (mounted.get(root) === instance) mounted.delete(root);
    const teardown = (async () => {
      try {
        await instance.ready;
      } catch (error) {
        // Initialization failures are already surfaced by mount; teardown still runs.
      }
      const destroy = instance.value?.destroy || instance.module?.destroy;
      if (typeof destroy === "function") await destroy(instance.context);
      delete root.dataset.workspaceModuleReady;
      delete root.dataset.workspaceModuleId;
      return true;
    })();
    tearingDown.set(root, teardown);
    try {
      return await teardown;
    } finally {
      if (tearingDown.get(root) === teardown) tearingDown.delete(root);
    }
  }

  function instanceFor(root) {
    return root ? mounted.get(root) || null : null;
  }

  window.BCCWorkspaceModuleRuntime = Object.freeze({ mount, unmount, instanceFor });
})();
