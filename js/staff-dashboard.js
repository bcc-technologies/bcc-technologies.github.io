let staffCurrentUser = null;
let staffWorkspaceRouter = null;

const WORKSPACE_MODULE_BY_VIEW = {
  "science-radar": "intelligence",
  "product-intelligence": "analytics",
  "maps-licensing": "maps-licensing",
  "dominican-intelligence": "dominican-intelligence",
  "crm-correos": "prospectos"
};

document.addEventListener("DOMContentLoaded", async () => {
  const user = await window.BCCAuth.requireAuth({ roles: ["staff", "admin"] });
  if (!user) return;
  staffCurrentUser = user;
  applyWorkspaceAccess(user);
  bindStaffWorkspaceRouter();

  runWorkspaceStep("usuario", () => hydrateUser(user));
  runWorkspaceStep("menú de cuenta", () => window.BCCWorkspaceAccount?.hydrateAccountMenu(user, { roleLabel: window.BCCWorkspaceUtils.roleLabel }));
  runWorkspaceStep("pestañas de operación", bindStaffWorkPanels);
  runWorkspaceStep("pestañas de inteligencia", bindIntelligencePanels);
  runWorkspaceStep("semántica de pestañas", enhanceWorkspaceTabs);
  runWorkspaceStep("simulador de acceso", () => bindAdminViewSimulator(user));
  runWorkspaceStep("perfil", () => window.BCCWorkspaceAccount?.hydrateProfileForm(user, { onUserUpdate: updateAccountUser }));
  runWorkspaceStep("correos", () => window.BCCWorkspaceAccount?.bindEmailManager(user, { onUserUpdate: updateAccountUser }));
  runWorkspaceStep("permisos", () => window.BCCWorkspaceAccount?.renderPermissions(user, {
    permissionLabel: permission => window.BCCWorkspaceUtils.permissionLabel(permission)
  }));
  runWorkspaceStep("notificaciones", () => window.BCCWorkspaceNotifications?.init(user));
  runWorkspaceStep("productividad", () => window.BCCWorkspaceProductivity?.init(user));
  runWorkspaceStep("calendario", () => window.BCCWorkspaceCalendar?.init(user));
  runWorkspaceStep("formularios", () => window.BCCWorkspaceForms?.init(user));
  await runWorkspaceAsyncStep("administración", () => window.BCCWorkspaceAdmin?.init(user, { bindRouter: false }));
  runWorkspaceStep("licencias", () => window.BCCWorkspaceLicenses?.init(user));
  runWorkspaceStep("iconos", () => window.BCCWorkspaceUtils.refreshIcons());
});

function runWorkspaceStep(label, callback) {
  try {
    return callback();
  } catch (error) {
    console.error(`No se pudo inicializar ${label}.`, error);
    return null;
  }
}

async function runWorkspaceAsyncStep(label, callback) {
  try {
    return await callback();
  } catch (error) {
    console.error(`No se pudo inicializar ${label}.`, error);
    return null;
  }
}

function hydrateUser(user) {
  const staffRoles = Array.isArray(user.staffRoles) ? user.staffRoles : [];
  const departments = Array.isArray(user.departments) ? user.departments : [];
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  const cmsEnabled = canAccess(user, "cms:access");
  document.querySelectorAll("[data-user-name]").forEach(el => { el.textContent = user.displayName || user.name; });
  document.querySelectorAll("[data-user-email]").forEach(el => { el.textContent = user.email; });
  document.querySelectorAll("[data-user-role]").forEach(el => { el.textContent = window.BCCWorkspaceUtils.roleLabel(user.role); });
  document.querySelectorAll("[data-user-company]").forEach(el => { el.textContent = user.company || "Sin compañía registrada"; });
  window.BCCWorkspaceUtils.setText("[data-staff-role-count]", staffRoles.length);
  window.BCCWorkspaceUtils.setText("[data-staff-role-summary]", window.BCCWorkspaceUtils.labelsFor(staffRoles, window.BCCWorkspaceUtils.STAFF_ROLE_OPTIONS, { unique: false }) || "Sin asignación");
  window.BCCWorkspaceUtils.setText("[data-department-count]", departments.length);
  window.BCCWorkspaceUtils.setText("[data-department-summary]", window.BCCWorkspaceUtils.labelsFor(departments, window.BCCWorkspaceUtils.DEPARTMENT_OPTIONS, { unique: false }) || "Sin asignación");
  window.BCCWorkspaceUtils.setText("[data-cms-status]", cmsEnabled ? "Activo" : "No");
  const cmsPill = document.querySelector("[data-cms-pill]");
  if (cmsPill) {
    cmsPill.textContent = cmsEnabled ? "CMS habilitado" : "CMS no asignado";
    cmsPill.classList.toggle("enabled", cmsEnabled);
  }
  window.BCCWorkspaceUtils.setText("[data-cms-description]", cmsEnabled ? "Tienes permisos para crear y administrar contenido." : "Necesitas un rol autorizado para ingresar.");
}

function bindStaffWorkspaceRouter() {
  if (!window.BCCWorkspaceRouter?.bind) {
    console.error("No se pudo cargar el router del workspace.");
    activateWorkspaceFallback();
    return null;
  }
  const routes = window.BCCWorkspaceNavigation?.routes?.staff || {};
  try {
  staffWorkspaceRouter = window.BCCWorkspaceRouter.bind({
    ...routes,
    onShow({ nextId, panelId, activeView }) {
      if (nextId === "trabajo") {
        openStaffWorkPanel(panelId || "tareas");
        return;
      }
      if (activeView?.querySelector("[data-intel-panel]")) openIntelligencePanel(activeView, panelId);
      initializeWorkspaceView(nextId);
    }
  });
  } catch (error) {
    console.error("No se pudo inicializar el router del workspace.", error);
    activateWorkspaceFallback();
    return null;
  }
  if (!staffWorkspaceRouter) activateWorkspaceFallback();
  else document.body.dataset.workspaceRouterState = "ready";
  return staffWorkspaceRouter;
}

function activateWorkspaceFallback(viewId = "resumen") {
  const views = [...document.querySelectorAll("[data-workspace-view]")];
  const target = views.find(view => view.id === viewId) || views[0];
  views.forEach(view => {
    view.hidden = view !== target;
  });
  document.querySelectorAll('.workspace-nav a[href^="#"]').forEach(link => {
    const active = link.getAttribute("href") === `#${target?.id || viewId}`;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  const title = document.querySelector("[data-workspace-view-title]");
  if (title && target?.dataset.viewTitle) title.textContent = target.dataset.viewTitle;
  document.body.dataset.workspaceRouterState = "fallback";
  return target || null;
}

function bindStaffWorkPanels() {
  document.querySelectorAll("[data-work-panel-tab]").forEach(tab => {
    tab.addEventListener("click", () => {
      const panelId = tab.dataset.workPanelTab || "tareas";
      if (staffWorkspaceRouter) staffWorkspaceRouter.navigate("trabajo", { panelId });
      else openStaffWorkPanel(panelId);
    });
  });
}

function bindIntelligencePanels() {
  document.querySelectorAll("[data-intel-panel-tab]").forEach(tab => {
    tab.addEventListener("click", () => {
      const view = tab.closest("[data-workspace-view]");
      const panelId = tab.dataset.intelPanelTab;
      if (staffWorkspaceRouter) staffWorkspaceRouter.navigate(view?.id, { panelId });
      else openIntelligencePanel(view, panelId);
    });
  });
}

function enhanceWorkspaceTabs() {
  document.querySelectorAll(".staff-work-tabs[role=\"tablist\"]").forEach(tablist => {
    const scope = tablist.closest("[data-workspace-view]");
    const tabs = [...tablist.querySelectorAll("button")];
    tabs.forEach((tab, index) => {
      const isWorkTab = Boolean(tab.dataset.workPanelTab);
      const panelId = tab.dataset.workPanelTab || tab.dataset.intelPanelTab || "";
      const panelSelector = isWorkTab ? `[data-work-panel="${panelId}"]` : `[data-intel-panel="${panelId}"]`;
      const panel = scope?.querySelector(panelSelector);
      const baseId = `${scope?.id || "workspace"}-${panelId || index}`;

      tab.id ||= `${baseId}-tab`;
      tab.setAttribute("role", "tab");
      tab.setAttribute("tabindex", tab.classList.contains("active") ? "0" : "-1");
      if (panel) {
        panel.id ||= `${baseId}-panel`;
        panel.setAttribute("role", "tabpanel");
        panel.setAttribute("aria-labelledby", tab.id);
        tab.setAttribute("aria-controls", panel.id);
      }

      tab.addEventListener("keydown", event => {
        const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
        if (!keys.includes(event.key)) return;
        event.preventDefault();
        const current = tabs.indexOf(tab);
        let next = current;
        if (event.key === "ArrowLeft") next = (current - 1 + tabs.length) % tabs.length;
        if (event.key === "ArrowRight") next = (current + 1) % tabs.length;
        if (event.key === "Home") next = 0;
        if (event.key === "End") next = tabs.length - 1;
        tabs[next]?.focus();
        tabs[next]?.click();
      });
    });
  });
}

function openStaffWorkPanel(panelId = "tareas") {
  const panels = [...document.querySelectorAll("[data-work-panel]")];
  const tabs = [...document.querySelectorAll("[data-work-panel-tab]")];
  const panel = panels.find(item => item.dataset.workPanel === panelId) || panels[0];
  if (!panel) return;

  panels.forEach(item => {
    const active = item === panel;
    item.hidden = !active;
    item.classList.toggle("active", active);
  });

  tabs.forEach(tab => {
    const active = tab.dataset.workPanelTab === panel.dataset.workPanel;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
    tab.setAttribute("tabindex", active ? "0" : "-1");
  });

  try {
    localStorage.setItem(`bcc_last_panel_${window.location.pathname}_trabajo`, panel.dataset.workPanel);
  } catch (e) {}

  window.BCCWorkspaceUtils.refreshIcons();
}


function openIntelligencePanel(view, panelId = "") {
  if (!view) return;
  const panels = [...view.querySelectorAll("[data-intel-panel]")];
  if (!panels.length) return;
  const tabs = [...view.querySelectorAll("[data-intel-panel-tab]")];
  const panel = panels.find(item => item.dataset.intelPanel === panelId) || panels[0];
  if (!panel) return;

  panels.forEach(item => {
    const active = item === panel;
    item.hidden = !active;
    item.classList.toggle("active", active);
  });

  tabs.forEach(tab => {
    const active = tab.dataset.intelPanelTab === panel.dataset.intelPanel;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
    tab.setAttribute("tabindex", active ? "0" : "-1");
  });

  try {
    localStorage.setItem(`bcc_last_panel_${window.location.pathname}_${view.id}`, panel.dataset.intelPanel);
  } catch (e) {}

  window.BCCWorkspaceUtils.refreshIcons();
}

function initializeWorkspaceView(viewId) {
  const moduleId = WORKSPACE_MODULE_BY_VIEW[viewId] || viewId;
  window.BCCWorkspaceAdmin?.initializeWorkspaceModule?.(moduleId, staffCurrentUser);
}

function bindAdminViewSimulator(user) {
  const select = document.querySelector("[data-admin-preview-mode]");
  if (!select || !canAccess(user, "admin:view")) return;
  select.addEventListener("change", () => {
    const previewUser = previewUserForMode(user, select.value);
    applyWorkspaceAccess(previewUser, { preview: true });
    ensureVisibleWorkspaceView(previewUser);
    window.BCCWorkspaceUtils.refreshIcons();
  });
}

function previewUserForMode(user, mode) {
  const base = { ...user, role: "staff", staffRoles: [], departments: [], customRoles: [], permissions: [] };
  if (mode === "admin") return user;
  if (mode === "author") {
    base.staffRoles = ["author"];
    base.permissions = ["dashboard:view", "staff:view", "profile:update", "downloads:view", "support:create", "clients:view", "content:view", "content:write", "cms:access"];
    return base;
  }
  if (mode === "director") {
    base.staffRoles = ["department_director"];
    base.departments = ["operations"];
    base.permissions = ["dashboard:view", "staff:view", "profile:update", "downloads:view", "support:create", "clients:view", "content:view", "content:write", "cms:access", "department:manage", "forms:manage", "department:operations"];
    return base;
  }
  base.permissions = ["dashboard:view", "staff:view", "profile:update", "downloads:view", "support:create", "clients:view", "content:view"];
  return base;
}

function ensureVisibleWorkspaceView(user) {
  const current = document.querySelector(".workspace-view:not([hidden])");
  const required = current?.dataset.permissionRequired;
  if (current && (!required || canAccess(user, required))) return;
  if (staffWorkspaceRouter?.navigate) staffWorkspaceRouter.navigate("resumen", { replace: true });
  else activateWorkspaceFallback();
}

function updateAccountUser(user) {
  hydrateUser(user);
  window.BCCWorkspaceAccount?.hydrateAccountMenu(user, { roleLabel: window.BCCWorkspaceUtils.roleLabel });
}
function applyWorkspaceAccess(user, options = {}) {
  const previewMode = Boolean(options.preview);
  const realAdmin = canAccess(staffCurrentUser || user, "admin:view");
  document.body.classList.toggle("admin-workspace", realAdmin && canAccess(user, "admin:view"));
  document.querySelectorAll("[data-permission-required]").forEach(el => {
    const isWorkspaceView = el.matches("[data-workspace-view]");
    if (canAccess(user, el.dataset.permissionRequired)) {
      el.dataset.accessAllowed = "true";
      if (!isWorkspaceView) el.hidden = false;
      return;
    }
    delete el.dataset.accessAllowed;
    if (!previewMode && !realAdmin && isWorkspaceView) {
      el.remove();
      return;
    }
    el.hidden = true;
  });
}

function canAccess(user, permission) {
  if (!permission) return true;
  if (user?.role === "admin") return true;
  return Array.isArray(user?.permissions) && user.permissions.includes(permission);
}
