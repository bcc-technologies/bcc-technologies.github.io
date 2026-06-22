import { Buffer } from "node:buffer";
import { createRateLimiter, requestJson, requestText } from "../http.mjs";
import {
  cleanArray,
  cleanText,
  decodeXml,
  normalizePatentItem,
  normalizeQuery,
  safeUrl
} from "./base.mjs";

const SOURCE_NAME = "EPO OPS";
const SOURCE_TYPE = "epo_ops";
const TOKEN_URL = "https://ops.epo.org/3.2/auth/accesstoken";
const SEARCH_URL = "https://ops.epo.org/3.2/rest-services/published-data/search/biblio";
const EPO_OPS_KEY = String(process.env.EPO_OPS_KEY || "").trim();
const EPO_OPS_SECRET = String(process.env.EPO_OPS_SECRET || "").trim();
const limitRequest = createRateLimiter(1400);
let cachedToken = null;
let cachedTokenExpiresAt = 0;

function ensureCredentials() {
  if (!EPO_OPS_KEY || !EPO_OPS_SECRET) {
    throw new Error("EPO OPS requires EPO_OPS_KEY and EPO_OPS_SECRET.");
  }
}

function basicAuth() {
  return Buffer.from(`${EPO_OPS_KEY}:${EPO_OPS_SECRET}`).toString("base64");
}

async function getAccessToken() {
  ensureCredentials();
  const now = Date.now();
  if (cachedToken && cachedTokenExpiresAt - now > 10000) {
    return cachedToken;
  }

  const payload = await requestJson(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth()}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json"
    },
    body: "grant_type=client_credentials",
    timeoutMs: 20000
  });
  cachedToken = cleanText(payload?.access_token || "", 4000);
  cachedTokenExpiresAt = now + (Math.max(60, Number(payload?.expires_in) || 3600) * 1000);
  return cachedToken;
}

async function requestOpsXml(url, extraHeaders = {}) {
  await limitRequest();
  const token = await getAccessToken();
  return requestText(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/xml, text/xml",
      ...extraHeaders
    },
    timeoutMs: 25000
  });
}

function xmlBlocks(xml, tag) {
  return String(xml || "").match(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}>`, "gi")) || [];
}

function firstMatch(block, pattern) {
  return String(block || "").match(pattern)?.[1] || "";
}

function personNames(block, tag) {
  return cleanArray(
    Array.from(String(block || "").matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi")))
      .map(match => decodeXml(match[1])),
    128,
    200
  );
}

function normalizePatentStatus(kind) {
  const value = cleanText(kind, 12).toUpperCase();
  if (!value) return "unknown";
  if (value.startsWith("A")) return "published";
  if (value.startsWith("B")) return "granted";
  return "unknown";
}

function parsePatentDocument(block) {
  const country = decodeXml(firstMatch(block, /country="([^"]+)"/i));
  const docNumber = decodeXml(firstMatch(block, /doc-number="([^"]+)"/i))
    || decodeXml(firstMatch(block, /<doc-number[^>]*>([\s\S]*?)<\/doc-number>/i));
  const kind = decodeXml(firstMatch(block, /kind="([^"]+)"/i))
    || decodeXml(firstMatch(block, /<kind[^>]*>([\s\S]*?)<\/kind>/i));
  const externalId = cleanText(`${country}${docNumber}${kind}`, 200);
  const title = decodeXml(firstMatch(block, /<invention-title[^>]*>([\s\S]*?)<\/invention-title>/i));
  const abstract = cleanText(
    Array.from(String(block || "").matchAll(/<abstract[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>[\s\S]*?<\/abstract>/gi))
      .map(match => decodeXml(match[1]))
      .join(" "),
    40000
  );
  const applicants = personNames(block, "applicant-name");
  const inventors = personNames(block, "inventor-name");
  const publicationDate = decodeXml(firstMatch(block, /<date[^>]*>(\d{8})<\/date>/i));
  const normalizedPublicationDate = publicationDate
    ? `${publicationDate.slice(0, 4)}-${publicationDate.slice(4, 6)}-${publicationDate.slice(6, 8)}`
    : "";
  const cpcs = cleanArray(
    Array.from(String(block || "").matchAll(/<classification-symbol[^>]*>([\s\S]*?)<\/classification-symbol>/gi))
      .map(match => decodeXml(match[1])),
    64,
    120
  );

  return normalizePatentItem({
    sourceName: SOURCE_NAME,
    sourceType: SOURCE_TYPE,
    externalId,
    title,
    abstract,
    inventors,
    assignees: applicants,
    publicationDate: normalizedPublicationDate,
    jurisdiction: country || "EP",
    status: normalizePatentStatus(kind),
    sourceUrl: safeUrl(externalId ? `https://worldwide.espacenet.com/patent/search/family/${externalId}` : ""),
    topics: cpcs,
    rawData: {
      externalId,
      country,
      docNumber,
      kind,
      cpcs
    }
  });
}

function parsePatentResults(xml) {
  const documents = xmlBlocks(xml, "exchange-document");
  return documents.map(parsePatentDocument).filter(item => item.externalId && item.title);
}

function buildPatentSearchText(query) {
  const normalized = normalizeQuery(query);
  return cleanText(
    [
      normalized.text,
      ...normalized.keywords,
      ...normalized.topics
    ].filter(Boolean).join(" "),
    180
  );
}

const epoOpsConnector = {
  sourceName: SOURCE_NAME,
  sourceType: SOURCE_TYPE,
  baseUrl: "https://ops.epo.org/3.2",
  requiresApiKey: true,
  supportsActions: ["fetch_patents"],
  itemKind: "patent",
  defaultEnabled: false,
  rateLimitNotes: EPO_OPS_KEY && EPO_OPS_SECRET
    ? "OPS needs OAuth credentials and fair-use discipline. Keep patent queries narrow and infrequent."
    : "EPO OPS is ready in code but disabled until EPO_OPS_KEY and EPO_OPS_SECRET are configured.",
  async search(query) {
    const text = buildPatentSearchText(query);
    if (!text) return [];
    ensureCredentials();
    const url = new URL(SEARCH_URL);
    url.searchParams.set("q", text);
    const limit = Math.min(25, Math.max(1, Number(query?.limit) || 10));
    try {
      const xml = await requestOpsXml(url.toString(), {
        Range: `1-${limit}`
      });
      return parsePatentResults(xml);
    } catch (error) {
      throw new Error(`EPO OPS search failed for "${text}": ${error.message}`);
    }
  },
  async fetchById(id) {
    const patentId = cleanText(id, 200);
    if (!patentId) return null;
    throw new Error(`EPO OPS fetchById is not implemented yet for "${patentId}". Use search-driven sync first.`);
  }
};

export default epoOpsConnector;
export const epoOps = epoOpsConnector;
