import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const js = fs.readFileSync(new URL("../js/workspace/licenses.js", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../css/workspace/workspace-licenses.css", import.meta.url), "utf8");
test("licenses module models MAP products and remote session cache", () => {
  for (const product of ["MAP-Nano", "MAP-Bio", "MAP-Med", "MAP-Ing"]) assert.match(js, new RegExp(product));
  assert.match(js, /bcc-map-licenses:session-cache:v3/);
  assert.match(js, /\/api\/admin\/licenses/);
});
test("licenses UI includes filters, detail, creation and responsive states", () => {
  for (const marker of ["data-license-search", "data-license-detail", "data-license-form", "data-license-status"]) assert.match(js, new RegExp(marker));
  assert.match(css, /@media\(max-width:580px\)/);
  assert.match(css, /100dvh/);
});
