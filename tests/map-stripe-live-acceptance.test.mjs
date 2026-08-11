import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("live zero-dollar acceptance is isolated from public Checkout and fail-closed", async () => {
  const [acceptance, checkout, clientConfig, repository] = await Promise.all([
    read("supabase/functions/create-map-live-acceptance-session/index.ts"),
    read("supabase/functions/create-map-checkout-session/index.ts"),
    read("js/supabase-config.js"),
    read("js/workspace/map-repository.js")
  ]);

  assert.match(acceptance, /requires STRIPE_MODE=live/);
  assert.match(acceptance, /BCC_BILLING_ACCEPTANCE_USER_IDS/);
  assert.match(acceptance, /p_plan_key: "essential"/);
  assert.match(acceptance, /p_billing_interval: ACCEPTANCE_BILLING_INTERVAL/);
  assert.match(acceptance, /stripe\.coupons\.list\(\{ limit: COUPON_LIST_LIMIT \}\)/);
  assert.match(acceptance, /eligibleCoupons\.length > 1/);
  assert.match(acceptance, /coupon\.percent_off === 100/);
  assert.match(acceptance, /coupon\.duration === "forever"/);
  assert.match(acceptance, /coupon\.max_redemptions === 1/);
  assert.match(acceptance, /coupon\.times_redeemed === 0/);
  assert.match(acceptance, /coupon\.metadata\.acceptance_scope === ACCEPTANCE_SCOPE/);
  assert.match(acceptance, /eligibleProducts\.includes/);
  assert.match(acceptance, /stripe\.coupons\.create/);
  assert.match(acceptance, /map_nano_accept_\$\{requestId\.replace\(\/\-\/g, ""\)\.slice\(0, 16\)\}/);
  assert.match(acceptance, /redeem_by: now \+ \(48 \* 60 \* 60\)/);
  assert.match(acceptance, /applies_to: \{ products: \[productId\] \}/);
  assert.match(acceptance, /map-live-acceptance-coupon-\$\{requestId\}/);
  assert.match(acceptance, /integration_identifier: integrationIdentifier\(requestId\)/);
  assert.match(acceptance, /discounts: \[\{ coupon: coupon\.id \}\]/);
  assert.match(acceptance, /payment_method_collection: "if_required"/);
  assert.doesNotMatch(acceptance, /allow_promotion_codes/);
  assert.match(acceptance, /billing_acceptance_test: "true"/);
  assert.match(acceptance, /billing_acceptance_discount: "forever"/);
  assert.doesNotMatch(acceptance, /STRIPE_LIVE_ACCEPTANCE_COUPON_ID/);
  assert.doesNotMatch(acceptance, /subscriptions\.cancel|cancel_at_period_end/);
  assert.match(acceptance, /map-live-acceptance-\$\{requestId\}/);
  assert.match(acceptance, /Checkout session creation failed/);
  assert.match(acceptance, /Stripe Checkout rejected the acceptance session/);

  assert.doesNotMatch(checkout, /ACCEPTANCE_SCOPE|create-map-live-acceptance-session/);
  assert.doesNotMatch(`${clientConfig}\n${repository}`, /create-map-live-acceptance-session/);
  assert.match(clientConfig, /checkoutEnabled: true/);
});
