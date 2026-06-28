let staffCurrentUser = null;

document.addEventListener("DOMContentLoaded", async () => {
  const user = await window.BCCAuth.requireAuth({ roles: ["staff", "admin"] });
  if (!user) return;
  staffCurrentUser = user;
  applyWorkspaceAccess(user);

  hydrateUser(user);
  window.BCCWorkspaceAccount?.hydrateAccountMenu(user, { roleLabel: window.BCCWorkspaceUtils.roleLabel });
  bindStaffWorkPanels();
  bindStaffWorkspaceRouter();
  window.BCCWorkspaceAccount?.hydrateProfileForm(user, { onUserUpdate: updateAccountUser });
  window.BCCWorkspaceAccount?.bindEmailManager(user, { onUserUpdate: updateAccountUser });
  window.BCCWorkspaceAccount?.renderPermissions(user, {
    permissionLabel: permission => window.BCCWorkspaceUtils.permissionLabel(permission)
  });
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
  const panelAliases = { productividad: "tareas", calendario: "agenda", formularios: "formularios" };
  window.BCCWorkspaceRouter?.bind({
    aliases: { productividad: "trabajo", calendario: "trabajo", formularios: "trabajo" },
    panelAliases,
    onShow({ nextId, panelId }) {
      if (nextId === "trabajo") openStaffWorkPanel(panelId || "tareas");
      window.BCCWorkspaceAdmin?.initializeWorkspaceModule?.(nextId, staffCurrentUser);
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

function updateAccountUser(user) {
  hydrateUser(user);
  window.BCCWorkspaceAccount?.hydrateAccountMenu(user, { roleLabel: window.BCCWorkspaceUtils.roleLabel });
}
function applyWorkspaceAccess(user) {
  document.body.classList.toggle("admin-workspace", canAccess(user, "admin:view"));
  document.querySelectorAll("[data-permission-required]").forEach(el => {
    if (canAccess(user, el.dataset.permissionRequired)) return;
    if (el.matches("[data-workspace-view]")) {
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
