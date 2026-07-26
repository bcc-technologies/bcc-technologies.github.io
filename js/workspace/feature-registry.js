/* Declarative source of truth for workspace feature loading and mounting. */
(() => {
  const SCOPES = Object.freeze({
    client: Object.freeze([
      {
        id: "operation",
        views: ["operacion"],
        scripts: [
          "js/workspace/transport.js",
          "js/workspace/forms-contracts.js",
          "js/workspace/forms-repository.js",
          "js/auth-workspace-api.js",
          "js/workspace/forms.js"
        ],
        selector: "[data-forms-workspace]",
        global: "BCCWorkspaceForms"
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
          "js/workspace/transport.js",
          "js/workspace/tasks-contracts.js",
          "js/workspace/tasks-repository.js",
          "js/workspace/calendar-contracts.js",
          "js/workspace/calendar-repository.js",
          "js/auth-workspace-api.js",
          "js/workspace/productivity.js",
          "js/workspace/calendar.js"
        ],
        mounts: [
          {
            id: "tasks",
            selector: "[data-productivity-workspace]",
            global: "BCCWorkspaceProductivity"
          },
          {
            id: "calendar",
            selector: "[data-calendar-workspace]",
            global: "BCCWorkspaceCalendar"
          }
        ]
      },
      {
        id: "forms",
        views: [],
        dependencies: ["operation"],
        scripts: [
          "js/workspace/forms-contracts.js",
          "js/workspace/forms-repository.js",
          "js/workspace/forms.js"
        ],
        selector: "[data-forms-workspace]",
        global: "BCCWorkspaceForms"
      },
      {
        id: "admin",
        views: ["usuarios", "roles", "auditoria"],
        permission: "users:manage",
        scripts: [
          "js/workspace/transport.js",
          "js/workspace/admin-access-contracts.js",
          "js/workspace/admin-access-repository.js",
          "js/workspace/admin-access-state.js",
          "js/workspace/admin-access-view.js",
          "js/auth-admin-access-api.js",
          "js/workspace/admin-roles.js",
          "js/workspace/admin-users.js",
          "js/workspace/admin-audit.js"
        ],
        mounts: [
          { id: "roles", selector: "#roles", global: "BCCWorkspaceAdminRoles" },
          { id: "users", selector: "#usuarios", global: "BCCWorkspaceAdminUsers" },
          { id: "audit", selector: "#auditoria", global: "BCCWorkspaceAdminAudit" }
        ]
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
  const transitionStates = new Map();

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
    return window.BCCAccessContracts.canAccess(user, definition?.permission);
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

  function mountTargets(definition) {
    if (Array.isArray(definition?.mounts)) return definition.mounts;
    if (definition?.selector && definition?.global) {
      return [{ id: definition.id, selector: definition.selector, global: definition.global }];
    }
    return [];
  }

  async function mountTarget(definition, target, context) {
    const module = window[target.global];
    if (!module?.init) throw new Error(`El módulo ${target.id} no expuso un inicializador.`);
    const root = document.querySelector(target.selector);
    if (!root) return null;
    const runtime = window.BCCWorkspaceModuleRuntime;
    if (!runtime?.mount) throw new Error("Workspace module runtime must be available before mounting features.");
    const instance = await runtime.mount({
      id: `${definition.id}:${target.id}`,
      root,
      module,
      context,
      initialize(moduleContext) {
        return module.init(context.user, moduleContext);
      }
    });
    window.BCCWorkspaceUtils?.refreshIcons?.(root);
    return instance;
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

    for (const target of mountTargets(definition)) {
      if (context.isCurrentTransition?.() === false) return definition;
      await mountTarget(definition, target, context);
      if (context.isCurrentTransition?.() === false) {
        if (context.isFeatureActive?.(definition.id) === false) {
          const root = document.querySelector(target.selector);
          if (root) await window.BCCWorkspaceModuleRuntime?.unmount?.(root);
        }
        return definition;
      }
    }
    return definition;
  }

  async function unmount(scope, featureId) {
    const definition = feature(scope, featureId);
    const runtime = window.BCCWorkspaceModuleRuntime;
    if (!definition || !runtime?.unmount) return false;
    let changed = false;
    const targets = mountTargets(definition).slice().reverse();
    for (const target of targets) {
      const root = document.querySelector(target.selector);
      if (root) changed = (await runtime.unmount(root)) || changed;
    }
    return changed;
  }

  async function transition(scope, featureIds = [], context = {}) {
    register(scope);
    const revision = (transitionStates.get(scope)?.revision || 0) + 1;
    const activeIds = [...new Set(featureIds)].filter(id => {
      const definition = feature(scope, id);
      return Boolean(definition) && canAccess(definition, context.user);
    });
    const active = new Set(activeIds);
    const state = { revision, active };
    transitionStates.set(scope, state);
    const transitionContext = {
      ...context,
      transitionRevision: revision,
      isCurrentTransition() {
        return transitionStates.get(scope) === state;
      },
      isFeatureActive(featureId) {
        return transitionStates.get(scope)?.active.has(featureId) || false;
      }
    };

    for (const definition of definitions(scope).slice().reverse()) {
      if (!active.has(definition.id)) await unmount(scope, definition.id);
    }
    const initialized = [];
    for (const featureId of activeIds) {
      if (transitionStates.get(scope) !== state) return initialized;
      initialized.push(await initialize(scope, featureId, transitionContext));
    }
    return initialized;
  }

  async function initializeView(scope, viewId, context = {}) {
    const definition = featureForView(scope, viewId);
    const initialized = await transition(scope, definition ? [definition.id] : [], context);
    return initialized[0] || null;
  }

  window.BCCWorkspaceFeatureRegistry = Object.freeze({
    scopes: SCOPES,
    definitions,
    feature,
    featureForView,
    canAccess,
    register,
    initialize,
    unmount,
    transition,
    initializeView
  });
})();
