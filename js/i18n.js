/* Shared locale and route registry. Keep route availability explicit: /en is not a fallback rule. */
(() => {
  const DEFAULT_LOCALE = "es";
  const SUPPORTED_LOCALES = Object.freeze(["es", "en"]);
  const ROUTES = Object.freeze({
    home: Object.freeze({ es: "/index.html", en: "/en/index.html" }),
    "maps.nano.product": Object.freeze({ es: "/product_maps_nano.html", en: "/en/product_maps_nano.html" }),
    "maps.nano.pricing": Object.freeze({ es: "/map-nano-pricing.html", en: "/en/map-nano-pricing.html" }),
    "workspace.client": Object.freeze({ es: "/dashboard.html", en: "/en/dashboard.html" }),
    "workspace.staff": Object.freeze({ es: "/staff-dashboard.html", en: "/en/staff-dashboard.html" })
  });

  const normalizeLocale = value => String(value || "").toLowerCase().startsWith("en") ? "en" : DEFAULT_LOCALE;
  const locale = () => normalizeLocale(document.documentElement.lang || (location.pathname.startsWith("/en/") ? "en" : DEFAULT_LOCALE));
  const route = (id, requestedLocale = locale()) => ROUTES[id]?.[normalizeLocale(requestedLocale)] || null;

  function routeForPath(pathname = location.pathname, requestedLocale = locale()) {
    const normalizedPath = String(pathname || "/").replace(/\/+$/, "") || "/";
    const entry = Object.values(ROUTES).find(routes => Object.values(routes).some(value => value === normalizedPath || value === `${normalizedPath}.html`));
    return entry?.[normalizeLocale(requestedLocale)] || null;
  }

  function workspaceRouteForUser(user, requestedLocale = locale()) {
    const isStaff = Boolean(user?.permissions?.includes("admin:view") || user?.permissions?.includes("staff:view") || ["staff", "admin"].includes(user?.role));
    return route(isStaff ? "workspace.staff" : "workspace.client", requestedLocale);
  }

  window.BCCI18n = Object.freeze({
    DEFAULT_LOCALE,
    SUPPORTED_LOCALES,
    routes: ROUTES,
    normalizeLocale,
    locale,
    route,
    routeForPath,
    workspaceRouteForUser
  });
})();
