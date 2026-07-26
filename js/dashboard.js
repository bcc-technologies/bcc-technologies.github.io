let customerCurrentUser = null;
let customerEmailManagerBound = false;

window.BCCWorkspaceLoader.register({
  operation: ["js/auth-workspace-api.js", "js/workspace/forms.js"],
  licenses: ["js/workspace/license-contracts.js", "js/workspace/client-map-licenses.js"]
});

document.addEventListener("DOMContentLoaded", async () => {
  const user = await window.BCCAuth.requireAuth({ roles: ["client"] });
  if (!user) return;

  customerCurrentUser = user;
  hydrateUser(user);
  window.BCCWorkspaceAccount?.hydrateAccountMenu(user, { roleLabel: window.BCCWorkspaceUtils.roleLabel });
  bindCustomerWorkspaceRouter();
  window.BCCWorkspaceAccount?.hydrateProfileForm(user, { onUserUpdate: updateAccountUser });
  window.BCCWorkspaceAccount?.renderPermissions(user, {
    permissionLabel: permission => window.BCCWorkspaceUtils.permissionLabel(permission)
  });
  window.BCCWorkspaceUtils.refreshIcons();
  document.body.dataset.workspaceReady = "true";
  window.performance?.mark?.("bcc:workspace-ready");
  document.dispatchEvent(new CustomEvent("bcc:workspace-ready", { detail: { viewId: "client" } }));
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
      return;
    }

    if (viewId === "operacion") {
      await window.BCCWorkspaceLoader.load("operation");
      window.BCCWorkspaceForms?.init(customerCurrentUser);
      return;
    }

    if (viewId === "licencias") {
      await window.BCCWorkspaceLoader.load("licenses");
      window.BCCWorkspaceClientMapLicenses?.init(customerCurrentUser);
    }
  } catch (error) {
    console.error(`No se pudo inicializar la vista ${viewId}.`, error);
  }
}

function updateAccountUser(user) {
  hydrateUser(user);
  window.BCCWorkspaceAccount?.hydrateAccountMenu(user, { roleLabel: window.BCCWorkspaceUtils.roleLabel });
}
