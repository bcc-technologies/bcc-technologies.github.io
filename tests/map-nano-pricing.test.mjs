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
  assert.match(dashboardModule, /client-map-nano-plan-footnote/);
  assert.match(dashboardModule, /Plan contratado/);
  assert.doesNotMatch(dashboardModule, /renderMapNanoPlanSummary|Plan y licencia/);
  assert.match(dashboardModule, /data-map-nano-commercial-request-form/);
  assert.match(dashboardModule, /pendingCommercialRequest/);
  assert.match(dashboardModule, /data-map-nano-commercial-cancel/);
  assert.doesNotMatch(dashboardModule, /COMMERCIAL_REQUEST_STORAGE_KEY|rememberCommercialRequest|storedCommercialRequests/);
  assert.match(contact, /js\/map-nano-plans\.js/);
  assert.match(contactContext, /addMapNanoCommercialFields/);
  assert.match(contactContext, /analysis_volume/);
  assert.match(contactContext, /estimated_users/);
});

test("public navigation fixes only the document header, not pricing-card headers", () => {
  const [layout, pricingScript] = [read("css/02-layout.css"), read("js/map-nano-pricing.js")];

  assert.match(layout, /body > header\s*\{\s*position:\s*fixed;/);
  assert.doesNotMatch(layout, /(^|\n)header\s*\{\s*position:\s*fixed;/);
  assert.match(pricingScript, /<header class="map-pricing-plan-head">/);
});

test("MAP-Nano pricing uses a paced hierarchy with focused plan emphasis", () => {
  const [styles, pricingScript] = [read("css/pages/map-nano-pricing.css"), read("js/map-nano-pricing.js")];

  assert.match(styles, /--map-pricing-space-flow: clamp\(18px, 2\.4vw, 28px\);/);
  assert.match(styles, /--map-pricing-space-section: clamp\(58px, 8vw, 104px\);/);
  assert.match(styles, /--map-pricing-space-bridge: clamp\(30px, 4vw, 52px\);/);
  assert.match(styles, /\.map-pricing-comparison\{\s*margin: 0;/);
  assert.match(styles, /\.map-pricing-project\{[^}]*margin: var\(--map-pricing-space-bridge\) 0 0;/);
  assert.match(styles, /\.map-pricing-return \+ \.map-pricing-faq\{/);
  assert.match(styles, /\.map-pricing-section \+ \.map-pricing-section\{\s*border-top: 0;/);
  assert.match(styles, /\.map-pricing-plan-grid\{[^}]*grid-template-columns: \.88fr 1\.12fr 1fr 1\.08fr;/);
  assert.match(styles, /@media \(max-width: 1080px\)\{\s*\.map-pricing-plan-grid\{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(styles, /\.map-pricing-plan\.is-essential\{ --map-pricing-plan-tone: var\(--info\); \}/);
  assert.match(styles, /\.map-pricing-plan\.is-facility\{ --map-pricing-plan-tone: var\(--success\); \}/);
  assert.match(styles, /\.map-pricing-plan:hover\{[^}]*transform: translateY\(-2px\);/);
  assert.match(styles, /\.map-pricing-plan\.is-highlighted::before\{/);
  assert.match(styles, /\.map-pricing-project:hover\{[^}]*transform: translateY\(-2px\);/);
  assert.match(styles, /\.map-pricing-return\{[^}]*border-top: 1px solid var\(--line\);/);
  assert.match(styles, /\.map-pricing-comparison > summary\{/);
  assert.match(styles, /\.map-pricing-comparison\[open\] \.map-pricing-comparison-toggle/);
  assert.match(pricingScript, /<details class="map-pricing-comparison" id="comparar" data-map-pricing-comparison>/);
  assert.doesNotMatch(pricingScript, /<details class="map-pricing-comparison"[^>]*\bopen\b/);
  assert.match(pricingScript, /role="img" aria-label="Incluido"/);
  assert.match(pricingScript, /role="img" aria-label="No incluido"/);
  assert.match(pricingScript, /querySelector\("\[data-map-pricing-comparison\]"\)\.open = true/);
});

test("dashboard preserves the repository boundary behind explicit billing configuration", () => {
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
  assert.match(dashboard, /Facturación<\/dt><dd>\$\{escapeHtml\(billingLabel\(billingSubscription\)\)\}/);
  assert.match(dashboard, /Las solicitudes se revisan antes de emitir una licencia/);
  assert.match(repository, /create-map-checkout-session/);
  assert.match(dashboard, /data-map-nano-checkout/);
  assert.doesNotMatch(dashboard, /sk_live|sk_test|price_[A-Za-z0-9]/);
});

test("commercial-request migration keeps direct browser access closed behind scoped RPCs", () => {
  const migration = read("supabase/migrations/20260728041132_map_nano_commercial_requests.sql");
  const createRpcFix = read("supabase/migrations/20260728041359_fix_map_nano_commercial_request_create_rpc.sql");
  assert.match(migration, /enable row level security/);
  assert.match(migration, /map_nano_commercial_requests_deny_direct_access/);
  assert.match(migration, /map_nano_commercial_requests_one_open_change/);
  assert.match(migration, /security definer/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /create_my_map_nano_commercial_request/);
  assert.match(migration, /get_my_map_nano_commercial_requests/);
  assert.match(migration, /cancel_my_map_nano_commercial_request/);
  assert.match(createRpcFix, /returning request\.id, request\.status/);
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
