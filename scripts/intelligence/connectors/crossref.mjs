import { createRateLimiter, requestJson } from "../http.mjs";
import {
  buildSearchText,
  cleanArray,
  cleanText,
  inferTopicsFromKeywords,
  normalizePaperItem,
  normalizeQuery,
  safeUrl,
  stripDoiUrl
} from "./base.mjs";

const SOURCE_NAME = "Crossref";
const SOURCE_TYPE = "crossref";
const API_URL = "https://api.crossref.org/works";
const OPENALEX_EMAIL = String(process.env.OPENALEX_EMAIL || "").trim();
const limitRequest = createRateLimiter(1200);

function decodeCrossrefAbstract(value) {
  return cleanText(String(value || "").replace(/<[^>]+>/g, " "), 40000);
}

function firstDate(parts) {
  const values = Array.isArray(parts) ? parts[0] : null;
  if (!Array.isArray(values) || !values.length) return "";
  const [year, month = 1, day = 1] = values;
  if (!year) return "";
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function normalizeWork(work) {
  const doi = stripDoiUrl(work?.DOI || "");
  const authorNames = (Array.isArray(work?.author) ? work.author : []).map(author => {
    const given = cleanText(author?.given || "", 120);
    const family = cleanText(author?.family || "", 120);
    return cleanText(`${given} ${family}`, 200);
  });
  const institutions = [];
  for (const author of Array.isArray(work?.author) ? work.author : []) {
    for (const institution of Array.isArray(author?.affiliation) ? author.affiliation : []) {
      institutions.push(institution?.name || "");
    }
  }
  const keywords = cleanArray(work?.subject || [], 64, 120);

  return normalizePaperItem({
    sourceName: SOURCE_NAME,
    sourceType: SOURCE_TYPE,
    externalId: doi || cleanText(work?.URL || "", 200),
    doi,
    title: Array.isArray(work?.title) ? work.title[0] : work?.title,
    abstract: decodeCrossrefAbstract(work?.abstract || ""),
    authors: cleanArray(authorNames, 128, 200),
    institutions: cleanArray(institutions, 128, 200),
    publicationDate: firstDate(work?.published?.["date-parts"] || work?.issued?.["date-parts"]),
    sourceUrl: safeUrl(work?.URL || (doi ? `https://doi.org/${doi}` : "")),
    journalOrVenue: Array.isArray(work?.["container-title"]) ? work["container-title"][0] : "",
    topics: inferTopicsFromKeywords(keywords),
    keywords,
    citationsCount: Number(work?.["is-referenced-by-count"]) || 0,
    openAccessUrl: safeUrl(work?.resource?.primary?.URL || ""),
    rawData: work && typeof work === "object" ? work : {}
  });
}

async function fetchCrossref(url) {
  await limitRequest();
  return requestJson(url, {
    headers: {
      "User-Agent": OPENALEX_EMAIL
        ? `BCC-Intelligence/1.0 (mailto:${OPENALEX_EMAIL})`
        : "BCC-Intelligence/1.0"
    },
    timeoutMs: 20000
  });
}

function buildFilter(query) {
  const filters = [];
  if (query.fromDate) filters.push(`from-pub-date:${query.fromDate}`);
  if (query.toDate) filters.push(`until-pub-date:${query.toDate}`);
  return filters.join(",");
}

const crossrefConnector = {
  sourceName: SOURCE_NAME,
  sourceType: SOURCE_TYPE,
  baseUrl: "https://api.crossref.org",
  requiresApiKey: false,
  rateLimitNotes: "No API key required. Uses a conservative interval around 1.2 seconds.",
  async search(query) {
    const normalized = normalizeQuery(query);
    const searchText = buildSearchText(normalized);
    const url = new URL(API_URL);
    if (searchText) url.searchParams.set("query", searchText);
    url.searchParams.set("rows", String(normalized.limit));
    url.searchParams.set("sort", "published");
    url.searchParams.set("order", "desc");
    const filter = buildFilter(normalized);
    if (filter) url.searchParams.set("filter", filter);
    if (OPENALEX_EMAIL) url.searchParams.set("mailto", OPENALEX_EMAIL);

    try {
      const payload = await fetchCrossref(url.toString());
      return (payload?.message?.items || []).map(normalizeWork).filter(item => item.externalId && item.title);
    } catch (error) {
      throw new Error(`Crossref search failed for "${searchText || "default"}": ${error.message}`);
    }
  },
  async fetchById(id) {
    const doi = stripDoiUrl(id);
    if (!doi) return null;
    const url = new URL(`${API_URL}/${encodeURIComponent(doi)}`);
    if (OPENALEX_EMAIL) url.searchParams.set("mailto", OPENALEX_EMAIL);

    try {
      const payload = await fetchCrossref(url.toString());
      return normalizeWork(payload?.message || {});
    } catch (error) {
      throw new Error(`Crossref fetchById failed for "${doi}": ${error.message}`);
    }
  }
};

export default crossrefConnector;
export const crossref = crossrefConnector;
