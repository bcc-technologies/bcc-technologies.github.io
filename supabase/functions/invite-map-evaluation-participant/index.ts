import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2.110.8";

type InviteRequest = {
  institutionId?: string | null;
  cohortId?: string | null;
  email?: string;
  fullName?: string;
  productKey?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  grantReason?: string | null;
  reviewAt?: string | null;
};

type NormalizedInvite = {
  institutionId: string | null;
  cohortId: string | null;
  email: string;
  fullName: string;
  productKey: string | null;
  startsAt: string | null;
  endsAt: string | null;
  grantReason: string;
  reviewAt: string | null;
};

type InviteContext = {
  email: string;
  user_id?: string | null;
  has_signed_in?: boolean;
  institution_id?: string | null;
  suggested_institution_id?: string | null;
};

type ProvisionedAccess = {
  license_id: string;
  member_status: "invited" | "active";
  valid_until: string;
  institution_id?: string | null;
  cohort_id?: string | null;
};

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

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

function optionalUuid(value: unknown, label: string): string | null {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized || normalized === "none") return null;
  if (!UUID_PATTERN.test(normalized)) throw new HttpError(400, `A valid ${label} is required`);
  return normalized;
}

function optionalDate(value: unknown, label: string): string | null {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) throw new HttpError(400, `A valid ${label} is required`);
  return parsed.toISOString();
}

function normalizeInput(input: InviteRequest): NormalizedInvite {
  const institutionId = optionalUuid(input.institutionId, "institutionId");
  const cohortId = optionalUuid(input.cohortId, "cohortId");
  const email = String(input.email || "").trim().toLowerCase();
  const fullName = String(input.fullName || "").trim().replace(/\s+/g, " ");
  const productKey = String(input.productKey || "").trim().toLowerCase() || null;
  const startsAt = optionalDate(input.startsAt, "startsAt");
  const endsAt = optionalDate(input.endsAt, "endsAt");
  const grantReason = String(input.grantReason || "").trim().replace(/\s+/g, " ");
  const reviewAt = optionalDate(input.reviewAt, "reviewAt");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new HttpError(400, "A valid participant email is required");
  }
  if (fullName.length > 160) throw new HttpError(400, "The participant name is too long");
  if (!cohortId) {
    if (!/^map\.(nano|bio|med)$/.test(productKey || "")) {
      throw new HttpError(400, "A valid MAP product is required");
    }
    if (!endsAt || !startsAt || new Date(endsAt) <= new Date(startsAt)) {
      throw new HttpError(400, "Direct tester access requires a valid start and end time");
    }
    if (grantReason.length < 10 || grantReason.length > 1000) {
      throw new HttpError(400, "Direct tester access requires a grant reason between 10 and 1000 characters");
    }
  }

  return {
    institutionId,
    cohortId,
    email,
    fullName,
    productKey,
    startsAt,
    endsAt,
    grantReason,
    reviewAt
  };
}

async function inviteContext(
  admin: SupabaseClient,
  input: NormalizedInvite,
  actorId: string
): Promise<InviteContext> {
  const { data, error } = await admin.rpc("get_tester_invite_context", {
    p_institution_id: input.institutionId,
    p_cohort_id: input.cohortId,
    p_email: input.email,
    p_actor_id: actorId
  });
  if (error) {
    if (/not allowed to manage/i.test(error.message || "")) {
      throw new HttpError(403, "License-management permission required");
    }
    if (/not active|valid participant email|does not belong/i.test(error.message || "")) {
      throw new HttpError(400, error.message);
    }
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

    const admin = adminClient();
    const actor = await authenticatedUser(request, admin);
    const input = normalizeInput(await jsonBody(request));
    let context = await inviteContext(admin, input, actor.id);
    let userId = context.user_id || null;
    let invitationSent = false;

    if (!userId) {
      if (!input.fullName) {
        throw new HttpError(400, "The participant name is required for a new account");
      }
      const { data, error } = await admin.auth.admin.inviteUserByEmail(input.email, {
        redirectTo: invitationRedirectUrl(),
        data: {
          full_name: input.fullName,
          display_name: input.fullName,
          invited_for: "map_tester",
          institution_id: context.institution_id || undefined
        }
      });
      if (error || !data.user) {
        context = await inviteContext(admin, input, actor.id);
        userId = context.user_id || null;
        if (!userId) throw error || new Error("Supabase Auth did not return an invited user");
      } else {
        userId = data.user.id;
        invitationSent = true;
      }
    }

    const memberStatus: "invited" | "active" =
      invitationSent || !context.has_signed_in ? "invited" : "active";

    const { data: provisionedData, error: provisionError } = await admin.rpc("provision_tester_access", {
      p_institution_id: context.institution_id || input.institutionId,
      p_cohort_id: input.cohortId,
      p_user_id: userId,
      p_member_status: memberStatus,
      p_product_key: input.productKey,
      p_starts_at: input.startsAt,
      p_ends_at: input.endsAt,
      p_grant_reason: input.grantReason,
      p_review_at: input.reviewAt,
      p_actor_id: actor.id
    });
    if (provisionError) throw provisionError;

    const provisioned = (
      Array.isArray(provisionedData) ? provisionedData[0] : provisionedData
    ) as ProvisionedAccess | null;
    if (!provisioned?.license_id) throw new Error("Tester access was not provisioned");

    return jsonResponse(request, {
      ok: true,
      invitationSent,
      userId,
      memberStatus: provisioned.member_status,
      licenseId: provisioned.license_id,
      validUntil: provisioned.valid_until,
      institutionId: provisioned.institution_id || null,
      cohortId: provisioned.cohort_id || null,
      suggestedInstitutionId: context.suggested_institution_id || null
    }, invitationSent ? 201 : 200);
  } catch (error) {
    const response = publicError(error);
    return jsonResponse(request, { ok: false, error: response.message }, response.status);
  }
});
