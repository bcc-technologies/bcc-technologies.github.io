import crypto from "node:crypto";
import { sourceById } from "../registry.mjs";
import { scoreDominicanItem, signalFromDataset } from "../scoring.mjs";

const CKAN_BASE = "https://datos.gob.do/api/3/action";

function cleanText(value, limit = 4000) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function stableId(prefix, value) {
  const hash = crypto.createHash("sha1").update(String(value || "")).digest("hex").slice(0, 16);
  return `${prefix}-${hash}`;
}

async function ckanAction(action, params = {}) {
  const url = new URL(`${CKAN_BASE}/${action}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && typeof value !== "undefined" && value !== "") url.searchParams.set(key, String(value));
  });
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`CKAN ${action} failed with ${response.status}: ${await response.text()}`);
  const payload = await response.json();
  if (!payload?.success) throw new Error(`CKAN ${action} returned success=false`);
  return payload.result;
}

export async function searchCkanDatasets(query, options = {}) {
  return ckanAction("package_search", {
    q: query || "*:*",
    rows: Math.min(100, Math.max(1, Number(options.limit) || 25)),
    start: Math.max(0, Number(options.start) || 0)
  });
}

export async function listCkanPackages(options = {}) {
  return ckanAction("package_list", {
    limit: Math.min(100, Math.max(1, Number(options.limit) || 50)),
    offset: Math.max(0, Number(options.offset) || 0)
  });
}

export async function getCkanPackage(packageId) {
  return ckanAction("package_show", { id: packageId });
}

function sectionForDataset(raw, source) {
  const text = [raw.title, raw.name, raw.notes, raw.organization?.title, ...(raw.tags || []).map(tag => tag.display_name || tag.name)].join(" ").toLowerCase();
  if (/compra|contrataci|proveedor|licitaci|dgcp|contrato/.test(text)) return "public_market";
  if (/poblaci|educaci|pobreza|estadist|censo|hogar|demograf/.test(text)) return "demographics_statistics";
  if (/mapa|geo|territor|provincia|municipio|ambiente|agua|bosque|clima|aire/.test(text)) return "territory_environment";
  if (/econom|precio|inflaci|aduana|export|import|turismo|financ|banco/.test(text)) return "economy_finance";
  if (/ley|decreto|reglamento|norma|consulta|plan/.test(text)) return "regulation_policy";
  return source.section || "data_sources";
}

function categoryForDataset(raw, section) {
  const text = [raw.title, raw.name, raw.notes, raw.organization?.title, ...(raw.tags || []).map(tag => tag.display_name || tag.name)].join(" ").toLowerCase();
  if (section === "public_market") return "procurement";
  if (/geo|mapa|territor|municipio|provincia/.test(text)) return "geospatial";
  if (/ambiente|agua|clima|bosque|aire|incendio/.test(text)) return "environment";
  if (/aduana|export|import/.test(text)) return "trade";
  if (/banco|financ/.test(text)) return "finance";
  if (/poblaci|censo|educaci|pobreza|estadist/.test(text)) return "statistics";
  if (/ley|decreto|reglamento|norma/.test(text)) return "regulation";
  if (/api/.test(text)) return "government_api";
  return "open_data";
}

function resourceType(resource = {}) {
  const format = cleanText(resource.format || resource.mimetype || "", 40).toLowerCase();
  if (["csv", "xlsx", "xls", "ods", "json", "api"].some(item => format.includes(item))) return format.includes("xls") ? "xlsx" : format;
  return "web_portal";
}

export function normalizeCkanDataset(raw, source = sourceById("datos-gob-do")) {
  const section = sectionForDataset(raw, source);
  const category = categoryForDataset(raw, section);
  const tags = Array.isArray(raw.tags) ? raw.tags.map(tag => cleanText(tag.display_name || tag.name, 80)).filter(Boolean) : [];
  const resources = Array.isArray(raw.resources) ? raw.resources.map(resource => ({
    id: resource.id || stableId("resource", `${raw.id}-${resource.url}-${resource.name}`),
    name: cleanText(resource.name || resource.description || resource.format || "Resource", 240),
    format: cleanText(resource.format || resource.mimetype || "", 40),
    url: cleanText(resource.url || "", 1000),
    resourceType: resourceType(resource),
    description: cleanText(resource.description || "", 1000),
    lastModified: resource.last_modified || resource.revision_timestamp || raw.metadata_modified || ""
  })) : [];
  const dataset = {
    id: `ckan-${raw.id || stableId("pkg", raw.name || raw.title)}`,
    sourceId: source.id,
    externalId: raw.id || raw.name || "",
    title: cleanText(raw.title || raw.name || "Untitled dataset", 600),
    name: cleanText(raw.name || "", 240),
    organization: cleanText(raw.organization?.title || raw.organization?.name || "", 240),
    section,
    category,
    notes: cleanText(raw.notes || raw.description || "", 4000),
    tags,
    resources,
    metadataJson: raw,
    relevanceScore: 0,
    lastModified: raw.metadata_modified || raw.revision_timestamp || ""
  };
  dataset.relevanceScore = scoreDominicanItem(dataset, source).relevanceScore;
  return dataset;
}

export function extractResourcesFromDatasets(datasets = []) {
  return datasets.flatMap(dataset => (dataset.resources || []).map(resource => ({
    id: resource.id || stableId("resource", `${dataset.id}-${resource.url}`),
    sourceId: dataset.sourceId,
    externalId: resource.id || "",
    name: resource.name || dataset.title,
    format: resource.format || "",
    url: resource.url || "",
    resourceType: resource.resourceType || "",
    description: resource.description || "",
    metadataJson: { datasetId: dataset.id, datasetTitle: dataset.title },
    lastModified: resource.lastModified || dataset.lastModified || ""
  })));
}

export function extractOrganizationsFromDatasets(datasets = []) {
  const seen = new Map();
  datasets.forEach(dataset => {
    const name = cleanText(dataset.organization || "", 200);
    if (!name) return;
    const id = `org-${stableId("", name).replace(/^-/, "")}`;
    if (!seen.has(id)) {
      seen.set(id, {
        id,
        name,
        kind: /ministerio/i.test(name) ? "ministry" : /universidad|instituto tecnologico/i.test(name) ? "university" : "agency",
        sector: dataset.category || "Public data",
        sourceId: dataset.sourceId,
        relevanceToBCC: dataset.relevanceScore >= 70 ? "high" : dataset.relevanceScore >= 45 ? "medium" : "low",
        notes: `Extracted from CKAN datasets. Example section: ${dataset.section}.`,
        metadataJson: { extractedFrom: "ckan" }
      });
    }
  });
  return [...seen.values()];
}

export async function syncOpenDataCatalog(store, options = {}) {
  const source = sourceById("datos-gob-do");
  const run = await store.startRun({ sourceId: source.id, connectorKey: source.connectorKey, metadataJson: { target: "datos" } });
  try {
    const result = await searchCkanDatasets(options.query || "*:*", { limit: options.limit || 50 });
    const rawDatasets = Array.isArray(result?.results) ? result.results : [];
    const datasets = rawDatasets.map(raw => normalizeCkanDataset(raw, source));
    const resources = extractResourcesFromDatasets(datasets);
    const institutions = extractOrganizationsFromDatasets(datasets);
    const signals = datasets
      .filter(dataset => dataset.relevanceScore >= 45)
      .map(dataset => signalFromDataset(dataset, source));

    const datasetResult = await store.upsertMany("datasets", datasets);
    const resourceResult = await store.upsertMany("resources", resources);
    await store.upsertMany("institutions", institutions);
    await store.upsertMany("signals", signals);
    await store.completeRun(run.id, {
      sourceId: source.id,
      sourceStatus: "active",
      status: "completed",
      recordsFound: datasets.length + resources.length,
      recordsCreated: datasetResult.created + resourceResult.created,
      recordsUpdated: datasetResult.updated + resourceResult.updated,
      metadataJson: { datasets: datasets.length, resources: resources.length, signals: signals.length }
    });
    return { datasets, resources, institutions, signals };
  } catch (error) {
    await store.completeRun(run.id, {
      sourceId: source.id,
      sourceStatus: "failed",
      status: "failed",
      errorMessage: error.message,
      metadataJson: { target: "datos" }
    });
    throw error;
  }
}
