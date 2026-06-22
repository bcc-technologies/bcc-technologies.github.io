import { createRateLimiter, requestJson, requestText } from "../http.mjs";
import {
  buildSearchText,
  cleanArray,
  cleanText,
  decodeXml,
  inferTopicsFromKeywords,
  normalizeDate,
  normalizePaperItem,
  normalizeQuery,
  safeUrl,
  stripDoiUrl
} from "./base.mjs";

const SOURCE_NAME = "PubMed";
const SOURCE_TYPE = "pubmed";
const API_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const NCBI_API_KEY = String(process.env.NCBI_API_KEY || "").trim();
const limitRequest = createRateLimiter(NCBI_API_KEY ? 250 : 1200);
const MONTH_MAP = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12"
};

function searchTerm(query) {
  const normalized = normalizeQuery(query);
  const parts = [
    normalized.text,
    ...normalized.keywords,
    ...normalized.topics
  ].filter(Boolean);
  const quoted = parts.slice(0, 12).map(part => `"${String(part).replace(/"/g, "")}"`);
  const term = quoted.length ? quoted.join(" AND ") : "all[sb]";
  const dateRange = normalized.fromDate || normalized.toDate
    ? ` AND ("${normalized.fromDate || "1900/01/01"}"[Date - Publication] : "${normalized.toDate || "3000/12/31"}"[Date - Publication])`
    : "";
  return `${term}${dateRange}`;
}

function xmlBlocks(xml, tag) {
  return String(xml || "").match(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}>`, "gi")) || [];
}

function firstMatch(block, pattern) {
  return String(block || "").match(pattern)?.[1] || "";
}

function articleTitle(article) {
  return decodeXml(firstMatch(article, /<ArticleTitle[^>]*>([\s\S]*?)<\/ArticleTitle>/i));
}

function articleAbstract(article) {
  return cleanText(
    Array.from(String(article || "").matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/gi))
      .map(match => decodeXml(match[1]))
      .join(" "),
    40000
  );
}

function articleAuthors(article) {
  const authors = [];
  for (const authorBlock of xmlBlocks(article, "Author")) {
    const collective = decodeXml(firstMatch(authorBlock, /<CollectiveName[^>]*>([\s\S]*?)<\/CollectiveName>/i));
    if (collective) {
      authors.push(collective);
      continue;
    }
    const foreName = decodeXml(firstMatch(authorBlock, /<ForeName[^>]*>([\s\S]*?)<\/ForeName>/i));
    const lastName = decodeXml(firstMatch(authorBlock, /<LastName[^>]*>([\s\S]*?)<\/LastName>/i));
    const fullName = cleanText(`${foreName} ${lastName}`, 200);
    if (fullName) authors.push(fullName);
  }
  return cleanArray(authors, 128, 200);
}

function articleInstitutions(article) {
  return cleanArray(
    Array.from(String(article || "").matchAll(/<Affiliation[^>]*>([\s\S]*?)<\/Affiliation>/gi))
      .map(match => decodeXml(match[1])),
    128,
    200
  );
}

function normalizeMonth(month) {
  const text = cleanText(month, 16);
  if (!text) return "";
  if (/^\d{1,2}$/.test(text)) return String(text).padStart(2, "0");
  return MONTH_MAP[text.slice(0, 3).toLowerCase()] || "";
}

function articlePublicationDate(article) {
  const electronicDate = firstMatch(article, /<ArticleDate[^>]*DateType="Electronic"[^>]*>([\s\S]*?)<\/ArticleDate>/i);
  if (electronicDate) {
    const year = firstMatch(electronicDate, /<Year>(\d{4})<\/Year>/i);
    const month = normalizeMonth(firstMatch(electronicDate, /<Month>([\s\S]*?)<\/Month>/i)) || "01";
    const day = cleanText(firstMatch(electronicDate, /<Day>(\d{1,2})<\/Day>/i), 2).padStart(2, "0") || "01";
    return normalizeDate(`${year}-${month}-${day}`);
  }

  const pubDateBlock = firstMatch(article, /<PubDate[^>]*>([\s\S]*?)<\/PubDate>/i);
  if (!pubDateBlock) return "";
  const year = firstMatch(pubDateBlock, /<Year>(\d{4})<\/Year>/i) || firstMatch(pubDateBlock, /(\d{4})/);
  const month = normalizeMonth(firstMatch(pubDateBlock, /<Month>([\s\S]*?)<\/Month>/i)) || "01";
  const day = cleanText(firstMatch(pubDateBlock, /<Day>(\d{1,2})<\/Day>/i), 2).padStart(2, "0") || "01";
  return year ? normalizeDate(`${year}-${month}-${day}`) : "";
}

function articleKeywords(article) {
  return cleanArray([
    ...Array.from(String(article || "").matchAll(/<Keyword\b[^>]*>([\s\S]*?)<\/Keyword>/gi)).map(match => decodeXml(match[1])),
    ...Array.from(String(article || "").matchAll(/<DescriptorName\b[^>]*>([\s\S]*?)<\/DescriptorName>/gi)).map(match => decodeXml(match[1]))
  ], 128, 120);
}

function articleId(article, idType) {
  return decodeXml(
    firstMatch(
      article,
      new RegExp(`<ArticleId[^>]*IdType="${idType}"[^>]*>([\\s\\S]*?)<\\/ArticleId>`, "i")
    )
  );
}

function normalizeArticle(article) {
  const pmid = decodeXml(firstMatch(article, /<PMID[^>]*>([\s\S]*?)<\/PMID>/i));
  const journalTitle = decodeXml(firstMatch(article, /<Journal[\s\S]*?<Title>([\s\S]*?)<\/Title>[\s\S]*?<\/Journal>/i));
  const keywords = articleKeywords(article);
  const pmcId = articleId(article, "pmc");

  return normalizePaperItem({
    sourceName: SOURCE_NAME,
    sourceType: SOURCE_TYPE,
    externalId: cleanText(pmid, 200),
    doi: stripDoiUrl(articleId(article, "doi")),
    title: articleTitle(article),
    abstract: articleAbstract(article),
    authors: articleAuthors(article),
    institutions: articleInstitutions(article),
    publicationDate: articlePublicationDate(article),
    sourceUrl: pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : "",
    journalOrVenue: journalTitle || "PubMed",
    topics: inferTopicsFromKeywords(keywords),
    keywords,
    citationsCount: 0,
    openAccessUrl: pmcId ? `https://pmc.ncbi.nlm.nih.gov/articles/${pmcId}/` : "",
    rawData: {
      pmid,
      doi: stripDoiUrl(articleId(article, "doi")),
      pmcId: cleanText(pmcId, 80),
      journalTitle: cleanText(journalTitle, 240),
      publicationDate: articlePublicationDate(article),
      keywords,
      sourceUrl: pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : "",
      openAccessUrl: pmcId ? `https://pmc.ncbi.nlm.nih.gov/articles/${pmcId}/` : ""
    }
  });
}

function parsePubMedArticles(xml) {
  return xmlBlocks(xml, "PubmedArticle").map(normalizeArticle).filter(item => item.externalId && item.title);
}

async function ncbiJson(url) {
  await limitRequest();
  return requestJson(url, { timeoutMs: 20000 });
}

async function ncbiXml(url) {
  await limitRequest();
  return requestText(url, { timeoutMs: 25000 });
}

async function fetchPubMedArticles(query) {
  const normalized = normalizeQuery(query);
  const searchUrl = new URL(`${API_URL}/esearch.fcgi`);
  searchUrl.searchParams.set("db", "pubmed");
  searchUrl.searchParams.set("retmode", "json");
  searchUrl.searchParams.set("sort", "pub date");
  searchUrl.searchParams.set("retmax", String(normalized.limit));
  searchUrl.searchParams.set("term", searchTerm(normalized));
  if (NCBI_API_KEY) searchUrl.searchParams.set("api_key", NCBI_API_KEY);

  const searchPayload = await ncbiJson(searchUrl.toString());
  const ids = cleanArray(searchPayload?.esearchresult?.idlist || [], normalized.limit, 24);
  if (!ids.length) return [];

  const fetchUrl = new URL(`${API_URL}/efetch.fcgi`);
  fetchUrl.searchParams.set("db", "pubmed");
  fetchUrl.searchParams.set("retmode", "xml");
  fetchUrl.searchParams.set("id", ids.join(","));
  if (NCBI_API_KEY) fetchUrl.searchParams.set("api_key", NCBI_API_KEY);

  const xml = await ncbiXml(fetchUrl.toString());
  return parsePubMedArticles(xml);
}

const pubmedConnector = {
  sourceName: SOURCE_NAME,
  sourceType: SOURCE_TYPE,
  baseUrl: "https://pubmed.ncbi.nlm.nih.gov",
  requiresApiKey: false,
  rateLimitNotes: NCBI_API_KEY
    ? "Uses NCBI_API_KEY with a conservative interval around 0.25 seconds and a two-step esearch + efetch flow."
    : "Works without NCBI_API_KEY, but keep manual sync volume low because NCBI rate limits are tighter without a key.",
  async search(query) {
    const normalized = normalizeQuery(query);
    const label = buildSearchText(normalized) || "default";
    try {
      return await fetchPubMedArticles(normalized);
    } catch (error) {
      throw new Error(`PubMed search failed for "${label}": ${error.message}`);
    }
  },
  async fetchById(id) {
    const pmid = cleanText(id, 200);
    if (!pmid) return null;
    const fetchUrl = new URL(`${API_URL}/efetch.fcgi`);
    fetchUrl.searchParams.set("db", "pubmed");
    fetchUrl.searchParams.set("retmode", "xml");
    fetchUrl.searchParams.set("id", pmid);
    if (NCBI_API_KEY) fetchUrl.searchParams.set("api_key", NCBI_API_KEY);

    try {
      const xml = await ncbiXml(fetchUrl.toString());
      return parsePubMedArticles(xml)[0] || null;
    } catch (error) {
      throw new Error(`PubMed fetchById failed for "${pmid}": ${error.message}`);
    }
  }
};

export default pubmedConnector;
export const pubmed = pubmedConnector;
