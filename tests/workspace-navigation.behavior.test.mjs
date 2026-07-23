import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const staffSource = fs.readFileSync(
  new URL("../js/staff-dashboard.js", import.meta.url),
  "utf8"
);

function createElement({ id = "", hidden = false, permission = "", view = false, href = "" } = {}) {
  const classes = new Set();
  const attributes = new Map(href ? [["href", href]] : []);
  return {
    id,
    hidden,
    removed: false,
    dataset: {
      ...(permission ? { permissionRequired: permission } : {}),
      ...(view ? { viewTitle: id || "Vista" } : {})
    },
    classList: {
      toggle(name, active) {
        if (active) classes.add(name);
        else classes.delete(name);
      },
      contains(name) {
        return classes.has(name);
      }
    },
    matches(selector) {
      return selector === "[data-workspace-view]" && view;
    },
    remove() {
      this.removed = true;
    },
    getAttribute(name) {
      return attributes.get(name) || null;
    },
    setAttribute(name, value) {
      attributes.set(name, String(value));
    },
    removeAttribute(name) {
      attributes.delete(name);
    }
  };
}

function createHarness() {
  const summary = createElement({ id: "resumen", view: true });
  const licenses = createElement({
    id: "licencias-maps",
    hidden: true,
    permission: "licenses:view",
    view: true
  });
  const users = createElement({
    id: "usuarios",
    hidden: true,
    permission: "admin:view",
    view: true
  });
  const summaryLink = createElement({ href: "#resumen" });
  const licensesLink = createElement({
    hidden: true,
    permission: "licenses:view",
    href: "#licencias-maps"
  });
  const usersLink = createElement({
    hidden: true,
    permission: "admin:view",
    href: "#usuarios"
  });
  const title = { textContent: "" };
  const views = [summary, licenses, users];
  const permissioned = [licenses, users, licensesLink, usersLink];
  const links = [summaryLink, licensesLink, usersLink];
  const bodyClasses = new Set();

  const document = {
    body: {
      dataset: {},
      classList: {
        toggle(name, active) {
          if (active) bodyClasses.add(name);
          else bodyClasses.delete(name);
        }
      }
    },
    addEventListener() {},
    querySelectorAll(selector) {
      if (selector === "[data-permission-required]") {
        return permissioned.filter(element => !element.removed);
      }
      if (selector === "[data-workspace-view]") {
        return views.filter(element => !element.removed);
      }
      if (selector === '.workspace-nav a[href^="#"]') return links;
      return [];
    },
    querySelector(selector) {
      if (selector === "[data-workspace-view-title]") return title;
      return null;
    }
  };

  const context = vm.createContext({
    document,
    window: { BCCWorkspaceNavigation: { routes: { staff: {} } } },
    console: { error() {} }
  });
  vm.runInContext(staffSource, context, { filename: "staff-dashboard.js" });

  return {
    context,
    document,
    elements: { summary, licenses, users, summaryLink, licensesLink, usersLink },
    visibleViews: () => views.filter(view => !view.removed && !view.hidden)
  };
}

test("permissions expose navigation without making every authorized view visible", () => {
  const harness = createHarness();
  vm.runInContext(
    `applyWorkspaceAccess({
      role: "staff",
      permissions: ["dashboard:view", "staff:view", "licenses:view"]
    })`,
    harness.context
  );

  assert.equal(harness.elements.licenses.hidden, true);
  assert.equal(harness.elements.licenses.dataset.accessAllowed, "true");
  assert.equal(harness.elements.licensesLink.hidden, false);
  assert.equal(harness.elements.users.removed, true);
  assert.deepEqual(harness.visibleViews().map(view => view.id), ["resumen"]);
});

test("missing router falls back to exactly one navigable workspace view", () => {
  const harness = createHarness();
  vm.runInContext(
    `applyWorkspaceAccess({
      role: "admin",
      permissions: ["admin:view", "licenses:view"]
    });
    bindStaffWorkspaceRouter();`,
    harness.context
  );

  assert.deepEqual(harness.visibleViews().map(view => view.id), ["resumen"]);
  assert.equal(harness.document.body.dataset.workspaceRouterState, "fallback");
  assert.equal(harness.elements.summaryLink.classList.contains("active"), true);
  assert.equal(harness.elements.summaryLink.getAttribute("aria-current"), "page");
});
