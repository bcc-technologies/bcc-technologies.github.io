/* Domain contracts for administrative users, roles and access audit. */
(() => {
  function object(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function strings(value) {
    return [...new Set((Array.isArray(value) ? value : []).map(String).filter(Boolean))];
  }

  function access(value) {
    const item = object(value);
    return {
      role: String(item.role || "client"),
      staffRoles: strings(item.staffRoles),
      departments: strings(item.departments),
      customRoles: strings(item.customRoles)
    };
  }

  function user(value) {
    const item = object(value);
    const id = String(item.id || "");
    if (!id) throw new Error("Respuesta inválida: usuario sin identificador.");
    return {
      ...item,
      id,
      name: String(item.name || ""),
      displayName: String(item.displayName || item.name || ""),
      email: String(item.email || ""),
      company: String(item.company || ""),
      title: String(item.title || ""),
      role: String(item.role || "client"),
      staffRoles: strings(item.staffRoles),
      departments: strings(item.departments),
      customRoles: strings(item.customRoles),
      permissions: strings(item.permissions),
      status: String(item.status || "active"),
      hierarchyLevel: Number.isFinite(Number(item.hierarchyLevel)) ? Number(item.hierarchyLevel) : 100,
      createdAt: String(item.createdAt || ""),
      lastLoginAt: String(item.lastLoginAt || "")
    };
  }

  function role(value) {
    const item = object(value);
    const id = String(item.id || "");
    if (!id) throw new Error("Respuesta inválida: rol sin identificador.");
    return {
      ...item,
      id,
      key: String(item.key || id),
      name: String(item.name || ""),
      description: String(item.description || ""),
      type: String(item.type || "custom"),
      locked: Boolean(item.locked),
      hierarchyLevel: Number.isFinite(Number(item.hierarchyLevel)) ? Number(item.hierarchyLevel) : 50,
      permissions: strings(item.permissions).sort(),
      createdAt: String(item.createdAt || ""),
      updatedAt: String(item.updatedAt || "")
    };
  }

  function permission(value) {
    const item = object(value);
    const permissionValue = String(item.value || "");
    if (!permissionValue) throw new Error("Respuesta inválida: permiso sin valor.");
    return {
      value: permissionValue,
      label: String(item.label || permissionValue),
      group: String(item.group || "general")
    };
  }

  function auditLog(value) {
    const item = object(value);
    const id = String(item.id || "");
    if (!id) throw new Error("Respuesta inválida: registro de auditoría sin identificador.");
    return {
      id,
      actorEmail: String(item.actorEmail || ""),
      targetEmail: String(item.targetEmail || ""),
      beforeAccess: access(item.beforeAccess),
      afterAccess: access(item.afterAccess),
      createdAt: String(item.createdAt || "")
    };
  }

  function collection(payload, key, normalize) {
    const values = object(payload)[key];
    if (!Array.isArray(values)) throw new Error(`Respuesta inválida: falta ${key}.`);
    return values.map(normalize);
  }

  function roleCatalog(payload) {
    return {
      roles: collection(payload, "roles", role),
      permissions: collection(payload, "permissions", permission)
    };
  }

  function toError(error) {
    return window.BCCWorkspaceTransport.toError(error, {
      schemaPattern: /profiles|workspace_role_definitions|access_audit_logs|set_user_access|relation .* does not exist/i,
      schemaMessage: "La administración de acceso requiere activar sus tablas y funciones en Supabase.",
      fallbackMessage: "No fue posible actualizar la administración de acceso."
    });
  }

  window.BCCWorkspaceAdminAccessContracts = Object.freeze({
    access,
    user,
    role,
    permission,
    auditLog,
    users: payload => collection(payload, "users", user),
    auditLogs: payload => collection(payload, "logs", auditLog),
    roleCatalog,
    toError
  });
})();
