/* Shared transport boundary for workspace repositories. */
(() => {
  const DEFAULT_TIMEOUT_MS = 12000;

  class WorkspaceTransportError extends Error {
    constructor(message, { code = "unexpected", cause = null, retryable = false } = {}) {
      super(message);
      this.name = "WorkspaceTransportError";
      this.code = code;
      this.cause = cause;
      this.retryable = retryable;
    }
  }

  function errorMessage(error) {
    return String(error?.message || error?.details || error || "").trim();
  }

  function classify(error) {
    if (error instanceof WorkspaceTransportError) return error;
    const message = errorMessage(error);
    if (/abort|cancelad[ao]/i.test(message)) {
      return new WorkspaceTransportError("Solicitud cancelada.", { code: "cancelled", cause: error });
    }
    if (/networkerror|failed to fetch|network request failed|fetch resource/i.test(message)) {
      return new WorkspaceTransportError("No fue posible conectar con el servicio. Revisa tu conexión e inténtalo de nuevo.", {
        code: "network",
        cause: error,
        retryable: true
      });
    }
    if (/no autenticado|not authenticated|authentication required|jwt.*expired/i.test(message)) {
      return new WorkspaceTransportError("Tu sesión ya no está disponible. Vuelve a iniciar sesión.", {
        code: "unauthenticated",
        cause: error
      });
    }
    if (/permiso insuficiente|permission denied|not authorized|forbidden/i.test(message)) {
      return new WorkspaceTransportError("No tienes permiso para realizar esta acción.", {
        code: "forbidden",
        cause: error
      });
    }
    return new WorkspaceTransportError(message || "No fue posible completar la solicitud.", {
      code: "unexpected",
      cause: error
    });
  }

  function toError(error, {
    schemaPattern = null,
    schemaMessage = "",
    fallbackMessage = "No fue posible completar la solicitud."
  } = {}) {
    const originalMessage = errorMessage(error?.cause || error);
    if (schemaPattern?.test(originalMessage)) {
      return new WorkspaceTransportError(schemaMessage, { code: "schema_unavailable", cause: error });
    }
    const normalized = classify(error);
    if (normalized.code === "unexpected" && !originalMessage) {
      normalized.message = fallbackMessage;
    }
    return normalized;
  }

  function request(path, {
    method = "GET",
    body,
    signal = null,
    timeoutMs = DEFAULT_TIMEOUT_MS
  } = {}) {
    const adapter = window.BCCAuth?.api;
    if (typeof adapter !== "function") {
      return Promise.reject(new WorkspaceTransportError("El servicio de datos no está disponible.", {
        code: "adapter_unavailable",
        retryable: true
      }));
    }

    return new Promise((resolve, reject) => {
      const controller = new AbortController();
      let settled = false;
      let timer = null;

      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        if (timer) window.clearTimeout(timer);
        signal?.removeEventListener?.("abort", onAbort);
        callback(value);
      };
      const onAbort = () => {
        controller.abort();
        finish(reject, new WorkspaceTransportError("Solicitud cancelada.", { code: "cancelled" }));
      };

      if (signal?.aborted) {
        onAbort();
        return;
      }
      signal?.addEventListener?.("abort", onAbort, { once: true });
      if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
        timer = window.setTimeout(() => {
          controller.abort();
          finish(reject, new WorkspaceTransportError(
            "La solicitud tardó demasiado. Inténtalo de nuevo.",
            { code: "timeout", retryable: true }
          ));
        }, timeoutMs);
      }

      const options = { method, signal: controller.signal };
      if (body !== undefined) options.body = typeof body === "string" ? body : JSON.stringify(body);
      Promise.resolve()
        .then(() => adapter(path, options))
        .then(value => finish(resolve, value))
        .catch(error => finish(reject, classify(error)));
    });
  }

  window.BCCWorkspaceTransport = Object.freeze({
    DEFAULT_TIMEOUT_MS,
    WorkspaceTransportError,
    classify,
    toError,
    request
  });
})();
