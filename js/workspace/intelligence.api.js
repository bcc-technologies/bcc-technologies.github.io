/* Repository for Science Radar (Intelligence) use cases. */
(() => {
  const transport = window.BCCWorkspaceTransport;

  function toError(error) {
    return transport.toError(error, {
      schemaPattern: /intelligence_|relation .* does not exist|column .* does not exist/i,
      schemaMessage: "Falta aplicar la última actualización del esquema Intelligence en Supabase.",
      fallbackMessage: "No fue posible completar la solicitud de Intelligence."
    });
  }

  async function run(operation) {
    try {
      return await operation();
    } catch (error) {
      throw toError(error);
    }
  }

  const repository = {
    loadDashboard(options = {}) {
      return run(() => transport.request("/api/admin/intelligence/dashboard", options));
    },
    runSync(payload, options = {}) {
      return run(() => transport.request("/api/admin/intelligence/sync", {
        ...options,
        method: "POST",
        body: payload
      }));
    },
    updateSignalStatus(id, status, options = {}) {
      return run(() => transport.request(`/api/admin/intelligence/signals/${encodeURIComponent(id)}`, {
        ...options,
        method: "PATCH",
        body: { status }
      }));
    },
    saveTopic(payload, options = {}) {
      const endpoint = payload.id
        ? `/api/admin/intelligence/topics/${encodeURIComponent(payload.id)}`
        : "/api/admin/intelligence/topics";
      const method = payload.id ? "PATCH" : "POST";
      return run(() => transport.request(endpoint, {
        ...options,
        method,
        body: {
          name: payload.name,
          description: payload.description,
          category: payload.category,
          keywords: payload.keywords,
          enabled: payload.enabled
        }
      }));
    },
    saveSource(id, payload, options = {}) {
      return run(() => transport.request(`/api/admin/intelligence/sources/${encodeURIComponent(id)}`, {
        ...options,
        method: "PATCH",
        body: payload
      }));
    },
    saveSettings(payload, options = {}) {
      return run(() => transport.request("/api/admin/intelligence/settings", {
        ...options,
        method: "PATCH",
        body: payload
      }));
    }
  };

  window.BCCWorkspaceIntelligenceApi = Object.freeze(repository);
})();
