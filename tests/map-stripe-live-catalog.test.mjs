import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("live Stripe Price IDs are registered only through the guarded catalog migration", async () => {
  const sql = await read("supabase/migrations/20260809024500_map_nano_live_price_catalog.sql");

  assert.match(sql, /matching_plan_count <> 2/);
  assert.match(sql, /'essential',[\s\S]{0,160}'price_1U2MPQ61z0I4dYgK2XuYLB8N',[\s\S]{0,120}120000::bigint/);
  assert.match(sql, /'professional',[\s\S]{0,160}'price_1U2MQ961z0I4dYgKjWKx8ZXl',[\s\S]{0,120}300000::bigint/);
  assert.match(sql, /on conflict \(plan_id, livemode\) do update/);
  assert.match(sql, /matching_catalog_count <> 2/);
  assert.doesNotMatch(sql, /prod_[A-Za-z0-9]+/);
});

test("monthly and annual live Prices have one guarded 14-day trial catalog", async () => {
  const sql = await read("supabase/migrations/20260809213635_map_billing_monthly_prices_and_trial.sql");

  assert.match(sql, /billing_price_catalog_plan_mode_interval_unique/);
  assert.match(sql, /trial_period_days smallint not null default 14/);
  assert.match(sql, /'price_1U2eO361z0I4dYgKCrV0KcHo'[\s\S]{0,120}12000::bigint/);
  assert.match(sql, /'price_1U2eOC61z0I4dYgKxmosZL0C'[\s\S]{0,120}30000::bigint/);
  assert.match(sql, /'price_1U2MPQ61z0I4dYgK2XuYLB8N'[\s\S]{0,160}120000/);
  assert.match(sql, /'price_1U2MQ961z0I4dYgKjWKx8ZXl'[\s\S]{0,160}300000/);
  assert.match(sql, /create table if not exists public\.billing_trial_claims/);
  assert.match(sql, /reserve_map_billing_trial/);
  assert.match(sql, /redeem_map_billing_trial/);
  assert.match(sql, /release_map_billing_trial_by_session/);
  assert.match(sql, /matching_catalog_count <> 4/);
});
