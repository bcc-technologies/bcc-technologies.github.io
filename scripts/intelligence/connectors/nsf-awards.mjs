import { createRateLimiter, requestJson } from "../http.mjs";
import {
  buildSearchText,
  cleanArray,
  cleanText,
  normalizeGrantItem,
  normalizeQuery,
  safeUrl
} from "./base.mjs";

const SOURCE_NAME = "NSF Awards";
const SOURCE_TYPE = "nsf";
const API_URL = "https://api.nsf.gov/services/v1/awards.json";
const limitRequest = createRateLimiter(1000);
const PRINT_FIELDS = [
  "id",
  "title",
  "abstractText",
  "fundsObligatedAmt",
  "date",
  "expDate",
  "awardeeName",
  "awardeeCountryCode",
  "piFirstName",
  "piLastName",
  "pdPIName",
  "poName",
  "fundProgramName",
  "program",
  "agency",
  "awardAgencyCode",
  "startDate"
].join(",");

function normalizeDateText(value) {
  const text = cleanText(value, 32);
  if (!text) return "";
  const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) {
    const [, month, day, year] = match;
    return `${year}-${month}-${day}`;
  }
  return text;
}

function principalInvestigators(award) {
  const explicit = cleanArray(
    [
      cleanText(`${award?.piFirstName || ""} ${award?.piLastName || ""}`, 200),
      award?.pdPIName || ""
    ],
    8,
    200
  );
  return explicit;
}

function topicHints(award) {
  return cleanArray([
    award?.fundProgramName || "",
    award?.program || "",
    award?.primaryProgram || ""
  ], 64, 120);
}

function normalizeAward(award) {
  return normalizeGrantItem({
    sourceName: SOURCE_NAME,
    sourceType: SOURCE_TYPE,
    externalId: cleanText(award?.id || "", 200),
    title: award?.title || "",
    abstract: award?.abstractText || "",
    agency: cleanText(award?.agency || "NSF", 180),
    program: cleanText(award?.fundProgramName || award?.program || "", 220),
    amount: award?.fundsObligatedAmt,
    currency: "USD",
    startDate: normalizeDateText(award?.startDate || award?.date || ""),
    endDate: normalizeDateText(award?.expDate || ""),
    principalInvestigators: principalInvestigators(award),
    institutions: cleanArray([award?.awardeeName || award?.awardee || ""], 128, 200),
    country: cleanText(award?.awardeeCountryCode || "", 120),
    sourceUrl: safeUrl(award?.id ? `https://www.nsf.gov/awardsearch/showAward?AWD_ID=${award.id}` : ""),
    topics: topicHints(award),
    rawData: award && typeof award === "object" ? award : {}
  });
}

async function fetchNsf(url) {
  await limitRequest();
  return requestJson(url, { timeoutMs: 20000 });
}

function buildQuery(query) {
  const normalized = normalizeQuery(query);
  const searchText = buildSearchText(normalized);
  return {
    normalized,
    searchText: cleanText(searchText, 240)
  };
}

const nsfAwardsConnector = {
  sourceName: SOURCE_NAME,
  sourceType: SOURCE_TYPE,
  baseUrl: "https://api.nsf.gov",
  requiresApiKey: false,
  supportsActions: ["fetch_grants"],
  itemKind: "grant",
  rateLimitNotes: "Public NSF Award Search API. Keep focused searches and around one request per second.",
  async search(query) {
    const { normalized, searchText } = buildQuery(query);
    if (!searchText) return [];
    const url = new URL(API_URL);
    url.searchParams.set("keyword", searchText);
    url.searchParams.set("printFields", PRINT_FIELDS);
    url.searchParams.set("rpp", String(normalized.limit));
    url.searchParams.set("offset", "1");

    try {
      const payload = await fetchNsf(url.toString());
      return ((payload?.response?.award) || []).map(normalizeAward).filter(item => item.externalId && item.title);
    } catch (error) {
      throw new Error(`NSF Awards search failed for "${searchText || "default"}": ${error.message}`);
    }
  },
  async fetchById(id) {
    const awardId = cleanText(id, 40);
    if (!awardId) return null;
    const url = new URL(API_URL);
    url.searchParams.set("id", awardId);
    url.searchParams.set("printFields", PRINT_FIELDS);

    try {
      const payload = await fetchNsf(url.toString());
      return normalizeAward(((payload?.response?.award) || [])[0] || {});
    } catch (error) {
      throw new Error(`NSF Awards fetchById failed for "${awardId}": ${error.message}`);
    }
  }
};

export default nsfAwardsConnector;
export const nsfAwards = nsfAwardsConnector;
