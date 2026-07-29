import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { WORKSPACE_DASHBOARD_ASSETS } from "../scripts/workspace-assets.manifest.mjs";

const root = new URL("../", import.meta.url);
const read = relativePath => fs.readFileSync(new URL(relativePath, root), "utf8");

test("workspace assets are reproducible, versioned, and generated from the canonical manifest", () => {
  const build = spawnSync(process.execPath, ["scripts/build-workspace-assets.mjs", "--check"], {
    cwd: root,
    encoding: "utf8"
  });
  const locales = spawnSync(process.execPath, ["scripts/render-workspace-locale-pages.mjs", "--check"], {
    cwd: root,
    encoding: "utf8"
  });

  assert.equal(build.status, 0, build.stderr);
  assert.equal(locales.status, 0, locales.stderr);

  const compiledManifest = JSON.parse(read("assets/workspace/manifest.json"));
  for (const [role, dashboard] of Object.entries(WORKSPACE_DASHBOARD_ASSETS)) {
    const html = read(dashboard.page);
    const bundle = read(dashboard.scriptFile);
    const css = read(dashboard.cssFile);
    const versions = compiledManifest.bundles[role];

    assert.match(html, new RegExp(`${dashboard.cssFile.replaceAll("/", "\\/").replaceAll(".", "\\.")}\\?v=${versions.css.version}`));
    assert.match(html, new RegExp(`${dashboard.scriptFile.replaceAll("/", "\\/").replaceAll(".", "\\.")}\\?v=${versions.javascript.version}`));
    assert.match(html, /@supabase\/supabase-js@2\.110\.8/);
    assert.doesNotMatch(html, /src="js\/(?:auth|dashboard|staff-dashboard|workspace)\//);
    assert.doesNotMatch(css, /@import/);

    const sourceOrder = dashboard.scripts.map(source => bundle.indexOf(`/* Source: ${source} */`));
    assert.ok(sourceOrder.every(index => index >= 0), `${role} bundle is missing a declared source`);
    assert.deepEqual(sourceOrder, [...sourceOrder].sort((left, right) => left - right));
  }
});
