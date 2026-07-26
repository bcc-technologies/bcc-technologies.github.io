import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../js/workspace/ui.js", import.meta.url), "utf8");
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
})[character]);

function loadUi() {
  const window = {
    BCCWorkspaceUtils: {
      escapeHtml,
      setMessage() {},
      refreshIcons() {}
    }
  };
  vm.runInContext(source, vm.createContext({ window, document: {}, Number, String }), { filename: "ui.js" });
  return window.BCCWorkspaceUI;
}

test("workspace UI primitives escape dynamic metric and empty-state content", () => {
  const ui = loadUi();
  const metric = ui.metric({ label: "<Licencias>", value: 12, detail: "Activas & vigentes" });
  const empty = ui.emptyState({
    title: "<Sin datos>",
    description: "Cuenta & perfil",
    icon: "inbox",
    action: { href: "javascript:alert(1)", label: "<Abrir>", className: "btn-primary" }
  });

  assert.match(metric, /&lt;Licencias&gt;/);
  assert.match(metric, /Activas &amp; vigentes/);
  assert.doesNotMatch(metric, /<Licencias>/);
  assert.match(empty, /&lt;Sin datos&gt;/);
  assert.match(empty, /Cuenta &amp; perfil/);
  assert.match(empty, /href="#"/);
  assert.match(empty, /&lt;Abrir&gt;/);
  assert.doesNotMatch(empty, /javascript:/);
});

test("workspace status primitive exposes semantic tone and optional icon", () => {
  const ui = loadUi();
  const badge = ui.statusBadge({ label: "Vence pronto", status: "warning", icon: "calendar-clock" });

  assert.match(badge, /workspace-status-badge is-warning/);
  assert.match(badge, /data-lucide="calendar-clock"/);
  assert.match(badge, /Vence pronto/);
});
