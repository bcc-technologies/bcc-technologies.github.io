(() => {
  const contracts = window.BCCWorkspaceMapContracts;
  const repository = window.BCCWorkspaceMapRepository.staff;
  const utils = window.BCCWorkspaceUtils;
  const ui = window.BCCWorkspaceUI;
  const escapeHtml = utils.escapeHtml;
  const refreshIcons = utils.refreshIcons;
  const PANELS = ["summary", "licenses", "evaluations", "permissions", "analytics"];
  const PRODUCTS = contracts.PRODUCTS;

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
  let participantError = "";
  let selectedLicenseId = "";
  let selectedCohortId = "";
  let licenseQuery = "";
  let licenseStatusFilter = "all";
  let licenseProductFilter = "all";
  let cohortQuery = "";
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
        <header class="module-surface maps-license-hero">
          <div>
            <span class="workspace-eyebrow">MAP Platform</span>
            <h1>Licencias y acceso</h1>
            <p class="muted-text">Administra el ciclo de acceso comercial y de evaluación sin mezclar permisos internos ni datos científicos.</p>
          </div>
          <div class="maps-license-actions">
            ${ui.statusBadge({ label: "Datos en vivo", status: "success", icon: "database" })}
            <button class="btn btn-ghost btn-compact" type="button" data-map-refresh data-map-control>
              <i data-lucide="refresh-cw"></i>Actualizar
            </button>
          </div>
        </header>
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
    if (panel === "permissions") return has("platform.permissions.manage");
    if (panel === "analytics") return has("platform.analytics.read");
    if (panel === "evaluations") return has("platform.evaluations.manage");
    return has("platform.licenses.read");
  }

  function panelLabel(panel) {
    return ({
      summary: "Resumen",
      licenses: "Licencias",
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
      const dashboard = await repository.getDashboard({
        includeEvaluations: has("platform.evaluations.manage"),
        includeAccess: has("platform.permissions.manage")
      });
      overview = dashboard?.overview || {};
      licenses = dashboard?.licenses || [];
      accounts = dashboard?.accounts || [];
      plans = dashboard?.plans || [];
      users = dashboard?.users || [];
      cohorts = dashboard?.cohorts || [];
      accessUsers = dashboard?.access_users || [];
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
  }

  function renderAll() {
    renderSummary();
    renderLicenses();
    renderLicenseDetail();
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
        ${metric("Evaluaciones activas", overview.active_evaluation_cohorts, `${overview.evaluation_participants || 0} participantes`)}
        ${metric("Vencen en 30 días", overview.expiring_licenses, `${overview.evaluation_events_30d || 0} eventos recientes`)}
      </section>
      <div class="maps-license-summary-grid">
        <article class="maps-license-card">
          <div class="maps-license-section-head">
            <div><span class="workspace-eyebrow">Distribución</span><h2>Estado por producto</h2></div>
          </div>
          ${productSummaryTable()}
        </article>
        <aside class="maps-license-card maps-license-operational-note">
          <i data-lucide="${Number(overview.expiring_licenses || 0) ? "triangle-alert" : "circle-check"}"></i>
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
        <div class="maps-license-section-head">
          <div>
            <span class="workspace-eyebrow">Inventario comercial</span>
            <h2>Licencias</h2>
            <p>Busca y filtra antes de abrir el detalle operativo.</p>
          </div>
          ${has("platform.licenses.manage") ? `
            <button class="btn btn-primary" type="button" data-open-map-layer="map-issue-license-dialog">
              <i data-lucide="badge-plus"></i>Emitir licencia
            </button>` : ""}
        </div>
        <div class="maps-license-toolbar" role="search">
          <label class="maps-license-search">
            <span class="sr-only">Buscar licencias</span>
            <i data-lucide="search"></i>
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
          <td><strong>${assigned} / ${capacity}</strong><div class="maps-license-capacity" aria-label="${usage}% ocupado"><span style="width:${usage}%"></span></div></td>
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

  function licenseLayers() {
    return `
      <dialog id="map-license-detail-dialog" class="workspace-layer is-drawer" data-map-license-detail-dialog>
        <div class="workspace-layer-panel" data-map-license-detail-content></div>
      </dialog>
      <dialog id="map-issue-license-dialog" class="workspace-layer is-modal">
        <form class="workspace-layer-panel maps-license-form" data-issue-license-form>
          <header class="workspace-layer-head">
            <div><span class="workspace-eyebrow">Nueva licencia</span><h2>Emitir acceso comercial</h2><p>Define la cuenta, el producto y la capacidad inicial.</p></div>
            ${closeLayerButton("Cerrar formulario")}
          </header>
          <div class="workspace-layer-body">${issueLicenseFields()}</div>
          <footer class="workspace-layer-actions">
            <button class="btn btn-ghost" type="button" data-close-map-layer>Cancelar</button>
            <button class="btn btn-primary" type="submit" data-map-control>Emitir licencia</button>
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
          <div class="maps-license-capacity is-large" aria-label="${usage}% ocupado"><span style="width:${usage}%"></span></div>
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
    const commercialPlans = plans.filter(plan => !plan.is_evaluation);
    return `
      <label>Cuenta<select name="accountId" required autofocus>${optionList(accounts, "account_id", "display_name")}</select></label>
      <label>Plan<select name="planId" required>${commercialPlans.map(plan => `<option value="${escapeHtml(plan.plan_id)}" data-seats="${Number(plan.default_seat_limit || 1)}">${escapeHtml(PRODUCTS[plan.product_key] || plan.product_key)} · ${escapeHtml(plan.plan_name)}</option>`).join("")}</select></label>
      <div class="maps-license-form-row">
        <label>Plazas<input name="seatLimit" type="number" min="1" value="${Number(commercialPlans[0]?.default_seat_limit || 1)}" required></label>
        <label>Inicio<input name="startsAt" type="datetime-local" value="${localDateValue(new Date())}" required></label>
      </div>
      <label>Vencimiento opcional<input name="endsAt" type="datetime-local"></label>`;
  }

  function renderEvaluations() {
    const panel = root.querySelector('[data-map-panel="evaluations"]');
    if (!panel) return;
    const selected = cohorts.find(item => item.cohort_id === selectedCohortId);
    panel.innerHTML = `
      <article class="maps-license-card">
        <div class="maps-license-section-head">
          <div><span class="workspace-eyebrow">Acceso temporal</span><h2>Evaluaciones</h2><p>Selecciona una cohorte para operar sus participantes.</p></div>
          <div class="maps-license-actions">
            <button class="btn btn-ghost" type="button" data-open-map-layer="map-evaluation-account-dialog"><i data-lucide="building-2"></i>Nueva cuenta</button>
            <button class="btn btn-primary" type="button" data-open-map-layer="map-cohort-dialog"><i data-lucide="users-round"></i>Nueva cohorte</button>
          </div>
        </div>
        <div class="maps-license-evaluation-layout">
          <aside class="maps-license-cohort-browser">
            <label class="maps-license-search">
              <span class="sr-only">Buscar cohortes</span><i data-lucide="search"></i>
              <input type="search" value="${escapeHtml(cohortQuery)}" placeholder="Buscar cohorte o cuenta" data-map-cohort-query>
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
      PRODUCTS[item.product_key] || item.product_key
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
          <span><strong>${escapeHtml(item.cohort_name || item.name)}</strong><small>${escapeHtml(item.account_name)}</small></span>
          ${cohortStatusBadge(item)}
        </span>
        <span class="maps-license-cohort-meta">${escapeHtml(PRODUCTS[item.product_key] || item.product_key)} · ${Number(item.participant_count || 0)} participantes</span>
      </button>`;
    }).join("")}</div>`;
  }

  function cohortStatusBadge(item) {
    const status = item.cohort_status || "unknown";
    const tone = status === "active" ? "success" : status === "scheduled" ? "warning" : status === "revoked" ? "danger" : "neutral";
    const label = ({ active: "Activa", scheduled: "Programada", ended: "Finalizada", revoked: "Revocada" })[status] || status;
    return ui.statusBadge({ label, status: tone });
  }

  function cohortDetail(item) {
    return `
      <header class="maps-license-section-head">
        <div>
          <span class="workspace-eyebrow">${escapeHtml(PRODUCTS[item.product_key] || item.product_key)}</span>
          <h2>${escapeHtml(item.cohort_name || item.name)}</h2>
          <p>${escapeHtml(item.account_name)} · ${formatDate(item.starts_at)} — ${formatDate(item.ends_at)}</p>
        </div>
        ${cohortStatusBadge(item)}
      </header>
      ${item.purpose ? `<p class="maps-license-cohort-purpose">${escapeHtml(item.purpose)}</p>` : ""}
      <div class="maps-license-section-head maps-license-participant-head">
        <div><h3>Participantes</h3><p>${participants.length} acceso(s) registrado(s)</p></div>
        <button class="btn btn-primary btn-compact" type="button" data-open-map-layer="map-participant-dialog">
          <i data-lucide="user-plus"></i>Invitar
        </button>
      </div>
      ${participantTable()}`;
  }

  function participantTable() {
    if (participantError) {
      return `<div class="workspace-data-state maps-license-empty is-compact" role="alert">
        <i data-lucide="wifi-off"></i><strong>No pudimos cargar los participantes.</strong>
        <span>${escapeHtml(participantError)}</span>
        <button class="btn btn-ghost btn-compact" type="button" data-load-participants="${escapeHtml(selectedCohortId)}">Reintentar</button>
      </div>`;
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
      <dialog id="map-evaluation-account-dialog" class="workspace-layer is-modal">
        <form class="workspace-layer-panel maps-license-form" data-create-evaluation-account>
          <header class="workspace-layer-head"><div><span class="workspace-eyebrow">Organización</span><h2>Nueva cuenta de evaluación</h2><p>Crea el contenedor antes de generar su cohorte.</p></div>${closeLayerButton("Cerrar formulario")}</header>
          <div class="workspace-layer-body"><label>Cuenta / organización<input name="displayName" maxlength="160" required autofocus></label></div>
          <footer class="workspace-layer-actions"><button class="btn btn-ghost" type="button" data-close-map-layer>Cancelar</button><button class="btn btn-primary" type="submit" data-map-control>Crear cuenta</button></footer>
        </form>
      </dialog>
      <dialog id="map-cohort-dialog" class="workspace-layer is-modal">
        <form class="workspace-layer-panel maps-license-form" data-create-cohort>
          <header class="workspace-layer-head"><div><span class="workspace-eyebrow">Acceso temporal</span><h2>Nueva cohorte</h2><p>Define alcance y vigencia antes de invitar participantes.</p></div>${closeLayerButton("Cerrar formulario")}</header>
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
          </div>
          <footer class="workspace-layer-actions"><button class="btn btn-ghost" type="button" data-close-map-layer>Cancelar</button><button class="btn btn-primary" type="submit" data-map-control>Invitar y asignar</button></footer>
        </form>
      </dialog>`;
  }

  function cohortFields() {
    const evaluationPlans = plans.filter(plan => plan.is_evaluation);
    return `
      <label>Cuenta<select name="accountId" required autofocus>${optionList(accounts, "account_id", "display_name")}</select></label>
      <label>Producto<select name="productKey" required>${evaluationPlans.map(plan => `<option value="${escapeHtml(plan.product_key)}">${escapeHtml(PRODUCTS[plan.product_key] || plan.product_key)}</option>`).join("")}</select></label>
      <label>Nombre<input name="name" maxlength="160" required></label>
      <label>Propósito<textarea name="purpose" maxlength="2000" rows="3"></textarea></label>
      <div class="maps-license-form-row">
        <label>Inicio<input name="startsAt" type="datetime-local" value="${localDateValue(new Date())}" required></label>
        <label>Fin<input name="endsAt" type="datetime-local" value="${localDateValue(new Date(Date.now() + 30 * 86400000))}" required></label>
      </div>`;
  }

  function renderLayerForms() {
    const issueBody = root?.querySelector("#map-issue-license-dialog .workspace-layer-body");
    if (issueBody) issueBody.innerHTML = issueLicenseFields();
    const cohortBody = root?.querySelector("#map-cohort-dialog .workspace-layer-body");
    if (cohortBody) cohortBody.innerHTML = cohortFields();
    syncParticipantDialog();
  }

  function renderPermissions() {
    const panel = root.querySelector('[data-map-panel="permissions"]');
    if (!panel) return;
    panel.innerHTML = `<article class="maps-license-card">
      <div class="maps-license-section-head">
        <div><span class="workspace-eyebrow">Autorización interna</span><h2>Acceso efectivo de plataforma</h2><p>Los roles MAP se sincronizan desde el rol base y los roles internos del perfil.</p></div>
        <a class="btn btn-ghost" href="#usuarios">Editar perfiles</a>
      </div>
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
        <div class="maps-license-section-head"><div><span class="workspace-eyebrow">Procedencia</span><h2>Origen de licencias</h2></div></div>
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
  }

  function handleChange(event) {
    if (event.target.matches("[data-map-license-status-filter]")) {
      licenseStatusFilter = event.target.value;
      renderLicenseResultRegion();
    }
    if (event.target.matches("[data-map-license-product-filter]")) {
      licenseProductFilter = event.target.value;
      renderLicenseResultRegion();
    }
    if (event.target.matches('[name="planId"]')) {
      const seats = event.target.selectedOptions[0]?.dataset.seats;
      const input = event.target.form?.elements?.seatLimit;
      if (input && seats) input.value = seats;
    }
  }

  function renderLicenseResultRegion() {
    const results = root.querySelector("[data-map-license-results]");
    if (results) results.innerHTML = licenseResults();
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
      if (form.matches("[data-issue-license-form]")) {
        await repository.issueLicense({ ...data, startsAt: isoDate(data.startsAt), endsAt: data.endsAt ? isoDate(data.endsAt) : null });
      }
      if (form.matches("[data-assign-license-form]")) {
        await repository.assignSeat(data.licenseId, data.userId);
      }
      if (form.matches("[data-create-evaluation-account]")) {
        await repository.createEvaluationAccount(data.displayName);
      }
      if (form.matches("[data-create-cohort]")) {
        await repository.createEvaluationCohort({ ...data, startsAt: isoDate(data.startsAt), endsAt: isoDate(data.endsAt) });
      }
      if (form.matches("[data-invite-participant]")) {
        await repository.inviteEvaluationParticipant(data.cohortId, data.email);
      }
      ui.closeLayer(form.closest("dialog"), "success");
      form.reset();
      await loadDashboard({ successMessage: "Cambio guardado y acceso recalculado." });
    } catch (error) {
      setMessage(contracts.toError(error).message, "error");
      setBusy(false);
    }
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

  function closeLayerButton(label) {
    return `<button class="workspace-layer-close" type="button" data-close-map-layer aria-label="${escapeHtml(label)}"><i data-lucide="x"></i></button>`;
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
      selector: "[data-map-control], [data-map-refresh], [data-revoke-license], [data-revoke-participant]",
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
