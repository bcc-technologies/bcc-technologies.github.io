(() => {
  const contracts = window.BCCWorkspaceMapContracts;
  const repository = window.BCCWorkspaceMapRepository.client;
  const utils = window.BCCWorkspaceUtils;
  const ui = window.BCCWorkspaceUI;
  const escapeHtml = utils.escapeHtml;
  const refreshIcons = utils.refreshIcons;
  let root = null;
  let currentUser = null;
  let dashboard = emptyDashboard();
  let selectedLicenseId = "";
  let platformAccess = [];
  let internalEntitlements = [];
  let busy = false;

  function emptyDashboard() {
    return { accounts: [], licenses: [], members: [], assignments: [], recent_events: [] };
  }

  function init(user) {
    root = document.querySelector("[data-client-map-licenses]");
    if (!root || root.dataset.ready === "true") return;
    root.dataset.ready = "true";
    currentUser = user;
    root.addEventListener("click", handleClick);
    root.addEventListener("change", handleChange);
    root.addEventListener("submit", handleSubmit);
    root.setAttribute("aria-busy", "true");
    void loadDashboard();
  }

  async function loadDashboard({ successMessage = "" } = {}) {
    setBusy(true);
    setMessage("Actualizando tus licencias MAP...");
    try {
      const payload = await repository.getDashboard();
      platformAccess = payload.platformAccess;
      internalEntitlements = payload.entitlements;
      dashboard = payload.dashboard;
      selectDefaultLicense();
      render();
      setMessage(successMessage, successMessage ? "ok" : "neutral");
    } catch (error) {
      render();
      setMessage(userMessage(error), "error");
    } finally {
      setBusy(false);
    }
  }

  function selectDefaultLicense() {
    const manageable = dashboard.licenses.map(toLicenseViewModel).filter(item => item.canManage);
    if (!manageable.some(item => item.license_id === selectedLicenseId)) {
      selectedLicenseId = manageable[0]?.license_id || "";
    }
  }

  function render() {
    if (!root) return;
    root.innerHTML = `
      <section class="client-license-shell">
        ${ui.sectionHeader({
          className: "module-surface client-license-hero",
          actionsClassName: "client-license-actions",
          eyebrow: "MAP Platform",
          title: "Mis licencias",
          level: 1,
          description: "Consulta vigencia y consumo. Si administras una organización, también puedes asignar y liberar plazas.",
          actions: [
            { label: "Ver productos", href: "/products.html", icon: "package-search", compact: true, className: "btn btn-ghost" },
            {
              label: "Actualizar",
              icon: "refresh-cw",
              compact: true,
              disabled: busy,
              className: "btn btn-ghost",
              data: { clientLicenseRefresh: true, clientLicenseControl: true }
            }
          ]
        })}
        <p class="client-license-message" data-client-license-message role="status" aria-live="polite" hidden></p>
        ${renderStaffLicense()}
        ${renderPlatformAccess()}
        ${renderCommercialWorkspace()}
        ${renderActivity()}
      </section>`;
    refreshIcons();
  }

  function renderCommercialWorkspace() {
    const hasCommercialLicenses = dashboard.licenses.length > 0;
    return `<section class="client-license-commercial ${hasCommercialLicenses ? "has-licenses" : "is-empty"}">
      ${ui.sectionHeader({
        className: "client-license-section-head",
        eyebrow: "Acceso asociado",
        title: "Licencias comerciales y evaluaciones",
        description: "Sólo mostramos licencias que administras o que están asignadas directamente a tu usuario."
      })}
      ${hasCommercialLicenses ? `${renderFeaturedLicense()}${renderAttention()}${renderMetrics()}` : ""}
      ${renderLicenses()}
      ${renderSeatManagement()}
    </section>`;
  }

  function renderStaffLicense() {
    const entitlement = internalEntitlements.find(item => item?.entitlement_key === "map.staff");
    if (!entitlement) return "";
    const products = Array.isArray(entitlement.product_keys) ? entitlement.product_keys : [];
    return `<article class="module-surface client-license-direct-access is-staff-entitlement">
      ${ui.sectionHeader({
        className: "client-license-section-head",
        eyebrow: "Beneficio exclusivo del staff",
        title: "Licencia MAP Staff",
        description: "Acceso gratuito a la suite MAP mientras tu perfil de staff permanezca activo. Es personal, no consume plazas y no forma parte del catálogo comercial.",
        status: { label: "Activa", status: "success", icon: "badge-check" }
      })}
      <div class="client-license-badges">
        ${products.map(key => `<span class="client-license-tag">${escapeHtml(productName(key))}</span>`).join("")}
        <span class="client-license-tag">Sin vencimiento</span>
        <span class="client-license-tag">$0</span>
      </div>
    </article>`;
  }

  function renderPlatformAccess() {
    if (!platformAccess.length) return "";
    return `<article class="module-surface client-license-direct-access is-platform-access">
      ${ui.sectionHeader({
        className: "client-license-section-head",
        eyebrow: "Permisos adicionales",
        title: "Herramientas internas autorizadas",
        description: "Estos permisos son independientes de la licencia MAP Staff y determinan qué herramientas técnicas o administrativas puedes utilizar.",
        status: { label: "Autorizado", status: "success", icon: "shield-check" }
      })}
      <div class="client-license-badges">
        ${platformAccess.map(key => `<span class="client-license-tag">${escapeHtml(platformAccessLabel(key))}</span>`).join("")}
      </div>
    </article>`;
  }

  function platformAccessLabel(key) {
    return contracts.platformAccessLabel(key);
  }

  function renderFeaturedLicense() {
    const licenses = dashboard.licenses.map(toLicenseViewModel);
    const featured = licenses.find(item => item.is_assigned_to_me && item.status === "active")
      || licenses.find(item => item.status === "active")
      || licenses.sort((a, b) => a.statusMeta.priority - b.statusMeta.priority)[0];
    if (!featured) {
      return internalEntitlements.length ? "" : `<div class="client-license-hero-summary is-empty">${ui.icon("badge-plus", "lg")}<span>Tu acceso MAP aparecerá aquí cuando una licencia sea asignada.</span></div>`;
    }

    return `<div class="client-license-hero-summary">
      <div class="client-license-hero-product">${ui.icon("scan-line", "lg")}<div><span>Tu acceso principal</span><strong>${escapeHtml(featured.productName)}</strong><small>${escapeHtml(featured.plan_name || "Licencia MAP")}</small></div></div>
      <div class="client-license-hero-status"><span class="client-license-tag ${escapeHtml(featured.status)}">${ui.icon(featured.statusMeta.icon, "xs")}${escapeHtml(featured.statusMeta.label)}</span><strong>${featured.ends_at ? `Hasta ${formatDate(featured.ends_at)}` : "Sin vencimiento"}<small>${featured.is_assigned_to_me ? " Acceso asignado a tu usuario" : " Acceso de tu organización"}</small></strong></div>
    </div>`;
  }

  function renderAttention() {
    const license = dashboard.licenses.map(toLicenseViewModel).find(item => item.needsAttention);
    if (!license) return "";
    const copy = license.status === "expiring"
      ? `Tu licencia ${license.productName} vence el ${formatDate(license.ends_at)}. Coordina la renovación para evitar interrupciones.`
      : `Tu licencia ${license.productName} está ${license.statusMeta.label.toLowerCase()}. Revisa las opciones con tu administrador o soporte.`;
    return `<aside class="client-license-attention" data-tone="${escapeHtml(license.statusMeta.tone)}">${ui.icon(license.statusMeta.icon, "md")}<div><strong>Requiere atención</strong><span>${escapeHtml(copy)}</span></div><a class="btn btn-ghost btn-compact" href="/contactUs.html">Contactar soporte</a></aside>`;
  }

  function renderMetrics() {
    if (!dashboard.licenses.length) return "";
    const viewModels = dashboard.licenses.map(toLicenseViewModel);
    const activeLicenses = viewModels.filter(item => item.status === "active").length;
    const ownSeats = dashboard.assignments.filter(item => item.is_mine).length;
    const availableSeats = viewModels.filter(item => item.canManage).reduce((total, item) => total + item.availableSeats, 0);
    const expiringSoon = viewModels.filter(item => item.status === "expiring").length;

    return `<section class="client-license-metrics" aria-label="Resumen de licencias">
      ${metric("Licencias vigentes", activeLicenses, `${dashboard.licenses.length} visibles`)}
      ${metric("Mis plazas", ownSeats, "Asignadas a tu usuario")}
      ${metric("Plazas disponibles", availableSeats, "En cuentas que administras")}
      ${metric("Vencen pronto", expiringSoon, "Durante los próximos 30 días")}
    </section>`;
  }

  function metric(label, value, detail) {
    return ui.metric({ label, value, detail, className: "client-license-metric" });
  }

  function renderLicenses() {
    if (!dashboard.licenses.length) {
      return ui.emptyState({
        className: "client-license-empty",
        icon: internalEntitlements.length ? "shield-check" : "badge-x",
        title: "No hay licencias comerciales asociadas a tu usuario.",
        description: internalEntitlements.length
          ? "Tu licencia MAP Staff está activa y aparece arriba. Las licencias comerciales o de evaluación se mostrarán aquí por separado."
          : "Si esperabas una licencia, solicita al administrador de tu organización que te asigne una plaza.",
        action: internalEntitlements.length ? null : {
          href: "/contactUs.html",
          label: "Contactar soporte",
          className: "btn-primary"
        }
      });
    }

    return `<div class="client-license-list">${dashboard.licenses.map(rawLicense => {
      const item = toLicenseViewModel(rawLicense);
      return `<article class="client-license-card" data-workspace-searchable>
        <div class="client-license-card-head">
          <div>
            <span class="workspace-eyebrow">${escapeHtml(item.account_name || "Cuenta MAP")}</span>
            <h2>${escapeHtml(item.productName)}</h2>
            <p>${escapeHtml(item.plan_name || item.license_type || "Licencia")}</p>
          </div>
          <div class="client-license-badges">
            ${item.is_evaluation ? '<span class="client-license-tag">Evaluación</span>' : ""}
            ${item.is_assigned_to_me ? '<span class="client-license-tag">Asignada a mí</span>' : ""}
            <span class="client-license-tag ${escapeHtml(item.status)}">${ui.icon(item.statusMeta.icon, "xs")}${escapeHtml(item.statusMeta.label)}</span>
          </div>
        </div>
        <div>
          <div class="client-license-card-head"><span>Uso de plazas</span><strong>${item.assignedSeats} / ${item.seatLimit}</strong></div>
          ${ui.progress({ value: item.seatUsage, label: `${item.seatUsage}% de plazas ocupadas`, className: `client-license-seat-bar ${item.seatUsage >= 100 ? "is-full" : item.seatUsage >= 80 ? "is-near-capacity" : ""}`, tone: item.seatUsage >= 100 ? "danger" : item.seatUsage >= 80 ? "warning" : "accent" })}
        </div>
        <dl class="client-license-details">
          <div><dt>Inicio</dt><dd>${formatDate(item.starts_at)}</dd></div>
          <div><dt>Vencimiento</dt><dd>${item.ends_at ? formatDate(item.ends_at) : "Sin vencimiento"}</dd></div>
          <div><dt>Tu rol</dt><dd>${escapeHtml(roleLabel(item.member_role))}</dd></div>
        </dl>
        ${item.is_evaluation ? `<p>${ui.icon("info", "xs")} El ciclo de evaluación es administrado por el equipo BCC.</p>` : ""}
      </article>`;
    }).join("")}</div>`;
  }

  function renderSeatManagement() {
    const manageable = dashboard.licenses.filter(item => item.can_manage_seats && !item.is_evaluation);
    if (!manageable.length) return "";

    const selected = manageable.find(item => item.license_id === selectedLicenseId) || manageable[0];
    const assignments = dashboard.assignments.filter(item => item.license_id === selected.license_id);
    const assignedUsers = new Set(assignments.map(item => item.user_id));
    const candidates = dashboard.members.filter(item => item.account_id === selected.account_id && !assignedUsers.has(item.user_id));

    return `<section id="gestion-plazas">
      ${ui.sectionHeader({
        className: "client-license-section-head",
        title: "Gestión de plazas",
        description: "Asigna plazas a miembros activos de tu cuenta. El alta de nuevos miembros se gestiona por soporte.",
        actions: [{ label: "Solicitar miembro", href: "/contactUs.html", icon: "user-plus", compact: true, className: "btn btn-ghost" }]
      })}
      <div class="client-license-management-grid">
        <article class="client-license-card">
          <h2>Asignar una plaza</h2>
          <form class="client-license-form" data-client-license-assign-form>
            <label>Licencia
              <select name="licenseId" data-client-license-select data-client-license-control required>
                ${manageable.map(item => `<option value="${escapeHtml(item.license_id)}" ${item.license_id === selected.license_id ? "selected" : ""}>${escapeHtml(productName(item.product_key))} · ${escapeHtml(item.account_name)} (${Number(item.assigned_seats || 0)}/${Number(item.seat_limit || 0)})</option>`).join("")}
              </select>
            </label>
            <label>Miembro de la cuenta
              <select name="userId" data-client-license-control data-idle-disabled="${candidates.length ? "false" : "true"}" required ${candidates.length ? "" : "disabled"}>
                ${candidates.length ? candidates.map(item => `<option value="${escapeHtml(item.user_id)}">${escapeHtml(item.display_name || item.email)} · ${escapeHtml(item.email)}</option>`).join("") : '<option value="">No hay miembros disponibles</option>'}
              </select>
            </label>
            <button class="btn btn-primary" type="submit" data-client-license-control data-idle-disabled="${candidates.length ? "false" : "true"}" ${busy || !candidates.length ? "disabled" : ""}>Asignar plaza</button>
          </form>
        </article>
        <article class="client-license-card">
          <div class="client-license-card-head"><div><h2>Plazas asignadas</h2><p>${escapeHtml(productName(selected.product_key))} · ${escapeHtml(selected.account_name)}</p></div><span class="client-license-tag">${assignments.length} / ${Number(selected.seat_limit || 0)}</span></div>
          ${assignments.length ? `<div class="client-license-assignment-list">${assignments.map(renderAssignment).join("")}</div>` : ui.emptyState({
            className: "client-license-empty is-compact",
            icon: "users",
            title: "No hay plazas asignadas.",
            description: "Selecciona un miembro para activar su acceso."
          })}
        </article>
      </div>
    </section>`;
  }

  function renderAssignment(item) {
    return `<div class="client-license-assignment">
      <div><strong>${escapeHtml(item.display_name || item.email)}</strong><small>${escapeHtml(item.email)} · asignada ${formatDate(item.assigned_at)}</small></div>
      <div class="client-license-assignment-actions">
        ${item.is_mine ? '<span class="client-license-tag">Tú</span>' : ""}
        ${item.can_release && !item.is_evaluation ? `<button class="btn btn-ghost btn-compact" type="button" data-client-license-release="${escapeHtml(item.assignment_id)}" data-client-license-control ${busy ? "disabled" : ""}>Liberar</button>` : ""}
      </div>
    </div>`;
  }

  function renderActivity() {
    if (!dashboard.recent_events.length) return "";
    return `<details class="module-surface client-license-activity-disclosure">
      <summary><span>${ui.icon("history", "sm")}<span><strong>Actividad reciente</strong><small>${dashboard.recent_events.length} movimiento(s) de plazas</small></span></span>${ui.icon("chevron-down", "sm")}</summary>
      <div class="client-license-activity-intro">Registro de asignaciones y liberaciones realizadas desde el autoservicio.</div>
      <div class="client-license-activity-list">${dashboard.recent_events.map(event => {
        const member = dashboard.members.find(item => item.user_id === event.subject_user_id);
        const isCurrentUser = event.subject_user_id === currentUser?.id;
        const subject = member?.display_name || (isCurrentUser ? "Tu usuario" : "Usuario de la cuenta");
        const action = event.event_type === "seat_assigned" ? "Plaza asignada" : "Plaza liberada";
        return `<div class="client-license-activity-item"><div><strong>${action}</strong><small>${escapeHtml(subject)} · ${escapeHtml(productName(event.details?.product_key))}</small></div><time datetime="${escapeHtml(event.occurred_at || "")}">${formatDateTime(event.occurred_at)}</time></div>`;
      }).join("")}</div>
    </details>`;
  }

  function handleChange(event) {
    const select = event.target.closest("[data-client-license-select]");
    if (!select) return;
    selectedLicenseId = select.value;
    render();
  }

  async function handleSubmit(event) {
    const form = event.target.closest("[data-client-license-assign-form]");
    if (!form) return;
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form));
    if (!values.licenseId || !values.userId || busy) return;
    setBusy(true);
    setMessage("Asignando la plaza...");
    try {
      await repository.assignSeat(values.licenseId, values.userId);
      await loadDashboard({ successMessage: "La plaza fue asignada correctamente." });
    } catch (error) {
      setBusy(false);
      setMessage(userMessage(error), "error");
    }
  }

  async function handleClick(event) {
    if (event.target.closest("[data-client-license-refresh]")) {
      if (!busy) await loadDashboard();
      return;
    }
    const releaseButton = event.target.closest("[data-client-license-release]");
    if (!releaseButton || busy) return;
    const confirmed = await ui.confirmAction({
      title: "Liberar plaza MAP",
      description: "El usuario perderá el acceso asociado a esta licencia. La plaza quedará disponible inmediatamente.",
      confirmLabel: "Liberar plaza"
    });
    if (!confirmed) return;
    setBusy(true);
    setMessage("Liberando la plaza...");
    try {
      await repository.releaseSeat(releaseButton.dataset.clientLicenseRelease);
      await loadDashboard({ successMessage: "La plaza fue liberada correctamente." });
    } catch (error) {
      setBusy(false);
      setMessage(userMessage(error), "error");
    }
  }

  function setBusy(value) {
    busy = Boolean(value);
    ui.setBusy(root, busy, {
      selector: "[data-client-license-control]",
      label: "Actualizando licencias MAP"
    });
  }

  function setMessage(message, tone = "neutral") {
    ui.feedback(root?.querySelector("[data-client-license-message]"), message, tone);
  }

  function roleLabel(value) {
    return ({ owner: "Propietario", admin: "Administrador", member: "Miembro" })[value] || "Miembro";
  }

  function productName(key) {
    return contracts.productName(key);
  }

  function toLicenseViewModel(license) {
    return contracts.toLicenseViewModel(license);
  }

  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" });
  }

  function formatDateTime(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("es-DO", { dateStyle: "medium", timeStyle: "short" });
  }

  function userMessage(error) {
    return contracts.toError(error).message;
  }

  window.BCCWorkspaceClientMapLicenses = { init };
})();
