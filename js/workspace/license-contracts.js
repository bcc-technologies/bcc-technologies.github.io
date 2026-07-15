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

  function effectiveStatus(license, now = Date.now()) {
    const startsAt = new Date(license?.starts_at || 0).getTime();
    const endsAt = new Date(license?.ends_at || 0).getTime();
    if (license?.license_status === "active" && endsAt && endsAt <= now) return "expired";
    if (license?.license_status === "active" && startsAt && startsAt > now) return "scheduled";
    if (license?.license_status === "active" && endsAt && endsAt - now <= 30 * 86400000) return "expiring";
    return STATUS[license?.license_status] ? license.license_status : "unknown";
  }

  function toViewModel(license, now = Date.now()) {
    const status = effectiveStatus(license, now);
    const seatLimit = Math.max(1, Number(license?.seat_limit || 1));
    const assignedSeats = Number(license?.assigned_seats || 0);
    const availableSeats = Math.max(0, seatLimit - assignedSeats);
    return {
      ...license,
      productName: PRODUCTS[license?.product_key] || license?.product_key || "MAP",
      status,
      statusMeta: STATUS[status],
      seatLimit,
      assignedSeats,
      availableSeats,
      seatUsage: Math.min(100, Math.round((assignedSeats / seatLimit) * 100)),
      canManage: Boolean(license?.can_manage_seats && !license?.is_evaluation && status === "active"),
      needsAttention: ["expiring", "suspended", "expired", "revoked"].includes(status)
    };
  }

  window.BCCWorkspaceLicenses = Object.freeze({ PRODUCTS, STATUS, effectiveStatus, toViewModel });
})();
