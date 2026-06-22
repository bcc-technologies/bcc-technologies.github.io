import { createRateLimiter, requestJson } from "../http.mjs";
import {
  buildSearchText,
  cleanArray,
  cleanText,
  normalizeGrantItem,
  normalizeQuery,
  safeUrl
} from "./base.mjs";

const SOURCE_NAME = "NIH RePORTER";
const SOURCE_TYPE = "nih_reporter";
const API_URL = "https://api.reporter.nih.gov/v2/projects/search";
const limitRequest = createRateLimiter(1100);
const INCLUDE_FIELDS = [
  "ApplId",
  "ProjectTitle",
  "AbstractText",
  "AgencyIcAdmin",
  "FundingMechanism",
  "AwardAmount",
  "ProjectStartDate",
  "ProjectEndDate",
  "BudgetStart",
  "BudgetEnd",
  "PrincipalInvestigators",
  "Organization",
  "ProjectDetailUrl",
  "Terms",
  "PrefTerms",
  "AwardNoticeDate",
  "OpportunityNumber",
  "FiscalYear",
  "CoreProjectNum",
  "ProjectNum"
];

function buildAdvancedTextSearch(query) {
  const normalized = normalizeQuery(query);
  const searchText = buildSearchText(normalized);
  if (!searchText) return null;
  return {
    operator: "and",
    search_field: "projecttitle,abstracttext,terms",
    search_text: cleanText(searchText, 240)
  };
}

function parseTermString(value) {
  return cleanArray(
    String(value || "")
      .split(/<|>/g)
      .map(part => cleanText(part, 120))
      .filter(Boolean),
    128,
    120
  );
}

function normalizeGrant(result) {
  const principalInvestigators = cleanArray(
    (Array.isArray(result?.principal_investigators) ? result.principal_investigators : [])
      .map(pi => pi?.full_name || `${pi?.first_name || ""} ${pi?.last_name || ""}`),
    128,
    200
  );
  const adminAgency = result?.agency_ic_admin?.abbreviation || result?.agency_ic_admin?.name || "NIH";
  const organization = result?.organization || {};
  const topicTerms = cleanArray([
    ...parseTermString(result?.pref_terms || ""),
    ...parseTermString(result?.terms || "")
  ], 128, 120);

  return normalizeGrantItem({
    sourceName: SOURCE_NAME,
    sourceType: SOURCE_TYPE,
    externalId: cleanText(result?.appl_id || result?.project_num || result?.core_project_num || "", 200),
    title: result?.project_title || "",
    abstract: result?.abstract_text || "",
    agency: adminAgency,
    program: cleanText(result?.funding_mechanism || result?.opportunity_number || "", 220),
    amount: result?.award_amount,
    currency: "USD",
    startDate: result?.budget_start || result?.project_start_date || result?.award_notice_date || "",
    endDate: result?.budget_end || result?.project_end_date || "",
    principalInvestigators,
    institutions: cleanArray([organization?.org_name || ""], 128, 200),
    country: cleanText(organization?.org_country || "", 120),
    sourceUrl: safeUrl(result?.project_detail_url || ""),
    topics: cleanArray(topicTerms, 64, 120),
    rawData: result && typeof result === "object" ? result : {}
  });
}

async function fetchReporter(body) {
  await limitRequest();
  return requestJson(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body),
    timeoutMs: 25000
  });
}

const nihReporterConnector = {
  sourceName: SOURCE_NAME,
  sourceType: SOURCE_TYPE,
  baseUrl: "https://api.reporter.nih.gov",
  requiresApiKey: false,
  supportsActions: ["fetch_grants"],
  itemKind: "grant",
  rateLimitNotes: "Public NIH RePORTER v2 API. Keep request volume around one call per second and prefer focused grant queries.",
  async search(query) {
    const normalized = normalizeQuery(query);
    const advancedText = buildAdvancedTextSearch(normalized);
    if (!advancedText) return [];

    const body = {
      criteria: {
        advanced_text_search: advancedText,
        include_active_projects: true
      },
      include_fields: INCLUDE_FIELDS,
      limit: normalized.limit,
      offset: 0
    };

    try {
      const payload = await fetchReporter(body);
      return (payload?.results || []).map(normalizeGrant).filter(item => item.externalId && item.title);
    } catch (error) {
      throw new Error(`NIH RePORTER search failed for "${buildSearchText(normalized) || "default"}": ${error.message}`);
    }
  },
  async fetchById(id) {
    const applId = Number(cleanText(id, 32));
    if (!Number.isFinite(applId) || applId <= 0) return null;

    const body = {
      criteria: {
        appl_ids: [applId]
      },
      include_fields: INCLUDE_FIELDS,
      limit: 1,
      offset: 0
    };

    try {
      const payload = await fetchReporter(body);
      return normalizeGrant((payload?.results || [])[0] || {});
    } catch (error) {
      throw new Error(`NIH RePORTER fetchById failed for "${applId}": ${error.message}`);
    }
  }
};

export default nihReporterConnector;
export const nihReporter = nihReporterConnector;
