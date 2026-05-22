document.addEventListener("DOMContentLoaded", async () => {
  const user = await window.BCCAuth.requireAuth({ roles: ["staff"] });
  if (!user) return;

  document.querySelectorAll("[data-user-name]").forEach(el => { el.textContent = user.displayName || user.name; });
  document.querySelectorAll("[data-user-full-name]").forEach(el => { el.textContent = user.name; });
  document.querySelectorAll("[data-user-email]").forEach(el => { el.textContent = user.email; });
  document.querySelectorAll("[data-user-role]").forEach(el => { el.textContent = roleLabel(user.role); });
  document.querySelectorAll("[data-user-company]").forEach(el => { el.textContent = user.company || "Sin compania registrada"; });
  hydrateAccountMenu(user);
  hydrateProfileForm(user);

  const permissions = document.querySelector("[data-permissions]");
  if (permissions) {
    permissions.replaceChildren(...user.permissions.map(permission => {
      const li = document.createElement("li");
      li.textContent = permission;
      return li;
    }));
  }
});

function hydrateAccountMenu(user) {
  const display = user.displayName || user.name || "Cuenta";
  document.querySelectorAll("[data-user-menu-name]").forEach(el => { el.textContent = display; });
  document.querySelectorAll("[data-user-menu-role]").forEach(el => { el.textContent = roleLabel(user.role); });
  document.querySelectorAll("[data-user-initial]").forEach(el => { el.textContent = display.trim().charAt(0).toUpperCase() || "?"; });
  document.querySelectorAll("[data-dashboard-link]").forEach(el => { el.href = window.BCCAuth.routeForUser(user); });
  document.querySelectorAll("[data-admin-return]").forEach(el => { el.hidden = !user.permissions.includes("admin:view"); });
  document.querySelectorAll("[data-cms-access]").forEach(el => {
    const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
    el.hidden = !isLocal || !user.permissions.includes("cms:access");
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
      document.querySelectorAll("[data-user-name]").forEach(el => { el.textContent = data.user.displayName || data.user.name; });
      document.querySelectorAll("[data-user-full-name]").forEach(el => { el.textContent = data.user.name; });
      document.querySelectorAll("[data-user-company]").forEach(el => { el.textContent = data.user.company || "Sin compania registrada"; });
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

function roleLabel(role) {
  return { client: "Cliente", staff: "Personal", admin: "Administrador" }[role] || role;
}
