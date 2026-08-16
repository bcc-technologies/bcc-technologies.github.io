let customerCurrentUser = null;
let customerEmailManagerBound = false;

const customerFeatureRegistry = window.BCCWorkspaceFeatureRegistry;
customerFeatureRegistry.register("client");

document.addEventListener("DOMContentLoaded", async () => {
  const user = await window.BCCAuth.requireAuth({ roles: ["client", "staff"] });
  if (!user) return;

  customerCurrentUser = user;
  hydrateUser(user);
  window.BCCWorkspaceAccount?.hydrateAccountMenu(user, { roleLabel: window.BCCWorkspaceUtils.roleLabel });
  bindCustomerWorkspaceRouter();
  window.BCCWorkspaceAccount?.hydrateProfileForm(user, { onUserUpdate: updateAccountUser });
  window.BCCWorkspaceAccount?.bindSecurityManager();
  window.BCCWorkspaceAccount?.renderPermissions(user, {
    permissionLabel: permission => window.BCCWorkspaceUtils.permissionLabel(permission)
  });
  window.BCCWorkspaceUtils.refreshIcons();
  document.body.dataset.workspaceReady = "true";
  window.performance?.mark?.("bcc:workspace-ready");
  window.BCCWorkspaceEvents.emit("workspaceReady", { scope: "client", viewId: "client" });
});

function hydrateUser(user) {
  document.querySelectorAll("[data-user-name]").forEach(el => { el.textContent = user.displayName || user.name; });
  document.querySelectorAll("[data-user-email]").forEach(el => { el.textContent = user.email; });
  document.querySelectorAll("[data-user-role]").forEach(el => { el.textContent = window.BCCWorkspaceUtils.roleLabel(user.role); });
  document.querySelectorAll("[data-user-company]").forEach(el => { el.textContent = user.company || (window.BCCWorkspaceI18n?.t?.("Sin compañía registrada") || "Sin compañía registrada"); });
  document.querySelectorAll("[data-setup-organization]").forEach(step => {
    const configured = Boolean(String(user.company || "").trim());
    step.classList.toggle("complete", configured);
    const status = step.querySelector("[data-setup-organization-status]");
    if (status) status.textContent = window.BCCWorkspaceI18n?.t?.(configured ? "Configurada" : "Opcional") || (configured ? "Configurada" : "Opcional");
  });
  const completed = [user.name, user.email, user.company, user.title].filter(Boolean).length;
  document.querySelectorAll("[data-profile-completion]").forEach(el => { el.textContent = `${completed}/4`; });
}

function bindCustomerWorkspaceRouter() {
  const routes = window.BCCWorkspaceNavigation?.routes?.client || {};
  window.BCCWorkspaceRouter?.bind({
    ...routes,
    onShow({ nextId }) {
      void initializeCustomerView(nextId);
    }
  });
}

async function initializeCustomerView(viewId) {
  try {
    if (viewId === "cuenta" && !customerEmailManagerBound) {
      customerEmailManagerBound = true;
      await window.BCCWorkspaceAccount?.bindEmailManager(customerCurrentUser, { onUserUpdate: updateAccountUser });
    }

    await customerFeatureRegistry.initializeView("client", viewId, {
      user: customerCurrentUser
    });
  } catch (error) {
    console.error(`No se pudo inicializar la vista ${viewId}.`, error);
  }
}

function updateAccountUser(user) {
  hydrateUser(user);
  window.BCCWorkspaceAccount?.hydrateAccountMenu(user, { roleLabel: window.BCCWorkspaceUtils.roleLabel });
}
