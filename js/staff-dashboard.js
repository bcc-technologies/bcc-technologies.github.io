document.addEventListener("DOMContentLoaded", async () => {
  const user = await window.BCCAuth.requireAuth({ roles: ["staff"] });
  if (!user) return;

  hydrateUser(user);
  hydrateAccountMenu(user);
  bindWorkspaceMenu();
  hydrateProfileForm(user);
  renderPermissions(user);
  refreshIcons();
});

function hydrateUser(user) {
  const staffRoles = Array.isArray(user.staffRoles) ? user.staffRoles : [];
  const departments = Array.isArray(user.departments) ? user.departments : [];
  const cmsEnabled = user.permissions.includes("cms:access");
  document.querySelectorAll("[data-user-name]").forEach(el => { el.textContent = user.displayName || user.name; });
  document.querySelectorAll("[data-user-email]").forEach(el => { el.textContent = user.email; });
  document.querySelectorAll("[data-user-role]").forEach(el => { el.textContent = roleLabel(user.role); });
  document.querySelectorAll("[data-user-company]").forEach(el => { el.textContent = user.company || "Sin compania registrada"; });
  setText("[data-staff-role-count]", staffRoles.length);
  setText("[data-staff-role-summary]", labelsFor(staffRoles, staffRoleOptions()) || "Sin asignacion");
  setText("[data-department-count]", departments.length);
  setText("[data-department-summary]", labelsFor(departments, departmentOptions()) || "Sin asignacion");
  setText("[data-cms-status]", cmsEnabled ? "Activo" : "No");
  const cmsPill = document.querySelector("[data-cms-pill]");
  if (cmsPill) {
    cmsPill.textContent = cmsEnabled ? "CMS habilitado" : "CMS no asignado";
    cmsPill.classList.toggle("enabled", cmsEnabled);
  }
  setText("[data-cms-description]", cmsEnabled ? "Tienes permisos para crear y administrar contenido." : "Necesitas un rol autorizado para ingresar.");
}

function hydrateAccountMenu(user) {
  const display = user.displayName || user.name || "Cuenta";
  const hasAdmin = user.permissions.includes("admin:view");
  const hasCms = user.permissions.includes("cms:access");
  const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  document.querySelectorAll("[data-user-menu-name]").forEach(el => { el.textContent = display; });
  document.querySelectorAll("[data-user-menu-role]").forEach(el => { el.textContent = roleLabel(user.role); });
  document.querySelectorAll("[data-user-initial]").forEach(el => { el.textContent = display.trim().charAt(0).toUpperCase() || "?"; });
  document.querySelectorAll("[data-dashboard-link]").forEach(el => { el.href = window.BCCAuth.routeForUser(user); });
  document.querySelectorAll("[data-admin-return]").forEach(el => { el.hidden = !hasAdmin; });
  document.querySelectorAll("[data-cms-access]").forEach(el => { el.hidden = !isLocal || !hasCms; });
}

function bindWorkspaceMenu() {
  const menuButton = document.querySelector("[data-workspace-menu]");
  menuButton?.addEventListener("click", () => document.body.classList.toggle("workspace-nav-open"));
  document.querySelectorAll(".workspace-nav a, .workspace-sidebar-foot a").forEach(link => {
    link.addEventListener("click", () => document.body.classList.remove("workspace-nav-open"));
  });
}

function hydrateProfileForm(user) {
  const form = document.querySelector("[data-profile-form]");
  if (!form) return;
  form.elements.name.value = user.name || "";
  form.elements.company.value = user.company || "";
  form.elements.title.value = user.title || "";

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const message = document.querySelector("[data-profile-message]");
    try {
      const data = await window.BCCAuth.api("/api/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({
          name: form.elements.name.value,
          company: form.elements.company.value,
          title: form.elements.title.value
        })
      });
      hydrateUser(data.user);
      hydrateAccountMenu(data.user);
      if (message) {
        message.textContent = "Cambios guardados.";
        message.dataset.tone = "ok";
        message.hidden = false;
      }
    } catch (error) {
      if (message) {
        message.textContent = error.message;
        message.dataset.tone = "error";
        message.hidden = false;
      }
    }
  });
}

function renderPermissions(user) {
  const permissions = document.querySelector("[data-permissions]");
  if (!permissions) return;
  const labels = [...new Set(user.permissions.map(permissionLabel).filter(Boolean))];
  permissions.replaceChildren(...labels.map(label => {
    const li = document.createElement("li");
    li.textContent = label;
    return li;
  }));
}

function permissionLabel(permission) {
  return {
    "staff:view": "Area de personal",
    "profile:update": "Actualizar perfil",
    "clients:view": "Consulta de clientes",
    "content:view": "Ver contenido",
    "content:write": "Editar contenido",
    "cms:access": "Acceso CMS",
    "department:manage": "Gestion departamental",
    "strategy:view": "Estrategia",
    "admin:view": "Administracion"
  }[permission] || "";
}

function staffRoleOptions() {
  return [
    { value: "author", label: "Autor" },
    { value: "cofounder", label: "Cofounder" },
    { value: "department_director", label: "Director" }
  ];
}

function departmentOptions() {
  return [
    { value: "technology", label: "Tecnologia" },
    { value: "finance", label: "Finanzas" },
    { value: "operations", label: "Operaciones" },
    { value: "marketing", label: "Marketing" },
    { value: "hr", label: "Recursos humanos" }
  ];
}

function labelsFor(values, options) {
  const labels = new Map(options.map(option => [option.value, option.label]));
  return values.map(value => labels.get(value) || value).join(", ");
}

function setText(selector, text) {
  document.querySelectorAll(selector).forEach(el => { el.textContent = String(text); });
}

function roleLabel(role) {
  return { client: "Cliente", staff: "Personal", admin: "Administrador" }[role] || role;
}

function refreshIcons() {
  window.BCCWorkspaceIcons?.createIcons();
}
