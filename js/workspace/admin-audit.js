/* Access-audit controller. */
(() => {
  const repository = window.BCCWorkspaceAdminAccessRepository;
  const state = window.BCCWorkspaceAdminAccessState;
  const view = window.BCCWorkspaceAdminAccessView;
  const utils = window.BCCWorkspaceUtils;
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
    try {
      const auditLogs = await repository.listAudit(requestSignal ? { signal: requestSignal } : {});
      if (requestSignal?.aborted || !root) return;
      state.update({ auditLogs });
      render();
    } catch (error) {
      if (!cancelled(error, requestSignal)) showMessage(error.message, "error");
    }
  }

  function render() {
    const feed = document.querySelector("[data-audit-feed]");
    if (!feed || !root) return;
    const logs = state.snapshot().auditLogs;
    feed.replaceChildren(...logs.slice(0, 10).map(auditItem));
    showMessage(logs.length ? "Cambios de permisos registrados." : "Todavía no hay cambios registrados.");
    utils.setText("[data-audit-count]", String(logs.length));
    utils.setText("[data-metric-changes]", String(logs.length));
  }

  function auditItem(log) {
    const item = document.createElement("li");
    item.innerHTML = `
      <span class="activity-dot"></span>
      <div>
        <strong>${utils.escapeHtml(log.actorEmail || "Administrador")}</strong>
        <p>${utils.escapeHtml(view.shortAccessChange(log.beforeAccess, log.afterAccess))}</p>
        <small>${utils.escapeHtml(log.targetEmail || "-")} · ${log.createdAt ? new Date(log.createdAt).toLocaleString() : "-"}</small>
      </div>
    `;
    return item;
  }

  function showMessage(text, tone = "neutral") {
    const target = document.querySelector("[data-audit-message]");
    if (target) utils.renderMessageBlock(target, text, tone);
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
