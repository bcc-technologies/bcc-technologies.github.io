import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("client dashboard exposes the MAP license self-service view", async () => {
  const [html, navigation, dashboard, registry] = await Promise.all([
    read("dashboard.html"),
    read("js/workspace/navigation.js"),
    read("js/dashboard.js"),
    read("js/workspace/feature-registry.js")
  ]);

  assert.match(html, /data-client-map-licenses/);
  assert.doesNotMatch(html, /<script src="js\/workspace\/client-map-licenses\.js"/);
  assert.match(registry, /"js\/workspace\/client-map-licenses\.js"/);
  assert.match(navigation, /href:\s*"#licencias"/);
  assert.match(dashboard, /customerFeatureRegistry\.initializeView\("client", viewId/);
});

test("client license module uses the shared MAP repository boundary", async () => {
  const [source, repository] = await Promise.all([
    read("js/workspace/client-map-licenses.js"),
    read("js/workspace/map-repository.js")
  ]);

  assert.match(repository, /rpc\("get_my_license_dashboard"\)/);
  assert.match(repository, /rpc\("get_my_platform_access"\)/);
  assert.match(repository, /rpc\("get_my_internal_entitlements"\)/);
  assert.match(source, /Licencia MAP Staff/);
  assert.match(source, /Beneficio exclusivo del staff/);
  assert.match(source, /function renderSuite/);
  assert.match(source, /function renderSuiteProduct/);
  assert.match(source, /title: "Tu suite MAP"/);
  assert.match(source, /Solicitar licencia/);
  assert.match(source, /function renderInternalAccess/);
  assert.match(source, /function renderAdditionalAccesses/);
  assert.match(source, /function renderSeatManagementLayer/);
  assert.match(source, /function renderCommercialRequestLayer/);
  assert.match(source, /data-client-license-manage/);
  assert.match(source, /data-client-license-request/);
  assert.match(source, /productLicenses\.find\(item => item\.canManage\)/);
  assert.match(source, /refreshSeatManagementLayer\(\{ focusSelect: true \}\)/);
  assert.doesNotMatch(source, /href: "#gestion-plazas"/);
  assert.doesNotMatch(source, /function renderSeatManagement\(\)/);
  assert.match(source, /contracts\.PRODUCT_CATALOG/);
  assert.match(source, /contracts\.productCatalog/);
  assert.doesNotMatch(source, /function render(?:FeaturedLicense|Metrics|Licenses|Marketplace|CommercialWorkspace)/);
  assert.match(await read("js/workspace/map-contracts.js"), /access_source === "internal_role"/);
  assert.ok(source.indexOf("function renderSuite") < source.indexOf("function renderInternalAccess"));
  assert.ok(source.indexOf("function renderInternalAccess") < source.indexOf("function renderActivity"));
  assert.match(repository, /rpc\("assign_my_account_license"/);
  assert.match(repository, /rpc\("release_my_license_assignment"/);
  assert.doesNotMatch(source, /\.from\("(?:platform_licenses|license_assignments|license_account_members)"\)/);
  assert.doesNotMatch(source, /supabase\.rpc|loadSupabaseClient/);
  assert.doesNotMatch(repository, /service[_-]?role/i);
});

test("client license migration preserves least privilege", async () => {
  const sql = await read("supabase/migrations/20260715044124_client_license_self_service.sql");

  assert.match(sql, /enable row level security/i);
  assert.match(sql, /security definer/i);
  assert.match(sql, /current_user_id uuid := \(select auth\.uid\(\)\)/i);
  assert.match(sql, /member_role in \('owner', 'admin'\)/i);
  assert.match(sql, /revoke all on table[\s\S]*from anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.get_my_license_dashboard\(\) to authenticated, service_role/i);
  assert.match(sql, /Evaluation access is managed by BCC staff/i);
});

test("staff MAP entitlement is role-derived and excluded from commercial plans", async () => {
  const sql = await read("supabase/migrations/20260726033539_staff_map_entitlement.sql");

  assert.match(sql, /create table if not exists public\.platform_role_capabilities/i);
  assert.match(sql, /role\.key in \('internal\.staff', 'internal\.admin'\)/i);
  assert.match(sql, /'map\.workspace\.access'[\s\S]*'map\.nano\.use'[\s\S]*'map\.bio\.use'[\s\S]*'map\.med\.use'/i);
  assert.match(sql, /'staff_license'::text/i);
  assert.match(sql, /'entitlement_key', 'map\.staff'/i);
  assert.match(sql, /current_user_id uuid := \(select auth\.uid\(\)\)/i);
  assert.match(sql, /revoke all on table public\.platform_role_capabilities from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.get_my_internal_entitlements\(\)[\s\S]*to authenticated, service_role/i);
  assert.doesNotMatch(sql, /insert into public\.license_plans/i);
  assert.doesNotMatch(sql, /role_capability[\s\S]{0,160}map\.dev\.access/i);
});


test("MAP commercial requests preserve product context across dashboard and contact fallback", async () => {
  const [source, contactContext, spanishContact, englishContact] = await Promise.all([
    read("js/workspace/client-map-licenses.js"),
    read("js/contact-context.js"),
    read("contactUs.html"),
    read("en/contactUs.html")
  ]);

  assert.match(source, /https:\/\/formspree\.io\/f\/xleqdrag/);
  assert.match(source, /name="product_key"/);
  assert.match(source, /name="seats"/);
  assert.match(source, /name="deployment"/);
  assert.match(source, /new FormData\(form\)/);
  assert.match(contactContext, /new URLSearchParams\(window\.location\.search\)/);
  assert.match(contactContext, /params\.get\("product"\)/);
  assert.match(contactContext, /addHiddenField\(form, "intent"/);
  assert.match(contactContext, /addHiddenField\(form, "product"/);
  assert.match(spanishContact, /js\/contact-context\.js/);
  assert.match(englishContact, /\/js\/contact-context\.js/);
  assert.doesNotMatch(spanishContact, /<\/script>\\n\s*<script/);
  assert.doesNotMatch(englishContact, /<\/script>\\n\s*<script/);
});
