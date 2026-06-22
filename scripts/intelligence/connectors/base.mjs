function compactSpaces(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function titleCaseFragment(value) {
  return String(value || "")
    .split(" ")
    .filter(Boolean)
    .map(part => part ? `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}` : "")
    .join(" ");
}

export function decodeXml(value) {
  return compactSpaces(
    String(value || "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
  );
}

export function getXmlTag(block, tag) {
  const match = String(block || "").match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeXml(match[1]) : "";
}

export function cleanText(value, maxLength = 0) {
  const text = compactSpaces(value);
  if (!maxLength || text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim();
}

export function cleanArray(values, maxItems = 64, maxLength = 240) {
  const seen = new Set();
  const items = [];
  for (const value of Array.isArray(values) ? values : []) {
    const text = cleanText(value, maxLength);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(text);
    if (items.length >= maxItems) break;
  }
  return items;
}

export function normalizeDate(value) {
  const text = cleanText(value, 32);
  if (!text) return "";
  if (/^\d{4}$/.test(text)) return `${text}-01-01`;
  if (/^\d{4}-\d{2}$/.test(text)) return `${text}-01`;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function stripDoiUrl(value) {
  const text = cleanText(value, 200).replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
  return text.replace(/^doi:/i, "").trim();
}

export function normalizeArxivId(value) {
  const text = cleanText(value, 80)
    .replace(/^https?:\/\/arxiv\.org\/abs\//i, "")
    .replace(/^arxiv:/i, "")
    .trim();
  return text;
}

export function titleFingerprint(value) {
  return cleanText(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function safeUrl(value, maxLength = 500) {
  const text = cleanText(value, maxLength)
    .replace(/^http:\/\//i, "https://")
    .replace(/^https:\/\/dx\.doi\.org\//i, "https://doi.org/");
  if (!text) return "";
  if (!/^https?:\/\//i.test(text)) return "";
  return text;
}

export function normalizeTitle(value, maxLength = 600) {
  const text = cleanText(value, maxLength)
    .replace(/\s*[:|]\s*/g, ": ")
    .replace(/\s*-\s*/g, " - ");
  return text;
}

export function normalizePersonName(value, maxLength = 200) {
  const raw = cleanText(value, maxLength)
    .replace(/\s+/g, " ")
    .replace(/\([^)]*\)/g, "")
    .trim();
  if (!raw) return "";
  if (raw.includes(",")) {
    const [family, given] = raw.split(",").map(part => cleanText(part, maxLength));
    return cleanText(`${titleCaseFragment(given)} ${titleCaseFragment(family)}`, maxLength);
  }
  return titleCaseFragment(raw);
}

export function normalizeInstitutionName(value, maxLength = 200) {
  return cleanText(value, maxLength)
    .replace(/\bdept\.?\b/gi, "Department")
    .replace(/\buniv\.?\b/gi, "University")
    .replace(/\bDepartment\./g, "Department")
    .replace(/\bUniversity\./g, "University")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeTag(value, maxLength = 120) {
  return cleanText(value, maxLength)
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeQuery(query = {}) {
  const keywords = cleanArray(query.keywords || [], 24, 120);
  const topics = cleanArray(query.topics || [], 24, 120);
  const text = cleanText(query.text, 400);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const fromDate = normalizeDate(query.fromDate);
  const toDate = normalizeDate(query.toDate);
  return { text, keywords, topics, limit, fromDate, toDate };
}

export function buildSearchText(query = {}) {
  const normalized = normalizeQuery(query);
  const chunks = [
    normalized.text,
    ...normalized.keywords,
    ...normalized.topics
  ].filter(Boolean);
  return chunks.join(" ").trim();
}

export function inferTopicsFromKeywords(keywords = []) {
  return cleanArray(keywords, 12, 80);
}

export function normalizePaperItem(item = {}) {
  return {
    kind: "paper",
    sourceName: cleanText(item.sourceName, 120),
    sourceType: cleanText(item.sourceType, 80),
    externalId: cleanText(item.externalId, 200),
    doi: stripDoiUrl(item.doi),
    arxivId: normalizeArxivId(item.arxivId),
    title: normalizeTitle(item.title, 600),
    abstract: cleanText(item.abstract, 40000),
    authors: cleanArray((Array.isArray(item.authors) ? item.authors : []).map(author => normalizePersonName(author, 200)), 128, 200),
    institutions: cleanArray((Array.isArray(item.institutions) ? item.institutions : []).map(institution => normalizeInstitutionName(institution, 200)), 128, 200),
    publicationDate: normalizeDate(item.publicationDate),
    sourceUrl: safeUrl(item.sourceUrl, 500),
    journalOrVenue: cleanText(item.journalOrVenue, 240),
    topics: cleanArray((Array.isArray(item.topics) ? item.topics : []).map(topic => normalizeTag(topic, 120)), 64, 120),
    keywords: cleanArray((Array.isArray(item.keywords) ? item.keywords : []).map(keyword => normalizeTag(keyword, 120)), 128, 120),
    citationsCount: Math.max(0, Number(item.citationsCount) || 0),
    openAccessUrl: safeUrl(item.openAccessUrl, 500),
    rawData: item.rawData && typeof item.rawData === "object" ? item.rawData : {}
  };
}

export function createNotImplementedConnector(sourceName, sourceType) {
  return {
    sourceName,
    sourceType,
    async search() {
      throw new Error(`${sourceName} connector is not implemented yet.`);
    },
    async fetchById() {
      throw new Error(`${sourceName} connector is not implemented yet.`);
    }
  };
}
