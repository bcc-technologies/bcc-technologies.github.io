import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { supabaseRestFetch as restFetch } from "../lib/supabase-rest.mjs";
import { DOMINICAN_SOURCES, CURATED_INSTITUTIONS } from "./registry.mjs";

const TABLES = [
  "sources",
  "resources",
  "datasets",
  "institutions",
  "procurementRecords",
  "economicIndicators",
  "geoLayers",
  "policyDocuments",
  "signals",
  "syncRuns"
];

const TABLE_MAP = {
  sources: "dominican_sources",
  resources: "dominican_source_resources",
  datasets: "dominican_datasets",
  institutions: "dominican_institutions",
  procurementRecords: "dominican_procurement_records",
  economicIndicators: "dominican_economic_indicators",
  geoLayers: "dominican_geo_layers",
  policyDocuments: "dominican_policy_documents",
  signals: "dominican_signals",
  syncRuns: "dominican_sync_runs"
};

function cleanText(value, limit = 2000) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function nowIso() {
  return new Date().toISOString();
}

function emptyState() {
  return Object.fromEntries(TABLES.map(key => [key, []]));
}

function toDbSource(source) {
  return {
    id: source.id,
    name: source.name,
    institution: source.institution || "",
    section: source.section,
    category: source.category,
    source_type: source.sourceType || source.source_type,
    url: source.url || "",
    status: source.status || "unknown",
    strategic_value: source.strategicValue || source.strategic_value || "medium",
    bcc_relevance_json: source.bccRelevance || source.bcc_relevance_json || [],
    connector_key: source.connectorKey || source.connector_key || "",
    notes: source.notes || "",
    last_checked_at: source.lastCheckedAt || source.last_checked_at || null
  };
}

function fromDbSource(row) {
  return {
    id: row.id,
    name: row.name,
    institution: row.institution || "",
    section: row.section || "data_sources",
    category: row.category || "open_data",
    sourceType: row.source_type || row.sourceType || "manual",
    url: row.url || "",
    status: row.status || "unknown",
    strategicValue: row.strategic_value || row.strategicValue || "medium",
    bccRelevance: Array.isArray(row.bcc_relevance_json) ? row.bcc_relevance_json : (row.bccRelevance || []),
    connectorKey: row.connector_key || row.connectorKey || "",
    notes: row.notes || "",
    lastCheckedAt: row.last_checked_at || row.lastCheckedAt || "",
    createdAt: row.created_at || row.createdAt || "",
    updatedAt: row.updated_at || row.updatedAt || ""
  };
}

function toDbResource(item) {
  return {
    id: item.id,
    source_id: item.sourceId || item.source_id,
    external_id: item.externalId || item.external_id || "",
    name: item.name,
    format: item.format || "",
    url: item.url || "",
    resource_type: item.resourceType || item.resource_type || "",
    description: item.description || "",
    metadata_json: item.metadataJson || item.metadata_json || {},
    last_modified: item.lastModified || item.last_modified || null
  };
}

function fromDbResource(row) {
  return {
    id: row.id,
    sourceId: row.source_id || row.sourceId || "",
    externalId: row.external_id || row.externalId || "",
    name: row.name || "",
    format: row.format || "",
    url: row.url || "",
    resourceType: row.resource_type || row.resourceType || "",
    description: row.description || "",
    metadataJson: row.metadata_json || row.metadataJson || {},
    lastModified: row.last_modified || row.lastModified || ""
  };
}

function toDbDataset(item) {
  return {
    id: item.id,
    source_id: item.sourceId || item.source_id,
    external_id: item.externalId || item.external_id || "",
    title: item.title,
    name: item.name || "",
    organization: item.organization || "",
    section: item.section || "data_sources",
    category: item.category || "open_data",
    notes: item.notes || "",
    tags_json: item.tags || item.tags_json || [],
    resources_json: item.resources || item.resources_json || [],
    metadata_json: item.metadataJson || item.metadata_json || {},
    relevance_score: Math.max(0, Math.min(100, Number(item.relevanceScore || item.relevance_score || 0))),
    last_modified: item.lastModified || item.last_modified || null
  };
}

function fromDbDataset(row) {
  return {
    id: row.id,
    sourceId: row.source_id || row.sourceId || "",
    externalId: row.external_id || row.externalId || "",
    title: row.title || "",
    name: row.name || "",
    organization: row.organization || "",
    section: row.section || "data_sources",
    category: row.category || "open_data",
    notes: row.notes || "",
    tags: Array.isArray(row.tags_json) ? row.tags_json : (row.tags || []),
    resources: Array.isArray(row.resources_json) ? row.resources_json : (row.resources || []),
    metadataJson: row.metadata_json || row.metadataJson || {},
    relevanceScore: Number(row.relevance_score || row.relevanceScore || 0),
    lastModified: row.last_modified || row.lastModified || "",
    createdAt: row.created_at || row.createdAt || "",
    updatedAt: row.updated_at || row.updatedAt || ""
  };
}

function toDbInstitution(item) {
  return {
    id: item.id,
    name: item.name,
    kind: item.kind || "agency",
    sector: item.sector || "",
    source_id: item.sourceId || item.source_id || null,
    relevance_to_bcc: item.relevanceToBCC || item.relevance_to_bcc || "medium",
    notes: item.notes || "",
    metadata_json: item.metadataJson || item.metadata_json || {}
  };
}

function fromDbInstitution(row) {
  return {
    id: row.id,
    name: row.name || "",
    kind: row.kind || "agency",
    sector: row.sector || "",
    sourceId: row.source_id || row.sourceId || "",
    relevanceToBCC: row.relevance_to_bcc || row.relevanceToBCC || "medium",
    notes: row.notes || "",
    metadataJson: row.metadata_json || row.metadataJson || {}
  };
}

function toDbSignal(item) {
  return {
    id: item.id,
    source_id: item.sourceId || item.source_id || null,
    section: item.section || "radar",
    category: item.category || "dataset",
    title: item.title,
    summary: item.summary || "",
    why_flagged: item.whyFlagged || item.why_flagged || "",
    relevance_score: Math.max(0, Math.min(100, Number(item.relevanceScore || item.relevance_score || 0))),
    urgency: item.urgency || "low",
    entity_name: item.entityName || item.entity_name || "",
    entity_type: item.entityType || item.entity_type || "",
    suggested_action: item.suggestedAction || item.suggested_action || "",
    raw_json: item.rawJson || item.raw_json || {},
    detected_at: item.detectedAt || item.detected_at || nowIso()
  };
}

function fromDbSignal(row) {
  return {
    id: row.id,
    sourceId: row.source_id || row.sourceId || "",
    section: row.section || "radar",
    category: row.category || "dataset",
    title: row.title || "",
    summary: row.summary || "",
    whyFlagged: row.why_flagged || row.whyFlagged || "",
    relevanceScore: Number(row.relevance_score || row.relevanceScore || 0),
    urgency: row.urgency || "low",
    entityName: row.entity_name || row.entityName || "",
    entityType: row.entity_type || row.entityType || "",
    suggestedAction: row.suggested_action || row.suggestedAction || "",
    rawJson: row.raw_json || row.rawJson || {},
    detectedAt: row.detected_at || row.detectedAt || "",
    createdAt: row.created_at || row.createdAt || "",
    updatedAt: row.updated_at || row.updatedAt || ""
  };
}

function toDbGeoLayer(item) {
  return {
    id: item.id,
    source_id: item.sourceId || item.source_id || null,
    name: item.name,
    layer_type: item.layerType || item.layer_type || "",
    service_type: item.serviceType || item.service_type || "",
    service_url: item.serviceUrl || item.service_url || "",
    category: item.category || "",
    description: item.description || "",
    metadata_json: item.metadataJson || item.metadata_json || {}
  };
}

function fromDbGeoLayer(row) {
  return {
    id: row.id,
    sourceId: row.source_id || row.sourceId || "",
    name: row.name || "",
    layerType: row.layer_type || row.layerType || "",
    serviceType: row.service_type || row.serviceType || "",
    serviceUrl: row.service_url || row.serviceUrl || "",
    category: row.category || "",
    description: row.description || "",
    metadataJson: row.metadata_json || row.metadataJson || {}
  };
}

function toDbRun(item) {
  return {
    source_id: item.sourceId || item.source_id || null,
    connector_key: item.connectorKey || item.connector_key || "",
    status: item.status || "running",
    started_at: item.startedAt || item.started_at || nowIso(),
    finished_at: item.finishedAt || item.finished_at || null,
    records_found: Number(item.recordsFound || item.records_found || 0),
    records_created: Number(item.recordsCreated || item.records_created || 0),
    records_updated: Number(item.recordsUpdated || item.records_updated || 0),
    error_message: item.errorMessage || item.error_message || "",
    metadata_json: item.metadataJson || item.metadata_json || {}
  };
}

function fromDbRun(row) {
  return {
    id: row.id,
    sourceId: row.source_id || row.sourceId || "",
    connectorKey: row.connector_key || row.connectorKey || "",
    status: row.status || "unknown",
    startedAt: row.started_at || row.startedAt || "",
    finishedAt: row.finished_at || row.finishedAt || "",
    recordsFound: Number(row.records_found || row.recordsFound || 0),
    recordsCreated: Number(row.records_created || row.recordsCreated || 0),
    recordsUpdated: Number(row.records_updated || row.recordsUpdated || 0),
    errorMessage: row.error_message || row.errorMessage || "",
    metadataJson: row.metadata_json || row.metadataJson || {}
  };
}

const MAPPERS = {
  sources: { toDb: toDbSource, fromDb: fromDbSource },
  resources: { toDb: toDbResource, fromDb: fromDbResource },
  datasets: { toDb: toDbDataset, fromDb: fromDbDataset },
  institutions: { toDb: toDbInstitution, fromDb: fromDbInstitution },
  geoLayers: { toDb: toDbGeoLayer, fromDb: fromDbGeoLayer },
  signals: { toDb: toDbSignal, fromDb: fromDbSignal },
  syncRuns: { toDb: toDbRun, fromDb: fromDbRun }
};

function sortDashboard(dashboard) {
  dashboard.sources.sort((a, b) => a.name.localeCompare(b.name));
  dashboard.datasets.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
  dashboard.signals.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0) || String(b.detectedAt || "").localeCompare(String(a.detectedAt || "")));
  dashboard.syncRuns.sort((a, b) => String(b.startedAt || "").localeCompare(String(a.startedAt || "")));
  return dashboard;
}

class LocalDominicanStore {
  constructor(filePath) {
    this.filePath = filePath;
  }

  read() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    if (!fs.existsSync(this.filePath)) {
      const seeded = emptyState();
      seeded.sources = DOMINICAN_SOURCES.map(source => ({ ...source, lastCheckedAt: "" }));
      seeded.institutions = CURATED_INSTITUTIONS.map(item => ({ ...item }));
      fs.writeFileSync(this.filePath, `${JSON.stringify(seeded, null, 2)}\n`, "utf-8");
      return seeded;
    }
    try {
      return { ...emptyState(), ...JSON.parse(fs.readFileSync(this.filePath, "utf-8")) };
    } catch {
      return emptyState();
    }
  }

  write(state) {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, `${JSON.stringify(state, null, 2)}\n`, "utf-8");
  }

  async seedRegistry() {
    const state = this.read();
    const byId = new Map(state.sources.map(item => [item.id, item]));
    DOMINICAN_SOURCES.forEach(source => byId.set(source.id, { ...source, ...(byId.get(source.id) || {}) }));
    state.sources = [...byId.values()];
    const institutions = new Map(state.institutions.map(item => [item.id, item]));
    CURATED_INSTITUTIONS.forEach(item => institutions.set(item.id, { ...item, ...(institutions.get(item.id) || {}) }));
    state.institutions = [...institutions.values()];
    this.write(state);
  }

  async dashboard() {
    await this.seedRegistry();
    return sortDashboard(this.read());
  }

  async upsertMany(key, rows) {
    const state = this.read();
    const existing = new Map((state[key] || []).map(item => [item.id, item]));
    let created = 0;
    let updated = 0;
    rows.forEach(row => {
      const previous = existing.get(row.id);
      if (previous) updated += 1;
      else created += 1;
      existing.set(row.id, { ...(previous || {}), ...row, updatedAt: nowIso(), createdAt: previous?.createdAt || row.createdAt || nowIso() });
    });
    state[key] = [...existing.values()];
    this.write(state);
    return { created, updated };
  }

  async startRun(meta = {}) {
    const state = this.read();
    const run = {
      id: crypto.randomUUID(),
      sourceId: meta.sourceId || "",
      connectorKey: meta.connectorKey || "",
      status: "running",
      startedAt: nowIso(),
      finishedAt: "",
      recordsFound: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      errorMessage: "",
      metadataJson: meta.metadataJson || {}
    };
    state.syncRuns.push(run);
    this.write(state);
    return run;
  }

  async completeRun(id, patch = {}) {
    const state = this.read();
    state.syncRuns = state.syncRuns.map(run => run.id === id ? {
      ...run,
      status: patch.status || "completed",
      finishedAt: nowIso(),
      recordsFound: Number(patch.recordsFound || 0),
      recordsCreated: Number(patch.recordsCreated || 0),
      recordsUpdated: Number(patch.recordsUpdated || 0),
      errorMessage: cleanText(patch.errorMessage || "", 1000),
      metadataJson: patch.metadataJson || run.metadataJson || {}
    } : run);
    if (patch.sourceId) {
      state.sources = state.sources.map(source => source.id === patch.sourceId ? {
        ...source,
        status: patch.sourceStatus || source.status,
        lastCheckedAt: nowIso()
      } : source);
    }
    this.write(state);
    return state.syncRuns.find(run => run.id === id);
  }
}

class SupabaseDominicanStore {
  constructor(baseUrl, serviceKey) {
    this.baseUrl = baseUrl;
    this.serviceKey = serviceKey;
  }

  async seedRegistry() {
    await this.upsertMany("sources", DOMINICAN_SOURCES);
    await this.upsertMany("institutions", CURATED_INSTITUTIONS);
  }

  async list(key, params = {}) {
    const mapper = MAPPERS[key];
    const rows = await restFetch(this.baseUrl, this.serviceKey, TABLE_MAP[key], {
      params: { select: "*", ...params }
    });
    return (Array.isArray(rows) ? rows : []).map(row => mapper?.fromDb ? mapper.fromDb(row) : row);
  }

  async dashboard() {
    await this.seedRegistry();
    const [
      sources,
      resources,
      datasets,
      institutions,
      procurementRecords,
      economicIndicators,
      geoLayers,
      policyDocuments,
      signals,
      syncRuns
    ] = await Promise.all([
      this.list("sources", { order: "updated_at.desc" }),
      this.list("resources", { order: "updated_at.desc", limit: 500 }),
      this.list("datasets", { order: "relevance_score.desc,updated_at.desc", limit: 500 }),
      this.list("institutions", { order: "updated_at.desc", limit: 300 }),
      this.list("procurementRecords", { order: "updated_at.desc", limit: 200 }),
      this.list("economicIndicators", { order: "created_at.desc", limit: 200 }),
      this.list("geoLayers", { order: "updated_at.desc", limit: 300 }),
      this.list("policyDocuments", { order: "updated_at.desc", limit: 200 }),
      this.list("signals", { order: "relevance_score.desc,detected_at.desc", limit: 300 }),
      this.list("syncRuns", { order: "started_at.desc", limit: 50 })
    ]);
    return sortDashboard({ sources, resources, datasets, institutions, procurementRecords, economicIndicators, geoLayers, policyDocuments, signals, syncRuns });
  }

  async upsertMany(key, rows) {
    const mapper = MAPPERS[key];
    if (!rows.length) return { created: 0, updated: 0 };
    const payload = mapper?.toDb ? rows.map(mapper.toDb) : rows;
    await restFetch(this.baseUrl, this.serviceKey, TABLE_MAP[key], {
      method: "POST",
      prefer: "resolution=merge-duplicates",
      body: payload
    });
    return { created: rows.length, updated: 0 };
  }

  async startRun(meta = {}) {
    const rows = await restFetch(this.baseUrl, this.serviceKey, TABLE_MAP.syncRuns, {
      method: "POST",
      prefer: "return=representation",
      body: toDbRun({ ...meta, status: "running", startedAt: nowIso() })
    });
    return fromDbRun(Array.isArray(rows) ? rows[0] : rows);
  }

  async completeRun(id, patch = {}) {
    const body = {
      status: patch.status || "completed",
      finished_at: nowIso(),
      records_found: Number(patch.recordsFound || patch.records_found || 0),
      records_created: Number(patch.recordsCreated || patch.records_created || 0),
      records_updated: Number(patch.recordsUpdated || patch.records_updated || 0),
      error_message: cleanText(patch.errorMessage || patch.error_message || "", 1000),
      metadata_json: patch.metadataJson || patch.metadata_json || {}
    };
    const rows = await restFetch(this.baseUrl, this.serviceKey, TABLE_MAP.syncRuns, {
      method: "PATCH",
      prefer: "return=representation",
      params: { id: `eq.${id}` },
      body
    });
    if (patch.sourceId) {
      await restFetch(this.baseUrl, this.serviceKey, TABLE_MAP.sources, {
        method: "PATCH",
        params: { id: `eq.${patch.sourceId}` },
        body: {
          status: patch.sourceStatus || "partial",
          last_checked_at: nowIso()
        }
      });
    }
    return fromDbRun(Array.isArray(rows) ? rows[0] : rows);
  }
}

export function createDominicanStore(options = {}) {
  const baseUrl = String(process.env.SUPABASE_URL || "").trim();
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (baseUrl && serviceKey) return new SupabaseDominicanStore(baseUrl, serviceKey);
  return new LocalDominicanStore(path.join(options.dataDir || process.cwd(), "dominican-intelligence.json"));
}
