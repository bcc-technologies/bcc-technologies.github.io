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

test("v0.2 exposes only the intended read operations", () => {
  assert.match(fn, /ALLOWED_OPERATIONS = new Set\(\["health", "overview", "signals", "signal", "signal_evidence", "runs"\]\)/);
  assert.doesNotMatch(fn, /sync_papers|generate_signals|fetch_patents|saveTopic|updateSignalStatus/);
});

test("v0.2 limits result sizes", () => {
  assert.match(fn, /clampInteger\(body\.limit, 20, 1, 50\)/);
  assert.match(fn, /clampInteger\(body\.limit, 25, 1, 25\)/);
  assert.match(fn, /clampInteger\(body\.limit, 10, 1, 30\)/);
});

test("v0.2 uses explicit evidence field allowlists and excludes raw data", () => {
  assert.match(fn, /const EVIDENCE_CONFIG/);
  assert.doesNotMatch(fn, /select\("\*"\)/);
  assert.doesNotMatch(fn, /raw_data|duplicate_candidates/);
});

test("signals are ordered by current radar update time", () => {
  assert.match(fn, /order\("updated_at", \{ ascending: false \}\)/);
});

test("evidence is resolved from typed references", () => {
  assert.match(fn, /publicEvidenceRef/);
  assert.match(fn, /resolveEvidence/);
  assert.match(fn, /EVIDENCE_CONFIG\[type\]/);
});

test("run sources are normalized to names and types", () => {
  assert.match(fn, /from\("intelligence_sources"\)\.select\("id,name,type"\)/);
  assert.match(fn, /sources: .*sourceMap/s);
});

test("edge function has an explicit custom-auth gateway configuration", () => {
  assert.match(config, /\[functions\.bcc-intelligence-api\]\s+verify_jwt = false/m);
});
