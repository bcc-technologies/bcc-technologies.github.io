import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const migrationPath = "supabase/migrations/20260826102820_reclaim_stale_stripe_webhook_events.sql";

test("webhook claims use one atomic update to recover failed or abandoned processing rows", async () => {
  const sql = await read(migrationPath);

  assert.match(sql, /create or replace function public\.claim_stripe_webhook_event\(p_event jsonb\)/i);
  assert.match(sql, /on conflict \(stripe_event_id\) do nothing[\s\S]*returning stripe_event_id into claimed_id/i);
  assert.match(sql, /update public\.stripe_webhook_events[\s\S]*where stripe_event_id = p_event->>'id'[\s\S]*returning stripe_event_id into claimed_id/i);
  assert.doesNotMatch(sql, /select[\s\S]{0,120}from public\.stripe_webhook_events[\s\S]{0,80}for update/i);

  const retryPredicate = sql.match(/where stripe_event_id = p_event->>'id'([\s\S]*?)returning stripe_event_id into claimed_id/i)?.[1] || "";
  assert.match(retryPredicate, /status = 'failed'/i);
  assert.match(retryPredicate, /status = 'processing'/i);
  assert.match(retryPredicate, /updated_at < now\(\) - interval '10 minutes'/i);
  assert.doesNotMatch(retryPredicate, /status = '(?:processed|ignored)'/i);
});

test("reclaiming a webhook renews its lease and preserves retry diagnostics", async () => {
  const sql = await read(migrationPath);

  assert.match(sql, /set status = 'processing'/i);
  assert.match(sql, /attempts = attempts \+ 1/i);
  assert.match(sql, /last_error = null/i);
  assert.match(sql, /processed_at = null/i);
  assert.match(sql, /updated_at = now\(\)/i);
  assert.match(sql, /return case when claimed_id is null then 'duplicate' else 'claimed' end/i);
});

test("webhook claim input and execution privileges remain fail-closed", async () => {
  const sql = await read(migrationPath);

  assert.match(sql, /jsonb_typeof\(p_event\) <> 'object'/i);
  assert.match(sql, /coalesce\(p_event->>'id', ''\) !~ '\^evt_\[A-Za-z0-9\]\+\$'/i);
  assert.match(sql, /security definer[\s\S]*set search_path = public, pg_temp/i);
  assert.match(sql, /revoke all on function public\.claim_stripe_webhook_event\(jsonb\) from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.claim_stripe_webhook_event\(jsonb\) to service_role/i);
});

test("a reclaimed event can safely replay the current subscription projection and trial redemption", async () => {
  const [webhook, trialSql] = await Promise.all([
    read("supabase/functions/stripe-webhook/index.ts"),
    read("supabase/migrations/20260809213635_map_billing_monthly_prices_and_trial.sql")
  ]);

  assert.match(webhook, /subscriptions\.retrieve\(subscriptionId\)/);
  assert.match(webhook, /sync_stripe_subscription_snapshot/);
  assert.match(trialSql, /existing_claim\.state = 'redeemed'[\s\S]*existing_claim\.stripe_subscription_id = p_stripe_subscription_id[\s\S]*then return/i);
});

test("active and terminal duplicate events still receive a successful webhook response", async () => {
  const webhook = await read("supabase/functions/stripe-webhook/index.ts");

  assert.match(webhook, /if \(claim === "duplicate"\) return response\(\{ received: true, duplicate: true \}\)/);
  assert.doesNotMatch(webhook, /if \(claim === "duplicate"\)[\s\S]{0,120}status:\s*5\d\d/);
});
