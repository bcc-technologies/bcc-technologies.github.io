import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8"
    }
  });
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
  const workflowFile = Deno.env.get("GITHUB_BLOG_WORKFLOW_FILE") || "generate-supabase-blog.yml";
  const workflowRef = Deno.env.get("GITHUB_BLOG_WORKFLOW_REF") || "main";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const authHeader = request.headers.get("Authorization") || "";

  if (!githubToken || !githubOwner || !githubRepo || !supabaseUrl || !supabaseServiceRoleKey) {
    return json({
      ok: false,
      error: "Faltan secretos requeridos en la Edge Function."
    }, 500);
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
    return json({ ok: false, error: `No fue posible validar permisos: ${profileError.message}` }, 500);
  }

  const role = String(profile?.role || "client");
  const staffRoles = Array.isArray(profile?.staff_roles) ? profile.staff_roles.map(String) : [];
  const canPublish = role === "admin" || staffRoles.some(item => ["author", "cofounder", "department_director"].includes(item));

  if (!canPublish) {
    return json({ ok: false, error: "Permiso insuficiente." }, 403);
  }

  let payload: { message?: string } = {};
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const message = String(payload.message || "").trim().slice(0, 180) || "Generate Supabase blog pages";
  const workflowUrl = `https://api.github.com/repos/${encodeURIComponent(githubOwner)}/${encodeURIComponent(githubRepo)}/actions/workflows/${encodeURIComponent(workflowFile)}/dispatches`;

  const dispatchResponse = await fetch(workflowUrl, {
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
        reason: message
      }
    })
  });

  if (!dispatchResponse.ok) {
    return json({
      ok: false,
      error: `GitHub devolvio ${dispatchResponse.status}: ${await dispatchResponse.text()}`
    }, 502);
  }

  return json({
    ok: true,
    message: "Workflow disparado. GitHub generara el HTML del blog en breve.",
    runUrl: `https://github.com/${githubOwner}/${githubRepo}/actions/workflows/${workflowFile}`,
    requestId: crypto.randomUUID()
  });
});
