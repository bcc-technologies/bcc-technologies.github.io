(() => {
  const config = {
    url: "https://bglkyqiqzrcwegpjrucc.supabase.co",
    anonKey: "sb_publishable_X_3U_TNtC9BuVwc-vMCsug_GVFmI5cQ"
  };
  const localHostnames = new Set(["localhost", "127.0.0.1", "::1"]);
  const runtime = Object.freeze({
    isLocal: localHostnames.has(window.location.hostname),
    allowLocalAccountFallback: localHostnames.has(window.location.hostname)
  });
  let libraryPromise = null;
  let clientPromise = null;

  function loadLibrary() {
    if (window.supabase?.createClient) return Promise.resolve(window.supabase);
    if (libraryPromise) return libraryPromise;

    libraryPromise = new Promise((resolve, reject) => {
      const selector = 'script[data-bcc-supabase-js="true"], script[data-supabase-js]';
      const existing = document.querySelector(selector);
      const onLoad = () => window.supabase?.createClient
        ? resolve(window.supabase)
        : reject(new Error("Supabase JS cargó sin exponer createClient."));
      const onError = () => reject(new Error("No se pudo cargar Supabase JS."));

      if (existing) {
        existing.addEventListener("load", onLoad, { once: true });
        existing.addEventListener("error", onError, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.8";
      script.async = true;
      script.dataset.bccSupabaseJs = "true";
      script.onload = onLoad;
      script.onerror = onError;
      document.head.appendChild(script);
    }).catch(error => {
      libraryPromise = null;
      throw error;
    });
    return libraryPromise;
  }

  function getClient() {
    if (window.BCCSupabaseClient) return Promise.resolve(window.BCCSupabaseClient);
    if (clientPromise) return clientPromise;
    clientPromise = loadLibrary().then(supabaseJs => {
      window.BCCSupabaseClient = supabaseJs.createClient(config.url, config.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      return window.BCCSupabaseClient;
    }).catch(error => {
      clientPromise = null;
      throw error;
    });
    return clientPromise;
  }

  function classifyError(error) {
    const code = String(error?.code || error?.name || "").toLowerCase();
    const message = String(error?.message || error || "").toLowerCase();
    const status = Number(error?.status || error?.statusCode || 0);
    if (code === "authsessionmissingerror" || code === "auth_session_missing") return "auth_session_missing";
    if (code.includes("refresh_token") || message.includes("refresh token")) return "auth_refresh_invalid";
    if (message.includes("jwt expired") || message.includes("invalid jwt") || message.includes("token is expired")) return "auth_session_invalid";
    if (status === 401 || code.includes("invalid_credentials")) return "auth_invalid_credentials";
    if (status === 403 || code === "42501" || code === "pgrst301") return "permission_denied";
    if (status === 404 || code === "pgrst116") return "not_found";
    if (code === "pgrst204" || code === "42703") return "schema_mismatch";
    if (status >= 500) return "server";
    if (error instanceof TypeError || message.includes("failed to fetch") || message.includes("network")) return "network";
    return "unknown";
  }

  function normalizeError(error, context = "Operación de Supabase") {
    const category = classifyError(error);
    const messages = {
      auth_invalid_credentials: "El correo o la contraseña no son correctos.",
      permission_denied: "No tienes permiso para realizar esta acción.",
      network: "No fue posible conectar con el servicio. Revisa tu conexión e inténtalo de nuevo.",
      server: "El servicio no está disponible temporalmente. Inténtalo de nuevo.",
      schema_mismatch: "La aplicación y la base de datos no están sincronizadas.",
      not_found: "No se encontró la información solicitada.",
      auth_refresh_invalid: "Tu sesión venció. Inicia sesión nuevamente.",
      auth_session_missing: "No hay una sesión activa.",
      auth_session_invalid: "No se pudo validar la sesión actual. Inténtalo de nuevo.",
      unknown: "No fue posible completar la operación."
    };
    return { category, code: String(error?.code || error?.name || "supabase_error"), status: Number(error?.status || error?.statusCode || 0) || null, context, userMessage: messages[category], cause: error };
  }

  function reportError(context, error) {
    const normalized = normalizeError(error, context);
    if (normalized.category !== "auth_session_missing") {
      console.warn("[Supabase]", { context: normalized.context, category: normalized.category, code: normalized.code, status: normalized.status });
    }
    if (typeof window.CustomEvent === "function") window.dispatchEvent?.(new window.CustomEvent("bcc:supabase-error", { detail: { ...normalized, cause: undefined } }));
    return normalized;
  }

  window.BCC_SUPABASE = config;
  window.BCC_RUNTIME = runtime;
  window.BCCSupabase = { loadLibrary, getClient };
  window.BCCSupabaseErrors = { classify: classifyError, normalize: normalizeError, report: reportError };
})();

window.BCC_MAP_API_URL = ["localhost", "127.0.0.1"].includes(window.location.hostname)
  ? "http://127.0.0.1:8000"
  : "https://map-nano.onrender.com";

window.BCC_WEB_PUSH_PUBLIC_KEY = "BL7ZY6d49L451BwhDIqFa0dSPdXm1kIfxrQXImw2ZPAYxNPgJ64NuaVsM8JN01ZJKLEBHadNS_F0ZiCqs6Izk3c";
