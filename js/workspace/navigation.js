(() => {
  const STORAGE_VERSION = 2;
  const storagePrefix = `bcc-workspace-nav:v${STORAGE_VERSION}`;
  const NAVIGATION = {
    client: [
      { id: "overview", label: "Panel", open: true, items: [
        { href: "#resumen", label: "Inicio", icon: "layout-dashboard", active: true }
      ] },
      { id: "workspace", label: "Mi espacio", open: true, items: [
        { href: "#cuenta", label: "Cuenta", icon: "user-round-cog" },
        { href: "#operacion", label: "Operación", icon: "inbox" },
        { href: "#comercial", label: "Comercial", icon: "briefcase-business" }
      ] },
      { id: "admin", label: "Acceso interno", adminReturn: true, hidden: true, items: [
        { href: "/staff-dashboard.html", label: "Administración", icon: "shield-check", adminReturn: true, hidden: true }
      ] }
    ],
    staff: [
      { id: "workspace", label: "Espacio", open: true, items: [
        { href: "#resumen", label: "Inicio", icon: "layout-dashboard", active: true },
        { href: "#perfil", label: "Cuenta", icon: "user-round" },
        { href: "#trabajo", label: "Operación", icon: "workflow" }
      ] },
      { id: "content", label: "Contenido", open: true, cmsAccess: true, permission: "cms:access", hidden: true, items: [
        { href: "/cms.html", label: "Editorial", icon: "file-pen-line", cmsAccess: true, permission: "cms:access", hidden: true }
      ] },
      { id: "resources", label: "Recursos", open: true, items: [
        { href: "#conocimiento", label: "Conocimiento", icon: "notebook-tabs" }
      ] },
      { id: "management", label: "Gestión", permission: "admin:view", items: [
        { href: "#usuarios", label: "Usuarios", icon: "users-round", permission: "admin:view" },
        { href: "#roles", label: "Roles y permisos", icon: "key-round", permission: "admin:view" },
        { href: "#auditoria", label: "Auditoría", icon: "history", permission: "admin:view" }
      ] },
      { id: "licenses", label: "Licencias", permission: "licenses:view", items: [
        { href: "#licencias-maps", label: "Licencias MAPs", icon: "key-round", permission: "licenses:view" }
      ] },
      { id: "external-intelligence", label: "Inteligencia externa", permission: "department:manage", items: [
        { href: "#science-radar", label: "Science Radar", icon: "radar", permission: "department:manage" },
        { href: "#business-radar", label: "Business Radar", icon: "scan-search", permission: "department:manage" },
        { href: "#dominican-intelligence", label: "Dominican Intelligence", icon: "map", permission: "department:manage" }
      ] },
      { id: "internal-intelligence", label: "Inteligencia interna", permission: "department:manage", items: [
        { href: "#product-intelligence", label: "Product Intelligence", icon: "chart-no-axes-column-increasing", permission: "department:manage" },
        { href: "#performance-intelligence", label: "Performance Intelligence", icon: "gauge", permission: "department:manage" },
        { href: "#financial-intelligence", label: "Financial Intelligence", icon: "circle-dollar-sign", permission: "department:manage" },
        { href: "#bureaucracy-intelligence", label: "Bureaucracy Intelligence", icon: "file-cog", permission: "department:manage" },
        { href: "#marketing-intelligence", label: "Marketing Intelligence", icon: "megaphone", permission: "department:manage" }
      ] },
      { id: "crm", label: "CRM", permission: "department:manage", items: [
        { href: "#crm-correos", label: "Correos", icon: "mail-plus", permission: "department:manage" }
      ] }
    ]
  };
  const ROUTES = {
    client: {
      defaultView: "resumen",
      aliases: {
        perfil: "cuenta",
        seguridad: "cuenta",
        solicitudes: "operacion",
        formularios: "operacion",
        facturacion: "comercial",
        documentos: "comercial"
      }
    },
    staff: {
      defaultView: "resumen",
      aliases: {
        productividad: "trabajo",
        calendario: "trabajo",
        kpis: "trabajo",
        formularios: "trabajo",
        business: "product-intelligence",
        analytics: "product-intelligence",
        intelligence: "science-radar",
        prospectos: "crm-correos"
      },
      panelAliases: {
        productividad: "tareas",
        calendario: "agenda",
        kpis: "kpis",
        formularios: "formularios",
        analytics: "website",
        business: "website"
      },
      panels: {
        trabajo: ["tareas", "agenda", "kpis", "formularios"],
        "product-intelligence": ["website", "maps"],
        "performance-intelligence": ["general-kpis"],
        "financial-intelligence": ["finance-dashboard"],
        "bureaucracy-intelligence": ["documents", "processes"],
        "marketing-intelligence": ["audience", "campaigns", "content-performance"]
      }
    }
  };

  const access = (element, item) => {
    if (item.permission) element.dataset.permissionRequired = item.permission;
    if (item.cmsAccess) element.dataset.cmsAccess = "";
    if (item.adminReturn) element.dataset.adminReturn = "";
    if (item.hidden) element.hidden = true;
  };

  const stateKey = group => `${storagePrefix}:${group.dataset.navKey}:${group.dataset.groupId}`;

  function readState(navKey, groupId) {
    try {
      const current = localStorage.getItem(`${storagePrefix}:${navKey}:${groupId}`);
      const legacyKey = `bcc-workspace-nav-${navKey}-${groupId}`;
      const legacy = localStorage.getItem(legacyKey);
      if (legacy !== null) localStorage.removeItem(legacyKey);
      const value = current ?? legacy;
      return value === null ? null : value === "true";
    } catch {
      return null;
    }
  }

  function setGroupOpen(group, open, persist = true) {
    const trigger = group.querySelector(".workspace-nav-group-trigger");
    const children = group.querySelector(".workspace-nav-children");
    group.classList.toggle("is-open", open);
    trigger?.setAttribute("aria-expanded", String(open));
    if (children) children.hidden = !open;
    if (persist) {
      try { localStorage.setItem(stateKey(group), String(open)); } catch {}
    }
  }

  function renderLink(item, groupLabel) {
    const link = document.createElement("a");
    link.href = item.href;
    link.className = "workspace-nav-item";
    link.dataset.navLabel = item.label;
    link.dataset.navGroupLabel = groupLabel;
    link.setAttribute("aria-label", item.label);
    if (item.active) link.classList.add("active");
    access(link, item);
    if (item.icon) {
      const icon = document.createElement("i");
      icon.dataset.lucide = item.icon;
      link.append(icon);
    }
    const label = document.createElement("span");
    label.textContent = item.label;
    link.append(label);
    link.addEventListener("mouseenter", () => {
      const clipped = label.scrollWidth > label.clientWidth;
      link.title = document.body.classList.contains("workspace-collapsed")
        ? `${groupLabel}: ${item.label}`
        : clipped ? item.label : "";
    });
    return link;
  }

  function renderGroup(definition, navKey) {
    const group = document.createElement("section");
    const childrenId = `workspace-nav-${navKey}-${definition.id}`;
    group.className = "workspace-nav-group";
    group.dataset.navKey = navKey;
    group.dataset.groupId = definition.id;
    access(group, definition);

    const trigger = document.createElement("button");
    trigger.className = "workspace-nav-group-trigger";
    trigger.type = "button";
    trigger.setAttribute("aria-controls", childrenId);
    trigger.dataset.navLabel = definition.label;
    const chevron = document.createElement("i");
    chevron.dataset.lucide = "chevron-right";
    const label = document.createElement("span");
    label.textContent = definition.label;
    trigger.append(chevron, label);

    const children = document.createElement("div");
    children.id = childrenId;
    children.className = "workspace-nav-children";
    children.append(...definition.items.map(item => renderLink(item, definition.label)));
    group.append(trigger, children);

    const stored = readState(navKey, definition.id);
    setGroupOpen(group, Boolean(children.querySelector(".active")) || (stored ?? Boolean(definition.open)), false);
    trigger.addEventListener("click", () => setGroupOpen(group, !group.classList.contains("is-open")));
    children.addEventListener("click", event => {
      if (event.target.closest("a")) setGroupOpen(group, true);
    });
    return group;
  }

  const isVisible = element => !element.hidden && !element.closest("[hidden]");

  function bindKeyboard(target) {
    target.addEventListener("keydown", event => {
      const current = event.target.closest(".workspace-nav-group-trigger, .workspace-nav-item");
      if (!current) return;
      const controls = [...target.querySelectorAll(".workspace-nav-group-trigger, .workspace-nav-item")].filter(isVisible);
      const index = controls.indexOf(current);
      let next = null;
      if (event.key === "ArrowDown") next = controls[index + 1] || controls[0];
      if (event.key === "ArrowUp") next = controls[index - 1] || controls.at(-1);
      if (event.key === "Home") next = controls[0];
      if (event.key === "End") next = controls.at(-1);
      if (event.key === "ArrowRight" && current.matches(".workspace-nav-group-trigger")) {
        setGroupOpen(current.closest(".workspace-nav-group"), true);
        next = current.closest(".workspace-nav-group").querySelector(".workspace-nav-item:not([hidden])");
      }
      if (event.key === "ArrowLeft") {
        const group = current.closest(".workspace-nav-group");
        if (current.matches(".workspace-nav-group-trigger") && group.classList.contains("is-open")) {
          setGroupOpen(group, false);
        } else if (current.matches(".workspace-nav-item")) {
          next = group.querySelector(".workspace-nav-group-trigger");
        }
      }
      if (!next && !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      next?.focus();
    });
  }

  function syncTooltips(collapsed = document.body.classList.contains("workspace-collapsed")) {
    document.querySelectorAll(".workspace-nav-item").forEach(link => {
      const label = link.dataset.navLabel || "";
      const group = link.dataset.navGroupLabel || "";
      link.title = collapsed && group ? `${group}: ${label}` : "";
      link.setAttribute("aria-label", collapsed && group ? `${group}: ${label}` : label);
    });
  }

  function renderNavigation(target) {
    const key = target.dataset.workspaceNav;
    const groups = NAVIGATION[key];
    if (!groups) return;
    target.replaceChildren(...groups.map(group => renderGroup(group, key)));
    bindKeyboard(target);

    const openActiveGroup = () => {
      const group = target.querySelector(".workspace-nav-item.active")?.closest(".workspace-nav-group");
      if (group) setGroupOpen(group, true, false);
    };
    const observer = new MutationObserver(openActiveGroup);
    target.querySelectorAll(".workspace-nav-item").forEach(link => {
      observer.observe(link, { attributes: true, attributeFilter: ["class"] });
    });
    openActiveGroup();
  }

  function renderAll() {
    document.querySelectorAll("[data-workspace-nav]").forEach(renderNavigation);
    syncTooltips();
    document.dispatchEvent(new CustomEvent("bcc:workspace-navigation-ready"));
  }

  renderAll();
  window.BCCWorkspaceNavigation = {
    definitions: NAVIGATION,
    routes: ROUTES,
    renderAll,
    setGroupOpen,
    syncTooltips
  };
})();
