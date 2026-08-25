import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2.110.8";

type InviteRequest = {
  cohortId?: string;
  email?: string;
  fullName?: string;
};

type InviteContext = {
  email: string;
  user_id?: string | null;
  has_signed_in?: boolean;
};

type ProvisionedAccess = {
  license_id: string;
  member_status: "invited" | "active";
  valid_until: string;
};

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function siteUrl(): string {
  const parsed = new URL(requiredEnv("BCC_SITE_URL"));
  if (parsed.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(parsed.hostname)) {
    throw new Error("BCC_SITE_URL must use HTTPS outside local development");
  }
  return parsed.toString().replace(/\/$/, "");
}

function allowedOrigins(): Set<string> {
  const canonical = new URL(siteUrl());
  const origins = new Set<string>([canonical.origin]);
  for (const value of (Deno.env.get("BCC_MAP_ADMIN_ALLOWED_ORIGINS") || "").split(",")) {
    const origin = value.trim();
    if (origin) origins.add(new URL(origin).origin);
  }
  return origins;
}

function isLocalOrigin(origin: string): boolean {
  try {
    const parsed = new URL(origin);
    return ["http:", "https:"].includes(parsed.protocol)
      && ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
  } catch {
    return false;
  }
}

function isAllowedOrigin(origin: string): boolean {
  return allowedOrigins().has(origin) || isLocalOrigin(origin);
}

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin");
  return {
    "Access-Control-Allow-Origin": origin && isAllowedOrigin(origin) ? origin : new URL(siteUrl()).origin,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "3600",
    "Vary": "Origin"
  };
}

function jsonResponse(request: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...corsHeaders(request) }
  });
}

function optionsResponse(request: Request): Response {
  const origin = request.headers.get("Origin");
  if (origin && !isAllowedOrigin(origin)) {
    return new Response("Origin not allowed", { status: 403, headers: corsHeaders(request) });
  }
  return new Response("ok", { headers: corsHeaders(request) });
}

function assertAllowedOrigin(request: Request): void {
  const origin = request.headers.get("Origin");
  if (origin && !isAllowedOrigin(origin)) throw new HttpError(403, "Origin not allowed");
}

function adminClient(): SupabaseClient {
  return createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

async function authenticatedUser(request: Request, admin: SupabaseClient): Promise<User> {
  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new HttpError(401, "Authentication required");
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "Invalid or expired session");
  return data.user;
}

async function jsonBody(request: Request): Promise<InviteRequest> {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    throw new HttpError(415, "Content-Type must be application/json");
  }
  try {
    return await request.json() as InviteRequest;
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
}

function normalizeInput(input: InviteRequest): Required<InviteRequest> {
  const cohortId = String(input.cohortId || "").trim().toLowerCase();
  const email = String(input.email || "").trim().toLowerCase();
  const fullName = String(input.fullName || "").trim().replace(/\s+/g, " ");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(cohortId)) {
    throw new HttpError(400, "A valid cohortId is required");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new HttpError(400, "A valid participant email is required");
  }
  if (fullName.length > 160) throw new HttpError(400, "The participant name is too long");
  return { cohortId, email, fullName };
}

async function inviteContext(
  admin: SupabaseClient,
  cohortId: string,
  email: string,
  actorId: string
): Promise<InviteContext> {
  const { data, error } = await admin.rpc("get_evaluation_invite_context", {
    p_cohort_id: cohortId,
    p_email: email,
    p_actor_id: actorId
  });
  if (error) {
    if (/not allowed to manage/i.test(error.message || "")) throw new HttpError(403, "License-management permission required");
    if (/not active|valid participant email/i.test(error.message || "")) throw new HttpError(400, error.message);
    throw error;
  }
  return (data || {}) as InviteContext;
}

function invitationRedirectUrl(): string {
  const configured = Deno.env.get("BCC_MAP_INVITE_REDIRECT_URL")?.trim();
  if (configured) return new URL(configured).toString();
  return `${siteUrl()}/auth-callback.html?next=${encodeURIComponent("/dashboard.html#licencias")}`;
}

function publicError(error: unknown): { status: number; message: string } {
  if (error instanceof HttpError) return { status: error.status, message: error.message };
  console.error("[map-evaluation-invite]", error);
  return { status: 500, message: "The MAP invitation service is unavailable" };
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return optionsResponse(request);
  try {
    if (request.method !== "POST") throw new HttpError(405, "Method not allowed");
    assertAllowedOrigin(request);
    const input = normalizeInput(await jsonBody(request));
    const admin = adminClient();
    const actor = await authenticatedUser(request, admin);

    let context = await inviteContext(admin, input.cohortId, input.email, actor.id);
    let userId = context.user_id || null;
    let invitationSent = false;

    if (!userId) {
      const { data, error } = await admin.auth.admin.inviteUserByEmail(input.email, {
        redirectTo: invitationRedirectUrl(),
        data: {
          full_name: input.fullName || undefined,
          display_name: input.fullName || undefined,
          invited_for: "map_evaluation"
        }
      });
      if (error || !data.user) {
        // A concurrent request may have created the auth user after the first
        // context lookup. Re-read once so retries remain idempotent.
        context = await inviteContext(admin, input.cohortId, input.email, actor.id);
        userId = context.user_id || null;
        if (!userId) throw error || new Error("Supabase Auth did not return an invited user");
      } else {
        userId = data.user.id;
        invitationSent = true;
      }
    }

    const memberStatus: "invited" | "active" = invitationSent || !context.has_signed_in ? "invited" : "active";
    const { data: provisionedData, error: provisionError } = await admin.rpc("provision_evaluation_access", {
      p_cohort_id: input.cohortId,
      p_user_id: userId,
      p_member_status: memberStatus,
      p_requested_ends_at: null,
      p_actor_id: actor.id
    });
    if (provisionError) throw provisionError;
    const provisioned = (Array.isArray(provisionedData) ? provisionedData[0] : provisionedData) as ProvisionedAccess | null;
    if (!provisioned?.license_id) throw new Error("Evaluation access was not provisioned");

    return jsonResponse(request, {
      ok: true,
      invitationSent,
      userId,
      memberStatus: provisioned.member_status,
      licenseId: provisioned.license_id,
      validUntil: provisioned.valid_until
    }, invitationSent ? 201 : 200);
  } catch (error) {
    const response = publicError(error);
    return jsonResponse(request, { ok: false, error: response.message }, response.status);
  }
});
