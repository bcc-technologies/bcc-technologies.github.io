/* Generated from shared/access-contracts.json. Do not edit directly. */
(() => {
  const manifest = {
  "version": 1,
  "defaultCustomRoleHierarchy": 50,
  "baseRoles": {
    "client": {
      "label": "Cliente",
      "hierarchy": 90,
      "permissions": [
        "dashboard:view",
        "profile:update",
        "downloads:view",
        "support:create"
      ]
    },
    "staff": {
      "label": "Personal",
      "hierarchy": 50,
      "permissions": [
        "dashboard:view",
        "staff:view",
        "profile:update",
        "downloads:view",
        "support:create",
        "clients:view",
        "content:view"
      ]
    },
    "admin": {
      "label": "Administrador",
      "hierarchy": 0,
      "permissions": [
        "dashboard:view",
        "staff:view",
        "profile:update",
        "downloads:view",
        "support:create",
        "clients:view",
        "content:view",
        "cms:access",
        "users:manage",
        "forms:manage",
        "admin:view",
        "licenses:view",
        "licenses:manage",
        "licenses:assign",
        "licenses:audit",
        "map.dev.access",
        "map.release.manage",
        "platform.licenses.read",
        "platform.licenses.manage",
        "platform.evaluations.manage",
        "platform.permissions.manage",
        "platform.analytics.read",
        "maps:developer:access",
        "maps:developer:read",
        "maps:developer:write",
        "maps:developer:release"
      ]
    }
  },
  "staffRoles": {
    "author": {
      "label": "Autor",
      "hierarchy": 40,
      "permissions": [
        "content:write",
        "cms:access"
      ]
    },
    "cofounder": {
      "label": "Cofounder",
      "hierarchy": 10,
      "permissions": [
        "content:write",
        "cms:access",
        "strategy:view"
      ]
    },
    "department_director": {
      "label": "Director",
      "hierarchy": 20,
      "permissions": [
        "content:write",
        "cms:access",
        "department:manage",
        "forms:manage"
      ]
    },
    "maps_developer": {
      "label": "Desarrollador MAPs",
      "hierarchy": 35,
      "permissions": [
        "map.dev.access",
        "maps:developer:access",
        "maps:developer:read",
        "maps:developer:write"
      ]
    },
    "maps_release_manager": {
      "label": "Responsable de releases MAPs",
      "hierarchy": 30,
      "permissions": [
        "map.dev.access",
        "map.release.manage",
        "maps:developer:access",
        "maps:developer:read",
        "maps:developer:release"
      ]
    },
    "maps_license_manager": {
      "label": "Gestor de licencias MAP",
      "hierarchy": 50,
      "permissions": [
        "platform.licenses.read",
        "platform.licenses.manage",
        "platform.evaluations.manage",
        "platform.analytics.read"
      ]
    },
    "maps_product_analyst": {
      "label": "Analista de producto MAP",
      "hierarchy": 50,
      "permissions": [
        "platform.licenses.read",
        "platform.analytics.read"
      ]
    }
  },
  "departments": {
    "technology": {
      "label": "Tecnología",
      "permissions": [
        "department:technology"
      ]
    },
    "finance": {
      "label": "Finanzas",
      "permissions": [
        "department:finance"
      ]
    },
    "operations": {
      "label": "Operaciones",
      "permissions": [
        "department:operations"
      ]
    },
    "marketing": {
      "label": "Marketing",
      "permissions": [
        "department:marketing"
      ]
    },
    "hr": {
      "label": "Recursos humanos",
      "permissions": [
        "department:hr"
      ]
    }
  },
  "permissionLabels": {
    "dashboard:view": "Ver dashboard",
    "profile:update": "Actualizar perfil",
    "downloads:view": "Ver descargas",
    "support:create": "Crear solicitudes",
    "staff:view": "Vista de personal",
    "clients:view": "Ver clientes",
    "content:view": "Ver contenido",
    "content:write": "Crear contenido",
    "cms:access": "Acceso CMS",
    "users:manage": "Administrar usuarios",
    "forms:manage": "Administrar formularios",
    "admin:view": "Vista administrador",
    "licenses:view": "Ver licencias MAPs",
    "licenses:manage": "Administrar licencias MAPs",
    "licenses:assign": "Asignar licencias MAPs",
    "licenses:audit": "Auditar licencias MAPs",
    "strategy:view": "Ver estrategia",
    "department:manage": "Gestionar departamento",
    "maps:developer:access": "Acceder a desarrolladores de MAPs",
    "maps:developer:read": "Consultar datos técnicos de MAPs",
    "maps:developer:write": "Modificar configuraciones de MAPs",
    "maps:developer:release": "Publicar versiones de MAPs",
    "map.dev.access": "Acceder al entorno de desarrollo MAP",
    "map.release.manage": "Gestionar publicaciones de MAP",
    "platform.licenses.read": "Consultar licencias MAP",
    "platform.licenses.manage": "Gestionar licencias MAP",
    "platform.evaluations.manage": "Gestionar evaluaciones MAP",
    "platform.permissions.manage": "Gestionar permisos de plataforma",
    "platform.analytics.read": "Consultar analíticas MAP",
    "department:technology": "Departamento tecnología",
    "department:finance": "Departamento finanzas",
    "department:operations": "Departamento operaciones",
    "department:marketing": "Departamento marketing",
    "department:hr": "Departamento RR. HH."
  },
  "workspacePermissionLabels": {
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
    "licenses:view": "Ver licencias MAPs",
    "licenses:manage": "Administrar licencias MAPs",
    "licenses:assign": "Asignar licencias MAPs",
    "licenses:audit": "Auditar licencias MAPs",
    "map.dev.access": "Desarrollo MAP",
    "map.release.manage": "Publicaciones MAP",
    "platform.licenses.read": "Consultar licencias MAP",
    "platform.licenses.manage": "Gestionar licencias MAP",
    "platform.evaluations.manage": "Gestionar evaluaciones MAP",
    "platform.permissions.manage": "Gestionar permisos MAP",
    "platform.analytics.read": "Analíticas MAP"
  },
  "workspaceStaffRoleLabels": {
    "author": "Autor",
    "cofounder": "Cofounder",
    "department_director": "Director",
    "maps_developer": "Desarrollador MAP",
    "maps_release_manager": "Responsable de releases MAP",
    "maps_license_manager": "Gestor de licencias MAP",
    "maps_product_analyst": "Analista de producto MAP"
  }
};

  const permissionsFor = records => Object.fromEntries(
    Object.entries(records).map(([key, value]) => [key, Object.freeze([...value.permissions])])
  );
  const hierarchyFor = records => Object.fromEntries(
    Object.entries(records).map(([key, value]) => [key, Number(value.hierarchy ?? manifest.defaultCustomRoleHierarchy)])
  );
  const labelsFor = records => Object.fromEntries(
    Object.entries(records).map(([key, value]) => [key, value.label])
  );
  const optionsFor = records => Object.entries(records).map(([value, definition]) => ({
    value,
    label: definition.label
  }));
  const deepFreeze = value => {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
  };

  const ROLE_PERMISSIONS = permissionsFor(manifest.baseRoles);
  const STAFF_ROLE_PERMISSIONS = permissionsFor(manifest.staffRoles);
  const DEPARTMENT_PERMISSIONS = permissionsFor(manifest.departments);
  const ROLE_LABELS = {
    ...labelsFor(manifest.baseRoles),
    ...labelsFor(manifest.staffRoles),
    ...labelsFor(manifest.departments)
  };

  window.BCCAccessContracts = deepFreeze({
    manifest,
    ROLE_PERMISSIONS,
    STAFF_ROLE_PERMISSIONS,
    DEPARTMENT_PERMISSIONS,
    BASE_ROLE_HIERARCHY: hierarchyFor(manifest.baseRoles),
    STAFF_ROLE_HIERARCHY: hierarchyFor(manifest.staffRoles),
    DEFAULT_CUSTOM_ROLE_HIERARCHY: Number(manifest.defaultCustomRoleHierarchy),
    STAFF_ROLES: Object.keys(manifest.staffRoles),
    DEPARTMENTS: Object.keys(manifest.departments),
    PERMISSION_LABELS: { ...manifest.permissionLabels },
    WORKSPACE_PERMISSION_LABELS: { ...manifest.workspacePermissionLabels },
    ROLE_LABELS,
    BASE_ROLE_OPTIONS: optionsFor(manifest.baseRoles),
    STAFF_ROLE_OPTIONS: Object.entries(manifest.staffRoles).map(([value, definition]) => ({
      value,
      label: manifest.workspaceStaffRoleLabels?.[value] || definition.label
    })),
    DEPARTMENT_OPTIONS: optionsFor(manifest.departments),
    canAccess(user, permission) {
      if (!permission) return true;
      return user?.role === "admin"
        || (Array.isArray(user?.permissions) && user.permissions.includes(permission));
    }
  });
})();
