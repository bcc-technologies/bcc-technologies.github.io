(() => {
  const contracts = window.BCCWorkspaceMapContracts;
  const repository = window.BCCWorkspaceMapRepository.client;
  const mapNanoPlans = window.BCCMapNanoPlans;
  const utils = window.BCCWorkspaceUtils;
  const ui = window.BCCWorkspaceUI;
  if (!mapNanoPlans) throw new Error("MAP-Nano commercial plans must load before the client licenses module.");
  const escapeHtml = utils.escapeHtml;
  const refreshIcons = utils.refreshIcons;
  let root = null;
  let currentUser = null;
  let dashboard = emptyDashboard();
  let selectedLicenseId = "";
  let selectedSuiteProductKey = "";
  let selectedRequestProductKey = "map.nano";
  let selectedRequestLicenseType = "named_user";
  let selectedCommercialPlanId = "";
  let requestBusy = false;
  let platformAccess = [];
  let effectiveAccess = [];
  let internalEntitlements = [];
  let trialOffer = contracts.TRIAL_OFFER_FALLBACK;
  let commercialRequests = [];
  let commercialRequestsAvailable = false;
  let busy = false;

  function emptyDashboard() {
    return { accounts: [], licenses: [], members: [], assignments: [], recent_events: [] };
  }

  function trackLicenseFunnel(eventName, metadata = {}) {
    window.BCCAnalytics?.track(eventName, {
      section: "client_map_licenses",
      product_key: metadata.productKey || selectedSuiteProductKey,
      license_type: metadata.licenseType || "",
      is_evaluation: Boolean(metadata.isEvaluation),
      trial_days: metadata.isEvaluation ? trialOffer.duration_days : undefined
    });
  }

  function trackCommercialPlan(eventName, metadata = {}) {
    window.BCCAnalytics?.track(eventName, {
      section: "client_map_nano_plan",
      product_key: "map.nano",
      plan_id: metadata.planId || selectedCommercialPlanId || "",
      request_type: metadata.requestType || ""
    });
  }

  function init(user) {
    root = document.querySelector("[data-client-map-licenses]");
    if (!root || root.dataset.ready === "true") return;
    root.dataset.ready = "true";
    currentUser = user;
    root.addEventListener("click", handleClick);
    root.addEventListener("keydown", handleKeydown);
    root.addEventListener("change", handleChange);
    root.addEventListener("submit", handleSubmit);
    root.setAttribute("aria-busy", "true");
    trackCommercialPlan("subscription_page_viewed");
    void loadDashboard();
  }

  async function loadDashboard({ successMessage = "" } = {}) {
    setBusy(true);
    setMessage("Actualizando tus licencias MAP...");
    try {
      const payload = await repository.getDashboard();
      platformAccess = payload.platformAccess;
      effectiveAccess = payload.effectiveAccess;
      internalEntitlements = payload.entitlements;
      trialOffer = contracts.normalizeTrialOffer(payload.trialOffer);
      dashboard = payload.dashboard;
      commercialRequests = payload.commercialRequests;
      commercialRequestsAvailable = payload.commercialRequestsAvailable;
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
    selectDefaultSuiteProduct();
  }

  function selectDefaultSuiteProduct() {
    const keys = suiteProductKeys();
    if (keys.includes(selectedSuiteProductKey)) return;
    const licenses = dashboard.licenses.map(toLicenseViewModel);
    selectedSuiteProductKey = licenses.find(item => ["active", "scheduled", "expiring"].includes(item.status))?.product_key
      || licenses[0]?.product_key
      || keys[0]
      || "map.nano";
  }

  function render() {
    if (!root) return;
    root.innerHTML = `
      <section class="client-license-shell">
        ${ui.sectionHeader({
          className: "workspace-page-header",
          actionsClassName: "client-license-actions",
          title: "Licencias MAP",
          level: 1,
          description: "Elige el producto y la modalidad para llevar tus análisis de la evaluación al trabajo diario.",
          actions: [
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
        ${renderAttention()}
        ${renderSuite()}
        ${renderInternalAccess()}
        ${renderActivity()}
        ${renderSeatManagementLayer()}
        ${renderCommercialRequestLayer()}
      </section>`;
    refreshIcons();
  }

  function suiteProductKeys() {
    const catalogKeys = Object.keys(contracts.PRODUCT_CATALOG);
    const unknownKeys = [...new Set(dashboard.licenses
      .map(item => item.product_key)
      .filter(key => key && !catalogKeys.includes(key)))];
    return [...catalogKeys, ...unknownKeys];
  }

  function renderSuite() {
    const licenses = dashboard.licenses.map(toLicenseViewModel);
    const productKeys = suiteProductKeys();
    if (!productKeys.includes(selectedSuiteProductKey)) selectedSuiteProductKey = productKeys[0] || "map.nano";
    const selectedLicenses = licenses
      .filter(item => item.product_key === selectedSuiteProductKey)
      .sort((a, b) => a.statusMeta.priority - b.statusMeta.priority);

    return `<section class="client-license-suite" id="suite-map" aria-label="Productos y licencias MAP">
      <div class="client-license-product-tabs" role="tablist" aria-label="Productos de la suite MAP">
        ${productKeys.map(key => renderProductTab(key, licenses)).join("")}
      </div>
      ${renderSuiteProduct(selectedSuiteProductKey, contracts.productCatalog(selectedSuiteProductKey), selectedLicenses)}
    </section>`;
  }

  function renderProductTab(key, licenses) {
    const product = contracts.productCatalog(key) || { icon: "scan-line" };
    const selected = key === selectedSuiteProductKey;
    const accessCount = licenses.filter(item => item.product_key === key && ["active", "scheduled", "expiring"].includes(item.status)).length;
    const id = productDomId(key);
    return `<button class="client-license-product-tab" id="suite-tab-${id}" type="button" role="tab" aria-selected="${selected}" aria-controls="suite-panel-${id}" tabindex="${selected ? "0" : "-1"}" data-client-suite-product="${escapeHtml(key)}">
      ${ui.icon(product.icon, "sm")}
      <span>${escapeHtml(productName(key))}</span>
      ${accessCount ? `<span class="client-license-tab-count" aria-label="${accessCount} acceso(s) vigente(s)">${accessCount}</span>` : ""}
    </button>`;
  }

  function renderSuiteProduct(key, catalog, productLicenses) {
    const product = catalog || {
      category: "Producto MAP",
      description: "Acceso MAP asociado a tu cuenta.",
      features: [],
      icon: "scan-line",
      productHref: "/products.html",
      requestHref: "/contactUs.html?intent=license",
      licenseTypes: []
    };
    const panelId = productDomId(key);
    return `<div class="client-license-product-panel" id="suite-panel-${panelId}" role="tabpanel" aria-labelledby="suite-tab-${panelId}" tabindex="0">
      <header class="client-license-product-summary">
        <p>${escapeHtml(product.description)}</p>
        <div class="client-license-product-actions"><a class="btn btn-ghost btn-compact" href="${escapeHtml(product.productHref)}">Ver producto</a>${key === "map.nano" ? '<a class="btn btn-ghost btn-compact" href="/map-nano-pricing.html">Ver planes</a>' : ""}</div>
      </header>
      ${renderCurrentProductAccess(key, product, productLicenses)}
      ${renderLicenseOptions(key, productLicenses)}
    </div>`;
  }

  function renderCurrentProductAccess(key, product, productLicenses) {
    if (!productLicenses.length) return "";
    return `<section class="client-license-current-access" aria-labelledby="current-access-${productDomId(key)}">
      <div class="client-license-subsection-head">
        <h3 id="current-access-${productDomId(key)}">Tu acceso</h3>
        <span class="client-license-tag">${productLicenses.length}</span>
      </div>
      <div class="client-license-current-grid">${productLicenses.map(item => renderCurrentAccessCard(product, item)).join("")}</div>
    </section>`;
  }

  function renderCurrentAccessCard(product, item) {
    const capabilities = capabilitiesForLicense(item);
    const commercialPlan = item.product_key === "map.nano" ? mapNanoPlans.planById(mapNanoPlans.planIdForLicense(item)) : null;
    return `<article class="client-license-current-card">
      <div class="client-license-current-card-head">
        <div><strong>${escapeHtml(commercialPlan?.name || item.plan_name || contracts.licenseType(item.license_type)?.label || "Licencia MAP")}</strong><small>${escapeHtml(item.account_name || "Cuenta MAP")}</small></div>
        <span class="client-license-tag ${escapeHtml(item.status)}">${ui.icon(item.statusMeta.icon, "xs")}${escapeHtml(item.statusMeta.label)}</span>
      </div>
      <dl class="client-license-access-facts">
        <div><dt>Inicio</dt><dd>${item.starts_at ? formatDate(item.starts_at) : "No especificado"}</dd></div>
        <div><dt>Vigencia</dt><dd>${item.ends_at ? `Hasta ${formatDate(item.ends_at)}` : "Sin vencimiento"}</dd></div>
        <div><dt>Modalidad</dt><dd>${escapeHtml(contracts.licenseType(item.license_type)?.shortLabel || (item.is_evaluation ? "Evaluación" : roleLabel(item.member_role)))}</dd></div>
        ${item.product_key === "map.nano" ? `<div><dt>Facturación</dt><dd>No especificada</dd></div>` : ""}
      </dl>
      ${capabilities.length ? `<div class="client-license-capability-summary"><span>Capacidades habilitadas</span><div>${capabilities.map(capability => `<span class="client-license-tag">${escapeHtml(platformAccessLabel(capability.access_key))}</span>`).join("")}</div></div>` : item.product_key === "map.nano" ? '<p class="client-license-card-note">Las capacidades técnicas aún no están disponibles para esta asignación.</p>' : ""}
      ${item.seatLimit ? `<div class="client-license-seat-summary">
        <div><span>Uso de plazas</span><strong>${item.assignedSeats} / ${item.seatLimit}</strong></div>
        ${ui.progress({ value: item.seatUsage, label: `${item.seatUsage}% de plazas ocupadas`, className: "client-license-seat-bar", tone: item.seatUsage >= 100 ? "danger" : item.seatUsage >= 80 ? "warning" : "accent" })}
      </div>` : ""}
      ${item.is_evaluation ? `<p class="client-license-card-note">${ui.icon("info", "xs")} El ciclo de evaluación es administrado por el equipo BCC.</p>` : ""}
      <footer class="client-license-card-actions">${renderCurrentAccessActions(product, item)}</footer>
    </article>`;
  }

  function renderCurrentAccessActions(product, item) {
    if (item.canManage) {
      return ui.action({ label: "Gestionar plazas", icon: "users", className: "btn btn-primary", data: { clientLicenseManage: item.license_id } });
    }
    if (["expiring", "suspended", "expired", "revoked"].includes(item.status)) {
      return ui.action({
        label: item.status === "expiring" ? "Renovar licencia" : "Solicitar reactivación",
        icon: "refresh-cw",
        className: "btn btn-primary",
        data: { clientLicenseRequest: item.product_key, clientLicenseType: item.license_type || "named_user" }
      });
    }
    return ui.action({ label: "Abrir información", href: product.productHref, icon: "external-link", className: "btn btn-ghost" });
  }

  function renderLicenseOptions(key, productLicenses) {
    if (key === "map.nano") return renderMapNanoCommercialOptions(productLicenses);
    const types = contracts.productLicenseTypes(key);
    if (!types.length) return "";
    const ownedTypes = new Set(productLicenses.map(item => item.license_type));
    return `<section class="client-license-options" aria-label="Licencias para ${escapeHtml(productName(key))}">
      <div class="client-license-offer-grid">${types.map(type => renderLicenseOfferCard(key, type, ownedTypes.has(type.key))).join("")}</div>
    </section>`;
  }

  function renderLicenseOfferCard(key, type, isOwned) {
    const trialDays = trialOffer.duration_days;
    const trialCampaign = trialOffer.is_campaign;
    const typeClass = `is-${String(type.key).replace(/[^a-z0-9]+/gi, "-")}`;
    const headingId = `license-${productDomId(key)}-${productDomId(type.key)}-title`;
    return `<article class="client-license-offer-card ${typeClass} ${type.recommended ? "is-recommended" : ""} ${type.isEvaluation ? "is-evaluation" : ""}" aria-labelledby="${headingId}">
      <div class="client-license-offer-card-head">
        <div class="client-license-offer-identity">
          <span class="client-license-offer-icon">${ui.icon(type.icon, "sm")}</span>
          <div><span class="client-license-offer-kicker">${escapeHtml(type.eyebrow)}</span><h3 id="${headingId}">${escapeHtml(type.label)}</h3></div>
        </div>
        <div class="client-license-offer-badges">
          ${type.recommended ? `<span class="client-license-recommended-badge">${ui.icon("badge-check", "xs")}Recomendada</span>` : ""}
          ${isOwned ? '<span class="client-license-tag active">Actual</span>' : ""}
        </div>
      </div>
      <p>${escapeHtml(type.description)}</p>
      <div class="client-license-offer-benefit-block">
        <span class="client-license-offer-benefit-label">Incluye</span>
        <ul class="client-license-offer-benefits">
          ${type.features.map(feature => `<li>${ui.icon("circle-check", "xs")}<span>${escapeHtml(feature)}</span></li>`).join("")}
        </ul>
      </div>
      ${type.isEvaluation ? `<p class="client-license-trial-offer"><strong>${trialDays} días gratis</strong><span>${trialCampaign ? `Early access · luego ${trialOffer.standard_days} días` : "Prueba estándar"}</span></p>` : ""}
      <div class="client-license-offer-meta">
        <span>${ui.icon("users", "xs")}${escapeHtml(type.seatLabel)}</span>
        ${type.isEvaluation ? "" : `<span>${ui.icon("calendar-clock", "xs")}${escapeHtml(type.durationLabel)}</span>`}
      </div>
      <footer>
        ${ui.action({
          label: type.isEvaluation ? `Solicitar ${trialDays} días gratis` : isOwned ? "Solicitar ampliación" : type.ctaLabel,
          icon: type.isEvaluation ? "flask-conical" : "badge-plus",
          className: type.recommended ? "btn btn-primary" : type.isEvaluation ? "btn btn-ghost client-license-evaluation-cta" : "btn btn-ghost",
          data: { clientLicenseRequest: key, clientLicenseType: type.key }
        })}
        <small class="client-license-offer-assurance">${ui.icon("shield-check", "xs")}${type.isEvaluation ? "Sin tarjeta" : "Sin compromiso"} · respuesta en 1 día hábil</small>
      </footer>
    </article>`;
  }

  function capabilitiesForLicense(license) {
    return effectiveAccess.filter(item => item.access_source === "license" && item.license_id === license.license_id);
  }

  function accountForLicense(license) {
    return dashboard.accounts.find(account => account.account_id === license.account_id) || null;
  }

  function canManageMapNanoCommercialRequest(productLicenses) {
    if (!productLicenses.length) return true;
    const accounts = productLicenses.map(accountForLicense).filter(Boolean);
    const organizationAccounts = accounts.filter(account => account.account_kind === "organization");
    if (!organizationAccounts.length) return true;
    return organizationAccounts.some(account => ["owner", "admin"].includes(account.member_role));
  }

  function isOpenCommercialRequest(request) {
    return ["pending", "in_review"].includes(String(request?.status || "").toLowerCase());
  }

  function pendingCommercialRequest(planId, requestType = "") {
    return commercialRequests.find(request => request.plan_key === planId
      && isOpenCommercialRequest(request)
      && (!requestType || request.request_type === requestType)) || null;
  }

  function mapNanoCommercialAccountId() {
    const mapNanoLicense = dashboard.licenses.find(item => item.product_key === "map.nano" && item.account_id);
    if (mapNanoLicense?.account_id) return mapNanoLicense.account_id;
    return dashboard.accounts.find(account => account.can_manage_seats)?.account_id || null;
  }

  function commercialRequestStatus(request) {
    return contracts.commercialRequestStatus(request?.status);
  }

  function commercialRequestPlanName(planId) {
    const plan = planId === "project" ? mapNanoPlans.PROJECT_ACCESS : mapNanoPlans.planById(planId);
    return plan?.name || planId || "Plan MAP-Nano";
  }

  function commercialRequestTypeLabel(requestType) {
    return {
      new_license: "Nueva licencia",
      upgrade: "Actualización",
      institutional_quote: "Cotización institucional",
      project_access: "Acceso por proyecto",
      demo: "Demostración"
    }[requestType] || "Solicitud comercial";
  }

  function renderMapNanoCommercialRequestHistory() {
    if (!commercialRequestsAvailable) {
      return '<p class="client-map-nano-pending-note">El historial comercial no está disponible en este momento. Puedes continuar mediante el formulario de contacto.</p>';
    }
    if (!commercialRequests.length) return "";
    return `<section class="client-map-nano-request-history" aria-labelledby="map-nano-request-history-title">
      <div class="client-license-subsection-head"><div><h4 id="map-nano-request-history-title">Solicitudes comerciales</h4><p>Estado persistente para esta cuenta o usuario.</p></div></div>
      <div class="client-map-nano-request-list">${commercialRequests.slice(0, 5).map(request => {
        const status = commercialRequestStatus(request);
        return `<article class="client-map-nano-request-item">
          <div><strong>${escapeHtml(commercialRequestPlanName(request.plan_key))}</strong><small>${escapeHtml(commercialRequestTypeLabel(request.request_type))} · ${escapeHtml(formatDate(request.created_at))}</small></div>
          <div class="client-map-nano-request-actions"><span class="client-license-tag ${escapeHtml(status.tone)}">${escapeHtml(status.label)}</span>${request.can_cancel ? `<button class="btn btn-ghost btn-compact" type="button" data-map-nano-commercial-cancel="${escapeHtml(request.request_id)}">Cancelar</button>` : ""}</div>
        </article>`;
      }).join("")}</div>
    </section>`;
  }

  function renderMapNanoCommercialOptions(productLicenses) {
    const canManage = canManageMapNanoCommercialRequest(productLicenses);
    const activePlanIds = new Set(productLicenses
      .filter(item => ["active", "scheduled", "expiring"].includes(item.status))
      .map(item => mapNanoPlans.planIdForLicense(item))
      .filter(Boolean));
    const hasActivePlan = activePlanIds.size > 0;
    return `<section class="client-license-options client-map-nano-commercial-options" aria-label="Planes de MAP-Nano">
      <div class="client-license-subsection-head"><div><h3>${hasActivePlan ? "Tus planes de MAP-Nano" : "Planes de MAP-Nano"}</h3><p>${hasActivePlan ? "Tus planes contratados se identifican aquí. Puedes solicitar una ampliación o cambio cuando lo necesites." : "Elige el nivel de operación. Las solicitudes se revisan antes de emitir una licencia."}</p></div><a href="/map-nano-pricing.html">Comparación completa</a></div>
      <div class="client-license-offer-grid client-map-nano-plan-grid">${mapNanoPlans.PLANS.map(plan => renderMapNanoPlanCard(plan, { canManage, activePlanIds, hasLicense: productLicenses.length > 0 })).join("")}</div>
      ${renderMapNanoProjectOption(canManage, productLicenses.length > 0)}
      ${renderMapNanoCommercialRequestHistory()}
    </section>`;
  }

  function renderMapNanoPlanCard(plan, context) {
    const isCurrent = context.activePlanIds.has(plan.id);
    const requestType = mapNanoPlans.requestTypeForPlan(plan.id, { upgrade: context.hasLicense });
    const pending = pendingCommercialRequest(plan.id, requestType);
    const action = isCurrent
      ? ui.action({ label: "Plan actual", icon: "badge-check", className: "btn btn-ghost", disabled: true })
      : pending
        ? `<span class="client-map-nano-plan-pending">Solicitud ${escapeHtml(commercialRequestStatus(pending).label.toLowerCase())} desde ${escapeHtml(formatDate(pending.created_at))}</span>`
        : context.canManage
          ? ui.action({ label: plan.cta.label, icon: plan.id === "institutional" ? "messages-square" : "arrow-up-right", className: plan.highlighted ? "btn btn-primary" : "btn btn-ghost", data: { mapNanoCommercialRequest: plan.id, mapNanoRequestType: requestType } })
          : ui.action({ label: "Contactar al administrador", href: "/contactUs.html?product=map-nano&intent=license", icon: "headset", className: "btn btn-ghost" });
    const limitText = mapNanoLimitText(plan);
    return `<article class="client-license-offer-card client-map-nano-plan-card ${plan.highlighted ? "is-recommended" : ""} ${isCurrent ? "is-current" : ""}" aria-labelledby="map-nano-plan-${escapeHtml(plan.id)}">
      <div class="client-license-offer-card-head"><div class="client-license-offer-identity"><span class="client-license-offer-icon">${ui.icon(plan.id === "institutional" ? "building-2" : plan.id === "facility" ? "users" : "scan-line", "sm")}</span><div><span class="client-license-offer-kicker">${escapeHtml(plan.badge || "Licenciamiento anual")}</span><h3 id="map-nano-plan-${escapeHtml(plan.id)}">${escapeHtml(plan.name)}</h3></div></div><div class="client-license-offer-badges">${isCurrent ? '<span class="client-license-tag active">Plan contratado</span>' : ""}${plan.highlighted ? '<span class="client-license-recommended-badge">Recomendado</span>' : ""}</div></div>
      <p>${escapeHtml(plan.description)}</p><div class="client-map-nano-plan-price"><strong>${escapeHtml(mapNanoPlans.priceLabel(plan))}</strong>${mapNanoPlans.monthlyLabel(plan) ? `<span>${escapeHtml(mapNanoPlans.monthlyLabel(plan))}</span>` : ""}</div>
      <p class="client-map-nano-plan-limits">${escapeHtml(limitText)}</p><ul class="client-license-offer-benefits">${plan.features.slice(0, 4).map(feature => `<li>${ui.icon("circle-check", "xs")}<span>${escapeHtml(feature)}</span></li>`).join("")}</ul>
      <footer>${action}${!context.canManage && !isCurrent ? '<small class="client-license-offer-assurance">Solo propietarios o administradores pueden solicitar cambios para una organización.</small>' : ""}</footer>
    </article>`;
  }

  function mapNanoLimitText(plan) {
    const limits = [];
    if (Number.isFinite(plan.limits?.namedUsers)) limits.push(`${plan.limits.namedUsers} usuario${plan.limits.namedUsers === 1 ? "" : "s"} nominativo${plan.limits.namedUsers === 1 ? "" : "s"}`);
    if (Number.isFinite(plan.limits?.concurrentUsers)) limits.push(`${plan.limits.concurrentUsers} concurrentes`);
    if (Number.isFinite(plan.limits?.installations)) limits.push(`${plan.limits.installations} instalaciones`);
    return limits.length ? `Límites: ${limits.join(" · ")}` : "Límites: se definen según la propuesta.";
  }

  function renderMapNanoProjectOption(canManage, hasLicense) {
    const project = mapNanoPlans.PROJECT_ACCESS;
    const requestType = mapNanoPlans.requestTypeForPlan(project.id, { upgrade: hasLicense });
    const pending = pendingCommercialRequest(project.id, requestType);
    const action = pending
      ? `<span class="client-map-nano-plan-pending">Solicitud ${escapeHtml(commercialRequestStatus(pending).label.toLowerCase())} desde ${escapeHtml(formatDate(pending.created_at))}</span>`
      : canManage
        ? ui.action({ label: project.cta.label, icon: "clock-3", className: "btn btn-ghost", data: { mapNanoCommercialRequest: project.id, mapNanoRequestType: requestType } })
        : ui.action({ label: "Contactar soporte", href: mapNanoPlans.requestUrl(project.id), icon: "headset", className: "btn btn-ghost" });
    return `<article class="client-map-nano-project-option"><div><span class="workspace-eyebrow">Alternativa por proyecto</span><h3>${escapeHtml(project.name)}</h3><p>${escapeHtml(project.description)}</p></div><div><strong>${escapeHtml(mapNanoPlans.projectPriceLabel(project))}</strong>${action}</div></article>`;
  }

  function productDomId(key) {
    return String(key || "map").replace(/[^a-z0-9_-]/gi, "-");
  }

  function renderInternalAccess() {
    const staff = renderStaffLicense();
    const permissions = renderPlatformAccess();
    if (!staff && !permissions) return "";
    const count = Number(Boolean(staff)) + Number(Boolean(permissions));
    return `<details class="module-surface client-license-secondary-disclosure">
      <summary>
        <span>${ui.icon("shield-check", "sm")}<span><strong>Accesos adicionales</strong><small>Beneficios internos y permisos separados de las licencias comerciales.</small></span></span>
        <span class="client-license-disclosure-meta"><span class="client-license-tag">${count}</span>${ui.icon("chevron-down", "sm")}</span>
      </summary>
      <div class="client-license-secondary-grid">${staff}${permissions}</div>
    </details>`;
  }

  function renderStaffLicense() {
    const entitlement = internalEntitlements.find(item => item?.entitlement_key === "map.staff");
    if (!entitlement) return "";
    const products = Array.isArray(entitlement.product_keys) ? entitlement.product_keys : [];
    return `<article class="client-license-direct-access is-staff-entitlement">
      ${ui.sectionHeader({
        className: "client-license-section-head",
        eyebrow: "Beneficio exclusivo del staff",
        title: "Licencia MAP Staff",
        description: "Acceso gratuito y personal mientras tu perfil de staff permanezca activo.",
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
    return `<article class="client-license-direct-access is-platform-access">
      ${ui.sectionHeader({
        className: "client-license-section-head",
        eyebrow: "Permisos internos",
        title: "Herramientas autorizadas",
        description: "Capacidades técnicas o administrativas independientes de tus licencias.",
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

  function renderAttention() {
    const license = dashboard.licenses.map(toLicenseViewModel).find(item => item.needsAttention);
    if (!license) return "";
    const copy = license.status === "expiring"
      ? `Tu licencia ${license.productName} vence el ${formatDate(license.ends_at)}. Coordina la renovación para evitar interrupciones.`
      : `Tu licencia ${license.productName} está ${license.statusMeta.label.toLowerCase()}. Revisa las opciones con tu administrador o soporte.`;
    return `<aside class="client-license-attention" data-tone="${escapeHtml(license.statusMeta.tone)}">${ui.icon(license.statusMeta.icon, "md")}<div><strong>Requiere atención</strong><span>${escapeHtml(copy)}</span></div><a class="btn btn-ghost btn-compact" href="/contactUs.html">Contactar soporte</a></aside>`;
  }

  function manageableLicenses() {
    return dashboard.licenses.map(toLicenseViewModel).filter(item => item.canManage);
  }

  function selectedManageableLicense() {
    const manageable = manageableLicenses();
    return manageable.find(item => item.license_id === selectedLicenseId) || manageable[0] || null;
  }

  function renderSeatManagementLayer() {
    const selected = selectedManageableLicense();
    if (!selected) return "";
    return `<dialog class="workspace-layer is-drawer" data-client-license-management-layer aria-labelledby="client-license-management-title">
      ${renderSeatManagementPanel(selected)}
    </dialog>`;
  }

  function renderSeatManagementPanel(selected) {
    const manageable = manageableLicenses();
    const assignments = dashboard.assignments.filter(item => item.license_id === selected.license_id);
    const assignedUsers = new Set(assignments.map(item => item.user_id));
    const candidates = dashboard.members.filter(item => item.account_id === selected.account_id && !assignedUsers.has(item.user_id));
    return `<section class="workspace-layer-panel client-license-management-panel">
      <header class="workspace-layer-head"><div><span class="workspace-eyebrow">Administración</span><h2 id="client-license-management-title">Plazas de ${escapeHtml(productName(selected.product_key))}</h2><p>${escapeHtml(selected.account_name)} · ${assignments.length} de ${selected.seatLimit} plazas asignadas</p></div>${closeLayerAction("Cerrar gestión de plazas")}</header>
      <div class="workspace-layer-body">
        ${manageable.length > 1 ? `<label class="client-license-layer-select">Licencia
          <select data-client-license-select>${manageable.map(item => `<option value="${escapeHtml(item.license_id)}" ${item.license_id === selected.license_id ? "selected" : ""}>${escapeHtml(productName(item.product_key))} · ${escapeHtml(item.account_name)}</option>`).join("")}</select>
        </label>` : ""}
        <form class="client-license-form" data-client-license-assign-form>
          <input type="hidden" name="licenseId" value="${escapeHtml(selected.license_id)}">
          <label>Asignar a un miembro
            <select name="userId" data-client-license-control data-idle-disabled="${candidates.length ? "false" : "true"}" required ${candidates.length ? "" : "disabled"}>
              ${candidates.length ? candidates.map(item => `<option value="${escapeHtml(item.user_id)}">${escapeHtml(item.display_name || item.email)} · ${escapeHtml(item.email)}</option>`).join("") : '<option value="">No hay miembros disponibles</option>'}
            </select>
          </label>
          <button class="btn btn-primary" type="submit" data-client-license-control data-idle-disabled="${candidates.length ? "false" : "true"}" ${busy || !candidates.length ? "disabled" : ""}>Asignar plaza</button>
        </form>
        <section class="client-license-layer-section">
          <div class="client-license-card-head"><div><h3>Plazas asignadas</h3><p>Libera accesos que ya no se utilizan.</p></div><span class="client-license-tag">${assignments.length} / ${selected.seatLimit}</span></div>
          ${assignments.length ? `<div class="client-license-assignment-list">${assignments.map(renderAssignment).join("")}</div>` : ui.emptyState({
            className: "client-license-empty is-compact",
            icon: "users",
            title: "No hay plazas asignadas.",
            description: "Selecciona un miembro para activar su acceso."
          })}
        </section>
        <a class="btn btn-ghost" href="/contactUs.html?intent=member">Solicitar un nuevo miembro</a>
      </div>
    </section>`;
  }

  function refreshSeatManagementLayer({ focusSelect = false } = {}) {
    const dialog = root?.querySelector("[data-client-license-management-layer]");
    const selected = selectedManageableLicense();
    if (!dialog || !selected) return;
    dialog.innerHTML = renderSeatManagementPanel(selected);
    refreshIcons(dialog);
    if (focusSelect) dialog.querySelector("[data-client-license-select]")?.focus();
  }

  function renderCommercialRequestLayer() {
    if (selectedCommercialPlanId) return renderMapNanoCommercialRequestLayer();
    const key = contracts.PRODUCT_CATALOG[selectedRequestProductKey] ? selectedRequestProductKey : "map.nano";
    const product = contracts.productCatalog(key);
    const allowedTypes = product.licenseTypes || [];
    const typeKey = allowedTypes.includes(selectedRequestLicenseType) ? selectedRequestLicenseType : allowedTypes[0] || "named_user";
    const type = contracts.licenseType(typeKey);
    const requestIntro = type.isEvaluation
      ? `Solicita ${trialOffer.duration_days} días gratis. Confirmaremos el acceso y el caso de uso en 1 día hábil.`
      : "Cuéntanos el alcance. Responderemos con una recomendación y los próximos pasos en 1 día hábil.";
    return `<dialog class="workspace-layer is-drawer" data-client-license-request-layer aria-labelledby="client-license-request-title">
      <form class="workspace-layer-panel client-license-request-form" data-client-license-request-form data-analytics-form="map-license-request">
        <header class="workspace-layer-head"><div><span class="workspace-eyebrow">Solicitud comercial</span><h2 id="client-license-request-title">${escapeHtml(productName(key))} · ${escapeHtml(type.label)}</h2><p>${escapeHtml(requestIntro)}</p></div>${closeLayerAction("Cerrar solicitud")}</header>
        <div class="workspace-layer-body" data-client-license-request-body>
          <input type="hidden" name="product_key" value="${escapeHtml(key)}">
          <input type="hidden" name="product" value="${escapeHtml(productName(key))}">
          <input type="hidden" name="license_type" value="${escapeHtml(typeKey)}">
          <input type="hidden" name="license_type_name" value="${escapeHtml(type.label)}">
          ${type.isEvaluation ? `<input type="hidden" name="trial_policy" value="${escapeHtml(trialOffer.policy_key)}"><input type="hidden" name="trial_days" value="${trialOffer.duration_days}">` : ""}
          <input type="hidden" name="intent" value="${type.isEvaluation ? "evaluation" : "license"}">
          <input type="hidden" name="_subject" value="Solicitud ${escapeHtml(productName(key))} · ${escapeHtml(type.label)}">
          <label>Correo de contacto
            <input type="email" name="user_email" value="${escapeHtml(currentUser?.email || "")}" autocomplete="email" required>
          </label>
          ${type.isEvaluation ? `<label>Caso de uso
            <textarea name="message" rows="4" placeholder="¿Qué quieres validar con ${escapeHtml(productName(key))}?" required></textarea>
          </label>` : `<div class="client-license-form-row">
            <label>Plazas estimadas
              <input type="number" name="seats" min="${type.defaultSeatLimit}" max="10000" value="${type.defaultSeatLimit}" required>
            </label>
            <label>Despliegue
              <select name="deployment" required>
                <option value="web">Web</option>
                <option value="desktop">Desktop</option>
                <option value="hybrid">Web y desktop</option>
                <option value="unsure">Necesito orientación</option>
              </select>
            </label>
          </div>
          <label>Contexto del proyecto
            <textarea name="message" rows="5" placeholder="Equipo, flujo actual, volumen de análisis o fecha objetivo"></textarea>
          </label>`}
          <p class="client-license-request-feedback" data-client-license-request-feedback role="status" aria-live="polite"></p>
          <p class="client-license-request-fallback">Si tienes problemas al enviar, <a href="${escapeHtml(product.requestHref + `&license_type=${encodeURIComponent(typeKey)}`)}">continúa en el formulario de contacto</a>.</p>
        </div>
        <footer class="workspace-layer-actions">
          <button class="btn btn-ghost" type="button" data-client-license-close-layer>Cancelar</button>
          <button class="btn btn-primary" type="submit" data-client-license-request-submit data-idle-label="${type.isEvaluation ? "Solicitar prueba" : "Enviar solicitud"}">${type.isEvaluation ? "Solicitar prueba" : "Enviar solicitud"}</button>
        </footer>
      </form>
    </dialog>`;
  }

  function renderMapNanoCommercialRequestLayer() {
    const plan = selectedCommercialPlanId === "project" ? mapNanoPlans.PROJECT_ACCESS : mapNanoPlans.planById(selectedCommercialPlanId);
    if (!plan) {
      selectedCommercialPlanId = "";
      return renderCommercialRequestLayer();
    }
    const hasLicense = dashboard.licenses.some(item => item.product_key === "map.nano");
    const requestType = mapNanoPlans.requestTypeForPlan(plan.id, { upgrade: hasLicense });
    const defaultName = currentUser?.displayName || currentUser?.name || "";
    const defaultOrganization = currentUser?.company || "";
    const isProject = plan.id === "project";
    return `<dialog class="workspace-layer is-drawer" data-client-license-request-layer aria-labelledby="client-map-nano-request-title">
      <form class="workspace-layer-panel client-license-request-form" data-client-license-request-form data-map-nano-commercial-request-form data-analytics-form="map-nano-commercial-request">
        <header class="workspace-layer-head"><div><span class="workspace-eyebrow">Solicitud comercial</span><h2 id="client-map-nano-request-title">${escapeHtml(plan.name)}</h2><p>Tu solicitud quedará registrada en MAP para seguimiento comercial. No se realiza ningún cobro ni cambio de licencia automáticamente.</p></div>${closeLayerAction("Cerrar solicitud")}</header>
        <div class="workspace-layer-body" data-client-license-request-body>
          <input type="hidden" name="product_key" value="map.nano"><input type="hidden" name="product" value="MAP-Nano"><input type="hidden" name="commercial_plan" value="${escapeHtml(plan.id)}"><input type="hidden" name="intent" value="${escapeHtml(requestType)}"><input type="hidden" name="_subject" value="Solicitud MAP-Nano · ${escapeHtml(plan.name)}">
          <div class="client-license-form-row"><label>Nombre<input type="text" name="user_name" value="${escapeHtml(defaultName)}" autocomplete="name" required></label><label>Correo<input type="email" name="user_email" value="${escapeHtml(currentUser?.email || "")}" autocomplete="email" required></label></div>
          <div class="client-license-form-row"><label>Institución u organización<input type="text" name="organization" value="${escapeHtml(defaultOrganization)}" autocomplete="organization" required></label><label>País<input type="text" name="country" autocomplete="country-name" required></label></div>
          <div class="client-license-form-row"><label>Plan de interés<input type="text" name="plan_name" value="${escapeHtml(plan.name)}" readonly></label><label>Tipo de solicitud<select name="request_type" required><option value="new_license" ${requestType === "new_license" ? "selected" : ""}>Nueva licencia</option><option value="upgrade" ${requestType === "upgrade" ? "selected" : ""}>Actualización</option><option value="institutional_quote" ${requestType === "institutional_quote" ? "selected" : ""}>Cotización institucional</option><option value="project_access" ${requestType === "project_access" ? "selected" : ""}>Acceso por proyecto</option><option value="demo">Demostración</option></select></label></div>
          <div class="client-license-form-row"><label>Usuarios estimados<input type="number" name="estimated_users" min="1" max="100000" value="${Number(plan.limits?.namedUsers) || 1}" required></label><label>Volumen aproximado<select name="analysis_volume" required><option value="">Selecciona una opción</option><option value="under_100">Menos de 100 imágenes o muestras</option><option value="100_to_1000">100 a 1,000 imágenes o muestras</option><option value="over_1000">Más de 1,000 imágenes o muestras</option><option value="unknown">Aún no definido</option></select></label></div>
          <label>Mensaje<textarea name="message" rows="5" placeholder="Describe el flujo actual, el tipo de imágenes y cualquier requisito de despliegue o soporte."></textarea></label>
          ${isProject ? '<p class="client-license-request-fallback">El acceso por proyecto puede incluir acceso temporal de 30 días o análisis asistido, según el alcance.</p>' : ""}
          <p class="client-license-request-feedback" data-client-license-request-feedback role="status" aria-live="polite"></p>
          <p class="client-license-request-fallback">Si el registro no está disponible, <a href="${escapeHtml(mapNanoPlans.requestUrl(plan.id, { upgrade: hasLicense }))}">continúa en el formulario de contacto</a>.</p>
        </div>
        <footer class="workspace-layer-actions"><button class="btn btn-ghost" type="button" data-client-license-close-layer>Cancelar</button><button class="btn btn-primary" type="submit" data-client-license-request-submit data-idle-label="Enviar solicitud">Enviar solicitud</button></footer>
      </form>
    </dialog>`;
  }

  function refreshCommercialRequestLayer() {
    const current = root?.querySelector("[data-client-license-request-layer]");
    if (!current) return null;
    const wrapper = document.createElement("div");
    wrapper.innerHTML = renderCommercialRequestLayer();
    const next = wrapper.firstElementChild;
    current.replaceWith(next);
    refreshIcons(next);
    return next;
  }

  function closeLayerAction(label) {
    return ui.action({ label, ariaLabel: label, icon: "x", iconOnly: true, className: "workspace-layer-close", data: { clientLicenseCloseLayer: true } });
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
    refreshSeatManagementLayer({ focusSelect: true });
  }

  async function handleSubmit(event) {
    const requestForm = event.target.closest("[data-client-license-request-form]");
    if (requestForm) {
      event.preventDefault();
      await submitCommercialRequest(requestForm);
      return;
    }
    const form = event.target.closest("[data-client-license-assign-form]");
    if (!form) return;
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form));
    if (!values.licenseId || !values.userId || busy) return;
    setBusy(true);
    setMessage("Asignando la plaza...");
    try {
      await repository.assignSeat(values.licenseId, values.userId);
      await reloadDashboardData("La plaza fue asignada correctamente.");
    } catch (error) {
      setBusy(false);
      setMessage(userMessage(error), "error");
    }
  }

  function handleKeydown(event) {
    const tab = event.target.closest("[data-client-suite-product]");
    if (!tab || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const tabs = [...root.querySelectorAll("[data-client-suite-product]")];
    const currentIndex = tabs.indexOf(tab);
    if (currentIndex < 0) return;
    event.preventDefault();
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? tabs.length - 1
        : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    activateSuiteProduct(tabs[nextIndex].dataset.clientSuiteProduct, { focus: true });
  }

  function activateSuiteProduct(key, { focus = false } = {}) {
    if (!suiteProductKeys().includes(key)) return;
    const previousKey = selectedSuiteProductKey;
    selectedSuiteProductKey = key;
    if (previousKey !== key) trackLicenseFunnel("map_license_product_select", { productKey: key });
    const current = root.querySelector(".client-license-suite");
    if (!current) return;
    const wrapper = document.createElement("div");
    wrapper.innerHTML = renderSuite();
    current.replaceWith(wrapper.firstElementChild);
    refreshIcons(root.querySelector(".client-license-suite"));
    if (focus) root.querySelector('[data-client-suite-product][aria-selected="true"]')?.focus();
  }

  async function handleClick(event) {
    const suiteTab = event.target.closest("[data-client-suite-product]");
    if (suiteTab) {
      activateSuiteProduct(suiteTab.dataset.clientSuiteProduct, { focus: true });
      return;
    }
    const closeButton = event.target.closest("[data-client-license-close-layer]");
    if (closeButton) {
      ui.closeLayer(closeButton.closest("dialog"));
      return;
    }
    const manageButton = event.target.closest("[data-client-license-manage]");
    if (manageButton) {
      selectedLicenseId = manageButton.dataset.clientLicenseManage;
      refreshSeatManagementLayer();
      ui.openLayer(root.querySelector("[data-client-license-management-layer]"), { trigger: manageButton });
      return;
    }
    const requestButton = event.target.closest("[data-client-license-request]");
    if (requestButton) {
      selectedCommercialPlanId = "";
      selectedRequestProductKey = requestButton.dataset.clientLicenseRequest;
      selectedRequestLicenseType = requestButton.dataset.clientLicenseType || "named_user";
      const requestedType = contracts.licenseType(selectedRequestLicenseType);
      trackLicenseFunnel("map_license_request_open", {
        productKey: selectedRequestProductKey,
        licenseType: selectedRequestLicenseType,
        isEvaluation: requestedType?.isEvaluation
      });
      const dialog = refreshCommercialRequestLayer();
      ui.openLayer(dialog, { trigger: requestButton });
      return;
    }
    const commercialRequestButton = event.target.closest("[data-map-nano-commercial-request]");
    if (commercialRequestButton) {
      selectedCommercialPlanId = commercialRequestButton.dataset.mapNanoCommercialRequest;
      const requestType = commercialRequestButton.dataset.mapNanoRequestType || mapNanoPlans.requestTypeForPlan(selectedCommercialPlanId);
      if (!commercialRequestsAvailable) {
        setMessage("El registro comercial no está disponible ahora. Usa el formulario de contacto para continuar.", "error");
        return;
      }
      if (pendingCommercialRequest(selectedCommercialPlanId, requestType)) {
        setMessage("Ya existe una solicitud comercial abierta para este plan. Puedes cancelarla desde tu historial antes de enviar otra.", "neutral");
        return;
      }
      trackCommercialPlan("pricing_plan_selected", { planId: selectedCommercialPlanId, requestType });
      const eventName = selectedCommercialPlanId === "project"
        ? "project_access_requested"
        : requestType === "upgrade"
          ? "upgrade_requested"
          : selectedCommercialPlanId === "institutional"
            ? "contact_sales_clicked"
            : "quote_requested";
      trackCommercialPlan(eventName, { planId: selectedCommercialPlanId, requestType });
      const dialog = refreshCommercialRequestLayer();
      ui.openLayer(dialog, { trigger: commercialRequestButton });
      return;
    }
    const cancelCommercialRequestButton = event.target.closest("[data-map-nano-commercial-cancel]");
    if (cancelCommercialRequestButton && !busy) {
      const confirmed = await ui.confirmAction({
        title: "Cancelar solicitud comercial",
        description: "La solicitud dejará de estar activa y podrás enviar una nueva si el alcance cambió.",
        confirmLabel: "Cancelar solicitud"
      });
      if (!confirmed) return;
      setBusy(true);
      setMessage("Cancelando la solicitud comercial...");
      try {
        await repository.cancelCommercialRequest(cancelCommercialRequestButton.dataset.mapNanoCommercialCancel);
        await reloadDashboardData("La solicitud comercial fue cancelada.");
      } catch (error) {
        setBusy(false);
        setMessage(userMessage(error), "error");
      }
      return;
    }
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
      await reloadDashboardData("La plaza fue liberada correctamente.");
    } catch (error) {
      setBusy(false);
      setMessage(userMessage(error), "error");
    }
  }

  async function reloadDashboardData(successMessage) {
    try {
      const payload = await repository.getDashboard();
      platformAccess = payload.platformAccess;
      effectiveAccess = payload.effectiveAccess;
      internalEntitlements = payload.entitlements;
      trialOffer = contracts.normalizeTrialOffer(payload.trialOffer);
      dashboard = payload.dashboard;
      commercialRequests = payload.commercialRequests;
      commercialRequestsAvailable = payload.commercialRequestsAvailable;
      selectDefaultLicense();
      render();
      setMessage(successMessage, "ok");
      const dialog = root.querySelector("[data-client-license-management-layer]");
      if (dialog) ui.openLayer(dialog);
    } finally {
      setBusy(false);
    }
  }

  async function submitCommercialRequest(form) {
    if (requestBusy) return;
    requestBusy = true;
    const submit = form.querySelector("[data-client-license-request-submit]");
    const feedback = form.querySelector("[data-client-license-request-feedback]");
    const isEvaluation = form.elements.intent?.value === "evaluation";
    const isMapNanoCommercial = form.matches("[data-map-nano-commercial-request-form]");
    const productKey = form.elements.product_key?.value || selectedRequestProductKey;
    const licenseType = form.elements.license_type?.value || selectedRequestLicenseType;
    const commercialPlanId = form.elements.commercial_plan?.value || "";
    const requestType = form.elements.request_type?.value || form.elements.intent?.value || "";
    const funnelMetadata = { productKey, licenseType, isEvaluation };
    if (isMapNanoCommercial && !commercialRequestsAvailable) {
      feedback.textContent = "El registro comercial no está disponible ahora. Usa el enlace de contacto alternativo.";
      feedback.dataset.tone = "error";
      requestBusy = false;
      return;
    }
    if (isMapNanoCommercial && pendingCommercialRequest(commercialPlanId, requestType)) {
      feedback.textContent = "Ya existe una solicitud comercial abierta para este plan. Puedes cancelarla desde tu historial antes de enviar otra.";
      feedback.dataset.tone = "error";
      requestBusy = false;
      return;
    }
    trackLicenseFunnel("map_license_request_submit", funnelMetadata);
    if (isMapNanoCommercial) trackCommercialPlan("quote_requested", { planId: commercialPlanId, requestType });
    submit.disabled = true;
    submit.textContent = "Enviando...";
    feedback.textContent = "Enviando tu solicitud...";
    feedback.dataset.tone = "neutral";
    try {
      if (isMapNanoCommercial) {
        const values = new FormData(form);
        await repository.createCommercialRequest({
          planKey: commercialPlanId,
          requestType,
          contactName: values.get("user_name"),
          contactEmail: values.get("user_email"),
          organizationName: values.get("organization"),
          country: values.get("country"),
          estimatedUsers: values.get("estimated_users"),
          analysisVolume: values.get("analysis_volume"),
          message: values.get("message"),
          accountId: mapNanoCommercialAccountId()
        });
        trackLicenseFunnel("map_license_request_success", funnelMetadata);
        const requestState = await repository.getCommercialRequests();
        commercialRequests = requestState.requests;
        commercialRequestsAvailable = requestState.available;
        if (!commercialRequestsAvailable) throw new Error("El historial comercial no está disponible.");
        trackCommercialPlan(commercialPlanId === "project" ? "project_access_requested" : requestType === "upgrade" ? "upgrade_requested" : "quote_requested", { planId: commercialPlanId, requestType });
        ui.closeLayer(form.closest("dialog"), "submitted");
        render();
        setMessage("Recibimos tu solicitud comercial. Te responderemos en 1 día hábil.", "ok");
      } else {
        const response = await fetch("https://formspree.io/f/xleqdrag", {
          method: "POST",
          body: new FormData(form),
          headers: { Accept: "application/json" }
        });
        if (!response.ok) throw new Error("No fue posible enviar la solicitud.");
        trackLicenseFunnel("map_license_request_success", funnelMetadata);
        ui.closeLayer(form.closest("dialog"), "submitted");
        setMessage(isEvaluation ? "Recibimos tu solicitud de prueba. Te responderemos en 1 día hábil." : "Recibimos tu solicitud. Te responderemos en 1 día hábil.", "ok");
      }
    } catch (error) {
      trackLicenseFunnel("map_license_request_error", funnelMetadata);
      if (isMapNanoCommercial) trackCommercialPlan("quote_request_error", { planId: commercialPlanId, requestType });
      feedback.textContent = isMapNanoCommercial
        ? "No pudimos registrar la solicitud. Usa el enlace de contacto alternativo."
        : "No pudimos enviar la solicitud. Usa el enlace de contacto alternativo.";
      feedback.dataset.tone = "error";
    } finally {
      requestBusy = false;
      submit.disabled = false;
      submit.textContent = submit.dataset.idleLabel || (isEvaluation ? "Solicitar prueba" : "Enviar solicitud");
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
