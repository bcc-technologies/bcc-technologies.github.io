import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Stripe billing tables are service-role only and webhook processing is idempotent", async () => {
  const sql = await read("supabase/migrations/20260809013000_stripe_billing_foundation.sql");

  for (const table of ["billing_price_catalog", "billing_customers", "billing_subscriptions", "stripe_webhook_events"]) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
    assert.match(sql, new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`, "i"));
  }
  assert.match(sql, /claim_stripe_webhook_event/);
  assert.match(sql, /on conflict \(stripe_event_id\) do nothing/);
  assert.match(sql, /where stripe_event_id = p_event->>'id' and status = 'failed'/);
  assert.match(sql, /sync_stripe_subscription_snapshot/);
  assert.match(sql, /external_reference = 'stripe:' \|\|/);
  assert.match(sql, /grant execute on function public\.get_my_map_billing_dashboard\(\) to authenticated, service_role/i);
});

test("Stripe subscription sync assigns the purchaser without a PL/pgSQL name collision", async () => {
  const sql = await read("supabase/migrations/20260809183259_fix_stripe_subscription_snapshot_license_assignment.sql");

  assert.match(sql, /target_license_id uuid/);
  assert.match(sql, /values \(target_license_id, purchaser_user_id, purchaser_user_id\)/);
  assert.doesNotMatch(sql, /values \(license_id, purchaser_user_id, purchaser_user_id\)/);
  assert.match(sql, /grant execute on function public\.sync_stripe_subscription_snapshot\(jsonb\) to service_role/);
});

test("commercial plans are separated from license types and only two plans are self-service", async () => {
  const sql = await read("supabase/migrations/20260809013000_stripe_billing_foundation.sql");

  assert.match(sql, /add column if not exists commercial_key text/);
  assert.match(sql, /license_plans_commercial_key_unique/);
  assert.match(sql, /commercial_key = 'essential',[\s\S]{0,120}billing_model = 'subscription',[\s\S]{0,120}self_serve_enabled = true/);
  assert.match(sql, /'professional',\s*'subscription',\s*'year',\s*true/);
  assert.match(sql, /commercial_key = 'facility',[\s\S]{0,120}billing_model = 'quote',[\s\S]{0,120}self_serve_enabled = false/);
  assert.match(sql, /'institutional',\s*'quote',\s*'custom',\s*false/);
  assert.doesNotMatch(sql, /price_[A-Za-z0-9]{12,}/);
});

test("Checkout and Portal require an authenticated actor and keep Stripe secrets server-side", async () => {
  const [shared, checkout, portal, repository, clientConfig] = await Promise.all([
    read("supabase/functions/_shared/map-billing.ts"),
    read("supabase/functions/create-map-checkout-session/index.ts"),
    read("supabase/functions/create-stripe-portal-session/index.ts"),
    read("js/workspace/map-repository.js"),
    read("js/supabase-config.js")
  ]);

  assert.match(shared, /admin\.auth\.getUser\(token\)/);
  assert.match(shared, /STRIPE_MODE must be test or live/);
  assert.match(shared, /STRIPE_SECRET_KEY does not match STRIPE_MODE/);
  assert.match(checkout, /get_map_checkout_context/);
  assert.match(checkout, /mode: "subscription"/);
  assert.match(checkout, /subscription_data/);
  assert.match(checkout, /trial_period_days/);
  assert.match(checkout, /payment_method_collection: "always"/);
  assert.match(checkout, /billingInterval/);
  assert.match(checkout, /reserve_map_billing_trial/);
  assert.match(checkout, /idempotencyKey/);
  assert.match(portal, /get_map_portal_context/);
  assert.match(repository, /supabase\.functions\.invoke/);
  assert.doesNotMatch(`${repository}\n${clientConfig}`, /sk_(?:test|live)_/);
  assert.match(clientConfig, /checkoutEnabled: true/);
  assert.match(clientConfig, /portalEnabled: false/);
});

test("Stripe webhook verifies the raw signed body and drives license state from subscriptions", async () => {
  const [webhook, config] = await Promise.all([
    read("supabase/functions/stripe-webhook/index.ts"),
    read("supabase/config.toml")
  ]);

  assert.match(webhook, /constructEventAsync\([\s\S]*await request\.text\(\)[\s\S]*STRIPE_WEBHOOK_SECRET/);
  assert.match(webhook, /Stripe\.createSubtleCryptoProvider\(\)/);
  assert.match(webhook, /customer\.subscription\.created/);
  assert.match(webhook, /customer\.subscription\.trial_will_end/);
  assert.match(webhook, /checkout\.session\.expired/);
  assert.match(webhook, /release_map_billing_trial_by_session/);
  assert.match(webhook, /redeem_map_billing_trial/);
  assert.match(webhook, /invoice\.payment_failed/);
  assert.match(webhook, /sync_stripe_subscription_snapshot/);
  assert.match(webhook, /complete_stripe_webhook_event/);
  assert.match(webhook, /subscriptions\.retrieve\(subscriptionId\)/);
  assert.doesNotMatch(webhook, /event\.data\.object as Stripe\.Subscription/);
  assert.match(webhook, /candidate\.details/);
  assert.match(config, /\[functions\.stripe-webhook\][\s\S]*verify_jwt = false/);
  assert.match(config, /\[functions\.create-map-checkout-session\][\s\S]*verify_jwt = true/);
});


test("returning from Checkout reuses the exact open trial session without weakening duplicate guards", async () => {
  const [checkout, sql] = await Promise.all([
    read("supabase/functions/create-map-checkout-session/index.ts"),
    read("supabase/migrations/20260809221338_reuse_pending_map_checkout_session.sql")
  ]);

  assert.match(sql, /account_id = p_account_id[\s\S]{0,80}user_id = p_actor_id/);
  assert.match(sql, /'reused', true/);
  assert.match(sql, /'stripe_checkout_session_id', existing_claim\.stripe_checkout_session_id/);
  assert.match(sql, /already pending for this account or user/);
  assert.match(sql, /revoke all on function public\.reserve_map_billing_trial/);
  assert.match(sql, /grant execute on function public\.reserve_map_billing_trial[\s\S]*service_role/);

  assert.match(checkout, /if \(trial\.reused\)/);
  assert.match(checkout, /checkout\.sessions\.retrieve\(trial\.stripe_checkout_session_id\)/);
  assert.match(checkout, /previousSession\.metadata\.map_trial_claim_id === trial\.claim_id/);
  assert.match(checkout, /previousSession\.status === "complete"/);
  assert.match(checkout, /checkout\.sessions\.expire\(previousSession\.id\)/);
  assert.match(checkout, /release_map_billing_trial_by_session/);
  assert.match(checkout, /reused: true/);
});
