/* Accessible tabs, layers and confirmation flows. */
(() => {
  const library = window.BCCWorkspaceUILibrary;
  const { foundation } = library.require(["foundation"]);
  const utils = window.BCCWorkspaceUtils;

  function bindTabs(root, options = {}) {
    const tabSelector = options.tabSelector || "[role=tab]";
    const panelSelector = options.panelSelector || "[role=tabpanel]";
    const valueForTab = options.valueForTab || (tab => tab.dataset.tab);
    const valueForPanel = options.valueForPanel || (panel => panel.dataset.panel);
    const tabs = () => [...root.querySelectorAll(tabSelector)];

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
    activate(options.initialValue || (selectedTab ? valueForTab(selectedTab) : ""), { source: "initial" });
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
        <div class="workspace-confirm-icon">${foundation.icon("triangle-alert", "sm")}</div>
        <div>
          <span class="workspace-eyebrow">Confirmación requerida</span>
          <h2 data-workspace-confirm-title>Confirmar acción</h2>
          <p data-workspace-confirm-description></p>
        </div>
        <div class="workspace-confirm-actions">
          ${foundation.action({ label: "Cancelar", type: "submit", value: "cancel", className: "btn btn-ghost" })}
          ${foundation.action({
            label: "Confirmar",
            type: "submit",
            value: "confirm",
            className: "btn btn-primary",
            data: { workspaceConfirmSubmit: true }
          })}
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
    submit.querySelector("span").textContent = options.confirmLabel || "Confirmar";
    submit.dataset.tone = options.tone || "danger";
    dialog.returnValue = "cancel";
    openLayer(dialog);
    return new Promise(resolve => {
      dialog.addEventListener("close", () => resolve(dialog.returnValue === "confirm"), { once: true });
    });
  }

  library.register("interactions", { bindTabs, openLayer, closeLayer, confirmAction });
})();
