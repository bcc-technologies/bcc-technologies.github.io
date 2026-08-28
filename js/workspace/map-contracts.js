(() => {
  const PRODUCTS = Object.freeze({
    "map.nano": "MAP Nano",
    "map.bio": "MAP Bio",
    "map.med": "MAP Med"
  });

  const LICENSE_TYPES = Object.freeze({
    named_user: Object.freeze({
      key: "named_user",
      label: "Usuario individual",
      shortLabel: "Individual",
      eyebrow: "Uso personal",
      description: "Una licencia nominal para trabajar con MAP desde tu propio usuario.",
      seatLabel: "1 usuario nominal",
      durationLabel: "Vigencia contractual",
      defaultSeatLimit: 1,
      features: Object.freeze(["Acceso personal no compartido", "Proyectos y resultados asociados a tu usuario", "Activación web o desktop"]),
      icon: "user-round",
      ctaLabel: "Solicitar individual",
      isEvaluation: false
    }),
    organization: Object.freeze({
      key: "organization",
      label: "Equipo u organización",
      shortLabel: "Organización",
      eyebrow: "Trabajo colaborativo",
      description: "Plazas administrables para equipos que necesitan crecer y controlar sus accesos.",
      seatLabel: "Desde 5 plazas",
      durationLabel: "Capacidad ampliable",
      defaultSeatLimit: 5,
      features: Object.freeze(["Asignación y liberación de plazas", "Administración por propietarios y responsables", "Escalado según el tamaño del equipo"]),
      icon: "users",
      ctaLabel: "Cotizar para equipo",
      isEvaluation: false,
      recommended: true
    }),
    evaluation: Object.freeze({
      key: "evaluation",
      label: "Evaluación guiada",
      shortLabel: "Evaluación",
      eyebrow: "Validación inicial",
      description: "Acceso temporal coordinado por BCC para validar el producto en un caso de uso concreto.",
      seatLabel: "1 participante",
      durationLabel: "Duración según campaña",
      defaultSeatLimit: 1,
      features: Object.freeze(["Objetivo y alcance definidos", "Acceso temporal individual", "Seguimiento administrado por el equipo BCC"]),
      icon: "flask-conical",
      ctaLabel: "Solicitar evaluación",
      isEvaluation: true
    })
  });

  const TRIAL_OFFER_FALLBACK = Object.freeze({
    policy_key: "early_access",
    display_name: "Early access",
    duration_days: 14,
    is_campaign: true,
    standard_days: 7
  });

  const PRODUCT_CATALOG = Object.freeze({
    "map.nano": Object.freeze({
      category: "Materiales y superficies",
      description: "Convierte imágenes de microestructuras en métricas repetibles para investigación y control de calidad.",
      licenseTypes: Object.freeze(["named_user", "organization", "evaluation"]),
      features: Object.freeze(["Rugosidad, porosidad y morfología", "Exportables CSV y PDF", "Despliegue web o desktop"]),
      icon: "scan-line",
      productHref: "/product_maps_nano.html",
      requestHref: "/contactUs.html?product=map-nano&intent=license"
    }),
    "map.bio": Object.freeze({
      category: "Biología e imagen",
      description: "Automatiza conteo, clasificación y morfología para flujos de análisis biológico reproducibles.",
      licenseTypes: Object.freeze(["named_user", "organization", "evaluation"]),
      features: Object.freeze(["Conteo y clasificación", "Máscaras y mediciones", "Flujos web o desktop"]),
      icon: "activity",
      productHref: "/product_maps.html#map-bio",
      requestHref: "/contactUs.html?product=map-bio&intent=license"
    }),
    "map.med": Object.freeze({
      category: "Imagen clínica · I+D",
      description: "Organiza análisis asistido de imágenes médicas para proyectos de investigación y validación.",
      licenseTypes: Object.freeze(["named_user", "organization", "evaluation"]),
      features: Object.freeze(["Flujos guiados de imagen", "Resultados trazables", "Configuración por proyecto"]),
      icon: "shield-question",
      productHref: "/product_maps.html#map-med",
      requestHref: "/contactUs.html?product=map-med&intent=license"
    })
  });

  const STATUS = Object.freeze({
    active: { label: "Activa", tone: "success", icon: "check-circle-2", priority: 0 },
    scheduled: { label: "Programada", tone: "neutral", icon: "calendar-clock", priority: 1 },
    expiring: { label: "Vence pronto", tone: "warning", icon: "calendar-clock", priority: 2 },
    suspended: { label: "Suspendida", tone: "danger", icon: "activity", priority: 3 },
    cancelled: { label: "Cancelada", tone: "neutral", icon: "x", priority: 4 },
    expired: { label: "Vencida", tone: "danger", icon: "x", priority: 5 },
    revoked: { label: "Revocada", tone: "danger", icon: "x", priority: 6 },
    draft: { label: "Borrador", tone: "neutral", icon: "file-pen-line", priority: 7 },
    unknown: { label: "Sin estado", tone: "neutral", icon: "circle-help", priority: 8 }
  });

  const COMMERCIAL_REQUEST_STATUS = Object.freeze({
    pending: { label: "Pendiente", tone: "warning" },
    in_review: { label: "En revisión", tone: "warning" },
    resolved: { label: "Resuelta", tone: "success" },
    declined: { label: "No aprobada", tone: "danger" },
    cancelled: { label: "Cancelada", tone: "neutral" },
    unknown: { label: "Sin estado", tone: "neutral" }
  });

  const PLATFORM_ACCESS_LABELS = Object.freeze({
    "map.workspace.access": "Acceso al espacio MAP",
    "map.nano.use": "Análisis MAP-Nano",
    "map.nano.analysis.basic": "Análisis esencial MAP-Nano",
    "map.nano.analysis.advanced": "Módulos profesionales MAP-Nano",
    "map.nano.batch": "Procesamiento por lotes",
    "map.nano.pipelines.reuse": "Pipelines reutilizables",
    "map.nano.pipelines.share": "Biblioteca compartida de pipelines",
    "map.nano.samples.compare": "Comparación entre muestras",
    "map.nano.reports.auto": "Reportes profesionales automáticos",
    "map.nano.audit": "Trazabilidad de análisis",
    "map.nano.reports.institutional": "Plantillas de reportes institucionales",
    "map.nano.api": "API e integraciones MAP-Nano",
    "map.nano.support.priority": "Soporte prioritario MAP-Nano",
    "map.bio.use": "Análisis MAP-Bio",
    "map.med.use": "Análisis MAP-Med",
    "map.dev.access": "Desarrollo MAP",
    "map.release.manage": "Releases MAP",
    "platform.licenses.read": "Consulta de licencias",
    "platform.licenses.manage": "Gestión de licencias",
    "platform.evaluations.manage": "Evaluaciones",
    "platform.permissions.manage": "Permisos",
    "platform.analytics.read": "Analíticas"
  });

  const isEnglish = () => globalThis.document?.documentElement?.lang?.toLowerCase().startsWith("en");
  const EN_LICENSE_TYPES = Object.freeze({
    named_user: Object.freeze({
      label: "Named user", shortLabel: "Individual", eyebrow: "Personal use",
      description: "A named license for working with MAP from your own account.",
      seatLabel: "1 named user", durationLabel: "Contract term",
      features: Object.freeze(["Personal, non-shared access", "Projects and results linked to your account", "Web or desktop activation"]),
      ctaLabel: "Request individual access"
    }),
    organization: Object.freeze({
      label: "Team or organization", shortLabel: "Organization", eyebrow: "Collaborative work",
      description: "Manageable seats for teams that need to grow while controlling access.",
      seatLabel: "From 5 seats", durationLabel: "Scalable capacity",
      features: Object.freeze(["Assign and release seats", "Owner and manager administration", "Scale with the team"]),
      ctaLabel: "Request team pricing"
    }),
    evaluation: Object.freeze({
      label: "Guided evaluation", shortLabel: "Evaluation", eyebrow: "Initial validation",
      description: "Temporary BCC-coordinated access to validate the product for a specific use case.",
      seatLabel: "1 participant", durationLabel: "Campaign-based duration",
      features: Object.freeze(["Defined objective and scope", "Individual temporary access", "BCC-managed follow-up"]),
      ctaLabel: "Request evaluation"
    })
  });
  const EN_PRODUCT_CATALOG = Object.freeze({
    "map.nano": Object.freeze({
      category: "Materials and surfaces", description: "Turn microstructure images into repeatable metrics for research and quality control.",
      features: Object.freeze(["Roughness, porosity, and morphology", "CSV and PDF exports", "Web or desktop deployment"]),
      productHref: "/en/product_maps_nano.html", requestHref: "/en/contactUs.html?product=map-nano&intent=license"
    }),
    "map.bio": Object.freeze({
      category: "Biology and imaging", description: "Automate counting, classification, and morphology for reproducible biological-image analysis workflows.",
      features: Object.freeze(["Counting and classification", "Masks and measurements", "Web or desktop workflows"]),
      productHref: "/en/product_maps.html#map-bio", requestHref: "/en/contactUs.html?product=map-bio&intent=license"
    }),
    "map.med": Object.freeze({
      category: "Clinical imaging · R&D", description: "Organize assisted medical-image analysis for research and validation projects.",
      features: Object.freeze(["Guided imaging workflows", "Traceable results", "Project-based configuration"]),
      productHref: "/en/product_maps.html#map-med", requestHref: "/en/contactUs.html?product=map-med&intent=license"
    })
  });
  const EN_STATUS = Object.freeze({
    active: Object.freeze({ label: "Active" }), scheduled: Object.freeze({ label: "Scheduled" }), expiring: Object.freeze({ label: "Expires soon" }),
    suspended: Object.freeze({ label: "Suspended" }), cancelled: Object.freeze({ label: "Cancelled" }), expired: Object.freeze({ label: "Expired" }), revoked: Object.freeze({ label: "Revoked" }),
    draft: Object.freeze({ label: "Draft" }), unknown: Object.freeze({ label: "No status" })
  });
  const EN_COMMERCIAL_REQUEST_STATUS = Object.freeze({
    pending: Object.freeze({ label: "Pending" }), in_review: Object.freeze({ label: "In review" }), resolved: Object.freeze({ label: "Resolved" }),
    declined: Object.freeze({ label: "Not approved" }), cancelled: Object.freeze({ label: "Cancelled" }), unknown: Object.freeze({ label: "No status" })
  });
  const EN_PLATFORM_ACCESS_LABELS = Object.freeze({
    "map.workspace.access": "MAP workspace access", "map.nano.use": "MAP-Nano analysis",
    "map.nano.analysis.basic": "Essential MAP-Nano analysis", "map.nano.analysis.advanced": "Professional MAP-Nano modules",
    "map.nano.batch": "Batch processing", "map.nano.pipelines.reuse": "Reusable pipelines", "map.nano.pipelines.share": "Shared pipeline library",
    "map.nano.samples.compare": "Cross-sample comparison", "map.nano.reports.auto": "Automatic professional reports",
    "map.nano.audit": "Analysis audit trail", "map.nano.reports.institutional": "Institutional report templates",
    "map.nano.api": "MAP-Nano API and integrations", "map.nano.support.priority": "Priority MAP-Nano support",
    "map.bio.use": "MAP-Bio analysis", "map.med.use": "MAP-Med analysis",
    "map.dev.access": "MAP development", "map.release.manage": "MAP releases", "platform.licenses.read": "License viewing",
    "platform.licenses.manage": "License management", "platform.evaluations.manage": "Evaluations", "platform.permissions.manage": "Permissions", "platform.analytics.read": "Analytics"
  });
  const localizeRecords = (source, translations) => Object.freeze(Object.fromEntries(Object.entries(source).map(([key, value]) => [key, Object.freeze({ ...value, ...(translations[key] || {}) })])));
  const LOCALIZED_LICENSE_TYPES = isEnglish() ? localizeRecords(LICENSE_TYPES, EN_LICENSE_TYPES) : LICENSE_TYPES;
  const LOCALIZED_PRODUCT_CATALOG = isEnglish() ? localizeRecords(PRODUCT_CATALOG, EN_PRODUCT_CATALOG) : PRODUCT_CATALOG;
  const LOCALIZED_STATUS = isEnglish() ? localizeRecords(STATUS, EN_STATUS) : STATUS;
  const LOCALIZED_COMMERCIAL_REQUEST_STATUS = isEnglish() ? localizeRecords(COMMERCIAL_REQUEST_STATUS, EN_COMMERCIAL_REQUEST_STATUS) : COMMERCIAL_REQUEST_STATUS;
  const LOCALIZED_PLATFORM_ACCESS_LABELS = isEnglish() ? Object.freeze({ ...PLATFORM_ACCESS_LABELS, ...EN_PLATFORM_ACCESS_LABELS }) : PLATFORM_ACCESS_LABELS;

  const CLIENT_DASHBOARD_KEYS = Object.freeze(["accounts", "licenses", "members", "assignments", "recent_events"]);
  const ADMIN_DASHBOARD_KEYS = Object.freeze(["licenses", "accounts", "institutions", "plans", "users", "cohorts", "access_users"]);
  const ERROR_TRANSLATIONS = Object.freeze([
    [/Authentication required|JWT|session/i, "Tu sesión expiró. Inicia sesión nuevamente."],
    [/Only an account owner or administrator/i, "Sólo el propietario o un administrador de la cuenta puede asignar plazas."],
    [/not an active account member/i, "El usuario seleccionado ya no es un miembro activo de la cuenta."],
    [/already has this license/i, "El usuario ya tiene asignada esta licencia."],
    [/already has an active license for this product/i, "El usuario ya tiene una licencia activa para este producto."],
    [/no remaining seats/i, "La licencia no tiene plazas disponibles."],
    [/Evaluation access is managed/i, "El acceso de evaluación es administrado por el equipo BCC."],
    [/Assignment is not active/i, "La plaza ya fue liberada o dejó de estar activa."],
    [/open commercial request already exists|duplicate key value violates unique constraint.*map_nano_commercial_requests_one_open_change/i, "Ya existe una solicitud comercial abierta para este plan."],
    [/commercial request is not open or cannot be cancelled/i, "La solicitud ya no está abierta o no tienes permiso para cancelarla."],
    [/resolution note is required/i, "Agrega una nota de resolución antes de cerrar la solicitud."],
    [/commercial request is not open for review/i, "La solicitud ya no está disponible para revisión."],
    [/License is not active/i, "La licencia no está activa."],
    [/selected institution is not active/i, "La institución seleccionada no está activa."],
    [/evaluation cohort is not active/i, "La cohorte de evaluación no está activa."],
    [/valid participant email/i, "Ingresa un correo válido para el tester."],
    [/participant name is required/i, "Ingresa el nombre del tester."],
    [/valid MAP product|MAP product is required/i, "Selecciona un producto MAP válido."],
    [/valid start and end time/i, "Revisa las fechas de inicio y fin del acceso tester."],
    [/MAP invitation service is unavailable/i, "El servicio de invitaciones MAP no está disponible. Inténtalo nuevamente."],
    [/cohort does not belong to the selected institution/i, "La cohorte no pertenece a la institución seleccionada."],
    [/grant reason/i, "Agrega una justificación de al menos 10 caracteres."],
    [/already has active MAP access for this product/i, "El usuario ya tiene acceso MAP activo para este producto."],
    [/cannot release this assignment/i, "No tienes permiso para liberar esta plaza."],
    [/permission denied|insufficient permission|not authorized|not allowed/i, "No tienes permisos para completar esta operación."],
    [/Failed to fetch|NetworkError|fetch resource|network request failed/i, "No pudimos conectar con MAP. Revisa tu conexión e inténtalo nuevamente."]
  ]);

  class MapContractError extends Error {
    constructor(code, message, options = {}) {
      super(message, options);
      this.name = "MapContractError";
      this.code = code;
      this.diagnosticId = String(options.diagnosticId || "");
    }
  }

  function isRecord(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function rows(value) {
    return Array.isArray(value) ? value.filter(isRecord) : [];
  }

  function dashboard(value, keys) {
    const source = isRecord(value) ? value : {};
    return Object.fromEntries(keys.map(key => [key, rows(source[key])]));
  }

  function normalizeClientDashboard(value) {
    return dashboard(value, CLIENT_DASHBOARD_KEYS);
  }

  function normalizeAdminDashboard(value) {
    const source = isRecord(value) ? value : {};
    return {
      overview: isRecord(source.overview) ? source.overview : {},
      ...dashboard(source, ADMIN_DASHBOARD_KEYS)
    };
  }

  function normalizeEntitlements(value) {
    return rows(value).filter(item => typeof item.entitlement_key === "string");
  }

  function normalizePlatformAccess(value) {
    return [...new Set(rows(value)
      .filter(item => item.access_source === "internal_role")
      .map(item => String(item.access_key || "").trim())
      .filter(Boolean))];
  }

  function normalizeEffectiveAccess(value) {
    return rows(value)
      .filter(item => typeof item.access_key === "string" && item.access_key.trim())
      .map(item => ({
        access_key: item.access_key.trim(),
        access_source: String(item.access_source || "unknown"),
        product_key: String(item.product_key || ""),
        license_id: String(item.license_id || ""),
        valid_until: item.valid_until || null
      }));
  }

  function normalizeTrialOffer(value) {
    const source = rows(value)[0] || (isRecord(value) ? value : {});
    const durationDays = Math.max(1, Math.min(90, Number(source.duration_days) || TRIAL_OFFER_FALLBACK.duration_days));
    return Object.freeze({
      policy_key: String(source.policy_key || TRIAL_OFFER_FALLBACK.policy_key),
      display_name: String(source.display_name || TRIAL_OFFER_FALLBACK.display_name),
      duration_days: durationDays,
      is_campaign: source.is_campaign === undefined ? TRIAL_OFFER_FALLBACK.is_campaign : Boolean(source.is_campaign),
      standard_days: TRIAL_OFFER_FALLBACK.standard_days
    });
  }

  function normalizeCommercialRequests(value) {
    return rows(value)
      .filter(item => typeof item.request_id === "string" && typeof item.plan_key === "string")
      .map(item => ({
        request_id: item.request_id,
        account_id: typeof item.account_id === "string" ? item.account_id : "",
        plan_key: item.plan_key,
        request_type: String(item.request_type || ""),
        status: String(item.status || "unknown"),
        organization_name: String(item.organization_name || ""),
        created_at: item.created_at || null,
        updated_at: item.updated_at || null,
        cancelled_at: item.cancelled_at || null,
        can_cancel: Boolean(item.can_cancel)
      }));
  }

  function normalizeCommercialRequestQueue(value) {
    return rows(value)
      .filter(item => typeof item.request_id === "string" && typeof item.plan_key === "string")
      .map(item => ({
        request_id: item.request_id,
        account_id: typeof item.account_id === "string" ? item.account_id : "",
        plan_key: item.plan_key,
        request_type: String(item.request_type || ""),
        status: String(item.status || "unknown"),
        contact_name: String(item.contact_name || ""),
        contact_email: String(item.contact_email || ""),
        organization_name: String(item.organization_name || ""),
        country: String(item.country || ""),
        estimated_users: Math.max(0, Number(item.estimated_users) || 0),
        analysis_volume: String(item.analysis_volume || "unknown"),
        message: String(item.message || ""),
        created_at: item.created_at || null,
        updated_at: item.updated_at || null,
        cancelled_at: item.cancelled_at || null,
        cancellation_note: String(item.cancellation_note || ""),
        reviewed_at: item.reviewed_at || null,
        reviewed_by_name: String(item.reviewed_by_name || ""),
        resolution_note: String(item.resolution_note || "")
      }));
  }

  function commercialRequestStatus(status) {
    return LOCALIZED_COMMERCIAL_REQUEST_STATUS[String(status || "").toLowerCase()] || LOCALIZED_COMMERCIAL_REQUEST_STATUS.unknown;
  }

  function effectiveStatus(license, now = Date.now(), billingSubscription = null) {
    const subscriptionStatus = String(billingSubscription?.status || license?.billing_status || "").toLowerCase();
    if (subscriptionStatus === "canceled") return "cancelled";
    const startsAt = new Date(license?.starts_at || 0).getTime();
    const endsAt = new Date(license?.ends_at || 0).getTime();
    if (license?.license_status === "active" && endsAt && endsAt <= now) return "expired";
    if (license?.license_status === "active" && startsAt && startsAt > now) return "scheduled";
    if (license?.license_status === "active" && endsAt && endsAt - now <= 30 * 86400000) return "expiring";
    return STATUS[license?.license_status] ? license.license_status : "unknown";
  }

  function toLicenseViewModel(license, now = Date.now(), billingSubscription = null) {
    const source = isRecord(license) ? license : {};
    const status = effectiveStatus(source, now, billingSubscription);
    const seatLimit = Math.max(1, Number(source.seat_limit || 1));
    const assignedSeats = Math.max(0, Number(source.assigned_seats || 0));
    const availableSeats = Math.max(0, seatLimit - assignedSeats);
    return {
      ...source,
      productName: PRODUCTS[source.product_key] || source.product_key || "MAP",
      status,
      statusMeta: LOCALIZED_STATUS[status],
      seatLimit,
      assignedSeats,
      availableSeats,
      seatUsage: Math.min(100, Math.round((assignedSeats / seatLimit) * 100)),
      canManage: Boolean(source.can_manage_seats && !source.is_evaluation && status === "active"),
      needsAttention: ["expiring", "suspended"].includes(status)
    };
  }

  function sameLicenseScope(left, right) {
    if (left?.product_key !== right?.product_key) return false;
    if (left?.account_id && right?.account_id) return left.account_id === right.account_id;
    return true;
  }

  function hasCurrentReplacement(candidate, licenses) {
    const replacementStatuses = candidate?.status === "expiring"
      ? ["active", "scheduled"]
      : ["active", "scheduled", "expiring"];
    return licenses.some(item => item?.license_id !== candidate?.license_id
      && sameLicenseScope(candidate, item)
      && replacementStatuses.includes(item.status));
  }

  function attentionLicense(licenses) {
    const items = rows(licenses);
    return items.find(item => item.needsAttention && !hasCurrentReplacement(item, items)) || null;
  }

  function productName(key) {
    return PRODUCTS[key] || key || "MAP";
  }

  function productCatalog(key) {
    return LOCALIZED_PRODUCT_CATALOG[key] || null;
  }

  function licenseType(key) {
    return LOCALIZED_LICENSE_TYPES[key] || null;
  }

  function productLicenseTypes(key) {
    const product = productCatalog(key);
    return (product?.licenseTypes || []).map(licenseType).filter(Boolean);
  }

  function platformAccessLabel(key) {
    return LOCALIZED_PLATFORM_ACCESS_LABELS[key] || key;
  }

  function errorCode(error) {
    const rawCode = String(error?.code || "");
    const message = String(error?.message || error || "");
    if (rawCode === "42501" || /permission denied/i.test(message)) return "permission_denied";
    if (["401", "PGRST301"].includes(String(error?.status || rawCode)) || /JWT|session|Authentication required/i.test(message)) return "session_expired";
    if (/Failed to fetch|NetworkError|fetch resource|network request failed/i.test(message)) return "network_error";
    if (rawCode.startsWith("PGRST")) return "invalid_response";
    return "operation_failed";
  }

  function toError(error, fallback = "No fue posible completar la operación MAP.") {
    if (error instanceof MapContractError) return error;
    const rawMessage = String(error?.message || error || fallback);
    const translatedMessage = ERROR_TRANSLATIONS.find(([pattern]) => pattern.test(rawMessage))?.[1] || rawMessage || fallback;
    const diagnosticId = String(error?.diagnosticId || error?.cause?.diagnosticId || "").trim();
    const message = diagnosticId ? `${translatedMessage} Referencia: ${diagnosticId}.` : translatedMessage;
    return new MapContractError(errorCode(error), message, { cause: error, diagnosticId });
  }

  window.BCCWorkspaceMapContracts = Object.freeze({
    PRODUCTS,
    PRODUCT_CATALOG: LOCALIZED_PRODUCT_CATALOG,
    LICENSE_TYPES: LOCALIZED_LICENSE_TYPES,
    TRIAL_OFFER_FALLBACK,
    STATUS: LOCALIZED_STATUS,
    COMMERCIAL_REQUEST_STATUS: LOCALIZED_COMMERCIAL_REQUEST_STATUS,
    PLATFORM_ACCESS_LABELS: LOCALIZED_PLATFORM_ACCESS_LABELS,
    MapContractError,
    isRecord,
    rows,
    normalizeClientDashboard,
    normalizeAdminDashboard,
    normalizeEntitlements,
    normalizePlatformAccess,
    normalizeEffectiveAccess,
    normalizeTrialOffer,
    normalizeCommercialRequests,
    normalizeCommercialRequestQueue,
    effectiveStatus,
    toLicenseViewModel,
    attentionLicense,
    productName,
    productCatalog,
    licenseType,
    productLicenseTypes,
    platformAccessLabel,
    commercialRequestStatus,
    toError
  });
})();
