/* Registry for independently-owned workspace icon catalogs. */
(() => {
  const icons = new Map();
  const catalogs = new Map();

  function registerCatalog(name, definitions) {
    const catalogName = String(name || "").trim();
    if (!catalogName || !definitions || typeof definitions !== "object") {
      throw new TypeError("Icon catalogs require a name and a definitions object.");
    }
    if (catalogs.has(catalogName)) throw new Error(`Icon catalog "${catalogName}" is already registered.`);
    const names = [];
    Object.entries(definitions).forEach(([iconName, pathMarkup]) => {
      if (!/^[a-z0-9-]+$/i.test(iconName) || typeof pathMarkup !== "string") {
        throw new TypeError(`Invalid icon definition in catalog "${catalogName}".`);
      }
      const existing = icons.get(iconName);
      if (existing && existing.pathMarkup !== pathMarkup) {
        throw new Error(`Icon "${iconName}" has conflicting definitions.`);
      }
      icons.set(iconName, Object.freeze({ catalog: catalogName, pathMarkup }));
      names.push(iconName);
    });
    catalogs.set(catalogName, Object.freeze(names));
    return catalogs.get(catalogName);
  }

  function resolve(name) {
    return icons.get(name)?.pathMarkup || null;
  }

  window.BCCWorkspaceIconLibrary = Object.freeze({
    registerCatalog,
    resolve,
    has: name => icons.has(name),
    catalogNames: () => Object.freeze([...catalogs.keys()]),
    iconNames: () => Object.freeze([...icons.keys()])
  });
})();
