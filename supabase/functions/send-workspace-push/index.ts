import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as webpush from "jsr:@negrel/webpush@0.5.0";

// Uses @negrel/webpush (RFC 8291/8292, Web Crypto only) instead of the
// npm "web-push" package: that package relies on Node's legacy
// crypto.createECDH(), which Deno's Node-compat layer does not implement
// ("Not implemented: crypto.ECDH"), so every send used to fail regardless
// of secrets/config.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-dispatch-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type PushRow = {
  notification_id: string;
  user_id: string;
  notification_type?: string;
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

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

// VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are stored as raw base64url (the
// widely-used "web-push"-compatible format: an uncompressed EC point for
// the public key, a raw 32-byte scalar for the private key). @negrel/webpush
// wants a JWK, so rebuild one from those same raw bytes -- no need to
// regenerate or re-store secrets.
function vapidJwkFromRaw(publicKeyB64url: string, privateKeyB64url: string) {
  const publicRaw = base64UrlToBytes(publicKeyB64url);
  if (publicRaw.length !== 65 || publicRaw[0] !== 0x04) {
    throw new Error("VAPID_PUBLIC_KEY invalido: se espera un punto EC sin comprimir de 65 bytes.");
  }
  const privateRaw = base64UrlToBytes(privateKeyB64url);
  if (privateRaw.length !== 32) {
    throw new Error("VAPID_PRIVATE_KEY invalido: se esperaban 32 bytes.");
  }
  const x = bytesToBase64Url(publicRaw.slice(1, 33));
  const y = bytesToBase64Url(publicRaw.slice(33, 65));
  const d = bytesToBase64Url(privateRaw);
  return {
    publicKey: { kty: "EC", crv: "P-256", x, y, ext: true },
    privateKey: { kty: "EC", crv: "P-256", x, y, d, ext: true }
  };
}

function notificationVibration(row: PushRow) {
  switch (row.notification_type) {
    case "task_overdue":
    case "prospect_overdue":
      return [220, 90, 220, 90, 160];
    case "task_assigned":
    case "task_suggested":
      return [180, 80, 180];
    case "calendar_event":
      return [140, 70, 140];
    default:
      return [160, 70, 160];
  }
}

function notificationPayload(row: PushRow) {
  const notificationType = cleanText(row.notification_type, 80);
  return JSON.stringify({
    title: cleanText(row.title, 160) || "BCC Workspace",
    body: cleanText(row.body, 300),
    url: cleanText(row.target_url, 300) || "/staff-dashboard.html#trabajo",
    tag: cleanText(row.tag, 160) || `workspace-${row.notification_id}`,
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    renotify: true,
    silent: false,
    requireInteraction: ["task_assigned", "task_suggested", "task_overdue"].includes(notificationType),
    vibrate: notificationVibration(row),
    timestamp: Date.now(),
    actions: [{ action: "open", title: "Abrir" }]
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

  let appServer: webpush.ApplicationServer;
  try {
    const vapidKeys = await webpush.importVapidKeys(
      vapidJwkFromRaw(vapidPublicKey, vapidPrivateKey),
      { extractable: false }
    );
    appServer = await webpush.ApplicationServer.new({
      contactInformation: vapidSubject,
      vapidKeys
    });
  } catch (error) {
    return json({ ok: false, error: `VAPID invalido: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }

  const { data, error } = await supabase.rpc("claim_workspace_push_notifications", { batch_size: batchSize });
  if (error) return json({ ok: false, error: error.message }, 500);

  const rows = (Array.isArray(data) ? data : []) as PushRow[];
  const notificationResults = new Map<string, { sent: number; failed: number; errors: string[] }>();

  for (const row of rows) {
    const current = notificationResults.get(row.notification_id) || { sent: 0, failed: 0, errors: [] };
    try {
      const subscriber = appServer.subscribe({
        endpoint: row.endpoint,
        keys: {
          p256dh: row.p256dh,
          auth: row.auth
        }
      });
      await subscriber.pushTextMessage(notificationPayload(row), {
        urgency: webpush.Urgency.Normal,
        ttl: 60
      });
      current.sent += 1;
    } catch (error) {
      current.failed += 1;
      if (error instanceof webpush.PushMessageError) {
        current.errors.push(`Push fallo (${error.response.status})`);
        if (error.isGone()) {
          await supabase.from("workspace_push_subscriptions").delete().eq("id", row.subscription_id);
        }
      } else {
        current.errors.push(cleanText(error instanceof Error ? error.message : String(error), 220));
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
