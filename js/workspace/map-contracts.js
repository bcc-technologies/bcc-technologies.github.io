(() => {
  const PRODUCTS = Object.freeze({
    "map.nano": "MAP Nano",
    "map.bio": "MAP Bio",
    "map.med": "MAP Med"
  });

  const STATUS = Object.freeze({
    active: { label: "Activa", tone: "success", icon: "check-circle-2", priority: 0 },
    scheduled: { label: "Programada", tone: "neutral", icon: "calendar-clock", priority: 1 },
    expiring: { label: "Vence pronto", tone: "warning", icon: "calendar-clock", priority: 2 },
    suspended: { label: "Suspendida", tone: "danger", icon: "activity", priority: 3 },
    expired: { label: "Vencida", tone: "danger", icon: "x", priority: 4 },
    revoked: { label: "Revocada", tone: "danger", icon: "x", priority: 5 },
    draft: { label: "Borrador", tone: "neutral", icon: "file-pen-line", priority: 6 },
    unknown: { label: "Sin estado", tone: "neutral", icon: "circle-help", priority: 7 }
  });

  const PLATFORM_ACCESS_LABELS = Object.freeze({
    "map.dev.access": "Desarrollo MAP",
    "map.release.manage": "Releases MAP",
    "platform.licenses.read": "Consulta de licencias",
    "platform.licenses.manage": "Gestión de licencias",
    "platform.evaluations.manage": "Evaluaciones",
    "platform.permissions.manage": "Permisos",
    "platform.analytics.read": "Analíticas"
  });

  const CLIENT_DASHBOARD_KEYS = Object.freeze(["accounts", "licenses", "members", "assignments", "recent_events"]);
  const ADMIN_DASHBOARD_KEYS = Object.freeze(["licenses", "accounts", "plans", "users", "cohorts", "access_users"]);
  const ERROR_TRANSLATIONS = Object.freeze([
    [/Authentication required|JWT|session/i, "Tu sesión expiró. Inicia sesión nuevamente."],
    [/Only an account owner or administrator/i, "Sólo el propietario o un administrador de la cuenta puede asignar plazas."],
    [/not an active account member/i, "El usuario seleccionado ya no es un miembro activo de la cuenta."],
    [/already has this license/i, "El usuario ya tiene asignada esta licencia."],
    [/already has an active license for this product/i, "El usuario ya tiene una licencia activa para este producto."],
    [/no remaining seats/i, "La licencia no tiene plazas disponibles."],
    [/Evaluation access is managed/i, "El acceso de evaluación es administrado por el equipo BCC."],
    [/Assignment is not active/i, "La plaza ya fue liberada o dejó de estar activa."],
    [/License is not active/i, "La licencia no está activa."],
    [/cannot release this assignment/i, "No tienes permiso para liberar esta plaza."],
    [/permission denied|insufficient permission|not authorized/i, "No tienes permisos para completar esta operación."],
    [/Failed to fetch|NetworkError|fetch resource|network request failed/i, "No pudimos conectar con MAP. Revisa tu conexión e inténtalo nuevamente."]
  ]);

  class MapContractError extends Error {
    constructor(code, message, options = {}) {
      super(message, options);
      this.name = "MapContractError";
      this.code = code;
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

  function effectiveStatus(license, now = Date.now()) {
    const startsAt = new Date(license?.starts_at || 0).getTime();
    const endsAt = new Date(license?.ends_at || 0).getTime();
    if (license?.license_status === "active" && endsAt && endsAt <= now) return "expired";
    if (license?.license_status === "active" && startsAt && startsAt > now) return "scheduled";
    if (license?.license_status === "active" && endsAt && endsAt - now <= 30 * 86400000) return "expiring";
    return STATUS[license?.license_status] ? license.license_status : "unknown";
  }

  function toLicenseViewModel(license, now = Date.now()) {
    const source = isRecord(license) ? license : {};
    const status = effectiveStatus(source, now);
    const seatLimit = Math.max(1, Number(source.seat_limit || 1));
    const assignedSeats = Math.max(0, Number(source.assigned_seats || 0));
    const availableSeats = Math.max(0, seatLimit - assignedSeats);
    return {
      ...source,
      productName: PRODUCTS[source.product_key] || source.product_key || "MAP",
      status,
      statusMeta: STATUS[status],
      seatLimit,
      assignedSeats,
      availableSeats,
      seatUsage: Math.min(100, Math.round((assignedSeats / seatLimit) * 100)),
      canManage: Boolean(source.can_manage_seats && !source.is_evaluation && status === "active"),
      needsAttention: ["expiring", "suspended", "expired", "revoked"].includes(status)
    };
  }

  function productName(key) {
    return PRODUCTS[key] || key || "MAP";
  }

  function platformAccessLabel(key) {
    return PLATFORM_ACCESS_LABELS[key] || key;
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
    const message = ERROR_TRANSLATIONS.find(([pattern]) => pattern.test(rawMessage))?.[1] || rawMessage || fallback;
    return new MapContractError(errorCode(error), message, { cause: error });
  }

  window.BCCWorkspaceMapContracts = Object.freeze({
    PRODUCTS,
    STATUS,
    PLATFORM_ACCESS_LABELS,
    MapContractError,
    isRecord,
    rows,
    normalizeClientDashboard,
    normalizeAdminDashboard,
    normalizeEntitlements,
    normalizePlatformAccess,
    effectiveStatus,
    toLicenseViewModel,
    productName,
    platformAccessLabel,
    toError
  });
})();
