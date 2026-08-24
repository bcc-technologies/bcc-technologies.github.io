const DEFAULT_ENDPOINT = "https://bglkyqiqzrcwegpjrucc.supabase.co/functions/v1/bcc-intelligence-api";
const EXPECTED_API_VERSION = "0.4";
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 1024 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SEARCH_TYPES = new Set(["signal", "paper", "grant"]);

export class IntelligenceAgentError extends Error {
  constructor(code, message, options = {}) {
    super(message);
    this.name = "IntelligenceAgentError";
    this.code = code;
    this.status = options.status ?? null;
    this.retryAfterSeconds = options.retryAfterSeconds ?? null;
    this.rateLimit = options.rateLimit ?? null;
    this.cause = options.cause;
  }
  toJSON() {
    return { code: this.code, message: this.message, status: this.status, retryAfterSeconds: this.retryAfterSeconds, rateLimit: this.rateLimit };
  }
}

const objectSchema = (properties = {}, required = []) => ({ type: "object", properties, required, additionalProperties: false });
const READ_ONLY = Object.freeze({ readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true });

export const intelligenceToolDefinitions = Object.freeze([
  {
    name: "search_intelligence",
    description: "Search BCC Science Radar signals, scientific papers, and grants. Read-only; returns ranked bounded results.",
    inputSchema: objectSchema({
      query: { type: "string", minLength: 2, maxLength: 240 },
      types: { type: "array", items: { type: "string", enum: ["signal", "paper", "grant"] }, minItems: 1, maxItems: 3, uniqueItems: true },
      line: { type: "string", maxLength: 80 }, source: { type: "string", maxLength: 120 },
      since: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" }, until: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
      includeArchived: { type: "boolean", default: false }, limit: { type: "integer", minimum: 1, maximum: 25, default: 15 }, offset: { type: "integer", minimum: 0, maximum: 200, default: 0 },
    }, ["query"]), annotations: READ_ONLY,
  },
  {
    name: "list_intelligence_signals",
    description: "List current BCC Science Radar signals with bounded filters. Read-only.",
    inputSchema: objectSchema({ line: { type: "string", maxLength: 80 }, status: { type: "string", maxLength: 80 }, signalType: { type: "string", maxLength: 80 }, minOpportunity: { type: "number", minimum: 0, maximum: 100 }, includeArchived: { type: "boolean", default: false }, limit: { type: "integer", minimum: 1, maximum: 50, default: 20 } }), annotations: READ_ONLY,
  },
  { name: "get_intelligence_signal", description: "Get one Science Radar signal by UUID, including score breakdown and evidence references. Read-only.", inputSchema: objectSchema({ id: { type: "string", format: "uuid" } }, ["id"]), annotations: READ_ONLY },
  { name: "get_signal_evidence", description: "Resolve typed evidence referenced by one Science Radar signal. Read-only.", inputSchema: objectSchema({ id: { type: "string", format: "uuid" }, limit: { type: "integer", minimum: 1, maximum: 25, default: 25 } }, ["id"]), annotations: READ_ONLY },
  { name: "get_radar_status", description: "Get bounded Science Radar corpus counts and API version. Read-only.", inputSchema: objectSchema(), annotations: READ_ONLY },
  { name: "get_recent_intelligence_runs", description: "Get recent Science Radar ingestion/sync runs and normalized source names. Read-only.", inputSchema: objectSchema({ status: { type: "string", maxLength: 80 }, actionType: { type: "string", maxLength: 80 }, limit: { type: "integer", minimum: 1, maximum: 30, default: 10 } }), annotations: READ_ONLY },
]);

const toolMap = new Map(intelligenceToolDefinitions.map(tool => [tool.name, tool]));
const compact = object => Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
const isPlainObject = value => Boolean(value) && typeof value === "object" && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));

function fail(message) { throw new IntelligenceAgentError("INVALID_ARGUMENT", message); }
function assertObject(input, tool) { if (!isPlainObject(input)) fail(`${tool} input must be an object.`); }
function assertKeys(input, keys, tool) { const bad = Object.keys(input).find(key => !keys.has(key)); if (bad) fail(`${tool} received unsupported field: ${bad}.`); }
function text(input, key, max, required = false) {
  if (!(key in input) || input[key] === undefined || input[key] === null || input[key] === "") { if (required) fail(`${key} is required.`); return undefined; }
  if (typeof input[key] !== "string") fail(`${key} must be a string.`);
  const value = input[key].trim(); if (!value || value.length > max) fail(`${key} must contain 1-${max} characters.`); return value;
}
function bool(input, key) { if (!(key in input) || input[key] === undefined || input[key] === null) return undefined; if (typeof input[key] !== "boolean") fail(`${key} must be a boolean.`); return input[key]; }
function number(input, key, min, max, integer = false) {
  if (!(key in input) || input[key] === undefined || input[key] === null) return undefined;
  const value = input[key]; if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) fail(`${key} must be ${integer ? "an integer" : "a number"} between ${min} and ${max}.`); return value;
}
function date(input, key) {
  const value = text(input, key, 10); if (value === undefined) return undefined; if (!DATE_RE.test(value)) fail(`${key} must use YYYY-MM-DD.`);
  const [y, m, d] = value.split("-").map(Number), parsed = new Date(Date.UTC(y, m - 1, d)); if (parsed.getUTCFullYear() !== y || parsed.getUTCMonth() !== m - 1 || parsed.getUTCDate() !== d) fail(`${key} must be a real calendar date.`); return value;
}
function uuid(input, key = "id") { const value = text(input, key, 64, true); if (!UUID_RE.test(value)) fail(`${key} must be a valid UUID.`); return value; }

const validators = Object.freeze({
  search_intelligence(input) {
    assertObject(input, "search_intelligence"); assertKeys(input, new Set(["query", "types", "line", "source", "since", "until", "includeArchived", "limit", "offset"]), "search_intelligence");
    const query = text(input, "query", 240, true); if (query.length < 2) fail("query must contain at least 2 characters.");
    let types; if (input.types !== undefined) { if (!Array.isArray(input.types) || input.types.length < 1 || input.types.length > 3 || !input.types.every(value => typeof value === "string" && SEARCH_TYPES.has(value))) fail("types must contain only signal, paper, or grant."); types = [...new Set(input.types)]; }
    const since = date(input, "since"), until = date(input, "until"); if (since && until && since > until) fail("since must not be after until.");
    return compact({ operation: "search", q: query, types, line: text(input, "line", 80), source: text(input, "source", 120), since, until, includeArchived: bool(input, "includeArchived"), limit: number(input, "limit", 1, 25, true), offset: number(input, "offset", 0, 200, true) });
  },
  list_intelligence_signals(input) {
    assertObject(input, "list_intelligence_signals"); assertKeys(input, new Set(["line", "status", "signalType", "minOpportunity", "includeArchived", "limit"]), "list_intelligence_signals");
    return compact({ operation: "signals", line: text(input, "line", 80), status: text(input, "status", 80), signalType: text(input, "signalType", 80), minOpportunity: number(input, "minOpportunity", 0, 100), includeArchived: bool(input, "includeArchived"), limit: number(input, "limit", 1, 50, true) });
  },
  get_intelligence_signal(input) { assertObject(input, "get_intelligence_signal"); assertKeys(input, new Set(["id"]), "get_intelligence_signal"); return { operation: "signal", id: uuid(input) }; },
  get_signal_evidence(input) { assertObject(input, "get_signal_evidence"); assertKeys(input, new Set(["id", "limit"]), "get_signal_evidence"); return compact({ operation: "signal_evidence", id: uuid(input), limit: number(input, "limit", 1, 25, true) }); },
  get_radar_status(input) { assertObject(input, "get_radar_status"); assertKeys(input, new Set(), "get_radar_status"); return { operation: "overview" }; },
  get_recent_intelligence_runs(input) { assertObject(input, "get_recent_intelligence_runs"); assertKeys(input, new Set(["status", "actionType", "limit"]), "get_recent_intelligence_runs"); return compact({ operation: "runs", status: text(input, "status", 80), actionType: text(input, "actionType", 80), limit: number(input, "limit", 1, 30, true) }); },
});

function endpoint(value) {
  let url; try { url = new URL(value); } catch { throw new IntelligenceAgentError("CONFIGURATION_ERROR", "Intelligence API URL is invalid."); }
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname); if (url.protocol !== "https:" && !(local && url.protocol === "http:")) throw new IntelligenceAgentError("CONFIGURATION_ERROR", "Intelligence API URL must use HTTPS except for localhost development.");
  url.hash = ""; url.search = ""; return url.toString();
}
function token(value) { if (typeof value !== "string" || !value.startsWith("bcc_agent_") || value.length < 24 || value.length > 256) throw new IntelligenceAgentError("CONFIGURATION_ERROR", "A valid BCC Intelligence agent token is required."); return value; }
function rateLimit(headers) { const minute = Number(headers.get("x-ratelimit-remaining-minute")), day = Number(headers.get("x-ratelimit-remaining-day")); return { minuteRemaining: Number.isFinite(minute) ? Math.max(0, minute) : null, dayRemaining: Number.isFinite(day) ? Math.max(0, day) : null }; }
function statusCode(status) { if ([400, 413, 415].includes(status)) return "BAD_REQUEST"; if ([401, 403].includes(status)) return "AUTHENTICATION_ERROR"; if (status === 404) return "NOT_FOUND"; if (status === 429) return "RATE_LIMITED"; if (status >= 500) return "UPSTREAM_UNAVAILABLE"; return "UPSTREAM_ERROR"; }

async function readResponse(res, signal) {
  const declared = Number(res.headers.get("content-length") || 0); if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) throw new IntelligenceAgentError("PROTOCOL_ERROR", "Intelligence API response exceeded the adapter limit.", { status: res.status });
  if (!res.body) return {};
  const reader = res.body.getReader(), decoder = new TextDecoder(), chunks = []; let total = 0;
  const abort = () => { void reader.cancel("request aborted"); }; signal.addEventListener("abort", abort, { once: true });
  try {
    while (true) { if (signal.aborted) throw new IntelligenceAgentError("TIMEOUT", "Intelligence API request timed out."); const { done, value } = await reader.read(); if (done) break; total += value?.byteLength || 0; if (total > MAX_RESPONSE_BYTES) { await reader.cancel(); throw new IntelligenceAgentError("PROTOCOL_ERROR", "Intelligence API response exceeded the adapter limit.", { status: res.status }); } chunks.push(decoder.decode(value, { stream: true })); }
    chunks.push(decoder.decode());
  } catch (error) { if (signal.aborted) throw new IntelligenceAgentError("TIMEOUT", "Intelligence API request timed out.", { cause: error }); if (error instanceof IntelligenceAgentError) throw error; throw new IntelligenceAgentError("NETWORK_ERROR", "Intelligence API response stream failed.", { status: res.status, cause: error }); }
  finally { signal.removeEventListener("abort", abort); }
  const raw = chunks.join(""); if (!raw) return {}; try { return JSON.parse(raw); } catch { throw new IntelligenceAgentError("PROTOCOL_ERROR", "Intelligence API returned invalid JSON.", { status: res.status }); }
}

export function createIntelligenceAgentAdapter(options = {}) {
  const apiUrl = endpoint(options.endpoint || process.env.BCC_INTELLIGENCE_API_URL || DEFAULT_ENDPOINT);
  const bearer = token(options.token || process.env.BCC_INTELLIGENCE_AGENT_TOKEN || "");
  const fetchImpl = options.fetch || globalThis.fetch; if (typeof fetchImpl !== "function") throw new IntelligenceAgentError("CONFIGURATION_ERROR", "A Fetch-compatible implementation is required.");
  const timeoutMs = Number.isInteger(options.timeoutMs) && options.timeoutMs >= 50 && options.timeoutMs <= 60_000 ? options.timeoutMs : DEFAULT_TIMEOUT_MS;

  async function request(payload) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs); let res;
    try {
      res = await fetchImpl(apiUrl, { method: "POST", headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(payload), signal: controller.signal, redirect: "error", referrerPolicy: "no-referrer" });
      const limits = rateLimit(res.headers), body = await readResponse(res, controller.signal);
      if (!res.ok) { const headerRetry = Number(res.headers.get("retry-after")), bodyRetry = Number(body?.retryAfterSeconds), retryAfterSeconds = Number.isFinite(headerRetry) ? headerRetry : Number.isFinite(bodyRetry) ? bodyRetry : null; throw new IntelligenceAgentError(statusCode(res.status), typeof body?.error === "string" ? body.error : "Intelligence API request failed.", { status: res.status, retryAfterSeconds, rateLimit: limits }); }
      if (!isPlainObject(body) || body.ok !== true) throw new IntelligenceAgentError("PROTOCOL_ERROR", "Intelligence API returned an unexpected response.", { status: res.status, rateLimit: limits });
      if (body.version !== EXPECTED_API_VERSION) throw new IntelligenceAgentError("VERSION_MISMATCH", `Intelligence API ${EXPECTED_API_VERSION} required.`, { status: res.status, rateLimit: limits });
      return { data: body, meta: { rateLimit: limits, apiVersion: body.version } };
    } catch (error) {
      if (error instanceof IntelligenceAgentError) throw error;
      if (controller.signal.aborted) throw new IntelligenceAgentError("TIMEOUT", "Intelligence API request timed out.", { cause: error });
      throw new IntelligenceAgentError("NETWORK_ERROR", "Intelligence API request failed.", { cause: error });
    } finally { clearTimeout(timer); }
  }

  async function call(toolName, input = {}) {
    if (typeof toolName !== "string" || !toolMap.has(toolName)) throw new IntelligenceAgentError("UNKNOWN_TOOL", "Unknown Intelligence tool.");
    const result = await request(validators[toolName](input)); return { tool: toolName, ...result };
  }
  async function invoke(toolName, input = {}) {
    try { return { ok: true, ...(await call(toolName, input)) }; }
    catch (error) { const normalized = error instanceof IntelligenceAgentError ? error : new IntelligenceAgentError("ADAPTER_ERROR", "Intelligence adapter failed.", { cause: error }); return { ok: false, tool: typeof toolName === "string" ? toolName : "", error: normalized.toJSON() }; }
  }

  return Object.freeze({ endpoint: apiUrl, apiVersion: EXPECTED_API_VERSION, tools: intelligenceToolDefinitions, call, invoke });
}
