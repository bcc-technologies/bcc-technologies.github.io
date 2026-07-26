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
  let selectedSuiteProductKey = "";
  let selectedRequestProductKey = "map.nano";
  let selectedRequestLicenseType = "named_user";
  let requestBusy = false;
  let platformAccess = [];
  let internalEntitlements = [];
  let trialOffer = contracts.TRIAL_OFFER_FALLBACK;
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
    root.addEventListener("keydown", handleKeydown);
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
      trialOffer = contracts.normalizeTrialOffer(payload.trialOffer);
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
          className: "module-surface client-license-hero",
          actionsClassName: "client-license-actions",
          eyebrow: "MAP Platform",
          title: "MAPs",
          level: 1,
          description: "Consulta tu acceso, amplía la suite y administra las plazas de tu organización desde un solo lugar.",
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
    const activeCount = licenses.filter(item => ["active", "scheduled", "expiring"].includes(item.status)).length;
    const selectedLicenses = licenses
      .filter(item => item.product_key === selectedSuiteProductKey)
      .sort((a, b) => a.statusMeta.priority - b.statusMeta.priority);

    return `<section class="client-license-suite" id="suite-map">
      ${ui.sectionHeader({
        className: "client-license-section-head",
        eyebrow: "Tu acceso y catálogo",
        title: "Tu suite MAP",
        description: "Elige un producto para consultar tu acceso y comparar las modalidades de licencia disponibles.",
        status: activeCount
          ? { label: `${activeCount} acceso(s) vigente(s)`, status: "success", icon: "check-circle-2" }
          : { label: "Cotización personalizada", status: "neutral", icon: "badge-plus" }
      })}
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
      <header class="module-surface client-license-product-overview">
        <span class="client-license-product-icon">${ui.icon(product.icon, "lg")}</span>
        <div>
          <span class="workspace-eyebrow">${escapeHtml(product.category)}</span>
          <h2>${escapeHtml(productName(key))}</h2>
          <p>${escapeHtml(product.description)}</p>
        </div>
        <a class="btn btn-ghost btn-compact" href="${escapeHtml(product.productHref)}">Conocer producto</a>
      </header>
      ${renderCurrentProductAccess(key, product, productLicenses)}
      ${renderLicenseOptions(key, productLicenses)}
    </div>`;
  }

  function renderCurrentProductAccess(key, product, productLicenses) {
    if (!productLicenses.length) {
      return `<aside class="client-license-no-access">${ui.icon("info", "sm")}<span><strong>Aún no tienes acceso a ${escapeHtml(productName(key))}.</strong><small>Puedes comparar las modalidades disponibles a continuación.</small></span></aside>`;
    }
    return `<section class="client-license-current-access" aria-labelledby="current-access-${productDomId(key)}">
      <div class="client-license-subsection-head">
        <div><span class="workspace-eyebrow">Acceso asociado</span><h3 id="current-access-${productDomId(key)}">Tu acceso actual</h3></div>
        <span class="client-license-tag">${productLicenses.length} licencia(s)</span>
      </div>
      <div class="client-license-current-grid">${productLicenses.map(item => renderCurrentAccessCard(product, item)).join("")}</div>
    </section>`;
  }

  function renderCurrentAccessCard(product, item) {
    return `<article class="client-license-current-card">
      <div class="client-license-current-card-head">
        <div><strong>${escapeHtml(contracts.licenseType(item.license_type)?.label || item.plan_name || "Licencia MAP")}</strong><small>${escapeHtml(item.account_name || "Cuenta MAP")}</small></div>
        <span class="client-license-tag ${escapeHtml(item.status)}">${ui.icon(item.statusMeta.icon, "xs")}${escapeHtml(item.statusMeta.label)}</span>
      </div>
      <dl class="client-license-access-facts">
        <div><dt>Vigencia</dt><dd>${item.ends_at ? `Hasta ${formatDate(item.ends_at)}` : "Sin vencimiento"}</dd></div>
        <div><dt>Modalidad</dt><dd>${escapeHtml(contracts.licenseType(item.license_type)?.shortLabel || (item.is_evaluation ? "Evaluación" : roleLabel(item.member_role)))}</dd></div>
      </dl>
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
    const types = contracts.productLicenseTypes(key);
    if (!types.length) return "";
    const ownedTypes = new Set(productLicenses.map(item => item.license_type));
    return `<section class="client-license-options" aria-labelledby="license-options-${productDomId(key)}">
      <div class="client-license-subsection-head">
        <div><span class="workspace-eyebrow">Modalidades disponibles</span><h3 id="license-options-${productDomId(key)}">Elige el tipo de licencia</h3><p>La activación y la cotización se ajustan al alcance de tu proyecto.</p></div>
      </div>
      <div class="client-license-offer-grid">${types.map(type => renderLicenseOfferCard(key, type, ownedTypes.has(type.key))).join("")}</div>
    </section>`;
  }

  function renderLicenseOfferCard(key, type, isOwned) {
    const trialDays = trialOffer.duration_days;
    const trialCampaign = trialOffer.is_campaign;
    return `<article class="client-license-offer-card ${type.recommended ? "is-recommended" : ""} ${type.isEvaluation ? "is-evaluation" : ""}">
      <div class="client-license-offer-card-head">
        <span class="client-license-offer-icon">${ui.icon(type.icon, "md")}</span>
        <div class="client-license-badges">
          ${type.recommended ? '<span class="client-license-tag active">Recomendada para equipos</span>' : ""}
          ${type.isEvaluation ? `<span class="client-license-tag active">${escapeHtml(trialOffer.display_name)} · ${trialDays} días</span>` : ""}
          ${isOwned ? '<span class="client-license-tag active">Ya tienes esta modalidad</span>' : ""}
        </div>
      </div>
      <div><span class="workspace-eyebrow">${escapeHtml(type.eyebrow)}</span><h4>${escapeHtml(type.label)}</h4><p>${escapeHtml(type.description)}</p></div>
      ${type.isEvaluation ? `<div class="client-license-trial-duration"><strong>${trialDays}</strong><span>días gratis<small>${trialCampaign ? `Early access · luego ${trialOffer.standard_days} días` : "Prueba estándar"}</small></span></div>` : ""}
      <div class="client-license-offer-meta"><span>${ui.icon("users", "xs")}${escapeHtml(type.seatLabel)}</span><span>${ui.icon("calendar-clock", "xs")}${escapeHtml(type.isEvaluation ? `${trialDays} días` : type.durationLabel)}</span></div>
      <ul class="client-license-feature-list">${type.features.map(feature => `<li>${ui.icon("circle-check", "xs")}<span>${escapeHtml(feature)}</span></li>`).join("")}</ul>
      <footer>
        ${ui.action({
          label: type.isEvaluation ? `Probar gratis ${trialDays} días` : isOwned ? "Solicitar ampliación" : type.ctaLabel,
          icon: type.isEvaluation ? "flask-conical" : "badge-plus",
          className: type.recommended ? "btn btn-primary" : "btn btn-ghost",
          data: { clientLicenseRequest: key, clientLicenseType: type.key }
        })}
        <small>${type.isEvaluation ? "Sin costo. Activación coordinada por BCC." : "Cotización personalizada, sin cobro inmediato."}</small>
      </footer>
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
    const key = contracts.PRODUCT_CATALOG[selectedRequestProductKey] ? selectedRequestProductKey : "map.nano";
    const product = contracts.productCatalog(key);
    const allowedTypes = product.licenseTypes || [];
    const typeKey = allowedTypes.includes(selectedRequestLicenseType) ? selectedRequestLicenseType : allowedTypes[0] || "named_user";
    const type = contracts.licenseType(typeKey);
    const requestIntro = type.isEvaluation
      ? `Activa ${trialOffer.duration_days} días gratis durante ${trialOffer.display_name}. La prueba estándar será de ${trialOffer.standard_days} días.`
      : "Cuéntanos el alcance para preparar una recomendación y cotización útil.";
    return `<dialog class="workspace-layer is-drawer" data-client-license-request-layer aria-labelledby="client-license-request-title">
      <form class="workspace-layer-panel client-license-request-form" data-client-license-request-form>
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
          <div class="client-license-form-row">
            <label>Plazas estimadas
              <input type="number" name="seats" min="${type.defaultSeatLimit}" max="10000" value="${type.defaultSeatLimit}" ${type.defaultSeatLimit === 1 ? "readonly" : ""} required>
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
          </label>
          <p class="client-license-request-feedback" data-client-license-request-feedback role="status" aria-live="polite"></p>
          <p class="client-license-request-fallback">Si tienes problemas al enviar, <a href="${escapeHtml(product.requestHref + `&license_type=${encodeURIComponent(typeKey)}`)}">continúa en el formulario de contacto</a>.</p>
        </div>
        <footer class="workspace-layer-actions">
          <button class="btn btn-ghost" type="button" data-client-license-close-layer>Cancelar</button>
          <button class="btn btn-primary" type="submit" data-client-license-request-submit>Enviar solicitud</button>
        </footer>
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
    selectedSuiteProductKey = key;
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
      selectedRequestProductKey = requestButton.dataset.clientLicenseRequest;
      selectedRequestLicenseType = requestButton.dataset.clientLicenseType || "named_user";
      const dialog = refreshCommercialRequestLayer();
      ui.openLayer(dialog, { trigger: requestButton });
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
      internalEntitlements = payload.entitlements;
      trialOffer = contracts.normalizeTrialOffer(payload.trialOffer);
      dashboard = payload.dashboard;
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
    submit.disabled = true;
    submit.textContent = "Enviando...";
    feedback.textContent = "Enviando tu solicitud...";
    feedback.dataset.tone = "neutral";
    try {
      const response = await fetch("https://formspree.io/f/xleqdrag", {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" }
      });
      if (!response.ok) throw new Error("No fue posible enviar la solicitud.");
      ui.closeLayer(form.closest("dialog"), "submitted");
      setMessage("Recibimos tu solicitud. El equipo BCC se pondrá en contacto contigo.", "ok");
    } catch (error) {
      feedback.textContent = "No pudimos enviar la solicitud. Usa el enlace de contacto alternativo.";
      feedback.dataset.tone = "error";
    } finally {
      requestBusy = false;
      submit.disabled = false;
      submit.textContent = "Enviar solicitud";
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
