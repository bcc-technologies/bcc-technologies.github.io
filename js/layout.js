/* BCC Technologies — shared layout + frontend analytics bootstrap. */
(() => {
  const root = document.documentElement;
  const THRESHOLD_PX = 20;
  const ANALYTICS_CONFIG = {
    enabled: true,
    plausibleDomain: "bcctechnologies.com.do",
    plausibleScript: "https://plausible.io/js/script.file-downloads.outbound-links.tagged-events.js",
    supabaseConfigPath: "/js/supabase-config.js",
    engagedVisitDelayMs: 30000
  };
  const CUSTOM_CONFIG = window.BCC_ANALYTICS || {};
  const CONFIG = { ...ANALYTICS_CONFIG, ...CUSTOM_CONFIG };
  const SESSION_ONCE_PREFIX = "bcc-analytics-once:";
  const SESSION_ID_KEY = "bcc-session-id";
  const VISITOR_ID_KEY = "bcc-visitor-id";
  const RECONCILE_PREFIX = "bcc-analytics-reconciled:";
  let ticking = false;
  let supabaseConfigPromise = null;
  let supabaseJsPromise = null;
  let analyticsSupabaseClientPromise = null;
  let analyticsIdentityPromise = null;
  let analyticsAuthListenerBound = false;

  function updateTopState() {
    const atTop = (window.scrollY || window.pageYOffset || 0) <= THRESHOLD_PX;
    root.classList.toggle("is-at-top", atTop);
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(() => {
      updateTopState();
      ticking = false;
    });
  }

  function inStorage(storage, key) {
    try {
      return storage.getItem(key);
    } catch (_error) {
      return null;
    }
  }

  function setStorage(storage, key, value) {
    try {
      storage.setItem(key, value);
    } catch (_error) {
      // Ignore storage failures in private browsing or restricted contexts.
    }
  }

  function randomId(prefix) {
    if (window.crypto?.randomUUID) return `${prefix}-${window.crypto.randomUUID()}`;
    return `${prefix}-${Math.random().toString(36).slice(2, 11)}${Date.now().toString(36)}`;
  }

  function ensurePersistentId(key, storage, prefix) {
    const existing = inStorage(storage, key);
    if (existing) return existing;
    const created = randomId(prefix);
    setStorage(storage, key, created);
    return created;
  }

  function currentSessionId() {
    return ensurePersistentId(SESSION_ID_KEY, window.sessionStorage, "sess");
  }

  function currentVisitorId() {
    return ensurePersistentId(VISITOR_ID_KEY, window.localStorage, "visitor");
  }

  function safeTrim(value, max = 160) {
    return String(value || "").trim().slice(0, max);
  }

  function normalizeMetadata(metadata = {}) {
    const normalized = {};
    Object.entries(metadata).forEach(([key, value]) => {
      if (value == null) return;
      if (typeof value === "number" || typeof value === "boolean") {
        normalized[key] = value;
        return;
      }
      const text = safeTrim(value, 240);
      if (text) normalized[key] = text;
    });
    return normalized;
  }

  function pageTypeFor(pathname) {
    if (pathname === "/" || pathname === "/index.html" || pathname === "/en/index.html") return "home";
    if (/^\/(en\/)?blog\/[^/]+\.html$/i.test(pathname)) return "blog_post";
    if (/^\/(en\/)?blog\.html$/i.test(pathname)) return "blog_index";
    if (/^\/(en\/)?products\.html$/i.test(pathname)) return "products";
    if (/^\/(en\/)?product_/i.test(pathname) || /^\/(en\/)?MAP\.html$/i.test(pathname)) return "product_detail";
    if (/^\/(en\/)?services\.html$/i.test(pathname)) return "services";
    if (/^\/(en\/)?science\.html$/i.test(pathname)) return "science";
    if (/^\/(en\/)?contactUs\.html$/i.test(pathname)) return "contact";
    if (/^\/(en\/)?cotizacion\.html$/i.test(pathname)) return "quote";
    if (/^\/(login|signup|forgot-password|reset-password|auth-callback)\.html$/i.test(pathname)) return "auth";
    if (/dashboard|cms\.html/i.test(pathname)) return "workspace";
    return "content";
  }

  function currentLanguage() {
    const lang = document.documentElement.lang || (location.pathname.startsWith("/en/") ? "en" : "es");
    return safeTrim(lang.toLowerCase(), 10) || "es";
  }

  function currentContext() {
    const path = location.pathname || "/";
    const query = location.search || "";
    const url = new URL(location.href);
    return {
      pagePath: `${path}${query}`,
      pageUrl: location.href,
      pageTitle: safeTrim(document.title, 200),
      pageLang: currentLanguage(),
      pageType: pageTypeFor(path),
      referrerHost: safeTrim(document.referrer ? new URL(document.referrer).host : "", 160),
      utmSource: safeTrim(url.searchParams.get("utm_source"), 120),
      utmMedium: safeTrim(url.searchParams.get("utm_medium"), 120),
      utmCampaign: safeTrim(url.searchParams.get("utm_campaign"), 120)
    };
  }

  function sessionOnceKey(key) {
    return `${SESSION_ONCE_PREFIX}${key}`;
  }

  function hasSessionFlag(key) {
    return Boolean(inStorage(window.sessionStorage, sessionOnceKey(key)));
  }

  function markSessionFlag(key) {
    setStorage(window.sessionStorage, sessionOnceKey(key), "1");
  }

  async function ensurePlausible() {
    if (!CONFIG.enabled || document.querySelector('script[data-bcc-plausible="true"]')) return;
    window.plausible = window.plausible || function plausibleProxy() {
      (window.plausible.q = window.plausible.q || []).push(arguments);
    };
    const identity = await resolveAnalyticsIdentity();
    if (identity.isInternal) return;
    const script = document.createElement("script");
    script.defer = true;
    script.dataset.domain = CONFIG.plausibleDomain;
    script.dataset.bccPlausible = "true";
    script.src = CONFIG.plausibleScript;
    document.head.appendChild(script);
  }

  function loadSupabaseConfig() {
    if (window.BCC_SUPABASE?.url && window.BCC_SUPABASE?.anonKey) return Promise.resolve(window.BCC_SUPABASE);
    if (supabaseConfigPromise) return supabaseConfigPromise;
    supabaseConfigPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${CONFIG.supabaseConfigPath}"]`);
      if (existing) {
        existing.addEventListener("load", () => resolve(window.BCC_SUPABASE), { once: true });
        existing.addEventListener("error", () => reject(new Error("No se pudo cargar la configuración de Supabase.")), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = CONFIG.supabaseConfigPath;
      script.async = true;
      script.onload = () => resolve(window.BCC_SUPABASE);
      script.onerror = () => reject(new Error("No se pudo cargar la configuración de Supabase."));
      document.head.appendChild(script);
    });
    return supabaseConfigPromise;
  }

  function loadSupabaseJs() {
    if (window.supabase?.createClient) return Promise.resolve(window.supabase);
    if (supabaseJsPromise) return supabaseJsPromise;
    supabaseJsPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-bcc-supabase-js="true"]');
      if (existing) {
        existing.addEventListener("load", () => resolve(window.supabase), { once: true });
        existing.addEventListener("error", () => reject(new Error("No se pudo cargar Supabase JS.")), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
      script.async = true;
      script.dataset.bccSupabaseJs = "true";
      script.onload = () => resolve(window.supabase);
      script.onerror = () => reject(new Error("No se pudo cargar Supabase JS."));
      document.head.appendChild(script);
    });
    return supabaseJsPromise;
  }

  async function loadAnalyticsSupabaseClient() {
    if (window.BCCAuth?.loadSupabaseClient) {
      return window.BCCAuth.loadSupabaseClient();
    }
    if (window.BCCSupabaseClient) return window.BCCSupabaseClient;
    if (window.BCCAnalyticsSupabaseClient) return window.BCCAnalyticsSupabaseClient;
    if (analyticsSupabaseClientPromise) return analyticsSupabaseClientPromise;
    analyticsSupabaseClientPromise = Promise.all([loadSupabaseConfig(), loadSupabaseJs()]).then(([config]) => {
      if (!config?.url || !config?.anonKey || !window.supabase?.createClient) {
        throw new Error("No fue posible inicializar Supabase para analytics.");
      }
      window.BCCSupabaseClient = window.BCCSupabaseClient || window.supabase.createClient(
        config.url,
        config.anonKey,
        { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
      );
      window.BCCAnalyticsSupabaseClient = window.BCCSupabaseClient;
      return window.BCCAnalyticsSupabaseClient;
    });
    return analyticsSupabaseClientPromise;
  }

  function bindAnalyticsAuthListener(supabase) {
    if (analyticsAuthListenerBound || !supabase?.auth?.onAuthStateChange) return;
    analyticsAuthListenerBound = true;
    supabase.auth.onAuthStateChange((_event, session) => {
      analyticsIdentityPromise = null;
      if (session?.access_token && session?.user?.id) {
        void resolveAnalyticsIdentity({ force: true });
      }
    });
  }

  async function getSessionForAnalytics(supabase) {
    const { data } = await supabase.auth.getSession();
    if (data?.session) return data.session;
    if (!/dashboard|cms\.html|login|auth-callback/i.test(location.pathname)) return null;
    const deadline = Date.now() + 1800;
    while (Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 150));
      const retry = await supabase.auth.getSession();
      if (retry.data?.session) return retry.data.session;
    }
    return null;
  }

  async function roleForAnalyticsUser(supabase, userId) {
    if (window.BCCAuth?.currentUser) {
      try {
        const user = await window.BCCAuth.currentUser();
        if (user?.id === userId && user.role) return safeTrim(user.role, 20).toLowerCase();
      } catch (_error) {}
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    return safeTrim(profile?.role || "client", 20).toLowerCase();
  }

  function reconciliationKey(identity) {
    return `${RECONCILE_PREFIX}${identity.userId}:${currentVisitorId()}`;
  }

  async function reconcileAnalyticsIdentity(supabase, identity) {
    if (!identity?.accessToken || !identity?.userId) return;
    const key = reconciliationKey(identity);
    if (inStorage(window.sessionStorage, key)) return;
    try {
      const { error } = await supabase.rpc("reconcile_analytics_identity", {
        session_id: currentSessionId(),
        visitor_id: currentVisitorId()
      });
      if (!error) setStorage(window.sessionStorage, key, "1");
    } catch (_error) {
      // Reconciliation is best-effort and must never block analytics.
    }
  }

  async function resolveAnalyticsIdentity(options = {}) {
    if (analyticsIdentityPromise && !options.force) return analyticsIdentityPromise;
    analyticsIdentityPromise = (async () => {
      try {
        const supabase = await loadAnalyticsSupabaseClient();
        bindAnalyticsAuthListener(supabase);
        const session = await getSessionForAnalytics(supabase);
        const accessToken = safeTrim(session?.access_token, 4096);
        const userId = safeTrim(session?.user?.id, 80);
        if (!accessToken || !userId) {
          return { accessToken: "", userId: "", role: "", isInternal: false };
        }
        const role = await roleForAnalyticsUser(supabase, userId);
        const identity = {
          accessToken,
          userId,
          role,
          isInternal: role === "staff" || role === "admin"
        };
        void reconcileAnalyticsIdentity(supabase, identity);
        return identity;
      } catch (_error) {
        return { accessToken: "", userId: "", role: "", isInternal: false };
      }
    })();
    return analyticsIdentityPromise;
  }

  async function postSupabaseEvent(payload) {
    try {
      const config = await loadSupabaseConfig();
      if (!config?.url || !config?.anonKey) return;
      const identity = await resolveAnalyticsIdentity();
      const authToken = identity.accessToken || config.anonKey;
      await fetch(`${config.url}/rest/v1/rpc/record_analytics_event`, {
        method: "POST",
        keepalive: true,
        headers: {
          "Content-Type": "application/json",
          apikey: config.anonKey,
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify(payload)
      });
    } catch (_error) {
      // Analytics should never block page behavior.
    }
  }

  function plausibleProps(metadata) {
    const props = {};
    ["page_type", "label", "section", "form_name", "target_path", "target_host"].forEach(key => {
      const value = metadata[key];
      if (typeof value === "string" && value) props[key] = value;
    });
    return props;
  }

  function sendPlausibleEvent(eventName, metadata = {}) {
    void resolveAnalyticsIdentity().then(identity => {
      if (identity.isInternal || typeof window.plausible !== "function") return;
      const props = plausibleProps(metadata);
      window.plausible(eventName, Object.keys(props).length ? { props } : undefined);
    });
  }

  function track(eventName, metadata = {}, options = {}) {
    if (!CONFIG.enabled) return;
    const cleanEvent = safeTrim(eventName, 80).replace(/\s+/g, "_").toLowerCase();
    if (!cleanEvent) return;
    if (options.onceKey && hasSessionFlag(options.onceKey)) return;
    if (options.onceKey) markSessionFlag(options.onceKey);

    const context = currentContext();
    const normalizedMetadata = normalizeMetadata({
      page_type: context.pageType,
      lang: context.pageLang,
      ...metadata
    });

    if (options.plausible !== false) {
      sendPlausibleEvent(cleanEvent, normalizedMetadata);
    }

    if (options.supabase === false) return;

    const payload = {
      event_name: cleanEvent,
      event_source: "frontend",
      session_id: currentSessionId(),
      visitor_id: currentVisitorId(),
      page_path: context.pagePath,
      page_url: context.pageUrl,
      page_title: context.pageTitle,
      page_lang: context.pageLang,
      referrer_host: context.referrerHost,
      utm_source: context.utmSource,
      utm_medium: context.utmMedium,
      utm_campaign: context.utmCampaign,
      metadata: normalizedMetadata
    };
    void postSupabaseEvent(payload);
  }

  function trackPageView() {
    track("page_view", {}, { plausible: false });
  }

  function trackEngagedVisit() {
    window.setTimeout(() => {
      if (document.visibilityState !== "visible") return;
      track("engaged_visit", { seconds: 30 }, { onceKey: `engaged:${location.pathname}` });
    }, CONFIG.engagedVisitDelayMs);
  }

  function trackScrollDepth() {
    const marks = [
      { threshold: 0.5, event: "scroll_depth_50", key: `scroll50:${location.pathname}` },
      { threshold: 0.9, event: "scroll_depth_90", key: `scroll90:${location.pathname}` }
    ];
    const onPageScroll = () => {
      const scrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const ratio = (window.scrollY || window.pageYOffset || 0) / scrollable;
      marks.forEach(mark => {
        if (ratio >= mark.threshold) track(mark.event, { percent: Math.round(mark.threshold * 100) }, { onceKey: mark.key });
      });
    };
    window.addEventListener("scroll", onPageScroll, { passive: true });
  }

  function trackLinkClicks() {
    document.addEventListener("click", event => {
      const link = event.target.closest("a[href]");
      if (!link) return;
      const rawHref = link.getAttribute("href") || "";
      if (!rawHref || rawHref.startsWith("#")) return;
      const label = safeTrim(link.dataset.analyticsLabel || link.getAttribute("aria-label") || link.textContent, 140);
      let targetUrl = null;
      try {
        targetUrl = new URL(rawHref, location.href);
      } catch (_error) {
        targetUrl = null;
      }

      const meta = normalizeMetadata({
        label,
        href: targetUrl ? targetUrl.toString() : rawHref,
        target_path: targetUrl?.pathname || "",
        target_host: targetUrl?.host || ""
      });

      if (link.dataset.analyticsEvent) {
        track(link.dataset.analyticsEvent, meta);
        return;
      }

      if (rawHref.startsWith("mailto:")) {
        track("email_click", meta);
        return;
      }
      if (rawHref.startsWith("tel:")) {
        track("phone_click", meta);
        return;
      }
      if (/wa\.me|whatsapp|api\.whatsapp/i.test(rawHref)) {
        track("whatsapp_click", meta);
        return;
      }
      if (targetUrl && targetUrl.origin !== location.origin) {
        track("outbound_click", meta);
        return;
      }
      if (targetUrl && /\/contactUs\.html$/i.test(targetUrl.pathname)) {
        track("contact_cta_click", meta);
        return;
      }
      if (targetUrl && /\/cotizacion\.html$/i.test(targetUrl.pathname)) {
        track("quote_cta_click", meta);
        return;
      }
      if (link.classList.contains("btn") || link.dataset.trackCta != null) {
        track("cta_click", meta);
      }
    });
  }

  function inferFormName(form) {
    if (!(form instanceof HTMLFormElement)) return "";
    return safeTrim(
      form.dataset.analyticsForm ||
      form.getAttribute("name") ||
      form.getAttribute("id") ||
      form.getAttribute("aria-label") ||
      form.getAttribute("action") ||
      "form",
      120
    );
  }

  function trackFormSubmits() {
    document.addEventListener("submit", event => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      const action = safeTrim(form.getAttribute("action"), 200);
      const fields = [...new Set([...new FormData(form).keys()].map(key => safeTrim(key, 80)).filter(Boolean))];
      const meta = normalizeMetadata({
        form_name: inferFormName(form),
        action_host: action ? (() => {
          try {
            return new URL(action, location.href).host;
          } catch (_error) {
            return "";
          }
        })() : "",
        field_count: fields.length
      });
      const eventName = /formspree\.io/i.test(action) || /\/(en\/)?contactUs\.html$/i.test(location.pathname)
        ? "contact_submit"
        : "form_submit";
      track(eventName, meta);
    });
  }

  function trackQuoteSelections() {
    if (!/\/(en\/)?cotizacion\.html$/i.test(location.pathname)) return;
    document.addEventListener("change", event => {
      const checkbox = event.target;
      if (!(checkbox instanceof HTMLInputElement) || checkbox.type !== "checkbox" || checkbox.name !== "product" || !checkbox.checked) return;
      const section = safeTrim(checkbox.closest(".product-section")?.querySelector("h1")?.textContent, 120);
      const label = safeTrim(checkbox.value, 160);
      track("quote_option_select", {
        label,
        section,
        price: safeTrim(checkbox.dataset.price, 40)
      }, { onceKey: `quote:${section}:${label}` });
    });
  }

  function initAnalytics() {
    if (!CONFIG.enabled || document.body?.dataset.analytics === "off") return;
    void ensurePlausible();
    trackPageView();
    trackEngagedVisit();
    trackScrollDepth();
    trackLinkClicks();
    trackFormSubmits();
    trackQuoteSelections();
    window.BCCAnalytics = { track };
  }

  updateTopState();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  initAnalytics();
})();
