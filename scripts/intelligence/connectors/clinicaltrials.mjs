import { createRateLimiter, requestJson } from "../http.mjs";
import {
  buildSearchText,
  cleanArray,
  cleanText,
  normalizeQuery,
  normalizeTrialItem
} from "./base.mjs";

const SOURCE_NAME = "ClinicalTrials.gov";
const SOURCE_TYPE = "clinicaltrials";
const API_URL = "https://clinicaltrials.gov/api/v2/studies";
const limitRequest = createRateLimiter(900);

function buildSearchTerm(query) {
  const normalized = normalizeQuery(query);
  const text = buildSearchText(normalized);
  return cleanText(text || "microscopy", 240);
}

function cleanPhase(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\bPHASE\b/gi, "Phase")
    .replace(/\bNA\b/gi, "N/A")
    .trim();
}

function trialLocations(module = {}) {
  return cleanArray(
    (Array.isArray(module.locations) ? module.locations : []).map(location =>
      [
        location?.facility || "",
        location?.city || "",
        location?.state || "",
        location?.country || ""
      ].filter(Boolean).join(", ")
    ),
    128,
    200
  );
}

function trialCountries(module = {}) {
  return cleanArray(
    (Array.isArray(module.locations) ? module.locations : []).map(location => location?.country || ""),
    64,
    120
  );
}

function trialInterventions(armsModule = {}) {
  const arms = Array.isArray(armsModule.armGroups) ? armsModule.armGroups : [];
  const interventions = Array.isArray(armsModule.interventions) ? armsModule.interventions : [];
  return cleanArray([
    ...arms.flatMap(arm => Array.isArray(arm?.interventionNames) ? arm.interventionNames : []),
    ...interventions.map(intervention => {
      const type = cleanText(intervention?.type || "", 40);
      const name = cleanText(intervention?.name || "", 160);
      return [type, name].filter(Boolean).join(": ");
    })
  ], 128, 200);
}

function normalizeTrial(study = {}) {
  const protocol = study?.protocolSection && typeof study.protocolSection === "object" ? study.protocolSection : {};
  const identification = protocol.identificationModule && typeof protocol.identificationModule === "object" ? protocol.identificationModule : {};
  const status = protocol.statusModule && typeof protocol.statusModule === "object" ? protocol.statusModule : {};
  const sponsors = protocol.sponsorCollaboratorsModule && typeof protocol.sponsorCollaboratorsModule === "object" ? protocol.sponsorCollaboratorsModule : {};
  const description = protocol.descriptionModule && typeof protocol.descriptionModule === "object" ? protocol.descriptionModule : {};
  const conditions = protocol.conditionsModule && typeof protocol.conditionsModule === "object" ? protocol.conditionsModule : {};
  const design = protocol.designModule && typeof protocol.designModule === "object" ? protocol.designModule : {};
  const locations = protocol.contactsLocationsModule && typeof protocol.contactsLocationsModule === "object" ? protocol.contactsLocationsModule : {};
  const arms = protocol.armsInterventionsModule && typeof protocol.armsInterventionsModule === "object" ? protocol.armsInterventionsModule : {};
  const collaborators = Array.isArray(sponsors.collaborators) ? sponsors.collaborators : [];
  const nctId = cleanText(identification.nctId || "", 80);
  const keywords = cleanArray([
    ...(Array.isArray(conditions.keywords) ? conditions.keywords : []),
    ...(Array.isArray(conditions.conditions) ? conditions.conditions : []),
    ...(Array.isArray(design.phases) ? design.phases.map(cleanPhase) : []),
    ...trialInterventions(arms)
  ], 128, 120);

  return normalizeTrialItem({
    sourceName: SOURCE_NAME,
    sourceType: SOURCE_TYPE,
    externalId: nctId,
    title: identification.briefTitle || identification.officialTitle || "",
    summary: description.briefSummary || description.detailedDescription || "",
    conditions: Array.isArray(conditions.conditions) ? conditions.conditions : [],
    interventions: trialInterventions(arms),
    phase: cleanArray((Array.isArray(design.phases) ? design.phases : []).map(cleanPhase), 8, 120).join(", "),
    status: cleanText(status.overallStatus || status.lastKnownStatus || "", 120),
    studyType: cleanText(design.studyType || "", 120),
    sponsor: sponsors?.leadSponsor?.name || identification?.organization?.fullName || "",
    collaborators: collaborators.map(item => item?.name || ""),
    startDate: status?.startDateStruct?.date || "",
    completionDate: status?.completionDateStruct?.date || status?.primaryCompletionDateStruct?.date || "",
    locations: trialLocations(locations),
    countries: trialCountries(locations),
    sourceUrl: nctId ? `https://clinicaltrials.gov/study/${nctId}` : "",
    topics: [],
    keywords,
    rawData: study && typeof study === "object" ? study : {}
  });
}

async function fetchStudies(query) {
  const normalized = normalizeQuery(query);
  const url = new URL(API_URL);
  url.searchParams.set("format", "json");
  url.searchParams.set("pageSize", String(normalized.limit));
  url.searchParams.set("query.term", buildSearchTerm(normalized));
  await limitRequest();
  const payload = await requestJson(url.toString(), { timeoutMs: 25000 });
  return (Array.isArray(payload?.studies) ? payload.studies : [])
    .map(normalizeTrial)
    .filter(item => item.externalId && item.title);
}

const clinicalTrialsConnector = {
  sourceName: SOURCE_NAME,
  sourceType: SOURCE_TYPE,
  baseUrl: "https://clinicaltrials.gov",
  requiresApiKey: false,
  supportsActions: ["fetch_trials"],
  itemKind: "trial",
  rateLimitNotes: "Public ClinicalTrials.gov v2 API. Keep searches topic-focused and page sizes moderate because a single trial payload is dense.",
  async search(query) {
    const normalized = normalizeQuery(query);
    const label = buildSearchText(normalized) || "default";
    try {
      return await fetchStudies(normalized);
    } catch (error) {
      throw new Error(`ClinicalTrials.gov search failed for "${label}": ${error.message}`);
    }
  },
  async fetchById(id) {
    const externalId = cleanText(id, 80);
    if (!externalId) return null;
    const url = new URL(`${API_URL}/${encodeURIComponent(externalId)}`);
    url.searchParams.set("format", "json");
    try {
      await limitRequest();
      const payload = await requestJson(url.toString(), { timeoutMs: 25000 });
      return normalizeTrial(payload);
    } catch (error) {
      throw new Error(`ClinicalTrials.gov fetchById failed for "${externalId}": ${error.message}`);
    }
  }
};

export default clinicalTrialsConnector;
export const clinicalTrials = clinicalTrialsConnector;
