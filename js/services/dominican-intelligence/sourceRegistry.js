(() => {
  function getMockRegistry() {
    return window.BCCWorkspaceDominicanData?.dataSources || [];
  }

  // TODO: Replace this registry adapter with persisted source metadata once live
  // connectors are enabled and source health checks are stored.
  window.BCCDominicanSourceRegistry = { getMockRegistry };
})();
