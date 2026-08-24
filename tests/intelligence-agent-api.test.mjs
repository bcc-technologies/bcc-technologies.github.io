import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const foundationPath = path.join(root, "supabase/migrations/20260824142756_intelligence_agent_api_foundation.sql");
const rateLimitPath = path.join(root, "supabase/migrations/20260824152538_intelligence_agent_api_rate_limits.sql");
const functionPath = path.join(root, "supabase/functions/bcc-intelligence-api/index.ts");
const configPath = path.join(root, "supabase/config.toml");

const foundation = fs.readFileSync(foundationPath, "utf8");
const rateLimit = fs.readFileSync(rateLimitPath, "utf8");
const fn = fs.readFileSync(functionPath, "utf8");
const config = fs.readFileSync(configPath, "utf8");

test("agent credentials remain hash-only and read-scoped", () => {
  assert.match(foundation, /token_hash text not null/i);
  assert.match(foundation, /token_hash ~ '\^\[a-f0-9\]\{64\}\$'/i);
  assert.match(foundation, /intelligence:read/);
  assert.doesNotMatch(foundation, /token_plain|plaintext_token|raw_token/i);
});

test("agent internal tables remain backend-only", () => {
  assert.match(foundation, /enable row level security/i);
  assert.match(foundation, /revoke all on public\.intelligence_api_clients from public, anon, authenticated/i);
  assert.match(foundation, /revoke all on public\.intelligence_api_audit from public, anon, authenticated/i);
  assert.match(foundation, /grant all on public\.intelligence_api_clients to service_role/i);
});

test("v0.4 rate state is backend-only and RLS protected", () => {
  assert.match(rateLimit, /create table if not exists public\.intelligence_api_rate_state/i);
  assert.match(rateLimit, /alter table public\.intelligence_api_rate_state enable row level security/i);
  assert.match(rateLimit, /revoke all on public\.intelligence_api_rate_state from public, anon, authenticated/i);
  assert.match(rateLimit, /grant all on public\.intelligence_api_rate_state to service_role/i);
});

test("quota consumption is atomic and not SECURITY DEFINER", () => {
  assert.match(rateLimit, /create or replace function public\.consume_intelligence_api_quota/i);
  assert.match(rateLimit, /security invoker/i);
  assert.match(rateLimit, /for update/i);
  assert.match(rateLimit, /revoke all on function public\.consume_intelligence_api_quota\(uuid\) from public, anon, authenticated/i);
  assert.match(rateLimit, /grant execute on function public\.consume_intelligence_api_quota\(uuid\) to service_role/i);
  assert.doesNotMatch(rateLimit, /security definer/i);
});

test("edge function authenticates before quota and corpus access", () => {
  const credentialLookup = fn.indexOf('.from("intelligence_api_clients")');
  const quota = fn.indexOf('.rpc("consume_intelligence_api_quota"');
  const dispatch = fn.indexOf("await dispatch(supabase,operation,body)");
  assert.ok(credentialLookup >= 0);
  assert.ok(quota > credentialLookup);
  assert.ok(dispatch > quota);
  assert.match(fn, /token\.startsWith\("bcc_agent_"\)/);
  assert.match(fn, /scopes\.includes\(READ_SCOPE\)/);
});

test("v0.4 returns 429 and Retry-After when quota is exhausted", () => {
  assert.match(fn, /Rate limit exceeded\./);
  assert.match(fn, /429/);
  assert.match(fn, /"Retry-After"/);
  assert.match(fn, /X-RateLimit-Remaining-Minute/);
  assert.match(fn, /X-RateLimit-Remaining-Day/);
});

test("v0.4 bounds and validates the HTTP request body", () => {
  assert.match(fn, /MAX_BODY_BYTES = 16 \* 1024/);
  assert.match(fn, /Content-Length/);
  assert.match(fn, /request\.body\.getReader\(\)/);
  assert.match(fn, /status:413/);
  assert.match(fn, /Content-Type must be application\/json/);
  assert.match(fn, /JSON body must be an object/);
  assert.match(fn, /Invalid JSON/);
});

test("v0.4 uses strict request types instead of truthy coercion", () => {
  assert.match(fn, /function strictBoolean/);
  assert.match(fn, /function strictInteger/);
  assert.match(fn, /function strictString/);
  assert.match(fn, /function validDate/);
  assert.doesNotMatch(fn, /Boolean\(body\.includeArchived/);
});

test("v0.4 exposes only intended read operations", () => {
  assert.match(fn, /ALLOWED_OPERATIONS = new Set\(\["health", "overview", "signals", "signal", "signal_evidence", "runs", "search"\]\)/);
  assert.doesNotMatch(fn, /sync_papers|generate_signals|fetch_patents|saveTopic|updateSignalStatus/);
});

test("search remains bounded and avoids raw PostgREST OR expressions", () => {
  assert.match(fn, /strictInteger\(body\.limit,15,1,25\)/);
  assert.match(fn, /strictInteger\(body\.offset,0,0,200\)/);
  assert.match(fn, /Math\.min\(60,Math\.max\(30,f\.offset\+f\.limit\+15\)\)/);
  assert.match(fn, /\.ilike\(field,/);
  assert.doesNotMatch(fn, /\.or\(/);
});

test("search query plaintext is not written to audit filters", () => {
  assert.match(fn, /queryMaterial:f\.q/);
  assert.match(fn, /queryMaterial \? await sha256\(queryMaterial\)/);
  assert.doesNotMatch(fn, /filters:\{[^}]*query:/s);
});

test("corpus reads use field allowlists and exclude raw ingestion data", () => {
  assert.match(fn, /SEARCH_SPECS = Object\.freeze/);
  assert.match(fn, /EVIDENCE_CONFIG = Object\.freeze/);
  assert.doesNotMatch(fn, /select\("\*"\)/);
  assert.doesNotMatch(fn, /raw_data|duplicate_candidates/);
});

test("existing result limits remain enforced", () => {
  assert.match(fn, /strictInteger\(body\.limit,20,1,50\)/);
  assert.match(fn, /strictInteger\(body\.limit,25,1,25\)/);
  assert.match(fn, /strictInteger\(body\.limit,10,1,30\)/);
});

test("custom-auth gateway remains explicit", () => {
  assert.match(config, /\[functions\.bcc-intelligence-api\]\s+verify_jwt = false/m);
});
