/* Role catalog and custom-role controller. */
(() => {
  const repository = window.BCCWorkspaceAdminAccessRepository;
  const state = window.BCCWorkspaceAdminAccessState;
  const utils = window.BCCWorkspaceUtils;
  const ui = window.BCCWorkspaceUI;
  let root = null;
  let signal = null;
  let activeFilter = "all";

  async function init(user, context = {}) {
    root = context.root || document.querySelector("#roles");
    signal = context.signal || null;
    if (!root) return;
    state.update({ currentUser: user });
    bindControls();
    await refresh();
  }

  function bindControls() {
    const options = signal ? { signal } : undefined;
    document.querySelector("[data-role-form]")?.addEventListener("submit", saveRole, options);
    document.querySelector("[data-role-form-reset]")?.addEventListener("click", resetForm, options);
    document.querySelectorAll("[data-role-library-filter]").forEach(button => {
      button.addEventListener("click", () => {
        activeFilter = button.dataset.roleLibraryFilter || "all";
        renderLibrary();
      }, options);
    });
    document.querySelector("[data-role-library]")?.addEventListener("click", event => {
      const edit = event.target.closest("[data-role-edit]");
      const remove = event.target.closest("[data-role-delete]");
      if (edit) editRole(edit.dataset.roleEdit);
      if (remove) void removeRole(remove.dataset.roleDelete);
    }, options);
  }

  async function refresh() {
    const requestSignal = signal;
    try {
      const catalog = await repository.listRoles(requestSignal ? { signal: requestSignal } : {});
      if (requestSignal?.aborted || !root) return;
      state.update(catalog);
      render();
      window.BCCWorkspaceAdminUsers?.syncRoleChoices?.();
      window.BCCWorkspaceAdminUsers?.render?.();
    } catch (error) {
      if (!cancelled(error, requestSignal)) showMessage("[data-role-admin-message]", error.message, "error");
    }
  }

  function render() {
    renderPermissionPicker();
    renderPermissionReference();
    renderLibrary();
  }

  function groupedPermissions() {
    return state.snapshot().permissions.reduce((groups, permission) => {
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
    container.innerHTML = [...groupedPermissions().entries()].map(([group, permissions]) => `
      <fieldset>
        <legend>${utils.escapeHtml(permissionGroupLabel(group))}</legend>
        <div>${permissions.map(permission => `
          <label>
            <input type="checkbox" name="permissions" value="${utils.escapeHtml(permission.value)}" ${selectedSet.has(permission.value) ? "checked" : ""}>
            <span>${utils.escapeHtml(permission.label)}</span>
          </label>`).join("")}
        </div>
      </fieldset>
    `).join("");
  }

  function renderPermissionReference() {
    const permissions = state.snapshot().permissions;
    utils.setText("[data-permission-count]", `${permissions.length} permisos`);
    const container = document.querySelector("[data-permission-reference]");
    if (!container) return;
    container.innerHTML = [...groupedPermissions().entries()].map(([group, values]) => `
      <section>
        <strong>${utils.escapeHtml(permissionGroupLabel(group))}</strong>
        <div>${values.map(permission => `<span>${utils.escapeHtml(permission.label)}</span>`).join("")}</div>
      </section>
    `).join("");
  }

  function renderLibrary() {
    const container = document.querySelector("[data-role-library]");
    if (!container || !root) return;
    document.querySelectorAll("[data-role-library-filter]").forEach(button => {
      button.classList.toggle("active", (button.dataset.roleLibraryFilter || "all") === activeFilter);
    });
    const allRoles = state.snapshot().roles;
    const roles = allRoles.filter(role => activeFilter === "all" || role.type === activeFilter);
    showMessage("[data-role-admin-message]", `${roles.length} de ${allRoles.length} rol(es) visibles.`);
    container.innerHTML = roles.length
      ? roles.map(roleCard).join("")
      : ui.dataState({
        className: "role-library-empty",
        icon: "search-x",
        title: "No hay roles en esta vista.",
        description: "Cambia el filtro o crea un rol personalizado."
      });
    utils.refreshIcons(root);
  }

  function roleCard(role) {
    const labels = role.permissions.map(permissionLabel).slice(0, 8);
    const overflow = role.permissions.length - labels.length;
    return `
      <article class="role-card ${role.locked ? "locked" : "custom"}">
        <div class="role-card-head">
          ${ui.chip({ label: roleTypeLabel(role.type), status: role.locked ? "neutral" : "accent" })}
          <strong>${utils.escapeHtml(role.name)}</strong>
          <small>${utils.escapeHtml(role.description || "Sin descripción")}</small>
          <em>Jerarquía ${utils.escapeHtml(role.hierarchyLevel)}</em>
        </div>
        <div class="role-permission-chips">
          ${labels.map(label => ui.chip({ label })).join("")}
          ${overflow > 0 ? ui.chip({ label: `+${overflow}`, status: "muted" }) : ""}
        </div>
        <div class="role-card-foot">
          <small>${role.permissions.length} permiso(s)</small>
          ${role.locked ? ui.chip({ label: "Protegido", status: "muted", icon: "lock-keyhole", className: "locked-note" }) : `
            ${ui.action({ label: "Editar", icon: "pencil", className: "btn btn-ghost", data: { roleEdit: role.id } })}
            ${ui.action({ label: "Eliminar", icon: "trash-2", className: "btn btn-ghost", data: { roleDelete: role.id } })}`}
        </div>
      </article>
    `;
  }

  async function saveRole(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const id = form.elements.roleId.value;
    const payload = {
      name: form.elements.name.value,
      description: form.elements.description.value,
      hierarchyLevel: Number(form.elements.hierarchyLevel?.value || 50),
      permissions: [...form.querySelectorAll('input[name="permissions"]:checked')].map(input => input.value)
    };
    ui.setBusy(root, true, { selector: "[data-role-form] button, [data-role-form] input, [data-role-form] textarea" });
    try {
      const catalog = id
        ? await repository.updateRole(id, payload, requestOptions())
        : await repository.createRole(payload, requestOptions());
      if (signal?.aborted) return;
      state.update(catalog);
      resetForm();
      render();
      window.BCCWorkspaceAdminUsers?.syncRoleChoices?.();
      await window.BCCWorkspaceAdminUsers?.refresh?.();
      showFormMessage(id ? "Rol actualizado y usuarios sincronizados." : "Rol creado y disponible para usuarios.", "ok");
    } catch (error) {
      if (!cancelled(error)) showFormMessage(error.message, "error");
    } finally {
      ui.setBusy(root, false, { selector: "[data-role-form] button, [data-role-form] input, [data-role-form] textarea" });
    }
  }

  function editRole(id) {
    const role = state.snapshot().roles.find(item => item.id === id && !item.locked);
    const form = document.querySelector("[data-role-form]");
    if (!role || !form) return;
    form.elements.roleId.value = role.id;
    form.elements.name.value = role.name;
    form.elements.description.value = role.description;
    form.elements.hierarchyLevel.value = role.hierarchyLevel;
    renderPermissionPicker(role.permissions);
    showFormMessage("Editando rol personalizado.", "ok");
    document.querySelector("#roles")?.scrollIntoView({ block: "start" });
  }

  async function removeRole(id) {
    const role = state.snapshot().roles.find(item => item.id === id && !item.locked);
    if (!role) return;
    const confirmed = await ui.confirmAction({
      title: "Eliminar rol personalizado",
      description: `El rol "${role.name}" dejará de estar disponible y se retirará de los usuarios asignados.`,
      confirmLabel: "Eliminar rol"
    });
    if (!confirmed) return;
    ui.setBusy(root, true, { selector: "[data-role-delete], [data-role-edit]" });
    try {
      const catalog = await repository.removeRole(id, requestOptions());
      if (signal?.aborted) return;
      state.update(catalog);
      resetForm();
      render();
      window.BCCWorkspaceAdminUsers?.syncRoleChoices?.();
      await window.BCCWorkspaceAdminUsers?.refresh?.();
      showMessage("[data-role-admin-message]", "Rol eliminado y usuarios sincronizados.", "ok");
    } catch (error) {
      if (!cancelled(error)) showMessage("[data-role-admin-message]", error.message, "error");
    } finally {
      ui.setBusy(root, false, { selector: "[data-role-delete], [data-role-edit]" });
    }
  }

  function resetForm() {
    const form = document.querySelector("[data-role-form]");
    if (!form) return;
    form.reset();
    form.elements.roleId.value = "";
    form.elements.hierarchyLevel.value = 50;
    renderPermissionPicker();
    showFormMessage("");
  }

  function permissionLabel(value) {
    return state.snapshot().permissions.find(permission => permission.value === value)?.label || value;
  }

  function roleTypeLabel(type) {
    return { base: "Rol base", staff: "Rol interno", department: "Departamento", custom: "Personalizado" }[type] || type;
  }

  function permissionGroupLabel(group) {
    return {
      dashboard: "Dashboard", profile: "Perfil", downloads: "Recursos", support: "Soporte",
      staff: "Personal", clients: "Clientes", content: "Contenido", cms: "CMS",
      users: "Usuarios", forms: "Formularios", admin: "Administración",
      strategy: "Estrategia", department: "Departamentos"
    }[group] || group;
  }

  function requestOptions() {
    return signal ? { signal } : {};
  }

  function cancelled(error, requestSignal = signal) {
    return Boolean(requestSignal?.aborted || error?.code === "cancelled");
  }

  function showMessage(selector, text, tone = "neutral") {
    ui.feedback(document.querySelector(selector), text, tone);
  }

  function showFormMessage(text, tone = "neutral") {
    ui.feedback(document.querySelector("[data-role-form-message]"), text, tone);
  }

  function activate(context = {}) {
    signal = context.signal || signal;
    render();
  }

  function destroy() {
    root = null;
    signal = null;
  }

  window.BCCWorkspaceAdminRoles = Object.freeze({ init, activate, destroy, refresh, render });
})();
