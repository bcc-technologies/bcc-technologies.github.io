/* Shared, framework-free workspace UI primitives. */
(() => {
  const utils = window.BCCWorkspaceUtils;
  const escapeHtml = utils.escapeHtml;

  function classes(...values) {
    return values.flatMap(value => String(value || "").split(/\s+/)).filter(Boolean).join(" ");
  }

  function safeHref(value) {
    const href = String(value || "").trim();
    return /^(?:\/(?!\/)|#|https:\/\/)/i.test(href) ? href : "#";
  }

  function metric({ label, value, detail = "", className = "" }) {
    const numeric = Number(value || 0);
    return `<article class="${classes("workspace-stat", className)}">
      <span>${escapeHtml(label)}</span>
      <strong>${Number.isFinite(numeric) ? numeric.toLocaleString() : "0"}</strong>
      ${detail ? `<small>${escapeHtml(detail)}</small>` : ""}
    </article>`;
  }

  function emptyState({ title, description = "", icon = "inbox", action = null, className = "" }) {
    const actionMarkup = action?.href && action?.label
      ? `<a class="${escapeHtml(classes("btn", action.className))}" href="${escapeHtml(safeHref(action.href))}">${escapeHtml(action.label)}</a>`
      : "";
    return `<div class="${classes("workspace-data-state", "is-empty", className)}">
      <i data-lucide="${escapeHtml(icon)}"></i>
      <strong>${escapeHtml(title)}</strong>
      ${description ? `<span>${escapeHtml(description)}</span>` : ""}
      ${actionMarkup}
    </div>`;
  }

  function statusBadge({ label, status = "neutral", icon = "", className = "" }) {
    return `<span class="${classes("workspace-status-badge", `is-${status}`, className)}">
      ${icon ? `<i data-lucide="${escapeHtml(icon)}"></i>` : ""}
      ${escapeHtml(label)}
    </span>`;
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

  function bindTabs(root, options = {}) {
    const tabSelector = options.tabSelector || "[role=tab]";
    const panelSelector = options.panelSelector || "[role=tabpanel]";
    const valueForTab = options.valueForTab || (tab => tab.dataset.tab);
    const valueForPanel = options.valueForPanel || (panel => panel.dataset.panel);

    function tabs() {
      return [...root.querySelectorAll(tabSelector)];
    }

    function activate(value, config = {}) {
      const availableTabs = tabs();
      const target = availableTabs.find(tab => valueForTab(tab) === value) || availableTabs[0];
      if (!target) return "";
      const nextValue = valueForTab(target);
      availableTabs.forEach(tab => {
        const active = tab === target;
        tab.classList.toggle(options.activeClass || "is-active", active);
        tab.setAttribute("aria-selected", active ? "true" : "false");
        tab.setAttribute("tabindex", active ? "0" : "-1");
      });
      root.querySelectorAll(panelSelector).forEach(panel => {
        panel.hidden = valueForPanel(panel) !== nextValue;
      });
      if (config.focus) target.focus();
      options.onChange?.(nextValue, config);
      return nextValue;
    }

    function onClick(event) {
      const tab = event.target.closest(tabSelector);
      if (tab && root.contains(tab)) activate(valueForTab(tab), { source: "user" });
    }

    function onKeydown(event) {
      const tab = event.target.closest(tabSelector);
      if (!tab || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      const availableTabs = tabs();
      const current = availableTabs.indexOf(tab);
      let next = current;
      if (event.key === "ArrowLeft") next = (current - 1 + availableTabs.length) % availableTabs.length;
      if (event.key === "ArrowRight") next = (current + 1) % availableTabs.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = availableTabs.length - 1;
      event.preventDefault();
      activate(valueForTab(availableTabs[next]), { focus: true, source: "user" });
    }

    root.addEventListener("click", onClick);
    root.addEventListener("keydown", onKeydown);
    const selectedTab = tabs().find(tab => tab.getAttribute("aria-selected") === "true");
    const initial = options.initialValue || (selectedTab ? valueForTab(selectedTab) : "");
    activate(initial, { source: "initial" });
    return Object.freeze({
      activate,
      destroy() {
        root.removeEventListener("click", onClick);
        root.removeEventListener("keydown", onKeydown);
      }
    });
  }

  const layerTriggers = new WeakMap();

  function openLayer(dialog, options = {}) {
    if (!dialog || dialog.open) return false;
    const trigger = options.trigger || document.activeElement;
    if (trigger?.focus) layerTriggers.set(dialog, trigger);
    dialog.showModal();
    const focusTarget = options.focusTarget
      || dialog.querySelector("[autofocus], input:not([type=hidden]), select, textarea, button");
    focusTarget?.focus?.();
    dialog.addEventListener("close", () => {
      const previousTrigger = layerTriggers.get(dialog);
      layerTriggers.delete(dialog);
      if (previousTrigger?.isConnected) previousTrigger.focus();
    }, { once: true });
    return true;
  }

  function closeLayer(dialog, returnValue = "cancel") {
    if (!dialog?.open) return false;
    dialog.close(returnValue);
    return true;
  }

  function ensureConfirmDialog() {
    let dialog = document.querySelector("[data-workspace-confirm-dialog]");
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.className = "workspace-confirm-dialog";
    dialog.dataset.workspaceConfirmDialog = "";
    dialog.innerHTML = `
      <form method="dialog" class="workspace-confirm-panel">
        <div class="workspace-confirm-icon"><i data-lucide="triangle-alert"></i></div>
        <div>
          <span class="workspace-eyebrow">Confirmación requerida</span>
          <h2 data-workspace-confirm-title>Confirmar acción</h2>
          <p data-workspace-confirm-description></p>
        </div>
        <div class="workspace-confirm-actions">
          <button class="btn btn-ghost" type="submit" value="cancel">Cancelar</button>
          <button class="btn btn-primary" type="submit" value="confirm" data-workspace-confirm-submit>Confirmar</button>
        </div>
      </form>`;
    document.body.append(dialog);
    utils.refreshIcons(dialog);
    return dialog;
  }

  function confirmAction(options = {}) {
    const dialog = ensureConfirmDialog();
    if (dialog.open) return Promise.resolve(false);
    dialog.querySelector("[data-workspace-confirm-title]").textContent = options.title || "Confirmar acción";
    dialog.querySelector("[data-workspace-confirm-description]").textContent = options.description || "";
    const submit = dialog.querySelector("[data-workspace-confirm-submit]");
    submit.textContent = options.confirmLabel || "Confirmar";
    submit.dataset.tone = options.tone || "danger";
    dialog.returnValue = "cancel";
    openLayer(dialog);
    return new Promise(resolve => {
      dialog.addEventListener("close", () => resolve(dialog.returnValue === "confirm"), { once: true });
    });
  }

  window.BCCWorkspaceUI = Object.freeze({
    metric,
    emptyState,
    statusBadge,
    feedback,
    setBusy,
    bindTabs,
    openLayer,
    closeLayer,
    confirmAction
  });
})();
