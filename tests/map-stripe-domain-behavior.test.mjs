import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { loadTypeScriptFunctions } from "./helpers/load-typescript-functions.mjs";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const expandableId = value => {
  if (typeof value === "string") return value;
  return value && typeof value === "object" && typeof value.id === "string" ? value.id : null;
};

test("webhook event routing supports current and legacy Stripe subscription references", async () => {
  const source = await read("supabase/functions/stripe-webhook/index.ts");
  const { subscriptionIdForEvent } = loadTypeScriptFunctions(
    source,
    ["subscriptionIdForEvent"],
    { expandableId }
  );

  const cases = [
    ["subscription event", { type: "customer.subscription.updated", data: { object: { id: "sub_direct" } } }, "sub_direct"],
    ["Checkout string", { type: "checkout.session.completed", data: { object: { subscription: "sub_checkout" } } }, "sub_checkout"],
    ["Checkout expanded", { type: "checkout.session.completed", data: { object: { subscription: { id: "sub_expanded" } } } }, "sub_expanded"],
    ["legacy invoice", { type: "invoice.paid", data: { object: { subscription: "sub_legacy" } } }, "sub_legacy"],
    ["Basil invoice parent", { type: "invoice.payment_failed", data: { object: { parent: { subscription_details: { subscription: { id: "sub_parent" } } } } } }, "sub_parent"],
    ["unrelated event", { type: "checkout.session.expired", data: { object: { subscription: "sub_ignored" } } }, null],
    ["missing reference", { type: "invoice.paid", data: { object: {} } }, null]
  ];

  for (const [label, event, expected] of cases) {
    assert.equal(subscriptionIdForEvent(event), expected, label);
  }
});

test("webhook snapshots normalize expanded IDs, timestamps, trial state, and item period fallback", async () => {
  const source = await read("supabase/functions/stripe-webhook/index.ts");
  const { subscriptionSnapshot } = loadTypeScriptFunctions(
    source,
    ["isoFromEpoch", "subscriptionSnapshot"],
    { expandableId }
  );
  const base = {
    id: "sub_123",
    customer: { id: "cus_123" },
    status: "trialing",
    items: { data: [{ price: { id: "price_monthly" }, current_period_start: 100, current_period_end: 200 }] },
    trial_start: 110,
    trial_end: 190,
    cancel_at_period_end: true,
    canceled_at: null,
    latest_invoice: { id: "in_123" },
    metadata: {
      map_trial_claim_id: "claim_123",
      map_account_id: "account_123",
      commercial_plan_key: "essential",
      purchaser_user_id: "user_123"
    }
  };

  const fallback = subscriptionSnapshot(base, true);
  assert.deepEqual(fallback, {
    stripe_subscription_id: "sub_123",
    stripe_customer_id: "cus_123",
    stripe_price_id: "price_monthly",
    status: "trialing",
    current_period_start: new Date(100_000).toISOString(),
    current_period_end: new Date(200_000).toISOString(),
    trial_start: new Date(110_000).toISOString(),
    trial_end: new Date(190_000).toISOString(),
    trial_claim_id: "claim_123",
    cancel_at_period_end: true,
    canceled_at: null,
    latest_invoice_id: "in_123",
    livemode: true,
    account_id: "account_123",
    commercial_plan_key: "essential",
    purchaser_user_id: "user_123",
    customer_email: null
  });

  const topLevel = subscriptionSnapshot({
    ...base,
    current_period_start: 300,
    current_period_end: 400
  }, false);
  assert.equal(topLevel.current_period_start, new Date(300_000).toISOString());
  assert.equal(topLevel.current_period_end, new Date(400_000).toISOString());
  assert.equal(topLevel.livemode, false);
});

test("webhook errors retain useful Supabase diagnostics without exposing arbitrary objects", async () => {
  const source = await read("supabase/functions/stripe-webhook/index.ts");
  const { errorMessage } = loadTypeScriptFunctions(source, ["errorMessage"]);

  assert.equal(errorMessage(new Error("network timeout")), "network timeout");
  assert.equal(
    errorMessage({ message: "duplicate key", code: "23505", details: "account", hint: "retry" }),
    "duplicate key | 23505 | account | retry"
  );
  assert.equal(errorMessage({ reason: "plain" }), '{"reason":"plain"}');
  const circular = {};
  circular.self = circular;
  assert.equal(errorMessage(circular), "Unknown webhook processing error");
});

test("live acceptance coupons fail closed when any zero-dollar invariant changes", async () => {
  const source = await read("supabase/functions/create-map-live-acceptance-session/index.ts");
  const { couponMatches } = loadTypeScriptFunctions(source, ["couponMatches"], {
    ACCEPTANCE_SCOPE: "map.nano.live.zero.recurring"
  });
  const now = 1_700_000_000;
  const productId = "prod_maps";
  const validCoupon = {
    livemode: true,
    valid: true,
    percent_off: 100,
    duration: "forever",
    max_redemptions: 1,
    times_redeemed: 0,
    redeem_by: now + 60,
    metadata: { acceptance_scope: "map.nano.live.zero.recurring" },
    applies_to: { products: [productId] }
  };
  assert.equal(couponMatches(validCoupon, productId, now), true);

  const mutations = [
    ["livemode", false],
    ["valid", false],
    ["percent_off", 99],
    ["duration", "once"],
    ["max_redemptions", 2],
    ["times_redeemed", 1],
    ["redeem_by", now]
  ];
  for (const [field, value] of mutations) {
    assert.equal(couponMatches({ ...validCoupon, [field]: value }, productId, now), false, field);
  }
  assert.equal(couponMatches({ ...validCoupon, metadata: { acceptance_scope: "wrong" } }, productId, now), false);
  assert.equal(couponMatches({ ...validCoupon, applies_to: { products: ["prod_other"] } }, productId, now), false);
});

test("Stripe integration identifiers are deterministic and use the required eight-letter suffix", async () => {
  const source = await read("supabase/functions/create-map-live-acceptance-session/index.ts");
  const { integrationIdentifier } = loadTypeScriptFunctions(source, ["integrationIdentifier"]);

  const identifier = integrationIdentifier("123e4567-e89b-42d3-a456-426614174000");
  assert.equal(identifier, "map_live_acceptance_bcdoefgh");
  assert.match(identifier, /^map_live_acceptance_[a-p]{8}$/);
  assert.equal(integrationIdentifier("123e4567-e89b-42d3-a456-426614174000"), identifier);
  assert.notEqual(integrationIdentifier("223e4567-e89b-42d3-a456-426614174000"), identifier);
});
