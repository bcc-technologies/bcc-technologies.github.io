let adminUsers = [];
let adminAuditLogs = [];

document.addEventListener("DOMContentLoaded", async () => {
  const user = await window.BCCAuth.requireAuth({ admin: true });
  if (!user) return;
  window.BCCAdminCurrentUser = user;

  document.querySelectorAll("[data-user-menu-name]").forEach(el => { el.textContent = user.displayName || user.name; });
  document.querySelectorAll("[data-user-menu-role]").forEach(el => { el.textContent = roleLabel(user.role); });
  document.querySelectorAll("[data-user-initial]").forEach(el => { el.textContent = (user.displayName || user.name || "?").trim().charAt(0).toUpperCase(); });
  document.querySelectorAll("[data-dashboard-link]").forEach(el => { el.href = window.BCCAuth.routeForUser(user); });

  hydrateLocalCmsLinks();
  bindWorkspaceControls();
  bindWorkspaceViews();
  bindAccessModal();
  initializeWorkspaceModule("prospectos", user);
  initializeWorkspaceModule("analytics", user);
  initializeWorkspaceModule("productividad", user);
  initializeWorkspaceModule("formularios", user);
  refreshIcons();
  await Promise.all([loadUsers(), loadAuditLogs()]);
});

async function loadUsers() {
  const message = document.querySelector("[data-admin-message]");
  try {
    const { users } = await window.BCCAuth.api("/api/admin/users");
    adminUsers = users;
    renderUsers();
    renderMetrics();
  } catch (error) {
    if (message) message.textContent = error.message;
  }
}

async function loadAuditLogs() {
  const feed = document.querySelector("[data-audit-feed]");
  const message = document.querySelector("[data-audit-message]");
  if (!feed) return;
  try {
    const { logs } = await window.BCCAuth.api("/api/admin/access-audit");
    adminAuditLogs = logs;
    feed.replaceChildren(...logs.slice(0, 10).map(auditItem));
    if (message) {
      message.textContent = logs.length ? "Cambios de permisos registrados." : "Todavia no hay cambios registrados.";
    }
    const count = document.querySelector("[data-audit-count]");
    if (count) count.textContent = String(logs.length);
    renderMetrics();
  } catch (error) {
    if (message) message.textContent = error.message;
  }
}

function renderUsers() {
  const table = document.querySelector("[data-users-table]");
  const message = document.querySelector("[data-admin-message]");
  if (!table) return;
  const users = filteredUsers();
  if (!users.length) {
    const empty = document.createElement("tr");
    empty.innerHTML = `<td class="table-empty" colspan="5">No hay cuentas que coincidan con los filtros.</td>`;
    table.replaceChildren(empty);
  } else {
    table.replaceChildren(...users.map(userRow));
  }
  if (message) message.textContent = `${users.length} de ${adminUsers.length} cuenta(s).`;
  refreshIcons();
}

function filteredUsers() {
  const query = [...document.querySelectorAll("[data-user-search], [data-user-search-mobile]")]
    .map(input => String(input.value || "").trim().toLowerCase())
    .find(Boolean) || "";
  const role = document.querySelector("[data-role-filter]")?.value || "";
  const department = document.querySelector("[data-department-filter]")?.value || "";
  const cmsOnly = Boolean(document.querySelector("[data-cms-filter]")?.checked);
  return adminUsers.filter(user => {
    const activity = user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "sin acceso";
    const searchable = [user.name, user.email, user.company, user.title, roleLabel(user.role), activity].join(" ").toLowerCase();
    if (query && !searchable.includes(query)) return false;
    if (role && user.role !== role) return false;
    if (department && !(user.departments || []).includes(department)) return false;
    if (cmsOnly && !hasCmsAccess(user)) return false;
    return true;
  });
}

function renderMetrics() {
  setText("[data-metric-accounts]", adminUsers.length);
  setText("[data-metric-staff]", adminUsers.filter(user => user.role === "staff" || user.role === "admin").length);
  setText("[data-metric-cms]", adminUsers.filter(hasCmsAccess).length);
  setText("[data-metric-changes]", adminAuditLogs.length);
}

function userRow(user) {
  const departments = Array.isArray(user.departments) ? user.departments : [];
  const row = document.createElement("tr");
  row.innerHTML = `
    <td class="user-cell" data-label="Cuenta">
      <strong>${escapeHtml(user.name)}</strong>
      <span>${escapeHtml(user.email)}</span>
      <small>${escapeHtml(user.company || "Sin compañía")}</small>
    </td>
    <td data-label="Rol y área">
      <span class="role-badge role-${escapeHtml(user.role)}">${escapeHtml(roleLabel(user.role))}</span>
      ${chipList(departments, departmentOptions(), "Sin área")}
    </td>
    <td data-label="Acceso">
      <span class="access-state ${hasCmsAccess(user) ? "enabled" : ""}">
        ${hasCmsAccess(user) ? "CMS habilitado" : "Sin CMS"}
      </span>
      ${chipList(user.staffRoles || [], staffRoleOptions(), "Sin rol interno")}
    </td>
    <td class="activity-date" data-label="Última actividad">${user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "Sin acceso"}</td>
    <td class="table-action">
      <button class="btn btn-ghost btn-compact" type="button" data-edit-access>
        <i data-lucide="sliders-horizontal"></i>Editar
      </button>
    </td>
  `;
  row.querySelector("[data-edit-access]").addEventListener("click", () => openAccessModal(user));
  return row;
}

function auditItem(log) {
  const item = document.createElement("li");
  item.innerHTML = `
    <span class="activity-dot"></span>
    <div>
      <strong>${escapeHtml(log.actorEmail || "Administrador")}</strong>
      <p>${escapeHtml(shortAccessChange(log.beforeAccess, log.afterAccess))}</p>
      <small>${escapeHtml(log.targetEmail || "-")} · ${log.createdAt ? new Date(log.createdAt).toLocaleString() : "-"}</small>
    </div>
  `;
  return item;
}

function bindWorkspaceControls() {
  ["[data-user-search]", "[data-user-search-mobile]", "[data-role-filter]", "[data-department-filter]", "[data-cms-filter]"].forEach(selector => {
    const control = document.querySelector(selector);
    if (!control) return;
    control.addEventListener("input", renderUsers);
    control.addEventListener("change", renderUsers);
  });
  document.querySelectorAll("[data-quick-filter]").forEach(button => {
    button.addEventListener("click", () => applyQuickFilter(button.dataset.quickFilter));
  });
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

  const showView = id => {
    const nextId = viewIds.has(id) ? id : "resumen";
    views.forEach(view => {
      view.hidden = view.id !== nextId;
    });
    sidebarLinks.forEach(link => {
      link.classList.toggle("active", link.getAttribute("href") === `#${nextId}`);
    });
    const activeView = views.find(view => view.id === nextId);
    if (title && activeView?.dataset.viewTitle) title.textContent = activeView.dataset.viewTitle;
    initializeWorkspaceModule(nextId, window.BCCAdminCurrentUser);
    document.querySelector(".workspace-content")?.scrollTo({ top: 0, behavior: "auto" });
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  links.forEach(link => {
    link.addEventListener("click", event => {
      const id = link.getAttribute("href").slice(1);
      if (!viewIds.has(id)) return;
      event.preventDefault();
      if (window.location.hash !== `#${id}`) {
        window.history.pushState(null, "", `#${id}`);
      }
      showView(id);
      document.body.classList.remove("workspace-nav-open");
    });
  });

  window.addEventListener("popstate", () => showView(window.location.hash.slice(1)));
  showView(window.location.hash.slice(1));
}

function initializeWorkspaceModule(viewId, user) {
  if (!user) return;
  if (viewId === "prospectos") {
    mountWorkspaceModule({
      rootSelector: "[data-prospects-workspace]",
      module: window.BCCWorkspaceProspects,
      key: "prospectos",
      loadingText: "Cargando prospectos...",
      errorText: "No fue posible cargar el modulo de prospectos. Recarga la pagina."
    }, user);
    return;
  }

  if (viewId === "analytics") {
    mountWorkspaceModule({
      rootSelector: "[data-analytics-workspace]",
      module: window.BCCWorkspaceAnalytics,
      key: "analytics",
      loadingText: "Cargando analytics...",
      errorText: "No fue posible cargar el modulo de analytics. Recarga la pagina."
    }, user);
    return;
  }

  if (viewId === "productividad") {
    mountWorkspaceModule({
      rootSelector: "[data-productivity-workspace]",
      module: window.BCCWorkspaceProductivity,
      key: "productividad",
      loadingText: "Cargando productividad...",
      errorText: "No fue posible cargar el modulo de productividad. Recarga la pagina."
    }, user);
    return;
  }

  if (viewId === "formularios") {
    mountWorkspaceModule({
      rootSelector: "[data-forms-workspace]",
      module: window.BCCWorkspaceForms,
      key: "formularios",
      loadingText: "Cargando formularios...",
      errorText: "No fue posible cargar el modulo de formularios. Recarga la pagina."
    }, user);
  }
}

function mountWorkspaceModule(config, user) {
  const root = document.querySelector(config.rootSelector);
  if (!root) return;
  if (root.dataset.workspaceModuleReady === "true") return;

  if (!config.module?.init) {
    root.innerHTML = `<p class="muted-text">${escapeHtml(config.errorText)}</p>`;
    return;
  }

  if (!root.textContent.trim()) {
    root.innerHTML = `<p class="muted-text">${escapeHtml(config.loadingText)}</p>`;
  }

  try {
    config.module.init(user);
    root.dataset.workspaceModuleReady = "true";
  } catch (error) {
    console.error(`Failed to initialize workspace module: ${config.key}`, error);
    root.innerHTML = `<p class="muted-text">${escapeHtml(config.errorText)}</p>`;
  }
}

function applyQuickFilter(filter) {
  const roleFilter = document.querySelector("[data-role-filter]");
  const cmsFilter = document.querySelector("[data-cms-filter]");
  const departmentFilter = document.querySelector("[data-department-filter]");
  const userSearch = document.querySelector("[data-user-search]");
  const mobileSearch = document.querySelector("[data-user-search-mobile]");
  if (roleFilter) roleFilter.value = "";
  if (departmentFilter) departmentFilter.value = "";
  if (cmsFilter) cmsFilter.checked = false;
  if (userSearch) userSearch.value = "";
  if (mobileSearch) mobileSearch.value = "";

  if (filter === "admins" && roleFilter) roleFilter.value = "admin";
  if (filter === "cms" && cmsFilter) cmsFilter.checked = true;
  if (filter === "inactive") {
    if (userSearch) userSearch.value = "sin acceso";
    if (mobileSearch) mobileSearch.value = "sin acceso";
  }
  renderUsers();
}

function bindAccessModal() {
  const modal = document.querySelector("[data-access-modal]");
  if (!modal) return;
  modal.querySelectorAll("[data-access-modal-close]").forEach(button => {
    button.addEventListener("click", () => modal.close());
  });
  modal.querySelector("[data-access-modal-save]")?.addEventListener("click", saveAccessFromModal);
  modal.addEventListener("change", updateAccessPreview);
}

function openAccessModal(user) {
  const modal = document.querySelector("[data-access-modal]");
  if (!modal) return;
  const isSelfAdmin = window.BCCAdminCurrentUser?.id === user.id && user.role === "admin";
  modal.dataset.userId = user.id;
  modal.dataset.confirming = "false";
  const message = modal.querySelector("[data-access-modal-message]");
  if (message) {
    message.hidden = true;
    message.textContent = "";
  }
  modal.querySelector("[data-access-modal-user]").textContent = `${user.name} · ${user.email}`;
  hideAccessConfirmation(modal);
  const roleSelect = modal.querySelector("[data-modal-role-select]");
  roleSelect.innerHTML = ["client", "staff", "admin"]
    .map(role => `<option value="${role}" ${role === user.role ? "selected" : ""}>${roleLabel(role)}</option>`)
    .join("");
  roleSelect.disabled = isSelfAdmin;
  modal.querySelector("[data-modal-role-note]").hidden = !isSelfAdmin;
  renderChoiceGroup(modal.querySelector("[data-modal-staff-roles]"), staffRoleOptions(), user.staffRoles || [], "staff-role");
  renderChoiceGroup(modal.querySelector("[data-modal-departments]"), departmentOptions(), user.departments || [], "department");
  updateAccessPreview();
  modal.showModal();
  refreshIcons();
}

function renderChoiceGroup(container, options, selected, key) {
  if (!container) return;
  const active = Array.isArray(selected) ? selected : [];
  container.innerHTML = options.map(option => `
    <label>
      <input type="checkbox" data-${key}="${escapeHtml(option.value)}" ${active.includes(option.value) ? "checked" : ""}>
      <span>${escapeHtml(option.label)}</span>
    </label>
  `).join("");
}

function updateAccessPreview() {
  const modal = document.querySelector("[data-access-modal]");
  const preview = modal?.querySelector("[data-access-preview] strong");
  if (!modal || !preview) return;
  const role = modal.querySelector("[data-modal-role-select]")?.value || "client";
  const staffRoles = [...modal.querySelectorAll("[data-staff-role]:checked")].map(input => input.dataset.staffRole);
  const labels = [];
  labels.push(roleLabel(role));
  if (role === "admin" || staffRoles.some(item => ["author", "cofounder", "department_director"].includes(item))) labels.push("CMS");
  if (role === "admin" || staffRoles.includes("department_director")) labels.push("Formularios");
  hideAccessConfirmation(modal);
  preview.textContent = labels.join(" · ");
}

async function saveAccessFromModal() {
  const modal = document.querySelector("[data-access-modal]");
  if (!modal) return;
  const user = adminUsers.find(item => item.id === modal.dataset.userId);
  if (!user) return;
  const message = modal.querySelector("[data-access-modal-message]");
  try {
    const roleSelect = modal.querySelector("[data-modal-role-select]");
    const role = roleSelect.disabled ? user.role : roleSelect.value;
    const nextStaffRoles = [...modal.querySelectorAll("[data-staff-role]:checked")].map(input => input.dataset.staffRole);
    const nextDepartments = [...modal.querySelectorAll("[data-department]:checked")].map(input => input.dataset.department);
    const changes = accessChangeSummary(user, role, nextStaffRoles, nextDepartments);
    if (!changes.length) {
      showModalMessage(message, "No hay cambios de acceso para guardar.", "error");
      return;
    }
    if (modal.dataset.confirming !== "true") {
      showAccessConfirmation(modal, user, changes, isSensitiveAccessChange(user, role, nextStaffRoles, nextDepartments));
      return;
    }
    await window.BCCAuth.api(`/api/admin/users/${encodeURIComponent(user.id)}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role, staffRoles: nextStaffRoles, departments: nextDepartments })
    });
    modal.close();
    await Promise.all([loadUsers(), loadAuditLogs()]);
  } catch (error) {
    showModalMessage(message, error.message, "error");
  }
}

function showAccessConfirmation(modal, user, changes, sensitive) {
  const panel = modal.querySelector("[data-access-confirm]");
  const list = modal.querySelector("[data-access-confirm-list]");
  const title = modal.querySelector("[data-access-confirm-title]");
  const saveButton = modal.querySelector("[data-access-modal-save]");
  if (!panel || !list || !title) return;
  title.textContent = sensitive ? "Este cambio afecta permisos sensibles." : "Confirma los cambios de acceso.";
  list.replaceChildren(...[
    `Cuenta: ${user.name} <${user.email}>`,
    ...changes
  ].map(text => {
    const item = document.createElement("li");
    item.textContent = text;
    return item;
  }));
  panel.hidden = false;
  modal.dataset.confirming = "true";
  if (saveButton) saveButton.textContent = "Confirmar y guardar";
}

function hideAccessConfirmation(modal = document.querySelector("[data-access-modal]")) {
  if (!modal) return;
  const panel = modal.querySelector("[data-access-confirm]");
  const saveButton = modal.querySelector("[data-access-modal-save]");
  if (panel) panel.hidden = true;
  modal.dataset.confirming = "false";
  if (saveButton) saveButton.textContent = "Guardar acceso";
}

function accessChangeSummary(user, nextRole, nextStaffRoles, nextDepartments) {
  const changes = [];
  const oldStaffRoles = Array.isArray(user.staffRoles) ? user.staffRoles : [];
  const oldDepartments = Array.isArray(user.departments) ? user.departments : [];
  if (user.role !== nextRole) changes.push(`Rol base: ${roleLabel(user.role)} -> ${roleLabel(nextRole)}`);
  if (!sameSet(oldStaffRoles, nextStaffRoles)) {
    changes.push(`Roles internos: ${labelsFor(oldStaffRoles, staffRoleOptions()) || "ninguno"} -> ${labelsFor(nextStaffRoles, staffRoleOptions()) || "ninguno"}`);
  }
  if (!sameSet(oldDepartments, nextDepartments)) {
    changes.push(`Departamentos: ${labelsFor(oldDepartments, departmentOptions()) || "ninguno"} -> ${labelsFor(nextDepartments, departmentOptions()) || "ninguno"}`);
  }
  return changes;
}

function shortAccessChange(before = {}, after = {}) {
  const changes = accessChangeSummary({
    role: before.role || "client",
    staffRoles: before.staffRoles || [],
    departments: before.departments || []
  }, after.role || "client", after.staffRoles || [], after.departments || []);
  return changes[0] || "Acceso revisado";
}

function isSensitiveAccessChange(user, nextRole, nextStaffRoles, nextDepartments) {
  const oldStaffRoles = Array.isArray(user.staffRoles) ? user.staffRoles : [];
  const oldDepartments = Array.isArray(user.departments) ? user.departments : [];
  if (window.BCCAdminCurrentUser?.id === user.id) return true;
  if (user.role === "admin" || nextRole === "admin") return true;
  if (!sameSet(oldStaffRoles, nextStaffRoles) && nextStaffRoles.some(role => ["author", "cofounder", "department_director"].includes(role))) return true;
  return !sameSet(oldDepartments, nextDepartments) && nextDepartments.some(department => ["finance", "hr"].includes(department));
}

function hasCmsAccess(user) {
  return Array.isArray(user.permissions) && user.permissions.includes("cms:access");
}

function chipList(values, options, emptyLabel) {
  const labels = labelsFor(values || [], options);
  if (!labels) return `<span class="muted-chip">${escapeHtml(emptyLabel)}</span>`;
  return `<span class="chip-list">${labels.split(", ").map(label => `<span>${escapeHtml(label)}</span>`).join("")}</span>`;
}

function roleLabel(role) {
  return { client: "Cliente", staff: "Personal", admin: "Administrador" }[role] || role;
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

function sameSet(left, right) {
  const a = [...new Set(left)].sort();
  const b = [...new Set(right)].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function labelsFor(values, options) {
  const labels = new Map(options.map(option => [option.value, option.label]));
  return [...new Set(values)].map(value => labels.get(value) || value).join(", ");
}

function showModalMessage(message, text, tone) {
  if (!message) return window.alert(text);
  message.textContent = text;
  message.dataset.tone = tone;
  message.hidden = false;
}

function setText(selector, value) {
  const target = document.querySelector(selector);
  if (target) target.textContent = String(value);
}

function hydrateLocalCmsLinks() {
  const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  document.querySelectorAll("[data-local-cms-link]").forEach(el => { el.hidden = !isLocal; });
}

function refreshIcons() {
  window.BCCWorkspaceIcons?.createIcons();
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}
