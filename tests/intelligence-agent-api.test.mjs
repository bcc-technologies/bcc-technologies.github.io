import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const migrationPath = path.join(root, "supabase/migrations/20260824143000_intelligence_agent_api_foundation.sql");
const functionPath = path.join(root, "supabase/functions/bcc-intelligence-api/index.ts");
const configPath = path.join(root, "supabase/config.toml");

const migration = fs.readFileSync(migrationPath, "utf8");
const fn = fs.readFileSync(functionPath, "utf8");
const config = fs.readFileSync(configPath, "utf8");

test("agent credentials store only a SHA-256 hash and read scope", () => {
  assert.match(migration, /token_hash text not null/i);
  assert.match(migration, /token_hash ~ '\^\[a-f0-9\]\{64\}\$'/i);
  assert.match(migration, /intelligence:read/);
  assert.doesNotMatch(migration, /token_plain|plaintext_token|raw_token/i);
});

test("agent credential and audit tables are backend-only", () => {
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all on public\.intelligence_api_clients from public, anon, authenticated/i);
  assert.match(migration, /revoke all on public\.intelligence_api_audit from public, anon, authenticated/i);
  assert.match(migration, /grant all on public\.intelligence_api_clients to service_role/i);
  assert.match(migration, /grant all on public\.intelligence_api_audit to service_role/i);
});

test("edge function authenticates BCC agent tokens before querying Intelligence", () => {
  const credentialLookup = fn.indexOf('.from("intelligence_api_clients")');
  const firstCorpusRead = Math.min(
    ...["intelligence_signals", "intelligence_papers", "intelligence_grants"]
      .map(name => fn.indexOf(`.from("${name}")`))
      .filter(index => index >= 0)
  );
  assert.ok(credentialLookup >= 0);
  assert.ok(firstCorpusRead > credentialLookup);
  assert.match(fn, /token\.startsWith\("bcc_agent_"\)/);
  assert.match(fn, /scopes\.includes\(READ_SCOPE\)/);
});

test("v0.3 exposes only intended read operations including search", () => {
  assert.match(fn, /ALLOWED_OPERATIONS = new Set\(\["health", "overview", "signals", "signal", "signal_evidence", "runs", "search"\]\)/);
  assert.doesNotMatch(fn, /sync_papers|generate_signals|fetch_patents|saveTopic|updateSignalStatus/);
});

test("v0.3 search is bounded and paginated", () => {
  assert.match(fn, /clampInt\(body\.limit,15,1,25\)/);
  assert.match(fn, /clampInt\(body\.offset,0,0,200\)/);
  assert.match(fn, /candidateLimit = Math\.min\(60,Math\.max\(30,offset\+limit\+15\)\)/);
  assert.match(fn, /nextOffset:hasMore \? offset\+results\.length : null/);
});

test("v0.3 search avoids raw PostgREST OR expressions from user text", () => {
  assert.match(fn, /fetchCandidates/);
  assert.match(fn, /\.ilike\(field,/);
  assert.doesNotMatch(fn, /\.or\(/);
});

test("v0.3 search ranks locally and returns evidence-friendly metadata", () => {
  assert.match(fn, /function rankCandidate/);
  assert.match(fn, /relevanceScore/);
  assert.match(fn, /matchedFields/);
  assert.match(fn, /title_phrase/);
  assert.match(fn, /topics_token/);
});

test("search query text is audited only through SHA-256", () => {
  assert.match(fn, /queryMaterial:query/);
  assert.match(fn, /outcome\.queryMaterial\?await sha256\(outcome\.queryMaterial\)/);
  assert.doesNotMatch(fn, /filters:\{[^}]*query:/s);
});

test("search supports signals papers and grants with fixed field allowlists", () => {
  assert.match(fn, /SEARCH_SPECS = Object\.freeze/);
  assert.match(fn, /signal: \{ table: "intelligence_signals"/);
  assert.match(fn, /paper: \{ table: "intelligence_papers"/);
  assert.match(fn, /grant: \{ table: "intelligence_grants"/);
  assert.doesNotMatch(fn, /select\("\*"\)/);
  assert.doesNotMatch(fn, /raw_data|duplicate_candidates/);
});

test("existing v0.2 result limits remain enforced", () => {
  assert.match(fn, /clampInt\(body\.limit,20,1,50\)/);
  assert.match(fn, /clampInt\(body\.limit,25,1,25\)/);
  assert.match(fn, /clampInt\(body\.limit,10,1,30\)/);
});

test("signals are ordered by current radar update time", () => {
  assert.match(fn, /order\("updated_at",\{ascending:false\}\)/);
});

test("evidence is resolved from typed references", () => {
  assert.match(fn, /publicEvidenceRef/);
  assert.match(fn, /resolveEvidence/);
  assert.match(fn, /EVIDENCE_CONFIG\[type\]/);
});

test("run sources are normalized to names and types", () => {
  assert.match(fn, /from\("intelligence_sources"\)\.select\("id,name,type"\)/);
  assert.match(fn, /sourceMap\.get\(id\)/);
});

test("edge function has an explicit custom-auth gateway configuration", () => {
  assert.match(config, /\[functions\.bcc-intelligence-api\]\s+verify_jwt = false/m);
});
