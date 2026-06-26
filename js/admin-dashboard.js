let adminUsers = [];
let adminAuditLogs = [];
let roleDefinitions = [];
let rolePermissions = [];
let activeRoleFilter = "all";

const FALLBACK_BASE_ROLES = [
  { value: "client", label: "Cliente" },
  { value: "staff", label: "Personal" },
  { value: "admin", label: "Administrador" }
];
const FALLBACK_STAFF_ROLES = [
  { value: "author", label: "Autor" },
  { value: "cofounder", label: "Cofounder" },
  { value: "department_director", label: "Director" }
];
const FALLBACK_DEPARTMENTS = [
  { value: "technology", label: "Tecnología" },
  { value: "finance", label: "Finanzas" },
  { value: "operations", label: "Operaciones" },
  { value: "marketing", label: "Marketing" },
  { value: "hr", label: "Recursos humanos" }
];

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
  bindRoleAdminControls();
  initializeWorkspaceModule("intelligence", user);
  initializeWorkspaceModule("prospectos", user);
  initializeWorkspaceModule("analytics", user);
  initializeWorkspaceModule("productividad", user);
  initializeWorkspaceModule("formularios", user);
  refreshIcons();
  await Promise.all([loadUsers(), loadAuditLogs(), loadRoleDefinitions()]);
});

async function loadUsers() {
  const message = document.querySelector("[data-admin-message]");
  try {
    const { users } = await window.BCCAuth.api("/api/admin/users");
    adminUsers = users;
    renderUsers();
    renderMetrics();
  } catch (error) {
    if (message) renderWorkspaceMessage(message, error.message, "error");
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
      renderWorkspaceMessage(message, logs.length ? "Cambios de permisos registrados." : "Todavia no hay cambios registrados.");
    }
    const count = document.querySelector("[data-audit-count]");
    if (count) count.textContent = String(logs.length);
    renderMetrics();
  } catch (error) {
    if (message) renderWorkspaceMessage(message, error.message, "error");
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
  if (message) renderWorkspaceMessage(message, `${users.length} de ${adminUsers.length} cuenta(s).`);
  refreshIcons();
}

function renderWorkspaceMessage(target, text, tone = "neutral") {
  const content = String(text || "").trim();
  target.dataset.tone = tone;
  target.replaceChildren(document.createTextNode(content));
  if (content.length < 170) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "workspace-message-copy";
  button.textContent = "Copiar detalle";
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(content);
      button.textContent = "Copiado";
      window.setTimeout(() => {
        button.textContent = "Copiar detalle";
      }, 1400);
    } catch {
      button.textContent = "No se pudo copiar";
    }
  });
  target.append(button);
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
    const searchable = [user.name, user.email, user.company, user.title, roleLabel(user.role), labelsFor(user.customRoles || [], customRoleOptions()), activity].join(" ").toLowerCase();
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
      ${chipList(user.customRoles || [], customRoleOptions(), "Sin rol personalizado")}
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

  if (viewId === "intelligence") {
    mountWorkspaceModule({
      rootSelector: "[data-intelligence-workspace]",
      module: window.BCCWorkspaceIntelligence,
      key: "intelligence",
      loadingText: "Cargando intelligence...",
      errorText: "No fue posible cargar el modulo de intelligence. Recarga la pagina."
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
  roleSelect.innerHTML = baseRoleOptions()
    .map(role => `<option value="${escapeHtml(role.value)}" ${role.value === user.role ? "selected" : ""}>${escapeHtml(role.label)}</option>`)
    .join("");
  roleSelect.disabled = isSelfAdmin;
  modal.querySelector("[data-modal-role-note]").hidden = !isSelfAdmin;
  renderChoiceGroup(modal.querySelector("[data-modal-staff-roles]"), staffRoleOptions(), user.staffRoles || [], "staff-role");
  renderChoiceGroup(modal.querySelector("[data-modal-departments]"), departmentOptions(), user.departments || [], "department");
  renderChoiceGroup(modal.querySelector("[data-modal-custom-roles]"), customRoleOptions(), user.customRoles || [], "custom-role");
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
  const customRoles = [...modal.querySelectorAll("[data-custom-role]:checked")].map(input => input.dataset.customRole);
  const customPermissions = permissionsForCustomRoles(customRoles);
  const labels = [];
  labels.push(roleLabel(role));
  if (customRoles.length) labels.push(`${customRoles.length} rol personalizado`);
  if (role === "admin" || staffRoles.some(item => ["author", "cofounder", "department_director"].includes(item)) || customPermissions.includes("cms:access")) labels.push("CMS");
  if (role === "admin" || staffRoles.includes("department_director") || customPermissions.includes("forms:manage")) labels.push("Formularios");
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
    const nextCustomRoles = [...modal.querySelectorAll("[data-custom-role]:checked")].map(input => input.dataset.customRole);
    const changes = accessChangeSummary(user, role, nextStaffRoles, nextDepartments, nextCustomRoles);
    if (!changes.length) {
      showModalMessage(message, "No hay cambios de acceso para guardar.", "error");
      return;
    }
    if (modal.dataset.confirming !== "true") {
      showAccessConfirmation(modal, user, changes, isSensitiveAccessChange(user, role, nextStaffRoles, nextDepartments, nextCustomRoles));
      return;
    }
    await window.BCCAuth.api(`/api/admin/users/${encodeURIComponent(user.id)}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role, staffRoles: nextStaffRoles, departments: nextDepartments, customRoles: nextCustomRoles })
    });
    modal.close();
    await Promise.all([loadUsers(), loadAuditLogs(), loadRoleDefinitions()]);
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

function accessChangeSummary(user, nextRole, nextStaffRoles, nextDepartments, nextCustomRoles = []) {
  const changes = [];
  const oldStaffRoles = Array.isArray(user.staffRoles) ? user.staffRoles : [];
  const oldDepartments = Array.isArray(user.departments) ? user.departments : [];
  const oldCustomRoles = Array.isArray(user.customRoles) ? user.customRoles : [];
  if (user.role !== nextRole) changes.push(`Rol base: ${roleLabel(user.role)} -> ${roleLabel(nextRole)}`);
  if (!sameSet(oldStaffRoles, nextStaffRoles)) {
    changes.push(`Roles internos: ${labelsFor(oldStaffRoles, staffRoleOptions()) || "ninguno"} -> ${labelsFor(nextStaffRoles, staffRoleOptions()) || "ninguno"}`);
  }
  if (!sameSet(oldDepartments, nextDepartments)) {
    changes.push(`Departamentos: ${labelsFor(oldDepartments, departmentOptions()) || "ninguno"} -> ${labelsFor(nextDepartments, departmentOptions()) || "ninguno"}`);
  }
  if (!sameSet(oldCustomRoles, nextCustomRoles)) {
    changes.push(`Roles personalizados: ${labelsFor(oldCustomRoles, customRoleOptions()) || "ninguno"} -> ${labelsFor(nextCustomRoles, customRoleOptions()) || "ninguno"}`);
  }
  return changes;
}

function shortAccessChange(before = {}, after = {}) {
  const changes = accessChangeSummary({
    role: before.role || "client",
    staffRoles: before.staffRoles || [],
    departments: before.departments || [],
    customRoles: before.customRoles || []
  }, after.role || "client", after.staffRoles || [], after.departments || [], after.customRoles || []);
  return changes[0] || "Acceso revisado";
}

function isSensitiveAccessChange(user, nextRole, nextStaffRoles, nextDepartments, nextCustomRoles = []) {
  const oldStaffRoles = Array.isArray(user.staffRoles) ? user.staffRoles : [];
  const oldDepartments = Array.isArray(user.departments) ? user.departments : [];
  const oldCustomRoles = Array.isArray(user.customRoles) ? user.customRoles : [];
  if (window.BCCAdminCurrentUser?.id === user.id) return true;
  if (user.role === "admin" || nextRole === "admin") return true;
  if (!sameSet(oldStaffRoles, nextStaffRoles) && nextStaffRoles.some(role => ["author", "cofounder", "department_director"].includes(role))) return true;
  if (!sameSet(oldCustomRoles, nextCustomRoles) && permissionsForCustomRoles(nextCustomRoles).some(permission => ["admin:view", "users:manage", "cms:access", "forms:manage"].includes(permission))) return true;
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
  return optionLabel(baseRoleOptions(), role) || role;
}

function baseRoleOptions() {
  return catalogOptions("base", FALLBACK_BASE_ROLES, "key");
}

function staffRoleOptions() {
  return catalogOptions("staff", FALLBACK_STAFF_ROLES, "key");
}

function departmentOptions() {
  return catalogOptions("department", FALLBACK_DEPARTMENTS, "key");
}

function customRoleOptions() {
  return catalogOptions("custom", [], "id");
}

function catalogOptions(type, fallback = [], valueKey = "key") {
  const options = roleDefinitions
    .filter(role => role.type === type)
    .map(role => ({
      value: String(role[valueKey] || role.id || ""),
      label: role.name || role.label || String(role[valueKey] || role.id || "")
    }))
    .filter(option => option.value);
  return options.length ? options : fallback;
}

function optionLabel(options, value) {
  return options.find(option => option.value === value)?.label || "";
}

function renderUserRoleFilter() {
  const select = document.querySelector("select[data-role-filter]");
  if (!select) return;
  const current = select.value;
  select.innerHTML = `<option value="">Todos los roles</option>${baseRoleOptions()
    .map(role => `<option value="${escapeHtml(role.value)}">${escapeHtml(role.label)}</option>`)
    .join("")}`;
  select.value = [...select.options].some(option => option.value === current) ? current : "";
}

function syncOpenAccessModalRoleChoices() {
  const modal = document.querySelector("[data-access-modal]");
  if (!modal?.open) return;
  const roleSelect = modal.querySelector("[data-modal-role-select]");
  const selectedRole = roleSelect?.value || "client";
  const selectedStaffRoles = [...modal.querySelectorAll("[data-staff-role]:checked")].map(input => input.dataset.staffRole);
  const selectedDepartments = [...modal.querySelectorAll("[data-department]:checked")].map(input => input.dataset.department);
  const selectedCustomRoles = [...modal.querySelectorAll("[data-custom-role]:checked")].map(input => input.dataset.customRole);

  if (roleSelect) {
    roleSelect.innerHTML = baseRoleOptions()
      .map(role => `<option value="${escapeHtml(role.value)}" ${role.value === selectedRole ? "selected" : ""}>${escapeHtml(role.label)}</option>`)
      .join("");
    if (![...roleSelect.options].some(option => option.value === selectedRole)) roleSelect.value = "client";
  }
  renderChoiceGroup(modal.querySelector("[data-modal-staff-roles]"), staffRoleOptions(), selectedStaffRoles, "staff-role");
  renderChoiceGroup(modal.querySelector("[data-modal-departments]"), departmentOptions(), selectedDepartments, "department");
  renderChoiceGroup(modal.querySelector("[data-modal-custom-roles]"), customRoleOptions(), selectedCustomRoles, "custom-role");
  updateAccessPreview();
  refreshIcons();
}

function permissionsForCustomRoles(customRoles = []) {
  const selected = new Set(customRoles);
  return [...new Set(roleDefinitions
    .filter(role => selected.has(role.id))
    .flatMap(role => Array.isArray(role.permissions) ? role.permissions : []))];
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


async function loadRoleDefinitions() {
  const message = document.querySelector("[data-role-admin-message]");
  try {
    const data = await window.BCCAuth.api("/api/admin/roles");
    roleDefinitions = data.roles || [];
    rolePermissions = data.permissions || [];
    renderRoleAdmin();
    renderUserRoleFilter();
    syncOpenAccessModalRoleChoices();
    if (adminUsers.length) renderUsers();
  } catch (error) {
    if (message) renderWorkspaceMessage(message, error.message, "error");
  }
}

function bindRoleAdminControls() {
  const form = document.querySelector("[data-role-form]");
  form?.addEventListener("submit", saveRoleDefinition);
  document.querySelector("[data-role-form-reset]")?.addEventListener("click", resetRoleForm);
  document.querySelectorAll("[data-role-library-filter]").forEach(button => {
    button.addEventListener("click", () => {
      activeRoleFilter = button.dataset.roleLibraryFilter || "all";
      renderRoleLibrary();
    });
  });
  document.querySelector("[data-role-library]")?.addEventListener("click", event => {
    const edit = event.target.closest("[data-role-edit]");
    const remove = event.target.closest("[data-role-delete]");
    if (edit) editRoleDefinition(edit.dataset.roleEdit);
    if (remove) deleteRoleDefinition(remove.dataset.roleDelete);
  });
}

function renderRoleAdmin() {
  renderPermissionPicker();
  renderPermissionReference();
  renderRoleLibrary();
}

function groupedPermissions() {
  return rolePermissions.reduce((groups, permission) => {
    const group = permission.group || "general";
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(permission);
    return groups;
  }, new Map());
}

function renderPermissionPicker(selected = []) {
  const container = document.querySelector("[data-permission-picker]");
  if (!container) return;
  const selectedSet = new Set(selected);
  const groups = [...groupedPermissions().entries()];
  container.innerHTML = groups.map(([group, permissions]) => `
    <fieldset>
      <legend>${escapeHtml(permissionGroupLabel(group))}</legend>
      <div>
        ${permissions.map(permission => `
          <label>
            <input type="checkbox" name="permissions" value="${escapeHtml(permission.value)}" ${selectedSet.has(permission.value) ? "checked" : ""}>
            <span>${escapeHtml(permission.label || permission.value)}</span>
          </label>
        `).join("")}
      </div>
    </fieldset>
  `).join("");
}

function renderPermissionReference() {
  const count = document.querySelector("[data-permission-count]");
  if (count) count.textContent = `${rolePermissions.length} permisos`;
  const container = document.querySelector("[data-permission-reference]");
  if (!container) return;
  container.innerHTML = [...groupedPermissions().entries()].map(([group, permissions]) => `
    <section>
      <strong>${escapeHtml(permissionGroupLabel(group))}</strong>
      <div>${permissions.map(permission => `<span>${escapeHtml(permission.label || permission.value)}</span>`).join("")}</div>
    </section>
  `).join("");
}

function renderRoleLibrary() {
  const container = document.querySelector("[data-role-library]");
  const message = document.querySelector("[data-role-admin-message]");
  if (!container) return;
  document.querySelectorAll("[data-role-library-filter]").forEach(button => {
    button.classList.toggle("active", (button.dataset.roleLibraryFilter || "all") === activeRoleFilter);
  });
  const roles = roleDefinitions.filter(role => activeRoleFilter === "all" || role.type === activeRoleFilter);
  if (message) renderWorkspaceMessage(message, `${roles.length} de ${roleDefinitions.length} rol(es) visibles.`);
  if (!roles.length) {
    container.innerHTML = `<p class="muted-text">No hay roles en esta vista.</p>`;
    return;
  }
  container.innerHTML = roles.map(roleCard).join("");
  refreshIcons();
}

function roleCard(role) {
  const permissions = Array.isArray(role.permissions) ? role.permissions : [];
  const labels = permissions.map(permissionLabel).slice(0, 8);
  const overflow = permissions.length > labels.length ? permissions.length - labels.length : 0;
  return `
    <article class="role-card ${role.locked ? "locked" : "custom"}">
      <div class="role-card-head">
        <span>${escapeHtml(roleTypeLabel(role.type))}</span>
        <strong>${escapeHtml(role.name)}</strong>
        <small>${escapeHtml(role.description || "Sin descripción")}</small>
      </div>
      <div class="role-permission-chips">
        ${labels.map(label => `<span>${escapeHtml(label)}</span>`).join("")}
        ${overflow ? `<span>+${overflow}</span>` : ""}
      </div>
      <div class="role-card-foot">
        <small>${permissions.length} permiso(s)</small>
        ${role.locked ? `<span class="locked-note">Protegido</span>` : `
          <button class="btn btn-ghost" type="button" data-role-edit="${escapeHtml(role.id)}"><i data-lucide="pencil"></i>Editar</button>
          <button class="btn btn-ghost" type="button" data-role-delete="${escapeHtml(role.id)}"><i data-lucide="trash-2"></i>Eliminar</button>
        `}
      </div>
    </article>
  `;
}

async function saveRoleDefinition(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = document.querySelector("[data-role-form-message]");
  const id = form.elements.roleId.value;
  const permissions = [...form.querySelectorAll('input[name="permissions"]:checked')].map(input => input.value);
  const payload = {
    name: form.elements.name.value,
    description: form.elements.description.value,
    permissions
  };
  try {
    const data = await window.BCCAuth.api(id ? `/api/admin/roles/${encodeURIComponent(id)}` : "/api/admin/roles", {
      method: id ? "PATCH" : "POST",
      body: JSON.stringify(payload)
    });
    roleDefinitions = data.roles || roleDefinitions;
    rolePermissions = data.permissions || rolePermissions;
    resetRoleForm();
    renderRoleAdmin();
    renderUserRoleFilter();
    syncOpenAccessModalRoleChoices();
    if (adminUsers.length) await loadUsers();
    showRoleFormMessage(message, id ? "Rol actualizado y usuarios sincronizados." : "Rol creado y disponible para usuarios.", "ok");
  } catch (error) {
    showRoleFormMessage(message, error.message, "error");
  }
}

function editRoleDefinition(id) {
  const role = roleDefinitions.find(item => item.id === id && !item.locked);
  const form = document.querySelector("[data-role-form]");
  if (!role || !form) return;
  form.elements.roleId.value = role.id;
  form.elements.name.value = role.name || "";
  form.elements.description.value = role.description || "";
  renderPermissionPicker(role.permissions || []);
  showRoleFormMessage(document.querySelector("[data-role-form-message]"), "Editando rol personalizado.", "ok");
  document.querySelector("#roles")?.scrollIntoView({ block: "start" });
  refreshIcons();
}

async function deleteRoleDefinition(id) {
  const role = roleDefinitions.find(item => item.id === id && !item.locked);
  if (!role) return;
  if (!window.confirm(`Eliminar el rol personalizado "${role.name}"?`)) return;
  const message = document.querySelector("[data-role-admin-message]");
  try {
    const data = await window.BCCAuth.api(`/api/admin/roles/${encodeURIComponent(id)}`, { method: "DELETE" });
    roleDefinitions = data.roles || roleDefinitions.filter(item => item.id !== id);
    rolePermissions = data.permissions || rolePermissions;
    resetRoleForm();
    renderRoleAdmin();
    renderUserRoleFilter();
    syncOpenAccessModalRoleChoices();
    await loadUsers();
    if (message) renderWorkspaceMessage(message, "Rol eliminado y usuarios sincronizados.", "ok");
  } catch (error) {
    if (message) renderWorkspaceMessage(message, error.message, "error");
  }
}

function resetRoleForm() {
  const form = document.querySelector("[data-role-form]");
  if (!form) return;
  form.reset();
  form.elements.roleId.value = "";
  renderPermissionPicker();
  const message = document.querySelector("[data-role-form-message]");
  if (message) {
    message.hidden = true;
    message.textContent = "";
  }
  refreshIcons();
}

function showRoleFormMessage(message, text, tone) {
  if (!message) return;
  message.textContent = text;
  message.dataset.tone = tone;
  message.hidden = !text;
}

function permissionLabel(value) {
  return rolePermissions.find(permission => permission.value === value)?.label || value;
}

function roleTypeLabel(type) {
  return {
    base: "Rol base",
    staff: "Rol interno",
    department: "Departamento",
    custom: "Personalizado"
  }[type] || type;
}

function permissionGroupLabel(group) {
  return {
    dashboard: "Dashboard",
    profile: "Perfil",
    downloads: "Recursos",
    support: "Soporte",
    staff: "Personal",
    clients: "Clientes",
    content: "Contenido",
    cms: "CMS",
    users: "Usuarios",
    forms: "Formularios",
    admin: "Administración",
    strategy: "Estrategia",
    department: "Departamentos"
  }[group] || group;
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
