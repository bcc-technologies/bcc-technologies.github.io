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
  const institutionalMigration = read("supabase/migrations/20260825131205_institutional_tester_access.sql");
  const cohortConflictFix = read("supabase/migrations/20260825162030_fix_tester_cohort_conflict_ambiguity.sql");
  const cohortAccountFix = read("supabase/migrations/20260825164504_fix_tester_cohort_license_account.sql");
  const config = read("supabase/config.toml");
  const repository = read("js/workspace/map-repository.js");

  assert.match(source, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(source, /admin\.auth\.getUser\(token\)/);
  assert.match(source, /admin\.auth\.admin\.inviteUserByEmail/);
  assert.match(source, /get_tester_invite_context/);
  assert.match(source, /provision_tester_access/);
  assert.match(source, /p_actor_id: actor\.id/);
  assert.match(source, /invitationSent \|\| !context\.has_signed_in \? "invited" : "active"/);
  assert.match(source, /assertAllowedOrigin\(request\)/);
  assert.doesNotMatch(repository, /SUPABASE_SERVICE_ROLE_KEY|service[_-]?role/i);
  assert.match(repository, /invokeFunction\("invite-map-evaluation-participant"/);
  assert.match(repository, /response\.clone\(\)\.json\(\)/);
  assert.match(repository, /payload\?\.error \|\| payload\?\.message/);
  assert.match(cohortConflictFix, /on conflict on constraint evaluation_cohort_members_cohort_id_user_id_key do update/);
  assert.doesNotMatch(cohortConflictFix, /on conflict \(cohort_id, user_id\) do update/);
  assert.match(cohortAccountFix, /join public\.evaluation_cohort_members member/);
  assert.match(cohortAccountFix, /member\.user_id = account\.individual_owner_id/);
  assert.match(cohortAccountFix, /new\.institution_id is distinct from cohort_row\.account_id/);
  assert.doesNotMatch(cohortAccountFix, /account_id[\s\S]*case when p_cohort_id/);
  assert.match(config, /\[functions\.invite-map-evaluation-participant\][\s\S]*verify_jwt = true/);

  assert.match(institutionalMigration, /create or replace function public\.get_tester_invite_context/);
  assert.match(institutionalMigration, /security invoker/);
  assert.match(institutionalMigration, /revoke all on function public\.get_tester_invite_context[\s\S]*from public, anon, authenticated/i);
  assert.match(institutionalMigration, /grant execute on function public\.get_tester_invite_context[\s\S]*to service_role/i);
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
  assert.match(source, /name="institutionId"/);
  assert.match(source, /Cohorte <small>\(opcional\)<\/small>/);
  assert.match(source, /repository\.provisionTesterAccess/);
  assert.match(source, /data-map-create-institution-from-issue/);
  assert.match(source, /data-map-create-cohort-from-issue/);
  assert.match(source, /data-map-tester-email/);
  assert.match(source, /institutionForDomain/);
  assert.match(source, /Institución sugerida por el dominio/);
  assert.match(source, /No encontramos una institución registrada para/);
  assert.doesNotMatch(source, /Primero crea una cohorte tester/);
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

test("institutional tester access belongs to the individual account and keeps cohorts optional", () => {
  const sql = read("supabase/migrations/20260825131205_institutional_tester_access.sql");
  const source = read("supabase/functions/invite-map-evaluation-participant/index.ts");
  const contracts = read("js/workspace/map-contracts.js");
  const repository = read("js/workspace/map-repository.js");

  assert.match(sql, /create table public\.institution_domains/);
  assert.match(sql, /alter table public\.institution_domains enable row level security/);
  assert.match(sql, /revoke all on table public\.institution_domains from public, anon, authenticated/);
  assert.match(sql, /create or replace function public\.create_my_institution/);
  assert.match(sql, /private\.ensure_individual_license_account_for_user/);
  assert.match(sql, /individual_account_id, evaluation_plan\.id, 'active', 'evaluation'/);
  assert.match(sql, /issued_by, evaluation_cohort_id, institution_id/);
  assert.match(sql, /p_cohort_id, effective_institution_id, p_user_id, existing_license_id/);
  assert.match(sql, /existing_is_tester/);
  assert.match(sql, /'tester_access', true/);
  assert.match(sql, /alter column cohort_id drop not null/);
  assert.match(sql, /'institutions', private\.list_platform_institutions\(actor_id\)/);
  assert.match(source, /institutionId\?: string \| null/);
  assert.match(source, /cohortId\?: string \| null/);
  assert.match(source, /if \(!cohortId\)/);
  assert.doesNotMatch(source, /A valid cohortId is required/);
  assert.match(contracts, /"institutions"/);
  assert.match(repository, /create_my_institution/);
  assert.match(repository, /provisionTesterAccess/);
});
test("tester provisioning is covered transactionally and failures are correlatable", () => {
  const databaseTest = read("supabase/tests/provision_tester_access_test.sql");
  const source = read("supabase/functions/invite-map-evaluation-participant/index.ts");
  const repository = read("js/workspace/map-repository.js");
  const contracts = read("js/workspace/map-contracts.js");

  assert.match(databaseTest, /^BEGIN;/);
  assert.match(databaseTest, /CREATE EXTENSION IF NOT EXISTS pgtap/);
  assert.match(databaseTest, /private\.provision_tester_access/g);
  assert.match(databaseTest, /explicit individual expiry/);
  assert.match(databaseTest, /inherits the cohort expiry/);
  assert.match(databaseTest, /idempotent retry/);
  assert.match(databaseTest, /ROLLBACK;/);

  assert.match(source, /crypto\.randomUUID\(\)/);
  assert.match(source, /"X-Operation-Id"/);
  assert.match(source, /diagnosticId: operationId/);
  assert.match(source, /logDiagnostic\(operationId, stage/);
  assert.match(source, /\[redacted-email\]/);
  assert.doesNotMatch(source, /console\.error\("\[map-evaluation-invite\]", error\)/);
  assert.match(repository, /payload\?\.diagnosticId/);
  assert.match(repository, /response\.headers\?\.get\?\.\("X-Operation-Id"\)/);
  assert.match(contracts, /Referencia: \$\{diagnosticId\}/);
  assert.match(contracts, /this\.diagnosticId/);
});
