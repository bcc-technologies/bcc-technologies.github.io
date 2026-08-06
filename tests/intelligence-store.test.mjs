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
