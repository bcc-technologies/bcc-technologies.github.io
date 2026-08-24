const DEFAULT_ENDPOINT = "https://bglkyqiqzrcwegpjrucc.supabase.co/functions/v1/bcc-intelligence-api";
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
    return {
      code: this.code,
      message: this.message,
      status: this.status,
      retryAfterSeconds: this.retryAfterSeconds,
      rateLimit: this.rateLimit,
    };
  }
}

const objectSchema = (properties = {}, required = []) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});

const sharedAnnotations = Object.freeze({
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
});

export const intelligenceToolDefinitions = Object.freeze([
  {
    name: "search_intelligence",
    description: "Search BCC Science Radar signals, scientific papers, and grants. Read-only; returns ranked bounded results.",
    inputSchema: objectSchema({
      query: { type: "string", minLength: 2, maxLength: 240, description: "Scientific, technical, market, or opportunity query." },
      types: { type: "array", items: { type: "string", enum: ["signal", "paper", "grant"] }, minItems: 1, maxItems: 3, uniqueItems: true },
      line: { type: "string", maxLength: 80, description: "Optional BCC line, e.g. MAP-Nano or MAP-Med." },
      source: { type: "string", maxLength: 120, description: "Optional paper source or grant agency filter." },
      since: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
      until: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
      includeArchived: { type: "boolean", default: false },
      limit: { type: "integer", minimum: 1, maximum: 25, default: 15 },
      offset: { type: "integer", minimum: 0, maximum: 200, default: 0 },
    }, ["query"]),
    annotations: sharedAnnotations,
  },
  {
    name: "list_intelligence_signals",
    description: "List current BCC Science Radar signals, optionally filtered by product line, status, type, or opportunity score. Read-only.",
    inputSchema: objectSchema({
      line: { type: "string", maxLength: 80 },
      status: { type: "string", maxLength: 80 },
      signalType: { type: "string", maxLength: 80 },
      minOpportunity: { type: "number", minimum: 0, maximum: 100 },
      includeArchived: { type: "boolean", default: false },
      limit: { type: "integer", minimum: 1, maximum: 50, default: 20 },
    }),
    annotations: sharedAnnotations,
  },
  {
    name: "get_intelligence_signal",
    description: "Get one Science Radar signal by UUID, including score breakdown and bounded evidence references. Read-only.",
    inputSchema: objectSchema({ id: { type: "string", format: "uuid" } }, ["id"]),
    annotations: sharedAnnotations,
  },
  {
    name: "get_signal_evidence",
    description: "Resolve the typed paper, grant, trial, patent, or institution evidence referenced by one Science Radar signal. Read-only.",
    inputSchema: objectSchema({
      id: { type: "string", format: "uuid" },
      limit: { type: "integer", minimum: 1, maximum: 25, default: 25 },
    }, ["id"]),
    annotations: sharedAnnotations,
  },
  {
    name: "get_radar_status",
    description: "Get bounded Science Radar corpus counts and API version. Read-only.",
    inputSchema: objectSchema(),
    annotations: sharedAnnotations,
  },
  {
    name: "get_recent_intelligence_runs",
    description: "Get recent Science Radar ingestion/sync runs and normalized source names. Read-only operational visibility.",
    inputSchema: objectSchema({
      status: { type: "string", maxLength: 80 },
      actionType: { type: "string", maxLength: 80 },
      limit: { type: "integer", minimum: 1, maximum: 30, default: 10 },
    }),
    annotations: sharedAnnotations,
  },
]);

const toolMap = new Map(intelligenceToolDefinitions.map(tool => [tool.name, tool]));

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function assertObject(input, toolName) {
  if (!isPlainObject(input)) throw new IntelligenceAgentError("INVALID_ARGUMENT", `${toolName} input must be an object.`);
}

function assertKnownKeys(input, allowed, toolName) {
  const unknown = Object.keys(input).filter(key => !allowed.has(key));
  if (unknown.length) throw new IntelligenceAgentError("INVALID_ARGUMENT", `${toolName} received unsupported field: ${unknown[0]}.`);
}

function optionalString(input, key, max) {
  if (!(key in input) || input[key] === undefined || input[key] === null || input[key] === "") return undefined;
  if (typeof input[key] !== "string") throw new IntelligenceAgentError("INVALID_ARGUMENT", `${key} must be a string.`);
  const value = input[key].trim();
  if (!value || value.length > max) throw new IntelligenceAgentError("INVALID_ARGUMENT", `${key} must contain 1-${max} characters.`);
  return value;
}

function optionalBoolean(input, key) {
  if (!(key in input) || input[key] === undefined || input[key] === null) return undefined;
  if (typeof input[key] !== "boolean") throw new IntelligenceAgentError("INVALID_ARGUMENT", `${key} must be a boolean.`);
  return input[key];
}

function optionalNumber(input, key, min, max) {
  if (!(key in input) || input[key] === undefined || input[key] === null) return undefined;
  if (typeof input[key] !== "number" || !Number.isFinite(input[key]) || input[key] < min || input[key] > max) {
    throw new IntelligenceAgentError("INVALID_ARGUMENT", `${key} must be between ${min} and ${max}.`);
  }
  return input[key];
}

function optionalInteger(input, key, min, max) {
  const value = optionalNumber(input, key, min, max);
  if (value !== undefined && !Number.isInteger(value)) throw new IntelligenceAgentError("INVALID_ARGUMENT", `${key} must be an integer.`);
  return value;
}

function optionalDate(input, key) {
  const value = optionalString(input, key, 10);
  if (value === undefined) return undefined;
  if (!DATE_RE.test(value)) throw new IntelligenceAgentError("INVALID_ARGUMENT", `${key} must use YYYY-MM-DD.`);
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new IntelligenceAgentError("INVALID_ARGUMENT", `${key} must be a real calendar date.`);
  }
  return value;
}

function requiredUuid(input, key = "id") {
  const value = optionalString(input, key, 64);
  if (!value || !UUID_RE.test(value)) throw new IntelligenceAgentError("INVALID_ARGUMENT", `${key} must be a valid UUID.`);
  return value;
}

function validateSearch(input) {
  assertObject(input, "search_intelligence");
  assertKnownKeys(input, new Set(["query", "types", "line", "source", "since", "until", "includeArchived", "limit", "offset"]), "search_intelligence");
  const query = optionalString(input, "query", 240);
  if (!query || query.length < 2) throw new IntelligenceAgentError("INVALID_ARGUMENT", "query must contain at least 2 characters.");
  let types;
  if (input.types !== undefined) {
    if (!Array.isArray(input.types) || input.types.length < 1 || input.types.length > 3 || !input.types.every(value => typeof value === "string" && SEARCH_TYPES.has(value))) {
      throw new IntelligenceAgentError("INVALID_ARGUMENT", "types must contain only signal, paper, or grant.");
    }
    types = [...new Set(input.types)];
  }
  const since = optionalDate(input, "since");
  const until = optionalDate(input, "until");
  if (since && until && since > until) throw new IntelligenceAgentError("INVALID_ARGUMENT", "since must not be after until.");
  return compact({
    operation: "search",
    q: query,
    types,
    line: optionalString(input, "line", 80),
    source: optionalString(input, "source", 120),
    since,
    until,
    includeArchived: optionalBoolean(input, "includeArchived"),
    limit: optionalInteger(input, "limit", 1, 25),
    offset: optionalInteger(input, "offset", 0, 200),
  });
}

function validateSignals(input) {
  assertObject(input, "list_intelligence_signals");
  assertKnownKeys(input, new Set(["line", "status", "signalType", "minOpportunity", "includeArchived", "limit"]), "list_intelligence_signals");
  return compact({
    operation: "signals",
    line: optionalString(input, "line", 80),
    status: optionalString(input, "status", 80),
    signalType: optionalString(input, "signalType", 80),
    minOpportunity: optionalNumber(input, "minOpportunity", 0, 100),
    includeArchived: optionalBoolean(input, "includeArchived"),
    limit: optionalInteger(input, "limit", 1, 50),
  });
}

function validateSignal(input) {
  assertObject(input, "get_intelligence_signal");
  assertKnownKeys(input, new Set(["id"]), "get_intelligence_signal");
  return { operation: "signal", id: requiredUuid(input) };
}

function validateEvidence(input) {
  assertObject(input, "get_signal_evidence");
  assertKnownKeys(input, new Set(["id", "limit"]), "get_signal_evidence");
  return compact({ operation: "signal_evidence", id: requiredUuid(input), limit: optionalInteger(input, "limit", 1, 25) });
}

function validateStatus(input) {
  assertObject(input, "get_radar_status");
  assertKnownKeys(input, new Set(), "get_radar_status");
  return { operation: "overview" };
}

function validateRuns(input) {
  assertObject(input, "get_recent_intelligence_runs");
  assertKnownKeys(input, new Set(["status", "actionType", "limit"]), "get_recent_intelligence_runs");
  return compact({
    operation: "runs",
    status: optionalString(input, "status", 80),
    actionType: optionalString(input, "actionType", 80),
    limit: optionalInteger(input, "limit", 1, 30),
  });
}

const validators = Object.freeze({
  search_intelligence: validateSearch,
  list_intelligence_signals: validateSignals,
  get_intelligence_signal: validateSignal,
  get_signal_evidence: validateEvidence,
  get_radar_status: validateStatus,
  get_recent_intelligence_runs: validateRuns,
});

function compact(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
}

function normalizeEndpoint(value) {
  let url;
  try { url = new URL(value); } catch { throw new IntelligenceAgentError("CONFIGURATION_ERROR", "Intelligence API URL is invalid."); }
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    throw new IntelligenceAgentError("CONFIGURATION_ERROR", "Intelligence API URL must use HTTPS except for localhost development.");
  }
  url.hash = "";
  url.search = "";
  return url.toString();
}

function normalizeToken(value) {
  if (typeof value !== "string" || !value.startsWith("bcc_agent_") || value.length > 256 || value.length < 24) {
    throw new IntelligenceAgentError("CONFIGURATION_ERROR", "A valid BCC Intelligence agent token is required.");
  }
  return value;
}

function parseRateLimit(headers) {
  const minute = Number(headers.get("x-ratelimit-remaining-minute"));
  const day = Number(headers.get("x-ratelimit-remaining-day"));
  return {
    minuteRemaining: Number.isFinite(minute) ? Math.max(0, minute) : null,
    dayRemaining: Number.isFinite(day) ? Math.max(0, day) : null,
  };
}

async function readBoundedResponse(res) {
  const declared = Number(res.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) {
    throw new IntelligenceAgentError("PROTOCOL_ERROR", "Intelligence API response exceeded the adapter limit.", { status: res.status });
  }
  if (!res.body) return {};
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value?.byteLength || 0;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new IntelligenceAgentError("PROTOCOL_ERROR", "Intelligence API response exceeded the adapter limit.", { status: res.status });
    }
    chunks.push(decoder.decode(value, { stream: true }));
  }
  chunks.push(decoder.decode());
  const text = chunks.join("");
  if (!text) return {};
  try { return JSON.parse(text); }
  catch { throw new IntelligenceAgentError("PROTOCOL_ERROR", "Intelligence API returned invalid JSON.", { status: res.status }); }
}

function errorCodeForStatus(status) {
  if (status === 400 || status === 413 || status === 415) return "BAD_REQUEST";
  if (status === 401 || status === 403) return "AUTHENTICATION_ERROR";
  if (status === 404) return "NOT_FOUND";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "UPSTREAM_UNAVAILABLE";
  return "UPSTREAM_ERROR";
}

export function createIntelligenceAgentAdapter(options = {}) {
  const endpoint = normalizeEndpoint(options.endpoint || process.env.BCC_INTELLIGENCE_API_URL || DEFAULT_ENDPOINT);
  const token = normalizeToken(options.token || process.env.BCC_INTELLIGENCE_AGENT_TOKEN || "");
  const fetchImpl = options.fetch || globalThis.fetch;
  if (typeof fetchImpl !== "function") throw new IntelligenceAgentError("CONFIGURATION_ERROR", "A Fetch-compatible implementation is required.");
  const timeoutMs = Number.isInteger(options.timeoutMs) && options.timeoutMs >= 1000 && options.timeoutMs <= 60_000 ? options.timeoutMs : DEFAULT_TIMEOUT_MS;

  async function request(payload) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let res;
    try {
      res = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
        redirect: "error",
        referrerPolicy: "no-referrer",
      });
    } catch (error) {
      if (controller.signal.aborted) throw new IntelligenceAgentError("TIMEOUT", "Intelligence API request timed out.", { cause: error });
      throw new IntelligenceAgentError("NETWORK_ERROR", "Intelligence API request failed.", { cause: error });
    } finally {
      clearTimeout(timeout);
    }

    const rateLimit = parseRateLimit(res.headers);
    const body = await readBoundedResponse(res);
    if (!res.ok) {
      const retryHeader = Number(res.headers.get("retry-after"));
      const retryBody = Number(body?.retryAfterSeconds);
      const retryAfterSeconds = Number.isFinite(retryHeader) ? retryHeader : Number.isFinite(retryBody) ? retryBody : null;
      throw new IntelligenceAgentError(errorCodeForStatus(res.status), typeof body?.error === "string" ? body.error : "Intelligence API request failed.", {
        status: res.status,
        retryAfterSeconds,
        rateLimit,
      });
    }
    if (!isPlainObject(body) || body.ok !== true) {
      throw new IntelligenceAgentError("PROTOCOL_ERROR", "Intelligence API returned an unexpected response.", { status: res.status, rateLimit });
    }
    return { data: body, meta: { rateLimit } };
  }

  async function call(toolName, input = {}) {
    if (typeof toolName !== "string" || !toolMap.has(toolName)) {
      throw new IntelligenceAgentError("UNKNOWN_TOOL", "Unknown Intelligence tool.");
    }
    const payload = validators[toolName](input);
    const result = await request(payload);
    return { tool: toolName, ...result };
  }

  async function invoke(toolName, input = {}) {
    try {
      const result = await call(toolName, input);
      return { ok: true, ...result };
    } catch (error) {
      const normalized = error instanceof IntelligenceAgentError
        ? error
        : new IntelligenceAgentError("ADAPTER_ERROR", "Intelligence adapter failed.", { cause: error });
      return { ok: false, tool: typeof toolName === "string" ? toolName : "", error: normalized.toJSON() };
    }
  }

  return Object.freeze({
    endpoint,
    tools: intelligenceToolDefinitions,
    call,
    invoke,
  });
}
