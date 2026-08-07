import test from "node:test";
import assert from "node:assert/strict";
import { createIntelligenceStoreFromEnv } from "../scripts/intelligence/store.mjs";

const BASE_URL = "https://example.supabase.co";

async function withStoreEnv(fn) {
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const previousFetch = globalThis.fetch;
  process.env.SUPABASE_URL = BASE_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
  try {
    // Must await here -- these tests exercise code paths with two or three
    // sequential fetch calls, and returning the bare promise would let this
    // finally block restore the real fetch before later calls run.
    return await fn();
  } finally {
    process.env.SUPABASE_URL = previousUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
    globalThis.fetch = previousFetch;
  }
}

// Builds a fetch stub for one intelligence_* table good enough to exercise
// findExisting*() (identity match by source_id+external_id) and
// findPossible*Duplicates() (the cached title-similarity candidate list),
// without a real Supabase project.
function stubTableFetch(table, { identityMatch = null, candidates = [] } = {}) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const parsed = new URL(url);
    const method = init.method || "GET";
    calls.push({ method, url: parsed, body: init.body ? JSON.parse(init.body) : null });

    if (!parsed.pathname.endsWith(`/${table}`)) {
      throw new Error(`Unexpected table in test stub: ${parsed.pathname}`);
    }

    if (method === "GET" && parsed.searchParams.has("external_id")) {
      const rows = identityMatch ? [identityMatch] : [];
      return jsonResponse(rows);
    }
    if (method === "GET" && parsed.searchParams.get("select") === "id,external_id,title") {
      return jsonResponse(candidates);
    }
    if (method === "POST") {
      return jsonResponse([{ id: "created-1", ...calls[calls.length - 1].body }]);
    }
    if (method === "PATCH") {
      const id = parsed.searchParams.get("id").replace("eq.", "");
      return jsonResponse([{ id, ...calls[calls.length - 1].body }]);
    }
    throw new Error(`Unhandled request in test stub: ${method} ${parsed.pathname}${parsed.search}`);
  };
  return calls;
}

function jsonResponse(payload) {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
    text: async () => JSON.stringify(payload)
  };
}

for (const kind of [
  { table: "intelligence_grants", find: "findExistingGrant", findDupes: "findPossibleGrantDuplicates", save: "saveGrant", dupeKey: "grantId" },
  { table: "intelligence_patents", find: "findExistingPatent", findDupes: "findPossiblePatentDuplicates", save: "savePatent", dupeKey: "patentId" },
  { table: "intelligence_trials", find: "findExistingTrial", findDupes: "findPossibleTrialDuplicates", save: "saveTrial", dupeKey: "trialId" }
]) {
  test(`${kind.find} never falls back to a title match (no sourceId/externalId => null, no request made)`, () =>
    withStoreEnv(async () => {
      const calls = stubTableFetch(kind.table);
      const store = createIntelligenceStoreFromEnv();
      const result = await store[kind.find]({ title: "Shared generic title", externalId: "" }, "source-1");
      assert.equal(result, null);
      assert.equal(calls.length, 0, "no request should be made without both sourceId and externalId");
    }));

  test(`${kind.find} does not match a same-titled row from a different source/external id`, () =>
    withStoreEnv(async () => {
      stubTableFetch(kind.table, { identityMatch: null });
      const store = createIntelligenceStoreFromEnv();
      const result = await store[kind.find]({ title: "Shared generic title", externalId: "ext-999" }, "source-1");
      assert.equal(result, null, "title-only overlap must never resolve to an existing row");
    }));

  test(`${kind.save} flags a fuzzy title match for review instead of silently merging into it`, () =>
    withStoreEnv(async () => {
      const existingId = "existing-row-1";
      const calls = stubTableFetch(kind.table, {
        identityMatch: null,
        candidates: [{ id: existingId, external_id: "ext-old", title: "Automated microscopy benchmark study" }]
      });
      const store = createIntelligenceStoreFromEnv();
      const result = await store[kind.save](
        { title: "Automated microscopy benchmark study", externalId: "ext-new" },
        "source-1"
      );

      assert.equal(result.action, "created", "a fuzzy title match must never trigger a PATCH merge");
      const postCall = calls.find(call => call.method === "POST");
      assert.ok(postCall, "expected a POST creating a new, separate row");
      assert.equal(postCall.body.possible_duplicate, true);
      assert.equal(postCall.body.duplicate_candidates.length, 1);
      assert.equal(postCall.body.duplicate_candidates[0][kind.dupeKey], existingId);
    }));

  test(`${kind.save} matches and updates only on source_id + external_id identity`, () =>
    withStoreEnv(async () => {
      const existingId = "existing-row-2";
      const calls = stubTableFetch(kind.table, {
        identityMatch: { id: existingId, external_id: "ext-1", title: "Old title", possible_duplicate: false, duplicate_candidates: [], amount: 0 }
      });
      const store = createIntelligenceStoreFromEnv();
      const result = await store[kind.save]({ title: "Updated title", externalId: "ext-1" }, "source-1");

      assert.equal(result.action, "updated");
      const patchCall = calls.find(call => call.method === "PATCH");
      assert.ok(patchCall, "expected a PATCH against the identity-matched row");
      assert.ok(patchCall.url.searchParams.get("id").includes(existingId));
    }));
}

// Routes fetch calls across intelligence_settings/intelligence_signals by
// method + query shape, for the saveSignal()/archiveStaleLowValueSignals()
// tests below -- those two tables don't fit stubTableFetch's per-table
// grant/patent/trial shape.
function stubSignalsFetch({ existingSignal = null, settings = null, staleCandidates = [] } = {}) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const parsed = new URL(url);
    const method = init.method || "GET";
    calls.push({ method, url: parsed, body: init.body ? JSON.parse(init.body) : null });

    if (parsed.pathname.endsWith("/intelligence_settings")) {
      return jsonResponse(settings ? [settings] : []);
    }
    if (!parsed.pathname.endsWith("/intelligence_signals")) {
      throw new Error(`Unexpected table in test stub: ${parsed.pathname}`);
    }

    if (method === "GET" && parsed.searchParams.has("title")) {
      return jsonResponse(existingSignal ? [existingSignal] : []);
    }
    if (method === "GET" && parsed.searchParams.get("status") === "in.(new,reviewing)") {
      return jsonResponse(staleCandidates);
    }
    if (method === "POST") {
      return jsonResponse([{ id: "created-signal-1", ...calls[calls.length - 1].body }]);
    }
    if (method === "PATCH") {
      const idParam = parsed.searchParams.get("id") || "";
      const id = idParam.startsWith("eq.") ? idParam.slice(3) : idParam;
      return jsonResponse([{ id, ...calls[calls.length - 1].body }]);
    }
    throw new Error(`Unhandled request in test stub: ${method} ${parsed.pathname}${parsed.search}`);
  };
  return calls;
}

test("saveSignal never resets an existing signal's status -- a reviewer's decision must survive the next sync's refresh", () =>
  withStoreEnv(async () => {
    const calls = stubSignalsFetch({
      existingSignal: { id: "sig-1", title: "Rising interest in X", signal_type: "research_trend", related_line: "MAP-Nano", status: "accepted" }
    });
    const store = createIntelligenceStoreFromEnv();
    const result = await store.saveSignal({
      title: "Rising interest in X",
      signalType: "research_trend",
      relatedLine: "MAP-Nano",
      status: "new", // generateStrategicSignals() always emits this
      opportunityScore: 70,
      actionabilityScore: 60,
      confidenceScore: 55
    });

    assert.equal(result.action, "updated");
    const patchCall = calls.find(call => call.method === "PATCH");
    assert.ok(patchCall, "expected a PATCH against the existing signal");
    assert.equal(
      Object.prototype.hasOwnProperty.call(patchCall.body, "status"),
      false,
      "refreshing an existing signal must never touch its status"
    );
  }));

test("saveSignal sets status to new only when creating a brand-new signal", () =>
  withStoreEnv(async () => {
    const calls = stubSignalsFetch({ existingSignal: null });
    const store = createIntelligenceStoreFromEnv();
    const result = await store.saveSignal({
      title: "Brand new signal",
      signalType: "research_trend",
      relatedLine: "MAP-Bio"
    });

    assert.equal(result.action, "created");
    const postCall = calls.find(call => call.method === "POST");
    assert.equal(postCall.body.status, "new");
  }));

test("archiveStaleLowValueSignals archives only signals that fail every configured threshold", () =>
  withStoreEnv(async () => {
    const calls = stubSignalsFetch({
      settings: { scoring_thresholds: { opportunity: 60, actionability: 50, confidence: 50 } },
      staleCandidates: [{ id: "weak-1" }, { id: "weak-2" }]
    });
    const store = createIntelligenceStoreFromEnv();
    const result = await store.archiveStaleLowValueSignals(21);

    assert.deepEqual(result, { archived: 2 });
    const getCall = calls.find(call => call.method === "GET" && call.url.pathname.endsWith("/intelligence_signals"));
    assert.equal(getCall.url.searchParams.get("opportunity_score"), "lt.60");
    assert.equal(getCall.url.searchParams.get("actionability_score"), "lt.50");
    assert.equal(getCall.url.searchParams.get("confidence_score"), "lt.50");

    const patchCall = calls.find(call => call.method === "PATCH");
    assert.equal(patchCall.url.searchParams.get("id"), "in.(weak-1,weak-2)");
    assert.equal(patchCall.body.status, "archived");
    assert.equal(patchCall.body.auto_archived, true);
  }));

test("archiveStaleLowValueSignals is a no-op when nothing qualifies", () =>
  withStoreEnv(async () => {
    const calls = stubSignalsFetch({
      settings: { scoring_thresholds: { opportunity: 60, actionability: 50, confidence: 50 } },
      staleCandidates: []
    });
    const store = createIntelligenceStoreFromEnv();
    const result = await store.archiveStaleLowValueSignals(21);

    assert.deepEqual(result, { archived: 0 });
    assert.ok(!calls.some(call => call.method === "PATCH"), "no PATCH should fire when there's nothing to archive");
  }));
