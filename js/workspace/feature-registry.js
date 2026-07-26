/* Declarative source of truth for workspace feature loading and mounting. */
(() => {
  const SCOPES = Object.freeze({
    client: Object.freeze([
      {
        id: "operation",
        views: ["operacion"],
        scripts: ["js/auth-workspace-api.js", "js/workspace/forms.js"],
        initialize({ user }) {
          window.BCCWorkspaceForms?.init(user);
        }
      },
      {
        id: "licenses",
        views: ["licencias"],
        permission: "dashboard:view",
        scripts: [
          "js/workspace/map-contracts.js",
          "js/workspace/map-repository.js",
          "js/workspace/client-map-licenses.js"
        ],
        selector: "[data-client-map-licenses]",
        global: "BCCWorkspaceClientMapLicenses"
      }
    ]),
    staff: Object.freeze([
      {
        id: "operation",
        views: ["resumen", "trabajo"],
        scripts: [
          "js/auth-workspace-api.js",
          "js/workspace/productivity.js",
          "js/workspace/calendar.js"
        ],
        initialize({ user }) {
          window.BCCWorkspaceProductivity?.init(user);
          window.BCCWorkspaceCalendar?.init(user);
        }
      },
      {
        id: "forms",
        views: [],
        dependencies: ["operation"],
        scripts: ["js/workspace/forms.js"],
        initialize({ user }) {
          window.BCCWorkspaceForms?.init(user);
        }
      },
      {
        id: "admin",
        views: ["usuarios", "roles", "auditoria"],
        permission: "admin:view",
        scripts: ["js/auth-admin-access-api.js", "js/admin-dashboard.js"],
        async initialize({ user }) {
          await window.BCCWorkspaceAdmin?.init(user, { bindRouter: false });
        }
      },
      {
        id: "analytics",
        views: ["product-intelligence"],
        permission: "department:manage",
        scripts: ["js/workspace/analytics.js"],
        selector: "[data-analytics-workspace]",
        global: "BCCWorkspaceAnalytics"
      },
      {
        id: "maps-licensing",
        views: ["maps-licensing"],
        permission: "platform.licenses.read",
        scripts: [
          "js/workspace/map-contracts.js",
          "js/workspace/map-repository.js",
          "js/workspace/maps-licensing.js"
        ],
        selector: "[data-maps-licensing-workspace]",
        global: "BCCWorkspaceMapsLicensing"
      },
      {
        id: "intelligence",
        views: ["science-radar"],
        permission: "department:manage",
        scripts: ["js/workspace/intelligence.js"],
        selector: "[data-intelligence-workspace]",
        global: "BCCWorkspaceIntelligence"
      },
      {
        id: "dominican-intelligence",
        views: ["dominican-intelligence"],
        permission: "department:manage",
        scripts: ["js/auth-dominican-intelligence-api.js", "js/workspace/dominican-intelligence.js"],
        selector: "[data-dominican-intelligence-workspace]",
        global: "BCCWorkspaceDominicanIntelligence"
      },
      {
        id: "prospectos",
        views: ["crm-correos"],
        permission: "department:manage",
        scripts: [
          "js/auth-prospects-api.js",
          "js/workspace/prospects.constants.js",
          "js/workspace/prospects.layout.js",
          "js/workspace/prospects.api.js",
          "js/workspace/prospects.js"
        ],
        selector: "[data-prospects-workspace]",
        global: "BCCWorkspaceProspects"
      }
    ])
  });

  const registeredScopes = new Set();

  function definitions(scope) {
    return SCOPES[scope] || [];
  }

  function feature(scope, featureId) {
    return definitions(scope).find(item => item.id === featureId) || null;
  }

  function featureForView(scope, viewId) {
    return definitions(scope).find(item => item.views.includes(viewId)) || null;
  }

  function canAccess(definition, user) {
    if (!definition?.permission) return true;
    if (user?.role === "admin") return true;
    return Array.isArray(user?.permissions) && user.permissions.includes(definition.permission);
  }

  function register(scope) {
    if (registeredScopes.has(scope)) return;
    const loader = window.BCCWorkspaceLoader;
    if (!loader?.register) throw new Error("Workspace loader must be available before registering features.");
    const entries = definitions(scope);
    const scripts = Object.fromEntries(entries.map(item => [item.id, item.scripts]));
    const dependencies = Object.fromEntries(entries
      .filter(item => item.dependencies?.length)
      .map(item => [item.id, item.dependencies]));
    loader.register(scripts, dependencies);
    registeredScopes.add(scope);
  }

  async function initialize(scope, featureId, context = {}) {
    register(scope);
    const definition = feature(scope, featureId);
    if (!definition || !canAccess(definition, context.user)) return null;
    await window.BCCWorkspaceLoader.load(definition.id);

    if (definition.initialize) {
      await definition.initialize(context);
      return definition;
    }

    const module = window[definition.global];
    if (!module?.init) throw new Error(`El módulo ${definition.id} no expuso un inicializador.`);
    const root = definition.selector ? document.querySelector(definition.selector) : null;
    if (!root) return definition;
    if (root.dataset.workspaceModuleReady === "true") {
      await module.activate?.(context);
      return definition;
    }
    await module.init(context.user, context);
    root.dataset.workspaceModuleReady = "true";
    window.BCCWorkspaceUtils?.refreshIcons?.(root);
    return definition;
  }

  async function initializeView(scope, viewId, context = {}) {
    const definition = featureForView(scope, viewId);
    return definition ? initialize(scope, definition.id, context) : null;
  }

  window.BCCWorkspaceFeatureRegistry = Object.freeze({
    scopes: SCOPES,
    definitions,
    feature,
    featureForView,
    canAccess,
    register,
    initialize,
    initializeView
  });
})();
