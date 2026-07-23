(() => {
  const PANELS = ["summary", "licenses", "evaluations", "permissions", "analytics"];
  const PRODUCTS = window.BCCWorkspaceLicenses.PRODUCTS;
  let root = null;
  let currentUser = null;
  let activePanel = "summary";
  let overview = {};
  let licenses = [];
  let accounts = [];
  let plans = [];
  let users = [];
  let accessUsers = [];
  let cohorts = [];
  let participants = [];
  let selectedCohortId = "";

  function has(permission) {
    return currentUser?.role === "admin" || currentUser?.permissions?.includes(permission);
  }

  function apiBase() {
    const configured = String(window.BCC_MAP_API_URL || "").trim().replace(/\/$/, "");
    if (configured) return configured;
    if (["localhost", "127.0.0.1"].includes(location.hostname)) return "http://127.0.0.1:8000";
    throw new Error("Falta configurar window.BCC_MAP_API_URL para conectar el backend MAP.");
  }

  async function mapRequest(path, options = {}) {
    const supabase = await window.BCCAuth.loadSupabaseClient();
    const { data, error } = await supabase.auth.getSession();
    if (error || !data?.session?.access_token) throw new Error("La sesión de Supabase no está disponible.");
    const response = await fetch(`${apiBase()}${path}`, {
      ...options,
      credentials: "omit",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${data.session.access_token}`,
        ...(options.headers || {})
      }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(String(payload.detail || payload.error || `MAP respondió ${response.status}.`));
    return payload;
  }

  function init(user) {
    root = document.querySelector("[data-maps-licensing-workspace]");
    if (!root || root.dataset.ready === "true") return;
    root.dataset.ready = "true";
    currentUser = user;
    renderShell();
    bindEvents();
    void loadDashboard();
  }

  function renderShell() {
    root.innerHTML = `
      <section class="maps-license-shell">
        <article class="module-surface maps-license-hero">
          <div>
            <span class="workspace-eyebrow">MAP Platform</span>
            <h1>Licencias y acceso</h1>
            <p class="muted-text">Control de licencias, evaluaciones, plazas y permisos internos desde una sola fuente de verdad.</p>
          </div>
          <div class="maps-license-actions">
            <span class="status-pill enabled">Supabase + MAP API</span>
            <button class="btn btn-ghost btn-compact" type="button" data-map-refresh><i data-lucide="refresh-cw"></i>Actualizar</button>
          </div>
        </article>
        <p class="maps-license-message" data-map-message>Cargando datos de plataforma...</p>
        <nav class="maps-license-tabs" aria-label="Secciones de licencias MAP">
          ${PANELS.filter(panelAllowed).map(panel => `<button type="button" data-map-panel-target="${panel}" class="${panel === activePanel ? "is-active" : ""}">${panelLabel(panel)}</button>`).join("")}
        </nav>
        ${PANELS.filter(panelAllowed).map(panel => `<section class="maps-license-panel" data-map-panel="${panel}" ${panel === activePanel ? "" : "hidden"}></section>`).join("")}
      </section>`;
    renderAll();
    refreshIcons();
  }

  function panelAllowed(panel) {
    if (panel === "permissions") return has("platform.permissions.manage");
    if (panel === "analytics") return has("platform.analytics.read");
    if (panel === "evaluations") return has("platform.evaluations.manage");
    return has("platform.licenses.read");
  }

  function panelLabel(panel) {
    return ({ summary: "Resumen", licenses: "Licencias", evaluations: "Evaluaciones", permissions: "Permisos", analytics: "Analíticas" })[panel] || panel;
  }

  function bindEvents() {
    root.addEventListener("click", handleClick);
    root.addEventListener("submit", handleSubmit);
    root.addEventListener("change", handleChange);
  }

  async function loadDashboard() {
    setMessage("Actualizando licencias y accesos...");
    try {
      const requests = [
        mapRequest("/api/admin/platform/overview"),
        mapRequest("/api/admin/platform/licenses"),
        mapRequest("/api/admin/platform/licenses/catalog"),
        mapRequest("/api/admin/platform/licenses/users")
      ];
      if (has("platform.evaluations.manage")) requests.push(mapRequest("/api/admin/platform/evaluations/cohorts"));
      if (has("platform.permissions.manage")) requests.push(mapRequest("/api/admin/platform/access/users"));
      const results = await Promise.all(requests);
      overview = results[0].overview || {};
      licenses = results[1].licenses || [];
      accounts = results[2].accounts || [];
      plans = results[2].plans || [];
      users = results[3].users || [];
      let index = 4;
      if (has("platform.evaluations.manage")) cohorts = results[index++].cohorts || [];
      if (has("platform.permissions.manage")) accessUsers = results[index]?.users || [];
      renderAll();
      setMessage("Datos de plataforma actualizados.", "ok");
    } catch (error) {
      setMessage(error.message, "error");
      renderAll();
    }
  }

  function renderAll() {
    renderSummary();
    renderLicenses();
    renderEvaluations();
    renderPermissions();
    renderAnalytics();
    refreshIcons();
  }

  function renderSummary() {
    const panel = root.querySelector('[data-map-panel="summary"]');
    if (!panel) return;
    panel.innerHTML = `
      <div class="maps-license-metrics">
        ${metric("Licencias activas", overview.active_licenses, `${overview.total_licenses || 0} registradas`)}
        ${metric("Plazas asignadas", overview.assigned_seats, `${overview.available_seats || 0} disponibles`)}
        ${metric("Evaluaciones activas", overview.active_evaluation_cohorts, `${overview.evaluation_participants || 0} participantes`)}
        ${metric("Vencen en 30 días", overview.expiring_licenses, `${overview.evaluation_events_30d || 0} eventos recientes`)}
      </div>
      <div class="maps-license-grid">
        <article class="maps-license-card">
          <h2>Estado por producto</h2>
          ${productSummaryTable()}
        </article>
        <aside class="maps-license-card">
          <h2>Alertas operativas</h2>
          <p class="muted-text">${Number(overview.expiring_licenses || 0) ? `${overview.expiring_licenses} licencia(s) requieren revisión antes de 30 días.` : "No hay vencimientos próximos registrados."}</p>
          <p class="muted-text">Los datos científicos no forman parte de esta vista; sólo se procesan identidad, producto, licencia y ciclo de acceso.</p>
        </aside>
      </div>`;
  }

  function metric(label, value, detail) {
    return `<article class="maps-license-metric"><span>${escapeHtml(label)}</span><strong>${Number(value || 0).toLocaleString()}</strong><small>${escapeHtml(detail)}</small></article>`;
  }

  function productSummaryTable() {
    const rows = Object.entries(PRODUCTS).map(([key, label]) => {
      const productLicenses = licenses.filter(item => item.product_key === key);
      const active = productLicenses.filter(item => item.license_status === "active" && !isExpired(item.ends_at)).length;
      const seats = productLicenses.reduce((sum, item) => sum + Number(item.assigned_seats || 0), 0);
      return `<tr><td><strong>${label}</strong></td><td>${active}</td><td>${seats}</td></tr>`;
    }).join("");
    return `<div class="maps-license-table-wrap"><table class="maps-license-table"><thead><tr><th>Producto</th><th>Activas</th><th>Plazas usadas</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function renderLicenses() {
    const panel = root.querySelector('[data-map-panel="licenses"]');
    if (!panel) return;
    panel.innerHTML = `
      <div class="maps-license-grid">
        <article class="maps-license-card">
          <h2>Licencias registradas</h2>
          ${licenseTable()}
        </article>
        <aside class="maps-license-card">
          ${has("platform.licenses.manage") ? issueLicenseForm() : "<p class='muted-text'>Tu acceso es de consulta.</p>"}
        </aside>
      </div>
      ${has("platform.licenses.manage") ? `<article class="maps-license-card"><h2>Asignar plaza</h2>${assignmentForm()}</article>` : ""}`;
  }

  function licenseTable() {
    if (!licenses.length) return '<div class="maps-license-empty">Aún no hay licencias emitidas.</div>';
    return `<div class="maps-license-table-wrap"><table class="maps-license-table"><thead><tr><th>Cuenta</th><th>Producto / plan</th><th>Estado</th><th>Plazas</th><th>Vigencia</th><th></th></tr></thead><tbody>${licenses.map(item => `
      <tr>
        <td><strong>${escapeHtml(item.account_name)}</strong><small>${escapeHtml(item.license_id)}</small></td>
        <td>${escapeHtml(PRODUCTS[item.product_key] || item.product_key)}<small>${escapeHtml(item.plan_name || item.license_type)}</small></td>
        <td><span class="maps-license-status ${escapeHtml(item.license_status)}">${escapeHtml(item.license_status)}</span></td>
        <td>${Number(item.assigned_seats || 0)} / ${Number(item.seat_limit || 0)}</td>
        <td>${formatDate(item.starts_at)}<small>${item.ends_at ? `hasta ${formatDate(item.ends_at)}` : "sin vencimiento"}</small></td>
        <td>${has("platform.licenses.manage") && item.license_status !== "revoked" ? `<button class="btn btn-ghost btn-compact" type="button" data-revoke-license="${escapeHtml(item.license_id)}">Revocar</button>` : ""}</td>
      </tr>`).join("")}</tbody></table></div>`;
  }

  function issueLicenseForm() {
    const commercialPlans = plans.filter(plan => !plan.is_evaluation);
    return `<h2>Emitir licencia</h2><form class="maps-license-form" data-issue-license-form>
      <label>Cuenta<select name="accountId" required>${optionList(accounts, "account_id", "display_name")}</select></label>
      <label>Plan<select name="planId" required>${commercialPlans.map(plan => `<option value="${escapeHtml(plan.plan_id)}" data-seats="${Number(plan.default_seat_limit || 1)}">${escapeHtml(PRODUCTS[plan.product_key] || plan.product_key)} · ${escapeHtml(plan.plan_name)}</option>`).join("")}</select></label>
      <div class="maps-license-form-row"><label>Plazas<input name="seatLimit" type="number" min="1" value="1" required></label><label>Inicio<input name="startsAt" type="datetime-local" value="${localDateValue(new Date())}" required></label></div>
      <label>Vencimiento opcional<input name="endsAt" type="datetime-local"></label>
      <button class="btn btn-primary" type="submit">Emitir licencia</button>
    </form>`;
  }

  function assignmentForm() {
    const availableLicenses = licenses.filter(item => item.license_status === "active" && !isExpired(item.ends_at));
    return `<form class="maps-license-form" data-assign-license-form>
      <div class="maps-license-form-row">
        <label>Licencia<select name="licenseId" required>${availableLicenses.map(item => `<option value="${escapeHtml(item.license_id)}">${escapeHtml(item.account_name)} · ${escapeHtml(PRODUCTS[item.product_key] || item.product_key)} (${Number(item.assigned_seats || 0)}/${item.seat_limit})</option>`).join("")}</select></label>
        <label>Usuario<select name="userId" required>${optionList(users, "user_id", "display_name", "email")}</select></label>
      </div>
      <button class="btn btn-primary" type="submit">Asignar plaza</button>
    </form>`;
  }

  function renderEvaluations() {
    const panel = root.querySelector('[data-map-panel="evaluations"]');
    if (!panel) return;
    panel.innerHTML = `<div class="maps-license-grid">
      <article class="maps-license-card"><h2>Cohortes de evaluación</h2>${cohortList()}${selectedCohortId ? participantTable() : ""}</article>
      <aside class="maps-license-card">${evaluationForms()}</aside>
    </div>`;
  }

  function cohortList() {
    if (!cohorts.length) return '<div class="maps-license-empty">No hay cohortes de evaluación.</div>';
    return `<div class="maps-license-cohort-list">${cohorts.map(item => `<article class="maps-license-cohort"><div class="maps-license-cohort-head"><div><strong>${escapeHtml(item.cohort_name || item.name)}</strong><p>${escapeHtml(PRODUCTS[item.product_key] || item.product_key)} · ${escapeHtml(item.account_name)}</p></div><span class="maps-license-status ${escapeHtml(item.cohort_status)}">${escapeHtml(item.cohort_status)}</span></div><small>${formatDate(item.starts_at)} — ${formatDate(item.ends_at)} · ${Number(item.participant_count || 0)} participantes</small><div class="maps-license-form-actions"><button class="btn btn-ghost btn-compact" type="button" data-load-participants="${escapeHtml(item.cohort_id)}">Participantes</button></div></article>`).join("")}</div>`;
  }

  function participantTable() {
    if (!participants.length) return '<p class="maps-license-empty">Esta cohorte no tiene participantes.</p>';
    return `<h3>Participantes</h3><div class="maps-license-table-wrap"><table class="maps-license-table"><thead><tr><th>Usuario</th><th>Estado</th><th>Vigencia</th><th></th></tr></thead><tbody>${participants.map(item => `<tr><td><strong>${escapeHtml(item.display_name || item.email)}</strong><small>${escapeHtml(item.email)}</small></td><td>${escapeHtml(item.member_status)}</td><td>${formatDate(item.valid_until)}</td><td>${["active", "invited"].includes(item.member_status) ? `<button class="btn btn-ghost btn-compact" type="button" data-revoke-participant="${escapeHtml(item.user_id)}">Revocar</button>` : ""}</td></tr>`).join("")}</tbody></table></div>`;
  }

  function evaluationForms() {
    const evaluationPlans = plans.filter(plan => plan.is_evaluation);
    return `<h2>Nueva evaluación</h2>
      <form class="maps-license-form" data-create-evaluation-account><label>Cuenta / organización<input name="displayName" maxlength="160" required></label><button class="btn btn-ghost" type="submit">Crear cuenta</button></form>
      <hr>
      <form class="maps-license-form" data-create-cohort>
        <label>Cuenta<select name="accountId" required>${optionList(accounts, "account_id", "display_name")}</select></label>
        <label>Producto<select name="productKey" required>${evaluationPlans.map(plan => `<option value="${escapeHtml(plan.product_key)}">${escapeHtml(PRODUCTS[plan.product_key] || plan.product_key)}</option>`).join("")}</select></label>
        <label>Nombre<input name="name" maxlength="160" required></label><label>Propósito<textarea name="purpose" maxlength="2000"></textarea></label>
        <div class="maps-license-form-row"><label>Inicio<input name="startsAt" type="datetime-local" value="${localDateValue(new Date())}" required></label><label>Fin<input name="endsAt" type="datetime-local" value="${localDateValue(new Date(Date.now() + 30 * 86400000))}" required></label></div>
        <button class="btn btn-primary" type="submit">Crear cohorte</button>
      </form>
      <hr>
      <form class="maps-license-form" data-invite-participant>
        <label>Cohorte<select name="cohortId" required>${optionList(cohorts, "cohort_id", "cohort_name")}</select></label>
        <label>Correo<input name="email" type="email" maxlength="320" required></label><label>Nombre<input name="fullName" maxlength="160"></label>
        <button class="btn btn-primary" type="submit">Invitar y asignar</button>
      </form>`;
  }

  function renderPermissions() {
    const panel = root.querySelector('[data-map-panel="permissions"]');
    if (!panel) return;
    panel.innerHTML = `<article class="maps-license-card"><div class="maps-license-hero"><div><h2>Acceso efectivo de plataforma</h2><p class="muted-text">Los roles MAP se sincronizan desde el rol base y los roles internos del perfil.</p></div><a class="btn btn-ghost" href="#usuarios">Editar perfiles</a></div>${accessUsers.length ? `<div class="maps-license-table-wrap"><table class="maps-license-table"><thead><tr><th>Usuario</th><th>Perfil</th><th>Roles MAP</th><th>Permisos efectivos</th></tr></thead><tbody>${accessUsers.map(item => `<tr><td><strong>${escapeHtml(item.display_name)}</strong><small>${escapeHtml(item.email)}</small></td><td>${escapeHtml(item.base_role)}<small>${escapeHtml((item.staff_roles || []).join(", ") || "sin rol interno")}</small></td><td>${escapeHtml((item.platform_roles || []).join(", ") || "—")}</td><td>${escapeHtml((item.platform_permissions || []).join(", ") || "—")}</td></tr>`).join("")}</tbody></table></div>` : '<div class="maps-license-empty">No hay datos de permisos.</div>'}</article>`;
  }

  function renderAnalytics() {
    const panel = root.querySelector('[data-map-panel="analytics"]');
    if (!panel) return;
    const sourceCounts = licenses.reduce((result, item) => { result[item.license_source] = (result[item.license_source] || 0) + 1; return result; }, {});
    panel.innerHTML = `<div class="maps-license-metrics">${metric("Eventos de evaluación · 30d", overview.evaluation_events_30d, "altas, activaciones y revocaciones")}${metric("Participantes vigentes", overview.evaluation_participants, "invitados y activos")}${metric("Plazas libres", overview.available_seats, "capacidad activa disponible")}${metric("Licencias por vencer", overview.expiring_licenses, "próximos 30 días")}</div><article class="maps-license-card"><h2>Origen de licencias</h2>${Object.keys(sourceCounts).length ? `<div class="maps-license-table-wrap"><table class="maps-license-table"><thead><tr><th>Origen</th><th>Licencias</th></tr></thead><tbody>${Object.entries(sourceCounts).map(([source, count]) => `<tr><td>${escapeHtml(source)}</td><td>${count}</td></tr>`).join("")}</tbody></table></div>` : '<div class="maps-license-empty">No hay actividad suficiente para analizar.</div>'}<p class="muted-text">Esta analítica es operativa y no incluye imágenes, resultados científicos ni contenido de muestras.</p></article>`;
  }

  async function handleClick(event) {
    const panelButton = event.target.closest("[data-map-panel-target]");
    if (panelButton) return openPanel(panelButton.dataset.mapPanelTarget);
    if (event.target.closest("[data-map-refresh]")) return void loadDashboard();
    const participantButton = event.target.closest("[data-load-participants]");
    if (participantButton) return void loadParticipants(participantButton.dataset.loadParticipants);
    const revokeParticipant = event.target.closest("[data-revoke-participant]");
    if (revokeParticipant) return void revokeParticipantAccess(revokeParticipant.dataset.revokeParticipant);
    const revokeLicense = event.target.closest("[data-revoke-license]");
    if (revokeLicense) return void revokeLicenseAccess(revokeLicense.dataset.revokeLicense);
  }

  function handleChange(event) {
    if (event.target.matches('[name="planId"]')) {
      const seats = event.target.selectedOptions[0]?.dataset.seats;
      const input = event.target.form?.elements?.seatLimit;
      if (input && seats) input.value = seats;
    }
  }

  async function handleSubmit(event) {
    const form = event.target.closest("form");
    if (!form) return;
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    try {
      setMessage("Guardando cambios...");
      if (form.matches("[data-issue-license-form]")) await mapRequest("/api/admin/platform/licenses", { method: "POST", body: JSON.stringify({ accountId: data.accountId, planId: data.planId, seatLimit: Number(data.seatLimit), startsAt: isoDate(data.startsAt), endsAt: data.endsAt ? isoDate(data.endsAt) : null }) });
      if (form.matches("[data-assign-license-form]")) await mapRequest(`/api/admin/platform/licenses/${encodeURIComponent(data.licenseId)}/assignments`, { method: "POST", body: JSON.stringify({ userId: data.userId }) });
      if (form.matches("[data-create-evaluation-account]")) await mapRequest("/api/admin/platform/evaluations/accounts", { method: "POST", body: JSON.stringify({ displayName: data.displayName }) });
      if (form.matches("[data-create-cohort]")) await mapRequest("/api/admin/platform/evaluations/cohorts", { method: "POST", body: JSON.stringify({ accountId: data.accountId, productKey: data.productKey, name: data.name, purpose: data.purpose, startsAt: isoDate(data.startsAt), endsAt: isoDate(data.endsAt) }) });
      if (form.matches("[data-invite-participant]")) await mapRequest(`/api/admin/platform/evaluations/cohorts/${encodeURIComponent(data.cohortId)}/participants`, { method: "POST", body: JSON.stringify({ email: data.email, fullName: data.fullName || null }) });
      form.reset();
      await loadDashboard();
      setMessage("Cambio guardado y acceso recalculado.", "ok");
    } catch (error) { setMessage(error.message, "error"); }
  }

  async function loadParticipants(cohortId) {
    selectedCohortId = cohortId;
    try {
      const payload = await mapRequest(`/api/admin/platform/evaluations/cohorts/${encodeURIComponent(cohortId)}/participants`);
      participants = payload.participants || [];
      renderEvaluations(); refreshIcons();
    } catch (error) { setMessage(error.message, "error"); }
  }

  async function revokeParticipantAccess(userId) {
    if (!confirm("¿Revocar el acceso de evaluación de este participante?")) return;
    try {
      await mapRequest(`/api/admin/platform/evaluations/cohorts/${encodeURIComponent(selectedCohortId)}/participants/${encodeURIComponent(userId)}/revoke`, { method: "POST", body: JSON.stringify({ reason: "Revocado desde staff dashboard" }) });
      await loadParticipants(selectedCohortId); await loadDashboard();
    } catch (error) { setMessage(error.message, "error"); }
  }

  async function revokeLicenseAccess(licenseId) {
    if (!confirm("¿Revocar esta licencia y liberar todas sus plazas?")) return;
    try {
      await mapRequest(`/api/admin/platform/licenses/${encodeURIComponent(licenseId)}/revoke`, { method: "POST", body: JSON.stringify({ reason: "Revocada desde staff dashboard" }) });
      await loadDashboard();
    } catch (error) { setMessage(error.message, "error"); }
  }

  function openPanel(panel) {
    activePanel = panel;
    root.querySelectorAll("[data-map-panel]").forEach(item => { item.hidden = item.dataset.mapPanel !== panel; });
    root.querySelectorAll("[data-map-panel-target]").forEach(item => item.classList.toggle("is-active", item.dataset.mapPanelTarget === panel));
  }

  function optionList(rows, valueKey, labelKey, secondaryKey = "") {
    return rows.map(item => `<option value="${escapeHtml(item[valueKey])}">${escapeHtml(item[labelKey] || item[valueKey])}${secondaryKey && item[secondaryKey] ? ` · ${escapeHtml(item[secondaryKey])}` : ""}</option>`).join("");
  }

  function setMessage(message, tone = "neutral") {
    const element = root?.querySelector("[data-map-message]");
    if (!element) return;
    element.textContent = message || ""; element.dataset.tone = tone; element.hidden = !message;
  }

  function localDateValue(date) { const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000); return shifted.toISOString().slice(0, 16); }
  function isoDate(value) { return new Date(value).toISOString(); }
  function formatDate(value) { if (!value) return "—"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString(); }
  function isExpired(value) { return Boolean(value && new Date(value).getTime() <= Date.now()); }
  function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]); }
  function refreshIcons() { window.BCCWorkspaceUtils?.refreshIcons?.(); }

  window.BCCWorkspaceMapsLicensing = { init };
})();
