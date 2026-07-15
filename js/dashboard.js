document.addEventListener("DOMContentLoaded", async () => {
  const user = await window.BCCAuth.requireAuth({ roles: ["client"] });
  if (!user) return;

  hydrateUser(user);
  window.BCCWorkspaceAccount?.hydrateAccountMenu(user, { roleLabel: window.BCCWorkspaceUtils.roleLabel });
  bindCustomerWorkspaceRouter();
  window.BCCWorkspaceAccount?.hydrateProfileForm(user, { onUserUpdate: updateAccountUser });
  window.BCCWorkspaceAccount?.bindEmailManager(user, { onUserUpdate: updateAccountUser });
  window.BCCWorkspaceAccount?.renderPermissions(user, {
    permissionLabel: permission => window.BCCWorkspaceUtils.permissionLabel(permission)
  });
  window.BCCWorkspaceForms?.init(user);
  window.BCCWorkspaceClientMapLicenses?.init(user);
  window.BCCWorkspaceUtils.refreshIcons();
});

function hydrateUser(user) {
  document.querySelectorAll("[data-user-name]").forEach(el => { el.textContent = user.displayName || user.name; });
  document.querySelectorAll("[data-user-email]").forEach(el => { el.textContent = user.email; });
  document.querySelectorAll("[data-user-role]").forEach(el => { el.textContent = window.BCCWorkspaceUtils.roleLabel(user.role); });
  document.querySelectorAll("[data-user-company]").forEach(el => { el.textContent = user.company || "Sin compañía registrada"; });
  const completed = [user.name, user.email, user.company, user.title].filter(Boolean).length;
  document.querySelectorAll("[data-profile-completion]").forEach(el => { el.textContent = `${completed}/4`; });
}

function bindCustomerWorkspaceRouter() {
  window.BCCWorkspaceRouter?.bind({
    aliases: {
      perfil: "cuenta",
      seguridad: "cuenta",
      solicitudes: "operacion",
      formularios: "operacion",
      facturacion: "comercial",
      documentos: "comercial",
      map: "licencias",
      maps: "licencias"
    }
  });
}

function updateAccountUser(user) {
  hydrateUser(user);
  window.BCCWorkspaceAccount?.hydrateAccountMenu(user, { roleLabel: window.BCCWorkspaceUtils.roleLabel });
}
