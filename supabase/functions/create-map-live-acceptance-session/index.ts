import type Stripe from "npm:stripe@22.1.1";
import {
  adminClient,
  assertAllowedOrigin,
  authenticatedUser,
  errorResponse,
  expandableId,
  HttpError,
  isLiveMode,
  jsonBody,
  jsonResponse,
  optionsResponse,
  requiredEnv,
  requirePost,
  siteUrl,
  stripeClient
} from "../_shared/map-billing.ts";

type AcceptanceRequest = { accountId?: string | null; requestId?: string };
type CheckoutContext = {
  account_id: string;
  plan_key: string;
  stripe_price_id: string;
  recurring_interval: "month";
  stripe_customer_id?: string | null;
};

const ACCEPTANCE_SCOPE = "map.nano.live.zero.recurring";
const ACCEPTANCE_BILLING_INTERVAL = "month";
const COUPON_LIST_LIMIT = 100;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function acceptanceUserIds(): Set<string> {
  return new Set(
    requiredEnv("BCC_BILLING_ACCEPTANCE_USER_IDS")
      .split(",")
      .map(value => value.trim().toLowerCase())
      .filter(Boolean)
  );
}

function couponMatches(coupon: Stripe.Coupon, productId: string, now: number): boolean {
  const eligibleProducts = coupon.applies_to?.products || [];
  return coupon.livemode
    && coupon.valid
    && coupon.percent_off === 100
    && coupon.duration === "forever"
    && coupon.max_redemptions === 1
    && coupon.times_redeemed === 0
    && typeof coupon.redeem_by === "number"
    && coupon.redeem_by > now
    && coupon.metadata.acceptance_scope === ACCEPTANCE_SCOPE
    && eligibleProducts.includes(productId);
}

async function acceptanceCoupon(
  stripe: Stripe,
  productId: string,
  requestId: string,
  now: number
): Promise<Stripe.Coupon> {
  const coupons = await stripe.coupons.list({ limit: COUPON_LIST_LIMIT });
  if (coupons.has_more) {
    throw new HttpError(409, "The live acceptance coupon catalog is ambiguous");
  }
  const eligibleCoupons = coupons.data.filter(coupon => couponMatches(coupon, productId, now));
  if (eligibleCoupons.length > 1) {
    throw new HttpError(409, "Multiple live acceptance coupons are active");
  }
  if (eligibleCoupons.length === 1) return eligibleCoupons[0];

  return stripe.coupons.create({
    id: `map_nano_live_acceptance_${requestId}`,
    name: "MAP-Nano Essential internal acceptance",
    percent_off: 100,
    duration: "forever",
    max_redemptions: 1,
    redeem_by: now + (48 * 60 * 60),
    applies_to: { products: [productId] },
    metadata: {
      acceptance_scope: ACCEPTANCE_SCOPE,
      purpose: "internal_live_acceptance",
      billing_interval: ACCEPTANCE_BILLING_INTERVAL,
      acceptance_request_id: requestId
    }
  }, { idempotencyKey: `map-live-acceptance-coupon-${requestId}` });
}

function integrationIdentifier(requestId: string): string {
  const suffix = requestId.replace(/-/g, "").slice(0, 8)
    .split("").map(value => String.fromCharCode(97 + Number.parseInt(value, 16))).join("");
  return `map_live_acceptance_${suffix}`;
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return optionsResponse(request);
  try {
    requirePost(request);
    assertAllowedOrigin(request);
    const input = await jsonBody<AcceptanceRequest>(request);
    const requestId = String(input.requestId || "").trim().toLowerCase();
    if (!UUID_V4.test(requestId)) throw new HttpError(400, "A UUIDv4 requestId is required");
    if (!isLiveMode()) throw new HttpError(409, "The acceptance checkout requires STRIPE_MODE=live");

    const admin = adminClient();
    const user = await authenticatedUser(request, admin);
    if (!acceptanceUserIds().has(user.id.toLowerCase())) {
      throw new HttpError(403, "This user is not authorized for live billing acceptance");
    }

    const { data, error } = await admin.rpc("get_map_checkout_context", {
      p_actor_id: user.id,
      p_account_id: input.accountId || null,
      p_plan_key: "essential",
      p_billing_interval: ACCEPTANCE_BILLING_INTERVAL,
      p_livemode: true
    });
    if (error) throw error;
    const context = data as CheckoutContext;
    if (context.plan_key !== "essential") throw new HttpError(409, "Acceptance plan mismatch");

    const stripe = stripeClient();
    const price = await stripe.prices.retrieve(context.stripe_price_id);
    const productId = expandableId(price.product);
    if (!price.livemode || !productId) throw new HttpError(409, "Acceptance Price is not a live Stripe product");
    const now = Math.floor(Date.now() / 1000);
    const coupon = await acceptanceCoupon(stripe, productId, requestId, now);

    let customerId = context.stripe_customer_id || null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        name: user.user_metadata?.full_name || user.user_metadata?.name || undefined,
        metadata: {
          map_account_id: context.account_id,
          created_by_user_id: user.id,
          billing_acceptance_test: "true"
        }
      }, { idempotencyKey: `map-customer-live-${context.account_id}` });
      customerId = customer.id;
      const { error: linkError } = await admin.rpc("link_map_billing_customer", {
        p_actor_id: user.id,
        p_account_id: context.account_id,
        p_stripe_customer_id: customer.id,
        p_email: user.email || null,
        p_livemode: true
      });
      if (linkError) throw linkError;
    }

    const metadata = {
      map_account_id: context.account_id,
      commercial_plan_key: "essential",
      billing_interval: context.recurring_interval,
      purchaser_user_id: user.id,
      billing_acceptance_test: "true",
      billing_acceptance_discount: "forever"
    };
    const baseUrl = siteUrl();
    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.create({
      mode: "subscription",
      integration_identifier: integrationIdentifier(requestId),
      customer: customerId,
      client_reference_id: context.account_id,
      line_items: [{ price: context.stripe_price_id, quantity: 1 }],
      discounts: [{ coupon: coupon.id }],
      payment_method_collection: "if_required",
      billing_address_collection: "auto",
      customer_update: { address: "auto", name: "auto" },
      expires_at: now + 60 * 60,
      success_url: `${baseUrl}/dashboard.html?module=licenses&billing=acceptance-success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/dashboard.html?module=licenses&billing=acceptance-cancelled`,
      metadata,
      subscription_data: { metadata }
      }, { idempotencyKey: `map-live-acceptance-${requestId}` });
    } catch (error) {
      const candidate = error as {
        code?: unknown;
        param?: unknown;
        message?: unknown;
      };
      const detail = [
        typeof candidate.code === "string" ? `code=${candidate.code}` : null,
        typeof candidate.param === "string" ? `param=${candidate.param}` : null,
        typeof candidate.message === "string" ? candidate.message : null
      ].filter(Boolean).join(" | ") || "unknown Stripe error";
      console.error("[map-live-acceptance] Checkout session creation failed", { detail });
      throw new HttpError(502, `Stripe Checkout rejected the acceptance session: ${detail}`);
    }

    if (!session.url) throw new Error("Stripe Checkout did not return a hosted URL");
    return jsonResponse(request, {
      url: session.url,
      sessionId: session.id,
      amountDue: 0,
      billingInterval: context.recurring_interval,
      discountDuration: coupon.duration
    });
  } catch (error) {
    return errorResponse(request, error);
  }
});
