(() => {
  /**
   * Commercial catalog for MAP-Nano.
   *
   * This file is intentionally independent from license authorization. The
   * platform license service remains the authority for issued licenses and
   * effective technical capabilities; this catalog only describes what BCC
   * offers commercially and feeds public and customer-facing UI.
   *
   * @typedef {"year" | "project" | "custom"} MAPNanoBillingPeriod
   * @typedef {"request_access" | "request_quote" | "contact_sales"} MAPNanoCtaAction
   * @typedef {"basic_analysis" | "advanced_analysis" | "batch_processing" | "reusable_pipelines" | "shared_pipelines" | "sample_comparison" | "automatic_reports" | "audit_logs" | "institutional_reports" | "api_access" | "priority_support"} MAPNanoEntitlement
   * @typedef {{ namedUsers?: number, concurrentUsers?: number, installations?: number }} MAPNanoLimits
   * @typedef {{ label: string, action: MAPNanoCtaAction }} MAPNanoCta
   * @typedef {{ id: string, name: string, description: string, annualPrice: number | null, startingPrice?: number, currency: "USD", billingPeriod: MAPNanoBillingPeriod, highlighted?: boolean, badge?: string, targetCustomer: readonly string[], features: readonly string[], exclusions?: readonly string[], entitlements: readonly MAPNanoEntitlement[], limits: MAPNanoLimits, cta: MAPNanoCta }} MAPNanoPlan
   */

  const USD_FORMATTER = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0
  });

  const ENTITLEMENTS = Object.freeze({
    basic_analysis: "Análisis cuantitativo esencial",
    advanced_analysis: "Módulos profesionales de análisis",
    batch_processing: "Procesamiento por lotes",
    reusable_pipelines: "Pipelines reutilizables",
    shared_pipelines: "Biblioteca compartida de pipelines",
    sample_comparison: "Comparación entre muestras",
    automatic_reports: "Informes automáticos",
    audit_logs: "Registros de auditoría",
    institutional_reports: "Plantillas institucionales de reportes",
    api_access: "Acceso a API e integraciones",
    priority_support: "Soporte prioritario"
  });

  const COMPARISON_FEATURES = Object.freeze([
    Object.freeze({ id: "basic_analysis", label: "Análisis cuantitativo esencial", description: "Tamaño, distribución, porosidad, forma, geometría y calibración de escala." }),
    Object.freeze({ id: "advanced_analysis", label: "Módulos profesionales", description: "Módulos profesionales disponibles de MAP-Nano." }),
    Object.freeze({ id: "batch_processing", label: "Procesamiento por lotes", description: "Ejecuta análisis sobre conjuntos de imágenes con una configuración definida." }),
    Object.freeze({ id: "reusable_pipelines", label: "Pipelines reutilizables", description: "Guarda configuraciones para repetir procedimientos." }),
    Object.freeze({ id: "shared_pipelines", label: "Biblioteca compartida", description: "Comparte pipelines entre operadores autorizados." }),
    Object.freeze({ id: "sample_comparison", label: "Comparación entre muestras", description: "Revisa resultados entre muestras desde un flujo común." }),
    Object.freeze({ id: "automatic_reports", label: "Informes automáticos", description: "Genera informes y exportaciones profesionales." }),
    Object.freeze({ id: "audit_logs", label: "Trazabilidad y auditoría", description: "Conserva historial de análisis y registros de auditoría." }),
    Object.freeze({ id: "institutional_reports", label: "Reportes institucionales", description: "Aplica plantillas institucionales de reporte." }),
    Object.freeze({ id: "api_access", label: "API e integraciones", description: "Disponible según alcance institucional contratado." }),
    Object.freeze({ id: "priority_support", label: "Soporte prioritario", description: "Atención prioritaria para equipos que la requieren." })
  ]);

  /** @type {readonly MAPNanoPlan[]} */
  const PLANS = Object.freeze([
    Object.freeze({
      id: "essential",
      name: "MAP-Nano Essential",
      description: "Para investigación individual y laboratorios pequeños con uso moderado.",
      annualPrice: 1200,
      currency: "USD",
      billingPeriod: "year",
      targetCustomer: Object.freeze(["Investigadores individuales", "Laboratorios pequeños", "Equipos con uso moderado"]),
      features: Object.freeze([
        "Una licencia individual",
        "Análisis cuantitativo esencial",
        "Tamaño y distribución de partículas",
        "Porosidad, forma y medidas geométricas",
        "Calibración de escala y exportación de resultados",
        "Actualizaciones ordinarias y soporte básico"
      ]),
      exclusions: Object.freeze(["Procesamiento por lotes avanzado", "Pipelines compartidos", "Funciones institucionales", "Soporte prioritario e integraciones personalizadas"]),
      entitlements: Object.freeze(["basic_analysis"]),
      limits: Object.freeze({ namedUsers: 1 }),
      cta: Object.freeze({ label: "Solicitar licencia", action: "request_access" })
    }),
    Object.freeze({
      id: "professional",
      name: "MAP-Nano Professional",
      description: "Para laboratorios activos que procesan imágenes de forma regular.",
      annualPrice: 3000,
      currency: "USD",
      billingPeriod: "year",
      highlighted: true,
      badge: "Recomendado",
      targetCustomer: Object.freeze(["Laboratorios activos", "Equipos de investigación", "Flujos regulares de imágenes"]),
      features: Object.freeze([
        "Todo lo incluido en Essential",
        "Módulos profesionales disponibles de MAP-Nano",
        "Procesamiento por lotes",
        "Pipelines y configuraciones reutilizables",
        "Comparación entre muestras e informes automáticos",
        "Historial de análisis, exportaciones profesionales y sesión inicial",
        "Soporte técnico estándar y hasta dos instalaciones asociadas"
      ]),
      entitlements: Object.freeze(["basic_analysis", "advanced_analysis", "batch_processing", "reusable_pipelines", "sample_comparison", "automatic_reports"]),
      limits: Object.freeze({ namedUsers: 1, installations: 2 }),
      cta: Object.freeze({ label: "Solicitar Professional", action: "request_access" })
    }),
    Object.freeze({
      id: "facility",
      name: "MAP-Nano Facility",
      description: "Para core facilities, laboratorios comerciales y equipos con varios operadores.",
      annualPrice: 6000,
      currency: "USD",
      billingPeriod: "year",
      targetCustomer: Object.freeze(["Core facilities", "Laboratorios comerciales", "Empresas", "Equipos con varios operadores"]),
      features: Object.freeze([
        "Todo lo incluido en Professional",
        "Hasta cinco usuarios nominativos o tres usuarios concurrentes",
        "Biblioteca compartida de pipelines y perfiles con permisos",
        "Estandarización de procedimientos y registros de auditoría",
        "Procesamiento por lotes a mayor escala",
        "Plantillas institucionales, capacitación inicial y soporte prioritario",
        "Migración de configuraciones y revisión periódica de uso"
      ]),
      entitlements: Object.freeze(["basic_analysis", "advanced_analysis", "batch_processing", "reusable_pipelines", "shared_pipelines", "sample_comparison", "automatic_reports", "audit_logs", "institutional_reports", "priority_support"]),
      limits: Object.freeze({ namedUsers: 5, concurrentUsers: 3 }),
      cta: Object.freeze({ label: "Solicitar Facility", action: "request_quote" })
    }),
    Object.freeze({
      id: "institutional",
      name: "MAP-Nano Institutional",
      description: "Para universidades, redes de laboratorios e implementaciones multisede.",
      annualPrice: null,
      startingPrice: 10000,
      currency: "USD",
      billingPeriod: "custom",
      targetCustomer: Object.freeze(["Universidades", "Redes de laboratorios", "Instituciones públicas", "Grandes empresas", "Implementaciones multisede"]),
      features: Object.freeze([
        "Licencias flotantes y varios departamentos o sedes",
        "Despliegue local y autenticación institucional, según alcance",
        "API e integración con LIMS, según alcance",
        "SLA, capacitación recurrente y soporte especializado",
        "Módulos personalizados y desarrollo prioritario, según contrato"
      ]),
      entitlements: Object.freeze(["basic_analysis", "advanced_analysis", "batch_processing", "reusable_pipelines", "shared_pipelines", "sample_comparison", "automatic_reports", "audit_logs", "institutional_reports", "api_access", "priority_support"]),
      limits: Object.freeze({}),
      cta: Object.freeze({ label: "Contactar ventas", action: "contact_sales" })
    })
  ]);

  const PROJECT_ACCESS = Object.freeze({
    id: "project",
    name: "MAP-Nano Project",
    description: "¿Solo necesitas MAP-Nano para un proyecto específico? Solicita acceso temporal o análisis asistido.",
    startingPrice: 300,
    priceRange: Object.freeze({ min: 300, max: 500 }),
    currency: "USD",
    billingPeriod: "project",
    cta: Object.freeze({ label: "Consultar acceso por proyecto", action: "request_quote" })
  });

  const STATUS = Object.freeze({
    active: Object.freeze({ label: "Activa", tone: "success" }),
    trial: Object.freeze({ label: "Prueba", tone: "neutral" }),
    pending: Object.freeze({ label: "Pendiente", tone: "warning" }),
    expired: Object.freeze({ label: "Vencida", tone: "danger" }),
    cancelled: Object.freeze({ label: "Cancelada", tone: "danger" }),
    none: Object.freeze({ label: "Sin licencia", tone: "neutral" }),
    unknown: Object.freeze({ label: "Estado no reconocido", tone: "neutral" })
  });

  function formatUsd(value) {
    const amount = Number(value);
    return Number.isFinite(amount) ? `US${USD_FORMATTER.format(amount)}` : "Precio personalizado";
  }

  function monthlyEquivalent(plan) {
    return Number.isFinite(plan?.annualPrice) ? plan.annualPrice / 12 : null;
  }

  function priceLabel(plan) {
    if (Number.isFinite(plan?.annualPrice)) return `${formatUsd(plan.annualPrice)}/año`;
    if (Number.isFinite(plan?.startingPrice)) return `Desde ${formatUsd(plan.startingPrice)}/año`;
    return "Precio personalizado";
  }

  function monthlyLabel(plan) {
    const monthly = monthlyEquivalent(plan);
    return monthly === null ? "" : `${formatUsd(monthly)}/mes · facturado anualmente`;
  }

  function projectPriceLabel(project = PROJECT_ACCESS) {
    if (Number.isFinite(project?.priceRange?.min) && Number.isFinite(project?.priceRange?.max)) {
      return `${formatUsd(project.priceRange.min)}–${formatUsd(project.priceRange.max)} por proyecto`;
    }
    return Number.isFinite(project?.startingPrice) ? `Desde ${formatUsd(project.startingPrice)}` : "Precio según alcance";
  }

  function planById(id) {
    return PLANS.find(plan => plan.id === id) || null;
  }

  function normalizePlanId(value) {
    return String(value || "").trim().toLowerCase().replace(/^map[-\s]?nano\s*/i, "").replace(/[^a-z]+/g, "");
  }

  function planIdForLicense(license) {
    const explicit = String(license?.commercial_plan_key || license?.plan_key || "").trim().toLowerCase();
    if (planById(explicit)) return explicit;
    const normalized = normalizePlanId(license?.plan_name);
    return planById(normalized) ? normalized : null;
  }

  function hasEntitlement(plan, entitlement) {
    return Boolean(plan?.entitlements?.includes(entitlement));
  }

  function requestTypeForPlan(planId, options = {}) {
    if (planId === "institutional") return "institutional_quote";
    if (planId === "project") return "project_access";
    if (options.upgrade) return "upgrade";
    return "new_license";
  }

  function requestUrl(planId, options = {}) {
    const params = new URLSearchParams({
      product: "map-nano",
      intent: requestTypeForPlan(planId, options),
      plan: planId || ""
    });
    return `/contactUs.html?${params.toString()}`;
  }

  function statusForLicense(license) {
    const source = String(license?.license_status || license?.status || "").toLowerCase();
    if (license?.is_evaluation) return STATUS.trial;
    if (["active", "expiring"].includes(source)) return STATUS.active;
    if (["scheduled", "draft"].includes(source)) return STATUS.pending;
    if (source === "expired") return STATUS.expired;
    if (["revoked", "cancelled", "canceled"].includes(source)) return STATUS.cancelled;
    if (!source) return STATUS.none;
    return STATUS.unknown;
  }

  window.BCCMapNanoPlans = Object.freeze({
    ENTITLEMENTS,
    COMPARISON_FEATURES,
    PLANS,
    PROJECT_ACCESS,
    STATUS,
    formatUsd,
    monthlyEquivalent,
    priceLabel,
    monthlyLabel,
    projectPriceLabel,
    planById,
    planIdForLicense,
    hasEntitlement,
    requestTypeForPlan,
    requestUrl,
    statusForLicense
  });
})();
