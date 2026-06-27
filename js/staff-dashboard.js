document.addEventListener("DOMContentLoaded", async () => {
  const user = await window.BCCAuth.requireAuth({ roles: ["staff", "admin"] });
  if (!user) return;

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
  window.BCCWorkspaceForms?.init(user);
  window.BCCWorkspaceUtils.refreshIcons();
});

function hydrateUser(user) {
  const staffRoles = Array.isArray(user.staffRoles) ? user.staffRoles : [];
  const departments = Array.isArray(user.departments) ? user.departments : [];
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  const cmsEnabled = permissions.includes("cms:access");
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
    }
  });
}

function bindStaffWorkPanels() {
  document.querySelectorAll("[data-work-panel]").forEach(panel => {
    panel.addEventListener("toggle", () => {
      if (!panel.open) return;
      document.querySelectorAll("[data-work-panel]").forEach(other => {
        if (other !== panel) other.open = false;
      });
      window.BCCWorkspaceUtils.refreshIcons();
    });
  });
}

function openStaffWorkPanel(panelId = "tareas") {
  const panels = [...document.querySelectorAll("[data-work-panel]")];
  const panel = panels.find(item => item.dataset.workPanel === panelId);
  if (!panel) return;
  panels.forEach(item => {
    item.open = item === panel;
  });
  window.BCCWorkspaceUtils.refreshIcons();
}

function updateAccountUser(user) {
  hydrateUser(user);
  window.BCCWorkspaceAccount?.hydrateAccountMenu(user, { roleLabel: window.BCCWorkspaceUtils.roleLabel });
}
