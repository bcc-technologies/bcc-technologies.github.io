document.addEventListener("DOMContentLoaded", async () => {
  const user = await window.BCCAuth.requireAuth({ roles: ["client"] });
  if (!user) return;

  hydrateUser(user);
  hydrateAccountMenu(user);
  bindWorkspaceMenu();
  bindWorkspaceViews();
  hydrateProfileForm(user);
  bindEmailManager(user);
  renderPermissions(user);
  window.BCCWorkspaceForms?.init(user);
  refreshIcons();
});

function hydrateUser(user) {
  document.querySelectorAll("[data-user-name]").forEach(el => { el.textContent = user.displayName || user.name; });
  document.querySelectorAll("[data-user-email]").forEach(el => { el.textContent = user.email; });
  document.querySelectorAll("[data-user-role]").forEach(el => { el.textContent = roleLabel(user.role); });
  document.querySelectorAll("[data-user-company]").forEach(el => { el.textContent = user.company || "Sin compañía registrada"; });
  const completed = [user.name, user.email, user.company, user.title].filter(Boolean).length;
  document.querySelectorAll("[data-profile-completion]").forEach(el => { el.textContent = `${completed}/4`; });
}

async function bindEmailManager(user) {
  const list = document.querySelector("[data-account-emails]");
  const addForm = document.querySelector("[data-email-add-form]");
  const confirmForm = document.querySelector("[data-email-confirm-form]");
  if (!list) return;

  let emails = Array.isArray(user.emails) && user.emails.length ? user.emails : [{ id: "primary", email: user.email, primary: true, confirmed: true }];

  const setMessage = (text, tone = "ok") => {
    const message = document.querySelector("[data-email-message]");
    if (!message) return;
    message.textContent = text || "";
    message.dataset.tone = tone;
    message.hidden = !text;
  };

  const refresh = async () => {
    const data = await window.BCCAuth.api("/api/account/emails");
    emails = data.emails || [];
    renderAccountEmails(emails);
  };

  const renderAccountEmails = items => {
    if (!items.length) {
      list.innerHTML = `<p class="muted-text">No hay correos registrados.</p>`;
      return;
    }
    list.replaceChildren(...items.map(item => {
      const row = document.createElement("div");
      row.className = "account-email-row";
      row.dataset.emailId = item.id;

      const meta = document.createElement("div");
      meta.innerHTML = `
        <strong>${escapeHtml(item.email)}</strong>
        <span>${item.primary ? "Principal" : "Adicional"} · ${item.confirmed ? "Confirmado" : "Pendiente de confirmación"}</span>
      `;

      const actions = document.createElement("div");
      actions.className = "account-email-actions";
      if (!item.primary && item.confirmed) {
        const primaryButton = document.createElement("button");
        primaryButton.type = "button";
        primaryButton.className = "btn btn-ghost";
        primaryButton.dataset.emailPrimary = item.id;
        primaryButton.textContent = "Hacer principal";
        actions.append(primaryButton);
      }
      if (!item.primary) {
        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "btn btn-ghost";
        deleteButton.dataset.emailDelete = item.id;
        deleteButton.textContent = "Eliminar";
        actions.append(deleteButton);
      }
      row.append(meta, actions);
      return row;
    }));
    refreshIcons();
  };

  list.addEventListener("click", async event => {
    const primaryButton = event.target.closest("[data-email-primary]");
    const deleteButton = event.target.closest("[data-email-delete]");
    if (!primaryButton && !deleteButton) return;
    setMessage("");
    try {
      if (primaryButton) {
        const data = await window.BCCAuth.api(`/api/account/emails/${encodeURIComponent(primaryButton.dataset.emailPrimary)}/primary`, { method: "PATCH" });
        if (data.user) {
          hydrateUser(data.user);
          hydrateAccountMenu(data.user);
        }
        emails = data.emails || emails;
        renderAccountEmails(emails);
        setMessage(data.pendingAuthConfirmation ? "Revisa tu correo para completar el cambio del correo principal." : "Correo principal actualizado.");
      }
      if (deleteButton) {
        const data = await window.BCCAuth.api(`/api/account/emails/${encodeURIComponent(deleteButton.dataset.emailDelete)}`, { method: "DELETE" });
        emails = data.emails || emails;
        renderAccountEmails(emails);
        setMessage("Correo eliminado.");
      }
    } catch (error) {
      setMessage(error.message, "error");
    }
  });

  addForm?.addEventListener("submit", async event => {
    event.preventDefault();
    setMessage("");
    try {
      const data = await window.BCCAuth.api("/api/account/emails", {
        method: "POST",
        body: JSON.stringify({ email: addForm.elements.email.value })
      });
      emails = data.emails || emails;
      renderAccountEmails(emails);
      if (confirmForm?.elements.email) confirmForm.elements.email.value = addForm.elements.email.value;
      addForm.reset();
      setMessage("Correo agregado. Revisa ese buzón para obtener el código de confirmación.");
    } catch (error) {
      setMessage(error.message, "error");
    }
  });

  confirmForm?.addEventListener("submit", async event => {
    event.preventDefault();
    setMessage("");
    try {
      const data = await window.BCCAuth.api("/api/account/emails/confirm", {
        method: "POST",
        body: JSON.stringify({
          email: confirmForm.elements.email.value,
          token: confirmForm.elements.token.value
        })
      });
      emails = data.emails || emails;
      renderAccountEmails(emails);
      confirmForm.reset();
      setMessage("Correo confirmado.");
    } catch (error) {
      setMessage(error.message, "error");
    }
  });

  renderAccountEmails(emails);
  refresh().catch(error => setMessage(error.message, "error"));
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = String(value || "");
  return div.innerHTML;
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

function bindWorkspaceViews() {
  const views = [...document.querySelectorAll("[data-workspace-view]")];
  if (!views.length) return;

  const links = [...document.querySelectorAll('.workspace-nav a[href^="#"], .workspace-main a[href^="#"]')];
  const sidebarLinks = [...document.querySelectorAll('.workspace-nav a[href^="#"]')];
  const title = document.querySelector("[data-workspace-view-title]");
  const viewIds = new Set(views.map(view => view.id));
  const viewAliases = {
    perfil: "cuenta",
    seguridad: "cuenta",
    solicitudes: "operacion",
    formularios: "operacion",
    facturacion: "comercial",
    documentos: "comercial"
  };

  const canonicalViewId = id => viewAliases[id] || id;

  const showView = id => {
    const requestedId = canonicalViewId(id);
    const nextId = viewIds.has(requestedId) ? requestedId : "resumen";
    views.forEach(view => {
      view.hidden = view.id !== nextId;
    });
    sidebarLinks.forEach(link => {
      link.classList.toggle("active", link.getAttribute("href") === `#${nextId}`);
    });
    const activeView = views.find(view => view.id === nextId);
    if (title && activeView?.dataset.viewTitle) title.textContent = activeView.dataset.viewTitle;
    document.querySelector(".workspace-content")?.scrollTo({ top: 0, behavior: "auto" });
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  links.forEach(link => {
    link.addEventListener("click", event => {
      const id = link.getAttribute("href").slice(1);
      const nextId = canonicalViewId(id);
      if (!viewIds.has(nextId)) return;
      event.preventDefault();
      if (window.location.hash !== `#${nextId}`) {
        window.history.pushState(null, "", `#${nextId}`);
      }
      showView(nextId);
      document.body.classList.remove("workspace-nav-open");
    });
  });

  window.addEventListener("popstate", () => showView(window.location.hash.slice(1)));
  showView(window.location.hash.slice(1));
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
    "forms:manage": "Gestionar formularios",
    "admin:view": "Administración",
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
