export const WORKSPACE_ASSET_DIRECTORY = "assets/workspace";

const sharedScripts = [
  "js/i18n.js",
  "js/prefs.js",
  "js/supabase-config.js",
  "js/access-contracts.js",
  "js/workspace/events.js",
  "js/workspace/icons/registry.js",
  "js/workspace/icons/catalogs/core.js",
  "js/workspace/icons.js",
  "js/workspace/i18n.js",
  "js/workspace/utils.js",
  "js/workspace/ui/registry.js",
  "js/workspace/ui/foundation.js",
  "js/workspace/ui/content.js",
  "js/workspace/ui/states.js",
  "js/workspace/ui/interactions.js",
  "js/workspace/ui.js",
  "js/workspace/loader.js",
  "js/workspace/module-runtime.js",
  "js/workspace/feature-registry.js",
  "js/auth.js",
  "js/layout.js",
  "js/workspace/account.js",
  "js/workspace/navigation.js",
  "js/workspace/shell.js",
  "js/workspace/router.js"
];

export const WORKSPACE_DASHBOARD_ASSETS = {
  client: {
    page: "dashboard.html",
    cssEntry: "css/pages/dashboard-client.css",
    cssFile: `${WORKSPACE_ASSET_DIRECTORY}/dashboard-client.css`,
    scriptFile: `${WORKSPACE_ASSET_DIRECTORY}/dashboard-client.js`,
    scripts: [...sharedScripts, "js/dashboard.js"]
  },
  staff: {
    page: "staff-dashboard.html",
    cssEntry: "css/pages/dashboard-staff.css",
    cssFile: `${WORKSPACE_ASSET_DIRECTORY}/dashboard-staff.css`,
    scriptFile: `${WORKSPACE_ASSET_DIRECTORY}/dashboard-staff.js`,
    scripts: [
      ...sharedScripts.slice(0, -2),
      "js/workspace/notifications.js",
      ...sharedScripts.slice(-2),
      "js/staff-dashboard.js"
    ]
  }
};
