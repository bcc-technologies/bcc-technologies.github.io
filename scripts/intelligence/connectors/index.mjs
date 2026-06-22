import arxiv from "./arxiv.mjs";
import crossref from "./crossref.mjs";
import epoOps from "./epo-ops.mjs";
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
  epoOps,
  uspto
];

const DEFAULT_ACTION_CONNECTOR_TYPES = {
  sync_papers: ["arxiv", "openalex", "crossref", "semantic_scholar", "pubmed"],
  fetch_papers: ["arxiv", "openalex", "crossref", "semantic_scholar", "pubmed"],
  fetch_grants: ["nih_reporter", "nsf"],
  fetch_patents: ["epo_ops", "uspto"],
  generate_signals: []
};

export function getConnector(sourceType) {
  const key = String(sourceType || "").trim().toLowerCase();
  return CONNECTORS.find(connector => connector.sourceType === key) || null;
}

export function getConnectors(sourceTypes = [], action = "fetch_papers") {
  const requested = Array.isArray(sourceTypes) ? sourceTypes : [];
  const allowedActions = new Set([String(action || "").trim().toLowerCase()]);
  if (!requested.length) {
    return CONNECTORS.filter(connector => {
      const supported = Array.isArray(connector.supportsActions) ? connector.supportsActions : ["fetch_papers"];
      return (DEFAULT_ACTION_CONNECTOR_TYPES[action] || []).includes(connector.sourceType)
        && supported.some(item => allowedActions.has(String(item || "").trim().toLowerCase()));
    });
  }
  return requested
    .map(type => getConnector(type))
    .filter(Boolean)
    .filter(connector => {
      const supported = Array.isArray(connector.supportsActions) ? connector.supportsActions : ["fetch_papers"];
      return supported.some(item => allowedActions.has(String(item || "").trim().toLowerCase()));
    });
}
