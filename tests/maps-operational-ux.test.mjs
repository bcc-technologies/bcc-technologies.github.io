import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("staff MAP operations use filterable list-detail flows and focused layers", () => {
  const source = read("js/workspace/maps-licensing.js");

  assert.match(source, /data-map-license-query/);
  assert.match(source, /data-map-license-status-filter/);
  assert.match(source, /data-map-license-detail-dialog/);
  assert.match(source, /data-map-issue-license-form|data-issue-license-form/);
  assert.match(source, /data-map-cohort-list/);
  assert.match(source, /data-map-cohort-detail/);
  assert.match(source, /data-create-cohort/);
  assert.match(source, /data-invite-participant/);
  assert.match(source, /ui\.openLayer/);
  assert.match(source, /ui\.sectionHeader/);
  assert.match(source, /ui\.dataState/);
  assert.match(source, /data: \{ mapRefresh: true, mapControl: true \}/);
  assert.doesNotMatch(source, /\bconfirm\s*\(/);
});

test("MAP subpanels are canonical nested routes and react to router activation", () => {
  const navigation = read("js/workspace/navigation.js");
  const registry = read("js/workspace/feature-registry.js");
  const source = read("js/workspace/maps-licensing.js");

  assert.match(navigation, /"maps-licensing": \["summary", "licenses", "evaluations", "permissions", "analytics"\]/);
  assert.match(registry, /runtime\.mount\(\{/);
  assert.match(source, /function activate\(context = \{\}\)/);
  assert.match(source, /source: "router"/);
});

test("workspace layers centralize focus restoration and responsive drawer geometry", () => {
  const ui = read("js/workspace/ui/interactions.js");
  const sharedStyles = read("css/workspace/primitives/layers.css");
  const mapStyles = read("css/workspace/features/maps-licensing.css");

  assert.match(ui, /const layerTriggers = new WeakMap/);
  assert.match(ui, /function openLayer/);
  assert.match(ui, /previousTrigger\?\.isConnected/);
  assert.match(sharedStyles, /\.workspace-layer\.is-drawer/);
  assert.match(sharedStyles, /height: 100dvh/);
  assert.match(mapStyles, /\.maps-license-evaluation-layout/);
  assert.match(mapStyles, /\.maps-license-panel:not\(\[hidden\]\)\{ display: grid; gap: 16px; min-width: 0; \}/);
  assert.match(mapStyles, /\.maps-license-shell > \*\{ min-width: 0; \}/);
  assert.match(mapStyles, /\.maps-license-search \.workspace-icon/);
  assert.match(mapStyles, /@media \(max-width: 900px\)/);
});

test("client MAP dashboard keeps product and licenses in one compact product-led flow", () => {
  const source = read("js/workspace/client-map-licenses.js");
  const styles = read("css/workspace/features/client-licenses.css");

  assert.match(source, /function renderSuite/);
  assert.match(source, /client-license-suite/);
  assert.match(source, /function renderInternalAccess/);
  assert.match(source, /client-license-activity-disclosure/);
  assert.match(source, /ui\.sectionHeader/);
  assert.match(source, /ui\.emptyState/);
  assert.match(styles, /\.client-license-shell > \* \{ min-width: 0; \}/);
  assert.match(styles, /\.client-license-product-tabs\{/);
  assert.match(styles, /\.client-license-product-tab\[aria-selected="true"\]/);
  assert.match(styles, /\.client-license-product-panel\{/);
  assert.match(styles, /\.client-license-product-summary\{/);
  assert.match(styles, /\.client-license-offer-benefits\{/);
  assert.match(styles, /\.client-license-trial-offer\{/);
  assert.match(styles, /\.client-license-offer-assurance\{/);
  assert.doesNotMatch(styles, /\.client-license-(?:product-overview|product-context|product-icon|no-access|feature-list|trial-duration)/);
  assert.match(styles, /\.client-license-offer-card\{/);
  assert.match(styles, /\.client-license-attention \{ min-width: 0; display: grid;/);
  assert.match(styles, /\.client-license-activity-disclosure/);
  assert.match(styles, /\.client-license-activity-disclosure summary \.workspace-icon/);
  assert.match(styles, /\.client-license-offer-grid\{ display: grid; grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
  assert.match(styles, /\.client-license-offer-card:hover/);
  assert.match(styles, /\.client-license-secondary-disclosure/);
  assert.match(styles, /\.client-license-management-panel/);
  assert.match(styles, /\.client-license-request-form/);
  assert.match(source, /aria-labelledby="client-license-management-title"/);
  assert.match(source, /aria-labelledby="client-license-request-title"/);
  assert.match(source, /ui\.openLayer/);
  assert.match(source, /ui\.closeLayer/);
  assert.match(styles, /@media \(max-width: 700px\)/);
  assert.match(styles, /\.client-license-card-actions\{ display: grid; grid-template-columns: 1fr; \}/);
  assert.doesNotMatch(styles, /\.client-license-(?:commercial|marketplace|portfolio)/);
});
