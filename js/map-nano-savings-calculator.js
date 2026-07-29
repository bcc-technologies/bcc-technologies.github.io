(() => {
  const catalog = window.BCCMapNanoPlans;
  const savings = window.BCCMapNanoSavings;
  if (!catalog || !savings) throw new Error("MAP-Nano savings calculator dependencies must load first.");
  const localizeMarkup = value => window.BCCMapNanoLocale?.markup?.(value) || value;
  const translate = value => window.BCCMapNanoLocale?.translate?.(value) || value;
  const isEnglish = () => window.BCCMapNanoLocale?.isEnglish?.() || false;
  const localizeCapacityReason = reason => {
    const userCount = /^(\d+) usuarios previstos$/.exec(reason);
    if (userCount && isEnglish()) return `${userCount[1]} planned user${userCount[1] === "1" ? "" : "s"}`;
    return translate(reason);
  };
  const joinCapacityReasons = reasons => {
    const localized = reasons.map(localizeCapacityReason);
    if (!isEnglish()) return localized.join(" y ");
    if (localized.length < 2) return localized[0] || "";
    return localized.length === 2
      ? localized.join(" and ")
      : `${localized.slice(0, -1).join(", ")}, and ${localized.at(-1)}`;
  };

  const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", currencyDisplay: "narrowSymbol", maximumFractionDigits: 0 });
  const NUMBER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
  const PRESETS = Object.freeze({
    small: Object.freeze({ label: "Laboratorio pequeño", planId: "essential", imagesPerMonth: 15, operatingMonths: 12, currentMinutesPerImage: 40, mapsMinutesPerImage: 10, hourlyCost: 15 }),
    active: Object.freeze({ label: "Laboratorio activo", planId: "professional", imagesPerMonth: 50, operatingMonths: 12, currentMinutesPerImage: 40, mapsMinutesPerImage: 10, hourlyCost: 25 }),
    facility: Object.freeze({ label: "Core facility", planId: "facility", imagesPerMonth: 150, operatingMonths: 12, currentMinutesPerImage: 45, mapsMinutesPerImage: 10, hourlyCost: 60 })
  });
  const DEFAULTS = Object.freeze({ planId: "professional", imagesPerMonth: 50, operatingMonths: 12, currentMinutesPerImage: 40, mapsMinutesPerImage: 10, hourlyCost: 25, annualReplaceableCosts: 0, includeRework: false, currentReworkRate: 0, mapsReworkRate: 0, reworkMinutes: 0, volumeMode: "images", samplesPerMonth: 10, imagesPerSample: 5, institutionalEstimate: "", users: 1, batch: false, shared: false, audit: false, api: false });
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
  const formatUsd = value => Number.isFinite(value) ? `US${USD.format(value)}` : translate("Requiere cotización");
  const formatNumber = value => Number.isFinite(value) ? NUMBER.format(value) : translate("No calculable");
  const practicalImages = value => Number.isFinite(value) ? `${Math.ceil(Math.max(0, value)).toLocaleString("en-US")} ${window.BCCMapNanoLocale?.isEnglish?.() ? "images/month" : "imágenes/mes"}` : translate("No calculable");
  const validPlanId = value => catalog.planById(value) ? value : DEFAULTS.planId;
  const boundedNumber = (value, fallback, min = 0, max = Infinity) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
  };
  const helpButton = (id, label, description) => `<button class="map-savings-help" type="button" aria-label="Más información sobre ${escapeHtml(label)}" aria-describedby="${id}"><span aria-hidden="true">?</span><span class="map-savings-help-tooltip" id="${id}" role="tooltip">${escapeHtml(description)}</span></button>`;
  const field = ({ id, label, control, help, attributes = "" }) => `<div class="map-savings-field" ${attributes}><div class="map-savings-field-head"><label for="${id}">${escapeHtml(label)}</label>${helpButton(`savings-help-${id}`, label, help)}</div>${control}</div>`;
  const resultMetric = ({ id, label, value, help, className = "" }) => `<article${className ? ` class="${className}"` : ""}><span class="map-savings-result-title">${escapeHtml(label)}${helpButton(`savings-help-${id}`, label, help)}</span><strong>${value}</strong></article>`;

  function stateFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const state = { ...DEFAULTS };
    const mappings = [
      ["calc_plan", "planId", validPlanId], ["calc_images", "imagesPerMonth", value => boundedNumber(value, DEFAULTS.imagesPerMonth)],
      ["calc_months", "operatingMonths", value => Math.round(boundedNumber(value, DEFAULTS.operatingMonths, 1, 12))],
      ["calc_current_minutes", "currentMinutesPerImage", value => boundedNumber(value, DEFAULTS.currentMinutesPerImage)],
      ["calc_maps_minutes", "mapsMinutesPerImage", value => boundedNumber(value, DEFAULTS.mapsMinutesPerImage)],
      ["calc_hourly_cost", "hourlyCost", value => boundedNumber(value, DEFAULTS.hourlyCost)]
    ];
    mappings.forEach(([parameter, key, normalize]) => {
      if (params.has(parameter)) state[key] = normalize(params.get(parameter));
    });
    return state;
  }

  function inputForState(state) {
    const plan = catalog.planById(state.planId);
    const imagesPerMonth = state.volumeMode === "samples"
      ? boundedNumber(state.samplesPerMonth, 0) * boundedNumber(state.imagesPerSample, 0)
      : boundedNumber(state.imagesPerMonth, 0);
    const institutionalPrice = state.planId === "institutional" && String(state.institutionalEstimate).trim() !== ""
      ? boundedNumber(state.institutionalEstimate, 0)
      : null;
    return {
      planAnnualPrice: state.planId === "institutional" ? institutionalPrice : plan?.annualPrice,
      imagesPerMonth,
      operatingMonths: state.operatingMonths,
      currentMinutesPerImage: state.currentMinutesPerImage,
      mapsMinutesPerImage: state.mapsMinutesPerImage,
      hourlyCost: state.hourlyCost,
      annualReplaceableCosts: state.annualReplaceableCosts,
      includeRework: state.includeRework,
      currentReworkRate: state.currentReworkRate,
      mapsReworkRate: state.mapsReworkRate,
      reworkMinutes: state.reworkMinutes
    };
  }

  function requestUrl(planId, result, intent) {
    const url = new URL(catalog.requestUrl(planId), window.location.origin);
    if (intent) url.searchParams.set("intent", intent);
    const values = {
      calc_images: result.imagesPerMonth,
      calc_months: result.operatingMonths,
      calc_current_minutes: result.currentMinutesPerImage,
      calc_maps_minutes: result.mapsMinutesPerImage,
      calc_hourly_cost: result.hourlyCost,
      calc_gross: result.annualGrossSavings,
      calc_net: result.annualNetSavings,
      calc_roi: result.roiPercent,
      calc_payback: result.paybackMonths,
      calc_break_even: result.breakEvenImagesPerMonth,
      calc_advanced: result.includeRework || result.annualReplaceableCosts > 0 ? "true" : "false"
    };
    Object.entries(values).forEach(([key, value]) => {
      if (value !== null && Number.isFinite(value) || typeof value === "string") url.searchParams.set(key, String(value));
    });
    return `${url.pathname}${url.search}`;
  }

  function capacityRecommendation(state) {
    const reasons = [];
    const users = boundedNumber(state.users, 1, 1);
    if (state.api) return { planId: "institutional", reasons: ["indicaron API, LIMS o despliegue local"] };
    if (state.audit) reasons.push("necesitan registros de auditoría");
    if (state.shared) reasons.push("necesitan pipelines compartidos");
    if (users > 1) reasons.push(`${Math.round(users)} usuarios previstos`);
    if (reasons.length) return { planId: "facility", reasons };
    if (state.batch) return { planId: "professional", reasons: ["indicaron procesamiento por lotes"] };
    return { planId: "essential", reasons: ["no se indicaron necesidades de colaboración o automatización avanzada"] };
  }

  function calculatorMarkup() {
    const planOptions = catalog.PLANS.map(plan => `<option value="${escapeHtml(plan.id)}">${escapeHtml(plan.name)} · ${escapeHtml(catalog.priceLabel(plan))}</option>`).join("");
    return localizeMarkup(`<section class="map-savings-calculator" id="savings-calculator" aria-labelledby="savings-calculator-title">
      <div class="map-pricing-section-head"><p class="map-pricing-eyebrow">Estimación de ahorro</p><h2 id="savings-calculator-title">Calcula el retorno según tu flujo de trabajo</h2><p>Separa el tiempo técnico que podría liberarse, su valor económico estimado y el costo anual de MAP-Nano. Los supuestos son editables y un resultado negativo también es válido.</p></div>
      <div class="map-savings-presets" role="group" aria-label="Escenarios de ejemplo editables"><span>Escenarios editables:</span>${Object.entries(PRESETS).map(([id, preset]) => `<button class="btn btn-ghost" type="button" data-savings-preset="${id}">${escapeHtml(preset.label)}</button>`).join("")}</div>
      <div class="map-savings-layout">
        <form class="map-savings-form" data-savings-form novalidate>
          <fieldset><legend>Supuestos principales</legend>
            ${field({ id: "savings-plan", label: "Plan de MAP-Nano", help: "Los precios se obtienen del catálogo comercial actual.", control: `<select id="savings-plan" name="planId" data-savings-key="planId">${planOptions}</select>` })}
            ${field({ id: "savings-institutional-estimate", label: "Precio anual estimado para Institutional (USD)", help: "Opcional. Sin una estimación se mostrará “Requiere cotización”.", attributes: "data-savings-institutional hidden", control: '<input id="savings-institutional-estimate" name="institutionalEstimate" data-savings-key="institutionalEstimate" type="number" min="0" step="1" inputmode="decimal">' })}
            ${field({ id: "savings-images", label: "Imágenes analizadas por mes", help: "Imágenes por mes; puedes introducir cualquier volumen no negativo.", attributes: "data-savings-images", control: '<input id="savings-images" name="imagesPerMonth" data-savings-key="imagesPerMonth" type="number" min="0" step="1" inputmode="numeric">' })}
            ${field({ id: "savings-operating-months", label: "Meses de operación al año", help: "El cálculo admite entre 1 y 12 meses de operación.", control: '<input id="savings-operating-months" name="operatingMonths" data-savings-key="operatingMonths" type="number" min="1" max="12" step="1" inputmode="numeric">' })}
            ${field({ id: "savings-current-minutes", label: "Tiempo actual por imagen (minutos)", help: "Incluye preparación, medición, correcciones, registro, exportación y resultados básicos.", control: '<input id="savings-current-minutes" name="currentMinutesPerImage" data-savings-key="currentMinutesPerImage" type="number" min="0" step="0.1" inputmode="decimal">' })}
            ${field({ id: "savings-maps-minutes", label: "Tiempo estimado con MAP-Nano (minutos)", help: "Incluye revisión y correcciones humanas; no se asume tiempo cero.", control: '<input id="savings-maps-minutes" name="mapsMinutesPerImage" data-savings-key="mapsMinutesPerImage" type="number" min="0" step="0.1" inputmode="decimal">' })}
            ${field({ id: "savings-hourly-cost", label: "Costo efectivo por hora (USD)", help: "Puede reflejar salario, cargas, costo institucional o un costo de oportunidad defendible; no tiene que ser el salario nominal.", control: '<input id="savings-hourly-cost" name="hourlyCost" data-savings-key="hourlyCost" type="number" min="0" step="0.01" inputmode="decimal">' })}
          </fieldset>
          <details class="map-savings-advanced" data-savings-advanced="assumptions"><summary><span><strong>Supuestos avanzados</strong><small>Ajusta volumen, reprocesos y costos sustituibles.</small></span><em>Opcional</em></summary><div>
            <label class="map-savings-check"><input type="checkbox" name="volumeMode" data-savings-volume-mode> Calcular el volumen por muestras</label>
            <div class="map-savings-sample-inputs" data-savings-samples hidden><label>Muestras analizadas por mes<input name="samplesPerMonth" data-savings-key="samplesPerMonth" type="number" min="0" step="1" inputmode="numeric"></label><label>Imágenes promedio por muestra<input name="imagesPerSample" data-savings-key="imagesPerSample" type="number" min="0" step="0.1" inputmode="decimal"></label><p>Esta fuente sustituye temporalmente el campo de imágenes mensuales.</p></div>
            <label class="map-savings-check"><input type="checkbox" name="includeRework" data-savings-key="includeRework"> Incluir reprocesos evitados</label>
            <div class="map-savings-rework-inputs" data-savings-rework hidden><label>Reprocesos actuales (%)<input name="currentReworkRate" data-savings-key="currentReworkRate" type="number" min="0" max="100" step="0.1" inputmode="decimal"></label><label>Reprocesos estimados con MAP-Nano (%)<input name="mapsReworkRate" data-savings-key="mapsReworkRate" type="number" min="0" max="100" step="0.1" inputmode="decimal"></label><label>Tiempo adicional por reproceso (minutos)<input name="reworkMinutes" data-savings-key="reworkMinutes" type="number" min="0" step="0.1" inputmode="decimal"></label></div>
            ${field({ id: "savings-replaceable-costs", label: "Costos anuales realmente sustituibles (USD)", help: "Incluye sólo costos que MAP-Nano sustituiría realmente. Excluye SEM, adquisición de imágenes, mantenimiento, salarios completos e ingresos hipotéticos.", control: '<input id="savings-replaceable-costs" name="annualReplaceableCosts" data-savings-key="annualReplaceableCosts" type="number" min="0" step="1" inputmode="decimal">' })}
          </div></details>
          <details class="map-savings-advanced" data-savings-advanced="operations"><summary><span><strong>Necesidades operativas</strong><small>Indica la capacidad mínima que necesita tu flujo.</small></span><em>Orientación</em></summary><div class="map-savings-needs"><label>Usuarios previstos<input name="users" data-savings-key="users" type="number" min="1" step="1" inputmode="numeric"></label><label class="map-savings-check"><input type="checkbox" name="batch" data-savings-key="batch"> Procesamiento por lotes</label><label class="map-savings-check"><input type="checkbox" name="shared" data-savings-key="shared"> Pipelines compartidos</label><label class="map-savings-check"><input type="checkbox" name="audit" data-savings-key="audit"> Registros de auditoría</label><label class="map-savings-check"><input type="checkbox" name="api" data-savings-key="api"> API, LIMS o despliegue local</label></div></details>
          <p class="map-savings-feedback" data-savings-feedback role="status" aria-live="polite"></p>
        </form>
        <aside class="map-savings-results" aria-label="Resultados estimados"><p class="map-pricing-eyebrow">Resultados estimados</p><div class="map-savings-result-grid" data-savings-results></div><details class="map-savings-diagnostics" data-savings-diagnostics><summary><span>Diagnóstico</span><span class="map-savings-diagnostic-badges" data-savings-diagnostic-badges></span></summary><div class="map-savings-diagnostics-body"><article class="map-savings-assessment" data-savings-assessment></article><article class="map-savings-recommendation" data-savings-recommendation></article></div></details><div class="map-savings-actions" data-savings-actions></div><button class="map-savings-share" type="button" data-savings-share>Copiar enlace a este escenario</button></aside>
      </div>
      <details class="map-savings-comparison" data-savings-comparison><summary>Comparar el mismo escenario entre planes anuales</summary><div class="map-savings-comparison-note">El plan más barato no siempre cubre las capacidades operativas requeridas. La elección debe considerar funciones, usuarios, soporte y volumen.</div><div class="map-savings-table-wrap"><table><thead><tr><th>Plan</th><th>Costo anual</th><th>Ahorro neto</th><th>ROI</th><th>Recuperación</th><th>Equilibrio</th></tr></thead><tbody data-savings-comparison-body></tbody></table></div></details>
      <details class="map-savings-method"><summary>Cómo se calcula</summary><div><p>La calculadora multiplica las imágenes anuales por la diferencia entre el tiempo actual y el tiempo estimado con MAP-Nano. Ese tiempo se valora con el costo efectivo por hora que indiques. El ahorro neto es el ahorro bruto menos el costo anual de la licencia; el ROI es ahorro neto dividido entre ese costo.</p><p>Los reprocesos y costos sustituibles sólo se incluyen cuando los activas. No se consideran el costo del SEM, adquisición de imágenes, mantenimiento, salarios completos, ingresos hipotéticos ni “productividad” convertida automáticamente en ventas.</p><p>Esta calculadora estima el valor del tiempo técnico que podría liberarse mediante MAP-Nano. No representa una garantía de ahorro, ingreso o rendimiento. Los resultados dependen de los procedimientos, imágenes, equipos y requisitos de revisión de cada laboratorio.</p></div></details>
      <details class="map-savings-method map-savings-estimate-note"><summary>Una estimación, no una promesa</summary><div><p>MAP-Nano no sustituye el microscopio, la preparación de muestras ni la interpretación científica; la revisión técnica sigue siendo necesaria.</p></div></details>
    </section>`);
  }

  function render(root, options = {}) {
    if (!root) return null;
    root.innerHTML = calculatorMarkup();
    const state = { ...stateFromUrl(), ...options.initialState };
    const form = root.querySelector("[data-savings-form]");
    const resultRoot = root.querySelector("[data-savings-results]");
    const assessmentRoot = root.querySelector("[data-savings-assessment]");
    const recommendationRoot = root.querySelector("[data-savings-recommendation]");
    const diagnosticBadgesRoot = root.querySelector("[data-savings-diagnostic-badges]");
    const actionsRoot = root.querySelector("[data-savings-actions]");
    const comparisonRoot = root.querySelector("[data-savings-comparison-body]");
    const feedback = root.querySelector("[data-savings-feedback]");
    let inputTimer = null;
    let lastSignature = "";

    const inputs = key => form.querySelectorAll(`[data-savings-key="${key}"]`);
    const setField = (key, value) => inputs(key).forEach(input => { input.checked = typeof value === "boolean" ? value : input.checked; if (typeof value !== "boolean") input.value = value; });
    const syncForm = () => {
      Object.entries(state).forEach(([key, value]) => setField(key, value));
      form.elements.planId.value = state.planId;
      root.querySelector("[data-savings-institutional]").hidden = state.planId !== "institutional";
      root.querySelector("[data-savings-images]").hidden = state.volumeMode === "samples";
      root.querySelector("[data-savings-samples]").hidden = state.volumeMode !== "samples";
      root.querySelector("[data-savings-rework]").hidden = !state.includeRework;
      form.querySelector("[data-savings-volume-mode]").checked = state.volumeMode === "samples";
      inputs("imagesPerMonth").forEach(input => { input.disabled = state.volumeMode === "samples"; });
      ["samplesPerMonth", "imagesPerSample"].forEach(key => inputs(key).forEach(input => { input.disabled = state.volumeMode !== "samples"; }));
    };

    const updateUrl = result => {
      const url = new URL(window.location.href);
      const values = { calc_plan: state.planId, calc_images: result.imagesPerMonth, calc_months: result.operatingMonths, calc_current_minutes: result.currentMinutesPerImage, calc_maps_minutes: result.mapsMinutesPerImage, calc_hourly_cost: result.hourlyCost };
      Object.entries(values).forEach(([key, value]) => url.searchParams.set(key, String(value)));
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    };

    const renderResults = () => {
      const result = savings.calculate(inputForState(state));
      const assessment = savings.classify(result);
      const plan = catalog.planById(state.planId);
      const payback = result.paybackMonths === null ? translate("No se alcanza el equilibrio con estos supuestos.") : result.paybackMonths > 12 ? translate("Más de 12 meses") : `${formatNumber(result.paybackMonths)} ${translate("meses")}`;
      const net = result.annualNetSavings === null ? translate("Requiere cotización") : formatUsd(result.annualNetSavings);
      const roi = result.roiPercent === null ? translate("Requiere cotización") : `${formatNumber(result.roiPercent)} %`;
      const grossSavingsHelp = result.annualReplaceableCosts > 0
        ? isEnglish()
          ? `Estimated value of freed technical time. Includes ${formatUsd(result.annualReplaceableCosts)} in declared replaceable costs.`
          : `Valor estimado del tiempo técnico liberado. Incluye ${formatUsd(result.annualReplaceableCosts)} de costos sustituibles declarados.`
        : translate("Valor estimado del tiempo técnico liberado.");
      const hoursSavedHelp = isEnglish()
        ? `Equivalent to approximately ${formatNumber(result.annualHoursSaved / 8)} eight-hour workdays.`
        : `Equivale aproximadamente a ${formatNumber(result.annualHoursSaved / 8)} jornadas de 8 horas.`;
      resultRoot.innerHTML = localizeMarkup([
        resultMetric({ id: "hours-saved", label: "Horas técnicas ahorradas", value: `${formatNumber(result.annualHoursSaved)} ${isEnglish() ? "hours/year" : "horas/año"}`, help: hoursSavedHelp }),
        resultMetric({ id: "gross-savings", label: "Ahorro bruto anual", value: formatUsd(result.annualGrossSavings), help: grossSavingsHelp }),
        resultMetric({ id: "license-cost", label: "Costo anual de MAP-Nano", value: result.annualLicenseCost === null ? "Requiere cotización" : formatUsd(result.annualLicenseCost), help: plan?.name || "MAP-Nano" }),
        resultMetric({ id: "net-savings", label: "Ahorro neto anual", value: net, help: "Ahorro bruto menos costo de licencia." }),
        resultMetric({ id: "roi", label: "ROI estimado", value: roi, help: "Ahorro neto dividido entre el costo de licencia, multiplicado por 100." }),
        resultMetric({ id: "payback", label: "Recuperación estimada", value: payback, help: "Se calcula con el ahorro bruto mensual." }),
        resultMetric({ id: "break-even", label: "Punto de equilibrio", value: practicalImages(result.breakEvenImagesPerMonth), help: "Volumen aproximado necesario para cubrir el costo anual del plan.", className: "map-savings-break-even" })
      ].join(""));
      assessmentRoot.className = `map-savings-assessment is-${assessment.tone}`;
      assessmentRoot.innerHTML = localizeMarkup(`<strong>${escapeHtml(translate(assessment.title))}</strong><p>${escapeHtml(translate(assessment.text))}</p>${result.annualNetSavings !== null && result.annualNetSavings < 0 ? "<p>Considera revisar los supuestos, Essential, MAP-Nano Project o análisis asistido; otros beneficios deben evaluarse por separado.</p>" : ""}`);
      const capacity = capacityRecommendation(state);
      const capacityPlan = catalog.planById(capacity.planId);
      const evaluatedPlanName = plan?.name || "MAP-Nano Institutional";
      const capacityPlanName = capacityPlan?.name || "MAP-Nano Institutional";
      const isEvaluatedPlanSufficient = capacity.planId === state.planId;
      const capacityReasons = joinCapacityReasons(capacity.reasons);
      recommendationRoot.innerHTML = isEvaluatedPlanSufficient
        ? isEnglish()
          ? `<strong>Declared requirements</strong><p>The evaluated plan, ${escapeHtml(evaluatedPlanName)}, covers the stated requirements: ${escapeHtml(capacityReasons)}. This is commercial guidance; confirm features, users, and support.</p>`
          : `<strong>Capacidad declarada</strong><p>El plan evaluado, ${escapeHtml(evaluatedPlanName)}, cubre las necesidades indicadas: ${escapeHtml(capacityReasons)}. Esta es una orientación comercial; confirma funciones, usuarios y soporte.</p>`
        : isEnglish()
          ? `<strong>Declared requirements</strong><p>You are evaluating ${escapeHtml(evaluatedPlanName)}. With the stated requirements, ${escapeHtml(capacityPlanName)} would meet the minimum capability: ${escapeHtml(capacityReasons)}. You can recalculate this scenario with that tier before requesting it.</p>`
          : `<strong>Capacidad declarada</strong><p>Estás evaluando ${escapeHtml(evaluatedPlanName)}. Con las necesidades indicadas, ${escapeHtml(capacityPlanName)} cubriría la capacidad mínima: ${escapeHtml(capacityReasons)}. Puedes recalcular este escenario con ese nivel antes de solicitarlo.</p>`;
      diagnosticBadgesRoot.innerHTML = `<span class="map-savings-diagnostic-badge is-${escapeHtml(assessment.grade)}">${escapeHtml(translate(assessment.badge))}</span><span class="map-savings-diagnostic-badge is-plan">${escapeHtml(evaluatedPlanName.replace("MAP-Nano ", ""))}</span>`;
      const requestPlan = result.annualNetSavings !== null && result.annualNetSavings < 0 ? "project" : state.planId;
      const mainLabel = requestPlan === "project"
        ? isEnglish() ? "Explore the Project alternative" : "Consultar alternativa Project"
        : state.planId === "institutional"
          ? isEnglish() ? "Discuss Institutional" : "Hablar sobre Institutional"
          : isEnglish() ? `Request ${plan?.name.replace("MAP-Nano ", "") || "plan"}` : `Solicitar ${plan?.name.replace("MAP-Nano ", "") || "plan"}`;
      const recommendationAction = capacity.planId !== state.planId
        ? `<button class="btn btn-ghost" type="button" data-savings-use-recommendation="${escapeHtml(capacity.planId)}">${isEnglish() ? "Recalculate with" : "Recalcular con"} ${escapeHtml(capacityPlanName.replace("MAP-Nano ", ""))}</button>`
        : "";
      actionsRoot.innerHTML = localizeMarkup(`<a class="btn btn-primary" href="${escapeHtml(requestUrl(requestPlan, result))}" data-savings-cta="quote">${escapeHtml(mainLabel)}</a>${recommendationAction}<a class="btn btn-ghost" href="${escapeHtml(requestUrl(state.planId, result, "demo"))}" data-savings-cta="demo">Solicitar una demostración</a>`);
      comparisonRoot.innerHTML = catalog.PLANS.filter(item => Number.isFinite(item.annualPrice)).map(item => {
        const comparable = savings.calculate({ ...inputForState(state), planAnnualPrice: item.annualPrice });
        const comparablePayback = comparable.paybackMonths === null
          ? translate("No alcanzable")
          : comparable.paybackMonths > 12
            ? translate("Más de 12 meses")
            : `${formatNumber(comparable.paybackMonths)} ${translate("meses")}`;
        return `<tr><th scope="row">${escapeHtml(item.name.replace("MAP-Nano ", ""))}</th><td>${formatUsd(item.annualPrice)}</td><td>${formatUsd(comparable.annualNetSavings)}</td><td>${formatNumber(comparable.roiPercent)} %</td><td>${comparablePayback}</td><td>${practicalImages(comparable.breakEvenImagesPerMonth)}</td></tr>`;
      }).join("");
      comparisonRoot.innerHTML = localizeMarkup(comparisonRoot.innerHTML);
      updateUrl(result);
      const signature = JSON.stringify([state.planId, result.imagesPerMonth, result.operatingMonths, result.currentMinutesPerImage, result.mapsMinutesPerImage, result.hourlyCost, result.annualReplaceableCosts, result.includeRework]);
      if (signature !== lastSignature) {
        lastSignature = signature;
        window.BCCAnalytics?.track("savings_calculator_result_generated", { product_key: "map.nano", plan_id: state.planId, has_advanced_assumptions: result.includeRework || result.annualReplaceableCosts > 0 }, { onceKey: `savings-result:${signature}` });
      }
      return result;
    };

    const update = () => { syncForm(); return renderResults(); };
    syncForm();
    const initialResult = renderResults();
    window.BCCAnalytics?.track("savings_calculator_viewed", { product_key: "map.nano", context: options.context || "public" }, { onceKey: "savings-calculator:public" });

    form.addEventListener("input", event => {
      const target = event.target;
      const key = target.dataset.savingsKey;
      if (!key) return;
      state[key] = target.type === "checkbox" ? target.checked : target.value === "" ? 0 : target.value;
      if (target.type === "number" && !Number.isFinite(Number(target.value))) {
        feedback.textContent = translate("Introduce un número válido; mientras se corrige, se usa 0 para evitar resultados engañosos.");
      } else {
        feedback.textContent = "";
      }
      window.clearTimeout(inputTimer);
      inputTimer = window.setTimeout(() => {
        update();
        window.BCCAnalytics?.track("savings_calculator_input_changed", { product_key: "map.nano", field: key }, { onceKey: `savings-input:${key}:${Date.now()}` });
      }, 180);
    });

    form.addEventListener("change", event => {
      const target = event.target;
      if (target.matches("[data-savings-volume-mode]")) {
        state.volumeMode = target.checked ? "samples" : "images";
      } else if (target.dataset.savingsKey === "planId") {
        state.planId = validPlanId(target.value);
      } else if (target.dataset.savingsKey === "includeRework") {
        state.includeRework = target.checked;
      } else return;
      update();
    });

    root.addEventListener("click", event => {
      const preset = event.target.closest("[data-savings-preset]");
      if (preset) {
        event.preventDefault();
        Object.assign(state, PRESETS[preset.dataset.savingsPreset] || {});
        update();
        window.BCCAnalytics?.track("savings_calculator_preset_selected", { product_key: "map.nano", preset: preset.dataset.savingsPreset, plan_id: state.planId });
        return;
      }
      const recommendationAction = event.target.closest("[data-savings-use-recommendation]");
      if (recommendationAction) {
        const recommendedPlanId = validPlanId(recommendationAction.dataset.savingsUseRecommendation);
        if (recommendedPlanId !== state.planId) {
          state.planId = recommendedPlanId;
          update();
          feedback.textContent = window.BCCMapNanoLocale?.isEnglish?.() ? `Scenario recalculated with ${catalog.planById(recommendedPlanId)?.name || "the recommended plan"}.` : `Escenario recalculado con ${catalog.planById(recommendedPlanId)?.name || "el plan recomendado"}.`;
          window.BCCAnalytics?.track("savings_calculator_recommended_plan_selected", { product_key: "map.nano", plan_id: recommendedPlanId });
        }
        return;
      }
      const cta = event.target.closest("[data-savings-cta]");
      if (cta) window.BCCAnalytics?.track(cta.dataset.savingsCta === "demo" ? "savings_calculator_demo_requested" : "savings_calculator_quote_requested", { product_key: "map.nano", plan_id: state.planId });
      if (event.target.closest("[data-savings-share]")) {
        const url = window.location.href;
        const done = () => { feedback.textContent = translate("Enlace del escenario copiado. No incluye datos personales."); };
        if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(done).catch(() => { feedback.textContent = translate("Copia la URL de esta página para compartir el escenario."); });
        else feedback.textContent = translate("Copia la URL de esta página para compartir el escenario.");
        window.BCCAnalytics?.track("savings_calculator_shared", { product_key: "map.nano", plan_id: state.planId });
      }
    });

    root.querySelector("[data-savings-comparison]").addEventListener("toggle", event => {
      if (event.target.open) window.BCCAnalytics?.track("savings_calculator_plan_compared", { product_key: "map.nano", selected_plan: state.planId }, { onceKey: "savings-plan-comparison" });
    });

    return { update, state, result: initialResult };
  }

  window.BCCMapNanoSavingsCalculator = Object.freeze({ render, PRESETS, DEFAULTS });
})();
