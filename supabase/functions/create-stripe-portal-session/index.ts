import Stripe from "npm:stripe@22.1.1";
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

const MANAGED_PORTAL_METADATA = {
  managed_by: "bcc-maps-billing",
  product_key: "map.nano",
  catalog_version: "2026-08"
};

const MAP_NANO_PORTAL_PRODUCTS = [
  {
    product: "prod_V2RHI0sFqf2G8D",
    prices: ["price_1U2eO361z0I4dYgKCrV0KcHo", "price_1U2MPQ61z0I4dYgK2XuYLB8N"]
  },
  {
    product: "prod_V2RIFgAK1iL6NV",
    prices: ["price_1U2eOC61z0I4dYgKxmosZL0C", "price_1U2MQ961z0I4dYgKjWKx8ZXl"]
  }
] as const;

function portalConfigurationParams(baseUrl: string): Stripe.BillingPortal.ConfigurationCreateParams {
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
        products: MAP_NANO_PORTAL_PRODUCTS.map(product => ({
          product: product.product,
          prices: [...product.prices]
        }))
      }
    },
    metadata: MANAGED_PORTAL_METADATA
  };
}

async function ensurePortalConfiguration(stripe: Stripe, baseUrl: string): Promise<Stripe.BillingPortal.Configuration> {
  const params = portalConfigurationParams(baseUrl);
  const configurations = await stripe.billingPortal.configurations.list({ active: true, limit: 100 });
  const existing = configurations.data.find(configuration =>
    configuration.metadata?.managed_by === MANAGED_PORTAL_METADATA.managed_by
    && configuration.metadata?.product_key === MANAGED_PORTAL_METADATA.product_key
  );

  if (existing) {
    return stripe.billingPortal.configurations.update(existing.id, params);
  }

  return stripe.billingPortal.configurations.create(params, {
    idempotencyKey: `map-nano-portal-${MANAGED_PORTAL_METADATA.catalog_version}`
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
    const { data, error } = await admin.rpc("get_map_portal_context", {
      p_actor_id: user.id,
      p_account_id: input.accountId || null,
      p_livemode: isLiveMode()
    });
    if (error) throw error;

    const stripe = stripeClient();
    const configuration = await ensurePortalConfiguration(stripe, siteUrl());
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

