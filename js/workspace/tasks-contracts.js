/* Domain contracts for workspace tasks. */
(() => {
  function object(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function task(value) {
    const item = object(value);
    return {
      ...item,
      id: String(item.id || ""),
      title: String(item.title || ""),
      description: String(item.description || ""),
      status: String(item.status || "backlog"),
      priority: String(item.priority || "medium"),
      importance: Number(item.importance || 3),
      urgency: Number(item.urgency || 3),
      assigneeId: String(item.assigneeId || ""),
      assignmentMode: String(item.assignmentMode || "self"),
      assignmentStatus: String(item.assignmentStatus || "accepted"),
      dueDate: item.dueDate || null
    };
  }

  function collaborator(value) {
    const item = object(value);
    return {
      ...item,
      id: String(item.id || ""),
      name: String(item.name || item.fullName || ""),
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
    return window.BCCWorkspaceTransport.toError(error, {
      schemaPattern: /workspace_tasks|relation .* does not exist/i,
      schemaMessage: "El módulo requiere activar la tabla de tareas en Supabase.",
      fallbackMessage: "No fue posible actualizar las tareas."
    });
  }

  window.BCCWorkspaceTaskContracts = Object.freeze({
    task,
    collaborator,
    tasks: payload => collection(payload, "tasks", task),
    collaborators: payload => collection(payload, "collaborators", collaborator),
    taskFrom: payload => entity(payload, "task", task),
    toError
  });
})();
