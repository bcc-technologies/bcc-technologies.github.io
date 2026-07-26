/* Domain contracts for workspace calendar events. */
(() => {
  function object(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function event(value) {
    const item = object(value);
    return {
      ...item,
      id: String(item.id || ""),
      title: String(item.title || ""),
      type: String(item.type || "meeting"),
      date: String(item.date || ""),
      startTime: String(item.startTime || ""),
      endTime: String(item.endTime || ""),
      description: String(item.description || ""),
      location: String(item.location || ""),
      link: String(item.link || ""),
      visibility: String(item.visibility || "private"),
      relatedTaskId: String(item.relatedTaskId || "")
    };
  }

  function events(payload) {
    const items = object(payload).events;
    if (!Array.isArray(items)) throw new Error("Respuesta inválida: faltan events.");
    return items.map(event);
  }

  function eventFrom(payload) {
    const item = object(payload).event;
    if (!item || typeof item !== "object") throw new Error("Respuesta inválida: falta event.");
    return event(item);
  }

  function toError(error) {
    return window.BCCWorkspaceTransport.toError(error, {
      schemaPattern: /workspace_events|relation .* does not exist/i,
      schemaMessage: "El calendario requiere activar la tabla de eventos en Supabase.",
      fallbackMessage: "No fue posible actualizar el calendario."
    });
  }

  window.BCCWorkspaceCalendarContracts = Object.freeze({ event, events, eventFrom, toError });
})();
