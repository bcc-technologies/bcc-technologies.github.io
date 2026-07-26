/* Access-audit controller. */
(() => {
  const repository = window.BCCWorkspaceAdminAccessRepository;
  const state = window.BCCWorkspaceAdminAccessState;
  const view = window.BCCWorkspaceAdminAccessView;
  const utils = window.BCCWorkspaceUtils;
  const ui = window.BCCWorkspaceUI;
  let root = null;
  let signal = null;

  async function init(user, context = {}) {
    root = context.root || document.querySelector("#auditoria");
    signal = context.signal || null;
    if (!root) return;
    state.update({ currentUser: user });
    await refresh();
  }

  async function refresh() {
    const requestSignal = signal;
    ui.setBusy(root, true);
    try {
      const auditLogs = await repository.listAudit(requestSignal ? { signal: requestSignal } : {});
      if (requestSignal?.aborted || !root) return;
      state.update({ auditLogs });
      render();
    } catch (error) {
      if (!cancelled(error, requestSignal)) showMessage(error.message, "error");
    } finally {
      ui.setBusy(root, false);
    }
  }

  function render() {
    const feed = document.querySelector("[data-audit-feed]");
    if (!feed || !root) return;
    const logs = state.snapshot().auditLogs;
    feed.innerHTML = logs.slice(0, 10).map(auditItem).join("");
    showMessage(logs.length ? "Cambios de permisos registrados." : "Todavía no hay cambios registrados.");
    utils.setText("[data-audit-count]", String(logs.length));
    utils.setText("[data-metric-changes]", String(logs.length));
  }

  function auditItem(log) {
    return ui.activityItem({
      title: log.actorEmail || "Administrador",
      description: view.shortAccessChange(log.beforeAccess, log.afterAccess),
      meta: `${log.targetEmail || "-"} · ${log.createdAt ? new Date(log.createdAt).toLocaleString() : "-"}`
    });
  }

  function showMessage(text, tone = "neutral") {
    ui.feedback(document.querySelector("[data-audit-message]"), text, tone);
  }

  function cancelled(error, requestSignal = signal) {
    return Boolean(requestSignal?.aborted || error?.code === "cancelled");
  }

  function activate(context = {}) {
    signal = context.signal || signal;
    render();
  }

  function destroy() {
    root = null;
    signal = null;
  }

  window.BCCWorkspaceAdminAudit = Object.freeze({ init, activate, destroy, refresh, render });
})();
