import { createRateLimiter, requestText } from "../http.mjs";
import {
  buildSearchText,
  cleanArray,
  cleanText,
  getXmlTag,
  inferTopicsFromKeywords,
  normalizeArxivId,
  normalizePaperItem,
  normalizeQuery,
  safeUrl
} from "./base.mjs";

const SOURCE_NAME = "arXiv";
const SOURCE_TYPE = "arxiv";
const SOURCE_URL = "https://arxiv.org";
const API_URL = "https://export.arxiv.org/api/query";
const limitRequest = createRateLimiter(3500);

function parseEntry(entry) {
  const externalId = normalizeArxivId(getXmlTag(entry, "id"));
  const linkMatch = entry.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/i);
  const doiMatch = entry.match(/<arxiv:doi[^>]*>([\s\S]*?)<\/arxiv:doi>/i);
  const categoryMatches = Array.from(entry.matchAll(/<category[^>]*term="([^"]+)"/gi));
  const primaryCategory = entry.match(/<arxiv:primary_category[^>]*term="([^"]+)"/i)?.[1] || "";
  const authorMatches = Array.from(entry.matchAll(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/gi));

  return normalizePaperItem({
    sourceName: SOURCE_NAME,
    sourceType: SOURCE_TYPE,
    externalId,
    arxivId: externalId,
    doi: doiMatch ? doiMatch[1] : "",
    title: getXmlTag(entry, "title"),
    abstract: getXmlTag(entry, "summary"),
    authors: authorMatches.map(match => match[1]),
    institutions: [],
    publicationDate: getXmlTag(entry, "published"),
    sourceUrl: safeUrl(linkMatch ? linkMatch[1] : `https://arxiv.org/abs/${externalId}`),
    journalOrVenue: getXmlTag(entry, "arxiv:journal_ref") || "arXiv",
    topics: inferTopicsFromKeywords([primaryCategory, ...categoryMatches.map(match => match[1])]),
    keywords: cleanArray([primaryCategory, ...categoryMatches.map(match => match[1])], 32, 80),
    citationsCount: 0,
    openAccessUrl: externalId ? `https://arxiv.org/pdf/${externalId}.pdf` : "",
    rawData: {
      id: getXmlTag(entry, "id"),
      updated: getXmlTag(entry, "updated"),
      published: getXmlTag(entry, "published"),
      title: getXmlTag(entry, "title"),
      summary: getXmlTag(entry, "summary"),
      primaryCategory: cleanText(primaryCategory, 80),
      categories: cleanArray(categoryMatches.map(match => match[1]), 32, 80),
      authors: cleanArray(authorMatches.map(match => match[1]), 128, 200),
      comment: getXmlTag(entry, "arxiv:comment"),
      journalRef: getXmlTag(entry, "arxiv:journal_ref")
    }
  });
}

function parseArxivFeed(xml) {
  const entries = String(xml || "").match(/<entry>[\s\S]*?<\/entry>/g) || [];
  return entries.map(parseEntry).filter(item => item.externalId && item.title);
}

function buildArxivSearchQuery(query) {
  const normalized = normalizeQuery(query);
  const parts = [
    normalized.text,
    ...normalized.keywords,
    ...normalized.topics
  ].filter(Boolean);
  if (!parts.length) return "all:*";
  return parts.map(part => `all:"${String(part).replace(/"/g, "")}"`).join(" AND ");
}

async function fetchXml(url) {
  await limitRequest();
  return requestText(url, {
    headers: {
      "User-Agent": "BCC-Intelligence/1.0 (contact: intelligence@bcctechnologies.com.do)"
    },
    timeoutMs: 20000
  });
}

const arxivConnector = {
  sourceName: SOURCE_NAME,
  sourceType: SOURCE_TYPE,
  baseUrl: SOURCE_URL,
  requiresApiKey: false,
  rateLimitNotes: "Use a conservative interval around 1 request every 3.5 seconds.",
  async search(query) {
    const normalized = normalizeQuery(query);
    const url = new URL(API_URL);
    url.searchParams.set("search_query", buildArxivSearchQuery(normalized));
    url.searchParams.set("start", "0");
    url.searchParams.set("max_results", String(normalized.limit));
    url.searchParams.set("sortBy", "lastUpdatedDate");
    url.searchParams.set("sortOrder", "descending");

    try {
      const xml = await fetchXml(url.toString());
      return parseArxivFeed(xml);
    } catch (error) {
      throw new Error(`arXiv search failed for "${buildSearchText(normalized) || "all:*"}": ${error.message}`);
    }
  },
  async fetchById(id) {
    const arxivId = normalizeArxivId(id);
    if (!arxivId) return null;

    const url = new URL(API_URL);
    url.searchParams.set("id_list", arxivId);
    url.searchParams.set("max_results", "1");

    try {
      const xml = await fetchXml(url.toString());
      return parseArxivFeed(xml)[0] || null;
    } catch (error) {
      throw new Error(`arXiv fetchById failed for "${arxivId}": ${error.message}`);
    }
  }
};

export default arxivConnector;
export const arxiv = arxivConnector;
