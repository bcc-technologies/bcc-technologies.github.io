document.addEventListener("DOMContentLoaded", async () => {
  const user = await window.BCCAuth.requireAuth({ roles: ["client"] });
  if (!user) return;

  hydrateUser(user);
  hydrateAccountMenu(user);
  bindWorkspaceMenu();
  hydrateProfileForm(user);
  renderPermissions(user);
  refreshIcons();
});

function hydrateUser(user) {
  document.querySelectorAll("[data-user-name]").forEach(el => { el.textContent = user.displayName || user.name; });
  document.querySelectorAll("[data-user-email]").forEach(el => { el.textContent = user.email; });
  document.querySelectorAll("[data-user-role]").forEach(el => { el.textContent = roleLabel(user.role); });
  document.querySelectorAll("[data-user-company]").forEach(el => { el.textContent = user.company || "Sin compania registrada"; });
  const completed = [user.name, user.email, user.company, user.title].filter(Boolean).length;
  document.querySelectorAll("[data-profile-completion]").forEach(el => { el.textContent = `${completed}/4`; });
}

function hydrateAccountMenu(user) {
  const display = user.displayName || user.name || "Cuenta";
  document.querySelectorAll("[data-user-menu-name]").forEach(el => { el.textContent = display; });
  document.querySelectorAll("[data-user-menu-role]").forEach(el => { el.textContent = roleLabel(user.role); });
  document.querySelectorAll("[data-user-initial]").forEach(el => { el.textContent = display.trim().charAt(0).toUpperCase() || "?"; });
  document.querySelectorAll("[data-dashboard-link]").forEach(el => { el.href = window.BCCAuth.routeForUser(user); });
  document.querySelectorAll("[data-admin-return]").forEach(el => { el.hidden = !user.permissions.includes("admin:view"); });
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
  const labels = user.permissions.map(permissionLabel).filter(Boolean);
  permissions.replaceChildren(...labels.map(label => {
    const li = document.createElement("li");
    li.textContent = label;
    return li;
  }));
}

function permissionLabel(permission) {
  return {
    "dashboard:view": "Panel de cuenta",
    "profile:update": "Actualizar perfil",
    "downloads:view": "Descargas",
    "support:create": "Solicitar soporte",
    "admin:view": "Administracion",
    "staff:view": "Vista personal",
    "cms:access": "CMS"
  }[permission] || "";
}

function roleLabel(role) {
  return { client: "Cliente", staff: "Personal", admin: "Administrador" }[role] || role;
}

function refreshIcons() {
  window.BCCWorkspaceIcons?.createIcons();
}
