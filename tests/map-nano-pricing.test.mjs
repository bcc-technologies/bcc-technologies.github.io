import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function loadCatalog() {
  const context = { window: {}, Intl, URLSearchParams, Object, Number, String, Array, Date, RegExp };
  vm.createContext(context);
  vm.runInContext(read("js/map-nano-plans.js"), context, { filename: "map-nano-plans.js" });
  return context.window.BCCMapNanoPlans;
}

test("MAP-Nano commercial catalog centralizes all four annual plans and Project", () => {
  const catalog = loadCatalog();
  assert.deepEqual([...catalog.PLANS.map(plan => plan.id)], ["essential", "professional", "facility", "institutional"]);
  assert.equal(catalog.PROJECT_ACCESS.id, "project");
  assert.equal(catalog.planById("professional").highlighted, true);
  assert.equal(catalog.planById("professional").badge, "Recomendado");
  assert.equal(catalog.planById("institutional").annualPrice, null);
  assert.equal(catalog.planById("institutional").startingPrice, 10000);
  assert.equal(catalog.PROJECT_ACCESS.priceRange.min, 300);
  assert.equal(catalog.PROJECT_ACCESS.priceRange.max, 500);
});

test("MAP-Nano price formatting derives annual and monthly references from numeric values", () => {
  const catalog = loadCatalog();
  const essential = catalog.planById("essential");
  const professional = catalog.planById("professional");
  assert.equal(catalog.priceLabel(essential), "US$1,200/año");
  assert.equal(catalog.monthlyEquivalent(essential), 100);
  assert.equal(catalog.monthlyLabel(essential), "US$100/mes · facturado anualmente");
  assert.equal(catalog.monthlyEquivalent(professional), 250);
  assert.equal(catalog.monthlyLabel(catalog.planById("institutional")), "");
  assert.equal(catalog.projectPriceLabel(), "US$300–US$500 por proyecto");
});

test("commercial entitlements and user limits are centralized without becoming authorization", () => {
  const catalog = loadCatalog();
  const facility = catalog.planById("facility");
  assert.equal(facility.limits.namedUsers, 5);
  assert.equal(facility.limits.concurrentUsers, 3);
  assert.equal(catalog.hasEntitlement(facility, "audit_logs"), true);
  assert.equal(catalog.hasEntitlement(catalog.planById("essential"), "batch_processing"), false);
  assert.match(read("docs/MAP_NANO_PRICING.md"), /No son autorización/);
});

test("public pricing page, dashboard and contact form consume the shared plan catalog", () => {
  const [page, pageScript, dashboardFeature, dashboardModule, contact, contactContext] = [
    read("map-nano-pricing.html"),
    read("js/map-nano-pricing.js"),
    read("js/workspace/feature-registry.js"),
    read("js/workspace/client-map-licenses.js"),
    read("contactUs.html"),
    read("js/contact-context.js")
  ];

  assert.match(page, /js\/map-nano-plans\.js/);
  assert.match(page, /data-map-nano-pricing/);
  assert.match(pageScript, /catalog\.PLANS\.map/);
  assert.match(pageScript, /catalog\.COMPARISON_FEATURES/);
  assert.match(pageScript, /pricing_page_viewed/);
  assert.match(pageScript, /pricing_faq_opened/);
  assert.match(dashboardFeature, /"js\/map-nano-plans\.js"/);
  assert.match(dashboardModule, /renderMapNanoPlanSummary/);
  assert.match(dashboardModule, /data-map-nano-commercial-request-form/);
  assert.match(dashboardModule, /pendingCommercialRequest/);
  assert.match(dashboardModule, /data-map-nano-commercial-cancel/);
  assert.doesNotMatch(dashboardModule, /COMMERCIAL_REQUEST_STORAGE_KEY|rememberCommercialRequest|storedCommercialRequests/);
  assert.match(contact, /js\/map-nano-plans\.js/);
  assert.match(contactContext, /addMapNanoCommercialFields/);
  assert.match(contactContext, /analysis_volume/);
  assert.match(contactContext, /estimated_users/);
});

test("dashboard preserves the repository boundary and remains honest about unavailable billing data", () => {
  const [contracts, repository, dashboard] = [
    read("js/workspace/map-contracts.js"),
    read("js/workspace/map-repository.js"),
    read("js/workspace/client-map-licenses.js")
  ];
  assert.match(contracts, /function normalizeEffectiveAccess/);
  assert.match(contracts, /function normalizeCommercialRequests/);
  assert.match(repository, /effectiveAccess: contracts\.normalizeEffectiveAccess\(access\)/);
  assert.match(repository, /get_my_map_nano_commercial_requests/);
  assert.match(repository, /create_my_map_nano_commercial_request/);
  assert.match(repository, /cancel_my_map_nano_commercial_request/);
  assert.match(dashboard, /Facturación<\/dt><dd>No especificada/);
  assert.match(dashboard, /No hay una licencia activa asociada a esta cuenta/);
  assert.doesNotMatch(dashboard, /stripe|paddle|checkout/i);
});

test("commercial-request migration keeps direct browser access closed behind scoped RPCs", () => {
  const migration = read("supabase/migrations/20260728041132_map_nano_commercial_requests.sql");
  assert.match(migration, /enable row level security/);
  assert.match(migration, /map_nano_commercial_requests_deny_direct_access/);
  assert.match(migration, /map_nano_commercial_requests_one_open_change/);
  assert.match(migration, /security definer/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /create_my_map_nano_commercial_request/);
  assert.match(migration, /get_my_map_nano_commercial_requests/);
  assert.match(migration, /cancel_my_map_nano_commercial_request/);
  assert.match(migration, /returning request\.id, request\.status/);
});

test("staff commercial queue keeps contact data behind a license-manager RPC", () => {
  const migration = read("supabase/migrations/20260728043321_map_nano_commercial_request_staff_queue.sql");
  const repository = read("js/workspace/map-repository.js");
  const staffWorkspace = read("js/workspace/maps-licensing.js");
  const registry = read("js/workspace/feature-registry.js");

  assert.match(migration, /private\.require_license_manager\(current_user_id\)/);
  assert.match(migration, /left join public\.profiles reviewer/);
  assert.match(migration, /security definer/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /revoke all on function public\.get_my_map_nano_commercial_request_queue\(text, integer\) from public, anon/);
  assert.match(migration, /review_my_map_nano_commercial_request/);
  assert.match(migration, /resolution note is required when resolving or declining/i);
  assert.match(repository, /get_my_map_nano_commercial_request_queue/);
  assert.match(repository, /review_my_map_nano_commercial_request/);
  assert.match(staffWorkspace, /platform\.licenses\.manage/);
  assert.match(staffWorkspace, /data-map-commercial-request-review-form/);
  assert.match(staffWorkspace, /map-commercial-request-detail-dialog/);
  assert.match(registry, /maps-licensing[\s\S]*js\/map-nano-plans\.js/);
});
