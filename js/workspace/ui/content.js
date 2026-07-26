/* Content and data-display primitives. */
(() => {
  const library = window.BCCWorkspaceUILibrary;
  const { foundation } = library.require(["foundation"]);
  const escapeHtml = window.BCCWorkspaceUtils.escapeHtml;
  const { classes, icon, action } = foundation;

  function metric({ label, value, detail = "", className = "" }) {
    const numeric = Number(value || 0);
    return `<article class="${classes("workspace-stat", className)}">
      <span>${escapeHtml(label)}</span>
      <strong>${Number.isFinite(numeric) ? numeric.toLocaleString() : "0"}</strong>
      ${detail ? `<small>${escapeHtml(detail)}</small>` : ""}
    </article>`;
  }

  function statusBadge({ label, status = "neutral", icon: iconName = "", className = "" }) {
    return `<span class="${classes("workspace-status-badge", `is-${status}`, className)}">
      ${iconName ? icon(iconName, "xs") : ""}
      ${escapeHtml(label)}
    </span>`;
  }

  function sectionHeader({ eyebrow = "", title, description = "", level = 2, className = "", actionsClassName = "", actions = [], status = null }) {
    const headingLevel = Math.max(1, Math.min(6, Number(level) || 2));
    const trailing = [
      status ? statusBadge(status) : "",
      ...actions.map(action)
    ].filter(Boolean).join("");
    return `<header class="${classes("workspace-section-header", className)}">
      <div class="workspace-section-header-copy">
        ${eyebrow ? `<span class="workspace-eyebrow">${escapeHtml(eyebrow)}</span>` : ""}
        <h${headingLevel}>${escapeHtml(title)}</h${headingLevel}>
        ${description ? `<p>${escapeHtml(description)}</p>` : ""}
      </div>
      ${trailing ? `<div class="${classes("workspace-section-header-actions", actionsClassName)}">${trailing}</div>` : ""}
    </header>`;
  }

  function chip({ label, status = "neutral", icon: iconName = "", className = "" }) {
    return `<span class="${classes("workspace-chip", `is-${status}`, className)}">
      ${iconName ? icon(iconName, "xs") : ""}
      ${escapeHtml(label)}
    </span>`;
  }

  function chipList({ items = [], emptyLabel = "", className = "" }) {
    const values = items.filter(item => item?.label);
    if (!values.length) return emptyLabel ? chip({ label: emptyLabel, status: "muted", className }) : "";
    return `<span class="${classes("workspace-chip-list", className)}">${values.map(chip).join("")}</span>`;
  }

  function progress({ value = 0, label = "", className = "", tone = "accent" } = {}) {
    const numeric = Number(value);
    const normalized = Number.isFinite(numeric) ? Math.max(0, Math.min(100, numeric)) : 0;
    return `<progress class="${classes("workspace-progress", `is-${tone}`, className)}" max="100" value="${normalized}"${label ? ` aria-label="${escapeHtml(label)}"` : ""}>${normalized}%</progress>`;
  }

  function activityItem({ title, description = "", meta = "", className = "" }) {
    return `<li class="${classes("workspace-activity-item", className)}">
      <span class="activity-dot" aria-hidden="true"></span>
      <div>
        <strong>${escapeHtml(title)}</strong>
        ${description ? `<p>${escapeHtml(description)}</p>` : ""}
        ${meta ? `<small>${escapeHtml(meta)}</small>` : ""}
      </div>
    </li>`;
  }

  library.register("content", { metric, statusBadge, sectionHeader, chip, chipList, progress, activityItem });
})();
