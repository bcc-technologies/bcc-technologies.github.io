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

const SOURCE_NAME = "OpenAlex";
const SOURCE_TYPE = "openalex";
const API_URL = "https://api.openalex.org/works";
const OPENALEX_API_KEY = String(process.env.OPENALEX_API_KEY || "").trim();
const OPENALEX_EMAIL = String(process.env.OPENALEX_EMAIL || "").trim();
const limitRequest = createRateLimiter(1200);
const WORK_SELECT_FIELDS = [
  "id",
  "doi",
  "ids",
  "display_name",
  "abstract_inverted_index",
  "authorships",
  "publication_date",
  "primary_location",
  "best_oa_location",
  "locations",
  "host_venue",
  "concepts",
  "keywords",
  "cited_by_count"
].join(",");

function reconstructAbstract(index) {
  if (!index || typeof index !== "object") return "";
  const words = [];
  for (const [token, positions] of Object.entries(index)) {
    for (const position of Array.isArray(positions) ? positions : []) {
      words[position] = token;
    }
  }
  return cleanText(words.filter(Boolean).join(" "), 40000);
}

function buildInstitutionList(authorships) {
  const names = [];
  for (const authorship of Array.isArray(authorships) ? authorships : []) {
    for (const institution of Array.isArray(authorship?.institutions) ? authorship.institutions : []) {
      names.push(institution?.display_name || "");
    }
  }
  return cleanArray(names, 128, 200);
}

function normalizeWork(work) {
  const concepts = cleanArray((work?.concepts || []).map(concept => concept?.display_name || ""), 32, 120);
  const locations = Array.isArray(work?.locations) ? work.locations : [];
  const bestOpenAccessUrl = safeUrl(work?.best_oa_location?.landing_page_url || work?.best_oa_location?.pdf_url || "");
  const doi = stripDoiUrl(work?.doi || "");

  return normalizePaperItem({
    sourceName: SOURCE_NAME,
    sourceType: SOURCE_TYPE,
    externalId: cleanText(String(work?.id || "").split("/").pop(), 200),
    doi,
    arxivId: work?.ids?.arxiv || "",
    title: work?.display_name || "",
    abstract: reconstructAbstract(work?.abstract_inverted_index),
    authors: cleanArray((work?.authorships || []).map(entry => entry?.author?.display_name || ""), 128, 200),
    institutions: buildInstitutionList(work?.authorships),
    publicationDate: work?.publication_date || work?.from_publication_date || "",
    sourceUrl: safeUrl(work?.primary_location?.landing_page_url || work?.doi || work?.id || ""),
    journalOrVenue: work?.primary_location?.source?.display_name || work?.host_venue?.display_name || "",
    topics: inferTopicsFromKeywords(concepts),
    keywords: cleanArray([
      ...concepts,
      ...(work?.keywords || []).map(item => item?.display_name || "")
    ], 128, 120),
    citationsCount: Number(work?.cited_by_count) || 0,
    openAccessUrl: bestOpenAccessUrl,
    rawData: {
      ...work,
      locations,
      concepts
    }
  });
}

async function fetchOpenAlex(url) {
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

const openAlexConnector = {
  sourceName: SOURCE_NAME,
  sourceType: SOURCE_TYPE,
  baseUrl: "https://api.openalex.org",
  requiresApiKey: true,
  rateLimitNotes: OPENALEX_API_KEY
    ? "Uses OPENALEX_API_KEY with a conservative interval around 1.2 seconds, trimmed select fields, and low default result volume to stay inside the free quota."
    : "OpenAlex now expects OPENALEX_API_KEY for normal usage. Without it, the daily quota is only suitable for demos or quick tests.",
  async search(query) {
    const normalized = normalizeQuery(query);
    const searchText = buildSearchText(normalized);
    const url = new URL(API_URL);
    if (OPENALEX_API_KEY) url.searchParams.set("api_key", OPENALEX_API_KEY);
    if (searchText) url.searchParams.set("search", searchText);
    url.searchParams.set("per-page", String(normalized.limit));
    url.searchParams.set("sort", "publication_date:desc");
    url.searchParams.set("select", WORK_SELECT_FIELDS);
    const filters = [];
    if (normalized.fromDate) filters.push(`from_publication_date:${normalized.fromDate}`);
    if (normalized.toDate) filters.push(`to_publication_date:${normalized.toDate}`);
    if (filters.length) url.searchParams.set("filter", filters.join(","));
    if (OPENALEX_EMAIL) url.searchParams.set("mailto", OPENALEX_EMAIL);

    try {
      const payload = await fetchOpenAlex(url.toString());
      return (payload?.results || []).map(normalizeWork).filter(item => item.externalId && item.title);
    } catch (error) {
      throw new Error(`OpenAlex search failed for "${searchText || "default"}": ${error.message}`);
    }
  },
  async fetchById(id) {
    const workId = cleanText(id, 200);
    if (!workId) return null;
    const canonicalId = /^https?:\/\//i.test(workId)
      ? String(workId).split("/").pop()
      : workId;
    const url = new URL(`${API_URL}/${canonicalId}`);
    if (OPENALEX_API_KEY) url.searchParams.set("api_key", OPENALEX_API_KEY);
    url.searchParams.set("select", WORK_SELECT_FIELDS);
    if (OPENALEX_EMAIL) url.searchParams.set("mailto", OPENALEX_EMAIL);

    try {
      const payload = await fetchOpenAlex(url.toString());
      return normalizeWork(payload);
    } catch (error) {
      throw new Error(`OpenAlex fetchById failed for "${workId}": ${error.message}`);
    }
  }
};

export default openAlexConnector;
export const openalex = openAlexConnector;
