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

function escapeHtml(value: string) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function bodyToHtml(body: string) {
  return String(body || "")
    .split(/\n{2,}/)
    .map(block => `<p>${escapeHtml(block).replaceAll("\n", "<br>")}</p>`)
    .join("");
}

function publicProspectEmail(email: Record<string, unknown>) {
  return {
    id: email.id,
    prospectId: email.prospect_id,
    templateId: email.template_id || "",
    recipientEmail: email.recipient_email,
    subject: email.subject,
    body: email.body,
    attachments: Array.isArray(email.attachments) ? email.attachments : [],
    status: email.status,
    scheduledFor: email.scheduled_for || null,
    sentAt: email.sent_at || null,
    providerMessageId: email.provider_message_id || "",
    createdAt: email.created_at,
    updatedAt: email.updated_at
  };
}

function publicProspectActivity(activity: Record<string, unknown>) {
  return {
    id: activity.id,
    prospectId: activity.prospect_id,
    activityType: activity.activity_type,
    title: activity.title,
    details: activity.details || "",
    dueAt: activity.due_at || null,
    occurredAt: activity.occurred_at || null,
    meta: activity.meta && typeof activity.meta === "object" ? activity.meta : {},
    createdAt: activity.created_at,
    updatedAt: activity.updated_at
  };
}

function normalizeAttachments(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => item && typeof item === "object" ? item as Record<string, unknown> : {})
    .map(item => ({
      filename: String(item.filename || "").trim(),
      path: String(item.path || "").trim()
    }))
    .filter(item => item.filename && /^https?:\/\//i.test(item.path))
    .slice(0, 10);
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ ok: false, error: "Metodo no permitido." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";
  const resendFromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "";
  const resendFromName = Deno.env.get("RESEND_FROM_NAME") || "BCC Technologies";
  const resendReplyToEmail = Deno.env.get("RESEND_REPLY_TO_EMAIL") || "";
  const authHeader = request.headers.get("Authorization") || "";

  if (!supabaseUrl || !supabaseServiceRoleKey || !resendApiKey || !resendFromEmail) {
    return json({ ok: false, error: "Faltan secretos requeridos para envio." }, 500);
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
    .select("role")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError) {
    return json({ ok: false, error: `No fue posible validar permisos: ${profileError.message}` }, 500);
  }

  if (String(profile?.role || "client") !== "admin") {
    return json({ ok: false, error: "Permiso insuficiente." }, 403);
  }

  let payload: { emailId?: string } = {};
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const emailId = String(payload.emailId || "").trim();
  if (!emailId) {
    return json({ ok: false, error: "Falta el id del correo." }, 400);
  }

  const { data: emailRow, error: emailError } = await supabase
    .from("workspace_prospect_emails")
    .select("id, prospect_id, template_id, recipient_email, subject, body, attachments, status, scheduled_for, sent_at, provider_message_id, created_at, updated_at")
    .eq("id", emailId)
    .maybeSingle();

  if (emailError) {
    return json({ ok: false, error: emailError.message }, 500);
  }

  if (!emailRow) {
    return json({ ok: false, error: "Correo no encontrado." }, 404);
  }

  if (String(emailRow.status || "") === "sent") {
    return json({ ok: false, error: "Este correo ya fue enviado." }, 409);
  }

  const attachments = normalizeAttachments(emailRow.attachments);
  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      from: `${resendFromName} <${resendFromEmail}>`,
      to: [String(emailRow.recipient_email || "").trim()],
      ...(resendReplyToEmail ? { reply_to: resendReplyToEmail } : {}),
      subject: String(emailRow.subject || "").trim(),
      html: bodyToHtml(String(emailRow.body || "")),
      text: String(emailRow.body || ""),
      ...(attachments.length ? { attachments } : {})
    })
  });

  if (!resendResponse.ok) {
    return json({
      ok: false,
      error: `Proveedor de correo devolvio ${resendResponse.status}: ${await resendResponse.text()}`
    }, 502);
  }

  const resendData = await resendResponse.json().catch(() => ({}));
  const now = new Date().toISOString();

  const { data: updatedEmail, error: updateError } = await supabase
    .from("workspace_prospect_emails")
    .update({
      status: "sent",
      scheduled_for: null,
      sent_at: now,
      provider_message_id: String(resendData?.id || "").trim().slice(0, 200),
      updated_at: now
    })
    .eq("id", emailId)
    .select("id, prospect_id, template_id, recipient_email, subject, body, attachments, status, scheduled_for, sent_at, provider_message_id, created_at, updated_at")
    .single();

  if (updateError) {
    return json({ ok: false, error: updateError.message }, 500);
  }

  await supabase
    .from("workspace_prospects")
    .update({ last_contact_at: now, updated_at: now })
    .eq("id", String(emailRow.prospect_id || ""));

  let activity = null;
  const { data: activityRow } = await supabase
    .from("workspace_prospect_activities")
    .insert({
      prospect_id: String(emailRow.prospect_id || ""),
      actor_id: authData.user.id,
      activity_type: "email",
      title: `Correo enviado: ${String(emailRow.subject || "").trim().slice(0, 120) || "Sin asunto"}`,
      details: `Enviado a ${String(emailRow.recipient_email || "").trim()}`,
      occurred_at: now,
      meta: {
        email_id: emailId,
        recipient_email: String(emailRow.recipient_email || "").trim(),
        provider: "resend",
        provider_message_id: String(resendData?.id || "").trim(),
        attachments
      }
    })
    .select("id, prospect_id, activity_type, title, details, due_at, occurred_at, meta, created_at, updated_at")
    .maybeSingle();

  if (activityRow) {
    activity = publicProspectActivity(activityRow);
  }

  return json({
    ok: true,
    message: "Correo enviado correctamente.",
    provider: "resend",
    providerMessageId: resendData?.id || "",
    email: publicProspectEmail(updatedEmail),
    ...(activity ? { activity } : {})
  });
});
