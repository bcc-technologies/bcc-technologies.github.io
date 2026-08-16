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

  assert.match(repository, /rpc\("get_my_license_overview"\)/);
  assert.match(repository, /rpc\("get_my_platform_access"\)/);
  assert.match(repository, /rpc\("get_my_internal_entitlements"\)/);
  assert.match(repository, /rpc\("get_current_map_trial_offer"\)/);
  assert.match(source, /Licencia MAP Staff/);
  assert.match(source, /Beneficio exclusivo del staff/);
  assert.match(source, /function renderSuite/);
  assert.match(source, /function renderSuiteProduct/);
  assert.match(source, /title: "Licencias MAP"/);
  assert.match(source, /aria-label="Productos y licencias MAP"/);
  assert.match(source, /aria-label="Licencias para \$\{escapeHtml\(productName\(key\)\)\}"/);
  assert.doesNotMatch(source, /Tu suite MAP|Modalidades disponibles|Elige el tipo de licencia/);
  assert.match(source, /type\.features\.map\(feature/);
  assert.match(source, /client-license-offer-kicker/);
  assert.match(source, /client-license-recommended-badge/);
  assert.match(source, /aria-labelledby=\"\$\{headingId\}\"/);
  assert.doesNotMatch(source, /client-license-no-access|client-license-feature-list|client-license-trial-duration|client-license-product-icon/);
  assert.match(source, /type\.ctaLabel/);
  assert.match(source, /function renderInternalAccess/);
  assert.match(source, /function renderProductTab/);
  assert.match(source, /function renderLicenseOfferCard/);
  assert.match(source, /Solicitar \$\{trialDays\} días gratis/);
  assert.match(source, /Early access · luego \$\{trialOffer\.standard_days\} días/);
  assert.match(source, /Sin tarjeta/);
  assert.match(source, /respuesta en 1 día hábil/);
  assert.match(source, /name="trial_policy"/);
  assert.match(source, /name="trial_days"/);
  assert.match(source, /data-analytics-form="map-license-request"/);
  assert.match(source, /type\.isEvaluation \? `<label>Caso de uso/);
  assert.match(source, /function trackLicenseFunnel/);
  assert.match(source, /map_license_product_select/);
  assert.match(source, /map_license_request_(?:open|submit|success|error)/);
  assert.match(source, /function renderSeatManagementLayer/);
  assert.match(source, /function renderCommercialRequestLayer/);
  assert.match(source, /data-client-license-manage/);
  assert.match(source, /data-client-license-request/);
  assert.match(source, /role="tablist"/);
  assert.match(source, /role="tab"/);
  assert.match(source, /role="tabpanel"/);
  assert.match(source, /function handleKeydown/);
  assert.match(source, /"ArrowLeft", "ArrowRight", "Home", "End"/);
  assert.match(source, /refreshSeatManagementLayer/);
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

test("license capabilities render human labels instead of internal access keys", async () => {
  const [source, contracts] = await Promise.all([
    read("js/workspace/client-map-licenses.js"),
    read("js/workspace/map-contracts.js")
  ]);

  assert.match(source, /platformAccessLabel\(capability\.access_key\)/);
  assert.match(contracts, /"map\.nano\.analysis\.basic": "Análisis esencial MAP-Nano"/);
  assert.match(contracts, /"map\.nano\.pipelines\.reuse": "Pipelines reutilizables"/);
  assert.match(contracts, /"map\.nano\.analysis\.basic": "Essential MAP-Nano analysis"/);
});

test("seat management is scoped, searchable, capacity-aware, and lifecycle-safe", async () => {
  const [source, repository, sql] = await Promise.all([
    read("js/workspace/client-map-licenses.js"),
    read("js/workspace/map-repository.js"),
    read("supabase/migrations/20260811154725_optimize_license_seat_management.sql")
  ]);

  assert.match(repository, /rpc\("get_my_license_seat_management"/);
  assert.match(repository, /p_limit: 50/);
  assert.match(source, /data-client-license-seat-search/);
  assert.match(source, /list="client-license-candidate-options"/);
  assert.match(source, /data-client-license-selected-user/);
  assert.match(source, /client-license-seat-feedback/);
  assert.match(source, /isFull \? assignmentSection/);
  assert.match(source, /focusTarget: search/);
  assert.match(source, /function setSeatManagementFeedback/);
  assert.match(source, /function loadSeatManagement/);
  assert.match(source, /assignedSeats >= seatLimit/);
  assert.match(source, /seatManagement\.assignedSeats >= seatManagement\.seatLimit/);
  assert.match(source, /window\.setTimeout\([\s\S]*250/);
  assert.match(sql, /private\.release_noncurrent_license_assignments/);
  assert.match(sql, /for update of assignment skip locked/i);
  assert.match(sql, /release_license_assignments_on_lifecycle_change/);
  assert.match(sql, /cron\.schedule\([\s\S]*map-license-assignment-lifecycle/i);
  assert.doesNotMatch(sql, /(?:insert|update|delete)\s+(?:into\s+|from\s+)?cron\.job/i);
  assert.match(sql, /private\.get_my_license_seat_management/);
  assert.match(sql, /member_role in \('owner', 'admin'\)/i);
  assert.match(sql, /least\(greatest\(coalesce\(p_limit, 50\), 1\), 100\)/i);
  assert.match(sql, /'members', '\[\]'::jsonb/);
  assert.match(sql, /'assignments', '\[\]'::jsonb/);
  assert.match(sql, /subject_name/);
  const seatFunctionSql = sql.slice(sql.indexOf("create or replace function private.get_my_license_seat_management"));
  const assignmentPayloadSql = seatFunctionSql.slice(seatFunctionSql.indexOf("'assignments'"), seatFunctionSql.indexOf("'candidates'"));
  assert.doesNotMatch(assignmentPayloadSql, /search_term/);

  assert.match(sql, /revoke all on function public\.get_my_license_seat_management/);
  assert.match(sql, /grant execute on function public\.get_my_license_seat_management[\s\S]*to authenticated, service_role/i);
});

test("seat management hides icon labels and protects the manager and final seat", async () => {
  const [source, coreStyles, sql] = await Promise.all([
    read("js/workspace/client-map-licenses.js"),
    read("css/workspace/workspace-core.css"),
    read("supabase/migrations/20260811154725_optimize_license_seat_management.sql")
  ]);

  assert.match(coreStyles, /\.workspace-shell \.sr-only[\s\S]*clip: rect\(0, 0, 0, 0\)/);
  assert.match(source, /item\.is_mine \|\| assignedSeats <= 1 \|\| item\.release_block_reason/);
  assert.match(source, /item\.can_release && !item\.is_evaluation && !isProtected/);
  assert.match(source, /Tú · plaza principal/);
  assert.match(source, /La plaza principal no puede liberarse sin asignar un reemplazo/);

  assert.match(sql, /'can_release', assigned_seats > 1 and page\.user_id <> current_user_id/);
  assert.match(sql, /'release_block_reason'[\s\S]*'last_assignment'[\s\S]*'manager_self_release'/);
  assert.match(sql, /for update of assignment, license/i);
  assert.match(sql, /active_assignment_count <= 1[\s\S]*The only active seat cannot be released/i);
  assert.match(sql, /target_user_id = current_user_id and actor_is_manager[\s\S]*cannot release their own seat without transferring management/i);
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
  assert.match(source, /name="license_type"/);
  assert.match(source, /data: \{ clientLicenseRequest: key, clientLicenseType: type\.key \}/);
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


test("MAP trial policy keeps seven-day standard and fourteen-day early access server-side", async () => {
  const [sql, staffSource, repository] = await Promise.all([
    read("supabase/migrations/20260726050000_map_trial_policy.sql"),
    read("js/workspace/maps-licensing.js"),
    read("js/workspace/map-repository.js")
  ]);

  assert.match(sql, /'standard', 'Prueba gratuita', 7, false, true, 0/);
  assert.match(sql, /'early_access', 'Early access', 14, true, true, 100/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /force row level security/);
  assert.match(sql, /touch_map_trial_policy_updated_at/);
  assert.doesNotMatch(sql, /\nas \$\r?\n|\n\$;\r?\n/);
  assert.match(sql, /to anon, authenticated[\s\S]*using \(is_active\)/);
  assert.match(sql, /private\.current_map_trial_offer/);
  assert.match(sql, /sync_map_trial_plan_duration/);
  assert.match(sql, /license_type\.is_evaluation/);
  assert.match(sql, /public\.get_current_map_trial_offer/);
  assert.match(sql, /security invoker[\s\S]*as \$\$[\s\S]*from public\.map_trial_policies[\s\S]*\$\$/);
  assert.match(sql, /revoke all on function public\.get_current_map_trial_offer\(\) from public/);
  assert.match(repository, /error\?\.code === "invalid_response"/);
  assert.match(repository, /TRIAL_OFFER_FALLBACK/);
  assert.match(staffSource, /trialOffer\.duration_days \* 86400000/);
  assert.doesNotMatch(staffSource, /30 \* 86400000/);
});
