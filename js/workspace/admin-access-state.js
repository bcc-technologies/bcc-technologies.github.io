/* Shared in-memory state for the administrative access bounded context. */
(() => {
  const state = {
    currentUser: null,
    users: [],
    roles: [],
    permissions: [],
    auditLogs: []
  };
  const listeners = new Set();

  function snapshot() {
    return Object.freeze({
      currentUser: state.currentUser,
      users: state.users.slice(),
      roles: state.roles.slice(),
      permissions: state.permissions.slice(),
      auditLogs: state.auditLogs.slice()
    });
  }

  function update(patch = {}) {
    Object.keys(state).forEach(key => {
      if (Object.prototype.hasOwnProperty.call(patch, key)) state[key] = patch[key];
    });
    const value = snapshot();
    listeners.forEach(listener => listener(value));
    return value;
  }

  function subscribe(listener) {
    if (typeof listener !== "function") return () => {};
    listeners.add(listener);
    listener(snapshot());
    return () => listeners.delete(listener);
  }

  window.BCCWorkspaceAdminAccessState = Object.freeze({ snapshot, update, subscribe });
})();
