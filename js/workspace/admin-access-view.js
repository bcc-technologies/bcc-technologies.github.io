/* Shared labels and access-diff helpers for administrative controllers. */
(() => {
  const utils = window.BCCWorkspaceUtils;
  const FALLBACK_BASE_ROLES = utils.BASE_ROLE_OPTIONS;
  const FALLBACK_STAFF_ROLES = utils.STAFF_ROLE_OPTIONS;
  const FALLBACK_DEPARTMENTS = utils.DEPARTMENT_OPTIONS;

  function roles() {
    return window.BCCWorkspaceAdminAccessState.snapshot().roles;
  }

  function catalogOptions(type, fallback = [], valueKey = "key") {
    const options = roles()
      .filter(role => role.type === type)
      .map(role => ({
        value: String(role[valueKey] || role.id || ""),
        label: role.name || role.label || String(role[valueKey] || role.id || "")
      }))
      .filter(option => option.value);
    return options.length ? options : fallback;
  }

  const baseRoleOptions = () => catalogOptions("base", FALLBACK_BASE_ROLES, "key");
  const staffRoleOptions = () => catalogOptions("staff", FALLBACK_STAFF_ROLES, "key");
  const departmentOptions = () => catalogOptions("department", FALLBACK_DEPARTMENTS, "key");
  const customRoleOptions = () => catalogOptions("custom", [], "id");
  const optionLabel = (options, value) => options.find(option => option.value === value)?.label || "";
  const roleLabel = role => optionLabel(baseRoleOptions(), role) || role;
  const hasCmsAccess = user => Array.isArray(user?.permissions) && user.permissions.includes("cms:access");

  function permissionsForCustomRoles(customRoles = []) {
    const selected = new Set(customRoles);
    return [...new Set(roles()
      .filter(role => selected.has(role.id))
      .flatMap(role => Array.isArray(role.permissions) ? role.permissions : []))];
  }

  function accessChangeSummary(user, nextRole, nextStaffRoles, nextDepartments, nextCustomRoles = []) {
    const changes = [];
    const oldStaffRoles = Array.isArray(user.staffRoles) ? user.staffRoles : [];
    const oldDepartments = Array.isArray(user.departments) ? user.departments : [];
    const oldCustomRoles = Array.isArray(user.customRoles) ? user.customRoles : [];
    if (user.role !== nextRole) changes.push(`Rol base: ${roleLabel(user.role)} → ${roleLabel(nextRole)}`);
    if (!utils.sameSet(oldStaffRoles, nextStaffRoles)) {
      changes.push(`Roles internos: ${utils.labelsFor(oldStaffRoles, staffRoleOptions()) || "ninguno"} → ${utils.labelsFor(nextStaffRoles, staffRoleOptions()) || "ninguno"}`);
    }
    if (!utils.sameSet(oldDepartments, nextDepartments)) {
      changes.push(`Departamentos: ${utils.labelsFor(oldDepartments, departmentOptions()) || "ninguno"} → ${utils.labelsFor(nextDepartments, departmentOptions()) || "ninguno"}`);
    }
    if (!utils.sameSet(oldCustomRoles, nextCustomRoles)) {
      changes.push(`Roles personalizados: ${utils.labelsFor(oldCustomRoles, customRoleOptions()) || "ninguno"} → ${utils.labelsFor(nextCustomRoles, customRoleOptions()) || "ninguno"}`);
    }
    return changes;
  }

  function shortAccessChange(before = {}, after = {}) {
    return accessChangeSummary({
      role: before.role || "client",
      staffRoles: before.staffRoles || [],
      departments: before.departments || [],
      customRoles: before.customRoles || []
    }, after.role || "client", after.staffRoles || [], after.departments || [], after.customRoles || [])[0] || "Acceso revisado";
  }

  function isSensitiveAccessChange(user, nextRole, nextStaffRoles, nextDepartments, nextCustomRoles = []) {
    const currentUser = window.BCCWorkspaceAdminAccessState.snapshot().currentUser;
    const oldStaffRoles = Array.isArray(user.staffRoles) ? user.staffRoles : [];
    const oldCustomRoles = Array.isArray(user.customRoles) ? user.customRoles : [];
    if (currentUser?.id === user.id || user.role === "admin" || nextRole === "admin") return true;
    if (!utils.sameSet(oldStaffRoles, nextStaffRoles)
      && nextStaffRoles.some(role => ["author", "cofounder", "department_director", "maps_developer", "maps_release_manager", "maps_license_manager", "maps_product_analyst"].includes(role))) return true;
    if (!utils.sameSet(oldCustomRoles, nextCustomRoles)
      && permissionsForCustomRoles(nextCustomRoles).some(permission => ["admin:view", "users:manage", "cms:access", "forms:manage", "maps:developer:access", "maps:developer:write", "maps:developer:release"].includes(permission))) return true;
    return !utils.sameSet(user.departments || [], nextDepartments)
      && nextDepartments.some(department => ["finance", "hr"].includes(department));
  }

  window.BCCWorkspaceAdminAccessView = Object.freeze({
    baseRoleOptions,
    staffRoleOptions,
    departmentOptions,
    customRoleOptions,
    roleLabel,
    hasCmsAccess,
    permissionsForCustomRoles,
    accessChangeSummary,
    shortAccessChange,
    isSensitiveAccessChange
  });
})();
