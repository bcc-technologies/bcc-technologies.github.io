import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("staff dashboard wires the MAP licensing workspace behind canonical access", () => {
  const html = read("staff-dashboard.html");
  const navigation = read("js/workspace/navigation.js");
  const dashboard = read("js/staff-dashboard.js");

  assert.match(html, /data-maps-licensing-workspace/);
  assert.match(html, /id="maps-licensing" data-permission-required="platform\.licenses\.read"/);
  assert.doesNotMatch(html, /<script src="js\/workspace\/maps-licensing\.js"/);
  assert.match(dashboard, /"js\/workspace\/maps-licensing\.js"/);
  assert.match(navigation, /#maps-licensing/);
  assert.match(dashboard, /"maps-licensing": "maps-licensing"/);
});

test("MAP licensing UI uses authenticated Supabase RPCs without the suspended Render service", () => {
  const moduleSource = read("js/workspace/maps-licensing.js");

  assert.match(moduleSource, /get_my_platform_admin_dashboard/);
  assert.match(moduleSource, /issue_my_platform_license/);
  assert.match(moduleSource, /provision_my_evaluation_participant/);
  assert.doesNotMatch(moduleSource, /map-nano\.onrender\.com|mapRequest\(|fetch\(/);
  assert.match(moduleSource, /platform\.permissions\.manage/);
  assert.match(moduleSource, /platform\.analytics\.read/);
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
  const auth = read("js/auth.js");

  assert.match(auth, /maps_license_manager:\s*\["platform\.licenses\.read", "platform\.licenses\.manage", "platform\.evaluations\.manage", "platform\.analytics\.read"\]/);
  assert.match(auth, /maps_product_analyst:\s*\["platform\.licenses\.read", "platform\.analytics\.read"\]/);
  assert.match(auth, /maps_developer:\s*\["map\.dev\.access"/);
});
