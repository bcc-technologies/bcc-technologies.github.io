import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("billing subscription foreign keys have explicit covering indexes", async () => {
  const sql = await readFile(
    new URL("../supabase/migrations/20260809130000_stripe_billing_foreign_key_indexes.sql", import.meta.url),
    "utf8"
  );

  for (const column of ["billing_customer_id", "plan_id", "product_key"]) {
    assert.match(sql, new RegExp(`create index if not exists billing_subscriptions_${column}_idx\\s+on public\\.billing_subscriptions \\(\\s*${column}\\s*\\)`, "i"));
  }
});
