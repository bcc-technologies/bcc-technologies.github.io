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

test("v0.1 exposes only health and overview operations", () => {
  assert.match(fn, /operation !== "overview" && operation !== "health"/);
  assert.doesNotMatch(fn, /sync_papers|generate_signals|fetch_patents/);
});

test("edge function has an explicit custom-auth gateway configuration", () => {
  assert.match(config, /\[functions\.bcc-intelligence-api\]\s+verify_jwt = false/m);
});
