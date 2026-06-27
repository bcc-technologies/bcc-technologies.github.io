document.addEventListener("DOMContentLoaded", async () => {
  const user = await window.BCCAuth.requireAuth({ roles: ["staff", "admin"] });
  if (!user) return;

  hydrateUser(user);
  hydrateAccountMenu(user);
  bindStaffWorkPanels();
  bindStaffWorkspaceRouter();
  hydrateProfileForm(user);
  bindEmailManager(user);
  renderPermissions(user);
  window.BCCWorkspaceProductivity?.init(user);
  window.BCCWorkspaceForms?.init(user);
  refreshIcons();
});

function hydrateUser(user) {
  const staffRoles = Array.isArray(user.staffRoles) ? user.staffRoles : [];
  const departments = Array.isArray(user.departments) ? user.departments : [];
  const cmsEnabled = user.permissions.includes("cms:access");
  document.querySelectorAll("[data-user-name]").forEach(el => { el.textContent = user.displayName || user.name; });
  document.querySelectorAll("[data-user-email]").forEach(el => { el.textContent = user.email; });
  document.querySelectorAll("[data-user-role]").forEach(el => { el.textContent = roleLabel(user.role); });
  document.querySelectorAll("[data-user-company]").forEach(el => { el.textContent = user.company || "Sin compañía registrada"; });
  setText("[data-staff-role-count]", staffRoles.length);
  setText("[data-staff-role-summary]", labelsFor(staffRoles, staffRoleOptions()) || "Sin asignación");
  setText("[data-department-count]", departments.length);
  setText("[data-department-summary]", labelsFor(departments, departmentOptions()) || "Sin asignación");
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
  document.querySelectorAll("[data-user-menu-name]").forEach(el => { el.textContent = display; });
  document.querySelectorAll("[data-user-menu-role]").forEach(el => { el.textContent = roleLabel(user.role); });
  document.querySelectorAll("[data-user-initial]").forEach(el => { el.textContent = display.trim().charAt(0).toUpperCase() || "?"; });
  document.querySelectorAll("[data-dashboard-link]").forEach(el => { el.href = window.BCCAuth.routeForUser(user); });
  document.querySelectorAll("[data-admin-return]").forEach(el => { el.hidden = !hasAdmin; });
  document.querySelectorAll("[data-cms-access]").forEach(el => { el.hidden = !hasCms; });
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
      refreshIcons();
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
  refreshIcons();
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
    "forms:manage": "Gestionar formularios",
    "department:manage": "Gestion departamental",
    "strategy:view": "Estrategia",
    "admin:view": "Administración"
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
    { value: "technology", label: "Tecnología" },
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
