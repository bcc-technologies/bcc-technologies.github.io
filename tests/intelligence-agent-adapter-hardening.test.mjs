import test from "node:test";
import assert from "node:assert/strict";
import { createIntelligenceAgentAdapter } from "../scripts/intelligence/agent-adapter.mjs";

const TOKEN = `bcc_agent_${"b".repeat(48)}`;

function adapter(fetch, timeoutMs = 1000) {
  return createIntelligenceAgentAdapter({
    endpoint: "https://example.test/functions/v1/bcc-intelligence-api",
    token: TOKEN,
    fetch,
    timeoutMs,
  });
}

test("adapter fails closed when the upstream API version changes", async () => {
  const client = adapter(async () => new Response(JSON.stringify({ ok: true, operation: "overview", version: "0.5", radar: {} }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  }));
  await assert.rejects(
    () => client.call("get_radar_status", {}),
    error => error.code === "VERSION_MISMATCH" && error.status === 200,
  );
});

test("adapter rejects oversized upstream responses before consuming the body", async () => {
  const client = adapter(async () => new Response("{}", {
    status: 200,
    headers: { "Content-Type": "application/json", "Content-Length": String(1024 * 1024 + 1) },
  }));
  await assert.rejects(
    () => client.call("get_radar_status", {}),
    error => error.code === "PROTOCOL_ERROR",
  );
});

test("adapter timeout remains active while consuming the response body", async () => {
  const stream = new ReadableStream({
    pull() { return new Promise(() => {}); },
  });
  const client = adapter(async () => new Response(stream, {
    status: 200,
    headers: { "Content-Type": "application/json" },
  }), 50);
  await assert.rejects(
    () => client.call("get_radar_status", {}),
    error => error.code === "TIMEOUT",
  );
});
