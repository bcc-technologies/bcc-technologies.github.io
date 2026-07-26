/* Loading, empty, feedback and busy-state primitives. */
(() => {
  const library = window.BCCWorkspaceUILibrary;
  const { foundation } = library.require(["foundation"]);
  const utils = window.BCCWorkspaceUtils;
  const escapeHtml = utils.escapeHtml;
  const { classes, icon, action } = foundation;

  function dataState({ title, description = "", icon: iconName = "inbox", action: stateAction = null, className = "", tone = "empty", role = "" }) {
    const semanticRole = role || (tone === "error" ? "alert" : tone === "loading" ? "status" : "");
    return `<div class="${classes("workspace-data-state", `is-${tone}`, className)}"${semanticRole ? ` role="${semanticRole}"` : ""}>
      ${icon(iconName, "lg")}
      <strong>${escapeHtml(title)}</strong>
      ${description ? `<span>${escapeHtml(description)}</span>` : ""}
      ${stateAction ? action(stateAction) : ""}
    </div>`;
  }

  function emptyState(options) {
    return dataState({ ...options, tone: "empty" });
  }

  function loadingState({ title = "Cargando…", description = "", className = "", lines = 3 } = {}) {
    return `<div class="${classes("workspace-data-state", "is-loading", className)}" role="status" aria-live="polite">
      <span class="sr-only">${escapeHtml(title)}</span>
      <div class="workspace-skeleton" aria-hidden="true">
        ${Array.from({ length: Math.max(1, Math.min(6, Number(lines) || 3)) }, () => "<span></span>").join("")}
      </div>
      ${description ? `<small>${escapeHtml(description)}</small>` : ""}
    </div>`;
  }

  function tableEmptyRow({ colspan = 1, title, description = "", icon: iconName = "inbox", className = "" }) {
    const safeColspan = Math.max(1, Number(colspan) || 1);
    return `<tr><td class="${classes("table-empty", className)}" colspan="${safeColspan}">${dataState({
      title,
      description,
      icon: iconName,
      className: "is-compact",
      tone: "empty"
    })}</td></tr>`;
  }

  function feedback(target, message, tone = "neutral") {
    if (!target) return;
    target.setAttribute("role", tone === "error" ? "alert" : "status");
    target.setAttribute("aria-live", tone === "error" ? "assertive" : "polite");
    utils.setMessage(target, message, tone);
  }

  function setBusy(root, value, options = {}) {
    if (!root) return;
    const busy = Boolean(value);
    root.setAttribute("aria-busy", busy ? "true" : "false");
    const selector = options.selector || "[data-workspace-control]";
    root.querySelectorAll(selector).forEach(control => {
      const idleDisabled = control.dataset.idleDisabled === "true";
      control.disabled = busy || idleDisabled;
    });
    if (options.label) root.dataset.busyLabel = busy ? options.label : "";
  }

  library.register("states", { dataState, emptyState, loadingState, tableEmptyRow, feedback, setBusy });
})();
