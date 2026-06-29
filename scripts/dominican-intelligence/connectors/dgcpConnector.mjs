import { sourceById } from "../registry.mjs";
import { scoreDominicanItem, signalFromDataset } from "../scoring.mjs";
import { searchCkanDatasets, normalizeCkanDataset, extractResourcesFromDatasets } from "./ckanConnector.mjs";

const DGCP_TERMS = [
  "DGCP",
  "compras",
  "contrataciones",
  "procesos publicados",
  "proveedores del estado",
  "catálogo de bienes y servicios",
  "precios mercado público",
  "contratos",
  "unidades de compra"
];

export async function discoverDgcpDatasets(options = {}) {
  const results = [];
  for (const term of DGCP_TERMS.slice(0, options.termLimit || DGCP_TERMS.length)) {
    const response = await searchCkanDatasets(term, { limit: options.limitPerTerm || 10 });
    results.push(...(Array.isArray(response?.results) ? response.results : []));
  }
  const deduped = new Map(results.map(item => [item.id || item.name, item]));
  return [...deduped.values()];
}

export async function syncDgcpDatasetMetadata(store, options = {}) {
  const source = sourceById("dgcp-datacompras");
  const run = await store.startRun({ sourceId: source.id, connectorKey: source.connectorKey, metadataJson: { target: "dgcp" } });
  try {
    const raw = await discoverDgcpDatasets(options);
    const datasets = raw.map(item => ({
      ...normalizeCkanDataset(item, source),
      section: "public_market",
      category: "procurement"
    })).map(dataset => {
      const scored = scoreDominicanItem(dataset, source);
      return { ...dataset, relevanceScore: Math.max(dataset.relevanceScore, scored.relevanceScore) };
    });
    const resources = extractResourcesFromDatasets(datasets);
    const signals = generateProcurementSignals(datasets, source);
    const datasetResult = await store.upsertMany("datasets", datasets);
    const resourceResult = await store.upsertMany("resources", resources);
    await store.upsertMany("signals", signals);
    await store.completeRun(run.id, {
      sourceId: source.id,
      sourceStatus: datasets.length ? "partial" : "unknown",
      status: "completed",
      recordsFound: datasets.length + resources.length,
      recordsCreated: datasetResult.created + resourceResult.created,
      recordsUpdated: datasetResult.updated + resourceResult.updated,
      metadataJson: { processLevelIngestion: "pending", datasets: datasets.length, resources: resources.length, signals: signals.length }
    });
    return { datasets, resources, signals, processLevelIngestion: "pending" };
  } catch (error) {
    await store.completeRun(run.id, {
      sourceId: source.id,
      sourceStatus: "failed",
      status: "failed",
      errorMessage: error.message,
      metadataJson: { target: "dgcp" }
    });
    throw error;
  }
}

export function extractDgcpResources(datasets = []) {
  return extractResourcesFromDatasets(datasets);
}

export function parseDgcpCsvIfStraightforward() {
  return { status: "pending", records: [], note: "Process-level ingestion pending; dataset/resource intelligence is stored first." };
}

export function generateProcurementSignals(datasets = [], source = sourceById("dgcp-datacompras")) {
  return datasets
    .filter(dataset => dataset.relevanceScore >= 35 || /laboratorio|equipo|instrument|reactivo|calidad|servicio/i.test(`${dataset.title} ${dataset.notes}`))
    .map(dataset => ({
      ...signalFromDataset(dataset, source),
      id: `sig-procurement-${dataset.id}`,
      section: "public_market",
      category: dataset.relevanceScore >= 60 ? "opportunity" : "procurement",
      title: dataset.relevanceScore >= 60
        ? `Potential BCC procurement opportunity: ${dataset.title}`
        : `DGCP procurement dataset discovered: ${dataset.title}`,
      entityType: "procurement_dataset",
      suggestedAction: dataset.relevanceScore >= 60
        ? "Review resources and prepare process-level parsing for this procurement dataset."
        : "Keep monitored until process-level ingestion is available."
    }));
}
