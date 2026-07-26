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

test("license UI and shared MAP contracts use separate namespaces", () => {
  const window = { BCCWorkspaceUtils: { escapeHtml: String } };
  const context = vm.createContext({ window, navigator: {}, document: {} });
  vm.runInContext(read("js/workspace/licenses.js"), context, { filename: "licenses.js" });
  vm.runInContext(read("js/workspace/license-contracts.js"), context, { filename: "license-contracts.js" });

  assert.equal(typeof window.BCCWorkspaceLicenses.init, "function");
  assert.equal(typeof window.BCCWorkspaceLicenseContracts.toViewModel, "function");
  assert.equal(window.BCCWorkspaceLicenseContracts.PRODUCTS["map.nano"], "MAP Nano");
});
