(() => {
  const catalog = window.BCCMapNanoPlans;
  if (!catalog) throw new Error("MAP-Nano plans must load before the pricing page.");

  const root = document.querySelector("[data-map-nano-pricing]");
  if (!root) return;

  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[character]));

  const planCell = (plan, feature) => {
    if (plan.id === "institutional" && ["api_access", "institutional_reports"].includes(feature.id)) {
      return '<span class="map-pricing-included is-scope" role="img" aria-label="Según alcance" title="Según alcance">≈</span>';
    }
    return catalog.hasEntitlement(plan, feature.id)
      ? '<span class="map-pricing-included" role="img" aria-label="Incluido" title="Incluido">✓</span>'
      : '<span class="map-pricing-excluded" role="img" aria-label="No incluido" title="No incluido">—</span>';
  };

  const limitItems = plan => {
    const limits = [];
    if (Number.isFinite(plan.limits?.namedUsers)) limits.push(`${plan.limits.namedUsers} usuario${plan.limits.namedUsers === 1 ? "" : "s"} nominativo${plan.limits.namedUsers === 1 ? "" : "s"}`);
    if (Number.isFinite(plan.limits?.concurrentUsers)) limits.push(`${plan.limits.concurrentUsers} usuario${plan.limits.concurrentUsers === 1 ? "" : "s"} concurrente${plan.limits.concurrentUsers === 1 ? "" : "s"}`);
    if (Number.isFinite(plan.limits?.installations)) limits.push(`${plan.limits.installations} instalaciones asociadas`);
    return limits;
  };

  const renderPlan = plan => {
    const titleId = `map-pricing-${plan.id}-title`;
    const limits = limitItems(plan);
    return `<article class="map-pricing-plan is-${escapeHtml(plan.id)} ${plan.highlighted ? "is-highlighted" : ""}" aria-labelledby="${titleId}">
      <header class="map-pricing-plan-head">
        <div>
          ${plan.badge ? `<span class="map-pricing-badge">${escapeHtml(plan.badge)}</span>` : ""}
          <h2 id="${titleId}">${escapeHtml(plan.name)}</h2>
          <p>${escapeHtml(plan.description)}</p>
        </div>
        <div class="map-pricing-price">
          <strong>${escapeHtml(catalog.priceLabel(plan))}</strong>
          ${catalog.monthlyLabel(plan) ? `<span>${escapeHtml(catalog.monthlyLabel(plan))}</span>` : '<span>Precio personalizado según alcance</span>'}
        </div>
      </header>
      <div class="map-pricing-plan-target"><strong>Ideal para</strong><span>${escapeHtml(plan.targetCustomer.join(" · "))}</span></div>
      ${limits.length ? `<p class="map-pricing-plan-limits"><strong>Límites incluidos:</strong> ${escapeHtml(limits.join(" · "))}</p>` : '<p class="map-pricing-plan-limits"><strong>Límites:</strong> se definen según el alcance contratado.</p>'}
      <div class="map-pricing-plan-features"><h3>Incluye</h3><ul>${plan.features.map(feature => `<li>${escapeHtml(feature)}</li>`).join("")}</ul></div>
      ${plan.exclusions?.length ? `<details class="map-pricing-exclusions"><summary>Limitaciones de este nivel</summary><ul>${plan.exclusions.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul></details>` : ""}
      <a class="btn ${plan.highlighted ? "btn-primary" : "btn-ghost"} map-pricing-cta" href="${escapeHtml(catalog.requestUrl(plan.id))}" data-map-pricing-plan="${escapeHtml(plan.id)}" data-analytics-event="${plan.id === "institutional" ? "contact_sales_clicked" : "pricing_plan_selected"}" data-analytics-label="${escapeHtml(plan.name)}">${escapeHtml(plan.cta.label)}</a>
    </article>`;
  };

  const renderComparison = () => `<details class="map-pricing-comparison" id="comparar" data-map-pricing-comparison>
    <summary aria-labelledby="map-pricing-comparison-title">
      <span class="map-pricing-comparison-summary-copy"><strong id="map-pricing-comparison-title"><span aria-hidden="true">↔</span> Comparar capacidades</strong><small>4 planes · ${catalog.COMPARISON_FEATURES.length} capacidades</small></span>
      <span class="map-pricing-comparison-toggle"><span aria-hidden="true"></span><span>Ver detalle</span></span>
    </summary>
    <div class="map-pricing-comparison-body">
      <p class="map-pricing-comparison-note">Los límites y capacidades se muestran como referencia comercial. La configuración final de licencia se confirma en la propuesta y el contrato aplicable.</p>
      <p class="map-pricing-comparison-legend" aria-label="Leyenda de comparación"><span><i class="map-pricing-included" aria-hidden="true">✓</i> Incluido</span><span><i class="map-pricing-excluded" aria-hidden="true">—</i> No incluido</span><span><i class="map-pricing-included is-scope" aria-hidden="true">≈</i> Según alcance</span></p>
      <div class="map-pricing-table-wrap" tabindex="0">
        <table>
          <caption class="visually-hidden">Comparación de capacidades entre los planes de MAP-Nano</caption>
          <thead><tr><th scope="col">Capacidad</th>${catalog.PLANS.map(plan => `<th scope="col">${escapeHtml(plan.name.replace("MAP-Nano ", ""))}</th>`).join("")}</tr></thead>
          <tbody>${catalog.COMPARISON_FEATURES.map(feature => `<tr><th scope="row"><span>${escapeHtml(feature.label)}</span><small>${escapeHtml(feature.description)}</small></th>${catalog.PLANS.map(plan => `<td>${planCell(plan, feature)}</td>`).join("")}</tr>`).join("")}</tbody>
        </table>
      </div>
      <div class="map-pricing-mobile-comparison" aria-label="Comparación de capacidades por plan">
        ${catalog.PLANS.map(plan => `<details><summary>${escapeHtml(plan.name.replace("MAP-Nano ", ""))}</summary><ul>${catalog.COMPARISON_FEATURES.map(feature => `<li><span>${escapeHtml(feature.label)}</span>${planCell(plan, feature)}</li>`).join("")}</ul></details>`).join("")}
      </div>
    </div>
  </details>`;

  const renderProject = () => {
    const project = catalog.PROJECT_ACCESS;
    return `<section class="map-pricing-project" aria-labelledby="map-pricing-project-title">
      <div><p class="map-pricing-eyebrow">Alternativa por proyecto</p><h2 id="map-pricing-project-title">${escapeHtml(project.name)}</h2><p>${escapeHtml(project.description)}</p></div>
      <div class="map-pricing-project-action"><strong>${escapeHtml(catalog.projectPriceLabel(project))}</strong><span>El alcance puede incluir acceso temporal de 30 días o análisis asistido.</span><a class="btn btn-ghost" href="${escapeHtml(catalog.requestUrl(project.id))}" data-map-pricing-plan="project" data-analytics-event="project_access_requested" data-analytics-label="MAP-Nano Project">${escapeHtml(project.cta.label)}</a></div>
    </section>`;
  };

  const faqs = [
    ["¿La licencia se factura mensualmente o anualmente?", "Essential, Professional y Facility se presentan con precio anual. El equivalente mensual es sólo una referencia; la facturación se realiza anualmente."],
    ["¿Qué ocurre si necesito varios usuarios?", "Facility contempla hasta cinco usuarios nominativos o tres concurrentes. Para necesidades distintas, solicita una cotización Institutional o Facility."],
    ["¿Puedo cambiar de plan?", "Sí. El cambio se revisa según la licencia activa, el alcance y el momento contractual. Los administradores de la organización pueden solicitarlo desde el dashboard."],
    ["¿Existe precio académico?", "Pueden solicitarse condiciones académicas según institución, volumen y alcance. No hay una política académica universal publicada todavía."],
    ["¿MAP-Nano reemplaza el microscopio?", "No. MAP-Nano apoya el análisis técnico de las imágenes; no sustituye el microscopio ni la interpretación científica."],
    ["¿Puedo solicitar una prueba o demostración?", "Sí. Puedes solicitar una demostración o una evaluación guiada describiendo el caso de uso y el volumen aproximado de análisis."],
    ["¿Los datos permanecen bajo control del laboratorio?", "El tratamiento de datos depende de la modalidad y del alcance contratado. Antes de confirmar un despliegue se especifican el flujo de datos y las responsabilidades aplicables."],
    ["¿Existe despliegue local?", "Puede evaluarse para implementaciones Institutional según el alcance técnico y contractual."],
    ["¿Qué ocurre si sólo necesito analizar un proyecto?", "MAP-Nano Project ofrece una alternativa para acceso temporal o análisis asistido; el alcance define el precio final."],
    ["¿Facility e Institutional pueden comprarse directamente?", "No. Ambos niveles comienzan con una solicitud comercial o cotización para confirmar usuarios, soporte, despliegue y alcance." ]
  ];

  const renderFaq = () => `<section class="map-pricing-section map-pricing-faq" aria-labelledby="map-pricing-faq-title">
    <div class="map-pricing-section-head"><p class="map-pricing-eyebrow">Preguntas frecuentes</p><h2 id="map-pricing-faq-title">Decisiones informadas antes de contratar</h2></div>
    <div class="map-pricing-faq-list">${faqs.map(([question, answer], index) => `<details data-map-pricing-faq="${index}"><summary>${escapeHtml(question)}</summary><p>${escapeHtml(answer)}</p></details>`).join("")}</div>
  </section>`;

  root.innerHTML = `
    <section class="map-pricing-hero">
      <div class="container map-pricing-hero-inner"><p class="map-pricing-eyebrow">MAP-Nano</p><h1>Planes de MAP-Nano</h1><p>Automatización y trazabilidad para análisis de microestructuras, desde el trabajo individual hasta implementaciones institucionales.</p><div class="map-pricing-hero-actions"><a class="btn btn-primary" href="#planes">Ver planes</a><a class="btn btn-ghost" href="#savings-calculator" data-map-pricing-savings>Calcular ahorro</a><a class="btn btn-ghost" href="#comparar" data-map-pricing-compare>Comparar capacidades</a></div></div>
    </section>
    <main class="map-pricing-main">
      <section class="map-pricing-section" id="planes" aria-labelledby="map-pricing-plans-title"><div class="map-pricing-section-head"><p class="map-pricing-eyebrow">Licenciamiento anual</p><h2 id="map-pricing-plans-title">Elige el nivel de operación que corresponde a tu laboratorio</h2><p>Las solicitudes se revisan con BCC antes de emitir una licencia. No hay checkout automático en esta página.</p></div><div class="map-pricing-plan-grid">${catalog.PLANS.map(renderPlan).join("")}</div></section>
      ${renderComparison()}
      ${renderProject()}
      <div data-map-nano-savings-calculator></div>
      <section class="map-pricing-return" aria-labelledby="map-pricing-return-title"><div><p class="map-pricing-eyebrow">Uso y retorno</p><h2 id="map-pricing-return-title">El valor depende del flujo de trabajo</h2></div><div><p>En laboratorios con flujo regular de análisis, el ahorro de tiempo técnico puede compensar total o parcialmente el costo de la licencia. El resultado depende del volumen de imágenes, los procedimientos actuales y el nivel de revisión requerido.</p><p>MAP-Nano no reemplaza el microscopio ni elimina la revisión técnica. Reduce trabajo repetitivo y ayuda a estandarizar el análisis.</p></div></section>
      ${renderFaq()}
    </main>`;

  window.BCCMapNanoSavingsCalculator?.render(root.querySelector("[data-map-nano-savings-calculator]"), { context: "public" });

  window.BCCAnalytics?.track("pricing_page_viewed", { product_key: "map.nano", section: "map_nano_pricing" }, { onceKey: "pricing:map-nano" });

  root.addEventListener("click", event => {
    const compare = event.target.closest("[data-map-pricing-compare]");
    if (compare) {
      root.querySelector("[data-map-pricing-comparison]").open = true;
      window.BCCAnalytics?.track("pricing_comparison_opened", { product_key: "map.nano" });
    }
    const savingsLink = event.target.closest("[data-map-pricing-savings]");
    if (savingsLink) window.BCCAnalytics?.track("savings_calculator_viewed", { product_key: "map.nano", source: "pricing_hero" }, { onceKey: "savings-calculator:hero" });
  });

  root.addEventListener("toggle", event => {
    const faq = event.target.closest?.("[data-map-pricing-faq]");
    if (faq?.open) {
      window.BCCAnalytics?.track("pricing_faq_opened", { product_key: "map.nano", faq_index: faq.dataset.mapPricingFaq }, { onceKey: `pricing-faq:${faq.dataset.mapPricingFaq}` });
    }
  }, true);
})();
