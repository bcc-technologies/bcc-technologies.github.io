import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function repositoryRuntime(api) {
  const window = { BCCAuth: { api }, setTimeout, clearTimeout };
  const context = vm.createContext({
    window,
    AbortController,
    Error,
    Object,
    Array,
    Set,
    Date,
    Promise,
    String,
    Number,
    Boolean,
    Math,
    JSON,
    encodeURIComponent
  });
  [
    "js/workspace/transport.js",
    "js/workspace/admin-access-contracts.js",
    "js/workspace/admin-access-repository.js"
  ].forEach(path => vm.runInContext(read(path), context, { filename: path }));
  return window;
}

test("administrative repository normalizes users, role catalogs and audit logs", async () => {
  const calls = [];
  const window = repositoryRuntime(async (path, options) => {
    calls.push({ path, options });
    if (path === "/api/admin/users") {
      return { users: [{ id: 7, name: null, role: "", permissions: ["cms:access", "cms:access"] }] };
    }
    if (path === "/api/admin/roles") {
      return {
        roles: [{ id: "custom:ops", name: "Ops", permissions: ["forms:manage"] }],
        permissions: [{ value: "forms:manage", label: "Formularios", group: "forms" }]
      };
    }
    if (path === "/api/admin/access-audit") {
      return {
        logs: [{
          id: 9,
          actorEmail: null,
          beforeAccess: { role: "client" },
          afterAccess: { role: "staff", departments: ["operations"] }
        }]
      };
    }
    if (path === "/api/admin/users/user%2F1/role") return { ok: true };
    throw new Error(`Unexpected request ${path}`);
  });

  const users = await window.BCCWorkspaceAdminAccessRepository.listUsers();
  const catalog = await window.BCCWorkspaceAdminAccessRepository.listRoles();
  const logs = await window.BCCWorkspaceAdminAccessRepository.listAudit();
  await window.BCCWorkspaceAdminAccessRepository.updateUserAccess("user/1", {
    role: "staff",
    departments: ["operations"]
  });

  assert.equal(users[0].id, "7");
  assert.equal(users[0].name, "");
  assert.deepEqual(Array.from(users[0].permissions), ["cms:access"]);
  assert.equal(catalog.roles[0].hierarchyLevel, 50);
  assert.equal(catalog.permissions[0].group, "forms");
  assert.equal(logs[0].afterAccess.role, "staff");
  assert.deepEqual(Array.from(logs[0].afterAccess.departments), ["operations"]);
  assert.equal(calls[3].path, "/api/admin/users/user%2F1/role");
  assert.equal(calls[3].options.body, JSON.stringify({ role: "staff", departments: ["operations"] }));
});

test("administrative repository exposes stable permission and schema errors", async () => {
  const forbidden = repositoryRuntime(async () => {
    throw new Error("Permiso insuficiente.");
  });
  await assert.rejects(
    forbidden.BCCWorkspaceAdminAccessRepository.listUsers(),
    error => error.code === "forbidden"
  );

  const schema = repositoryRuntime(async () => {
    throw new Error('relation "workspace_role_definitions" does not exist');
  });
  await assert.rejects(
    schema.BCCWorkspaceAdminAccessRepository.listRoles(),
    error => error.code === "schema_unavailable" && /administración de acceso/.test(error.message)
  );
});

test("access mutation requires users:manage before invoking its RPC", async () => {
  let rpcCalls = 0;
  const window = {};
  vm.runInContext(
    read("js/auth-admin-access-api.js"),
    vm.createContext({ window, Error, Object, Array, Set, Map, JSON, String, decodeURIComponent }),
    { filename: "auth-admin-access-api.js" }
  );
  const api = window.BCCAuthAdminAccessApi.createAdminAccessApi({
    authorizedUser: async () => ({ permissions: ["admin:view"] }),
    supabase: {
      rpc() {
        rpcCalls += 1;
        return Promise.resolve({ error: null });
      }
    }
  });

  await assert.rejects(
    api.handle("/api/admin/users/user-1/role", {
      method: "PATCH",
      body: JSON.stringify({ role: "staff" })
    }),
    /Permiso insuficiente/
  );
  assert.equal(rpcCalls, 0);
});

test("administrative Supabase query receives the exact transport signal", async () => {
  let appliedSignal = null;
  const query = {
    select() { return this; },
    order() { return this; },
    limit() { return this; },
    abortSignal(signal) {
      appliedSignal = signal;
      return this;
    },
    then(resolve) {
      resolve({ data: [], error: null });
    }
  };
  const window = {};
  vm.runInContext(
    read("js/auth-admin-access-api.js"),
    vm.createContext({ window, Error, Object, Array, Set, Map, JSON, String, decodeURIComponent }),
    { filename: "auth-admin-access-api.js" }
  );
  const api = window.BCCAuthAdminAccessApi.createAdminAccessApi({
    authorizedUser: async () => ({ permissions: ["users:manage"] }),
    supabase: { from: () => query },
    normalizeAccessPayload: value => value
  });
  const controller = new AbortController();

  const result = await api.handle("/api/admin/access-audit", {
    method: "GET",
    signal: controller.signal
  });

  assert.equal(result.handled, true);
  assert.equal(result.value.logs.length, 0);
  assert.equal(appliedSignal, controller.signal);
});

test("administrative views use independent lifecycle controllers and one repository boundary", () => {
  const registry = read("js/workspace/feature-registry.js");
  const controllers = [
    read("js/workspace/admin-users.js"),
    read("js/workspace/admin-roles.js"),
    read("js/workspace/admin-audit.js")
  ].join("\n");

  assert.equal(fs.existsSync(new URL("../js/admin-dashboard.js", import.meta.url)), false);
  assert.doesNotMatch(controllers, /BCCAuth\.api|JSON\.stringify/);
  assert.match(controllers, /function activate\(context = \{\}\)/);
  assert.match(controllers, /function destroy\(\)/);
  assert.match(registry, /admin-access-contracts\.js[\s\S]+admin-access-repository\.js/);
  assert.match(registry, /id: "roles"[\s\S]+id: "users"[\s\S]+id: "audit"/);
});


test("administrative navigation, views and API share users:manage authority", () => {
  const navigation = read("js/workspace/navigation.js");
  const registry = read("js/workspace/feature-registry.js");
  const html = read("staff-dashboard.html");

  for (const viewId of ["usuarios", "roles", "auditoria"]) {
    assert.match(navigation, new RegExp(`#${viewId}[^\\n]+permission: "users:manage"`));
    assert.match(html, new RegExp(`id="${viewId}" data-permission-required="users:manage"`));
  }
  assert.match(registry, /id: "admin",[\s\S]+permission: "users:manage"/);
  assert.match(html, /data-access-modal data-permission-required="users:manage"/);
});
