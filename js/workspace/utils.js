(() => {
  const BASE_ROLE_OPTIONS = [
    { value: "client", label: "Cliente" },
    { value: "staff", label: "Personal" },
    { value: "admin", label: "Administrador" }
  ];

  const STAFF_ROLE_OPTIONS = [
    { value: "author", label: "Autor" },
    { value: "cofounder", label: "Cofounder" },
    { value: "department_director", label: "Director" },
    { value: "maps_developer", label: "Desarrollador MAP" },
    { value: "maps_release_manager", label: "Responsable de releases MAP" },
    { value: "maps_license_manager", label: "Gestor de licencias MAP" },
    { value: "maps_product_analyst", label: "Analista de producto MAP" }
  ];

  const DEPARTMENT_OPTIONS = [
    { value: "technology", label: "Tecnología" },
    { value: "finance", label: "Finanzas" },
    { value: "operations", label: "Operaciones" },
    { value: "marketing", label: "Marketing" },
    { value: "hr", label: "Recursos humanos" }
  ];

  const PERMISSION_LABELS = {
    "dashboard:view": "Panel de cuenta",
    "profile:update": "Actualizar perfil",
    "downloads:view": "Descargas",
    "support:create": "Solicitar soporte",
    "staff:view": "Area de personal",
    "clients:view": "Consulta de clientes",
    "content:view": "Ver contenido",
    "content:write": "Editar contenido",
    "cms:access": "Acceso CMS",
    "forms:manage": "Gestionar formularios",
    "department:manage": "Gestion departamental",
    "strategy:view": "Estrategia",
    "admin:view": "Administración",
    "map.dev.access": "Desarrollo MAP",
    "map.release.manage": "Publicaciones MAP",
    "platform.licenses.read": "Consultar licencias MAP",
    "platform.licenses.manage": "Gestionar licencias MAP",
    "platform.evaluations.manage": "Gestionar evaluaciones MAP",
    "platform.permissions.manage": "Gestionar permisos MAP",
    "platform.analytics.read": "Analíticas MAP"
  };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char]));
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }

  function roleLabel(role, options = BASE_ROLE_OPTIONS) {
    return options.find(option => option.value === role)?.label || role;
  }

  function permissionLabel(permission, labels = PERMISSION_LABELS) {
    return labels[permission] || "";
  }

  function labelsFor(values = [], options = [], config = {}) {
    const unique = config.unique !== false;
    const source = Array.isArray(values) ? values : [];
    const active = unique ? [...new Set(source)] : source;
    const labels = new Map(options.map(option => [option.value, option.label]));
    return active.map(value => labels.get(value) || value).join(", ");
  }

  function sameSet(left = [], right = []) {
    const a = [...new Set(left)].sort();
    const b = [...new Set(right)].sort();
    return a.length === b.length && a.every((value, index) => value === b[index]);
  }

  function setText(target, value, root = document) {
    const nodes = typeof target === "string" ? root.querySelectorAll(target) : [target].filter(Boolean);
    nodes.forEach(el => {
      el.textContent = String(value);
    });
  }

  function formatDate(value, options = {}) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return options.empty ?? "";
    return date.toLocaleDateString(options.locale || "es-DO", options.dateOptions || {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  }

  function formatDateTime(value, options = {}) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return options.empty ?? "-";
    return date.toLocaleString(options.locale || "es-DO", options.dateOptions || {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function formatLocalDate(value, options = {}) {
    if (!value) return options.empty ?? "";
    return new Date(`${value}T12:00:00`).toLocaleDateString(options.locale || "es-DO", options.dateOptions || {
      day: "numeric",
      month: "short"
    });
  }

  function withTimeout(promise, timeoutMs, message) {
    let timerId = 0;
    const timeoutPromise = new Promise((_, reject) => {
      timerId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => {
      window.clearTimeout(timerId);
    });
  }

  function renderMessageBlock(target, text, tone = "neutral") {
    if (!target) return;
    const content = String(text || "").trim();
    target.dataset.tone = tone;
    target.replaceChildren(document.createTextNode(content));
    target.hidden = !content && target.hasAttribute("hidden");
    if (content.length < 170) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "workspace-message-copy";
    button.textContent = "Copiar detalle";
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(content);
        button.textContent = "Copiado";
        window.setTimeout(() => {
          button.textContent = "Copiar detalle";
        }, 1400);
      } catch {
        button.textContent = "No se pudo copiar";
      }
    });
    target.append(button);
  }

  function setMessage(target, text, tone = "neutral") {
    if (!target) return;
    renderMessageBlock(target, text, tone);
    target.hidden = !text;
  }

  function refreshIcons(root = document) {
    window.BCCWorkspaceIcons?.createIcons(root);
  }

  window.BCCWorkspaceUtils = {
    BASE_ROLE_OPTIONS,
    STAFF_ROLE_OPTIONS,
    DEPARTMENT_OPTIONS,
    PERMISSION_LABELS,
    escapeHtml,
    escapeAttr,
    roleLabel,
    permissionLabel,
    labelsFor,
    sameSet,
    setText,
    formatDate,
    formatDateTime,
    formatLocalDate,
    withTimeout,
    renderMessageBlock,
    setMessage,
    refreshIcons
  };
})();
