/* Shared, dependency-aware loader for workspace features. */
(() => {
  const features = new Map();
  const dependencies = new Map();
  const styles = new Map();
  const scriptPromises = new Map();
  const stylePromises = new Map();
  const featurePromises = new Map();

  function register(definitions = {}, dependencyDefinitions = {}, styleDefinitions = {}) {
    Object.entries(definitions).forEach(([featureId, sources]) => {
      features.set(featureId, Array.isArray(sources) ? [...sources] : []);
    });
    Object.entries(dependencyDefinitions).forEach(([featureId, featureDependencies]) => {
      dependencies.set(featureId, Array.isArray(featureDependencies) ? [...featureDependencies] : []);
    });
    Object.entries(styleDefinitions).forEach(([featureId, sources]) => {
      styles.set(featureId, Array.isArray(sources) ? [...sources] : []);
    });
  }

  function loadStyle(source) {
    if (stylePromises.has(source)) return stylePromises.get(source);
    const absoluteSource = new URL(source, document.baseURI).href;
    const existing = [...document.querySelectorAll('link[rel="stylesheet"]')]
      .find(link => link.href === absoluteSource);
    if (existing?.sheet || existing?.dataset.workspaceLoaded === "true") return Promise.resolve(existing);

    const promise = new Promise((resolve, reject) => {
      const link = existing || document.createElement("link");
      const onLoad = () => {
        link.dataset.workspaceLoaded = "true";
        resolve(link);
      };
      const onError = () => reject(new Error(`No se pudo cargar ${source}.`));
      link.addEventListener("load", onLoad, { once: true });
      link.addEventListener("error", onError, { once: true });
      if (!existing) {
        link.rel = "stylesheet";
        link.href = source;
        link.dataset.workspaceFeatureStyle = "true";
        document.head.append(link);
      }
    });
    stylePromises.set(source, promise);
    void promise.catch(() => stylePromises.delete(source));
    return promise;
  }

  function loadScript(source) {
    if (scriptPromises.has(source)) return scriptPromises.get(source);
    const absoluteSource = new URL(source, document.baseURI).href;
    const existing = [...document.scripts].find(script => script.src === absoluteSource);
    if (existing?.dataset.workspaceLoaded === "true") return Promise.resolve(existing);

    const promise = new Promise((resolve, reject) => {
      const script = existing || document.createElement("script");
      const onLoad = () => {
        script.dataset.workspaceLoaded = "true";
        resolve(script);
      };
      const onError = () => reject(new Error(`No se pudo cargar ${source}.`));
      script.addEventListener("load", onLoad, { once: true });
      script.addEventListener("error", onError, { once: true });
      if (!existing) {
        script.src = source;
        // Dynamic classic scripts are async by default. Keep execution ordered
        // while allowing the whole feature batch to download concurrently.
        script.async = false;
        script.dataset.workspaceFeatureScript = "true";
        document.head.append(script);
      }
    });
    scriptPromises.set(source, promise);
    void promise.catch(() => scriptPromises.delete(source));
    return promise;
  }

  async function loadOrderedScripts(sources = []) {
    // Start every download before awaiting the first one. `async = false`
    // preserves the declared dependency order at execution time.
    const pending = sources.map(loadScript);
    for (const script of pending) await script;
  }

  async function loadStyles(sources = []) {
    await Promise.all(sources.map(loadStyle));
  }

  function load(featureId) {
    if (!features.has(featureId)) return Promise.resolve();
    if (featurePromises.has(featureId)) return featurePromises.get(featureId);
    const promise = (async () => {
      for (const dependency of dependencies.get(featureId) || []) await load(dependency);
      await loadStyles(styles.get(featureId) || []);
      await loadOrderedScripts(features.get(featureId) || []);
      window.performance?.mark?.(`bcc:feature:${featureId}:ready`);
      window.BCCWorkspaceEvents.emit("featureReady", { featureId });
    })();
    featurePromises.set(featureId, promise);
    void promise.catch(() => featurePromises.delete(featureId));
    return promise;
  }

  window.BCCWorkspaceLoader = { register, load, loadStyle };
})();
