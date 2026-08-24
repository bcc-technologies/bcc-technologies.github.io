import test from "node:test";
import assert from "node:assert/strict";
import {
  createIntelligenceAgentAdapter,
  intelligenceToolDefinitions,
  IntelligenceAgentError,
} from "../scripts/intelligence/agent-adapter.mjs";

const TOKEN = `bcc_agent_${"a".repeat(48)}`;
const UUID = "11111111-1111-4111-8111-111111111111";

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function makeAdapter(handler) {
  return createIntelligenceAgentAdapter({
    endpoint: "https://example.test/functions/v1/bcc-intelligence-api",
    token: TOKEN,
    fetch: handler,
    timeoutMs: 1000,
  });
}

test("v0.5 exposes a bounded read-only tool surface", () => {
  assert.deepEqual(
    intelligenceToolDefinitions.map(tool => tool.name),
    [
      "search_intelligence",
      "list_intelligence_signals",
      "get_intelligence_signal",
      "get_signal_evidence",
      "get_radar_status",
      "get_recent_intelligence_runs",
    ],
  );
  for (const tool of intelligenceToolDefinitions) {
    assert.equal(tool.annotations.readOnlyHint, true);
    assert.equal(tool.annotations.destructiveHint, false);
    assert.equal(tool.annotations.idempotentHint, true);
    assert.equal(tool.inputSchema.additionalProperties, false);
  }
});

test("search_intelligence maps to the v0.4 search contract and forwards no unknown fields", async () => {
  let captured;
  const adapter = makeAdapter(async (_url, options) => {
    captured = options;
    return jsonResponse({ ok: true, operation: "search", version: "0.4", results: [] }, 200, {
      "X-RateLimit-Remaining-Minute": "59",
      "X-RateLimit-Remaining-Day": "4999",
    });
  });

  const result = await adapter.call("search_intelligence", {
    query: "SEM segmentation",
    types: ["signal", "paper"],
    line: "MAP-Nano",
    includeArchived: false,
    limit: 10,
  });

  assert.equal(result.data.operation, "search");
  assert.deepEqual(result.meta.rateLimit, { minuteRemaining: 59, dayRemaining: 4999 });
  const body = JSON.parse(captured.body);
  assert.deepEqual(body, {
    operation: "search",
    q: "SEM segmentation",
    types: ["signal", "paper"],
    line: "MAP-Nano",
    includeArchived: false,
    limit: 10,
  });
  assert.match(captured.headers.Authorization, /^Bearer bcc_agent_/);
  assert.equal(captured.redirect, "error");
  assert.equal(captured.referrerPolicy, "no-referrer");
});

test("all public tools map to fixed read-only operations", async () => {
  const operations = [];
  const adapter = makeAdapter(async (_url, options) => {
    const body = JSON.parse(options.body);
    operations.push(body.operation);
    return jsonResponse({ ok: true, operation: body.operation, version: "0.4" });
  });

  await adapter.call("list_intelligence_signals", {});
  await adapter.call("get_intelligence_signal", { id: UUID });
  await adapter.call("get_signal_evidence", { id: UUID, limit: 10 });
  await adapter.call("get_radar_status", {});
  await adapter.call("get_recent_intelligence_runs", { limit: 5 });

  assert.deepEqual(operations, ["signals", "signal", "signal_evidence", "overview", "runs"]);
  assert.ok(operations.every(operation => !/sync|update|delete|create|write|generate|fetch_papers/.test(operation)));
});

test("adapter rejects invalid arguments before network access", async () => {
  let calls = 0;
  const adapter = makeAdapter(async () => {
    calls += 1;
    return jsonResponse({ ok: true });
  });

  await assert.rejects(
    () => adapter.call("search_intelligence", { query: "x" }),
    error => error instanceof IntelligenceAgentError && error.code === "INVALID_ARGUMENT",
  );
  await assert.rejects(
    () => adapter.call("search_intelligence", { query: "valid", types: ["patent"] }),
    error => error.code === "INVALID_ARGUMENT",
  );
  await assert.rejects(
    () => adapter.call("get_intelligence_signal", { id: "not-a-uuid" }),
    error => error.code === "INVALID_ARGUMENT",
  );
  await assert.rejects(
    () => adapter.call("get_radar_status", { surprise: true }),
    error => error.code === "INVALID_ARGUMENT",
  );
  await assert.rejects(
    () => adapter.call("search_intelligence", { query: "valid", since: "2026-02-30" }),
    error => error.code === "INVALID_ARGUMENT",
  );
  assert.equal(calls, 0);
});

test("adapter normalizes rate-limit errors without leaking credentials", async () => {
  const adapter = makeAdapter(async () => jsonResponse(
    { ok: false, error: "Rate limit exceeded.", retryAfterSeconds: 27 },
    429,
    {
      "Retry-After": "27",
      "X-RateLimit-Remaining-Minute": "0",
      "X-RateLimit-Remaining-Day": "4980",
    },
  ));

  const result = await adapter.invoke("get_radar_status", {});
  assert.equal(result.ok, false);
  assert.deepEqual(result.error, {
    code: "RATE_LIMITED",
    message: "Rate limit exceeded.",
    status: 429,
    retryAfterSeconds: 27,
    rateLimit: { minuteRemaining: 0, dayRemaining: 4980 },
  });
  assert.doesNotMatch(JSON.stringify(result), /bcc_agent_/);
});

test("adapter maps authentication and upstream failures to stable error codes", async () => {
  const unauthorized = makeAdapter(async () => jsonResponse({ ok: false, error: "Unauthorized." }, 401));
  await assert.rejects(
    () => unauthorized.call("get_radar_status", {}),
    error => error.code === "AUTHENTICATION_ERROR" && error.status === 401,
  );

  const unavailable = makeAdapter(async () => jsonResponse({ ok: false, error: "Service unavailable." }, 503));
  await assert.rejects(
    () => unavailable.call("get_radar_status", {}),
    error => error.code === "UPSTREAM_UNAVAILABLE" && error.status === 503,
  );
});

test("adapter enforces HTTPS except localhost development", () => {
  assert.throws(
    () => createIntelligenceAgentAdapter({ endpoint: "http://example.com/api", token: TOKEN, fetch: async () => jsonResponse({ ok: true }) }),
    error => error.code === "CONFIGURATION_ERROR",
  );
  assert.doesNotThrow(() => createIntelligenceAgentAdapter({ endpoint: "http://localhost:54321/functions/v1/test", token: TOKEN, fetch: async () => jsonResponse({ ok: true }) }));
});

test("adapter fails closed on malformed success payloads", async () => {
  const adapter = makeAdapter(async () => jsonResponse({ operation: "overview" }, 200));
  await assert.rejects(
    () => adapter.call("get_radar_status", {}),
    error => error.code === "PROTOCOL_ERROR",
  );
});

test("unknown tools never reach the network", async () => {
  let calls = 0;
  const adapter = makeAdapter(async () => {
    calls += 1;
    return jsonResponse({ ok: true });
  });
  await assert.rejects(
    () => adapter.call("execute_sql", {}),
    error => error.code === "UNKNOWN_TOOL",
  );
  assert.equal(calls, 0);
});
