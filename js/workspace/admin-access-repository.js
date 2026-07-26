/* Repository for administrative access use cases. */
(() => {
  const transport = window.BCCWorkspaceTransport;
  const contracts = window.BCCWorkspaceAdminAccessContracts;

  async function run(operation) {
    try {
      return await operation();
    } catch (error) {
      throw contracts.toError(error);
    }
  }

  const repository = {
    listUsers(options = {}) {
      return run(async () => contracts.users(await transport.request("/api/admin/users", options)));
    },
    listAudit(options = {}) {
      return run(async () => contracts.auditLogs(await transport.request("/api/admin/access-audit", options)));
    },
    listRoles(options = {}) {
      return run(async () => contracts.roleCatalog(await transport.request("/api/admin/roles", options)));
    },
    updateUserAccess(userId, values, options = {}) {
      return run(() => transport.request(`/api/admin/users/${encodeURIComponent(userId)}/role`, {
        ...options,
        method: "PATCH",
        body: values
      }));
    },
    createRole(values, options = {}) {
      return run(async () => contracts.roleCatalog(await transport.request("/api/admin/roles", {
        ...options,
        method: "POST",
        body: values
      })));
    },
    updateRole(roleId, values, options = {}) {
      return run(async () => contracts.roleCatalog(await transport.request(
        `/api/admin/roles/${encodeURIComponent(roleId)}`,
        { ...options, method: "PATCH", body: values }
      )));
    },
    removeRole(roleId, options = {}) {
      return run(async () => contracts.roleCatalog(await transport.request(
        `/api/admin/roles/${encodeURIComponent(roleId)}`,
        { ...options, method: "DELETE" }
      )));
    }
  };

  window.BCCWorkspaceAdminAccessRepository = Object.freeze(repository);
})();
