import { createRateLimiter, requestJson } from "../http.mjs";
import {
  buildSearchText,
  cleanArray,
  cleanText,
  inferTopicsFromKeywords,
  normalizeArxivId,
  normalizePaperItem,
  normalizeQuery,
  safeUrl,
  stripDoiUrl
} from "./base.mjs";

const SOURCE_NAME = "Semantic Scholar";
const SOURCE_TYPE = "semantic_scholar";
const API_URL = "https://api.semanticscholar.org/graph/v1/paper";
const SEMANTIC_SCHOLAR_API_KEY = String(process.env.SEMANTIC_SCHOLAR_API_KEY || "").trim();
const limitRequest = createRateLimiter(SEMANTIC_SCHOLAR_API_KEY ? 500 : 1200);
const SEMANTIC_SCHOLAR_MAX_TERMS = 8;
const SEMANTIC_SCHOLAR_MAX_SEARCH_CHARS = 180;
const PAPER_FIELDS = [
  "paperId",
  "externalIds",
  "title",
  "abstract",
  "authors",
  "year",
  "publicationDate",
  "url",
  "venue",
  "journal",
  "citationCount",
  "openAccessPdf",
  "publicationTypes",
  "fieldsOfStudy"
].join(",");

function compactSemanticScholarSearch(query) {
  const normalized = normalizeQuery(query);
  if (normalized.text) {
    return cleanText(normalized.text, SEMANTIC_SCHOLAR_MAX_SEARCH_CHARS);
  }

  const terms = cleanArray(
    [...(normalized.keywords || []), ...(normalized.topics || [])],
    SEMANTIC_SCHOLAR_MAX_TERMS,
    80
  );

  let search = "";
  for (const term of terms) {
    const next = search ? `${search} ${term}` : term;
    if (next.length > SEMANTIC_SCHOLAR_MAX_SEARCH_CHARS) break;
    search = next;
  }
  return search;
}

function institutionList(authors) {
  const names = [];
  for (const author of Array.isArray(authors) ? authors : []) {
    for (const affiliation of Array.isArray(author?.affiliations) ? author.affiliations : []) {
      if (typeof affiliation === "string") {
        names.push(affiliation);
      } else {
        names.push(affiliation?.name || "");
      }
    }
  }
  return cleanArray(names, 128, 200);
}

function externalIdFromPaper(paper) {
  return cleanText(
    paper?.paperId
      || paper?.externalIds?.CorpusId
      || paper?.externalIds?.PubMed
      || paper?.externalIds?.PubMedCentral
      || "",
    200
  );
}

function normalizePaper(paper) {
  const fieldsOfStudy = cleanArray(paper?.fieldsOfStudy || [], 32, 120);
  const publicationTypes = cleanArray(paper?.publicationTypes || [], 16, 80);
  const authors = cleanArray((paper?.authors || []).map(author => author?.name || ""), 128, 200);

  return normalizePaperItem({
    sourceName: SOURCE_NAME,
    sourceType: SOURCE_TYPE,
    externalId: externalIdFromPaper(paper),
    doi: stripDoiUrl(paper?.externalIds?.DOI || paper?.externalIds?.Doi || ""),
    arxivId: normalizeArxivId(paper?.externalIds?.ArXiv || paper?.externalIds?.ARXIV || ""),
    title: paper?.title || "",
    abstract: paper?.abstract || "",
    authors,
    institutions: institutionList(paper?.authors),
    publicationDate: paper?.publicationDate || paper?.year || "",
    sourceUrl: safeUrl(paper?.url || ""),
    journalOrVenue: cleanText(paper?.journal?.name || paper?.venue || "", 240),
    topics: inferTopicsFromKeywords(fieldsOfStudy),
    keywords: cleanArray([...fieldsOfStudy, ...publicationTypes], 128, 120),
    citationsCount: Number(paper?.citationCount) || 0,
    openAccessUrl: safeUrl(paper?.openAccessPdf?.url || ""),
    rawData: paper && typeof paper === "object" ? paper : {}
  });
}

async function fetchSemanticScholar(url) {
  await limitRequest();
  return requestJson(url, {
    headers: {
      ...(SEMANTIC_SCHOLAR_API_KEY ? { "x-api-key": SEMANTIC_SCHOLAR_API_KEY } : {})
    },
    timeoutMs: 20000
  });
}

const semanticScholarConnector = {
  sourceName: SOURCE_NAME,
  sourceType: SOURCE_TYPE,
  baseUrl: "https://api.semanticscholar.org",
  requiresApiKey: false,
  rateLimitNotes: SEMANTIC_SCHOLAR_API_KEY
    ? "Uses SEMANTIC_SCHOLAR_API_KEY with a conservative interval around 0.5 seconds and trimmed field selection."
    : "Works without SEMANTIC_SCHOLAR_API_KEY for basic search, but keep limits low and expect tighter rate limits.",
  async search(query) {
    const normalized = normalizeQuery(query);
    const searchText = compactSemanticScholarSearch(normalized) || buildSearchText(normalized);
    const url = new URL(`${API_URL}/search`);
    if (searchText) url.searchParams.set("query", searchText);
    url.searchParams.set("limit", String(normalized.limit));
    url.searchParams.set("fields", PAPER_FIELDS);

    try {
      const payload = await fetchSemanticScholar(url.toString());
      return (payload?.data || []).map(normalizePaper).filter(item => item.externalId && item.title);
    } catch (error) {
      throw new Error(`Semantic Scholar search failed for "${searchText || "default"}": ${error.message}`);
    }
  },
  async fetchById(id) {
    const paperId = cleanText(id, 200);
    if (!paperId) return null;
    const url = new URL(`${API_URL}/${encodeURIComponent(paperId)}`);
    url.searchParams.set("fields", PAPER_FIELDS);

    try {
      const payload = await fetchSemanticScholar(url.toString());
      return normalizePaper(payload);
    } catch (error) {
      throw new Error(`Semantic Scholar fetchById failed for "${paperId}": ${error.message}`);
    }
  }
};

export default semanticScholarConnector;
export const semanticScholar = semanticScholarConnector;
