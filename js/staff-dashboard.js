let staffCurrentUser = null;

document.addEventListener("DOMContentLoaded", async () => {
  const user = await window.BCCAuth.requireAuth({ roles: ["staff", "admin"] });
  if (!user) return;
  staffCurrentUser = user;
  applyWorkspaceAccess(user);

  hydrateUser(user);
  window.BCCWorkspaceAccount?.hydrateAccountMenu(user, { roleLabel: window.BCCWorkspaceUtils.roleLabel });
  bindStaffWorkPanels();
  bindBusinessPanels();
  bindStaffWorkspaceRouter();
  bindAdminViewSimulator(user);
  window.BCCWorkspaceAccount?.hydrateProfileForm(user, { onUserUpdate: updateAccountUser });
  window.BCCWorkspaceAccount?.bindEmailManager(user, { onUserUpdate: updateAccountUser });
  window.BCCWorkspaceAccount?.renderPermissions(user, {
    permissionLabel: permission => window.BCCWorkspaceUtils.permissionLabel(permission)
  });
  window.BCCWorkspaceNotifications?.init(user);
  window.BCCWorkspaceProductivity?.init(user);
  window.BCCWorkspaceCalendar?.init(user);
  window.BCCWorkspaceForms?.init(user);
  await window.BCCWorkspaceAdmin?.init(user, { bindRouter: false });
  window.BCCWorkspaceUtils.refreshIcons();
});

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
  const panelAliases = {
    productividad: "tareas",
    calendario: "agenda",
    kpis: "kpis",
    formularios: "formularios",
    analytics: "analytics",
    intelligence: "intelligence",
    prospectos: "prospectos"
  };
  window.BCCWorkspaceRouter?.bind({
    aliases: {
      productividad: "trabajo",
      calendario: "trabajo",
      kpis: "trabajo",
      formularios: "trabajo",
      analytics: "business",
      intelligence: "business",
      prospectos: "business"
    },
    panelAliases,
    onShow({ nextId, panelId }) {
      if (nextId === "trabajo") openStaffWorkPanel(panelId || "tareas");
      if (nextId === "business") openBusinessPanel(panelId || "analytics");
      else window.BCCWorkspaceAdmin?.initializeWorkspaceModule?.(nextId, staffCurrentUser);
    }
  });
}

function bindStaffWorkPanels() {
  document.querySelectorAll("[data-work-panel-tab]").forEach(tab => {
    tab.addEventListener("click", () => {
      openStaffWorkPanel(tab.dataset.workPanelTab || "tareas");
    });
  });
}

function bindBusinessPanels() {
  document.querySelectorAll("[data-business-panel-tab]").forEach(tab => {
    tab.addEventListener("click", () => {
      openBusinessPanel(tab.dataset.businessPanelTab || "analytics");
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
  });

  window.BCCWorkspaceUtils.refreshIcons();
}


function openBusinessPanel(panelId = "analytics") {
  const panels = [...document.querySelectorAll("[data-business-panel]")];
  const tabs = [...document.querySelectorAll("[data-business-panel-tab]")];
  const panel = panels.find(item => item.dataset.businessPanel === panelId) || panels[0];
  if (!panel) return;

  panels.forEach(item => {
    const active = item === panel;
    item.hidden = !active;
    item.classList.toggle("active", active);
  });

  tabs.forEach(tab => {
    const active = tab.dataset.businessPanelTab === panel.dataset.businessPanel;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
  });

  window.BCCWorkspaceAdmin?.initializeWorkspaceModule?.(panel.dataset.businessPanel, staffCurrentUser);
  window.BCCWorkspaceUtils.refreshIcons();
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
  document.querySelector('.workspace-nav a[href="#resumen"]')?.click();
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
    if (canAccess(user, el.dataset.permissionRequired)) {
      el.hidden = false;
      return;
    }
    if (!previewMode && !realAdmin && el.matches("[data-workspace-view]")) {
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
