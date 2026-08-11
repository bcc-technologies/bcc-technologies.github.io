(() => {
  const contracts = window.BCCWorkspaceMapContracts;
  const repository = window.BCCWorkspaceMapRepository.client;
  const mapNanoPlans = window.BCCMapNanoPlans;
  const utils = window.BCCWorkspaceUtils;
  const ui = window.BCCWorkspaceUI;
  const billingConfig = window.BCC_MAP_BILLING || Object.freeze({ checkoutEnabled: false, portalEnabled: false, selfServePlans: [] });
  if (!mapNanoPlans) throw new Error("MAP-Nano commercial plans must load before the client licenses module.");
  const escapeHtml = utils.escapeHtml;
  const refreshIcons = utils.refreshIcons;
  const isEnglish = () => window.BCCWorkspaceI18n?.locale?.() === "en";
  const localize = value => window.BCCWorkspaceI18n?.markup?.(value) || value;
  const contactPath = () => isEnglish() ? "/en/contactUs.html" : "/contactUs.html";
  let root = null;
  let currentUser = null;
  let dashboard = emptyDashboard();
  let selectedLicenseId = "";
  let selectedSuiteProductKey = "";
  let selectedRequestProductKey = "map.nano";
  let selectedRequestLicenseType = "named_user";
  let selectedCommercialPlanId = "";
  let selectedBillingInterval = "year";
  let requestBusy = false;
  let platformAccess = [];
  let effectiveAccess = [];
  let internalEntitlements = [];
  let trialOffer = contracts.TRIAL_OFFER_FALLBACK;
  let commercialRequests = [];
  let commercialRequestsAvailable = false;
  let billingSubscriptions = [];
  let billingAvailable = false;
  let busy = false;
  let seatManagement = emptySeatManagement();
  let seatManagementFeedback = emptySeatManagementFeedback();
  let seatManagementRequestId = 0;
  let seatSearchTimer = null;

  function emptyDashboard() {
    return { accounts: [], licenses: [], members: [], assignments: [], recent_events: [] };
  }

  function emptySeatManagement(licenseId = "", query = "") {
    return {
      licenseId,
      query,
      loading: false,
      error: "",
      assignedSeats: 0,
      seatLimit: 0,
      assignmentMatches: 0,
      candidateMatches: 0,
      selectedUserId: "",
      assignments: [],
      candidates: []
    };
  }

  function emptySeatManagementFeedback() {
    return { message: "", tone: "neutral" };
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
      request_type: metadata.requestType || "",
      billing_interval: metadata.billingInterval || ""
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
    root.addEventListener("input", handleInput);
    root.addEventListener("submit", handleSubmit);
    root.setAttribute("aria-busy", "true");
    trackCommercialPlan("subscription_page_viewed");
    void loadDashboard({ successMessage: billingReturnMessage() });
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
      billingSubscriptions = payload.billingSubscriptions || [];
      billingAvailable = Boolean(payload.billingAvailable);
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
    const selectedProduct = contracts.productCatalog(selectedSuiteProductKey) || { productHref: "/products.html" };
    root.innerHTML = `
      <section class="client-license-shell">
        ${ui.sectionHeader({
          className: "workspace-page-header",
          actionsClassName: "client-license-actions",
          title: "Licencias MAP",
          level: 1,
          description: "Elige el producto y la modalidad para llevar tus análisis de la evaluación al trabajo diario.",
          collapsibleDescription: true,
          actions: [
            {
              label: "Ver producto",
              icon: "arrow-up-right",
              compact: true,
              className: "btn btn-ghost",
              href: selectedProduct.productHref
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
        ${renderPlanComparisonLayer()}
      </section>`;
    refreshIcons();
    window.BCCWorkspaceI18n?.localizeTree?.(root);
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
    const selectedCatalog = contracts.productCatalog(selectedSuiteProductKey);

    return `<section class="client-license-suite" id="suite-map" aria-label="Productos y licencias MAP">
      <div class="client-license-suite-toolbar">
        <div class="client-license-product-tabs" role="tablist" aria-label="Productos de la suite MAP">
          ${productKeys.map(key => renderProductTab(key, licenses)).join("")}
        </div>
        ${renderSuiteActions(selectedLicenses)}
      </div>
      ${renderSuiteProduct(selectedSuiteProductKey, selectedCatalog, selectedLicenses)}
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
      ${accessCount ? `<span class="client-license-tab-count" aria-label="${accessCount} ${isEnglish() ? (accessCount === 1 ? "active access" : "active accesses") : `acceso${accessCount === 1 ? "" : "s"} vigente${accessCount === 1 ? "" : "s"}`}">${accessCount}</span>` : ""}
    </button>`;
  }

  function renderSuiteActions(productLicenses) {
    const activeAccessCount = productLicenses.filter(item => ["active", "scheduled", "expiring"].includes(item.status)).length;
    const accessState = activeAccessCount
      ? isEnglish() ? `${activeAccessCount} ${activeAccessCount === 1 ? "active access" : "active accesses"}` : `${activeAccessCount} acceso${activeAccessCount === 1 ? "" : "s"} vigente${activeAccessCount === 1 ? "" : "s"}`
      : isEnglish() ? "No active access" : "Sin acceso vigente";
    return `<div class="client-license-suite-actions"><span class="client-license-product-state ${activeAccessCount ? "is-active" : "is-discover"}">${ui.icon(activeAccessCount ? "badge-check" : "sparkles", "xs")}${accessState}</span></div>`;
  }

  function renderSuiteProduct(key, catalog, productLicenses) {
    const product = catalog || {
      category: "Producto MAP",
      description: "Acceso MAP asociado a tu cuenta.",
      features: [],
      icon: "scan-line",
      productHref: "/products.html",
      requestHref: `${contactPath()}?intent=license`,
      licenseTypes: []
    };
    const panelId = productDomId(key);
    const currentLicenses = productLicenses.filter(item => ["active", "scheduled", "expiring"].includes(item.status));
    const previousLicenses = productLicenses.filter(item => !["active", "scheduled", "expiring"].includes(item.status));
    return `<div class="client-license-product-panel" id="suite-panel-${panelId}" role="tabpanel" aria-labelledby="suite-tab-${panelId}" tabindex="0">
      ${renderCurrentProductAccess(key, product, currentLicenses)}
      ${currentLicenses.length ? "" : renderLastProductAccess(key, product, previousLicenses)}
      ${renderLicenseOptions(key, productLicenses)}
    </div>`;
  }

  function renderCurrentProductAccess(key, product, productLicenses) {
    if (!productLicenses.length) return "";
    return `<section class="client-license-current-access" aria-labelledby="current-access-${productDomId(key)}">
      <div class="client-license-subsection-head">
        <div><span class="client-license-subsection-kicker">Estado de acceso</span><h3 id="current-access-${productDomId(key)}">Tu acceso</h3></div>
        <span class="client-license-tag">${productLicenses.length}</span>
      </div>
      <div class="client-license-current-grid">${productLicenses.map(item => renderCurrentAccessCard(product, item)).join("")}</div>
    </section>`;
  }

  function renderLastProductAccess(key, product, productLicenses) {
    const lastLicense = [...productLicenses]
      .filter(item => ["suspended", "cancelled", "expired", "revoked"].includes(item.status))
      .sort((left, right) => licenseActivityTimestamp(right) - licenseActivityTimestamp(left))[0];
    if (!lastLicense) return "";
    const commercialPlan = key === "map.nano" ? mapNanoPlans.planById(mapNanoPlans.planIdForLicense(lastLicense)) : null;
    const planName = commercialPlan?.name || lastLicense.plan_name || contracts.licenseType(lastLicense.license_type)?.label || "Licencia MAP";
    const endedLabel = lastLicense.status === "cancelled"
      ? lastLicense.statusMeta.label
      : lastLicense.ends_at
        ? `${isEnglish() ? "Ended" : "Finaliz\u00f3"} ${formatDate(lastLicense.ends_at)}`
        : lastLicense.statusMeta.label;
    return `<section class="client-license-last-access" aria-labelledby="last-access-${productDomId(key)}">
      <div class="client-license-subsection-head">
        <div><span class="client-license-subsection-kicker">\u00daltimo acceso</span><h3 id="last-access-${productDomId(key)}">Tu \u00faltimo plan</h3></div>
      </div>
      <article class="client-license-last-card">
        <div class="client-license-last-copy">
          <span class="client-license-last-icon">${ui.icon("history", "sm")}</span>
          <div><strong>${escapeHtml(planName)}</strong><small>${escapeHtml(lastLicense.account_name || "Cuenta MAP")} ? ${escapeHtml(endedLabel)}</small><p>Este acceso ya no est? vigente. Puedes reactivarlo o elegir un plan nuevo.</p></div>
        </div>
        <div class="client-license-last-actions"><span class="client-license-tag ${escapeHtml(lastLicense.status)}">${ui.icon(lastLicense.statusMeta.icon, "xs")}${escapeHtml(lastLicense.statusMeta.label)}</span>${renderCurrentAccessActions(product, lastLicense)}</div>
      </article>
    </section>`;
  }

  function licenseActivityTimestamp(license) {
    for (const value of [license?.ends_at, license?.starts_at, license?.updated_at, license?.created_at]) {
      const timestamp = new Date(value || 0).getTime();
      if (Number.isFinite(timestamp) && timestamp > 0) return timestamp;
    }
    return 0;
  }

  function renderCurrentAccessCard(product, item) {
    const capabilities = capabilitiesForLicense(item);
    const commercialPlan = item.product_key === "map.nano" ? mapNanoPlans.planById(mapNanoPlans.planIdForLicense(item)) : null;
    const billingSubscription = billingSubscriptionForLicense(item);
    return `<article class="client-license-current-card">
      <div class="client-license-current-card-head">
        <div><strong>${escapeHtml(commercialPlan?.name || item.plan_name || contracts.licenseType(item.license_type)?.label || "Licencia MAP")}</strong><small>${escapeHtml(item.account_name || "Cuenta MAP")}</small></div>
        <span class="client-license-tag ${escapeHtml(item.status)}">${ui.icon(item.statusMeta.icon, "xs")}${escapeHtml(item.statusMeta.label)}</span>
      </div>
      <dl class="client-license-access-facts">
        <div><dt>Inicio</dt><dd>${item.starts_at ? formatDate(item.starts_at) : "No especificado"}</dd></div>
        <div><dt>Vigencia</dt><dd>${item.ends_at ? `Hasta ${formatDate(item.ends_at)}` : "Sin vencimiento"}</dd></div>
        <div><dt>Modalidad</dt><dd>${escapeHtml(contracts.licenseType(item.license_type)?.shortLabel || (item.is_evaluation ? "Evaluación" : roleLabel(item.member_role)))}</dd></div>
        ${item.product_key === "map.nano" ? `<div><dt>Facturación</dt><dd>${escapeHtml(billingLabel(billingSubscription))}</dd></div>` : ""}
      </dl>
      ${capabilities.length ? `<div class="client-license-capability-summary"><span>Capacidades habilitadas</span><div>${capabilities.map(capability => `<span class="client-license-tag">${escapeHtml(platformAccessLabel(capability.access_key))}</span>`).join("")}</div></div>` : item.product_key === "map.nano" ? '<p class="client-license-card-note">Las capacidades técnicas aún no están disponibles para esta asignación.</p>' : ""}
      ${item.seatLimit ? `<div class="client-license-seat-summary">
        <div><span>Uso de plazas</span><strong>${escapeHtml(seatUsageLabel(item))}</strong></div>
        ${ui.progress({ value: item.seatUsage, label: seatUsageLabel(item), className: "client-license-seat-bar", tone: "accent" })}
      </div>` : ""}
      ${item.is_evaluation ? `<p class="client-license-card-note">${ui.icon("info", "xs")} El ciclo de evaluación es administrado por el equipo BCC.</p>` : ""}
      <footer class="client-license-card-actions">${renderCurrentAccessActions(product, item)}${renderBillingAction(item, billingSubscription)}</footer>
    </article>`;
  }

  function seatUsageLabel(item) {
    const occupied = Number(item.assignedSeats || 0);
    const capacity = Number(item.seatLimit || 0);
    if (isEnglish()) return `${occupied} of ${capacity} ${capacity === 1 ? "seat" : "seats"} occupied`;
    return `${occupied} de ${capacity} ${capacity === 1 ? "plaza ocupada" : "plazas ocupadas"}`;
  }

  function renderCurrentAccessActions(product, item) {
    if (item.canManage) {
      return ui.action({ label: "Gestionar plazas", icon: "users", className: "btn btn-primary", data: { clientLicenseManage: item.license_id } });
    }
    if (["expiring", "suspended", "cancelled", "expired", "revoked"].includes(item.status)) {
      return ui.action({
        label: item.status === "expiring" ? "Renovar licencia" : "Solicitar reactivación",
        icon: "refresh-cw",
        className: "btn btn-primary",
        data: { clientLicenseRequest: item.product_key, clientLicenseType: item.license_type || "named_user" }
      });
    }
    return ui.action({ label: "Abrir información", href: product.productHref, icon: "external-link", className: "btn btn-ghost" });
  }

  function renderBillingAction(item, subscription) {
    if (!billingConfig.portalEnabled || !billingAvailable || !subscription?.can_manage_billing) return "";
    return ui.action({
      label: isEnglish() ? "Manage billing" : "Gestionar facturaci\u00f3n",
      icon: "receipt-text",
      className: "btn btn-ghost",
      data: { mapNanoBillingPortal: item.account_id }
    });
  }

  function billingSubscriptionForLicense(license) {
    return billingSubscriptions.find(subscription => subscription.license_id === license.license_id) || null;
  }

  function billingLabel(subscription) {
    if (!subscription) return isEnglish() ? "Not specified" : "No especificada";
    const interval = subscription.billing_interval === "month" ? (isEnglish() ? "Monthly" : "Mensual") : (isEnglish() ? "Annual" : "Anual");
    if (subscription.cancel_at_period_end) {
      const endDate = formatDate(subscription.current_period_end);
      return isEnglish() ? `${interval} - cancels ${endDate}` : `${interval} - se cancela el ${endDate}`;
    }
    const labels = {
      active: isEnglish() ? `${interval} - active` : `${interval} - activa`,
      trialing: isEnglish() ? `${interval} - trial` : `${interval} - en prueba`,
      past_due: isEnglish() ? `${interval} - payment due` : `${interval} - pago pendiente`,
      canceled: isEnglish() ? `${interval} - cancelled` : `${interval} - cancelada`,
      unpaid: isEnglish() ? `${interval} - unpaid` : `${interval} - impaga`,
      paused: isEnglish() ? `${interval} - paused` : `${interval} - pausada`,
      incomplete: isEnglish() ? `${interval} - incomplete` : `${interval} - incompleta`,
      incomplete_expired: isEnglish() ? `${interval} - expired` : `${interval} - vencida`
    };
    return labels[subscription.status] || interval;
  }

  function renderLicenseOptions(key, productLicenses) {
    if (key === "map.nano") return renderMapNanoCommercialOptions(productLicenses);
    const types = contracts.productLicenseTypes(key);
    if (!types.length) return "";
    const ownedTypes = new Set(productLicenses
      .filter(item => ["active", "scheduled", "expiring"].includes(item.status))
      .map(item => item.license_type));
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
      ${type.isEvaluation ? `<p class="client-license-trial-offer"><strong>${isEnglish() ? `${trialDays}-day evaluation` : `${trialDays} días gratis`}</strong><span>${trialCampaign ? (isEnglish() ? `Early access · then ${trialOffer.standard_days} days` : `Early access · luego ${trialOffer.standard_days} días`) : "Prueba estándar"}</span></p>` : ""}
      <div class="client-license-offer-meta">
        <span>${ui.icon("users", "xs")}${escapeHtml(type.seatLabel)}</span>
        ${type.isEvaluation ? "" : `<span>${ui.icon("calendar-clock", "xs")}${escapeHtml(type.durationLabel)}</span>`}
      </div>
      <footer>
        ${ui.action({
          label: type.isEvaluation ? (isEnglish() ? `Request ${trialDays}-day evaluation` : `Solicitar ${trialDays} días gratis`) : isOwned ? "Solicitar ampliación" : type.ctaLabel,
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

  function billingReturnMessage() {
    const status = new URLSearchParams(window.location.search).get("billing");
    if (status === "success") return isEnglish() ? "Subscription started. Your 14-day MAP-Nano trial is now active." : "Suscripci\u00f3n iniciada. Tus 14 d\u00edas de prueba de MAP-Nano ya est\u00e1n activos.";
    if (status === "cancelled") return isEnglish() ? "Checkout was cancelled; no charge was made." : "El checkout fue cancelado; no se realiz\u00f3 ning\u00fan cobro.";
    return "";
  }

  function commercialRequestStatus(request) {
    return contracts.commercialRequestStatus(request?.status);
  }

  function commercialRequestPlanName(planId) {
    const plan = planId === "project" ? mapNanoPlans.PROJECT_ACCESS : mapNanoPlans.planById(planId);
    return plan?.name || planId || "Plan MAP-Nano";
  }

  function commercialRequestTypeLabel(requestType) {
    if (isEnglish()) {
      return {
        new_license: "New license",
        upgrade: "Upgrade",
        institutional_quote: "Institutional quote",
        project_access: "Project access",
        demo: "Demonstration"
      }[requestType] || "Commercial request";
    }
    return {
      new_license: "Nueva licencia",
      upgrade: "Actualización",
      institutional_quote: "Cotización institucional",
      project_access: "Acceso por proyecto",
      demo: "Demostración"
    }[requestType] || "Solicitud comercial";
  }

  function renderMapNanoCommercialRequestItems(requests, limit = 5) {
    return requests.slice(0, limit).map(request => {
      const status = commercialRequestStatus(request);
      return `<article class="client-map-nano-request-item">
        <div><strong>${escapeHtml(commercialRequestPlanName(request.plan_key))}</strong><small>${escapeHtml(commercialRequestTypeLabel(request.request_type))} · ${escapeHtml(formatDate(request.created_at))}</small></div>
        <div class="client-map-nano-request-actions"><span class="client-license-tag ${escapeHtml(status.tone)}">${escapeHtml(status.label)}</span>${request.can_cancel ? `<button class="btn btn-ghost btn-compact" type="button" data-map-nano-commercial-cancel="${escapeHtml(request.request_id)}">Cancelar</button>` : ""}</div>
      </article>`;
    }).join("");
  }

  function renderMapNanoOpenCommercialRequests() {
    if (!commercialRequestsAvailable) return "";
    const openRequests = commercialRequests.filter(isOpenCommercialRequest);
    if (!openRequests.length) return "";
    return `<section class="client-map-nano-open-requests" aria-labelledby="map-nano-open-requests-title">
      <div class="client-license-subsection-head"><div><span class="client-license-subsection-kicker">Estado actual</span><h4 id="map-nano-open-requests-title">Solicitudes en curso</h4><p>Estos procesos siguen abiertos y tienen prioridad sobre un cambio nuevo.</p></div><span class="client-license-tag expiring">${openRequests.length}</span></div>
      <div class="client-map-nano-request-list">${renderMapNanoCommercialRequestItems(openRequests)}</div>
    </section>`;
  }

  function renderMapNanoCommercialRequestHistory() {
    if (!commercialRequestsAvailable) {
      return '<p class="client-map-nano-pending-note">El historial comercial no está disponible en este momento. Puedes continuar mediante el formulario de contacto.</p>';
    }
    if (!commercialRequests.length) return "";
    const requestCountLabel = isEnglish()
      ? `${commercialRequests.length} ${commercialRequests.length === 1 ? "request" : "requests"} recorded`
      : `${commercialRequests.length} solicitud${commercialRequests.length === 1 ? "" : "es"} registrada${commercialRequests.length === 1 ? "" : "s"}`;
    return `<details class="client-map-nano-request-history">
      <summary><span>${ui.icon("history", "sm")}<span><strong>Historial de solicitudes</strong><small>${requestCountLabel}</small></span></span><span class="client-license-disclosure-meta">${ui.icon("chevron-down", "sm")}</span></summary>
      <div class="client-map-nano-request-history-body"><p>Registro completo de solicitudes comerciales para esta cuenta o usuario.</p><div class="client-map-nano-request-list">${renderMapNanoCommercialRequestItems(commercialRequests, Infinity)}</div></div>
    </details>`;
  }

  function mapNanoPlanContext(productLicenses = dashboard.licenses.map(toLicenseViewModel).filter(item => item.product_key === "map.nano")) {
    const canManage = canManageMapNanoCommercialRequest(productLicenses);
    const activePlanIds = new Set(productLicenses
      .filter(item => ["active", "scheduled", "expiring"].includes(item.status))
      .map(item => mapNanoPlans.planIdForLicense(item))
      .filter(Boolean));
    return {
      canManage,
      activePlanIds,
      hasActivePlan: activePlanIds.size > 0,
      hasPreviousPlan: productLicenses.length > 0
    };
  }

  function renderMapNanoCommercialOptions(productLicenses) {
    const context = mapNanoPlanContext(productLicenses);
    return `<section class="client-license-options client-map-nano-commercial-options" aria-label="Planes de MAP-Nano">
      ${renderMapNanoOpenCommercialRequests()}
      ${renderMapNanoPlanChoices(context)}
      ${renderMapNanoCommercialRequestHistory()}
    </section>`;
  }

  function renderMapNanoPlanChoices(context) {
    const availablePlans = mapNanoPlans.PLANS.filter(plan => !context.activePlanIds.has(plan.id));
    if (context.hasActivePlan) {
      const label = isEnglish() ? "License options" : "Opciones de licencia";
      const title = isEnglish() ? "Change or expand plan" : "Cambiar o ampliar plan";
      const description = isEnglish()
        ? "Compare alternatives without losing sight of your current license. No change is applied automatically."
        : "Compara alternativas sin perder de vista tu licencia actual. Ningún cambio se aplica automáticamente.";
      const optionCount = `${availablePlans.length} ${isEnglish() ? "options" : "opciones"}`;
      return `<section class="client-map-nano-plan-launch" aria-labelledby="map-nano-plan-launch-title">
        <div class="client-map-nano-plan-launch-copy"><span class="client-map-nano-plan-launch-icon">${ui.icon("badge-plus", "sm")}</span><div><span class="client-license-subsection-kicker">${label}</span><h3 id="map-nano-plan-launch-title">${title}</h3><p>${description}</p></div></div>
        <div class="client-map-nano-plan-launch-action"><span class="client-license-tag">${optionCount}</span><button class="btn btn-ghost" type="button" data-client-license-plan-compare>${ui.icon("arrow-right", "xs")}${isEnglish() ? "Compare plans" : "Comparar planes"}</button></div>
      </section>`;
    }
    const optionsNote = context.hasPreviousPlan
      ? "Retoma MAP-Nano con tu plan anterior o elige una alternativa."
      : "Las solicitudes se revisan antes de emitir una licencia.";
    return `<section class="client-map-nano-plan-choices" aria-labelledby="map-nano-plan-choices-title">
      <div class="client-license-subsection-head"><div><span class="client-license-subsection-kicker">Planes disponibles</span><h3 id="map-nano-plan-choices-title">${context.hasPreviousPlan ? "Elige tu próximo plan" : "Elige tu plan"}</h3><p>${optionsNote}</p></div></div>
      ${renderMapNanoPlanChoiceContent(context, optionsNote)}
    </section>`;
  }

  function renderMapNanoPlanChoiceContent(context, optionsNote = "") {
    const availablePlans = mapNanoPlans.PLANS.filter(plan => !context.activePlanIds.has(plan.id));
    const note = optionsNote || (context.hasActivePlan
      ? (isEnglish()
        ? "Prices are for reference. We will send the scope and billing impact before applying the change."
        : "Los precios son de referencia. Enviaremos el alcance y el impacto de facturación antes de aplicar el cambio.")
      : (isEnglish() ? "Requests are reviewed before a license is issued." : "Las solicitudes se revisan antes de emitir una licencia."));
    return `${renderBillingIntervalSelector(context.canManage, context.hasActivePlan)}
      <div class="client-license-offer-grid client-map-nano-plan-grid">${availablePlans.map(plan => renderMapNanoPlanCard(plan, { canManage: context.canManage, activePlanIds: context.activePlanIds, hasLicense: context.hasActivePlan })).join("")}</div>
      <div class="client-map-nano-plan-footnote"><p>${note}</p><a href="${isEnglish() ? "/en/map-nano-pricing.html" : "/map-nano-pricing.html"}">Comparar planes en detalle${ui.icon("arrow-right", "xs")}</a></div>
      ${renderMapNanoProjectOption(context.canManage, context.hasActivePlan)}`;
  }

  function renderPlanComparisonLayer() {
    const context = mapNanoPlanContext();
    if (!context.hasActivePlan) return "";
    return `<dialog class="workspace-layer is-drawer client-license-plan-layer" data-client-license-plan-layer aria-labelledby="client-license-plan-layer-title">
      ${renderPlanComparisonPanel(context)}
    </dialog>`;
  }

  function renderPlanComparisonPanel(context) {
    const eyebrow = isEnglish() ? "License options" : "Opciones de licencia";
    const title = isEnglish() ? "Change or expand MAP-Nano" : "Cambiar o ampliar MAP-Nano";
    const description = isEnglish()
      ? "Your current plan remains active while you review alternatives."
      : "Tu plan actual permanece activo mientras revisas alternativas.";
    return `<section class="workspace-layer-panel client-license-plan-panel">
      <header class="workspace-layer-head"><div><span class="workspace-eyebrow">${eyebrow}</span><h2 id="client-license-plan-layer-title">${title}</h2><p>${description}</p></div>${closeLayerAction(isEnglish() ? "Close plan comparison" : "Cerrar comparación de planes")}</header>
      <div class="workspace-layer-body">
        ${renderMapNanoPlanChoiceContent(context)}
      </div>
    </section>`;
  }

  function refreshPlanComparisonLayer({ focusInterval = false } = {}) {
    const dialog = root?.querySelector("[data-client-license-plan-layer]");
    if (!dialog) return null;
    dialog.innerHTML = renderPlanComparisonPanel(mapNanoPlanContext());
    refreshIcons(dialog);
    window.BCCWorkspaceI18n?.localizeTree?.(dialog);
    if (focusInterval) dialog.querySelector(`[data-map-nano-billing-interval="${selectedBillingInterval}"]`)?.focus();
    return dialog;
  }

  function renderBillingIntervalSelector(canManage, hasActivePlan = false) {
    if (!canManage || !billingConfig.checkoutEnabled || !billingAvailable) return "";
    const option = (value, esLabel, enLabel) => `<button type="button" role="radio" aria-checked="${selectedBillingInterval === value}" class="client-map-nano-billing-option ${selectedBillingInterval === value ? "is-selected" : ""}" data-map-nano-billing-interval="${value}">${isEnglish() ? enLabel : esLabel}</button>`;
    const description = hasActivePlan
      ? (isEnglish() ? "Reference prices for available plans. We will confirm billing before applying a change." : "Precios de referencia para los planes disponibles. Confirmaremos la facturación antes de aplicar un cambio.")
      : (isEnglish() ? "14-day free trial. Card required; first charge after the trial." : "14 días de prueba. Tarjeta requerida; primer cobro al finalizar.");
    return `<div class="client-map-nano-billing-selector"><div><strong>${isEnglish() ? "View prices by period" : "Ver precios por periodo"}</strong><span>${description}</span></div><div class="client-map-nano-billing-options" role="radiogroup" aria-label="${isEnglish() ? "Billing period" : "Periodicidad de facturación"}">${option("month", "Mensual", "Monthly")}${option("year", "Anual · recomendado", "Annual · recommended")}</div></div>`;
  }

  function renderMapNanoPlanCard(plan, context) {
    const isCurrent = context.activePlanIds.has(plan.id);
    const requestType = mapNanoPlans.requestTypeForPlan(plan.id, { upgrade: context.hasLicense });
    const pending = pendingCommercialRequest(plan.id, requestType);
    const action = isCurrent
      ? ui.action({ label: "Plan actual", icon: "badge-check", className: "btn btn-ghost", disabled: true })
      : pending
        ? `<span class="client-map-nano-plan-pending">${isEnglish() ? `Request ${escapeHtml(commercialRequestStatus(pending).label.toLowerCase())} since ${escapeHtml(formatDate(pending.created_at))}` : `Solicitud ${escapeHtml(commercialRequestStatus(pending).label.toLowerCase())} desde ${escapeHtml(formatDate(pending.created_at))}`}</span>`
        : context.canManage
          ? context.hasLicense
            ? ui.action({ label: isEnglish() ? `Request change to ${plan.name}` : `Solicitar cambio a ${plan.name}`, icon: "arrow-up-right", className: plan.highlighted ? "btn btn-primary" : "btn btn-ghost", data: { mapNanoCommercialRequest: plan.id, mapNanoRequestType: requestType } })
            : canCheckoutPlan(plan)
              ? ui.action({ label: trialAvailable() ? (isEnglish() ? "Start 14-day trial" : "Probar 14 días") : (isEnglish() ? "Subscribe securely" : "Contratar de forma segura"), icon: "circle-dollar-sign", className: plan.highlighted ? "btn btn-primary" : "btn btn-ghost", data: { mapNanoCheckout: plan.id } })
              : ui.action({ label: plan.cta.label, icon: plan.id === "institutional" ? "messages-square" : "arrow-up-right", className: plan.highlighted ? "btn btn-primary" : "btn btn-ghost", data: { mapNanoCommercialRequest: plan.id, mapNanoRequestType: requestType } })
          : ui.action({ label: "Contactar al administrador", href: `${contactPath()}?product=map-nano&intent=license`, icon: "headset", className: "btn btn-ghost" });
    const limitText = mapNanoLimitText(plan);
    const kicker = plan.highlighted
      ? (canCheckoutPlan(plan) ? (isEnglish() ? "Flexible license" : "Licencia flexible") : (isEnglish() ? "Annual licensing" : "Licenciamiento anual"))
      : plan.badge || (canCheckoutPlan(plan) ? "Licencia flexible" : "Licenciamiento anual");
    return `<article class="client-license-offer-card client-map-nano-plan-card ${plan.highlighted ? "is-recommended" : ""} ${isCurrent ? "is-current" : ""}" aria-labelledby="map-nano-plan-${escapeHtml(plan.id)}">
      <div class="client-license-offer-card-head"><div class="client-license-offer-identity"><span class="client-license-offer-icon">${ui.icon(plan.id === "institutional" ? "building-2" : plan.id === "facility" ? "users" : "scan-line", "sm")}</span><div><span class="client-license-offer-kicker">${escapeHtml(kicker)}</span><h3 id="map-nano-plan-${escapeHtml(plan.id)}">${escapeHtml(plan.name)}</h3></div></div><div class="client-license-offer-badges">${isCurrent ? '<span class="client-license-tag active">Plan contratado</span>' : ""}${plan.highlighted ? '<span class="client-license-recommended-badge">Recomendado</span>' : ""}</div></div>
      <p>${escapeHtml(plan.description)}</p><div class="client-map-nano-plan-price"><strong>${escapeHtml(checkoutPriceLabel(plan))}</strong><span>${escapeHtml(checkoutPriceNote(plan, context.hasLicense))}</span></div>
      <p class="client-map-nano-plan-limits">${escapeHtml(limitText)}</p><ul class="client-license-offer-benefits">${plan.features.slice(0, 4).map(feature => `<li>${ui.icon("circle-check", "xs")}<span>${escapeHtml(feature)}</span></li>`).join("")}</ul>
      <footer>${action}${!context.canManage && !isCurrent ? '<small class="client-license-offer-assurance">Solo propietarios o administradores pueden solicitar cambios para una organización.</small>' : ""}</footer>
    </article>`;
  }
  function trialAvailable() {
    return !billingSubscriptions.some(subscription => Boolean(subscription.trial_end));
  }

  function checkoutPriceLabel(plan) {
    return canCheckoutPlan(plan) ? mapNanoPlans.intervalPriceLabel(plan, selectedBillingInterval) : mapNanoPlans.priceLabel(plan);
  }

  function checkoutPriceNote(plan, hasActivePlan = false) {
    if (!canCheckoutPlan(plan)) return mapNanoPlans.monthlyLabel(plan);
    if (hasActivePlan) {
      return selectedBillingInterval === "month"
        ? (isEnglish() ? "Monthly reference price" : "Precio mensual de referencia")
        : (isEnglish() ? "Annual reference price" : "Precio anual de referencia");
    }
    if (selectedBillingInterval === "month") return isEnglish() ? "14 days free · then billed monthly" : "14 días gratis · luego facturación mensual";
    const monthlyPrice = Number(plan.monthlyPrice);
    const annualPrice = Number(plan.annualPrice);
    const savings = Number.isFinite(monthlyPrice) && Number.isFinite(annualPrice) ? (monthlyPrice * 12) - annualPrice : 0;
    return savings > 0
      ? (isEnglish() ? `14 days free · save ${mapNanoPlans.formatUsd(savings)} per year` : `14 días gratis · ahorra ${mapNanoPlans.formatUsd(savings)} al año`)
      : (isEnglish() ? "14 days free · billed annually" : "14 días gratis · facturación anual");
  }
  function canCheckoutPlan(plan) {
    return Boolean(billingConfig.checkoutEnabled
      && billingAvailable
      && billingConfig.selfServePlans?.includes(plan.id));
  }

  function mapNanoLimitText(plan) {
    const limits = [];
    if (Number.isFinite(plan.limits?.namedUsers)) limits.push(`${plan.limits.namedUsers} usuario${plan.limits.namedUsers === 1 ? "" : "s"} nominativo${plan.limits.namedUsers === 1 ? "" : "s"}`);
    if (Number.isFinite(plan.limits?.concurrentUsers)) limits.push(`${plan.limits.concurrentUsers} concurrentes`);
    if (Number.isFinite(plan.limits?.installations)) limits.push(`${plan.limits.installations} instalaciones`);
    if (isEnglish()) {
      const englishLimits = [];
      if (Number.isFinite(plan.limits?.namedUsers)) englishLimits.push(`${plan.limits.namedUsers} named ${plan.limits.namedUsers === 1 ? "user" : "users"}`);
      if (Number.isFinite(plan.limits?.concurrentUsers)) englishLimits.push(`${plan.limits.concurrentUsers} concurrent users`);
      if (Number.isFinite(plan.limits?.installations)) englishLimits.push(`${plan.limits.installations} installations`);
      return englishLimits.length ? `Limits: ${englishLimits.join(" · ")}` : "Limits: defined in the proposal.";
    }
    return limits.length ? `Límites: ${limits.join(" · ")}` : "Límites: se definen según la propuesta.";
  }

  function renderMapNanoProjectOption(canManage, hasLicense) {
    const project = mapNanoPlans.PROJECT_ACCESS;
    const requestType = mapNanoPlans.requestTypeForPlan(project.id, { upgrade: hasLicense });
    const pending = pendingCommercialRequest(project.id, requestType);
    const action = pending
      ? `<span class="client-map-nano-plan-pending">${isEnglish() ? `Request ${escapeHtml(commercialRequestStatus(pending).label.toLowerCase())} since ${escapeHtml(formatDate(pending.created_at))}` : `Solicitud ${escapeHtml(commercialRequestStatus(pending).label.toLowerCase())} desde ${escapeHtml(formatDate(pending.created_at))}`}</span>`
      : canManage
        ? ui.action({ label: project.cta.label, icon: "clock-3", className: "btn btn-ghost", data: { mapNanoCommercialRequest: project.id, mapNanoRequestType: requestType } })
        : ui.action({ label: "Contactar soporte", href: mapNanoPlans.requestUrl(project.id), icon: "headset", className: "btn btn-ghost" });
    return `<article class="client-map-nano-project-option">
      <div class="client-map-nano-project-copy"><span class="client-map-nano-project-mark" aria-hidden="true">${ui.icon("clock-3", "sm")}</span><div><span class="workspace-eyebrow">Alternativa por proyecto</span><h3>${escapeHtml(project.name)}</h3><p>${escapeHtml(project.description)}</p></div></div>
      <div class="client-map-nano-project-action"><strong>${escapeHtml(mapNanoPlans.projectPriceLabel(project))}</strong>${action}</div>
    </article>`;
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
    const license = contracts.attentionLicense(dashboard.licenses.map(toLicenseViewModel));
    if (!license) return "";
    const copy = license.status === "expiring"
      ? isEnglish()
        ? `Your ${license.productName} license expires on ${formatDate(license.ends_at)}. Arrange renewal to avoid interruption.`
        : `Tu licencia ${license.productName} vence el ${formatDate(license.ends_at)}. Coordina la renovación para evitar interrupciones.`
      : isEnglish()
        ? `Your ${license.productName} license is ${license.statusMeta.label.toLowerCase()}. Review your options with your administrator or support.`
        : `Tu licencia ${license.productName} está ${license.statusMeta.label.toLowerCase()}. Revisa las opciones con tu administrador o soporte.`;
    return `<aside class="client-license-attention" data-tone="${escapeHtml(license.statusMeta.tone)}">${ui.icon(license.statusMeta.icon, "md")}<div><strong>Requiere atención</strong><span>${escapeHtml(copy)}</span></div><a class="btn btn-ghost btn-compact" href="${contactPath()}">Contactar soporte</a></aside>`;
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
    const state = seatManagement.licenseId === selected.license_id
      ? seatManagement
      : { ...emptySeatManagement(selected.license_id), loading: true, assignedSeats: selected.assignedSeats, seatLimit: selected.seatLimit };
    const assignments = state.assignments;
    const candidates = state.candidates;
    const assignedSeats = state.seatLimit ? state.assignedSeats : selected.assignedSeats;
    const seatLimit = state.seatLimit || selected.seatLimit;
    const isFull = assignedSeats >= seatLimit;
    const normalizedQuery = state.query.trim().toLowerCase();
    const selectedCandidate = candidates.find(item => item.user_id === state.selectedUserId)
      || candidates.find(item => String(item.email || "").toLowerCase() === normalizedQuery)
      || null;
    const controlsDisabled = state.loading || isFull || !selectedCandidate || busy;
    const capacityLabel = isEnglish()
      ? `${assignedSeats} of ${seatLimit} ${seatLimit === 1 ? "seat" : "seats"}`
      : `${assignedSeats} de ${seatLimit} ${seatLimit === 1 ? "plaza" : "plazas"}`;
    const candidateStatus = state.loading
      ? "Buscando miembros…"
      : selectedCandidate
        ? isEnglish()
          ? `Ready to assign ${selectedCandidate.display_name || selectedCandidate.email}.`
          : `Listo para asignar a ${selectedCandidate.display_name || selectedCandidate.email}.`
        : normalizedQuery
          ? isEnglish()
            ? `${state.candidateMatches} ${state.candidateMatches === 1 ? "member found" : "members found"}. Select an email from the suggestions.`
            : `${state.candidateMatches} ${state.candidateMatches === 1 ? "miembro encontrado" : "miembros encontrados"}. Selecciona un correo de las sugerencias.`
          : isEnglish()
            ? "Enter a name or email and select a suggestion."
            : "Escribe un nombre o correo y selecciona una sugerencia.";
    const feedbackMessage = state.error || seatManagementFeedback.message;
    const feedbackTone = state.error ? "error" : seatManagementFeedback.tone;
    const hasReleasableAssignments = assignments.some(item => item.can_release && !item.is_evaluation && !item.is_mine) && assignedSeats > 1;
    const assignmentHelp = hasReleasableAssignments
      ? (isFull ? "Libera una plaza para habilitar una nueva asignación." : "Revisa y libera accesos que ya no se utilizan.")
      : assignedSeats <= 1
        ? "La plaza principal no puede liberarse sin asignar un reemplazo."
        : "Tu plaza administradora está protegida; puedes gestionar las demás plazas.";
    const assignmentSection = `<section class="client-license-layer-section" aria-labelledby="client-license-assigned-title">
      <div class="client-license-card-head"><div><h3 id="client-license-assigned-title">Plazas asignadas</h3><p>${assignmentHelp}</p></div></div>
      ${assignments.length ? `<div class="client-license-assignment-list">${assignments.map(item => renderAssignment(item, assignedSeats)).join("")}</div>` : state.loading ? '<div class="client-license-seat-loading">Cargando plazas asignadas…</div>' : ui.emptyState({
        className: "client-license-empty is-compact",
        icon: "users",
        title: "No hay plazas asignadas.",
        description: "Usa el buscador para activar el acceso de un miembro."
      })}
      ${state.assignmentMatches > assignments.length ? `<p class="client-license-result-limit">${isEnglish() ? `Showing ${assignments.length} of ${state.assignmentMatches} assignments.` : `Mostrando ${assignments.length} de ${state.assignmentMatches} asignaciones.`}</p>` : ""}
    </section>`;
    const assignmentForm = `<section class="client-license-assign-section" aria-labelledby="client-license-assign-title">
      <div><h3 id="client-license-assign-title">Asignar una plaza</h3><p>Busca a una persona que ya pertenezca a esta organización.</p></div>
      <form class="client-license-form" data-client-license-assign-form>
        <input type="hidden" name="licenseId" value="${escapeHtml(selected.license_id)}">
        <input type="hidden" name="userId" value="${escapeHtml(selectedCandidate?.user_id || "")}" data-client-license-selected-user>
        <label>Miembro
          <input type="search" name="memberQuery" list="client-license-candidate-options" value="${escapeHtml(state.query)}" placeholder="Nombre o correo" autocomplete="off" data-client-license-seat-search aria-describedby="client-license-seat-search-status">
          <datalist id="client-license-candidate-options">${candidates.map(item => `<option value="${escapeHtml(item.email || item.display_name)}" label="${escapeHtml(item.display_name || item.email)}"></option>`).join("")}</datalist>
        </label>
        <p class="client-license-search-status" id="client-license-seat-search-status" aria-live="polite">${escapeHtml(candidateStatus)}</p>
        ${state.candidateMatches > candidates.length ? `<p class="client-license-result-limit">${isEnglish() ? `Showing ${candidates.length} of ${state.candidateMatches} available members. Refine the search to see others.` : `Mostrando ${candidates.length} de ${state.candidateMatches} miembros disponibles. Refina la búsqueda para ver otros.`}</p>` : ""}
        <button class="btn btn-primary" type="submit" data-client-license-control data-idle-disabled="${controlsDisabled ? "true" : "false"}" ${controlsDisabled ? "disabled" : ""}>Asignar plaza</button>
      </form>
      <p class="client-license-member-request">¿La persona no aparece? <a href="${contactPath()}?intent=member">Solicitar alta de miembro</a></p>
    </section>`;
    return `<section class="workspace-layer-panel client-license-management-panel">
      <header class="workspace-layer-head client-license-management-head"><div><span class="workspace-eyebrow">Administración</span><h2 id="client-license-management-title">Plazas de ${escapeHtml(productName(selected.product_key))}</h2><p>${escapeHtml(selected.account_name)}</p><span class="client-license-capacity-chip" data-tone="${isFull ? "full" : "available"}">${escapeHtml(capacityLabel)}</span></div>${closeLayerAction("Cerrar gestión de plazas")}</header>
      <div class="workspace-layer-body">
        ${manageable.length > 1 ? `<label class="client-license-layer-select">Licencia
          <select data-client-license-select>${manageable.map(item => `<option value="${escapeHtml(item.license_id)}" ${item.license_id === selected.license_id ? "selected" : ""}>${escapeHtml(productName(item.product_key))} · ${escapeHtml(item.account_name)}</option>`).join("")}</select>
        </label>` : ""}
        ${feedbackMessage ? `<p class="client-license-seat-feedback" data-tone="${escapeHtml(feedbackTone)}" role="status" aria-live="polite">${escapeHtml(feedbackMessage)}</p>` : ""}
        ${isFull ? `<aside class="client-license-capacity-notice">${ui.icon("info", "sm")}<span><strong>Licencia sin plazas disponibles.</strong> ${hasReleasableAssignments ? "Libera una plaza para asignar otro miembro." : "La plaza principal está protegida; amplía el plan para añadir otro miembro."}</span></aside>` : ""}
        ${isFull ? assignmentSection : `${assignmentForm}${assignmentSection}`}
        ${isFull ? `<a class="btn btn-ghost" href="${contactPath()}?intent=license">Necesito ampliar el número de plazas</a>` : ""}
      </div>
    </section>`;
  }
  function refreshSeatManagementLayer({ focusSelect = false, focusSearch = false } = {}) {
    const dialog = root?.querySelector("[data-client-license-management-layer]");
    const selected = selectedManageableLicense();
    if (!dialog || !selected) return;
    dialog.innerHTML = renderSeatManagementPanel(selected);
    refreshIcons(dialog);
    window.BCCWorkspaceI18n?.localizeTree?.(dialog);
    if (focusSelect) dialog.querySelector("[data-client-license-select]")?.focus();
    if (focusSearch) {
      const search = dialog.querySelector("[data-client-license-seat-search]");
      search?.focus();
      search?.setSelectionRange(search.value.length, search.value.length);
    }
  }

  function setSeatManagementFeedback(message, tone = "neutral", { refresh = true } = {}) {
    seatManagementFeedback = { message, tone };
    if (refresh) refreshSeatManagementLayer();
  }

  async function loadSeatManagement({ query = seatManagement.query, focusSearch = false, focusSelect = false } = {}) {
    const selected = selectedManageableLicense();
    if (!selected) return;
    const requestId = ++seatManagementRequestId;
    const previous = seatManagement.licenseId === selected.license_id
      ? seatManagement
      : emptySeatManagement(selected.license_id, query);
    seatManagement = {
      ...previous,
      licenseId: selected.license_id,
      query,
      loading: true,
      error: "",
      assignedSeats: previous.seatLimit ? previous.assignedSeats : selected.assignedSeats,
      seatLimit: previous.seatLimit || selected.seatLimit
    };
    refreshSeatManagementLayer({ focusSearch, focusSelect });
    try {
      const payload = await repository.getSeatManagement(selected.license_id, query);
      if (requestId !== seatManagementRequestId || selected.license_id !== selectedLicenseId) return;
      const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
      const normalizedQuery = query.trim().toLowerCase();
      const selectedUserId = candidates.some(item => item.user_id === previous.selectedUserId)
        ? previous.selectedUserId
        : candidates.find(item => String(item.email || "").toLowerCase() === normalizedQuery)?.user_id || "";
      seatManagement = {
        licenseId: selected.license_id,
        query,
        loading: false,
        error: "",
        assignedSeats: Number(payload?.assigned_seats) || 0,
        seatLimit: Number(payload?.seat_limit) || selected.seatLimit,
        assignmentMatches: Number(payload?.assignment_matches) || 0,
        candidateMatches: Number(payload?.candidate_matches) || 0,
        selectedUserId,
        assignments: Array.isArray(payload?.assignments) ? payload.assignments : [],
        candidates
      };
    } catch (error) {
      if (requestId !== seatManagementRequestId) return;
      seatManagement = {
        ...seatManagement,
        loading: false,
        error: userMessage(error)
      };
    }
    refreshSeatManagementLayer({ focusSearch, focusSelect });
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

  function renderAssignment(item, assignedSeats) {
    const isProtected = item.is_mine || assignedSeats <= 1 || item.release_block_reason;
    const canRelease = item.can_release && !item.is_evaluation && !isProtected;
    const seatLabel = item.is_mine
      ? (isEnglish() ? "You · primary seat" : "Tú · plaza principal")
      : isProtected
        ? (isEnglish() ? "Protected seat" : "Plaza protegida")
        : "";
    return `<div class="client-license-assignment">
      <div><strong>${escapeHtml(item.display_name || item.email)}</strong><small>${escapeHtml(item.email)} · ${isEnglish() ? `assigned ${formatDate(item.assigned_at)}` : `asignada ${formatDate(item.assigned_at)}`}</small></div>
      <div class="client-license-assignment-actions">
        ${seatLabel ? `<span class="client-license-tag">${escapeHtml(seatLabel)}</span>` : ""}
        ${canRelease ? `<button class="btn btn-ghost btn-compact" type="button" data-client-license-release="${escapeHtml(item.assignment_id)}" data-client-license-control ${busy ? "disabled" : ""}>Liberar</button>` : ""}
      </div>
    </div>`;
  }

  function renderActivity() {
    if (!dashboard.recent_events.length) return "";
    const latestActivity = [...dashboard.recent_events]
      .map(event => event.occurred_at)
      .filter(Boolean)
      .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0];
    const activitySummary = latestActivity
      ? (isEnglish()
        ? `${dashboard.recent_events.length} movement(s) · latest ${formatDateTime(latestActivity)}`
        : `${dashboard.recent_events.length} movimiento(s) · último ${formatDateTime(latestActivity)}`)
      : (isEnglish()
        ? `${dashboard.recent_events.length} seat movement(s)`
        : `${dashboard.recent_events.length} movimiento(s) de plazas`);
    return `<details class="module-surface client-license-activity-disclosure">
      <summary><span>${ui.icon("history", "sm")}<span><strong>Actividad reciente</strong><small>${escapeHtml(activitySummary)}</small></span></span>${ui.icon("chevron-down", "sm")}</summary>
      <div class="client-license-activity-intro">Registro de asignaciones y liberaciones realizadas desde el autoservicio.</div>
      <div class="client-license-activity-list">${dashboard.recent_events.map(event => {
        const member = dashboard.members.find(item => item.user_id === event.subject_user_id);
        const isCurrentUser = event.subject_user_id === currentUser?.id;
        const subject = event.subject_name || member?.display_name || event.subject_email || (isCurrentUser ? "Tu usuario" : "Usuario de la cuenta");
        const action = event.event_type === "seat_assigned" ? "Plaza asignada" : "Plaza liberada";
        return `<div class="client-license-activity-item"><div><strong>${action}</strong><small>${escapeHtml(subject)} · ${escapeHtml(productName(event.details?.product_key))}</small></div><time datetime="${escapeHtml(event.occurred_at || "")}">${formatDateTime(event.occurred_at)}</time></div>`;
      }).join("")}</div>
    </details>`;
  }

  function handleChange(event) {
    const select = event.target.closest("[data-client-license-select]");
    if (!select) return;
    selectedLicenseId = select.value;
    seatManagement = emptySeatManagement(selectedLicenseId);
    seatManagementFeedback = emptySeatManagementFeedback();
    void loadSeatManagement({ focusSelect: true });
  }

  function handleInput(event) {
    const search = event.target.closest("[data-client-license-seat-search]");
    if (!search) return;
    window.clearTimeout(seatSearchTimer);
    const query = search.value;
    const normalizedQuery = query.trim().toLowerCase();
    const selectedCandidate = seatManagement.candidates.find(item => String(item.email || "").toLowerCase() === normalizedQuery) || null;
    seatManagement = { ...seatManagement, query, selectedUserId: selectedCandidate?.user_id || "" };
    seatManagementFeedback = emptySeatManagementFeedback();
    const form = search.closest("[data-client-license-assign-form]");
    const selectedUser = form?.querySelector("[data-client-license-selected-user]");
    const submit = form?.querySelector('[type="submit"]');
    if (selectedUser) selectedUser.value = selectedCandidate?.user_id || "";
    if (submit) {
      submit.disabled = !selectedCandidate || busy;
      submit.dataset.idleDisabled = selectedCandidate ? "false" : "true";
    }
    seatSearchTimer = window.setTimeout(() => {
      void loadSeatManagement({ query, focusSearch: true });
    }, 250);
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
    if (!values.licenseId || busy) return;
    if (!values.userId) {
      setSeatManagementFeedback("Selecciona un correo de las sugerencias antes de asignar la plaza.", "error");
      refreshSeatManagementLayer({ focusSearch: true });
      return;
    }
    if (seatManagement.licenseId === values.licenseId && seatManagement.assignedSeats >= seatManagement.seatLimit) {
      setSeatManagementFeedback("Esta licencia ya no tiene plazas disponibles.", "error");
      return;
    }
    setBusy(true);
    setSeatManagementFeedback("Asignando la plaza…", "neutral");
    try {
      await repository.assignSeat(values.licenseId, values.userId);
      await reloadDashboardData("La plaza fue asignada correctamente.");
      await loadSeatManagement({ query: "" });
      setSeatManagementFeedback("La plaza fue asignada correctamente.", "ok");
    } catch (error) {
      setBusy(false);
      setSeatManagementFeedback(userMessage(error), "error");
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
    window.BCCWorkspaceI18n?.localizeTree?.(root.querySelector(".client-license-suite"));
    if (focus) root.querySelector('[data-client-suite-product][aria-selected="true"]')?.focus();
  }

  async function handleClick(event) {
    const suiteTab = event.target.closest("[data-client-suite-product]");
    if (suiteTab) {
      activateSuiteProduct(suiteTab.dataset.clientSuiteProduct, { focus: true });
      return;
    }
    const disclosureSummary = event.target.closest(".client-license-secondary-disclosure > summary, .client-license-activity-disclosure > summary");
    if (disclosureSummary) {
      const disclosure = disclosureSummary.parentElement;
      if (!disclosure.open) {
        root.querySelectorAll(".client-license-secondary-disclosure[open], .client-license-activity-disclosure[open]").forEach(item => {
          if (item !== disclosure) item.open = false;
        });
      }
      return;
    }
    const closeButton = event.target.closest("[data-client-license-close-layer]");
    if (closeButton) {
      ui.closeLayer(closeButton.closest("dialog"));
      return;
    }
    const planCompareButton = event.target.closest("[data-client-license-plan-compare]");
    if (planCompareButton) {
      const dialog = root.querySelector("[data-client-license-plan-layer]");
      ui.openLayer(dialog, { trigger: planCompareButton });
      return;
    }
    const manageButton = event.target.closest("[data-client-license-manage]");
    if (manageButton) {
      selectedLicenseId = manageButton.dataset.clientLicenseManage;
      seatManagement = emptySeatManagement(selectedLicenseId);
      seatManagementFeedback = emptySeatManagementFeedback();
      refreshSeatManagementLayer();
      const dialog = root.querySelector("[data-client-license-management-layer]");
      const search = dialog?.querySelector("[data-client-license-seat-search]");
      ui.openLayer(dialog, search ? { trigger: manageButton, focusTarget: search } : { trigger: manageButton });
      void loadSeatManagement({ focusSearch: Boolean(search) });
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
    const billingIntervalButton = event.target.closest("[data-map-nano-billing-interval]");
    if (billingIntervalButton && !busy) {
      selectedBillingInterval = billingIntervalButton.dataset.mapNanoBillingInterval === "month" ? "month" : "year";
      if (billingIntervalButton.closest("[data-client-license-plan-layer]")) {
        refreshPlanComparisonLayer({ focusInterval: true });
      } else {
        render();
      }
      return;
    }
    const billingPortalButton = event.target.closest("[data-map-nano-billing-portal]");
    if (billingPortalButton && !busy) {
      setBusy(true);
      setMessage(isEnglish() ? "Opening billing portal..." : "Abriendo el portal de facturaci\u00f3n...");
      try {
        const portal = await repository.createBillingPortalSession(billingPortalButton.dataset.mapNanoBillingPortal);
        if (!portal?.url || !/^https:\/\/billing\.stripe\.com\//i.test(portal.url)) throw new Error("Invalid billing portal URL");
        trackCommercialPlan("billing_portal_opened");
        window.location.assign(portal.url);
      } catch (error) {
        setBusy(false);
        setMessage(userMessage(error), "error");
      }
      return;
    }
    const checkoutButton = event.target.closest("[data-map-nano-checkout]");
    if (checkoutButton && !busy) {
      const planId = checkoutButton.dataset.mapNanoCheckout;
      const planContext = mapNanoPlanContext();
      if (planContext.hasActivePlan) {
        setMessage(isEnglish()
          ? "Your current license remains active. Use the plan-change request to avoid creating a second subscription."
          : "Tu licencia actual permanece activa. Usa la solicitud de cambio para evitar crear una segunda suscripción.", "error");
        return;
      }
      const plan = mapNanoPlans.planById(planId);
      if (!plan || !canCheckoutPlan(plan)) {
        setMessage("El checkout seguro todav\u00eda no est\u00e1 disponible para este plan.", "error");
        return;
      }
      setBusy(true);
      setMessage(isEnglish() ? "Opening secure checkout..." : "Abriendo checkout seguro...");
      try {
        const checkout = await repository.createCheckoutSession({
          accountId: mapNanoCommercialAccountId(),
          planKey: planId,
          billingInterval: selectedBillingInterval,
          requestId: window.crypto.randomUUID()
        });
        if (!checkout?.url || !/^https:\/\/checkout\.stripe\.com\//i.test(checkout.url)) throw new Error("Invalid checkout URL");
        trackCommercialPlan("checkout_started", { planId, requestType: "new_license", billingInterval: selectedBillingInterval });
        window.location.assign(checkout.url);
      } catch (error) {
        setBusy(false);
        setMessage(userMessage(error), "error");
      }
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
      const planDialog = commercialRequestButton.closest("[data-client-license-plan-layer]");
      const requestTrigger = planDialog?.open
        ? root.querySelector("[data-client-license-plan-compare]")
        : commercialRequestButton;
      if (planDialog?.open) ui.closeLayer(planDialog);
      const dialog = refreshCommercialRequestLayer();
      ui.openLayer(dialog, { trigger: requestTrigger || commercialRequestButton });
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
    const releaseButton = event.target.closest("[data-client-license-release]");
    if (!releaseButton || busy) return;
    const confirmed = await ui.confirmAction({
      title: "Liberar plaza MAP",
      description: "El usuario perderá el acceso asociado a esta licencia. La plaza quedará disponible inmediatamente.",
      confirmLabel: "Liberar plaza"
    });
    if (!confirmed) return;
    setBusy(true);
    setSeatManagementFeedback("Liberando la plaza…", "neutral");
    try {
      await repository.releaseSeat(releaseButton.dataset.clientLicenseRelease);
      await reloadDashboardData("La plaza fue liberada correctamente.");
      await loadSeatManagement({ query: "" });
      setSeatManagementFeedback("La plaza fue liberada correctamente.", "ok");
    } catch (error) {
      setBusy(false);
      setSeatManagementFeedback(userMessage(error), "error");
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
      billingSubscriptions = payload.billingSubscriptions || [];
      billingAvailable = Boolean(payload.billingAvailable);
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
      feedback.textContent = localize("El registro comercial no está disponible ahora. Usa el enlace de contacto alternativo.");
      feedback.dataset.tone = "error";
      requestBusy = false;
      return;
    }
    if (isMapNanoCommercial && pendingCommercialRequest(commercialPlanId, requestType)) {
      feedback.textContent = localize("Ya existe una solicitud comercial abierta para este plan. Puedes cancelarla desde tu historial antes de enviar otra.");
      feedback.dataset.tone = "error";
      requestBusy = false;
      return;
    }
    trackLicenseFunnel("map_license_request_submit", funnelMetadata);
    if (isMapNanoCommercial) trackCommercialPlan("quote_requested", { planId: commercialPlanId, requestType });
    submit.disabled = true;
    submit.textContent = localize("Enviando...");
    feedback.textContent = localize("Enviando tu solicitud...");
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
      feedback.textContent = localize(isMapNanoCommercial
        ? "No pudimos registrar la solicitud. Usa el enlace de contacto alternativo."
        : "No pudimos enviar la solicitud. Usa el enlace de contacto alternativo.");
      feedback.dataset.tone = "error";
    } finally {
      requestBusy = false;
      submit.disabled = false;
      submit.textContent = localize(submit.dataset.idleLabel || (isEvaluation ? "Solicitar prueba" : "Enviar solicitud"));
    }
  }

  function setBusy(value) {
    busy = Boolean(value);
    ui.setBusy(root, busy, {
      selector: "[data-client-license-control]",
      label: localize("Actualizando licencias MAP")
    });
  }

  function setMessage(message, tone = "neutral") {
    ui.feedback(root?.querySelector("[data-client-license-message]"), localize(message), tone);
  }

  function roleLabel(value) {
    if (isEnglish()) return ({ owner: "Owner", admin: "Administrator", member: "Member" })[value] || "Member";
    return ({ owner: "Propietario", admin: "Administrador", member: "Miembro" })[value] || "Miembro";
  }

  function productName(key) {
    return contracts.productName(key).replace(/^MAP (Nano|Bio|Med)$/u, "MAP-$1");
  }

  function toLicenseViewModel(license) {
    return contracts.toLicenseViewModel(license, Date.now(), billingSubscriptionForLicense(license));
  }

  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString(isEnglish() ? "en-US" : "es-DO", { day: "2-digit", month: "short", year: "numeric" });
  }

  function formatDateTime(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString(isEnglish() ? "en-US" : "es-DO", { dateStyle: "medium", timeStyle: "short" });
  }

  function userMessage(error) {
    return localize(contracts.toError(error).message);
  }

  window.BCCWorkspaceClientMapLicenses = { init };
})();
