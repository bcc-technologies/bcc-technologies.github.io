import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const sources = [
  "ui/registry.js",
  "ui/foundation.js",
  "ui/content.js",
  "ui/states.js",
  "ui/interactions.js",
  "ui.js"
].map(file => [file, fs.readFileSync(new URL(`../js/workspace/${file}`, import.meta.url), "utf8")]);
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
  const context = vm.createContext({ window, document: {}, Number, String, Map, Set, Object, Array, TypeError, Error });
  sources.forEach(([file, source]) => vm.runInContext(source, context, { filename: file }));
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


test("workspace section headers expose structured, escaped actions and kebab-case data contracts", () => {
  const ui = loadUi();
  const header = ui.sectionHeader({
    eyebrow: "<MAP>",
    title: "Licencias & acceso",
    description: "Operación <segura>",
    level: 1,
    status: { label: "En vivo", status: "success", icon: "database" },
    actions: [{
      label: "Actualizar <ahora>",
      icon: "refresh-cw",
      data: { mapRefresh: true, mapControl: "primary" }
    }]
  });

  assert.match(header, /<h1>Licencias &amp; acceso<\/h1>/);
  assert.match(header, /&lt;MAP&gt;/);
  assert.match(header, /Operación &lt;segura&gt;/);
  assert.match(header, /workspace-status-badge is-success/);
  assert.match(header, /data-map-refresh/);
  assert.match(header, /data-map-control="primary"/);
  assert.match(header, /Actualizar &lt;ahora&gt;/);
});

test("workspace page context is optionally disclosed from the title", () => {
  const ui = loadUi();
  const header = ui.sectionHeader({
    title: "Operación",
    description: "Contexto <bajo demanda>",
    level: 1,
    collapsibleDescription: true
  });

  assert.match(header, /<details class="workspace-context">/);
  assert.match(header, /<summary><h1>Operación<\/h1><\/summary>/);
  assert.match(header, /Contexto &lt;bajo demanda&gt;/);
  assert.doesNotMatch(header, /workspace-context-label|chevron-down/);
});

test("workspace data, table and activity states preserve semantics and escape content", () => {
  const ui = loadUi();
  const error = ui.dataState({
    tone: "error",
    title: "Error <remoto>",
    description: "Red & permisos",
    action: { label: "Reintentar", data: { loadParticipants: "cohort<1>" } }
  });
  const row = ui.tableEmptyRow({ colspan: 0, title: "<Vacío>" });
  const activity = ui.activityItem({ title: "<Admin>", description: "Rol & acceso", meta: "<ahora>" });
  const loading = ui.loadingState({ lines: 99, title: "Cargando cuentas" });

  assert.match(error, /role="alert"/);
  assert.match(error, /data-load-participants="cohort&lt;1&gt;"/);
  assert.match(error, /Error &lt;remoto&gt;/);
  assert.match(row, /colspan="1"/);
  assert.match(row, /&lt;Vacío&gt;/);
  assert.match(activity, /&lt;Admin&gt;/);
  assert.match(activity, /Rol &amp; acceso/);
  assert.match(activity, /&lt;ahora&gt;/);
  assert.equal((loading.match(/<span><\/span>/g) || []).length, 6);
  assert.doesNotMatch(loading, /style=/);
  assert.match(loading, /role="status" aria-live="polite"/);
});


test("workspace progress primitive clamps values and exposes accessible native semantics", () => {
  const ui = loadUi();
  const progress = ui.progress({
    value: 140,
    label: "Plazas <ocupadas>",
    tone: "danger",
    className: "license-capacity"
  });

  assert.match(progress, /<progress/);
  assert.match(progress, /value="100"/);
  assert.match(progress, /workspace-progress is-danger license-capacity/);
  assert.match(progress, /aria-label="Plazas &lt;ocupadas&gt;"/);
  assert.doesNotMatch(progress, /style=/);
});
