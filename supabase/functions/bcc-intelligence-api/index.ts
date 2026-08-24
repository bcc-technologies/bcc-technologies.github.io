import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

const MAX_TOKEN_LENGTH = 256;
const READ_SCOPE = "intelligence:read";

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function cleanText(value: unknown, maxLength = 0) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return maxLength > 0 && text.length > maxLength ? text.slice(0, maxLength).trim() : text;
}

function toHex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string) {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

function bearerToken(request: Request) {
  const header = request.headers.get("Authorization") || "";
  if (!header.startsWith("Bearer ")) return "";
  return header.slice("Bearer ".length).trim();
}

async function readJson(request: Request) {
  try {
    const value = await request.json();
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

Deno.serve(async request => {
  const started = performance.now();
  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceRoleKey) return json({ ok: false, error: "Service unavailable." }, 503);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const token = bearerToken(request);
  if (!token || token.length > MAX_TOKEN_LENGTH || !token.startsWith("bcc_agent_")) {
    return json({ ok: false, error: "Unauthorized." }, 401);
  }

  const tokenHash = await sha256(token);
  const { data: client, error: clientError } = await supabase
    .from("intelligence_api_clients")
    .select("id, name, scopes, enabled, expires_at, rate_limit_per_minute, daily_limit")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (clientError) {
    console.error("bcc-intelligence-api credential lookup failed", { code: clientError.code });
    return json({ ok: false, error: "Service unavailable." }, 503);
  }

  const expired = client?.expires_at ? new Date(client.expires_at).getTime() <= Date.now() : false;
  const scopes = Array.isArray(client?.scopes) ? client.scopes.map(String) : [];
  if (!client || !client.enabled || expired || !scopes.includes(READ_SCOPE)) {
    return json({ ok: false, error: "Unauthorized." }, 401);
  }

  const body = await readJson(request);
  const operation = cleanText(body.operation || "overview", 80).toLowerCase() || "overview";
  let statusCode = 200;
  let resultCount = 0;
  let responseBody: Record<string, unknown>;

  if (operation !== "overview" && operation !== "health") {
    statusCode = 400;
    responseBody = { ok: false, error: "Unsupported operation." };
  } else {
    const [signals, papers, grants, trials, patents, runs] = await Promise.all([
      supabase.from("intelligence_signals").select("id", { count: "exact", head: true }),
      supabase.from("intelligence_papers").select("id", { count: "exact", head: true }),
      supabase.from("intelligence_grants").select("id", { count: "exact", head: true }),
      supabase.from("intelligence_trials").select("id", { count: "exact", head: true }),
      supabase.from("intelligence_patents").select("id", { count: "exact", head: true }),
      supabase.from("intelligence_runs").select("id", { count: "exact", head: true })
    ]);

    const readError = [signals, papers, grants, trials, patents, runs].find(result => result.error)?.error;
    if (readError) {
      console.error("bcc-intelligence-api overview failed", { code: readError.code });
      statusCode = 503;
      responseBody = { ok: false, error: "Service unavailable." };
    } else {
      resultCount = 6;
      responseBody = {
        ok: true,
        operation,
        radar: {
          signals: signals.count || 0,
          papers: papers.count || 0,
          grants: grants.count || 0,
          trials: trials.count || 0,
          patents: patents.count || 0,
          runs: runs.count || 0
        }
      };
    }
  }

  const durationMs = Math.max(0, Math.round(performance.now() - started));
  const { error: auditError } = await supabase.from("intelligence_api_audit").insert({
    client_id: client.id,
    operation,
    result_count: resultCount,
    duration_ms: durationMs,
    status_code: statusCode,
    filters: {}
  });
  if (auditError) console.error("bcc-intelligence-api audit insert failed", { code: auditError.code });

  await supabase
    .from("intelligence_api_clients")
    .update({ last_used_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", client.id);

  return json(responseBody, statusCode);
});
