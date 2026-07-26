(() => {
  const config = {
    url: "https://bglkyqiqzrcwegpjrucc.supabase.co",
    anonKey: "sb_publishable_X_3U_TNtC9BuVwc-vMCsug_GVFmI5cQ"
  };
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

  window.BCC_SUPABASE = config;
  window.BCCSupabase = { loadLibrary, getClient };
})();

window.BCC_MAP_API_URL = ["localhost", "127.0.0.1"].includes(window.location.hostname)
  ? "http://127.0.0.1:8000"
  : "https://map-nano.onrender.com";

window.BCC_WEB_PUSH_PUBLIC_KEY = "BL7ZY6d49L451BwhDIqFa0dSPdXm1kIfxrQXImw2ZPAYxNPgJ64NuaVsM8JN01ZJKLEBHadNS_F0ZiCqs6Izk3c";
