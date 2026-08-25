(() => {
  const contracts = window.BCCWorkspaceMapContracts;
  const repository = window.BCCWorkspaceMapRepository.staff;
  const utils = window.BCCWorkspaceUtils;
  const ui = window.BCCWorkspaceUI;
  const mapNanoPlans = window.BCCMapNanoPlans;
  const escapeHtml = utils.escapeHtml;
  const refreshIcons = utils.refreshIcons;
  const PANELS = ["summary", "licenses", "commercial", "evaluations", "permissions", "analytics"];
  const PRODUCTS = contracts.PRODUCTS;
  const ACCESS_PROGRAMS = Object.freeze({
    standard_evaluation: { label: "Evaluación estándar", tone: "neutral" },
    partner_test: { label: "Tester de cliente aliado", tone: "success" },
    complimentary_pilot: { label: "Piloto de cortesía", tone: "warning" }
  });

  let root = null;
  let currentUser = null;
  let activePanel = "summary";
  let overview = {};
  let licenses = [];
  let accounts = [];
  let institutions = [];
  let plans = [];
  let users = [];
  let accessUsers = [];
  let cohorts = [];
  let trialOffer = contracts.TRIAL_OFFER_FALLBACK;
  let participants = [];
  let participantError = "";
  let selectedLicenseId = "";
  let selectedCohortId = "";
  let licenseQuery = "";
  let licenseStatusFilter = "all";
  let licenseProductFilter = "all";
  let cohortQuery = "";
  let commercialRequests = [];
  let commercialRequestsAvailable = true;
  let commercialRequestQuery = "";
  let commercialRequestStatusFilter = "all";
  let selectedCommercialRequestId = "";
  let issueAccessKind = "commercial";
  let testerInstitutionId = "none";
  let testerUserId = "new";
  let testerCohortId = "";
  let busy = false;
  let tabsController = null;

  function has(permission) {
    return currentUser?.role === "admin" || currentUser?.permissions?.includes(permission);
  }

  function init(user, context = {}) {
    root = document.querySelector("[data-maps-licensing-workspace]");
    if (!root || root.dataset.ready === "true") return;
    root.dataset.ready = "true";
    currentUser = user;
    activePanel = normalizedPanel(context.panelId);
    renderShell();
    bindEvents();
    void loadDashboard();
  }

  function activate(context = {}) {
    const nextPanel = normalizedPanel(context.panelId);
    activePanel = nextPanel;
    tabsController?.activate(nextPanel, { source: "router" });
    if (context.panelId && context.panelId !== nextPanel) {
      window.history.replaceState(null, "", `#maps-licensing/${nextPanel}`);
    }
  }

  function normalizedPanel(panel) {
    return PANELS.includes(panel) && panelAllowed(panel) ? panel : "summary";
  }

  function renderShell() {
    root.innerHTML = `
      <section class="maps-license-shell">
        ${ui.sectionHeader({
          className: "workspace-page-header",
          actionsClassName: "maps-license-actions",
          title: "Licencias y acceso",
          level: 1,
          description: "Administra el ciclo de acceso comercial y de evaluación sin mezclar permisos internos ni datos científicos.",
          collapsibleDescription: true,
          actions: [{
            label: "Actualizar",
            icon: "refresh-cw",
            compact: true,
            className: "btn btn-ghost",
            data: { mapRefresh: true, mapControl: true }
          }]
        })}
        <p class="maps-license-message" data-map-message role="status" aria-live="polite">Cargando datos de plataforma...</p>
        <nav class="maps-license-tabs" role="tablist" aria-label="Secciones de licencias MAP">
          ${PANELS.filter(panelAllowed).map(panel => `
            <button id="maps-${panel}-tab" type="button" role="tab"
              aria-controls="maps-${panel}-panel"
              aria-selected="${panel === activePanel ? "true" : "false"}"
              tabindex="${panel === activePanel ? "0" : "-1"}"
              data-map-panel-target="${panel}"
              class="${panel === activePanel ? "is-active" : ""}">${panelLabel(panel)}</button>`).join("")}
        </nav>
        ${PANELS.filter(panelAllowed).map(panel => `
          <section id="maps-${panel}-panel" class="maps-license-panel" role="tabpanel"
            aria-labelledby="maps-${panel}-tab" data-map-panel="${panel}"
            ${panel === activePanel ? "" : "hidden"}></section>`).join("")}
        ${has("platform.licenses.manage") ? licenseLayers() : ""}
        ${has("platform.evaluations.manage") ? evaluationLayers() : ""}
      </section>`;

    tabsController?.destroy();
    tabsController = ui.bindTabs(root, {
      tabSelector: "[data-map-panel-target]",
      panelSelector: "[data-map-panel]",
      valueForTab: tab => tab.dataset.mapPanelTarget,
      valueForPanel: panel => panel.dataset.mapPanel,
      initialValue: activePanel,
      onChange(panel, config = {}) {
        activePanel = panel;
        if (!["user", "initial"].includes(config.source)) return;
        const hash = `#maps-licensing/${panel}`;
        if (window.location.hash === hash) return;
        const method = config.source === "user" ? "pushState" : "replaceState";
        window.history[method](null, "", hash);
      }
    });
    renderAll();
    refreshIcons(root);
  }

  function panelAllowed(panel) {
    if (panel === "commercial") return has("platform.licenses.manage");
    if (panel === "permissions") return has("platform.permissions.manage");
    if (panel === "analytics") return has("platform.analytics.read");
    if (panel === "evaluations") return has("platform.evaluations.manage");
    return has("platform.licenses.read");
  }

  function panelLabel(panel) {
    return ({
      summary: "Resumen",
      licenses: "Licencias",
      commercial: "Solicitudes",
      evaluations: "Evaluaciones",
      permissions: "Permisos",
      analytics: "Analíticas"
    })[panel] || panel;
  }

  function bindEvents() {
    root.addEventListener("click", handleClick);
    root.addEventListener("submit", handleSubmit);
    root.addEventListener("change", handleChange);
    root.addEventListener("input", handleInput);
  }

  async function loadDashboard({ successMessage = "" } = {}) {
    setBusy(true);
    setMessage("Actualizando licencias y accesos...");
    try {
      const [dashboard, commercialRequestState] = await Promise.all([
        repository.getDashboard({
          includeEvaluations: has("platform.evaluations.manage"),
          includeAccess: has("platform.permissions.manage")
        }),
        has("platform.licenses.manage")
          ? repository.getCommercialRequestQueue()
          : Promise.resolve({ available: false, requests: [] })
      ]);
      overview = dashboard?.overview || {};
      licenses = dashboard?.licenses || [];
      accounts = dashboard?.accounts || [];
      institutions = dashboard?.institutions || [];
      plans = dashboard?.plans || [];
      users = dashboard?.users || [];
      cohorts = dashboard?.cohorts || [];
      trialOffer = contracts.normalizeTrialOffer(dashboard?.trialOffer);
      accessUsers = dashboard?.access_users || [];
      commercialRequests = commercialRequestState.requests;
      commercialRequestsAvailable = commercialRequestState.available;
      preserveSelections();
      if (selectedCohortId) {
        participantError = "";
        try {
          participants = await repository.listEvaluationParticipants(selectedCohortId);
        } catch (error) {
          participants = [];
          participantError = contracts.toError(error).message;
        }
      }
      renderAll();
      setMessage(successMessage || "Datos de plataforma actualizados.", "ok");
    } catch (error) {
      setMessage(contracts.toError(error).message, "error");
      renderAll();
    } finally {
      setBusy(false);
    }
  }

  function preserveSelections() {
    if (!licenses.some(item => item.license_id === selectedLicenseId)) {
      selectedLicenseId = licenses[0]?.license_id || "";
    }
    if (!cohorts.some(item => item.cohort_id === selectedCohortId)) {
      selectedCohortId = cohorts[0]?.cohort_id || "";
      participants = [];
    }
    if (!commercialRequests.some(item => item.request_id === selectedCommercialRequestId)) {
      selectedCommercialRequestId = "";
    }
  }

  function renderAll() {
    renderSummary();
    renderLicenses();
    renderLicenseDetail();
    renderCommercialRequests();
    renderCommercialRequestDetail();
    renderEvaluations();
    renderPermissions();
    renderAnalytics();
    renderLayerForms();
    refreshIcons(root);
  }

  function renderSummary() {
    const panel = root.querySelector('[data-map-panel="summary"]');
    if (!panel) return;
    panel.innerHTML = `
      <section class="maps-license-metrics" aria-label="Resumen operativo">
        ${metric("Licencias activas", overview.active_licenses, `${overview.total_licenses || 0} registradas`)}
        ${metric("Plazas asignadas", overview.assigned_seats, `${overview.available_seats || 0} disponibles`)}
        ${metric("Cohortes activas", overview.active_evaluation_cohorts, `${overview.evaluation_participants || 0} participantes`)}
        ${metric("Vencen en 30 días", overview.expiring_licenses, `${overview.evaluation_events_30d || 0} eventos recientes`)}
      </section>
      <div class="maps-license-summary-grid">
        <article class="maps-license-card">
          ${ui.sectionHeader({
            className: "maps-license-section-head",
            eyebrow: "Distribución",
            title: "Estado por producto"
          })}
          ${productSummaryTable()}
        </article>
        <aside class="maps-license-card maps-license-operational-note">
          ${ui.icon(Number(overview.expiring_licenses || 0) ? "triangle-alert" : "circle-check", "md")}
          <div>
            <span class="workspace-eyebrow">Atención operativa</span>
            <h2>${Number(overview.expiring_licenses || 0) ? "Hay vencimientos próximos" : "Sin alertas críticas"}</h2>
            <p>${Number(overview.expiring_licenses || 0)
              ? `${overview.expiring_licenses} licencia(s) requieren revisión durante los próximos 30 días.`
              : "No hay vencimientos próximos registrados."}</p>
          </div>
        </aside>
      </div>`;
  }

  function metric(label, value, detail) {
    return ui.metric({ label, value, detail, className: "maps-license-metric" });
  }

  function productSummaryTable() {
    const rows = Object.entries(PRODUCTS).map(([key, label]) => {
      const productLicenses = licenses.filter(item => item.product_key === key);
      const active = productLicenses.filter(item => contracts.effectiveStatus(item) === "active").length;
      const seats = productLicenses.reduce((sum, item) => sum + Number(item.assigned_seats || 0), 0);
      return `<tr><td><strong>${escapeHtml(label)}</strong></td><td>${active}</td><td>${seats}</td></tr>`;
    }).join("");
    return `<div class="maps-license-table-wrap"><table class="maps-license-table">
      <thead><tr><th>Producto</th><th>Activas</th><th>Plazas usadas</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
  }

  function renderLicenses() {
    const panel = root.querySelector('[data-map-panel="licenses"]');
    if (!panel) return;
    panel.innerHTML = `
      <article class="maps-license-card">
        ${ui.sectionHeader({
          className: "maps-license-section-head",
          actionsClassName: "maps-license-actions",
          eyebrow: "Inventario comercial",
          title: "Licencias",
          description: "Busca y filtra antes de abrir el detalle operativo.",
          actions: has("platform.licenses.manage") ? [{
            label: "Emitir licencia",
            icon: "badge-plus",
            className: "btn btn-primary",
            data: { openMapLayer: "map-issue-license-dialog" }
          }] : []
        })}
        <div class="maps-license-toolbar" role="search">
          <label class="maps-license-search">
            <span class="sr-only">Buscar licencias</span>
            ${ui.icon("search", "sm")}
            <input type="search" value="${escapeHtml(licenseQuery)}" placeholder="Cuenta, ID, producto o plan" data-map-license-query>
          </label>
          <label><span class="sr-only">Filtrar por estado</span>
            <select data-map-license-status-filter>
              ${filterOption("all", "Todos los estados", licenseStatusFilter)}
              ${Object.entries(contracts.STATUS).filter(([key]) => key !== "unknown").map(([key, meta]) => filterOption(key, meta.label, licenseStatusFilter)).join("")}
            </select>
          </label>
          <label><span class="sr-only">Filtrar por producto</span>
            <select data-map-license-product-filter>
              ${filterOption("all", "Todos los productos", licenseProductFilter)}
              ${Object.entries(PRODUCTS).map(([key, label]) => filterOption(key, label, licenseProductFilter)).join("")}
            </select>
          </label>
          <span class="maps-license-result-count" data-map-license-count></span>
        </div>
        <div data-map-license-results>${licenseResults()}</div>
      </article>`;
  }

  function matchingLicenses() {
    const query = licenseQuery.trim().toLocaleLowerCase("es");
    return licenses.filter(item => {
      const status = contracts.effectiveStatus(item);
      const text = [
        item.account_name,
        item.license_id,
        PRODUCTS[item.product_key] || item.product_key,
        item.plan_name,
        item.license_type
      ].join(" ").toLocaleLowerCase("es");
      return (!query || text.includes(query))
        && (licenseStatusFilter === "all" || status === licenseStatusFilter)
        && (licenseProductFilter === "all" || item.product_key === licenseProductFilter);
    });
  }

  function licenseResults() {
    const matches = matchingLicenses();
    queueMicrotask(() => {
      const count = root?.querySelector("[data-map-license-count]");
      if (count) count.textContent = `${matches.length} de ${licenses.length}`;
    });
    if (!matches.length) {
      return ui.emptyState({
        className: "maps-license-empty",
        icon: licenses.length ? "search-x" : "badge-plus",
        title: licenses.length ? "No hay coincidencias." : "Aún no hay licencias emitidas.",
        description: licenses.length
          ? "Prueba otra búsqueda o elimina uno de los filtros."
          : "Emite una licencia cuando exista una cuenta y un plan comercial listos."
      });
    }
    return `<div class="maps-license-table-wrap"><table class="maps-license-table maps-license-records">
      <thead><tr><th>Cuenta</th><th>Producto / plan</th><th>Estado</th><th>Capacidad</th><th>Vigencia</th><th><span class="sr-only">Acciones</span></th></tr></thead>
      <tbody>${matches.map(item => {
        const assigned = Number(item.assigned_seats || 0);
        const capacity = Number(item.seat_limit || 0);
        const usage = capacity ? Math.min(100, Math.round((assigned / capacity) * 100)) : 0;
        return `<tr>
          <td><strong>${escapeHtml(item.account_name)}</strong><small>${escapeHtml(item.license_id)}</small></td>
          <td>${escapeHtml(PRODUCTS[item.product_key] || item.product_key)}<small>${escapeHtml(item.plan_name || item.license_type)}</small></td>
          <td>${licenseStatusBadge(item)}</td>
          <td><strong>${assigned} / ${capacity}</strong>${ui.progress({ value: usage, label: `${usage}% ocupado`, className: "maps-license-capacity" })}</td>
          <td>${formatDate(item.starts_at)}<small>${item.ends_at ? `hasta ${formatDate(item.ends_at)}` : "sin vencimiento"}</small></td>
          <td><button class="btn btn-ghost btn-compact" type="button" data-map-license-detail="${escapeHtml(item.license_id)}">Ver detalle</button></td>
        </tr>`;
      }).join("")}</tbody>
    </table></div>`;
  }

  function licenseStatusBadge(item) {
    const status = contracts.effectiveStatus(item);
    const meta = contracts.STATUS[status] || contracts.STATUS.unknown;
    return ui.statusBadge({
      label: meta.label,
      status: meta.tone,
      icon: meta.icon,
      className: `maps-license-status ${status}`
    });
  }

  function renderCommercialRequests() {
    const panel = root.querySelector('[data-map-panel="commercial"]');
    if (!panel) return;
    if (!commercialRequestsAvailable) {
      panel.innerHTML = `<article class="maps-license-card">${ui.dataState({
        tone: "warning",
        icon: "wifi-off",
        title: "La cola comercial no está disponible todavía.",
        description: "Actualiza el backend de MAP-Nano antes de revisar solicitudes comerciales."
      })}</article>`;
      return;
    }
    const pending = commercialRequests.filter(item => item.status === "pending").length;
    const inReview = commercialRequests.filter(item => item.status === "in_review").length;
    const closed = commercialRequests.filter(item => ["resolved", "declined"].includes(item.status)).length;
    panel.innerHTML = `
      <section class="maps-license-metrics maps-license-request-metrics" aria-label="Resumen de solicitudes comerciales">
        ${metric("Pendientes", pending, "requieren primera respuesta")}
        ${metric("En revisión", inReview, "seguimiento comercial activo")}
        ${metric("Cerradas", closed, "resueltas o no aprobadas")}
        ${metric("Registradas", commercialRequests.length, "máximo 200 más recientes")}
      </section>
      <article class="maps-license-card">
        ${ui.sectionHeader({
          className: "maps-license-section-head",
          eyebrow: "MAP-Nano · gestión comercial",
          title: "Solicitudes",
          description: "Los datos de contacto se muestran solo a responsables de licencias para dar seguimiento y documentar la decisión."
        })}
        <div class="maps-license-toolbar maps-license-request-toolbar" role="search">
          <label class="maps-license-search">
            <span class="sr-only">Buscar solicitudes</span>
            ${ui.icon("search", "sm")}
            <input type="search" value="${escapeHtml(commercialRequestQuery)}" placeholder="Contacto, organización, correo o plan" data-map-commercial-request-query>
          </label>
          <label><span class="sr-only">Filtrar por estado</span>
            <select data-map-commercial-request-status-filter>
              ${filterOption("all", "Todos los estados", commercialRequestStatusFilter)}
              ${Object.entries(contracts.COMMERCIAL_REQUEST_STATUS).filter(([key]) => key !== "unknown").map(([key, meta]) => filterOption(key, meta.label, commercialRequestStatusFilter)).join("")}
            </select>
          </label>
          <span class="maps-license-result-count" data-map-commercial-request-count></span>
        </div>
        <div data-map-commercial-request-results>${commercialRequestResults()}</div>
      </article>`;
  }

  function matchingCommercialRequests() {
    const query = commercialRequestQuery.trim().toLocaleLowerCase("es");
    return commercialRequests.filter(item => {
      const text = [
        item.contact_name,
        item.contact_email,
        item.organization_name,
        item.country,
        commercialPlanName(item.plan_key),
        commercialRequestTypeLabel(item.request_type)
      ].join(" ").toLocaleLowerCase("es");
      return (!query || text.includes(query))
        && (commercialRequestStatusFilter === "all" || item.status === commercialRequestStatusFilter);
    });
  }

  function commercialRequestResults() {
    const matches = matchingCommercialRequests();
    queueMicrotask(() => {
      const count = root?.querySelector("[data-map-commercial-request-count]");
      if (count) count.textContent = `${matches.length} de ${commercialRequests.length}`;
    });
    if (!matches.length) {
      return ui.emptyState({
        className: "maps-license-empty",
        icon: commercialRequests.length ? "search-x" : "activity",
        title: commercialRequests.length ? "No hay coincidencias." : "No hay solicitudes comerciales.",
        description: commercialRequests.length
          ? "Prueba otra búsqueda o elimina el filtro de estado."
          : "Las solicitudes de MAP-Nano aparecerán aquí cuando los clientes las envíen."
      });
    }
    return `<div class="maps-license-table-wrap"><table class="maps-license-table maps-license-commercial-records">
      <thead><tr><th>Solicitud</th><th>Contacto</th><th>Organización</th><th>Alcance</th><th>Estado</th><th>Recibida</th><th><span class="sr-only">Acciones</span></th></tr></thead>
      <tbody>${matches.map(item => `<tr>
        <td><strong>${escapeHtml(commercialPlanName(item.plan_key))}</strong><small>${escapeHtml(commercialRequestTypeLabel(item.request_type))}</small></td>
        <td><strong>${escapeHtml(item.contact_name)}</strong><small>${escapeHtml(item.contact_email)}</small></td>
        <td><strong>${escapeHtml(item.organization_name)}</strong><small>${escapeHtml(item.country)}</small></td>
        <td><strong>${Number(item.estimated_users || 0)} usuario(s)</strong><small>${escapeHtml(analysisVolumeLabel(item.analysis_volume))}</small></td>
        <td>${commercialRequestStatusBadge(item)}</td>
        <td>${formatDate(item.created_at)}</td>
        <td><button class="btn btn-ghost btn-compact" type="button" data-map-commercial-request-detail="${escapeHtml(item.request_id)}">Ver detalle</button></td>
      </tr>`).join("")}</tbody>
    </table></div>`;
  }

  function commercialPlanName(planKey) {
    if (planKey === "project") return mapNanoPlans.PROJECT_ACCESS.name;
    return mapNanoPlans.planById(planKey)?.name || `MAP-Nano · ${planKey || "Plan sin identificar"}`;
  }

  function commercialRequestTypeLabel(requestType) {
    return ({
      new_license: "Nueva licencia",
      upgrade: "Ampliación o mejora",
      institutional_quote: "Cotización institucional",
      project_access: "Acceso por proyecto",
      demo: "Demostración"
    })[requestType] || "Solicitud comercial";
  }

  function analysisVolumeLabel(value) {
    return ({
      under_100: "Menos de 100 imágenes/mes",
      "100_to_1000": "100–1,000 imágenes/mes",
      over_1000: "Más de 1,000 imágenes/mes",
      unknown: "Volumen por definir"
    })[value] || "Volumen por definir";
  }

  function commercialRequestStatusBadge(item) {
    const meta = contracts.commercialRequestStatus(item.status);
    return ui.statusBadge({
      label: meta.label,
      status: meta.tone,
      className: `maps-license-status commercial-${item.status}`
    });
  }

  function renderCommercialRequestDetail() {
    const target = root?.querySelector("[data-map-commercial-request-detail-content]");
    if (!target) return;
    const item = commercialRequests.find(request => request.request_id === selectedCommercialRequestId);
    if (!item) {
      target.innerHTML = ui.emptyState({ title: "Solicitud no disponible.", icon: "activity" });
      return;
    }
    const canReview = ["pending", "in_review"].includes(item.status);
    const reviewHistory = item.reviewed_at ? `
      <section class="maps-license-commercial-review">
        <h3>Última revisión</h3>
        <p>${escapeHtml(item.reviewed_by_name || "Responsable de licencias")} · ${formatDate(item.reviewed_at)}</p>
        ${item.resolution_note ? `<blockquote>${escapeHtml(item.resolution_note)}</blockquote>` : ""}
      </section>` : "";
    const cancellation = item.cancelled_at ? `
      <section class="maps-license-commercial-review is-muted">
        <h3>Cancelada por el solicitante</h3>
        <p>${formatDate(item.cancelled_at)}</p>
        ${item.cancellation_note ? `<blockquote>${escapeHtml(item.cancellation_note)}</blockquote>` : ""}
      </section>` : "";
    target.innerHTML = `
      <header class="workspace-layer-head">
        <div>
          <span class="workspace-eyebrow">Solicitud MAP-Nano</span>
          <h2>${escapeHtml(commercialPlanName(item.plan_key))}</h2>
          <p>${escapeHtml(commercialRequestTypeLabel(item.request_type))} · recibida el ${formatDate(item.created_at)}</p>
        </div>
        ${closeLayerButton("Cerrar detalle")}
      </header>
      <div class="workspace-layer-body">
        <div class="maps-license-detail-status">${commercialRequestStatusBadge(item)}</div>
        <dl class="maps-license-detail-list">
          <div><dt>Contacto</dt><dd>${escapeHtml(item.contact_name || "—")}</dd></div>
          <div><dt>Correo</dt><dd>${escapeHtml(item.contact_email || "—")}</dd></div>
          <div><dt>Organización</dt><dd>${escapeHtml(item.organization_name || "—")}</dd></div>
          <div><dt>País</dt><dd>${escapeHtml(item.country || "—")}</dd></div>
          <div><dt>Usuarios estimados</dt><dd>${Number(item.estimated_users || 0)}</dd></div>
          <div><dt>Volumen</dt><dd>${escapeHtml(analysisVolumeLabel(item.analysis_volume))}</dd></div>
        </dl>
        <section class="maps-license-detail-section">
          <h3>Contexto del solicitante</h3>
          <p class="maps-license-commercial-message">${escapeHtml(item.message || "No dejó un mensaje adicional.")}</p>
        </section>
        ${reviewHistory}
        ${cancellation}
        ${canReview ? `
          <section class="maps-license-detail-section">
            <h3>Actualizar revisión</h3>
            <p class="muted-text">Documenta una nota antes de resolver o declinar la solicitud.</p>
            <form class="maps-license-form" data-map-commercial-request-review-form>
              <input type="hidden" name="requestId" value="${escapeHtml(item.request_id)}">
              <label>Estado
                <select name="status" data-map-commercial-review-status required>
                  ${filterOption("in_review", "En revisión", "in_review")}
                  ${filterOption("resolved", "Resuelta", "in_review")}
                  ${filterOption("declined", "No aprobada", "in_review")}
                </select>
              </label>
              <label data-map-commercial-resolution-label>Nota de revisión (opcional)
                <textarea name="resolutionNote" data-map-commercial-resolution-note maxlength="2000" rows="5" placeholder="Próximo paso, decisión o contexto comercial"></textarea>
              </label>
              <button class="btn btn-primary" type="submit" data-map-control>Guardar revisión</button>
            </form>
          </section>` : ""}
      </div>`;
    syncCommercialReviewForm(target.querySelector("[data-map-commercial-request-review-form]"));
    refreshIcons(target);
  }

  function licenseLayers() {
    return `
      <dialog id="map-license-detail-dialog" class="workspace-layer is-drawer" data-map-license-detail-dialog>
        <div class="workspace-layer-panel" data-map-license-detail-content></div>
      </dialog>
      <dialog id="map-commercial-request-detail-dialog" class="workspace-layer is-drawer" data-map-commercial-request-detail-dialog>
        <div class="workspace-layer-panel" data-map-commercial-request-detail-content></div>
      </dialog>
      <dialog id="map-issue-license-dialog" class="workspace-layer is-modal">
        <form class="workspace-layer-panel maps-license-form" data-issue-license-form>
          <header class="workspace-layer-head">
            <div><span class="workspace-eyebrow">Nuevo acceso</span><h2>Emitir acceso MAP</h2><p>Asigna una licencia comercial o incorpora un tester a un programa aliado.</p></div>
            ${closeLayerButton("Cerrar formulario")}
          </header>
          <div class="workspace-layer-body">${issueLicenseFields()}</div>
          <footer class="workspace-layer-actions">
            <button class="btn btn-ghost" type="button" data-close-map-layer>Cancelar</button>
            <button class="btn btn-primary" type="submit" data-map-control data-map-issue-submit>${issueAccessKind === "partner_test" ? "Dar acceso tester" : "Emitir licencia"}</button>
          </footer>
        </form>
      </dialog>`;
  }

  function renderLicenseDetail() {
    const target = root?.querySelector("[data-map-license-detail-content]");
    if (!target) return;
    const item = licenses.find(license => license.license_id === selectedLicenseId);
    if (!item) {
      target.innerHTML = ui.emptyState({ title: "Licencia no disponible.", icon: "badge-x" });
      return;
    }
    const assigned = Number(item.assigned_seats || 0);
    const capacity = Number(item.seat_limit || 0);
    const usage = capacity ? Math.min(100, Math.round((assigned / capacity) * 100)) : 0;
    const assignable = contracts.effectiveStatus(item) === "active" && assigned < capacity;
    target.innerHTML = `
      <header class="workspace-layer-head">
        <div>
          <span class="workspace-eyebrow">${escapeHtml(item.account_name)}</span>
          <h2>${escapeHtml(PRODUCTS[item.product_key] || item.product_key)}</h2>
          <p>${escapeHtml(item.plan_name || item.license_type)} · ${escapeHtml(item.license_id)}</p>
        </div>
        ${closeLayerButton("Cerrar detalle")}
      </header>
      <div class="workspace-layer-body">
        <div class="maps-license-detail-status">${licenseStatusBadge(item)}</div>
        <dl class="maps-license-detail-list">
          <div><dt>Inicio</dt><dd>${formatDate(item.starts_at)}</dd></div>
          <div><dt>Vencimiento</dt><dd>${item.ends_at ? formatDate(item.ends_at) : "Sin vencimiento"}</dd></div>
          <div><dt>Origen</dt><dd>${escapeHtml(item.license_source || "—")}</dd></div>
          <div><dt>Tipo</dt><dd>${item.is_evaluation ? "Evaluación" : "Comercial"}</dd></div>
        </dl>
        <section class="maps-license-detail-section">
          <div class="maps-license-section-head"><div><h3>Capacidad</h3><p>${assigned} de ${capacity} plazas asignadas</p></div><strong>${usage}%</strong></div>
          ${ui.progress({ value: usage, label: `${usage}% ocupado`, className: "maps-license-capacity is-large" })}
        </section>
        ${has("platform.licenses.manage") && assignable ? `
          <section class="maps-license-detail-section">
            <h3>Asignar una plaza</h3>
            <form class="maps-license-form" data-assign-license-form>
              <input type="hidden" name="licenseId" value="${escapeHtml(item.license_id)}">
              <label>Usuario<select name="userId" required autofocus>${optionList(users, "user_id", "display_name", "email")}</select></label>
              <button class="btn btn-primary" type="submit" data-map-control>Asignar plaza</button>
            </form>
          </section>` : ""}
        ${has("platform.licenses.manage") && item.license_status !== "revoked" ? `
          <section class="maps-license-danger-zone">
            <div><strong>Revocar licencia</strong><p>El acceso se interrumpirá y sus plazas dejarán de estar disponibles.</p></div>
            <button class="btn btn-ghost" type="button" data-revoke-license="${escapeHtml(item.license_id)}">Revocar</button>
          </section>` : ""}
      </div>`;
    refreshIcons(target);
  }

  function issueLicenseFields() {
    return `
      <label>Tipo de acceso<select name="accessKind" data-map-issue-access-kind required autofocus>
        <option value="commercial" ${issueAccessKind === "commercial" ? "selected" : ""}>Licencia comercial</option>
        <option value="partner_test" ${issueAccessKind === "partner_test" ? "selected" : ""}>Tester de cliente aliado</option>
      </select></label>
      <div data-map-issue-access-fields>${issueAccessDetails()}</div>`;
  }

  function issueAccessDetails() {
    if (issueAccessKind === "partner_test") return partnerTesterFields();
    const commercialPlans = plans.filter(plan => !plan.is_evaluation);
    return `
      <label>Cuenta<select name="accountId" required>${optionList(accounts, "account_id", "display_name")}</select></label>
      <label>Plan<select name="planId" required>${commercialPlans.map(plan => `<option value="${escapeHtml(plan.plan_id)}" data-seats="${Number(plan.default_seat_limit || 1)}">${escapeHtml(PRODUCTS[plan.product_key] || plan.product_key)} · ${escapeHtml(plan.plan_name)}</option>`).join("")}</select></label>
      <div class="maps-license-form-row">
        <label>Plazas<input name="seatLimit" type="number" min="1" value="${Number(commercialPlans[0]?.default_seat_limit || 1)}" required></label>
        <label>Inicio<input name="startsAt" type="datetime-local" value="${localDateValue(new Date())}" required></label>
      </div>
      <label>Vencimiento opcional<input name="endsAt" type="datetime-local"></label>`;
  }

  function activeInstitutions() {
    return institutions.filter(item => item.status === "active");
  }

  function partnerTesterCohorts(institutionId = testerInstitutionId) {
    if (!institutionId || institutionId === "none") return [];
    return cohorts.filter(item => item.program_type === "partner_test"
      && item.cohort_status === "active"
      && (item.institution_id || item.account_id) === institutionId);
  }

  function selectedTesterCohort() {
    return partnerTesterCohorts().find(item => item.cohort_id === testerCohortId) || null;
  }

  function selectedTesterUser() {
    return users.find(item => item.user_id === testerUserId) || null;
  }

  function partnerTesterFields() {
    const availableInstitutions = activeInstitutions();
    if (testerInstitutionId !== "none" && !availableInstitutions.some(item => item.institution_id === testerInstitutionId)) {
      testerInstitutionId = "none";
    }
    if (testerUserId !== "new" && !users.some(item => item.user_id === testerUserId)) testerUserId = "new";
    const testerCohorts = partnerTesterCohorts();
    if (!testerCohorts.some(item => item.cohort_id === testerCohortId)) testerCohortId = "";
    const selectedCohort = selectedTesterCohort();
    const selectedUser = selectedTesterUser();
    const evaluationPlans = plans.filter(plan => plan.is_evaluation);
    const institutionOptions = availableInstitutions.map(item => {
      const domains = Array.isArray(item.verified_domains) && item.verified_domains.length
        ? ` · ${item.verified_domains.join(", ")}`
        : "";
      return `<option value="${escapeHtml(item.institution_id)}" ${testerInstitutionId === item.institution_id ? "selected" : ""}>${escapeHtml(item.display_name)}${escapeHtml(domains)}</option>`;
    }).join("");
    const userOptions = users.map(item => `<option value="${escapeHtml(item.user_id)}" ${testerUserId === item.user_id ? "selected" : ""}>${escapeHtml(item.display_name || item.email)} · ${escapeHtml(item.email)}</option>`).join("");
    return `
      <label>Institución<select name="institutionId" data-map-tester-institution required>
        <option value="none" ${testerInstitutionId === "none" ? "selected" : ""}>Sin institución / independiente</option>
        ${institutionOptions}
      </select></label>
      <label>Cuenta del usuario<select name="userId" data-map-tester-user required>
        <option value="new" ${testerUserId === "new" ? "selected" : ""}>Invitar una cuenta nueva</option>
        ${userOptions}
      </select></label>
      ${selectedUser ? `<p class="maps-license-form-note"><strong>${escapeHtml(selectedUser.display_name || selectedUser.email)}</strong><br>${escapeHtml(selectedUser.email)}</p>` : `
        <label>Nombre completo<input name="fullName" maxlength="160" required autocomplete="name"></label>
        <label>Correo<input name="email" type="email" maxlength="254" required autocomplete="email" placeholder="usuario@institucion.edu"></label>`}
      <label>Cohorte <small>(opcional)</small><select name="cohortId" data-map-tester-cohort>
        <option value="">Sin cohorte</option>
        ${testerCohorts.map(item => `<option value="${escapeHtml(item.cohort_id)}" ${testerCohortId === item.cohort_id ? "selected" : ""}>${escapeHtml(item.cohort_name || item.name)} · ${escapeHtml(PRODUCTS[item.product_key] || item.product_key)}</option>`).join("")}
      </select></label>
      ${selectedCohort ? `
        <p class="maps-license-form-note">La cohorte define ${escapeHtml(PRODUCTS[selectedCohort.product_key] || selectedCohort.product_key)}, la vigencia ${formatDate(selectedCohort.starts_at)} — ${formatDate(selectedCohort.ends_at)} y su justificación.</p>` : `
        <label>Producto<select name="productKey" required>${evaluationPlans.map(plan => `<option value="${escapeHtml(plan.product_key)}">${escapeHtml(PRODUCTS[plan.product_key] || plan.product_key)}</option>`).join("")}</select></label>
        <div class="maps-license-form-row">
          <label>Inicio<input name="startsAt" type="datetime-local" value="${localDateValue(new Date())}" required></label>
          <label>Fin<input name="endsAt" type="datetime-local" value="${localDateValue(new Date(Date.now() + trialOffer.duration_days * 86400000))}" required></label>
        </div>
        <label>Revisión intermedia <small>(opcional)</small><input name="reviewAt" type="datetime-local"></label>
        <label>Justificación de la concesión<textarea name="grantReason" minlength="10" maxlength="1000" rows="3" required placeholder="Motivo, alcance acordado y valor esperado para BCC y el tester."></textarea></label>`}
      <p class="maps-license-form-note">La licencia se emitirá sobre la cuenta individual del usuario. La institución y la cohorte sólo organizan su afiliación.</p>`;
  }

  function renderEvaluations() {
    const panel = root.querySelector('[data-map-panel="evaluations"]');
    if (!panel) return;
    const selected = cohorts.find(item => item.cohort_id === selectedCohortId);
    panel.innerHTML = `
      <article class="maps-license-card">
        ${ui.sectionHeader({
          className: "maps-license-section-head",
          actionsClassName: "maps-license-actions",
          eyebrow: "Acceso temporal",
          title: "Evaluaciones",
          description: "Selecciona una cohorte para operar sus participantes.",
          actions: [
            {
              label: "Nueva institución",
              icon: "building-2",
              className: "btn btn-ghost",
              data: { openMapLayer: "map-institution-dialog" }
            },
            {
              label: "Nueva cohorte",
              icon: "users-round",
              className: "btn btn-primary",
              data: { openMapLayer: "map-cohort-dialog" }
            }
          ]
        })}
        <div class="maps-license-evaluation-layout">
          <aside class="maps-license-cohort-browser">
            <label class="maps-license-search">
              <span class="sr-only">Buscar cohortes</span>${ui.icon("search", "sm")}
              <input type="search" value="${escapeHtml(cohortQuery)}" placeholder="Buscar cohorte o institución" data-map-cohort-query>
            </label>
            <div data-map-cohort-list>${cohortList()}</div>
          </aside>
          <section class="maps-license-cohort-detail" data-map-cohort-detail>
            ${selected ? cohortDetail(selected) : ui.emptyState({
              title: "Selecciona una cohorte.",
              description: "Aquí podrás revisar vigencia, estado y participantes.",
              icon: "panel-right"
            })}
          </section>
        </div>
      </article>`;
  }

  function matchingCohorts() {
    const query = cohortQuery.trim().toLocaleLowerCase("es");
    return cohorts.filter(item => !query || [
      item.cohort_name,
      item.name,
      item.account_name,
      PRODUCTS[item.product_key] || item.product_key,
      accessProgram(item).label,
      item.grant_reason
    ].join(" ").toLocaleLowerCase("es").includes(query));
  }

  function cohortList() {
    const matches = matchingCohorts();
    if (!matches.length) {
      return ui.emptyState({
        className: "maps-license-empty is-compact",
        icon: cohorts.length ? "search-x" : "users",
        title: cohorts.length ? "No hay coincidencias." : "No hay cohortes.",
        description: cohorts.length ? "Prueba con otro término." : "Crea la primera cohorte de evaluación."
      });
    }
    return `<div class="maps-license-cohort-list">${matches.map(item => {
      const selected = item.cohort_id === selectedCohortId;
      return `<button class="maps-license-cohort ${selected ? "is-selected" : ""}" type="button"
        data-load-participants="${escapeHtml(item.cohort_id)}" aria-pressed="${selected}">
        <span class="maps-license-cohort-head">
          <span><strong>${escapeHtml(item.cohort_name || item.name)}</strong><small>${escapeHtml(item.institution_name || item.account_name)}</small></span>
          ${cohortStatusBadge(item)}
        </span>
        <span class="maps-license-cohort-meta">${escapeHtml(accessProgram(item).label)} · ${escapeHtml(PRODUCTS[item.product_key] || item.product_key)} · ${Number(item.participant_count || 0)} participantes</span>
      </button>`;
    }).join("")}</div>`;
  }

  function cohortStatusBadge(item) {
    return ui.statusBadge(cohortStatus(item));
  }

  function cohortStatus(item) {
    const status = item.cohort_status || "unknown";
    return {
      label: ({ active: "Activa", scheduled: "Programada", ended: "Finalizada", revoked: "Revocada" })[status] || status,
      status: status === "active" ? "success" : status === "scheduled" ? "warning" : status === "revoked" ? "danger" : "neutral"
    };
  }

  function accessProgram(item) {
    const key = String(item?.program_type || "standard_evaluation");
    return ACCESS_PROGRAMS[key] || { label: key, tone: "neutral" };
  }

  function cohortDetail(item) {
    const program = accessProgram(item);
    return `
      ${ui.sectionHeader({
        className: "maps-license-section-head",
        eyebrow: PRODUCTS[item.product_key] || item.product_key,
        title: item.cohort_name || item.name,
        description: `${item.account_name} · ${formatDate(item.starts_at)} — ${formatDate(item.ends_at)}`,
        status: cohortStatus(item)
      })}
      <section class="maps-license-program-summary" aria-label="Gobierno del acceso">
        <div class="maps-license-program-summary-head">
          <span class="workspace-eyebrow">Programa de acceso</span>
          ${ui.statusBadge({ label: program.label, status: program.tone })}
        </div>
        <dl>
          <div><dt>Justificación</dt><dd>${escapeHtml(item.grant_reason || "Evaluación estándar")}</dd></div>
          <div><dt>Responsable BCC</dt><dd>${escapeHtml(item.sponsor_name || "No registrado")}</dd></div>
          <div><dt>Revisión</dt><dd>${item.review_at ? formatDate(item.review_at) : "Sin revisión intermedia"}</dd></div>
          <div><dt>Renovaciones</dt><dd>${Number(item.renewal_count || 0)} de ${Number(item.max_renewals || 0)}</dd></div>
        </dl>
      </section>
      ${item.purpose ? `<p class="maps-license-cohort-purpose">${escapeHtml(item.purpose)}</p>` : ""}
      ${ui.sectionHeader({
        className: "maps-license-section-head maps-license-participant-head",
        title: "Participantes",
        level: 3,
        description: `${participants.length} acceso(s) registrado(s)`,
        actions: [{
          label: "Invitar",
          icon: "user-plus",
          compact: true,
          className: "btn btn-primary",
          data: { openMapLayer: "map-participant-dialog" }
        }]
      })}
      ${participantTable()}`;
  }

  function participantTable() {
    if (participantError) {
      return ui.dataState({
        className: "maps-license-empty is-compact",
        tone: "error",
        icon: "wifi-off",
        title: "No pudimos cargar los participantes.",
        description: participantError,
        action: {
          label: "Reintentar",
          compact: true,
          className: "btn btn-ghost",
          data: { loadParticipants: selectedCohortId }
        }
      });
    }
    if (!participants.length) {
      return ui.emptyState({
        className: "maps-license-empty is-compact",
        icon: "user-plus",
        title: "Esta cohorte no tiene participantes.",
        description: "Invita por correo para crear o vincular el acceso."
      });
    }
    return `<div class="maps-license-table-wrap"><table class="maps-license-table maps-license-participants">
      <thead><tr><th>Usuario</th><th>Estado</th><th>Vigencia</th><th><span class="sr-only">Acciones</span></th></tr></thead>
      <tbody>${participants.map(item => `<tr>
        <td><strong>${escapeHtml(item.display_name || item.email)}</strong><small>${escapeHtml(item.email)}</small></td>
        <td>${escapeHtml(item.member_status)}</td>
        <td>${formatDate(item.valid_until)}</td>
        <td>${["active", "invited"].includes(item.member_status) ? `<button class="btn btn-ghost btn-compact" type="button" data-revoke-participant="${escapeHtml(item.user_id)}">Revocar</button>` : ""}</td>
      </tr>`).join("")}</tbody>
    </table></div>`;
  }

  function evaluationLayers() {
    return `
      <dialog id="map-institution-dialog" class="workspace-layer is-modal">
        <form class="workspace-layer-panel maps-license-form" data-create-institution>
          <header class="workspace-layer-head"><div><span class="workspace-eyebrow">Institución</span><h2>Nueva institución</h2><p>Registra la institución que agrupará usuarios y cohortes opcionales.</p></div>${closeLayerButton("Cerrar formulario")}</header>
          <div class="workspace-layer-body">
            <label>Nombre de la institución<input name="displayName" maxlength="160" required autofocus></label>
            <label>Dominio institucional <small>(opcional)</small><input name="domain" maxlength="253" inputmode="url" placeholder="uasd.edu.do"></label>
          </div>
          <footer class="workspace-layer-actions"><button class="btn btn-ghost" type="button" data-close-map-layer>Cancelar</button><button class="btn btn-primary" type="submit" data-map-control>Crear institución</button></footer>
        </form>
      </dialog>
      <dialog id="map-cohort-dialog" class="workspace-layer is-modal">
        <form class="workspace-layer-panel maps-license-form" data-create-cohort>
          <header class="workspace-layer-head"><div><span class="workspace-eyebrow">Acceso temporal</span><h2>Nueva cohorte</h2><p>La política vigente ofrece ${trialOffer.duration_days} días (${escapeHtml(trialOffer.display_name)}).</p></div>${closeLayerButton("Cerrar formulario")}</header>
          <div class="workspace-layer-body">${cohortFields()}</div>
          <footer class="workspace-layer-actions"><button class="btn btn-ghost" type="button" data-close-map-layer>Cancelar</button><button class="btn btn-primary" type="submit" data-map-control>Crear cohorte</button></footer>
        </form>
      </dialog>
      <dialog id="map-participant-dialog" class="workspace-layer is-modal">
        <form class="workspace-layer-panel maps-license-form" data-invite-participant>
          <header class="workspace-layer-head"><div><span class="workspace-eyebrow">Participante</span><h2>Invitar a la cohorte</h2><p>El acceso quedará vinculado a la cohorte seleccionada.</p></div>${closeLayerButton("Cerrar formulario")}</header>
          <div class="workspace-layer-body">
            <input type="hidden" name="cohortId" value="${escapeHtml(selectedCohortId)}">
            <label>Correo<input name="email" type="email" maxlength="320" required autofocus autocomplete="email"></label>
            <label>Nombre completo <small>(para cuentas nuevas)</small><input name="fullName" maxlength="160" autocomplete="name"></label>
          </div>
          <footer class="workspace-layer-actions"><button class="btn btn-ghost" type="button" data-close-map-layer>Cancelar</button><button class="btn btn-primary" type="submit" data-map-control>Invitar y asignar</button></footer>
        </form>
      </dialog>`;
  }

  function cohortFields() {
    const evaluationPlans = plans.filter(plan => plan.is_evaluation);
    return `
      <label>Institución<select name="institutionId" required autofocus>${activeInstitutions().map(item => `<option value="${escapeHtml(item.institution_id)}">${escapeHtml(item.display_name)}</option>`).join("")}</select></label>
      <label>Producto<select name="productKey" required>${evaluationPlans.map(plan => `<option value="${escapeHtml(plan.product_key)}">${escapeHtml(PRODUCTS[plan.product_key] || plan.product_key)}</option>`).join("")}</select></label>
      <label>Programa<select name="programType" required>
        ${Object.entries(ACCESS_PROGRAMS).map(([key, meta]) => `<option value="${escapeHtml(key)}">${escapeHtml(meta.label)}</option>`).join("")}
      </select></label>
      <label>Nombre<input name="name" maxlength="160" required></label>
      <label>Propósito<textarea name="purpose" maxlength="2000" rows="3"></textarea></label>
      <label>Justificación de la concesión<textarea name="grantReason" minlength="10" maxlength="1000" rows="3" required placeholder="Motivo, alcance acordado y valor esperado para BCC y el aliado."></textarea></label>
      <div class="maps-license-form-row">
        <label>Inicio<input name="startsAt" type="datetime-local" value="${localDateValue(new Date())}" required></label>
        <label>Fin<input name="endsAt" type="datetime-local" value="${localDateValue(new Date(Date.now() + trialOffer.duration_days * 86400000))}" required></label>
      </div>
      <div class="maps-license-form-row">
        <label>Revisión intermedia <small>(opcional)</small><input name="reviewAt" type="datetime-local"></label>
        <label>Renovaciones permitidas<input name="maxRenewals" type="number" min="0" max="12" value="0" required></label>
      </div>`;
  }

  function renderLayerForms() {
    const issueBody = root?.querySelector("#map-issue-license-dialog .workspace-layer-body");
    if (issueBody) issueBody.innerHTML = issueLicenseFields();
    syncIssueLicenseSubmit();
    const cohortBody = root?.querySelector("#map-cohort-dialog .workspace-layer-body");
    if (cohortBody) cohortBody.innerHTML = cohortFields();
    syncParticipantDialog();
  }

  function renderPermissions() {
    const panel = root.querySelector('[data-map-panel="permissions"]');
    if (!panel) return;
    panel.innerHTML = `<article class="maps-license-card">
      ${ui.sectionHeader({
        className: "maps-license-section-head",
        eyebrow: "Autorización interna",
        title: "Acceso efectivo de plataforma",
        description: "Los roles MAP se sincronizan desde el rol base y los roles internos del perfil.",
        actions: [{ label: "Editar perfiles", href: "#usuarios", className: "btn btn-ghost" }]
      })}
      ${accessUsers.length ? `<div class="maps-license-table-wrap"><table class="maps-license-table">
        <thead><tr><th>Usuario</th><th>Perfil</th><th>Roles MAP</th><th>Permisos efectivos</th></tr></thead>
        <tbody>${accessUsers.map(item => `<tr>
          <td><strong>${escapeHtml(item.display_name)}</strong><small>${escapeHtml(item.email)}</small></td>
          <td>${escapeHtml(item.base_role)}<small>${escapeHtml((item.staff_roles || []).join(", ") || "sin rol interno")}</small></td>
          <td>${escapeHtml((item.platform_roles || []).join(", ") || "—")}</td>
          <td>${escapeHtml((item.platform_permissions || []).join(", ") || "—")}</td>
        </tr>`).join("")}</tbody>
      </table></div>` : ui.emptyState({ title: "No hay datos de permisos.", icon: "shield-question" })}
    </article>`;
  }

  function renderAnalytics() {
    const panel = root.querySelector('[data-map-panel="analytics"]');
    if (!panel) return;
    const sourceCounts = licenses.reduce((result, item) => {
      const source = item.license_source || "unknown";
      result[source] = (result[source] || 0) + 1;
      return result;
    }, {});
    panel.innerHTML = `
      <section class="maps-license-metrics" aria-label="Métricas operativas">
        ${metric("Eventos de evaluación · 30d", overview.evaluation_events_30d, "altas, activaciones y revocaciones")}
        ${metric("Participantes vigentes", overview.evaluation_participants, "invitados y activos")}
        ${metric("Plazas libres", overview.available_seats, "capacidad activa disponible")}
        ${metric("Licencias por vencer", overview.expiring_licenses, "próximos 30 días")}
      </section>
      <article class="maps-license-card">
        ${ui.sectionHeader({
          className: "maps-license-section-head",
          eyebrow: "Procedencia",
          title: "Origen de licencias"
        })}
        ${Object.keys(sourceCounts).length ? `<div class="maps-license-table-wrap"><table class="maps-license-table">
          <thead><tr><th>Origen</th><th>Licencias</th></tr></thead>
          <tbody>${Object.entries(sourceCounts).map(([source, count]) => `<tr><td>${escapeHtml(source)}</td><td>${count}</td></tr>`).join("")}</tbody>
        </table></div>` : ui.emptyState({ title: "No hay actividad suficiente para analizar.", icon: "chart-no-axes-column" })}
        <p class="muted-text">Esta analítica es operativa y no incluye imágenes, resultados científicos ni contenido de muestras.</p>
      </article>`;
  }

  async function handleClick(event) {
    if (event.target.closest("[data-map-refresh]")) return void loadDashboard();


    const openButton = event.target.closest("[data-open-map-layer]");
    if (openButton) {
      if (openButton.dataset.openMapLayer === "map-participant-dialog") syncParticipantDialog();
      const dialog = root.querySelector(`#${openButton.dataset.openMapLayer}`);
      ui.openLayer(dialog, { trigger: openButton });
      return;
    }

    const closeButton = event.target.closest("[data-close-map-layer]");
    if (closeButton) {
      ui.closeLayer(closeButton.closest("dialog"));
      return;
    }

    const licenseButton = event.target.closest("[data-map-license-detail]");
    if (licenseButton) {
      selectedLicenseId = licenseButton.dataset.mapLicenseDetail;
      renderLicenseDetail();
      ui.openLayer(root.querySelector("[data-map-license-detail-dialog]"), { trigger: licenseButton });
      return;
    }

    const commercialRequestButton = event.target.closest("[data-map-commercial-request-detail]");
    if (commercialRequestButton) {
      selectedCommercialRequestId = commercialRequestButton.dataset.mapCommercialRequestDetail;
      renderCommercialRequestDetail();
      ui.openLayer(root.querySelector("[data-map-commercial-request-detail-dialog]"), { trigger: commercialRequestButton });
      return;
    }

    const participantButton = event.target.closest("[data-load-participants]");
    if (participantButton) return void loadParticipants(participantButton.dataset.loadParticipants);

    const revokeParticipant = event.target.closest("[data-revoke-participant]");
    if (revokeParticipant) return void revokeParticipantAccess(revokeParticipant.dataset.revokeParticipant);

    const revokeLicense = event.target.closest("[data-revoke-license]");
    if (revokeLicense) return void revokeLicenseAccess(revokeLicense.dataset.revokeLicense);
  }

  function handleInput(event) {
    if (event.target.matches("[data-map-license-query]")) {
      licenseQuery = event.target.value;
      renderLicenseResultRegion();
    }
    if (event.target.matches("[data-map-cohort-query]")) {
      cohortQuery = event.target.value;
      const list = root.querySelector("[data-map-cohort-list]");
      if (list) list.innerHTML = cohortList();
      refreshIcons(list);
    }
    if (event.target.matches("[data-map-commercial-request-query]")) {
      commercialRequestQuery = event.target.value;
      renderCommercialRequestResultRegion();
    }
  }

  function refreshPartnerTesterFields(form) {
    const fields = form?.querySelector("[data-map-issue-access-fields]");
    if (!fields) return;
    fields.innerHTML = partnerTesterFields();
    syncIssueLicenseSubmit();
    refreshIcons(fields);
  }

  function handleChange(event) {
    if (event.target.matches("[data-map-issue-access-kind]")) {
      issueAccessKind = event.target.value === "partner_test" ? "partner_test" : "commercial";
      const fields = event.target.form?.querySelector("[data-map-issue-access-fields]");
      if (fields) fields.innerHTML = issueAccessDetails();
      syncIssueLicenseSubmit();
      refreshIcons(fields);
    }
    if (event.target.matches("[data-map-tester-institution]")) {
      testerInstitutionId = event.target.value || "none";
      testerCohortId = "";
      refreshPartnerTesterFields(event.target.form);
    }
    if (event.target.matches("[data-map-tester-user]")) {
      testerUserId = event.target.value || "new";
      refreshPartnerTesterFields(event.target.form);
    }
    if (event.target.matches("[data-map-tester-cohort]")) {
      testerCohortId = event.target.value || "";
      refreshPartnerTesterFields(event.target.form);
    }
    if (event.target.matches("[data-map-license-status-filter]")) {
      licenseStatusFilter = event.target.value;
      renderLicenseResultRegion();
    }
    if (event.target.matches("[data-map-license-product-filter]")) {
      licenseProductFilter = event.target.value;
      renderLicenseResultRegion();
    }
    if (event.target.matches("[data-map-commercial-request-status-filter]")) {
      commercialRequestStatusFilter = event.target.value;
      renderCommercialRequestResultRegion();
    }
    if (event.target.matches("[data-map-commercial-review-status]")) {
      syncCommercialReviewForm(event.target.form);
    }
    if (event.target.matches('[name="planId"]')) {
      const seats = event.target.selectedOptions[0]?.dataset.seats;
      const input = event.target.form?.elements?.seatLimit;
      if (input && seats) input.value = seats;
    }
  }

  function syncIssueLicenseSubmit() {
    const submit = root?.querySelector("[data-map-issue-submit]");
    if (!submit) return;
    submit.textContent = issueAccessKind === "partner_test" ? "Dar acceso tester" : "Emitir licencia";
    submit.disabled = false;
    submit.dataset.idleDisabled = "false";
  }

  function renderLicenseResultRegion() {
    const results = root.querySelector("[data-map-license-results]");
    if (results) results.innerHTML = licenseResults();
    refreshIcons(results);
  }

  function renderCommercialRequestResultRegion() {
    const results = root.querySelector("[data-map-commercial-request-results]");
    if (results) results.innerHTML = commercialRequestResults();
    refreshIcons(results);
  }

  async function handleSubmit(event) {
    const form = event.target.closest("form");
    if (!form || !root.contains(form)) return;
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    const data = Object.fromEntries(new FormData(form));
    try {
      setMessage("Guardando cambios...");
      let successMessage = "Cambio guardado y acceso recalculado.";
      if (form.matches("[data-issue-license-form]")) {
        if (data.accessKind === "partner_test") {
          const existingUser = users.find(item => item.user_id === data.userId);
          const invitation = await repository.provisionTesterAccess({
            institutionId: data.institutionId === "none" ? null : data.institutionId,
            cohortId: data.cohortId || null,
            email: existingUser?.email || data.email,
            fullName: existingUser ? "" : data.fullName,
            productKey: data.productKey || null,
            startsAt: data.startsAt ? isoDate(data.startsAt) : null,
            endsAt: data.endsAt ? isoDate(data.endsAt) : null,
            grantReason: data.grantReason || "",
            reviewAt: data.reviewAt ? isoDate(data.reviewAt) : null
          });
          successMessage = invitationSuccessMessage(invitation);
        } else {
          await repository.issueLicense({ ...data, startsAt: isoDate(data.startsAt), endsAt: data.endsAt ? isoDate(data.endsAt) : null });
        }
      }
      if (form.matches("[data-assign-license-form]")) {
        await repository.assignSeat(data.licenseId, data.userId);
      }
      if (form.matches("[data-create-institution]")) {
        await repository.createInstitution({ displayName: data.displayName, domain: data.domain });
        successMessage = "La institución quedó disponible para usuarios y cohortes.";
      }
      if (form.matches("[data-create-cohort]")) {
        const createdCohortId = await repository.createEvaluationCohort({
          ...data,
          startsAt: isoDate(data.startsAt),
          endsAt: isoDate(data.endsAt),
          reviewAt: data.reviewAt ? isoDate(data.reviewAt) : null
        });
        successMessage = "El programa de acceso y su cohorte fueron creados.";
      }
      if (form.matches("[data-invite-participant]")) {
        const invitation = await repository.inviteEvaluationParticipant(data.cohortId, data.email, data.fullName);
        successMessage = invitationSuccessMessage(invitation);
      }
      if (form.matches("[data-map-commercial-request-review-form]")) {
        await repository.reviewCommercialRequest({
          requestId: data.requestId,
          status: data.status,
          resolutionNote: data.resolutionNote
        });
        successMessage = data.status === "in_review"
          ? "La solicitud quedó marcada en revisión."
          : "La decisión comercial quedó registrada.";
      }
      ui.closeLayer(form.closest("dialog"), "success");
      form.reset();
      await loadDashboard({ successMessage });
    } catch (error) {
      setMessage(contracts.toError(error).message, "error");
      setBusy(false);
    }
  }

  function invitationSuccessMessage(invitation = {}) {
    return invitation.invitationSent
      ? "La invitación fue enviada y el acceso quedó pendiente de activación."
      : invitation.memberStatus === "active"
        ? "La cuenta existente recibió acceso activo."
        : "La cuenta invitada recibió acceso tester.";
  }

  async function loadParticipants(cohortId) {
    if (busy || cohortId === selectedCohortId && participants.length) return;
    selectedCohortId = cohortId;
    participantError = "";
    setBusy(true);
    try {
      participants = await repository.listEvaluationParticipants(cohortId);
      renderEvaluations();
      refreshIcons(root.querySelector('[data-map-panel="evaluations"]'));
    } catch (error) {
      participantError = contracts.toError(error).message;
      setMessage(participantError, "error");
      renderEvaluations();
      refreshIcons(root.querySelector('[data-map-panel="evaluations"]'));
    } finally {
      setBusy(false);
    }
  }

  async function revokeParticipantAccess(userId) {
    if (busy) return;
    const confirmed = await ui.confirmAction({
      title: "Revocar acceso de evaluación",
      description: "El participante perderá el acceso a esta cohorte MAP de inmediato.",
      confirmLabel: "Revocar acceso"
    });
    if (!confirmed) return;
    setBusy(true);
    try {
      await repository.revokeEvaluationParticipant(selectedCohortId, userId);
      participants = await repository.listEvaluationParticipants(selectedCohortId);
      await loadDashboard({ successMessage: "El acceso del participante fue revocado." });
    } catch (error) {
      setMessage(contracts.toError(error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function revokeLicenseAccess(licenseId) {
    if (busy) return;
    const confirmed = await ui.confirmAction({
      title: "Revocar licencia MAP",
      description: "La licencia dejará de estar disponible y todas sus plazas serán liberadas.",
      confirmLabel: "Revocar licencia"
    });
    if (!confirmed) return;
    setBusy(true);
    try {
      await repository.revokeLicense(licenseId);
      ui.closeLayer(root.querySelector("[data-map-license-detail-dialog]"), "revoked");
      await loadDashboard({ successMessage: "La licencia fue revocada." });
    } catch (error) {
      setMessage(contracts.toError(error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  function syncParticipantDialog() {
    const input = root.querySelector('#map-participant-dialog [name="cohortId"]');
    if (input) input.value = selectedCohortId;
  }

  function syncCommercialReviewForm(form) {
    if (!form) return;
    const status = form.elements.status?.value;
    const note = form.elements.resolutionNote;
    const label = form.querySelector("[data-map-commercial-resolution-label]");
    if (!note || !label) return;
    const required = ["resolved", "declined"].includes(status);
    note.required = required;
    label.firstChild.textContent = required
      ? "Nota de resolución (obligatoria)"
      : "Nota de revisión (opcional)";
  }

  function closeLayerButton(label) {
    return ui.action({
      label,
      ariaLabel: label,
      icon: "x",
      iconOnly: true,
      className: "workspace-layer-close",
      data: { closeMapLayer: true }
    });
  }

  function filterOption(value, label, selected) {
    return `<option value="${escapeHtml(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(label)}</option>`;
  }

  function optionList(rows, valueKey, labelKey, secondaryKey = "") {
    if (!rows.length) return '<option value="">No hay opciones disponibles</option>';
    return rows.map(item => `<option value="${escapeHtml(item[valueKey])}">${escapeHtml(item[labelKey] || item[valueKey])}${secondaryKey && item[secondaryKey] ? ` · ${escapeHtml(item[secondaryKey])}` : ""}</option>`).join("");
  }

  function setBusy(value) {
    busy = Boolean(value);
    ui.setBusy(root, busy, {
      selector: "[data-map-control], [data-map-refresh], [data-revoke-license], [data-revoke-participant], [data-map-commercial-request-detail]",
      label: "Actualizando plataforma MAP"
    });
  }

  function setMessage(message, tone = "neutral") {
    ui.feedback(root?.querySelector("[data-map-message]"), message, tone);
  }

  function localDateValue(date) {
    const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return shifted.toISOString().slice(0, 16);
  }

  function isoDate(value) {
    return new Date(value).toISOString();
  }

  function formatDate(value) {
    return utils.formatDate(value, { empty: "—" });
  }

  window.BCCWorkspaceMapsLicensing = Object.freeze({ init, activate });
})();
