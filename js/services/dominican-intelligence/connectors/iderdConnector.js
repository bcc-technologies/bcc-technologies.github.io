(() => {
  async function fetchLayerRegistry() {
    // TODO: Implement OGC service discovery for WMS/WMTS/WFS/CSW layers.
    return { status: "planned", items: [] };
  }

  window.BCCDominicanIderdConnector = { fetchLayerRegistry };
})();
