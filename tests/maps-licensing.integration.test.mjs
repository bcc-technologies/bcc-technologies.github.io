import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("staff dashboard wires the MAP licensing workspace behind canonical access", () => {
  const html = read("staff-dashboard.html");
  const navigation = read("js/workspace/navigation.js");
  const dashboard = read("js/staff-dashboard.js");

  assert.match(html, /data-maps-licensing-workspace/);
  assert.match(html, /id="maps-licensing" data-permission-required="platform\.licenses\.read"/);
  assert.match(html, /js\/workspace\/maps-licensing\.js/);
  assert.match(navigation, /#maps-licensing/);
  assert.match(dashboard, /"maps-licensing": "maps-licensing"/);
});

test("MAP licensing UI uses the separated platform administration API", () => {
  const moduleSource = read("js/workspace/maps-licensing.js");

  assert.match(moduleSource, /\/api\/admin\/platform\/licenses/);
  assert.match(moduleSource, /\/api\/admin\/platform\/evaluations\/cohorts/);
  assert.doesNotMatch(moduleSource, /\/api\/dev\/evaluations/);
  assert.match(moduleSource, /platform\.permissions\.manage/);
  assert.match(moduleSource, /platform\.analytics\.read/);
});

test("assignable MAP staff roles expose least-privilege local fallbacks", () => {
  const auth = read("js/auth.js");

  assert.match(auth, /maps_license_manager:\s*\["platform\.licenses\.read", "platform\.licenses\.manage", "platform\.evaluations\.manage", "platform\.analytics\.read"\]/);
  assert.match(auth, /maps_product_analyst:\s*\["platform\.licenses\.read", "platform\.analytics\.read"\]/);
  assert.match(auth, /maps_developer:\s*\["map\.dev\.access"/);
});
