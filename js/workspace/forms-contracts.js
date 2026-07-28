/* Domain contracts for workspace forms and responses. */
(() => {
  function object(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function question(value) {
    const item = object(value);
    return {
      ...item,
      id: String(item.id || ""),
      label: String(item.label || ""),
      type: String(item.type || "long_text"),
      required: Boolean(item.required),
      options: Array.isArray(item.options) ? item.options.map(String) : []
    };
  }

  function form(value) {
    const item = object(value);
    return {
      ...item,
      id: String(item.id || ""),
      title: String(item.title || ""),
      purpose: String(item.purpose || ""),
      audience: String(item.audience || ""),
      recipientIds: Array.isArray(item.recipientIds) ? item.recipientIds.map(String) : [],
      status: String(item.status || "draft"),
      questions: Array.isArray(item.questions) ? item.questions.map(question) : []
    };
  }

  function response(value) {
    const item = object(value);
    return {
      ...item,
      id: String(item.id || ""),
      formId: String(item.formId || ""),
      answers: object(item.answers),
      submittedAt: item.submittedAt || "",
      respondentLabel: String(item.respondentLabel || "")
    };
  }

  function recipient(value) {
    const item = object(value);
    return {
      id: String(item.id || ""),
      label: String(item.label || ""),
      email: String(item.email || "")
    };
  }

  function collection(payload, key, normalizer) {
    const items = object(payload)[key];
    if (!Array.isArray(items)) throw new Error(`Respuesta inválida: falta ${key}.`);
    return items.map(normalizer);
  }

  function entity(payload, key, normalizer) {
    const value = object(payload)[key];
    if (!value || typeof value !== "object") throw new Error(`Respuesta inválida: falta ${key}.`);
    return normalizer(value);
  }

  function toError(error) {
    const original = error?.cause || error;
    const detail = [
      original?.code,
      original?.message,
      original?.details,
      String(original || "")
    ].filter(Boolean).join(" ");

    if (/PGRST204|(?:recipient_ids|workspace_forms|workspace_form_responses).{0,120}schema cache|schema cache.{0,120}(?:recipient_ids|workspace_forms|workspace_form_responses)/i.test(detail)) {
      return new window.BCCWorkspaceTransport.WorkspaceTransportError(
        "El servicio de formularios se está actualizando. Inténtalo de nuevo en unos segundos.",
        { code: "schema_updating", cause: error, retryable: true }
      );
    }

    return window.BCCWorkspaceTransport.toError(error, {
      schemaPattern: /relation\s+(?:\"?public\"?\.)?\"?(?:workspace_forms|workspace_form_responses)\"?\s+does not exist|could not find (?:the )?table .*?(?:workspace_forms|workspace_form_responses).*?schema cache|PGRST205/i,
      schemaMessage: "El servicio requiere activar las tablas de formularios en Supabase.",
      fallbackMessage: "No fue posible actualizar formularios."
    });
  }

  window.BCCWorkspaceFormContracts = Object.freeze({
    form,
    response,
    forms: payload => collection(payload, "forms", form),
    responses: payload => collection(payload, "responses", response),
    recipients: payload => collection(payload, "recipients", recipient),
    formFrom: payload => entity(payload, "form", form),
    responseFrom: payload => entity(payload, "response", response),
    toError
  });
})();
