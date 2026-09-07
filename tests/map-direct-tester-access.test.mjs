import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("direct tester evaluation licenses are explicitly permitted without widening generic evaluations", () => {
  const migration = read("supabase/migrations/20260826102306_allow_direct_tester_evaluation_licenses.sql");

  assert.match(migration, /drop constraint if exists platform_licenses_evaluation_source_check/);
  assert.match(migration, /source = 'evaluation'[\s\S]*evaluation_cohort_id is not null[\s\S]*or access_program_type = 'partner_test'/);
  assert.match(migration, /source <> 'evaluation'[\s\S]*evaluation_cohort_id is null/);
  assert.doesNotMatch(migration, /or evaluation_cohort_id is null/);
});

test("direct tester access has transactional positive, entitlement, retry, and negative coverage", () => {
  const sql = read("supabase/tests/direct_tester_access_test.sql");

  assert.match(sql, /private\.provision_tester_access\([\s\S]*?null,[\s\S]*?null,/);
  assert.match(sql, /license\.evaluation_cohort_id IS NULL/);
  assert.match(sql, /private\.get_current_platform_access\(\)/);
  assert.match(sql, /accepts an idempotent retry for direct tester access/);
  assert.match(sql, /rejects generic evaluation licenses without a cohort/);
});
