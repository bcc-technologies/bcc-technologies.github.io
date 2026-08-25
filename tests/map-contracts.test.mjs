import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function runtime(rpcHandler) {
  const window = {
    BCCAuth: {
      async loadSupabaseClient() {
        return { rpc: rpcHandler };
      }
    }
  };
  const context = vm.createContext({ window, Error, Object, Array, Set, Date, Promise, String, Number, Boolean, Math });
  vm.runInContext(read("js/workspace/map-contracts.js"), context, { filename: "map-contracts.js" });
  vm.runInContext(read("js/workspace/map-repository.js"), context, { filename: "map-repository.js" });
  return window;
}

test("client MAP repository normalizes malformed collections at the RPC boundary", async () => {
  const calls = [];
  const window = runtime(async name => {
    calls.push(name);
    if (name === "get_my_license_overview") {
      return { data: { licenses: [{ product_key: "map.nano" }], members: null }, error: null };
    }
    if (name === "get_my_platform_access") {
      return {
        data: [
          { access_source: "internal_role", access_key: "map.dev.access" },
          { access_source: "commercial", access_key: "ignored" }
        ],
        error: null
      };
    }
    if (name === "get_my_map_billing_dashboard") {
      return { data: [{ subscription_id: "billing-1" }, null], error: null };
    }
    return { data: [{ entitlement_key: "map.staff", product_keys: ["map.nano"] }, null], error: null };
  });

  const result = await window.BCCWorkspaceMapRepository.client.getDashboard();
  assert.deepEqual(calls, [
    "activate_my_evaluation_memberships",
    "get_my_license_overview",
    "get_my_platform_access",
    "get_my_internal_entitlements",
    "get_current_map_trial_offer",
    "get_my_map_nano_commercial_requests",
    "get_my_map_billing_dashboard"
  ]);
  assert.equal(result.dashboard.licenses.length, 1);
  assert.equal(result.dashboard.members.length, 0);
  assert.deepEqual(Array.from(result.platformAccess), ["map.dev.access"]);
  assert.equal(result.entitlements.length, 1);
  assert.equal(result.trialOffer.duration_days, 14);
  assert.equal(result.commercialRequestsAvailable, true);
  assert.equal(result.commercialRequests.length, 0);
  assert.equal(result.billingAvailable, true);
  assert.equal(result.billingSubscriptions.length, 1);
});

test("MAP repository translates transport failures into a stable domain error", async () => {
  const window = runtime(async () => {
    throw new TypeError("NetworkError when attempting to fetch resource.");
  });

  await assert.rejects(
    window.BCCWorkspaceMapRepository.client.getDashboard(),
    error => error.code === "network_error" && /No pudimos conectar con MAP/.test(error.message)
  );
});

test("staff commercial queue normalizes contact data and sends a scoped review decision", async () => {
  const calls = [];
  const window = runtime(async (name, parameters) => {
    calls.push({ name, parameters });
    if (name === "get_my_map_nano_commercial_request_queue") {
      return {
        data: [{
          request_id: "request-1",
          account_id: "account-1",
          plan_key: "facility",
          request_type: "new_license",
          status: "pending",
          contact_name: "Ana Laboratorio",
          contact_email: "ana@example.com",
          organization_name: "Laboratorio Norte",
          country: "República Dominicana",
          estimated_users: "5",
          analysis_volume: "100_to_1000",
          message: null,
          created_at: "2026-07-28T00:00:00Z"
        }, null],
        error: null
      };
    }
    if (name === "review_my_map_nano_commercial_request") return { data: "request-1", error: null };
    return { data: null, error: null };
  });

  const queue = await window.BCCWorkspaceMapRepository.staff.getCommercialRequestQueue();
  assert.equal(queue.available, true);
  assert.equal(queue.requests.length, 1);
  assert.equal(queue.requests[0].estimated_users, 5);
  assert.equal(queue.requests[0].contact_email, "ana@example.com");

  await window.BCCWorkspaceMapRepository.staff.reviewCommercialRequest({
    requestId: "request-1",
    status: "resolved",
    resolutionNote: "Se preparó la propuesta."
  });
  assert.deepEqual(calls.map(call => call.name), [
    "get_my_map_nano_commercial_request_queue",
    "review_my_map_nano_commercial_request"
  ]);
  assert.equal(calls[1].parameters.p_request_id, "request-1");
  assert.equal(calls[1].parameters.p_status, "resolved");
  assert.equal(calls[1].parameters.p_resolution_note, "Se preparó la propuesta.");
});

test("legacy workspace license UI is no longer part of the dashboard manifest", () => {
  const manifests = [
    read("css/pages/dashboard-client.css"),
    read("css/pages/dashboard-staff.css"),
    ...fs.readdirSync(new URL("../css/workspace/features/", import.meta.url))
      .filter(name => name.endsWith(".css"))
      .map(name => read(`css/workspace/features/${name}`))
  ].join("\n");
  const client = read("js/dashboard.js");
  const staff = read("js/staff-dashboard.js");
  const registry = read("js/workspace/feature-registry.js");

  assert.doesNotMatch(manifests, /workspace-licenses\.css/);
  assert.doesNotMatch(client, /workspace\/licenses\.js|license-contracts\.js/);
  assert.doesNotMatch(staff, /workspace\/licenses\.js|license-contracts\.js/);
  assert.match(registry, /map-contracts\.js[\s\S]+map-repository\.js/);
  assert.match(client, /customerFeatureRegistry\.register\("client"\)/);
  assert.match(staff, /staffFeatureRegistry\.register\("staff"\)/);
});

test("MAP commercial catalog exposes honest, reusable purchase metadata", () => {
  const window = runtime(async () => ({ data: null, error: null }));
  const contracts = window.BCCWorkspaceMapContracts;
  assert.deepEqual(Object.keys(contracts.PRODUCT_CATALOG), ["map.nano", "map.bio", "map.med"]);
  assert.deepEqual(Object.keys(contracts.LICENSE_TYPES), ["named_user", "organization", "evaluation"]);
  assert.equal(contracts.TRIAL_OFFER_FALLBACK.standard_days, 7);
  assert.equal(contracts.TRIAL_OFFER_FALLBACK.duration_days, 14);
  assert.equal(contracts.TRIAL_OFFER_FALLBACK.is_campaign, true);
  assert.equal(contracts.normalizeTrialOffer([{ policy_key: "standard", display_name: "Prueba gratuita", duration_days: 7, is_campaign: false }]).duration_days, 7);
  assert.equal(contracts.licenseType("named_user").ctaLabel, "Solicitar individual");
  assert.equal(contracts.licenseType("organization").ctaLabel, "Cotizar para equipo");
  assert.equal(contracts.licenseType("organization").defaultSeatLimit, 5);
  assert.equal(contracts.licenseType("evaluation").isEvaluation, true);
  for (const key of Object.keys(contracts.PRODUCT_CATALOG)) {
    const product = contracts.productCatalog(key);
    assert.equal(product, contracts.PRODUCT_CATALOG[key]);
    assert.ok(product.description.length > 30);
    assert.equal(product.features.length, 3);
    assert.deepEqual(Array.from(product.licenseTypes), ["named_user", "organization", "evaluation"]);
    assert.deepEqual(Array.from(contracts.productLicenseTypes(key), type => type.key), Array.from(product.licenseTypes));
    assert.match(product.productHref, /^\//);
    assert.match(product.requestHref, /intent=license/);
    assert.doesNotMatch(JSON.stringify(product), /(?:price|precio|checkout)/i);
  }
});

test("MAP license attention distinguishes cancellation from expiry and ignores replaced access", () => {
  const window = runtime(async () => ({ data: null, error: null }));
  const contracts = window.BCCWorkspaceMapContracts;
  const now = Date.parse("2026-08-11T12:00:00Z");
  const cancelled = contracts.toLicenseViewModel({
    license_id: "license-cancelled",
    account_id: "account-a",
    product_key: "map.nano",
    license_status: "expired",
    ends_at: "2026-08-01T12:00:00Z"
  }, now, { status: "canceled" });
  const expired = contracts.toLicenseViewModel({
    license_id: "license-expired",
    account_id: "account-a",
    product_key: "map.nano",
    license_status: "expired"
  }, now);
  const suspended = contracts.toLicenseViewModel({
    license_id: "license-suspended",
    account_id: "account-a",
    product_key: "map.nano",
    license_status: "suspended"
  }, now);
  const active = contracts.toLicenseViewModel({
    license_id: "license-active",
    account_id: "account-a",
    product_key: "map.nano",
    license_status: "active"
  }, now);
  const expiring = contracts.toLicenseViewModel({
    license_id: "license-expiring",
    account_id: "account-a",
    product_key: "map.nano",
    license_status: "active",
    ends_at: "2026-08-21T12:00:00Z"
  }, now);

  assert.equal(cancelled.status, "cancelled");
  assert.equal(cancelled.statusMeta.label, "Cancelada");
  assert.equal(cancelled.needsAttention, false);
  assert.equal(expired.needsAttention, false);
  assert.equal(contracts.attentionLicense([suspended, active]), null);
  assert.equal(contracts.attentionLicense([suspended, expiring]).license_id, "license-expiring");

  const activeElsewhere = { ...active, license_id: "license-other-account", account_id: "account-b" };
  assert.equal(contracts.attentionLicense([suspended, activeElsewhere]).license_id, "license-suspended");
});
