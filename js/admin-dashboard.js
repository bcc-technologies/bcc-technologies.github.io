let adminUsers = [];

document.addEventListener("DOMContentLoaded", async () => {
  const user = await window.BCCAuth.requireAuth({ admin: true });
  if (!user) return;
  window.BCCAdminCurrentUser = user;

  document.querySelectorAll("[data-user-name]").forEach(el => { el.textContent = user.displayName || user.name; });
  document.querySelectorAll("[data-user-role]").forEach(el => { el.textContent = roleLabel(user.role); });
  hydrateAccountMenu(user);
  hydrateLocalCmsLinks();
  bindAccessModal();
  await loadUsers();
  await loadAuditLogs();
});

async function loadUsers() {
  const table = document.querySelector("[data-users-table]");
  const message = document.querySelector("[data-admin-message]");
  if (!table) return;
  try {
    const { users } = await window.BCCAuth.api("/api/admin/users");
    adminUsers = users;
    table.replaceChildren(...users.map(userRow));
    if (message) message.textContent = `${users.length} cuenta(s) registrada(s).`;
  } catch (error) {
    if (message) message.textContent = error.message;
  }
}

async function loadAuditLogs() {
  const table = document.querySelector("[data-audit-table]");
  const message = document.querySelector("[data-audit-message]");
  if (!table) return;
  try {
    const { logs } = await window.BCCAuth.api("/api/admin/access-audit");
    table.replaceChildren(...logs.map(auditRow));
    if (message) message.textContent = logs.length
      ? `${logs.length} cambio(s) reciente(s).`
      : "Todavia no hay cambios de acceso registrados.";
  } catch (error) {
    if (message) message.textContent = error.message;
  }
}

function userRow(user) {
  const staffRoles = Array.isArray(user.staffRoles) ? user.staffRoles : [];
  const departments = Array.isArray(user.departments) ? user.departments : [];
  const row = document.createElement("tr");
  row.innerHTML = `
    <td><strong>${escapeHtml(user.name)}</strong><span>${escapeHtml(user.email)}</span></td>
    <td>${escapeHtml(user.company || "-")}</td>
    <td>
      <div class="access-summary">
        <span class="role-badge role-${escapeHtml(user.role)}">${escapeHtml(roleLabel(user.role))}</span>
        ${chipList(staffRoles, staffRoleOptions(), "Sin rol interno")}
        ${chipList(departments, departmentOptions(), "Sin departamento")}
        <small>${escapeHtml(effectiveAccessLabel(user))}</small>
      </div>
    </td>
    <td>${escapeHtml(user.status || "active")}</td>
    <td>${user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "-"}</td>
    <td><button class="btn btn-ghost btn-compact" type="button" data-edit-access>Editar</button></td>
  `;
  row.querySelector("[data-edit-access]").addEventListener("click", () => openAccessModal(user));
  return row;
}

function bindAccessModal() {
  const modal = document.querySelector("[data-access-modal]");
  if (!modal) return;
  modal.querySelectorAll("[data-access-modal-close]").forEach(button => {
    button.addEventListener("click", () => modal.close());
  });
  modal.querySelector("[data-access-modal-save]")?.addEventListener("click", saveAccessFromModal);
}

function openAccessModal(user) {
  const modal = document.querySelector("[data-access-modal]");
  if (!modal) return;
  const currentUser = window.BCCAdminCurrentUser;
  const isSelfAdmin = currentUser?.id === user.id && user.role === "admin";
  modal.dataset.userId = user.id;
  const message = modal.querySelector("[data-access-modal-message]");
  if (message) {
    message.hidden = true;
    message.textContent = "";
  }
  modal.querySelector("[data-access-modal-user]").textContent = `${user.name} <${user.email}>`;
  const roleSelect = modal.querySelector("[data-modal-role-select]");
  roleSelect.innerHTML = ["client", "staff", "admin"]
    .map(role => `<option value="${role}" ${role === user.role ? "selected" : ""}>${roleLabel(role)}</option>`)
    .join("");
  roleSelect.disabled = isSelfAdmin;
  const note = modal.querySelector("[data-modal-role-note]");
  if (note) note.hidden = !isSelfAdmin;
  renderChoiceGroup(modal.querySelector("[data-modal-staff-roles]"), staffRoleOptions(), user.staffRoles || [], "staff-role");
  renderChoiceGroup(modal.querySelector("[data-modal-departments]"), departmentOptions(), user.departments || [], "department");
  modal.showModal();
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
    const sensitive = isSensitiveAccessChange(user, role, nextStaffRoles, nextDepartments);
    const intro = sensitive
      ? "Este cambio afecta permisos sensibles."
      : "Vas a cambiar los accesos de esta cuenta.";
    const confirmed = window.confirm(`${intro}\n\nUsuario: ${user.name} <${user.email}>\n${changes.join("\n")}\n\n¿Confirmas este cambio?`);
    if (!confirmed) return;
    await window.BCCAuth.api(`/api/admin/users/${encodeURIComponent(user.id)}/role`, {
      method: "PATCH",
      body: JSON.stringify({
        role,
        staffRoles: nextStaffRoles,
        departments: nextDepartments
      })
    });
    modal.close();
    await loadUsers();
    await loadAuditLogs();
  } catch (error) {
    showModalMessage(message, error.message, "error");
  }
}

function showModalMessage(message, text, tone) {
  if (!message) {
    window.alert(text);
    return;
  }
  message.textContent = text;
  message.dataset.tone = tone;
  message.hidden = false;
}

function auditRow(log) {
  const row = document.createElement("tr");
  row.innerHTML = `
    <td>${log.createdAt ? new Date(log.createdAt).toLocaleString() : "-"}</td>
    <td><strong>${escapeHtml(log.actorEmail || "-")}</strong></td>
    <td><strong>${escapeHtml(log.targetEmail || "-")}</strong></td>
    <td class="audit-change">${escapeHtml(formatAccessChange(log.beforeAccess, log.afterAccess))}</td>
  `;
  return row;
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

function isSensitiveAccessChange(user, nextRole, nextStaffRoles, nextDepartments) {
  const currentUser = window.BCCAdminCurrentUser;
  const oldStaffRoles = Array.isArray(user.staffRoles) ? user.staffRoles : [];
  const oldDepartments = Array.isArray(user.departments) ? user.departments : [];
  if (currentUser?.id === user.id) return true;
  if (user.role === "admin" || nextRole === "admin") return true;
  if (!sameSet(oldStaffRoles, nextStaffRoles) && nextStaffRoles.some(role => ["author", "cofounder", "department_director"].includes(role))) return true;
  if (!sameSet(oldDepartments, nextDepartments) && nextDepartments.some(department => ["finance", "hr"].includes(department))) return true;
  return false;
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

function formatAccessChange(before = {}, after = {}) {
  const parts = [];
  if (before.role !== after.role) parts.push(`Rol: ${roleLabel(before.role)} -> ${roleLabel(after.role)}`);
  const beforeStaff = Array.isArray(before.staffRoles) ? before.staffRoles : [];
  const afterStaff = Array.isArray(after.staffRoles) ? after.staffRoles : [];
  const beforeDepartments = Array.isArray(before.departments) ? before.departments : [];
  const afterDepartments = Array.isArray(after.departments) ? after.departments : [];
  if (!sameSet(beforeStaff, afterStaff)) {
    parts.push(`Roles internos: ${labelsFor(beforeStaff, staffRoleOptions()) || "ninguno"} -> ${labelsFor(afterStaff, staffRoleOptions()) || "ninguno"}`);
  }
  if (!sameSet(beforeDepartments, afterDepartments)) {
    parts.push(`Departamentos: ${labelsFor(beforeDepartments, departmentOptions()) || "ninguno"} -> ${labelsFor(afterDepartments, departmentOptions()) || "ninguno"}`);
  }
  return parts.join(" | ") || "Sin cambios";
}

function chipList(values, options, emptyLabel) {
  const labels = labelsFor(values, options);
  if (!labels) return `<span class="muted-chip">${escapeHtml(emptyLabel)}</span>`;
  return `<span class="chip-list">${labels.split(", ").map(label => `<span>${escapeHtml(label)}</span>`).join("")}</span>`;
}

function effectiveAccessLabel(user) {
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  const labels = [];
  if (permissions.includes("admin:view")) labels.push("Admin");
  if (permissions.includes("staff:view")) labels.push("Personal");
  if (permissions.includes("cms:access")) labels.push("CMS");
  if (permissions.includes("clients:view")) labels.push("Clientes");
  if (permissions.includes("content:view")) labels.push("Contenido");
  if (!labels.length) labels.push("Cliente");
  return `Acceso efectivo: ${labels.join(", ")}`;
}

function roleLabel(role) {
  return { client: "Cliente", staff: "Personal", admin: "Administrador" }[role] || role;
}

function staffRoleOptions() {
  return [
    { value: "author", label: "Autor" },
    { value: "cofounder", label: "Cofounder" },
    { value: "department_director", label: "Director de departamento" }
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

function hydrateAccountMenu(user) {
  const display = user.displayName || user.name || "Cuenta";
  document.querySelectorAll("[data-user-menu-name]").forEach(el => { el.textContent = display; });
  document.querySelectorAll("[data-user-menu-role]").forEach(el => { el.textContent = roleLabel(user.role); });
  document.querySelectorAll("[data-user-initial]").forEach(el => { el.textContent = display.trim().charAt(0).toUpperCase() || "?"; });
  document.querySelectorAll("[data-dashboard-link]").forEach(el => { el.href = window.BCCAuth.routeForUser(user); });
}

function hydrateLocalCmsLinks() {
  const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  document.querySelectorAll("[data-local-cms-link]").forEach(el => { el.hidden = !isLocal; });
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
