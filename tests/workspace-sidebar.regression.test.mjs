import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const sidebarCss = read("css/workspace/workspace-sidebar.css");
const experienceCss = read("css/workspace/workspace-shell-experience.css");
const navigationJs = read("js/workspace/navigation.js");
const shellJs = read("js/workspace/shell.js");
const routerJs = read("js/workspace/router.js");
const authJs = read("js/auth.js");
const staffDashboardJs = read("js/staff-dashboard.js");

test("sidebar rows keep full width while content and text stay left aligned", () => {
  assert.match(sidebarCss, /\.workspace-refined \.workspace-nav \.workspace-nav-item\s*\{[\s\S]*?width:\s*100%/);
  assert.match(sidebarCss, /\.workspace-refined \.workspace-nav \.workspace-nav-item\s*\{[\s\S]*?margin:\s*0/);
  assert.match(sidebarCss, /\.workspace-refined \.workspace-nav \.workspace-nav-item\s*\{[\s\S]*?justify-content:\s*flex-start/);
  assert.match(sidebarCss, /\.workspace-refined \.workspace-nav \.workspace-nav-item\s*\{[\s\S]*?text-align:\s*left/);
  assert.match(sidebarCss, /\.workspace-nav-item > span\s*\{[\s\S]*?flex:\s*1 1 auto/);
  assert.match(sidebarCss, /\.workspace-nav-item > span\s*\{[\s\S]*?text-align:\s*left/);
});

test("sidebar preserves tree guides independently from row geometry", () => {
  assert.match(sidebarCss, /--workspace-nav-guide-x:\s*8px/);
  assert.match(sidebarCss, /--workspace-nav-content-x:\s*12px/);
  assert.match(sidebarCss, /\.workspace-nav-children::before/);
  assert.match(sidebarCss, /\.workspace-nav-item::after/);
});

test("navigation groups expose disclosure semantics and keyboard controls", () => {
  assert.match(navigationJs, /aria-controls/);
  assert.match(navigationJs, /aria-expanded/);
  for (const key of ["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End"]) {
    assert.match(navigationJs, new RegExp(`"${key}"`));
  }
  assert.match(navigationJs, /bcc-workspace-nav:v\$\{STORAGE_VERSION\}/);
  assert.match(navigationJs, /scrollWidth > label\.clientWidth/);
});

test("mobile shell traps focus, restores it and uses dynamic viewport height", () => {
  assert.match(shellJs, /focusBeforeMobileNav/);
  assert.match(shellJs, /event\.key !== "Tab"/);
  assert.match(shellJs, /focusBeforeMobileNav\.focus/);
  assert.match(shellJs, /legacyCollapseKey/);
  assert.match(experienceCss, /body\.workspace-nav-open[\s\S]*?overflow:\s*hidden/);
  assert.match(experienceCss, /height:\s*calc\(100dvh - 64px\)/);
});

test("collapsed navigation exposes tooltips and an explicit expand state", () => {
  assert.match(navigationJs, /syncTooltips/);
  assert.match(navigationJs, /navGroupLabel/);
  assert.match(navigationJs, /setAttribute\("aria-label"/);
  assert.match(shellJs, /Expandir navegación/);
  assert.match(experienceCss, /\[data-workspace-collapse\]\.is-collapsed svg/);
  assert.match(sidebarCss, /\.workspace-collapsed \.workspace-nav-group \+ \.workspace-nav-group/);
});

test("workspace hashes survive normal authentication and auth callbacks remain isolated", () => {
  assert.match(authJs, /function isSupabaseAuthHash/);
  assert.match(authJs, /function isSupabaseAuthCallbackLocation/);
  assert.match(authJs, /if \(isSupabaseAuthCallbackLocation\(\)\)/);
  assert.doesNotMatch(authJs, /if \(location\.hash \|\| location\.search\.includes\("code="\)\)/);
});

test("router supports canonical nested routes and accessible current state", () => {
  assert.match(routerJs, /const parseRoute/);
  assert.match(routerJs, /const routeHash/);
  assert.match(routerJs, /const navigate/);
  assert.match(routerJs, /replaceState/);
  assert.match(routerJs, /pushState/);
  assert.match(routerJs, /aria-current/);
  assert.match(navigationJs, /trabajo:\s*\["tareas", "agenda", "kpis", "formularios"\]/);
  assert.match(navigationJs, /"product-intelligence":\s*\["website", "maps"\]/);
});

test("workspace subpanels implement tab semantics and keyboard navigation", () => {
  assert.match(staffDashboardJs, /enhanceWorkspaceTabs/);
  assert.match(staffDashboardJs, /setAttribute\("role", "tab"\)/);
  assert.match(staffDashboardJs, /setAttribute\("role", "tabpanel"\)/);
  assert.match(staffDashboardJs, /setAttribute\("aria-controls"/);
  assert.match(staffDashboardJs, /setAttribute\("aria-labelledby"/);
  for (const key of ["ArrowLeft", "ArrowRight", "Home", "End"]) {
    assert.match(staffDashboardJs, new RegExp(`"${key}"`));
  }
});
