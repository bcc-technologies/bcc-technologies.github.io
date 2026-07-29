(() => {
  const LICENSE_TYPES = {
    named_user: "usuario individual",
    organization: "equipo u organización",
    evaluation: "evaluación guiada"
  };

  const PRODUCTS = {
    "map.nano": "MAP Nano",
    "map-nano": "MAP Nano",
    "map.bio": "MAP Bio",
    "map-bio": "MAP Bio",
    "map.ing": "MAP-Ing",
    "map-ing": "MAP-Ing",
    "map.med": "MAP Med",
    "map-med": "MAP Med"
  };

  function init() {
    const params = new URLSearchParams(window.location.search);
    const productKey = params.get("product") || "";
    const intent = params.get("intent") || "";
    const licenseType = params.get("license_type") || "";
    const planId = params.get("plan") || "";
    if (!productKey && !intent && !licenseType && !planId) return;

    const form = document.querySelector('form[action*="formspree.io"]');
    if (!form) return;

    const isEnglish = window.location.pathname.startsWith("/en/");
    const product = PRODUCTS[productKey] || productKey.replace(/[._-]+/g, " ").trim();
    const licenseTypeLabel = LICENSE_TYPES[licenseType] || licenseType.replace(/[_-]+/g, " ").trim();
    const mapNanoPlan = productKey === "map-nano" ? window.BCCMapNanoPlans?.planById?.(planId) : null;
    const subject = form.querySelector('select[name="subject"]');
    const message = form.querySelector('textarea[name="message"]');

    addHiddenField(form, "intent", intent || "contact");
    if (product) addHiddenField(form, "product", product);
    if (licenseType) addHiddenField(form, "license_type", licenseType);
    if (planId) addHiddenField(form, "commercial_plan", planId);

    if (subject && product) {
      const option = document.createElement("option");
      option.value = `License request: ${product}${licenseTypeLabel ? ` · ${licenseTypeLabel}` : ""}`;
      option.textContent = isEnglish
        ? `License for ${product}${licenseTypeLabel ? ` · ${licenseTypeLabel}` : ""}`
        : `Licencia para ${product}${licenseTypeLabel ? ` · ${licenseTypeLabel}` : ""}`;
      option.selected = true;
      subject.append(option);
    }

    if (message && product && !message.value.trim()) {
      message.value = isEnglish
        ? `I would like information about licensing ${product}${licenseTypeLabel ? ` (${licenseTypeLabel})` : ""}.`
        : `Me gustaría recibir información sobre una licencia de ${product}${licenseTypeLabel ? ` (${licenseTypeLabel})` : ""}.`;
    }

    if (mapNanoPlan) addMapNanoCommercialFields(form, message, mapNanoPlan, intent, isEnglish);
    if (productKey === "map-nano") addMapNanoSavingsEstimateFields(form, params);
  }

  function addMapNanoSavingsEstimateFields(form, params) {
    const fields = {
      savings_estimate_source: "MAP-Nano savings calculator (user-provided estimate)",
      savings_estimate_images_per_month: params.get("calc_images"),
      savings_estimate_operating_months: params.get("calc_months"),
      savings_estimate_current_minutes: params.get("calc_current_minutes"),
      savings_estimate_maps_minutes: params.get("calc_maps_minutes"),
      savings_estimate_hourly_cost_usd: params.get("calc_hourly_cost"),
      savings_estimate_gross_usd: params.get("calc_gross"),
      savings_estimate_net_usd: params.get("calc_net"),
      savings_estimate_roi_percent: params.get("calc_roi"),
      savings_estimate_payback_months: params.get("calc_payback"),
      savings_estimate_break_even_images_per_month: params.get("calc_break_even"),
      savings_estimate_advanced_assumptions: params.get("calc_advanced")
    };
    Object.entries(fields).forEach(([name, value]) => {
      if (value !== null && value !== "") addHiddenField(form, name, value);
    });
  }

  function addMapNanoCommercialFields(form, message, plan, intent, isEnglish) {
    if (form.dataset.mapNanoCommercialFields === "true") return;
    form.dataset.mapNanoCommercialFields = "true";
    const labels = isEnglish
      ? { organization: "Institution or organization", country: "Country", users: "Estimated users", volume: "Approximate image or sample volume", newLicense: "New license", upgrade: "Upgrade", institutional: "Institutional quote", project: "Project access", demo: "Demonstration", select: "Select an option", under: "Under 100 images or samples", middle: "100 to 1,000 images or samples", over: "Over 1,000 images or samples", unknown: "Not defined yet" }
      : { organization: "Institución u organización", country: "País", users: "Usuarios estimados", volume: "Volumen aproximado de imágenes o muestras", newLicense: "Nueva licencia", upgrade: "Actualización", institutional: "Cotización institucional", project: "Acceso por proyecto", demo: "Demostración", select: "Selecciona una opción", under: "Menos de 100 imágenes o muestras", middle: "100 a 1,000 imágenes o muestras", over: "Más de 1,000 imágenes o muestras", unknown: "Aún no definido" };
    const requestType = intent === "institutional_quote" ? "institutional_quote" : intent === "project_access" ? "project_access" : intent === "upgrade" ? "upgrade" : "new_license";
    const nameField = form.elements.namedItem("user_name");
    const emailField = form.elements.namedItem("user_email");
    if (nameField) nameField.required = true;
    if (emailField) emailField.required = true;
    addHiddenField(form, "plan_name", plan.name);
    const fields = document.createElement("div");
    fields.className = "map-nano-contact-fields";
    fields.innerHTML = `
      <input class="input" type="text" name="organization" autocomplete="organization" placeholder="${escapeHtml(labels.organization)}" required>
      <input class="input" type="text" name="country" autocomplete="country-name" placeholder="${escapeHtml(labels.country)}" required>
      <input class="input" type="number" name="estimated_users" min="1" max="100000" value="${Number(plan.limits?.namedUsers) || 1}" required aria-label="${escapeHtml(labels.users)}">
      <select class="input select" name="request_type" required aria-label="Request type"><option value="new_license" ${requestType === "new_license" ? "selected" : ""}>${escapeHtml(labels.newLicense)}</option><option value="upgrade" ${requestType === "upgrade" ? "selected" : ""}>${escapeHtml(labels.upgrade)}</option><option value="institutional_quote" ${requestType === "institutional_quote" ? "selected" : ""}>${escapeHtml(labels.institutional)}</option><option value="project_access" ${requestType === "project_access" ? "selected" : ""}>${escapeHtml(labels.project)}</option><option value="demo">${escapeHtml(labels.demo)}</option></select>
      <select class="input select" name="analysis_volume" required aria-label="${escapeHtml(labels.volume)}"><option value="">${escapeHtml(labels.select)}</option><option value="under_100">${escapeHtml(labels.under)}</option><option value="100_to_1000">${escapeHtml(labels.middle)}</option><option value="over_1000">${escapeHtml(labels.over)}</option><option value="unknown">${escapeHtml(labels.unknown)}</option></select>`;
    message?.before(fields);
    if (message) message.required = true;
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
  }

  function addHiddenField(form, name, value) {
    if (!value || form.elements.namedItem(name)) return;
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.append(input);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
