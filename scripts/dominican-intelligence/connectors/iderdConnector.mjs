import { sourceById } from "../registry.mjs";

const SERVICE_CANDIDATES = [
  { suffix: "/geoserver/wms", serviceType: "wms", layerType: "service_directory", category: "geospatial", name: "IDERD WMS service candidate" },
  { suffix: "/geoserver/wfs", serviceType: "wfs", layerType: "service_directory", category: "geospatial", name: "IDERD WFS service candidate" },
  { suffix: "/catalogue/csw", serviceType: "csw", layerType: "metadata_catalog", category: "geospatial", name: "IDERD CSW metadata candidate" }
];

export async function syncIderdServiceDirectory(store) {
  const source = sourceById("iderd-geoportal");
  const run = await store.startRun({ sourceId: source.id, connectorKey: source.connectorKey, metadataJson: { target: "iderd" } });
  try {
    const layers = SERVICE_CANDIDATES.map(item => ({
      id: `iderd-${item.serviceType}`,
      sourceId: source.id,
      name: item.name,
      layerType: item.layerType,
      serviceType: item.serviceType,
      serviceUrl: `${source.url}${item.suffix}`,
      category: item.category,
      description: "Metadata-level service registration. Availability must be validated before map usage.",
      metadataJson: { validationStatus: "registered_not_validated" }
    }));
    const signals = layers.map(layer => ({
      id: `sig-geolayer-${layer.id}`,
      sourceId: source.id,
      section: "territory_environment",
      category: "geospatial",
      title: `Geospatial service registered: ${layer.name}`,
      summary: layer.description,
      whyFlagged: "IDERD is a strategic geospatial source for administrative boundaries, infrastructure, water, environment and territorial layers.",
      relevanceScore: layer.serviceType === "wfs" ? 62 : 52,
      urgency: "medium",
      entityName: layer.name,
      entityType: "geo_service",
      suggestedAction: "Validate service availability and inventory useful administrative, infrastructure and environmental layers.",
      rawJson: { serviceUrl: layer.serviceUrl },
      detectedAt: new Date().toISOString()
    }));
    const layerResult = await store.upsertMany("geoLayers", layers);
    await store.upsertMany("signals", signals);
    await store.completeRun(run.id, {
      sourceId: source.id,
      sourceStatus: "partial",
      status: "completed",
      recordsFound: layers.length,
      recordsCreated: layerResult.created,
      recordsUpdated: layerResult.updated,
      metadataJson: { metadataLevelOnly: true, signals: signals.length }
    });
    return { layers, signals };
  } catch (error) {
    await store.completeRun(run.id, {
      sourceId: source.id,
      sourceStatus: "failed",
      status: "failed",
      errorMessage: error.message,
      metadataJson: { target: "iderd" }
    });
    throw error;
  }
}
