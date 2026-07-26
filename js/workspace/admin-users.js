/* Users and access-assignment controller. */
(() => {
  const repository = window.BCCWorkspaceAdminAccessRepository;
  const state = window.BCCWorkspaceAdminAccessState;
  const view = window.BCCWorkspaceAdminAccessView;
  const utils = window.BCCWorkspaceUtils;
  let root = null;
  let signal = null;

  async function init(user, context = {}) {
    root = context.root || document.querySelector("#usuarios");
    signal = context.signal || null;
    if (!root) return;
    state.update({ currentUser: user });
    bindControls();
    bindAccessModal();
    await refresh();
  }

  function bindControls() {
    const options = signal ? { signal } : undefined;
    ["[data-user-search]", "[data-user-search-mobile]", "[data-role-filter]", "[data-department-filter]", "[data-cms-filter]"].forEach(selector => {
      const control = document.querySelector(selector);
      control?.addEventListener("input", render, options);
      control?.addEventListener("change", render, options);
    });
    document.querySelectorAll("[data-quick-filter]").forEach(button => {
      button.addEventListener("click", () => applyQuickFilter(button.dataset.quickFilter), options);
    });
  }

  function bindAccessModal() {
    const modal = document.querySelector("[data-access-modal]");
    if (!modal) return;
    const options = signal ? { signal } : undefined;
    modal.querySelectorAll("[data-access-modal-close]").forEach(button => {
      button.addEventListener("click", () => modal.close(), options);
    });
    modal.querySelector("[data-access-modal-save]")?.addEventListener("click", saveAccess, options);
    modal.addEventListener("change", updateAccessPreview, options);
  }

  async function refresh() {
    const requestSignal = signal;
    try {
      const users = await repository.listUsers(requestSignal ? { signal: requestSignal } : {});
      if (requestSignal?.aborted || !root) return;
      state.update({ users });
      render();
      renderMetrics();
    } catch (error) {
      if (cancelled(error, requestSignal)) return;
      showMessage("[data-admin-message]", error.message, "error");
    }
  }

  function filteredUsers() {
    const users = state.snapshot().users;
    const query = [...document.querySelectorAll("[data-user-search], [data-user-search-mobile]")]
      .map(input => String(input.value || "").trim().toLowerCase())
      .find(Boolean) || "";
    const role = document.querySelector("[data-role-filter]")?.value || "";
    const department = document.querySelector("[data-department-filter]")?.value || "";
    const cmsOnly = Boolean(document.querySelector("[data-cms-filter]")?.checked);
    return users.filter(user => {
      const activity = user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "sin acceso";
      const searchable = [
        user.name,
        user.email,
        user.company,
        user.title,
        view.roleLabel(user.role),
        utils.labelsFor(user.customRoles || [], view.customRoleOptions()),
        activity
      ].join(" ").toLowerCase();
      return (!query || searchable.includes(query))
        && (!role || user.role === role)
        && (!department || user.departments.includes(department))
        && (!cmsOnly || view.hasCmsAccess(user));
    });
  }

  function render() {
    const table = document.querySelector("[data-users-table]");
    if (!table || !root) return;
    const users = filteredUsers();
    if (!users.length) {
      const empty = document.createElement("tr");
      empty.innerHTML = `<td class="table-empty" colspan="5">No hay cuentas que coincidan con los filtros.</td>`;
      table.replaceChildren(empty);
    } else {
      table.replaceChildren(...users.map(userRow));
    }
    showMessage("[data-admin-message]", `${users.length} de ${state.snapshot().users.length} cuenta(s).`);
    utils.refreshIcons(root);
  }

  function renderMetrics() {
    const snapshot = state.snapshot();
    utils.setText("[data-metric-accounts]", snapshot.users.length);
    utils.setText("[data-metric-staff]", snapshot.users.filter(user => user.role === "staff" || user.role === "admin").length);
    utils.setText("[data-metric-cms]", snapshot.users.filter(view.hasCmsAccess).length);
    utils.setText("[data-metric-changes]", snapshot.auditLogs.length);
  }

  function userRow(user) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td class="user-cell" data-label="Cuenta">
        <strong>${utils.escapeHtml(user.name)}</strong>
        <span>${utils.escapeHtml(user.email)}</span>
        <small>${utils.escapeHtml(user.company || "Sin compañía")}</small>
      </td>
      <td data-label="Rol y área">
        <span class="role-badge role-${utils.escapeHtml(user.role)}">${utils.escapeHtml(view.roleLabel(user.role))}</span>
        ${chipList(user.departments, view.departmentOptions(), "Sin área")}
      </td>
      <td data-label="Acceso">
        <span class="access-state ${view.hasCmsAccess(user) ? "enabled" : ""}">${view.hasCmsAccess(user) ? "CMS habilitado" : "Sin CMS"}</span>
        ${chipList(user.staffRoles, view.staffRoleOptions(), "Sin rol interno")}
        ${chipList(user.customRoles, view.customRoleOptions(), "Sin rol personalizado")}
      </td>
      <td class="activity-date" data-label="Última actividad">${user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "Sin acceso"}</td>
      <td class="table-action"><button class="btn btn-ghost btn-compact" type="button" data-edit-access><i data-lucide="sliders-horizontal"></i>Editar</button></td>
    `;
    row.querySelector("[data-edit-access]")?.addEventListener("click", () => openAccessModal(user), signal ? { signal } : undefined);
    return row;
  }

  function chipList(values, options, emptyLabel) {
    const labels = utils.labelsFor(values || [], options);
    if (!labels) return `<span class="muted-chip">${utils.escapeHtml(emptyLabel)}</span>`;
    return `<span class="chip-list">${labels.split(", ").map(label => `<span>${utils.escapeHtml(label)}</span>`).join("")}</span>`;
  }

  function applyQuickFilter(filter) {
    const roleFilter = document.querySelector("[data-role-filter]");
    const cmsFilter = document.querySelector("[data-cms-filter]");
    const departmentFilter = document.querySelector("[data-department-filter]");
    const searches = document.querySelectorAll("[data-user-search], [data-user-search-mobile]");
    if (roleFilter) roleFilter.value = filter === "admins" ? "admin" : "";
    if (departmentFilter) departmentFilter.value = "";
    if (cmsFilter) cmsFilter.checked = filter === "cms";
    searches.forEach(input => { input.value = filter === "inactive" ? "sin acceso" : ""; });
    render();
  }

  function openAccessModal(user) {
    const modal = document.querySelector("[data-access-modal]");
    if (!modal) return;
    modal.dataset.userId = user.id;
    modal.dataset.confirming = "false";
    modal.querySelector("[data-access-modal-user]").textContent = `${user.name} · ${user.email}`;
    const message = modal.querySelector("[data-access-modal-message]");
    if (message) {
      message.hidden = true;
      message.textContent = "";
    }
    hideConfirmation(modal);
    const roleSelect = modal.querySelector("[data-modal-role-select]");
    roleSelect.innerHTML = view.baseRoleOptions()
      .map(role => `<option value="${utils.escapeHtml(role.value)}" ${role.value === user.role ? "selected" : ""}>${utils.escapeHtml(role.label)}</option>`)
      .join("");
    const selfAdmin = state.snapshot().currentUser?.id === user.id && user.role === "admin";
    roleSelect.disabled = selfAdmin;
    modal.querySelector("[data-modal-role-note]").hidden = !selfAdmin;
    renderChoiceGroup(modal.querySelector("[data-modal-staff-roles]"), view.staffRoleOptions(), user.staffRoles, "staff-role");
    renderChoiceGroup(modal.querySelector("[data-modal-departments]"), view.departmentOptions(), user.departments, "department");
    renderChoiceGroup(modal.querySelector("[data-modal-custom-roles]"), view.customRoleOptions(), user.customRoles, "custom-role");
    updateAccessPreview();
    modal.showModal();
    utils.refreshIcons(modal);
  }

  function renderChoiceGroup(container, options, selected, key) {
    if (!container) return;
    if (!options.length) {
      container.innerHTML = `<p class="muted-text access-empty-state">${key === "custom-role" ? "No hay roles personalizados creados." : "No hay opciones disponibles."}</p>`;
      return;
    }
    const active = Array.isArray(selected) ? selected : [];
    container.innerHTML = options.map(option => `
      <label>
        <input type="checkbox" data-${key}="${utils.escapeHtml(option.value)}" ${active.includes(option.value) ? "checked" : ""}>
        <span>${utils.escapeHtml(option.label)}</span>
      </label>
    `).join("");
  }

  function selectedAccess(modal) {
    return {
      staffRoles: [...modal.querySelectorAll("[data-staff-role]:checked")].map(input => input.dataset.staffRole),
      departments: [...modal.querySelectorAll("[data-department]:checked")].map(input => input.dataset.department),
      customRoles: [...modal.querySelectorAll("[data-custom-role]:checked")].map(input => input.dataset.customRole)
    };
  }

  function updateAccessPreview() {
    const modal = document.querySelector("[data-access-modal]");
    const preview = modal?.querySelector("[data-access-preview] strong");
    if (!modal || !preview) return;
    const role = modal.querySelector("[data-modal-role-select]")?.value || "client";
    const selected = selectedAccess(modal);
    const customPermissions = view.permissionsForCustomRoles(selected.customRoles);
    const labels = [view.roleLabel(role)];
    if (selected.customRoles.length) labels.push(`${selected.customRoles.length} rol personalizado`);
    if (role === "admin" || selected.staffRoles.some(item => ["author", "cofounder", "department_director"].includes(item)) || customPermissions.includes("cms:access")) labels.push("CMS");
    if (role === "admin" || selected.staffRoles.includes("department_director") || customPermissions.includes("forms:manage")) labels.push("Formularios");
    if (role === "admin" || selected.staffRoles.some(item => ["maps_developer", "maps_release_manager"].includes(item)) || customPermissions.includes("map.dev.access") || customPermissions.includes("maps:developer:access")) labels.push("MAPs Dev");
    if (role === "admin" || selected.staffRoles.includes("maps_license_manager") || customPermissions.includes("platform.licenses.manage")) labels.push("Licencias MAP");
    if (selected.staffRoles.includes("maps_product_analyst") || customPermissions.includes("platform.analytics.read")) labels.push("Analítica MAP");
    hideConfirmation(modal);
    preview.textContent = labels.join(" · ");
  }

  async function saveAccess() {
    const modal = document.querySelector("[data-access-modal]");
    const user = state.snapshot().users.find(item => item.id === modal?.dataset.userId);
    if (!modal || !user) return;
    const message = modal.querySelector("[data-access-modal-message]");
    const selected = selectedAccess(modal);
    const roleSelect = modal.querySelector("[data-modal-role-select]");
    const role = roleSelect.disabled ? user.role : roleSelect.value;
    const changes = view.accessChangeSummary(user, role, selected.staffRoles, selected.departments, selected.customRoles);
    if (!changes.length) return showModalMessage(message, "No hay cambios de acceso para guardar.", "error");
    if (modal.dataset.confirming !== "true") {
      showConfirmation(modal, user, changes, view.isSensitiveAccessChange(user, role, selected.staffRoles, selected.departments, selected.customRoles));
      return;
    }
    try {
      await repository.updateUserAccess(user.id, { role, ...selected }, signal ? { signal } : {});
      if (signal?.aborted) return;
      modal.close();
      await Promise.all([
        refresh(),
        window.BCCWorkspaceAdminRoles?.refresh?.(),
        window.BCCWorkspaceAdminAudit?.refresh?.()
      ]);
    } catch (error) {
      if (!cancelled(error)) showModalMessage(message, error.message, "error");
    }
  }

  function showConfirmation(modal, user, changes, sensitive) {
    modal.querySelector("[data-access-confirm-title]").textContent = sensitive
      ? "Este cambio afecta permisos sensibles."
      : "Confirma los cambios de acceso.";
    modal.querySelector("[data-access-confirm-list]").replaceChildren(...[
      `Cuenta: ${user.name} <${user.email}>`,
      ...changes
    ].map(text => {
      const item = document.createElement("li");
      item.textContent = text;
      return item;
    }));
    modal.querySelector("[data-access-confirm]").hidden = false;
    modal.dataset.confirming = "true";
    modal.querySelector("[data-access-modal-save]").textContent = "Confirmar y guardar";
  }

  function hideConfirmation(modal) {
    modal.querySelector("[data-access-confirm]").hidden = true;
    modal.dataset.confirming = "false";
    modal.querySelector("[data-access-modal-save]").textContent = "Guardar acceso";
  }

  function syncRoleChoices() {
    renderRoleFilter();
    const modal = document.querySelector("[data-access-modal]");
    if (!modal?.open) return;
    const roleSelect = modal.querySelector("[data-modal-role-select]");
    const selectedRole = roleSelect?.value || "client";
    const selected = selectedAccess(modal);
    if (roleSelect) {
      roleSelect.innerHTML = view.baseRoleOptions()
        .map(role => `<option value="${utils.escapeHtml(role.value)}" ${role.value === selectedRole ? "selected" : ""}>${utils.escapeHtml(role.label)}</option>`)
        .join("");
      if (![...roleSelect.options].some(option => option.value === selectedRole)) roleSelect.value = "client";
    }
    renderChoiceGroup(modal.querySelector("[data-modal-staff-roles]"), view.staffRoleOptions(), selected.staffRoles, "staff-role");
    renderChoiceGroup(modal.querySelector("[data-modal-departments]"), view.departmentOptions(), selected.departments, "department");
    renderChoiceGroup(modal.querySelector("[data-modal-custom-roles]"), view.customRoleOptions(), selected.customRoles, "custom-role");
    updateAccessPreview();
  }

  function renderRoleFilter() {
    const select = document.querySelector("select[data-role-filter]");
    if (!select) return;
    const current = select.value;
    select.innerHTML = `<option value="">Todos los roles</option>${view.baseRoleOptions()
      .map(role => `<option value="${utils.escapeHtml(role.value)}">${utils.escapeHtml(role.label)}</option>`).join("")}`;
    select.value = [...select.options].some(option => option.value === current) ? current : "";
  }

  function showMessage(selector, text, tone = "neutral") {
    const target = document.querySelector(selector);
    if (target) utils.renderMessageBlock(target, text, tone);
  }

  function showModalMessage(message, text, tone) {
    if (!message) return window.alert(text);
    message.textContent = text;
    message.dataset.tone = tone;
    message.hidden = false;
  }

  function cancelled(error, requestSignal = signal) {
    return Boolean(requestSignal?.aborted || error?.code === "cancelled");
  }

  function activate(context = {}) {
    signal = context.signal || signal;
    if (context.viewId !== "usuarios") document.querySelector("[data-access-modal]")?.close();
    render();
    renderMetrics();
  }

  function destroy() {
    document.querySelector("[data-access-modal]")?.close();
    root = null;
    signal = null;
  }

  window.BCCWorkspaceAdminUsers = Object.freeze({ init, activate, destroy, refresh, render, syncRoleChoices });
})();
