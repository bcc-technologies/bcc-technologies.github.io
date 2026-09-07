import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = name => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");

function normalizeSql(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--.*$/gm, " ")
    .replace(/;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const mirrorPairs = [
  ["20260809013000_stripe_billing_foundation.sql", "20260809172210_stripe_billing_foundation.sql"],
  ["20260809130000_stripe_billing_foreign_key_indexes.sql", "20260809172438_stripe_billing_foreign_key_indexes.sql"],
  ["20260809213635_map_billing_monthly_prices_and_trial.sql", "20260809215412_map_billing_monthly_prices_and_trial.sql"],
  ["20260809221338_reuse_pending_map_checkout_session.sql", "20260809221639_reuse_pending_map_checkout_session.sql"],
  ["20260809221737_index_billing_trial_claims_product_key.sql", "20260809221802_index_billing_trial_claims_product_key.sql"]
];

test("historical mirrored billing migrations cannot drift semantically", async t => {
  for (const [first, second] of mirrorPairs) {
    await t.test(`${first} mirrors ${second}`, async () => {
      const [left, right] = await Promise.all([migration(first), migration(second)]);
      assert.equal(normalizeSql(left), normalizeSql(right));
    });
  }
});
