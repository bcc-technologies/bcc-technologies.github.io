import Stripe from "npm:stripe@22.1.1";
import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2.110.8";

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

export function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function billingMode(): "test" | "live" {
  const mode = requiredEnv("STRIPE_MODE");
  if (mode !== "test" && mode !== "live") throw new Error("STRIPE_MODE must be test or live");
  const secret = requiredEnv("STRIPE_SECRET_KEY");
  const prefixMatches = mode === "live" ? secret.startsWith("sk_live_") : secret.startsWith("sk_test_");
  if (!prefixMatches) throw new Error(`STRIPE_SECRET_KEY does not match STRIPE_MODE=${mode}`);
  return mode;
}

export function isLiveMode(): boolean {
  return billingMode() === "live";
}

export function stripeClient(): Stripe {
  return new Stripe(requiredEnv("STRIPE_SECRET_KEY"), {
    maxNetworkRetries: 2,
    timeout: 20_000,
    appInfo: { name: "BCC MAP Billing", version: "1.0.0" }
  });
}

export function adminClient(): SupabaseClient {
  return createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export async function authenticatedUser(request: Request, admin: SupabaseClient): Promise<User> {
  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new HttpError(401, "Authentication required");
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "Invalid or expired session");
  return data.user;
}

export function siteUrl(): string {
  const value = requiredEnv("BCC_SITE_URL").replace(/\/$/, "");
  const parsed = new URL(value);
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
    throw new Error("BCC_SITE_URL must use HTTPS outside local development");
  }
  return parsed.toString().replace(/\/$/, "");
}

function allowedOrigins(): Set<string> {
  const siteOrigin = new URL(siteUrl());
  const origins = new Set<string>([siteOrigin.origin]);
  if (siteOrigin.protocol === "https:" && siteOrigin.hostname.includes(".")) {
    const hostname = siteOrigin.hostname.startsWith("www.")
      ? siteOrigin.hostname.slice(4)
      : `www.${siteOrigin.hostname}`;
    origins.add(new URL(`${siteOrigin.protocol}//${hostname}${siteOrigin.port ? `:${siteOrigin.port}` : ""}`).origin);
  }
  for (const value of (Deno.env.get("BCC_BILLING_ALLOWED_ORIGINS") || "").split(",")) {
    const origin = value.trim();
    if (origin) origins.add(new URL(origin).origin);
  }
  return origins;
}

function isLocalDevelopmentOrigin(origin: string): boolean {
  try {
    const parsed = new URL(origin);
    return (parsed.protocol === "http:" || parsed.protocol === "https:")
      && ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
  } catch {
    return false;
  }
}

function isAllowedOrigin(origin: string): boolean {
  return allowedOrigins().has(origin) || isLocalDevelopmentOrigin(origin);
}

export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin");
  const allowOrigin = origin && isAllowedOrigin(origin) ? origin : new URL(siteUrl()).origin;
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "3600",
    "Vary": "Origin"
  };
}

export function assertAllowedOrigin(request: Request): void {
  const origin = request.headers.get("Origin");
  if (origin && !isAllowedOrigin(origin)) throw new HttpError(403, "Origin not allowed");
}

export function jsonResponse(request: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...corsHeaders(request) } });
}

export function optionsResponse(request: Request): Response {
  const origin = request.headers.get("Origin");
  if (origin && !isAllowedOrigin(origin)) {
    console.warn("[map-billing] Blocked CORS preflight", {
      origin,
      requestedHeaders: request.headers.get("Access-Control-Request-Headers") || ""
    });
    return new Response("Origin not allowed", { status: 403, headers: corsHeaders(request) });
  }
  return new Response("ok", { headers: corsHeaders(request) });
}
export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

export function errorResponse(request: Request, error: unknown): Response {
  const status = error instanceof HttpError ? error.status : 500;
  const message = error instanceof HttpError ? error.message : "Billing service unavailable";
  console.error("[map-billing]", error);
  return jsonResponse(request, { error: message }, status);
}

export async function jsonBody<T>(request: Request): Promise<T> {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    throw new HttpError(415, "Content-Type must be application/json");
  }
  try {
    return await request.json() as T;
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
}

export function requirePost(request: Request): void {
  if (request.method !== "POST") throw new HttpError(405, "Method not allowed");
}

export function automaticTaxEnabled(): boolean {
  return (Deno.env.get("STRIPE_AUTOMATIC_TAX") || "false").toLowerCase() === "true";
}

export function expandableId(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value && typeof value.id === "string") return value.id;
  return null;
}

