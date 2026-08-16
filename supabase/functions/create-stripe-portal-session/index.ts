import Stripe from "npm:stripe@22.1.1";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.110.8";
import {
  adminClient,
  assertAllowedOrigin,
  authenticatedUser,
  errorResponse,
  isLiveMode,
  jsonBody,
  jsonResponse,
  optionsResponse,
  requirePost,
  siteUrl,
  stripeClient
} from "../_shared/map-billing.ts";

type PortalRequest = { accountId?: string | null };
type PortalProductGroup = { product: string; prices: string[] };

const MANAGED_PORTAL_METADATA = {
  managed_by: "bcc-maps-billing",
  product_key: "map.nano"
};

// Reads the same billing_price_catalog table that Checkout uses instead of
// hardcoding Stripe Product/Price IDs here, so a price rotation only ever
// needs a migration, not a matching Edge Function edit.
async function loadPortalProducts(
  admin: SupabaseClient,
  stripe: Stripe,
  livemode: boolean
): Promise<PortalProductGroup[]> {
  const { data, error } = await admin
    .from("billing_price_catalog")
    .select("lookup_key, license_plans!inner(product_key, commercial_key)")
    .eq("livemode", livemode)
    .eq("active", true)
    .eq("license_plans.product_key", "map.nano")
    .in("license_plans.commercial_key", ["essential", "professional"]);
  if (error) throw error;

  const lookupKeys = (data ?? [])
    .map(row => row.lookup_key)
    .filter((key): key is string => Boolean(key));
  if (lookupKeys.length === 0) {
    throw new Error("No active MAP-Nano Stripe prices are configured for the billing portal");
  }

  const prices = await stripe.prices.list({ lookup_keys: lookupKeys, active: true, limit: 100 });
  const grouped = new Map<string, Set<string>>();
  for (const price of prices.data) {
    const productId = typeof price.product === "string" ? price.product : price.product.id;
    if (!grouped.has(productId)) grouped.set(productId, new Set());
    grouped.get(productId)!.add(price.id);
  }
  if (grouped.size === 0) {
    throw new Error("Stripe returned no MAP-Nano prices for the billing portal");
  }

  return [...grouped.entries()].map(([product, priceIds]) => ({ product, prices: [...priceIds] }));
}

function portalConfigurationParams(
  baseUrl: string,
  products: PortalProductGroup[]
): Stripe.BillingPortal.ConfigurationCreateParams {
  return {
    name: "BCC MAP-Nano self-service",
    default_return_url: `${baseUrl}/dashboard.html?module=licenses`,
    business_profile: {
      headline: "Manage your MAP-Nano subscription securely."
    },
    features: {
      customer_update: {
        enabled: true,
        allowed_updates: ["address", "email", "name", "phone", "tax_id"]
      },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: {
        enabled: true,
        mode: "at_period_end",
        proration_behavior: "none",
        cancellation_reason: {
          enabled: true,
          options: ["too_expensive", "missing_features", "unused", "switched_service", "other"]
        }
      },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ["price"],
        billing_cycle_anchor: "unchanged",
        proration_behavior: "create_prorations",
        trial_update_behavior: "continue_trial",
        schedule_at_period_end: {
          conditions: [{ type: "decreasing_item_amount" }, { type: "shortening_interval" }]
        },
        products: products.map(group => ({
          product: group.product,
          prices: [...group.prices]
        }))
      }
    },
    metadata: MANAGED_PORTAL_METADATA
  };
}

async function ensurePortalConfiguration(
  stripe: Stripe,
  baseUrl: string,
  products: PortalProductGroup[]
): Promise<Stripe.BillingPortal.Configuration> {
  const params = portalConfigurationParams(baseUrl, products);
  const configurations = await stripe.billingPortal.configurations.list({ active: true, limit: 100 });
  const existing = configurations.data.find(configuration =>
    configuration.metadata?.managed_by === MANAGED_PORTAL_METADATA.managed_by
    && configuration.metadata?.product_key === MANAGED_PORTAL_METADATA.product_key
  );

  if (existing) {
    return stripe.billingPortal.configurations.update(existing.id, params);
  }

  return stripe.billingPortal.configurations.create(params, {
    idempotencyKey: "map-nano-portal-configuration"
  });
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return optionsResponse(request);
  try {
    requirePost(request);
    assertAllowedOrigin(request);
    const input = await jsonBody<PortalRequest>(request);
    const admin = adminClient();
    const user = await authenticatedUser(request, admin);
    const livemode = isLiveMode();
    const { data, error } = await admin.rpc("get_map_portal_context", {
      p_actor_id: user.id,
      p_account_id: input.accountId || null,
      p_livemode: livemode
    });
    if (error) throw error;

    const stripe = stripeClient();
    const products = await loadPortalProducts(admin, stripe, livemode);
    const configuration = await ensurePortalConfiguration(stripe, siteUrl(), products);
    const session = await stripe.billingPortal.sessions.create({
      customer: data.stripe_customer_id,
      return_url: `${siteUrl()}/dashboard.html?module=licenses`,
      configuration: configuration.id
    });
    return jsonResponse(request, { url: session.url, configurationId: configuration.id });
  } catch (error) {
    return errorResponse(request, error);
  }
});

