/* Redirect compatibility-only public routes through the declared locale registry. */
(() => {
  const routeId = document.documentElement.dataset.bccLegacyRoute;
  if (!routeId) return;

  const locale = window.BCCI18n?.locale?.() || (document.documentElement.lang || "es");
  const target = window.BCCI18n?.route?.(routeId, locale);
  if (!target) return;

  const legacyFragments = Object.freeze({
    about: "",
    pricing: "#planes",
    faq: "#faq",
    contact: "#planes"
  });
  const fragment = String(window.location.hash || "").replace(/^#/, "").toLowerCase();
  const nextHash = legacyFragments[fragment] || "";
  const next = `${target}${window.location.search}${nextHash}`;

  if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== next) {
    window.location.replace(next);
  }
})();
