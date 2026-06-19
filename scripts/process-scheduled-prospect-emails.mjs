const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "";
const RESEND_FROM_NAME = process.env.RESEND_FROM_NAME || "BCC Technologies";
const RESEND_REPLY_TO_EMAIL = process.env.RESEND_REPLY_TO_EMAIL || "";

const EMAIL_COLUMNS = [
  "id",
  "prospect_id",
  "template_id",
  "recipient_email",
  "subject",
  "body",
  "attachments",
  "status",
  "scheduled_for",
  "sent_at",
  "provider_message_id",
  "created_at",
  "updated_at"
].join(",");

function assertEnv() {
  const missing = [
    ["SUPABASE_URL", SUPABASE_URL],
    ["SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY],
    ["RESEND_API_KEY", RESEND_API_KEY],
    ["RESEND_FROM_EMAIL", RESEND_FROM_EMAIL]
  ].filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) throw new Error(`Missing required env vars: ${missing.join(", ")}`);
}

function restUrl(pathname, params = {}) {
  const url = new URL(`/rest/v1/${pathname}`, SUPABASE_URL);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && typeof value !== "undefined" && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  return url;
}

async function restFetch(pathname, { method = "GET", params = {}, body, prefer } = {}) {
  const response = await fetch(restUrl(pathname, params), {
    method,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      Accept: "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  if (!response.ok) {
    throw new Error(`Supabase ${method} ${pathname} failed with ${response.status}: ${await response.text()}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function bodyToHtml(body) {
  return String(body || "")
    .split(/\n{2,}/)
    .map(block => `<p>${escapeHtml(block).replaceAll("\n", "<br>")}</p>`)
    .join("");
}

function normalizeAttachments(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => item && typeof item === "object" ? item : {})
    .map(item => ({
      filename: String(item.filename || "").trim(),
      path: String(item.path || "").trim()
    }))
    .filter(item => item.filename && /^https?:\/\//i.test(item.path))
    .slice(0, 10);
}

async function fetchDueEmails(limit = 50) {
  const rows = await restFetch("workspace_prospect_emails", {
    params: {
      select: EMAIL_COLUMNS,
      status: "eq.scheduled",
      scheduled_for: `lte.${new Date().toISOString()}`,
      order: "scheduled_for.asc.nullslast,created_at.asc",
      limit
    }
  });
  return Array.isArray(rows) ? rows : [];
}

async function sendEmail(email) {
  const attachments = normalizeAttachments(email.attachments);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      from: `${RESEND_FROM_NAME} <${RESEND_FROM_EMAIL}>`,
      to: [String(email.recipient_email || "").trim()],
      ...(RESEND_REPLY_TO_EMAIL ? { reply_to: RESEND_REPLY_TO_EMAIL } : {}),
      subject: String(email.subject || "").trim(),
      html: bodyToHtml(String(email.body || "")),
      text: String(email.body || ""),
      ...(attachments.length ? { attachments } : {})
    })
  });
  if (!response.ok) {
    throw new Error(`Resend returned ${response.status}: ${await response.text()}`);
  }
  const data = await response.json().catch(() => ({}));
  return { providerMessageId: String(data?.id || "").trim(), attachments };
}

async function markEmailSent(email, providerMessageId) {
  const now = new Date().toISOString();
  const rows = await restFetch("workspace_prospect_emails", {
    method: "PATCH",
    params: {
      id: `eq.${email.id}`
    },
    prefer: "return=representation",
    body: {
      status: "sent",
      scheduled_for: null,
      sent_at: now,
      provider_message_id: providerMessageId.slice(0, 200),
      updated_at: now
    }
  });
  const updated = Array.isArray(rows) ? rows[0] : rows;
  await restFetch("workspace_prospects", {
    method: "PATCH",
    params: {
      id: `eq.${email.prospect_id}`
    },
    body: {
      last_contact_at: now,
      updated_at: now
    }
  });
  return { updated, now };
}

async function insertActivity(email, now, providerMessageId, attachments) {
  await restFetch("workspace_prospect_activities", {
    method: "POST",
    prefer: "return=minimal",
    body: {
      prospect_id: String(email.prospect_id || ""),
      actor_id: null,
      activity_type: "email",
      title: `Correo programado enviado: ${String(email.subject || "").trim().slice(0, 120) || "Sin asunto"}`,
      details: `Enviado automaticamente a ${String(email.recipient_email || "").trim()}`,
      occurred_at: now,
      meta: {
        email_id: email.id,
        recipient_email: String(email.recipient_email || "").trim(),
        provider: "resend",
        provider_message_id: providerMessageId,
        automated: true,
        attachments
      }
    }
  });
}

async function processOne(email) {
  const { providerMessageId, attachments } = await sendEmail(email);
  const { now } = await markEmailSent(email, providerMessageId);
  try {
    await insertActivity(email, now, providerMessageId, attachments);
  } catch (error) {
    console.warn(`[warn] activity log failed for ${email.id}: ${error.message}`);
  }
  return { id: email.id, recipient: email.recipient_email, providerMessageId };
}

async function main() {
  assertEnv();
  const dueEmails = await fetchDueEmails();
  if (!dueEmails.length) {
    console.log("No scheduled prospect emails due.");
    return;
  }

  console.log(`Processing ${dueEmails.length} scheduled prospect emails...`);
  let sent = 0;
  let failed = 0;

  for (const email of dueEmails) {
    try {
      const result = await processOne(email);
      sent += 1;
      console.log(`[sent] ${result.id} -> ${result.recipient} (${result.providerMessageId || "no-provider-id"})`);
    } catch (error) {
      failed += 1;
      console.error(`[error] ${email.id}: ${error.message}`);
    }
  }

  console.log(`Scheduled prospect emails complete. Sent: ${sent}. Failed: ${failed}.`);
  if (failed > 0) process.exitCode = 1;
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
