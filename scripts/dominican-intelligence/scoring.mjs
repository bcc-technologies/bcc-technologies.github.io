export const BCC_KEYWORDS = [
  "microscopio", "microscopía", "microscopia", "laboratorio", "nanotecnología", "nanotecnologia",
  "materiales", "calidad", "ensayo", "análisis", "analisis", "imagen", "software", "automatización",
  "automatizacion", "inteligencia artificial", "sensores", "agua", "corrosión", "corrosion",
  "electroquímica", "electroquimica", "impedancia", "biotecnología", "biotecnologia", "diagnóstico",
  "diagnostico", "metrología", "metrologia", "calibración", "calibracion", "investigación",
  "investigacion", "universidad", "equipos", "instrumentos", "reactivos", "maquinaria", "innovación",
  "innovacion", "INTEC", "UASD", "INDECAL", "INDOCAL", "IIBI", "MESCYT", "MICM",
  "Ministerio de Salud Pública", "Ministerio de Salud Publica", "Ministerio de Medio Ambiente",
  "DGCP", "ONE"
];

const TECHNICAL_TERMS = new Set([
  "microscopio", "microscopía", "microscopia", "laboratorio", "nanotecnología", "nanotecnologia",
  "metrología", "metrologia", "calibración", "calibracion", "biotecnología", "biotecnologia",
  "sensores", "electroquímica", "electroquimica", "impedancia", "reactivos", "instrumentos"
]);

function normalize(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function cleanText(value, limit = 2000) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function keywordMatches(text) {
  const normalized = normalize(text);
  return BCC_KEYWORDS.filter(keyword => normalized.includes(normalize(keyword)));
}

function sourceValueScore(source = {}) {
  if (source.strategicValue === "high" || source.strategic_value === "high") return 16;
  if (source.strategicValue === "medium" || source.strategic_value === "medium") return 9;
  return 4;
}

function institutionScore(text) {
  const normalized = normalize(text);
  if (/(intec|uasd|indocal|iibi|mescyt|micm|dgcp)/.test(normalized)) return 15;
  if (/(ministerio|superintendencia|direccion general|oficina nacional|ayuntamiento)/.test(normalized)) return 9;
  return 3;
}

function formatScore(item = {}) {
  const formats = [item.format, item.sourceType, item.source_type, item.resourceType, item.resource_type]
    .flatMap(value => String(value || "").split(","))
    .map(value => normalize(value).trim());
  if (formats.some(value => ["api", "csv", "xlsx", "ods", "wfs"].includes(value))) return 12;
  if (formats.some(value => ["ckan", "wms", "wmts", "csw"].includes(value))) return 9;
  if (formats.some(Boolean)) return 4;
  return 0;
}

function recencyScore(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 2;
  const days = (Date.now() - date.getTime()) / 86400000;
  if (days <= 30) return 10;
  if (days <= 180) return 7;
  if (days <= 730) return 4;
  return 1;
}

export function scoreDominicanItem(item = {}, source = {}) {
  const haystack = [
    item.title, item.name, item.description, item.notes, item.summary, item.organization, item.institution,
    Array.isArray(item.tags) ? item.tags.join(" ") : "",
    Array.isArray(item.bccRelevance) ? item.bccRelevance.join(" ") : ""
  ].join(" ");
  const matches = keywordMatches(haystack);
  const technicalMatches = matches.filter(match => TECHNICAL_TERMS.has(normalize(match)));
  let score = 8;
  score += Math.min(24, matches.length * 5);
  score += Math.min(14, technicalMatches.length * 5);
  score += institutionScore(haystack);
  score += sourceValueScore(source);
  score += formatScore(item);
  score += recencyScore(item.lastModified || item.last_modified || item.publicationDate || item.publication_date);

  const relevanceScore = Math.max(0, Math.min(100, Math.round(score)));
  const whyFlagged = matches.length
    ? `Matched BCC keywords: ${matches.slice(0, 8).join(", ")}.`
    : "No strong BCC keyword match yet; retained because the source/category is strategically relevant.";
  const suggestedAction = relevanceScore >= 75
    ? "Review immediately and classify as a BCC opportunity candidate."
    : relevanceScore >= 50
      ? "Monitor and enrich with source metadata before action."
      : "Keep indexed for context; no immediate action required.";
  const urgency = relevanceScore >= 75 ? "high" : relevanceScore >= 50 ? "medium" : "low";

  return { relevanceScore, whyFlagged, suggestedAction, urgency, matchedKeywords: matches };
}

export function signalFromDataset(dataset, source) {
  const scored = scoreDominicanItem(dataset, source);
  return {
    id: `sig-dataset-${dataset.id}`,
    sourceId: source.id,
    section: dataset.section || source.section || "data_sources",
    category: scored.relevanceScore >= 70 ? "opportunity" : "dataset",
    title: scored.relevanceScore >= 70
      ? `Relevant dataset detected: ${cleanText(dataset.title || dataset.name, 140)}`
      : `New dataset indexed: ${cleanText(dataset.title || dataset.name, 140)}`,
    summary: cleanText(dataset.notes || dataset.description || "Dataset indexed from Dominican source registry.", 500),
    whyFlagged: scored.whyFlagged,
    relevanceScore: scored.relevanceScore,
    urgency: scored.urgency,
    entityName: cleanText(dataset.organization || source.institution || "", 180),
    entityType: "dataset",
    suggestedAction: scored.suggestedAction,
    rawJson: { datasetId: dataset.id, matchedKeywords: scored.matchedKeywords },
    detectedAt: new Date().toISOString()
  };
}

export function sourceHealthSignal(source, message) {
  return {
    id: `sig-source-health-${source.id}`,
    sourceId: source.id,
    section: source.section || "data_sources",
    category: "source_health",
    title: `Source health attention: ${source.name}`,
    summary: cleanText(message || "Source sync needs attention.", 500),
    whyFlagged: "High-value or connector-enabled source did not complete normally.",
    relevanceScore: source.strategicValue === "high" ? 68 : 48,
    urgency: source.strategicValue === "high" ? "medium" : "low",
    entityName: source.name,
    entityType: "source",
    suggestedAction: "Review connector status and retry sync after validating source availability.",
    rawJson: { status: source.status },
    detectedAt: new Date().toISOString()
  };
}
