import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-dispatch-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type PushRow = {
  notification_id: string;
  user_id: string;
  title: string;
  body: string;
  target_url: string;
  tag: string;
  subscription_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
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

function cleanText(value: unknown, maxLength = 500) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length <= maxLength ? text : text.slice(0, maxLength).trim();
}

function isAuthorized(request: Request, serviceRoleKey: string, dispatchSecret: string) {
  const authHeader = request.headers.get("Authorization") || "";
  const secretHeader = request.headers.get("x-dispatch-secret") || "";
  if (dispatchSecret && secretHeader && secretHeader === dispatchSecret) return true;
  return Boolean(serviceRoleKey && authHeader === `Bearer ${serviceRoleKey}`);
}

function notificationPayload(row: PushRow) {
  return JSON.stringify({
    title: cleanText(row.title, 160) || "BCC Workspace",
    body: cleanText(row.body, 300),
    url: cleanText(row.target_url, 300) || "/staff-dashboard.html#trabajo",
    tag: cleanText(row.tag, 160) || `workspace-${row.notification_id}`,
    icon: "/favicon.ico",
    badge: "/favicon.ico"
  });
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ ok: false, error: "Metodo no permitido." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@bcc-technologies.com";
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") || "";
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") || "";
  const dispatchSecret = Deno.env.get("WORKSPACE_PUSH_DISPATCH_SECRET") || "";

  if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey) {
    return json({ ok: false, error: "Faltan secretos requeridos para Web Push." }, 500);
  }

  if (!isAuthorized(request, serviceRoleKey, dispatchSecret)) {
    return json({ ok: false, error: "No autorizado." }, 401);
  }

  let payload: { batchSize?: number } = {};
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const batchSize = Math.max(1, Math.min(Number(payload.batchSize) || 25, 100));
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const { data, error } = await supabase.rpc("claim_workspace_push_notifications", { batch_size: batchSize });
  if (error) return json({ ok: false, error: error.message }, 500);

  const rows = (Array.isArray(data) ? data : []) as PushRow[];
  const notificationResults = new Map<string, { sent: number; failed: number; errors: string[] }>();

  for (const row of rows) {
    const current = notificationResults.get(row.notification_id) || { sent: 0, failed: 0, errors: [] };
    try {
      await webpush.sendNotification({
        endpoint: row.endpoint,
        keys: {
          p256dh: row.p256dh,
          auth: row.auth
        }
      }, notificationPayload(row));
      current.sent += 1;
    } catch (error) {
      current.failed += 1;
      const statusCode = Number((error as { statusCode?: number })?.statusCode || 0);
      const message = cleanText(error instanceof Error ? error.message : String(error), 220);
      current.errors.push(message || `Push fallo${statusCode ? ` (${statusCode})` : ""}`);
      if ([404, 410].includes(statusCode)) {
        await supabase.from("workspace_push_subscriptions").delete().eq("id", row.subscription_id);
      }
    }
    notificationResults.set(row.notification_id, current);
  }

  for (const [notificationId, result] of notificationResults.entries()) {
    const succeeded = result.sent > 0;
    await supabase.rpc("mark_workspace_push_notification", {
      notification_id: notificationId,
      succeeded,
      error_message: result.errors.join(" | ")
    });
  }

  return json({
    ok: true,
    claimed: rows.length,
    notifications: notificationResults.size,
    sent: [...notificationResults.values()].reduce((total, item) => total + item.sent, 0),
    failed: [...notificationResults.values()].reduce((total, item) => total + item.failed, 0)
  });
});
