import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = path => readFile(new URL(path, root), "utf8");

function positions(source, entries) {
  return entries.map(([label, needle, last = false]) => {
    const index = last ? source.lastIndexOf(needle) : source.indexOf(needle);
    assert.notEqual(index, -1, `${label} is missing`);
    return [label, index];
  });
}

function assertIncreasing(found) {
  for (let index = 1; index < found.length; index += 1) {
    assert.ok(found[index][1] > found[index - 1][1], `${found[index][0]} must follow ${found[index - 1][0]}`);
  }
}

test("billing trust boundaries separate authenticated user flows from signed Stripe webhooks", async () => {
  const [config, checkout, portal, acceptance, webhook] = await Promise.all([
    read("supabase/config.toml"),
    read("supabase/functions/create-map-checkout-session/index.ts"),
    read("supabase/functions/create-stripe-portal-session/index.ts"),
    read("supabase/functions/create-map-live-acceptance-session/index.ts"),
    read("supabase/functions/stripe-webhook/index.ts")
  ]);

  for (const functionName of ["create-map-checkout-session", "create-stripe-portal-session"]) {
    assert.match(config, new RegExp(`\\[functions\\.${functionName}\\][\\s\\S]*?verify_jwt = true`));
  }
  assert.match(config, /\[functions\.stripe-webhook\][\s\S]*?verify_jwt = false/);
  for (const source of [checkout, portal, acceptance]) {
    assert.match(source, /assertAllowedOrigin\(request\)/);
    assert.match(source, /authenticatedUser\(request, admin\)/);
  }
  assert.match(acceptance, /acceptanceUserIds\(\)\.has\(user\.id\.toLowerCase\(\)\)/);
  assert.doesNotMatch(webhook, /assertAllowedOrigin|authenticatedUser/);
  assert.match(webhook, /constructEventAsync\([\s\S]*await request\.text\(\)/);
});

test("Checkout derives price and ownership server-side before creating an idempotent subscription", async () => {
  const checkout = await read("supabase/functions/create-map-checkout-session/index.ts");
  assertIncreasing(positions(checkout, [
    ["authenticate actor", "authenticatedUser(request, admin)"],
    ["load allowlisted checkout context", 'admin.rpc("get_map_checkout_context"'],
    ["reserve one-time trial", 'admin.rpc("reserve_map_billing_trial"'],
    ["create Stripe session", "stripe.checkout.sessions.create"]
  ]));
  assert.match(checkout, /line_items: \[\{ price: context\.stripe_price_id, quantity: 1 \}\]/);
  assert.doesNotMatch(checkout, /input\.(?:price|priceId|stripePriceId)/);
  assert.match(checkout, /client_reference_id: context\.account_id/);
  assert.match(checkout, /metadata: billingMetadata,[\s\S]*subscription_data: subscriptionData/);
  assert.match(checkout, /idempotencyKey: `map-checkout-\$\{livemode \? "live" : "test"\}-\$\{requestId\}`/);
  assert.match(checkout, /allow_promotion_codes: false/);
  assert.doesNotMatch(checkout, /discounts:|payment_method_types/);
  assert.match(checkout, /automatic_tax: \{ enabled: automaticTaxEnabled\(\) \}/);
  assert.match(checkout, /subscriptionData\.trial_settings = \{ end_behavior: \{ missing_payment_method: "cancel" \} \}/);
});

test("reused Checkout sessions must match every ownership and commercial invariant", async () => {
  const checkout = await read("supabase/functions/create-map-checkout-session/index.ts");
  for (const predicate of [
    "previousSession.livemode === livemode",
    "previousSession.client_reference_id === context.account_id",
    "previousSession.metadata.map_account_id === context.account_id",
    "previousSession.metadata.purchaser_user_id === user.id",
    "previousSession.metadata.commercial_plan_key === context.plan_key",
    "previousSession.metadata.billing_interval === context.recurring_interval",
    "previousSession.metadata.map_trial_claim_id === trial.claim_id"
  ]) assert.ok(checkout.includes(predicate), predicate);
  assert.match(checkout, /previousSession\.status === "open"[\s\S]*expires_at[\s\S]*Date\.now\(\)[\s\S]*\+ 5/);
  assert.match(checkout, /sameCheckout && stillOpen && previousSession\.url/);
  assert.match(checkout, /previousSession\.status === "complete"/);
  assertIncreasing(positions(checkout, [
    ["expire mismatched open session", "checkout.sessions.expire(previousSession.id)"],
    ["release its reservation", 'admin.rpc("release_map_billing_trial_by_session"'],
    ["reserve replacement", "trial = await reserveTrial()", true]
  ]));
});

test("webhook processing claims the event, re-fetches current state, and completes projection in order", async () => {
  const webhook = await read("supabase/functions/stripe-webhook/index.ts");
  assertIncreasing(positions(webhook, [
    ["verify signature", "constructEventAsync"],
    ["claim idempotency record", 'admin.rpc("claim_stripe_webhook_event"'],
    ["retrieve current Stripe state", "subscriptions.retrieve(subscriptionId)"],
    ["project allowlisted snapshot", 'admin.rpc("sync_stripe_subscription_snapshot"'],
    ["mark final event state", 'admin.rpc("complete_stripe_webhook_event"', true]
  ]));
  assert.match(webhook, /if \(claim === "duplicate"\)/);
  assert.match(webhook, /if \(!HANDLED_EVENTS\.has\(event\.type\)\)/);
  assert.doesNotMatch(webhook, /event\.data\.object as Stripe\.Subscription/);
  assert.match(webhook, /p_status: "failed"/);
});

test("billing SQL enforces service-role projection, price allowlisting, and one active trial per principal", async () => {
  const [foundation, trial, priceProjection] = await Promise.all([
    read("supabase/migrations/20260809013000_stripe_billing_foundation.sql"),
    read("supabase/migrations/20260809213635_map_billing_monthly_prices_and_trial.sql"),
    read("supabase/migrations/20260809233000_sync_map_subscription_plan_from_price_catalog.sql")
  ]);
  for (const functionName of ["claim_stripe_webhook_event", "complete_stripe_webhook_event", "sync_stripe_subscription_snapshot"]) {
    assert.match(foundation, new RegExp(`function public\\.${functionName}[\\s\\S]*?security definer[\\s\\S]*?set search_path = public, pg_temp`, "i"));
    assert.match(foundation, new RegExp(`grant execute on function public\\.${functionName}[\\s\\S]*?to service_role`, "i"));
  }
  assert.match(foundation, /on conflict \(stripe_event_id\) do nothing/i);
  assert.match(foundation, /p_status not in \('processed', 'failed', 'ignored'\)/i);
  assert.match(priceProjection, /billing_price_catalog price[\s\S]*price\.stripe_price_id = p_snapshot->>'stripe_price_id'[\s\S]*price\.livemode = \(p_snapshot->>'livemode'\)::boolean/);
  assert.match(priceProjection, /plan\.product_key = 'map\.nano'/);
  for (const principal of ["account", "user"]) {
    for (const state of ["redeemed", "reserved"]) {
      assert.match(trial, new RegExp(`billing_trial_claims_${state}_${principal}_unique[\\s\\S]*?where state = '${state}'`, "i"));
    }
  }
  assert.match(trial, /trial_period_days between 1 and 90/i);
  assert.match(trial, /revoke all on table public\.billing_trial_claims from public, anon, authenticated/i);
});

test("browser-delivered assets contain no Stripe secret or webhook signing key", async () => {
  const secretPattern = /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{12,}\b|\bwhsec_[A-Za-z0-9]{12,}\b/;
  const queue = [new URL("js/", root)];
  const files = [];
  while (queue.length) {
    const directory = queue.pop();
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const url = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
      if (entry.isDirectory()) queue.push(url);
      else if (entry.name.endsWith(".js")) files.push(url);
    }
  }
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".html")) files.push(new URL(entry.name, root));
  }
  for (const file of files) assert.doesNotMatch(await readFile(file, "utf8"), secretPattern, file.pathname);
});
