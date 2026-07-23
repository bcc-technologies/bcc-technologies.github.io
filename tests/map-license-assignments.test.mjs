import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createMapLicenseStore } from "../js/map-licenses-store.mjs";

const readSource = relative => fs.readFileSync(new URL(relative, import.meta.url), "utf8");

test("seat assignments enforce operational status, uniqueness, and capacity", t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "bcc-map-seats-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const store = createMapLicenseStore({ filePath: path.join(directory, "licenses.json") });
  const license = store.create({
    organization: "Seat Lab",
    contactEmail: "access@seat.example",
    products: ["MAP-Nano"],
    plan: "Equipo",
    seats: 1,
    status: "draft",
    platform: "Web"
  }, "admin");

  assert.throws(() => store.assign(license.id, "user_1", "admin"), /activa|prueba|gracia/i);
  store.setStatus(license.id, "active", "admin");

  const assigned = store.assign(license.id, "user_1", "admin");
  assert.equal(assigned.license.usedSeats, 1);
  assert.equal(assigned.assignment.status, "active");
  assert.equal(store.listAssignments(license.id).length, 1);
  assert.throws(() => store.assign(license.id, "user_1", "admin"), /ya tiene/i);
  assert.throws(() => store.assign(license.id, "user_2", "admin"), /disponibles/i);

  const revoked = store.revoke(license.id, "user_1", "admin");
  assert.equal(revoked.license.usedSeats, 0);
  assert.equal(store.listAssignments(license.id).length, 0);
  assert.equal(revoked.license.events.at(-1).type, "license.seat_revoked");

  const reassigned = store.assign(license.id, "user_1", "admin");
  assert.equal(reassigned.license.usedSeats, 1);
  assert.equal(reassigned.assignment.id, assigned.assignment.id);
});

test("assignment contract is shared by UI, browser API, and local server", () => {
  const ui = readSource("../js/workspace/licenses.js");
  const browserApi = readSource("../js/auth-map-licenses-api.js");
  const server = readSource("../accounts-server.mjs");

  for (const marker of [
    "data-license-assignment-list",
    "data-assignment-dialog",
    "data-assign-user",
    "data-revoke-assignment"
  ]) {
    assert.match(ui, new RegExp(marker));
  }
  for (const route of ["assignable-users", "assignments"]) {
    assert.match(browserApi, new RegExp(route));
    assert.match(server, new RegExp(route));
  }
  assert.match(browserApi, /requirePermission\("licenses:assign"\)/);
  assert.match(server, /can\(user, "licenses:assign"\)/);
});

test("assignment SQL keeps privileged logic private and seat counts transactional", () => {
  const sql = readSource("../resources/SUPABASE_MAP_LICENSE_ASSIGNMENTS.sql");
  assert.match(sql, /alter table public\.map_license_assignments enable row level security/);
  assert.match(sql, /create or replace function private\.assign_map_license_user/);
  assert.match(sql, /create or replace function public\.assign_map_license_user[\s\S]+security invoker/);
  assert.match(sql, /for update/);
  assert.match(sql, /create trigger sync_map_license_used_seats/);
  assert.match(sql, /revoke all on public\.map_license_assignments from public, anon/);
});
