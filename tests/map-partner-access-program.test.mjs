import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("partner access programs are explicit, accountable, and reviewable", () => {
  const sql = read("supabase/migrations/20260825112036_partner_access_programs_and_invitations.sql");

  assert.match(sql, /program_type in \('standard_evaluation', 'partner_test', 'complimentary_pilot'\)/);
  assert.match(sql, /program_type = 'standard_evaluation'[\s\S]*char_length\(btrim\(grant_reason\)\) >= 10/);
  assert.match(sql, /sponsored_by uuid references auth\.users\(id\) on delete set null/);
  assert.match(sql, /approved_by uuid references auth\.users\(id\) on delete set null/);
  assert.match(sql, /review_at timestamptz/);
  assert.match(sql, /max_renewals between 0 and 12/);
  assert.match(sql, /evaluation_cohorts_review_queue_lookup/);
  assert.match(sql, /private\.create_access_program_cohort/);
  assert.match(sql, /actor_id uuid := \(select auth\.uid\(\)\)/);
  assert.match(sql, /private\.require_license_manager\(p_actor_id\)/);
  assert.match(sql, /revoke all on function public\.create_my_access_program_cohort[\s\S]*from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.create_my_access_program_cohort[\s\S]*to authenticated, service_role/i);
});

test("evaluation invitations keep service-role authority inside an authenticated Edge Function", () => {
  const source = read("supabase/functions/invite-map-evaluation-participant/index.ts");
  const migration = read("supabase/migrations/20260825112036_partner_access_programs_and_invitations.sql");
  const config = read("supabase/config.toml");
  const repository = read("js/workspace/map-repository.js");

  assert.match(source, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(source, /admin\.auth\.getUser\(token\)/);
  assert.match(source, /admin\.auth\.admin\.inviteUserByEmail/);
  assert.match(source, /get_evaluation_invite_context/);
  assert.match(source, /provision_evaluation_access/);
  assert.match(source, /p_actor_id: actor\.id/);
  assert.match(source, /invitationSent \|\| !context\.has_signed_in \? "invited" : "active"/);
  assert.match(source, /assertAllowedOrigin\(request\)/);
  assert.doesNotMatch(repository, /SUPABASE_SERVICE_ROLE_KEY|service[_-]?role/i);
  assert.match(repository, /invokeFunction\("invite-map-evaluation-participant"/);
  assert.match(config, /\[functions\.invite-map-evaluation-participant\][\s\S]*verify_jwt = true/);

  assert.match(migration, /create or replace function public\.get_evaluation_invite_context/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /revoke all on function public\.get_evaluation_invite_context[\s\S]*from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.get_evaluation_invite_context[\s\S]*to service_role/i);
});

test("staff UI captures and exposes partner grant governance", () => {
  const source = read("js/workspace/maps-licensing.js");
  const repository = read("js/workspace/map-repository.js");
  const styles = read("css/workspace/features/maps-licensing.css");

  assert.match(repository, /create_my_access_program_cohort/);
  for (const parameter of ["p_program_type", "p_grant_reason", "p_review_at", "p_max_renewals"]) {
    assert.match(repository, new RegExp(parameter));
  }
  assert.match(source, /standard_evaluation/);
  assert.match(source, /partner_test/);
  assert.match(source, /complimentary_pilot/);
  assert.match(source, /name="programType"/);
  assert.match(source, /name="grantReason"[^>]*minlength="10"/);
  assert.match(source, /name="reviewAt"/);
  assert.match(source, /name="maxRenewals"/);
  assert.match(source, /name="fullName"/);
  assert.match(source, /maps-license-program-summary/);
  assert.match(source, /invitation\.invitationSent/);
  assert.match(styles, /\.maps-license-program-summary/);
  assert.match(repository, /activate_my_evaluation_memberships/);
  assert.match(repository, /await activateEvaluationMemberships\(\)/);
});

test("browser dashboard receives rich program metadata without widening table access", () => {
  const sql = read("supabase/migrations/20260825112036_partner_access_programs_and_invitations.sql");

  assert.match(sql, /private\.get_access_program_cohorts/);
  assert.match(sql, /'program_type', cohort\.program_type/);
  assert.match(sql, /'sponsor_name'/);
  assert.match(sql, /'approver_name'/);
  assert.match(sql, /'cohorts',[\s\S]*private\.get_access_program_cohorts\(actor_id\)/);
  assert.doesNotMatch(sql, /grant (?:select|insert|update|delete)[\s\S]*evaluation_cohorts[\s\S]*authenticated/i);
});
