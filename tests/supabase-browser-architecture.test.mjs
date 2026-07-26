import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("runtime sources contain no unresolved merge markers", () => {
  const files = [
    "accounts-server.mjs",
    "js/auth.js",
    "js/dashboard.js",
    "js/workspace/navigation.js",
    "js/workspace/router.js",
    "js/workspace/utils.js"
  ];
  const marker = /^(<<<<<<<|=======|>>>>>>>)/m;
  files.forEach(file => assert.doesNotMatch(read(file), marker, file));
});

test("browser Supabase factory creates exactly one shared client", async () => {
  let createCount = 0;
  const client = { auth: {} };
  const window = {
    location: { hostname: "bcctechnologies.com.do" },
    supabase: {
      createClient(url, key, options) {
        createCount += 1;
        assert.match(url, /supabase\.co$/);
        assert.match(key, /^sb_publishable_/);
        assert.equal(options.auth.persistSession, true);
        return client;
      }
    }
  };
  const context = vm.createContext({ window, document: {} });
  vm.runInContext(read("js/supabase-config.js"), context, { filename: "supabase-config.js" });

  const [first, second, third] = await Promise.all([
    window.BCCSupabase.getClient(),
    window.BCCSupabase.getClient(),
    window.BCCSupabase.getClient()
  ]);

  assert.equal(createCount, 1);
  assert.equal(first, client);
  assert.equal(second, client);
  assert.equal(third, client);
  assert.equal(window.BCCSupabaseClient, client);
});

test("Supabase runtime separates production from local fallback and classifies failures", () => {
  const window = { location: { hostname: "bcctechnologies.com.do" } };
  const context = vm.createContext({ window, document: {} });
  vm.runInContext(read("js/supabase-config.js"), context, { filename: "supabase-config.js" });

  assert.equal(window.BCC_RUNTIME.isLocal, false);
  assert.equal(window.BCC_RUNTIME.allowLocalAccountFallback, false);
  assert.equal(window.BCCSupabaseErrors.classify({ status: 401 }), "auth_invalid_credentials");
  assert.equal(window.BCCSupabaseErrors.classify({ code: "42501" }), "permission_denied");
  assert.equal(window.BCCSupabaseErrors.classify({ code: "PGRST204" }), "schema_mismatch");

  const localWindow = { location: { hostname: "127.0.0.1" } };
  vm.runInContext(read("js/supabase-config.js"), vm.createContext({ window: localWindow, document: {} }));
  assert.equal(localWindow.BCC_RUNTIME.allowLocalAccountFallback, true);
});

test("MAP contracts expose one canonical product and status namespace", () => {
  const window = {};
  const context = vm.createContext({ window });
  vm.runInContext(read("js/workspace/map-contracts.js"), context, { filename: "map-contracts.js" });

  assert.deepEqual(
    Object.keys(window.BCCWorkspaceMapContracts.PRODUCTS),
    ["map.nano", "map.bio", "map.med"]
  );
  assert.equal(window.BCCWorkspaceMapContracts.productName("map.nano"), "MAP Nano");
  assert.equal(window.BCCWorkspaceMapContracts.toLicenseViewModel({
    product_key: "map.bio",
    license_status: "active",
    seat_limit: 4,
    assigned_seats: 1
  }).availableSeats, 3);
});
