import arxiv from "./arxiv.mjs";
import crossref from "./crossref.mjs";
import openalex from "./openalex.mjs";
import nihReporter from "./nih-reporter.mjs";
import nsfAwards from "./nsf-awards.mjs";
import pubmed from "./pubmed.mjs";
import semanticScholar from "./semantic-scholar.mjs";
import uspto from "./uspto.mjs";

export const CONNECTORS = [
  arxiv,
  openalex,
  crossref,
  semanticScholar,
  pubmed,
  nihReporter,
  nsfAwards,
  uspto
];

export const ACTIVE_CONNECTOR_TYPES = ["arxiv", "openalex", "crossref", "semantic_scholar", "pubmed"];

export function getConnector(sourceType) {
  const key = String(sourceType || "").trim().toLowerCase();
  return CONNECTORS.find(connector => connector.sourceType === key) || null;
}

export function getConnectors(sourceTypes = []) {
  const requested = Array.isArray(sourceTypes) ? sourceTypes : [];
  if (!requested.length) {
    return CONNECTORS.filter(connector => ACTIVE_CONNECTOR_TYPES.includes(connector.sourceType));
  }
  return requested
    .map(type => getConnector(type))
    .filter(Boolean);
}
