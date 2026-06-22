import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const ALLOWED_ACTIONS = new Set(["sync_papers", "fetch_papers", "fetch_grants", "fetch_patents", "fetch_trials", "generate_signals"]);
const ALLOWED_SOURCE_TYPES = new Set(["arxiv", "openalex", "crossref", "semantic_scholar", "pubmed", "nih_reporter", "nsf", "clinicaltrials", "epo_ops", "cordis", "uspto", "custom"]);
const MANUAL_SYNC_MIN_INTERVAL_MS = 3 * 60 * 1000;
const GITHUB_TIMEOUT_MS = 15000;
const GITHUB_RETRY_LIMIT = 2;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

function cleanText(value: unknown, maxLength = 0) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!maxLength || text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim();
}

function sanitizeLogText(value: unknown, secrets: string[] = []) {
  let text = cleanText(value, 1200)
    .replace(/Bearer\s+[A-Za-z0-9._\-+/=]+/gi, "Bearer [redacted]")
    .replace(/apikey[:=]\s*[A-Za-z0-9._\-+/=]+/gi, "apikey=[redacted]")
    .replace(/token[:=]\s*[A-Za-z0-9._\-+/=]+/gi, "token=[redacted]");

  for (const secret of secrets.filter(Boolean)) {
    if (secret.length >= 6) {
      text = text.split(secret).join("[redacted]");
    }
  }
  return text;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = GITHUB_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function dispatchGithubWorkflow(url: string, init: RequestInit, secrets: string[]) {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= GITHUB_RETRY_LIMIT; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, init, GITHUB_TIMEOUT_MS);
      if (response.ok) return response;
      const body = sanitizeLogText(await response.text(), secrets);
      if (attempt < GITHUB_RETRY_LIMIT && [408, 409, 425, 429, 500, 502, 503, 504].includes(response.status)) {
        await sleep(400 * (attempt + 1));
        continue;
      }
      throw new Error(`GitHub devolvio ${response.status}: ${body || "sin detalle adicional"}`);
    } catch (error) {
      const message = sanitizeLogText(error instanceof Error ? error.message : String(error), secrets);
      lastError = new Error(message.includes("AbortError") ? "GitHub no respondio a tiempo." : message);
      if (attempt < GITHUB_RETRY_LIMIT) {
        await sleep(400 * (attempt + 1));
        continue;
      }
    }
  }

  throw lastError || new Error("No fue posible comunicarse con GitHub.");
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ ok: false, error: "Metodo no permitido." }, 405);
  }

  const githubToken = Deno.env.get("GITHUB_WORKFLOW_TOKEN") || "";
  const githubOwner = Deno.env.get("GITHUB_REPO_OWNER") || "";
  const githubRepo = Deno.env.get("GITHUB_REPO_NAME") || "";
  const workflowFile = Deno.env.get("GITHUB_INTELLIGENCE_WORKFLOW_FILE") || "run-intelligence-sync.yml";
  const workflowRef = Deno.env.get("GITHUB_INTELLIGENCE_WORKFLOW_REF") || "main";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const authHeader = request.headers.get("Authorization") || "";
  const secrets = [githubToken, supabaseServiceRoleKey];

  if (!githubToken || !githubOwner || !githubRepo || !supabaseUrl || !supabaseServiceRoleKey) {
    return json({ ok: false, error: "Faltan secretos requeridos en la Edge Function." }, 500);
  }

  if (!authHeader.startsWith("Bearer ")) {
    return json({ ok: false, error: "No autenticado." }, 401);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const jwt = authHeader.slice("Bearer ".length).trim();
  const { data: authData, error: authError } = await supabase.auth.getUser(jwt);
  if (authError || !authData.user) {
    return json({ ok: false, error: "Sesion invalida." }, 401);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, staff_roles")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError) {
    console.error("intelligence-sync profile validation failed:", sanitizeLogText(profileError.message, secrets));
    return json({ ok: false, error: "No fue posible validar permisos." }, 500);
  }

  const role = String(profile?.role || "client");
  if (role !== "admin") {
    return json({ ok: false, error: "Permiso insuficiente." }, 403);
  }

  let payload: {
    action?: string;
    dryRun?: boolean;
    reason?: string;
    sourceTypes?: string[];
    queryText?: string;
    keywords?: string[];
    limit?: number;
  } = {};

  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const action = String(payload.action || "sync_papers").trim().toLowerCase().slice(0, 80) || "sync_papers";
  if (!ALLOWED_ACTIONS.has(action)) {
    return json({ ok: false, error: "Accion de intelligence invalida." }, 400);
  }
  const dryRun = Boolean(payload.dryRun);
  const reason = String(payload.reason || "").trim().slice(0, 180) || "Manual intelligence sync";
  const sourceTypes = Array.isArray(payload.sourceTypes)
    ? payload.sourceTypes.map(item => String(item || "").trim().toLowerCase()).filter(item => ALLOWED_SOURCE_TYPES.has(item)).slice(0, 8)
    : [];
  const queryText = String(payload.queryText || "").trim().slice(0, 400);
  const keywords = Array.isArray(payload.keywords)
    ? payload.keywords.map(item => String(item || "").trim()).filter(Boolean).slice(0, 24)
    : [];
  const limit = Math.max(1, Math.min(100, Number(payload.limit) || 20));

  const { data: latestRuns, error: latestRunsError } = await supabase
    .from("intelligence_runs")
    .select("id, status, created_at, started_at")
    .order("created_at", { ascending: false })
    .limit(5);

  if (latestRunsError) {
    console.error("intelligence-sync run lookup failed:", sanitizeLogText(latestRunsError.message, secrets));
    return json({ ok: false, error: "No fue posible validar el estado del radar." }, 500);
  }

  const now = Date.now();
  const latestRun = Array.isArray(latestRuns) ? latestRuns[0] : null;
  const latestRunAt = latestRun?.created_at ? new Date(latestRun.created_at).getTime() : 0;
  if (latestRunAt && now - latestRunAt < MANUAL_SYNC_MIN_INTERVAL_MS) {
    const retryAfter = Math.ceil((MANUAL_SYNC_MIN_INTERVAL_MS - (now - latestRunAt)) / 1000);
    return json({ ok: false, error: `Espera ${retryAfter}s antes de lanzar otro sync manual.` }, 429);
  }
  if (Array.isArray(latestRuns) && latestRuns.some(run => ["pending", "running"].includes(String(run?.status || "")))) {
    return json({ ok: false, error: "Ya hay una ejecucion de intelligence en curso." }, 409);
  }

  const workflowUrl = `https://api.github.com/repos/${encodeURIComponent(githubOwner)}/${encodeURIComponent(githubRepo)}/actions/workflows/${encodeURIComponent(workflowFile)}/dispatches`;
  try {
    await dispatchGithubWorkflow(workflowUrl, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${githubToken}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28"
      },
      body: JSON.stringify({
        ref: workflowRef,
        inputs: {
          action,
          reason,
          source_types: sourceTypes.join(","),
          query_text: queryText,
          keywords: keywords.join(","),
          limit: String(limit),
          dry_run: dryRun ? "true" : "false"
        }
      })
    }, secrets);
  } catch (error) {
    const safeMessage = sanitizeLogText(error instanceof Error ? error.message : String(error), secrets);
    console.error("intelligence-sync dispatch failed:", safeMessage);
    return json({ ok: false, error: safeMessage || "No fue posible disparar la sincronizacion." }, 502);
  }

  return json({
    ok: true,
    message: `Workflow de intelligence disparado (${action}${dryRun ? ", dry run" : ""}). GitHub sincronizara las fuentes en breve.`,
    runUrl: `https://github.com/${githubOwner}/${githubRepo}/actions/workflows/${workflowFile}`,
    requestId: crypto.randomUUID()
  });
});
