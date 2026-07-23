import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createMapLicenseStore } from "../js/map-licenses-store.mjs";

const readSource = relative => fs.readFileSync(new URL(relative, import.meta.url), "utf8");

test("local license store validates, persists, and audits status changes", t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "bcc-map-licenses-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, "map-licenses.json");
  const store = createMapLicenseStore({ filePath });

  assert.throws(() => store.create({ organization: "", products: [] }, "actor"), /organización/i);
  assert.throws(() => store.create({
    organization: "Acme", contactEmail: "not-an-email", products: ["MAP-Nano"]
  }, "actor"), /correo/i);

  const created = store.create({
    organization: "Acme Labs",
    contactEmail: "ACCESS@ACME.EXAMPLE",
    products: ["MAP-Nano", "MAP-Bio", "MAP-Nano"],
    plan: "Equipo",
    seats: 8,
    status: "active",
    platform: "Web",
    startsAt: "2026-07-23",
    endsAt: "2027-07-23"
  }, "user_1");

  assert.equal(created.contactEmail, "access@acme.example");
  assert.deepEqual(created.products, ["MAP-Nano", "MAP-Bio"]);
  assert.equal(store.list().length, 1);

  const updated = store.setStatus(created.id, "suspended", "user_2");
  assert.equal(updated.status, "suspended");
  assert.equal(updated.events.at(-1).type, "license.status_changed");
  assert.equal(createMapLicenseStore({ filePath }).list()[0].status, "suspended");
});

test("browser and local server expose the same protected license contract", () => {
  const browserApi = readSource("../js/auth-map-licenses-api.js");
  const server = readSource("../accounts-server.mjs");
  const auth = readSource("../js/auth.js");
  const navigation = readSource("../js/workspace/navigation.js");

  for (const route of ["/api/admin/licenses", "/status"]) {
    assert.match(browserApi, new RegExp(route.replaceAll("/", "\\/")));
    assert.match(server, new RegExp(route.replaceAll("/", "\\/")));
  }
  for (const permission of ["licenses:view", "licenses:manage", "licenses:assign", "licenses:audit"]) {
    assert.match(auth, new RegExp(permission));
  }
  assert.match(navigation, /id: "licenses".+permission: "licenses:view"/s);
  assert.match(navigation, /href: "#usuarios".+permission: "admin:view"/);
});

test("Supabase license schema uses RLS, custom roles, and locked-down RPCs", () => {
  const sql = readSource("../resources/SUPABASE_MAP_LICENSES.sql");
  for (const table of ["map_licenses", "map_license_entitlements", "map_license_events"]) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
  }
  assert.match(sql, /workspace_role_definitions/);
  assert.match(sql, /profile\.custom_roles/);
  assert.match(sql, /create or replace function private\.has_license_permission/);
  assert.match(sql, /create or replace function public\.create_map_license[\s\S]+security invoker/);
  assert.match(sql, /revoke all on function public\.create_map_license\(jsonb\) from public, anon/);
  assert.match(sql, /grant execute on function public\.create_map_license\(jsonb\) to authenticated, service_role/);
});
