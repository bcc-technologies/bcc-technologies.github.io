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
  stripe_customer_id?: string | null;
};

const ACCEPTANCE_SCOPE = "map.nano.live.zero";
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function acceptanceUserIds(): Set<string> {
  return new Set(
    requiredEnv("BCC_BILLING_ACCEPTANCE_USER_IDS")
      .split(",")
      .map(value => value.trim().toLowerCase())
      .filter(Boolean)
  );
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
      p_livemode: true
    });
    if (error) throw error;
    const context = data as CheckoutContext;
    if (context.plan_key !== "essential") throw new HttpError(409, "Acceptance plan mismatch");

    const stripe = stripeClient();
    const [coupon, price] = await Promise.all([
      stripe.coupons.retrieve(
        requiredEnv("STRIPE_LIVE_ACCEPTANCE_COUPON_ID"),
        { expand: ["applies_to"] }
      ),
      stripe.prices.retrieve(context.stripe_price_id)
    ]);
    const productId = expandableId(price.product);
    const eligibleProducts = coupon.applies_to?.products || [];
    const now = Math.floor(Date.now() / 1000);
    const couponMatches = coupon.livemode
      && price.livemode
      && coupon.valid
      && coupon.percent_off === 100
      && coupon.duration === "once"
      && coupon.max_redemptions === 1
      && coupon.times_redeemed === 0
      && typeof coupon.redeem_by === "number"
      && coupon.redeem_by > now
      && coupon.metadata.acceptance_scope === ACCEPTANCE_SCOPE
      && Boolean(productId)
      && eligibleProducts.includes(productId as string);
    if (!couponMatches) {
      throw new HttpError(409, "The live acceptance coupon is invalid, expired, consumed, or mismatched");
    }

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
      purchaser_user_id: user.id,
      billing_acceptance_test: "true"
    };
    const baseUrl = siteUrl();
    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.create({
      mode: "subscription",
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
    return jsonResponse(request, { url: session.url, sessionId: session.id, amountDue: 0 });
  } catch (error) {
    return errorResponse(request, error);
  }
});
