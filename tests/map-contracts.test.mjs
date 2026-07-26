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
    if (name === "get_my_license_dashboard") {
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
    return { data: [{ entitlement_key: "map.staff", product_keys: ["map.nano"] }, null], error: null };
  });

  const result = await window.BCCWorkspaceMapRepository.client.getDashboard();
  assert.deepEqual(calls, [
    "get_my_license_dashboard",
    "get_my_platform_access",
    "get_my_internal_entitlements",
    "get_current_map_trial_offer"
  ]);
  assert.equal(result.dashboard.licenses.length, 1);
  assert.equal(result.dashboard.members.length, 0);
  assert.deepEqual(Array.from(result.platformAccess), ["map.dev.access"]);
  assert.equal(result.entitlements.length, 1);
  assert.equal(result.trialOffer.duration_days, 14);
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
