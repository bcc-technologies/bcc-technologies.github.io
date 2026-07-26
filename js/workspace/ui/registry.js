/* Internal module registry for the workspace visual library. */
(() => {
  const modules = new Map();

  function register(name, contract) {
    const key = String(name || "").trim();
    if (!key || !contract || typeof contract !== "object") {
      throw new TypeError("Workspace UI modules require a name and an object contract.");
    }
    if (modules.has(key)) throw new Error(`Workspace UI module "${key}" is already registered.`);
    modules.set(key, Object.freeze({ ...contract }));
    return modules.get(key);
  }

  function get(name) {
    return modules.get(name) || null;
  }

  function requireModules(names) {
    return Object.fromEntries(names.map(name => {
      const contract = get(name);
      if (!contract) throw new Error(`Workspace UI module "${name}" is not registered.`);
      return [name, contract];
    }));
  }

  function compose(names) {
    return Object.freeze(Object.assign({}, ...names.map(name => {
      const contract = get(name);
      if (!contract) throw new Error(`Workspace UI module "${name}" is not registered.`);
      return contract;
    })));
  }

  window.BCCWorkspaceUILibrary = Object.freeze({
    register,
    get,
    require: requireModules,
    compose,
    moduleNames: () => Object.freeze([...modules.keys()])
  });
})();
