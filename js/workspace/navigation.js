(() => {
  const NAVIGATION = {
    client: [
      { type: "label", label: "Panel" },
      { href: "#resumen", label: "Inicio", icon: "layout-dashboard", active: true },
      { href: "#cuenta", label: "Cuenta", icon: "user-round-cog" },
      { href: "#operacion", label: "Operación", icon: "inbox" },
      { href: "#comercial", label: "Comercial", icon: "briefcase-business" },
      { href: "/staff-dashboard.html", label: "Administración", icon: "shield-check", adminReturn: true, hidden: true }
    ],
    staff: [
      { type: "label", label: "Personal" },
      { href: "#resumen", label: "Inicio", icon: "layout-dashboard", active: true },
      { href: "#perfil", label: "Cuenta", icon: "user-round" },
      { href: "#trabajo", label: "Operación", icon: "workflow" },
      { type: "label", label: "CMS", cmsAccess: true, permission: "cms:access", hidden: true },
      { href: "/cms.html", label: "Editorial", icon: "file-pen-line", cmsAccess: true, permission: "cms:access", hidden: true },
      { href: "#conocimiento", label: "Conocimiento", icon: "notebook-tabs" },
      { type: "label", label: "Gestión", permission: "admin:view" },
      { href: "#usuarios", label: "Usuarios", icon: "users-round", permission: "admin:view" },
      { href: "#roles", label: "Roles y permisos", icon: "key-round", permission: "admin:view" },
      { href: "#auditoria", label: "Auditoría", icon: "history", permission: "admin:view" },
      { type: "label", label: "External Intelligence", permission: "department:manage" },
      { href: "#science-radar", label: "Science Radar", icon: "radar", permission: "department:manage" },
      { href: "#business-radar", label: "Business Radar", icon: "scan-search", permission: "department:manage" },
      { href: "#dominican-intelligence", label: "Dominican Intelligence", icon: "map", permission: "department:manage" },
      { type: "label", label: "Internal Intelligence", permission: "department:manage" },
      { href: "#product-intelligence", label: "Product Intelligence", icon: "chart-no-axes-column-increasing", permission: "department:manage" },
      { href: "#performance-intelligence", label: "Performance Intelligence", icon: "gauge", permission: "department:manage" },
      { href: "#financial-intelligence", label: "Financial Intelligence", icon: "circle-dollar-sign", permission: "department:manage" },
      { href: "#bureaucracy-intelligence", label: "Bureaucracy Intelligence", icon: "file-cog", permission: "department:manage" },
      { href: "#marketing-intelligence", label: "Marketing Intelligence", icon: "megaphone", permission: "department:manage" },
      { type: "label", label: "CRM", permission: "department:manage" },
      { href: "#crm-correos", label: "Correos", icon: "mail-plus", permission: "department:manage" }
    ]
  };

  function applyAccessAttributes(element, item) {
    if (item.permission) element.dataset.permissionRequired = item.permission;
    if (item.cmsAccess) element.dataset.cmsAccess = "";
    if (item.adminReturn) element.dataset.adminReturn = "";
    if (item.hidden) element.hidden = true;
  }

  function renderItem(item) {
    if (item.type === "label") {
      const label = document.createElement("p");
      label.className = "workspace-nav-label";
      applyAccessAttributes(label, item);
      const span = document.createElement("span");
      span.textContent = item.label;
      label.append(span);
      return label;
    }

    const link = document.createElement("a");
    link.href = item.href;
    if (item.active) link.classList.add("active");
    applyAccessAttributes(link, item);

    if (item.icon) {
      const icon = document.createElement("i");
      icon.dataset.lucide = item.icon;
      link.append(icon);
    }

    const label = document.createElement("span");
    label.textContent = item.label;
    link.append(label);
    return link;
  }

  function renderNavigation(target) {
    const key = target.dataset.workspaceNav;
    const items = NAVIGATION[key];
    if (!items) return;
    target.replaceChildren(...items.map(renderItem));
  }

  function renderAll() {
    document.querySelectorAll("[data-workspace-nav]").forEach(renderNavigation);
  }

  renderAll();

  window.BCCWorkspaceNavigation = { renderAll, definitions: NAVIGATION };
})();
