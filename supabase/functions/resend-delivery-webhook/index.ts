import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Receives Resend webhook events (signed via Svix) and records delivery
// status on the matching workspace_prospect_emails row. Not user-invoked:
// authenticated by verifying the Svix signature, not a Supabase JWT, so this
// function must be deployed with verify_jwt disabled.

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function verifySvixSignature(secret: string, id: string, timestamp: string, body: string, signatureHeader: string) {
  const rawSecret = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  const key = await crypto.subtle.importKey(
    "raw",
    base64ToBytes(rawSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signedContent = `${id}.${timestamp}.${body}`;
  const signatureBytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedContent));
  const expected = bytesToBase64(new Uint8Array(signatureBytes));
  return signatureHeader
    .split(" ")
    .map(part => part.trim())
    .some(candidate => candidate.split(",")[1] === expected);
}

const DELIVERY_EVENT_MAP: Record<string, string> = {
  "email.delivered": "delivered",
  "email.delivery_delayed": "delivery_delayed",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.failed": "failed"
};

const ACTIVITY_WORTHY = new Set(["bounced", "complained"]);

Deno.serve(async request => {
  if (request.method !== "POST") {
    return json({ ok: false, error: "Metodo no permitido." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const webhookSecret = Deno.env.get("RESEND_WEBHOOK_SECRET") || "";

  if (!supabaseUrl || !supabaseServiceRoleKey || !webhookSecret) {
    return json({ ok: false, error: "Faltan secretos requeridos." }, 500);
  }

  const svixId = request.headers.get("svix-id") || "";
  const svixTimestamp = request.headers.get("svix-timestamp") || "";
  const svixSignature = request.headers.get("svix-signature") || "";
  const rawBody = await request.text();

  if (!svixId || !svixTimestamp || !svixSignature) {
    return json({ ok: false, error: "Firma faltante." }, 401);
  }

  const timestampSeconds = Number(svixTimestamp);
  if (!Number.isFinite(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > 300) {
    return json({ ok: false, error: "Marca de tiempo invalida o expirada." }, 401);
  }

  let signatureValid = false;
  try {
    signatureValid = await verifySvixSignature(webhookSecret, svixId, svixTimestamp, rawBody, svixSignature);
  } catch {
    signatureValid = false;
  }
  if (!signatureValid) {
    return json({ ok: false, error: "Firma invalida." }, 401);
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ ok: false, error: "Cuerpo invalido." }, 400);
  }

  const eventType = String(payload.type || "");
  const deliveryStatus = DELIVERY_EVENT_MAP[eventType];
  if (!deliveryStatus) {
    return json({ ok: true, ignored: true });
  }

  const data = (payload.data && typeof payload.data === "object" ? payload.data : {}) as Record<string, unknown>;
  const resendEmailId = String(data.email_id || data.id || "").trim();
  if (!resendEmailId) {
    return json({ ok: true, ignored: true });
  }

  const detailParts: string[] = [];
  if (data.bounce && typeof data.bounce === "object") {
    const bounce = data.bounce as Record<string, unknown>;
    if (bounce.message) detailParts.push(String(bounce.message));
    else if (bounce.type) detailParts.push(String(bounce.type));
  }
  if (data.click && typeof data.click === "object") {
    const click = data.click as Record<string, unknown>;
    if (click.link) detailParts.push(String(click.link));
  }
  const detail = detailParts.join(" ").trim().slice(0, 500);

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: emailRow, error: fetchError } = await supabase
    .from("workspace_prospect_emails")
    .select("id, prospect_id, subject, recipient_email")
    .eq("provider_message_id", resendEmailId)
    .maybeSingle();

  if (fetchError || !emailRow) {
    return json({ ok: true, matched: false });
  }

  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("workspace_prospect_emails")
    .update({
      delivery_status: deliveryStatus,
      delivery_status_at: now,
      delivery_detail: detail,
      updated_at: now
    })
    .eq("id", emailRow.id);

  if (updateError) {
    return json({ ok: false, error: updateError.message }, 500);
  }

  if (ACTIVITY_WORTHY.has(deliveryStatus)) {
    const label = deliveryStatus === "bounced" ? "Correo rebotado" : "Correo marcado como spam";
    await supabase.from("workspace_prospect_activities").insert({
      prospect_id: emailRow.prospect_id,
      actor_id: null,
      activity_type: "note",
      title: `${label}: ${String(emailRow.subject || "").trim().slice(0, 100) || "Sin asunto"}`,
      details: detail || `Evento ${eventType} para ${String(emailRow.recipient_email || "").trim()}`,
      occurred_at: now,
      meta: {
        source: "resend_webhook",
        event: eventType,
        email_id: emailRow.id,
        provider_message_id: resendEmailId
      }
    });
  }

  return json({ ok: true, matched: true, deliveryStatus });
});
