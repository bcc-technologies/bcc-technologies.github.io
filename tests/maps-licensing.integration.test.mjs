import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("staff dashboard wires the MAP licensing workspace behind canonical access", () => {
  const html = read("staff-dashboard.html");
  const navigation = read("js/workspace/navigation.js");
  const dashboard = read("js/staff-dashboard.js");
  const registry = read("js/workspace/feature-registry.js");

  assert.match(html, /data-maps-licensing-workspace/);
  assert.match(html, /id="maps-licensing" data-permission-required="platform\.licenses\.read"/);
  assert.doesNotMatch(html, /<script src="js\/workspace\/maps-licensing\.js"/);
  assert.match(registry, /"js\/workspace\/maps-licensing\.js"/);
  assert.match(navigation, /#maps-licensing/);
  assert.match(dashboard, /staffFeatureRegistry\.initializeView\("staff", viewId/);
});

test("MAP licensing UI uses authenticated Supabase RPCs without the suspended Render service", () => {
  const moduleSource = read("js/workspace/maps-licensing.js");
  const repository = read("js/workspace/map-repository.js");

  assert.match(repository, /get_my_platform_admin_dashboard/);
  assert.match(repository, /issue_my_platform_license/);
  assert.match(repository, /create_my_access_program_cohort/);
  assert.match(repository, /invite-map-evaluation-participant/);
  assert.doesNotMatch(moduleSource, /supabase\.rpc|loadSupabaseClient|map-nano\.onrender\.com|mapRequest\(|fetch\(/);
  assert.match(moduleSource, /role="tablist"/);
  assert.match(moduleSource, /aria-selected/);
  assert.match(moduleSource, /platform\.permissions\.manage/);
  assert.match(moduleSource, /platform\.analytics\.read/);
});

test("license issuance exposes the governed partner tester flow", () => {
  const moduleSource = read("js/workspace/maps-licensing.js");

  assert.match(moduleSource, /data-map-issue-access-kind/);
  assert.match(moduleSource, /<option value="partner_test"/);
  assert.match(moduleSource, /item\.program_type === "partner_test"/);
  assert.match(moduleSource, /repository\.provisionTesterAccess/);
  assert.match(moduleSource, /name="institutionId"/);
  assert.match(moduleSource, /Cohorte <small>\(opcional\)<\/small>/);
  assert.match(moduleSource, /Sin cohorte/);
  assert.match(moduleSource, /data-map-create-institution-from-issue/);
  assert.match(moduleSource, /data-map-create-cohort-from-issue/);
  assert.match(moduleSource, /data-map-tester-email/);
  assert.match(moduleSource, /institutionForDomain/);
  assert.match(moduleSource, /item\.verified_domains\.some/);
  assert.match(moduleSource, /testerInstitutionAutoSelected/);
  assert.match(moduleSource, /No encontramos una institución registrada para/);
  assert.match(moduleSource, /captureTesterDraft/);
  assert.match(moduleSource, /ui\.closeLayer\(issueDialog, "continue"\)/);
  assert.match(moduleSource, /dialog\.addEventListener\("close"/);
  assert.match(moduleSource, /setFormValue\(form, "programType", "partner_test"\)/);
  assert.match(moduleSource, /testerInstitutionId = String\(createdInstitutionId/);
  assert.match(moduleSource, /testerCohortId = String\(createdCohortId/);
  assert.match(moduleSource, /const commercialPlans = plans\.filter\(plan => !plan\.is_evaluation\)/);
  assert.match(moduleSource, /submit\.disabled = false/);
  assert.doesNotMatch(moduleSource, /missingTesterCohort/);
  assert.ok(moduleSource.indexOf("Cuenta del usuario") < moduleSource.indexOf("Institución<select"));
});

test("browser platform administration wrappers bind identity to auth.uid", () => {
  const sql = read("supabase/migrations/20260726030445_browser_platform_admin_rpc.sql");

  assert.match(sql, /actor_id uuid := \(select auth\.uid\(\)\)/i);
  assert.doesNotMatch(sql, /p_actor_id/);
  assert.match(sql, /revoke all on function public\.get_my_platform_admin_dashboard[\s\S]*from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.get_my_platform_admin_dashboard[\s\S]*to authenticated, service_role/i);
  assert.match(sql, /private\.get_platform_admin_overview/);
});

test("assignable MAP staff roles expose least-privilege local fallbacks", () => {
  const access = JSON.parse(read("shared/access-contracts.json"));

  assert.deepEqual(access.staffRoles.maps_license_manager.permissions, ["platform.licenses.read", "platform.licenses.manage", "platform.evaluations.manage", "platform.analytics.read"]);
  assert.deepEqual(access.staffRoles.maps_product_analyst.permissions, ["platform.licenses.read", "platform.analytics.read"]);
  assert.ok(access.staffRoles.maps_developer.permissions.includes("map.dev.access"));
});
