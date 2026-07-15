(() => {
  let root = null;
  let currentUser = null;
  let dashboard = emptyDashboard();
  let selectedLicenseId = "";
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
    render();
    void loadDashboard();
  }

  async function rpc(name, parameters = {}) {
    const supabase = await window.BCCAuth.loadSupabaseClient();
    const { data, error } = await supabase.rpc(name, parameters);
    if (error) throw new Error(error.message || "No fue posible completar la operación.");
    return data;
  }

  async function loadDashboard({ successMessage = "" } = {}) {
    setBusy(true);
    setMessage("Actualizando tus licencias MAP...");
    try {
      const payload = await rpc("get_my_license_dashboard");
      dashboard = normalizeDashboard(payload);
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

  function normalizeDashboard(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      accounts: Array.isArray(source.accounts) ? source.accounts : [],
      licenses: Array.isArray(source.licenses) ? source.licenses : [],
      members: Array.isArray(source.members) ? source.members : [],
      assignments: Array.isArray(source.assignments) ? source.assignments : [],
      recent_events: Array.isArray(source.recent_events) ? source.recent_events : []
    };
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
        <article class="module-surface client-license-hero">
          <div>
            <span class="workspace-eyebrow">MAP Platform</span>
            <h1>Mis licencias</h1>
            <p>Consulta vigencia y consumo. Si administras una organización, también puedes asignar y liberar plazas.</p>
          </div>
          <div class="client-license-actions">
            <a class="btn btn-ghost btn-compact" href="/products.html"><i data-lucide="package-search"></i>Ver productos</a>
            <button class="btn btn-ghost btn-compact" type="button" data-client-license-refresh data-client-license-control ${busy ? "disabled" : ""}><i data-lucide="refresh-cw"></i>Actualizar</button>
          </div>
        </article>
        <p class="client-license-message" data-client-license-message hidden></p>
        ${renderFeaturedLicense()}
        ${renderAttention()}
        ${renderMetrics()}
        <section>
          <div class="client-license-section-head">
            <div><h2>Licencias asociadas</h2><p>Sólo mostramos licencias que administras o que están asignadas directamente a tu usuario.</p></div>
          </div>
          ${renderLicenses()}
        </section>
        ${renderSeatManagement()}
        ${renderActivity()}
      </section>`;
    refreshIcons();
  }

  function renderFeaturedLicense() {
    const licenses = dashboard.licenses.map(toLicenseViewModel);
    const featured = licenses.find(item => item.is_assigned_to_me && item.status === "active")
      || licenses.find(item => item.status === "active")
      || licenses.sort((a, b) => a.statusMeta.priority - b.statusMeta.priority)[0];
    if (!featured) {
      return `<div class="client-license-hero-summary is-empty"><i data-lucide="badge-plus"></i><span>Tu acceso MAP aparecerá aquí cuando una licencia sea asignada.</span></div>`;
    }

    return `<div class="client-license-hero-summary">
      <div class="client-license-hero-product"><i data-lucide="scan-line"></i><div><span>Tu acceso principal</span><strong>${escapeHtml(featured.productName)}</strong><small>${escapeHtml(featured.plan_name || "Licencia MAP")}</small></div></div>
      <div class="client-license-hero-status"><span class="client-license-tag ${escapeHtml(featured.status)}"><i data-lucide="${escapeHtml(featured.statusMeta.icon)}"></i>${escapeHtml(featured.statusMeta.label)}</span><strong>${featured.ends_at ? `Hasta ${formatDate(featured.ends_at)}` : "Sin vencimiento"}<small>${featured.is_assigned_to_me ? " Acceso asignado a tu usuario" : " Acceso de tu organización"}</small></strong></div>
    </div>`;
  }

  function renderAttention() {
    const license = dashboard.licenses.map(toLicenseViewModel).find(item => item.needsAttention);
    if (!license) return "";
    const copy = license.status === "expiring"
      ? `Tu licencia ${license.productName} vence el ${formatDate(license.ends_at)}. Coordina la renovación para evitar interrupciones.`
      : `Tu licencia ${license.productName} está ${license.statusMeta.label.toLowerCase()}. Revisa las opciones con tu administrador o soporte.`;
    return `<aside class="client-license-attention" data-tone="${escapeHtml(license.statusMeta.tone)}"><i data-lucide="${escapeHtml(license.statusMeta.icon)}"></i><div><strong>Requiere atención</strong><span>${escapeHtml(copy)}</span></div><a class="btn btn-ghost btn-compact" href="/contactUs.html">Contactar soporte</a></aside>`;
  }

  function renderMetrics() {
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
    return `<article class="client-license-metric"><span>${escapeHtml(label)}</span><strong>${Number(value || 0).toLocaleString()}</strong><small>${escapeHtml(detail)}</small></article>`;
  }

  function renderLicenses() {
    if (!dashboard.licenses.length) {
      return `<div class="client-license-empty"><i data-lucide="badge-x"></i><strong>No hay licencias asociadas a tu usuario.</strong><span>Si esperabas una licencia, solicita al administrador de tu organización que te asigne una plaza.</span><a class="btn btn-primary" href="/contactUs.html">Contactar soporte</a></div>`;
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
            <span class="client-license-tag ${escapeHtml(item.status)}"><i data-lucide="${escapeHtml(item.statusMeta.icon)}"></i>${escapeHtml(item.statusMeta.label)}</span>
          </div>
        </div>
        <div>
          <div class="client-license-card-head"><span>Uso de plazas</span><strong>${item.assignedSeats} / ${item.seatLimit}</strong></div>
          <div class="client-license-seat-bar ${item.seatUsage >= 100 ? "is-full" : item.seatUsage >= 80 ? "is-near-capacity" : ""}" aria-label="${item.seatUsage}% de plazas ocupadas"><span style="width:${item.seatUsage}%"></span></div>
        </div>
        <dl class="client-license-details">
          <div><dt>Inicio</dt><dd>${formatDate(item.starts_at)}</dd></div>
          <div><dt>Vencimiento</dt><dd>${item.ends_at ? formatDate(item.ends_at) : "Sin vencimiento"}</dd></div>
          <div><dt>Tu rol</dt><dd>${escapeHtml(roleLabel(item.member_role))}</dd></div>
        </dl>
        ${item.is_evaluation ? '<p><i data-lucide="info"></i> El ciclo de evaluación es administrado por el equipo BCC.</p>' : ""}
      </article>`;
    }).join("")}</div>`;
  }

  function renderSeatManagement() {
    const manageable = dashboard.licenses.filter(item => item.can_manage_seats && !item.is_evaluation);
    if (!manageable.length) {
      return `<article class="module-surface client-license-section-head"><div><h2>Gestión de plazas</h2><p>Esta función aparece para propietarios y administradores de cuentas organizacionales con una licencia comercial activa.</p></div><i data-lucide="shield-check"></i></article>`;
    }

    const selected = manageable.find(item => item.license_id === selectedLicenseId) || manageable[0];
    const assignments = dashboard.assignments.filter(item => item.license_id === selected.license_id);
    const assignedUsers = new Set(assignments.map(item => item.user_id));
    const candidates = dashboard.members.filter(item => item.account_id === selected.account_id && !assignedUsers.has(item.user_id));

    return `<section id="gestion-plazas">
      <div class="client-license-section-head">
        <div><h2>Gestión de plazas</h2><p>Asigna plazas a miembros activos de tu cuenta. El alta de nuevos miembros se gestiona por soporte.</p></div>
        <a class="btn btn-ghost btn-compact" href="/contactUs.html"><i data-lucide="user-plus"></i>Solicitar miembro</a>
      </div>
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
          ${assignments.length ? `<div class="client-license-assignment-list">${assignments.map(renderAssignment).join("")}</div>` : '<div class="client-license-empty"><i data-lucide="users"></i><strong>No hay plazas asignadas.</strong><span>Selecciona un miembro para activar su acceso.</span></div>'}
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
    return `<article class="module-surface">
      <div class="client-license-section-head"><div><h2>Actividad reciente</h2><p>Registro de asignaciones y liberaciones realizadas desde el autoservicio.</p></div><i data-lucide="history"></i></div>
      <div class="client-license-activity-list">${dashboard.recent_events.map(event => {
        const member = dashboard.members.find(item => item.user_id === event.subject_user_id);
        const isCurrentUser = event.subject_user_id === currentUser?.id;
        const subject = member?.display_name || (isCurrentUser ? "Tu usuario" : "Usuario de la cuenta");
        const action = event.event_type === "seat_assigned" ? "Plaza asignada" : "Plaza liberada";
        return `<div class="client-license-activity-item"><div><strong>${action}</strong><small>${escapeHtml(subject)} · ${escapeHtml(productName(event.details?.product_key))}</small></div><time datetime="${escapeHtml(event.occurred_at || "")}">${formatDateTime(event.occurred_at)}</time></div>`;
      }).join("")}</div>
    </article>`;
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
      await rpc("assign_my_account_license", { p_license_id: values.licenseId, p_user_id: values.userId });
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
    if (!confirm("¿Liberar esta plaza? El usuario perderá el acceso asociado a la licencia.")) return;
    setBusy(true);
    setMessage("Liberando la plaza...");
    try {
      await rpc("release_my_license_assignment", { p_assignment_id: releaseButton.dataset.clientLicenseRelease });
      await loadDashboard({ successMessage: "La plaza fue liberada correctamente." });
    } catch (error) {
      setBusy(false);
      setMessage(userMessage(error), "error");
    }
  }

  function setBusy(value) {
    busy = Boolean(value);
    root?.querySelectorAll("[data-client-license-control]").forEach(element => {
      element.disabled = busy || element.dataset.idleDisabled === "true";
    });
  }

  function setMessage(message, tone = "neutral") {
    const element = root?.querySelector("[data-client-license-message]");
    if (!element) return;
    element.textContent = message || "";
    element.dataset.tone = tone;
    element.hidden = !message;
  }

  function effectiveStatus(item) {
    return toLicenseViewModel(item).status;
  }

  function statusLabel(value) {
    return window.BCCWorkspaceLicenses.STATUS[value]?.label || window.BCCWorkspaceLicenses.STATUS.unknown.label;
  }

  function roleLabel(value) {
    return ({ owner: "Propietario", admin: "Administrador", member: "Miembro" })[value] || "Miembro";
  }

  function productName(key) {
    return window.BCCWorkspaceLicenses.PRODUCTS[key] || key || "MAP";
  }

  function toLicenseViewModel(license) {
    return window.BCCWorkspaceLicenses.toViewModel(license);
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
    const message = String(error?.message || error || "No fue posible completar la operación.");
    const translations = [
      [/Authentication required/i, "Tu sesión expiró. Inicia sesión nuevamente."],
      [/Only an account owner or administrator/i, "Sólo el propietario o un administrador de la cuenta puede asignar plazas."],
      [/not an active account member/i, "El usuario seleccionado ya no es un miembro activo de la cuenta."],
      [/already has this license/i, "El usuario ya tiene asignada esta licencia."],
      [/already has an active license for this product/i, "El usuario ya tiene una licencia activa para este producto."],
      [/no remaining seats/i, "La licencia no tiene plazas disponibles."],
      [/Evaluation access is managed/i, "El acceso de evaluación es administrado por el equipo BCC."],
      [/Assignment is not active/i, "La plaza ya fue liberada o dejó de estar activa."],
      [/License is not active/i, "La licencia no está activa."],
      [/cannot release this assignment/i, "No tienes permiso para liberar esta plaza."]
    ];
    return translations.find(([pattern]) => pattern.test(message))?.[1] || message;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  }

  function refreshIcons() {
    window.BCCWorkspaceUtils?.refreshIcons?.();
  }

  window.BCCWorkspaceClientMapLicenses = { init };
})();
