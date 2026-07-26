/* Named and normalized workspace event contracts. */
(() => {
  const CONTRACTS = Object.freeze({
    iconsReady: Object.freeze({ name: "bcc:workspace-icons-ready", normalize: () => ({}) }),
    navigationReady: Object.freeze({ name: "bcc:workspace-navigation-ready", normalize: () => ({}) }),
    featureReady: Object.freeze({
      name: "bcc:workspace-feature-ready",
      normalize: detail => ({ featureId: String(detail?.featureId || "") })
    }),
    workspaceReady: Object.freeze({
      name: "bcc:workspace-ready",
      normalize: detail => ({
        scope: String(detail?.scope || ""),
        viewId: String(detail?.viewId || "")
      })
    }),
    tasksChanged: Object.freeze({
      name: "bcc:workspace-tasks",
      normalize: detail => ({
        tasks: Array.isArray(detail?.tasks) ? detail.tasks : [],
        loaded: Boolean(detail?.loaded)
      })
    }),
    eventsChanged: Object.freeze({
      name: "bcc:workspace-events",
      normalize: detail => ({
        events: Array.isArray(detail?.events) ? detail.events : [],
        loaded: Boolean(detail?.loaded)
      })
    })
  });

  const resolve = contract => {
    const value = typeof contract === "string" ? CONTRACTS[contract] : contract;
    if (!value?.name || typeof value.normalize !== "function") {
      throw new Error(`Contrato de evento desconocido: ${String(contract || "")}`);
    }
    return value;
  };

  function emit(contract, detail = {}, options = {}) {
    const definition = resolve(contract);
    const target = options.target || document;
    const normalized = definition.normalize(detail);
    target.dispatchEvent(new CustomEvent(definition.name, { detail: normalized }));
    return normalized;
  }

  function subscribe(contract, listener, options = {}) {
    const definition = resolve(contract);
    const target = options.target || document;
    const handler = event => listener(definition.normalize(event.detail), event);
    target.addEventListener(definition.name, handler, options.signal ? { signal: options.signal } : undefined);
    return () => target.removeEventListener(definition.name, handler);
  }

  window.BCCWorkspaceEvents = Object.freeze({ contracts: CONTRACTS, emit, subscribe });
})();
