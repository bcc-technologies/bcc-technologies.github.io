import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function createMemoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] || null; },
    getItem(key) { return values.has(String(key)) ? values.get(String(key)) : null; },
    setItem(key, value) { values.set(String(key), String(value)); },
    removeItem(key) { values.delete(String(key)); }
  };
}

function loadAuthReturnPaths(pathname = "/dashboard.html", hash = "") {
  const location = { origin: "http://127.0.0.1:5500", pathname, search: "", hash };
  const window = {
    location,
    BCCAccessContracts: {
      ROLE_PERMISSIONS: {},
      STAFF_ROLE_PERMISSIONS: {},
      BASE_ROLE_HIERARCHY: {},
      STAFF_ROLE_HIERARCHY: {},
      DEFAULT_CUSTOM_ROLE_HIERARCHY: 100,
      DEPARTMENT_PERMISSIONS: {},
      STAFF_ROLES: [],
      DEPARTMENTS: [],
      PERMISSION_LABELS: {},
      ROLE_LABELS: {}
    }
  };
  const document = {
    documentElement: { lang: pathname.startsWith("/en/") ? "en" : "es" },
    addEventListener() {}
  };
  const context = vm.createContext({ window, document, location, URL, URLSearchParams, console });
  vm.runInContext(`${read("js/auth.js")}\nwindow.BCCAuthReturnPathTest = { currentReturnPath, safeLocalReturnPath };`, context, {
    filename: "auth.js"
  });
  return window.BCCAuthReturnPathTest;
}

function loadAuthDiagnostics({ authRecord = false, pathname = "/dashboard.html" } = {}) {
  const location = { origin: "http://127.0.0.1:5500", pathname, search: "", hash: "" };
  const localStorage = createMemoryStorage(authRecord ? { "sb-project-auth-token": "redacted" } : {});
  const sessionStorage = createMemoryStorage();
  const window = {
    location,
    localStorage,
    sessionStorage,
    performance: { getEntriesByType: () => [{ type: "navigate" }] },
    BCCAccessContracts: {
      ROLE_PERMISSIONS: {},
      STAFF_ROLE_PERMISSIONS: {},
      BASE_ROLE_HIERARCHY: {},
      STAFF_ROLE_HIERARCHY: {},
      DEFAULT_CUSTOM_ROLE_HIERARCHY: 100,
      DEPARTMENT_PERMISSIONS: {},
      STAFF_ROLES: [],
      DEPARTMENTS: [],
      PERMISSION_LABELS: {},
      ROLE_LABELS: {}
    }
  };
  const document = {
    documentElement: { lang: pathname.startsWith("/en/") ? "en" : "es" },
    addEventListener() {},
    dispatchEvent() {}
  };
  const context = vm.createContext({ window, document, location, URL, URLSearchParams, console, Date, JSON, String, Number });
  vm.runInContext(`${read("js/auth.js")}\nwindow.BCCAuthDiagnosticsTest = { authStorageState, missingSessionReason, recordAuthDiagnostic, readAuthDiagnostics, storeAuthDiagnosticNotice, consumeAuthDiagnosticNotice, authDiagnosticNoticeMessage };`, context, {
    filename: "auth.js"
  });
  return window.BCCAuthDiagnosticsTest;
}

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
  assert.equal(window.BCCSupabaseErrors.classify({ message: "JWT expired" }), "auth_session_invalid");

  const localWindow = { location: { hostname: "127.0.0.1" } };
  vm.runInContext(read("js/supabase-config.js"), vm.createContext({ window: localWindow, document: {} }));
  assert.equal(localWindow.BCC_RUNTIME.allowLocalAccountFallback, true);
});

test("workspace auth distinguishes a missing session from recoverable profile and network failures", () => {
  const auth = read("js/auth.js");
  const layout = read("js/layout.js");

  assert.match(auth, /async function resolveAuthState\(\)/);
  assert.match(auth, /await supabase\.auth\.getSession\(\)/);
  assert.match(auth, /return authResolution\("unauthenticated"/);
  assert.match(auth, /return authResolution\("recoverable_error"/);
  assert.match(auth, /if \(state\.kind === "unauthenticated"\)/);
  assert.match(auth, /if \(state\.kind !== "authenticated" \|\| !state\.user\)/);
  assert.match(auth, /function renderAuthRecovery\(state\)/);
  assert.match(auth, /function safeLocalReturnPath\(value\)/);
  assert.match(auth, /function currentReturnPath\(\)/);
  assert.match(auth, /signOut\(\{ scope: "local" \}\)/);
  assert.doesNotMatch(auth, /\.from\("profiles"\)\.insert\(/);
  assert.doesNotMatch(layout, /window\.BCCAuth\?\.currentUser/);
});

test("auth return paths preserve dashboard hashes without accepting fragment-only or public destinations", () => {
  const spanish = loadAuthReturnPaths("/dashboard.html", "#cuenta");
  const english = loadAuthReturnPaths("/en/staff-dashboard.html", "#usuarios");

  assert.equal(spanish.currentReturnPath(), "/dashboard.html#cuenta");
  assert.equal(english.currentReturnPath(), "/en/staff-dashboard.html#usuarios");
  assert.equal(spanish.safeLocalReturnPath("#cuenta"), "");
  assert.equal(spanish.safeLocalReturnPath("/index.html#cuenta"), "");
  assert.equal(spanish.safeLocalReturnPath("https://example.test/dashboard.html#cuenta"), "");
  assert.equal(spanish.safeLocalReturnPath("/dashboard.html#operacion"), "/dashboard.html#operacion");
  assert.equal(english.safeLocalReturnPath("/en/staff-dashboard.html#maps-licensing/licenses"), "/en/staff-dashboard.html#maps-licensing/licenses");
});

test("session diagnostics distinguish missing persisted auth from an un-restorable record without storing secrets", () => {
  const missing = loadAuthDiagnostics();
  const stored = loadAuthDiagnostics({ authRecord: true, pathname: "/en/dashboard.html" });

  assert.equal(missing.authStorageState(), "auth_record_absent");
  assert.equal(missing.missingSessionReason(), "auth_record_absent");
  assert.equal(stored.authStorageState(), "auth_record_present");
  assert.equal(stored.missingSessionReason(), "stored_session_not_restored");

  missing.recordAuthDiagnostic("session_unavailable", { reason: missing.missingSessionReason(), session: "session_absent" });
  const [entry] = missing.readAuthDiagnostics();
  assert.deepEqual(
    { event: entry.event, reason: entry.reason, storage: entry.storage, session: entry.session, origin: entry.origin, navigation: entry.navigation },
    {
      event: "session_unavailable",
      reason: "auth_record_absent",
      storage: "auth_record_absent",
      session: "session_absent",
      origin: "http://127.0.0.1:5500",
      navigation: "navigate"
    }
  );
  assert.equal(Object.hasOwn(entry, "access_token"), false);
  assert.equal(Object.hasOwn(entry, "refresh_token"), false);

  missing.storeAuthDiagnosticNotice({ reason: "auth_record_absent" });
  assert.equal(
    missing.authDiagnosticNoticeMessage(missing.consumeAuthDiagnosticNotice()),
    "Diagnóstico de sesión: no se encontró una sesión guardada para este origen del sitio."
  );
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
