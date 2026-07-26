/* Safe markup foundations shared by every workspace UI module. */
(() => {
  const library = window.BCCWorkspaceUILibrary;
  const escapeHtml = window.BCCWorkspaceUtils.escapeHtml;

  function classes(...values) {
    return values
      .flatMap(value => String(value || "").split(/\s+/))
      .filter(value => /^[a-z0-9_-]+$/i.test(value))
      .join(" ");
  }

  function safeHref(value) {
    const href = String(value || "").trim();
    return /^(?:\/(?!\/)|#|https:\/\/)/i.test(href) ? href : "#";
  }

  function dataAttributes(values = {}) {
    return Object.entries(values).flatMap(([key, value]) => {
      const safeKey = String(key || "").trim()
        .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
        .replace(/[^a-z0-9-]/gi, "-")
        .toLowerCase();
      if (!safeKey || value === false || value == null) return [];
      return [value === true
        ? `data-${safeKey}`
        : `data-${safeKey}="${escapeHtml(value)}"`];
    });
  }

  function icon(name, size = "md") {
    return `<i data-lucide="${escapeHtml(name || "circle-help")}" data-icon-size="${escapeHtml(size)}"></i>`;
  }

  function action(actionOptions = {}) {
    const label = String(actionOptions.label || "").trim();
    if (!label) return "";
    const className = classes(
      actionOptions.className || "btn btn-ghost",
      actionOptions.compact && "btn-compact",
      actionOptions.iconOnly && "workspace-icon-action"
    );
    const attributes = [
      `class="${escapeHtml(className)}"`,
      ...dataAttributes(actionOptions.data)
    ];
    const iconMarkup = actionOptions.icon ? icon(actionOptions.icon, actionOptions.iconSize || "sm") : "";
    const visibleLabel = `<span${actionOptions.iconOnly ? ' class="sr-only"' : ""}>${escapeHtml(label)}</span>`;

    if (actionOptions.href) {
      attributes.push(`href="${escapeHtml(safeHref(actionOptions.href))}"`);
      if (actionOptions.external) attributes.push('target="_blank"', 'rel="noopener noreferrer"');
      if (actionOptions.disabled) attributes.push('aria-disabled="true"', 'tabindex="-1"');
      return `<a ${attributes.join(" ")}>${iconMarkup}${visibleLabel}</a>`;
    }

    attributes.push(`type="${escapeHtml(actionOptions.type || "button")}"`);
    if (actionOptions.value != null) attributes.push(`value="${escapeHtml(actionOptions.value)}"`);
    if (actionOptions.ariaLabel) attributes.push(`aria-label="${escapeHtml(actionOptions.ariaLabel)}"`);
    if (actionOptions.disabled) attributes.push("disabled");
    return `<button ${attributes.join(" ")}>${iconMarkup}${visibleLabel}</button>`;
  }

  library.register("foundation", { classes, safeHref, dataAttributes, icon, action });
})();
