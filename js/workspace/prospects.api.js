(() => {
  async function loadDashboard({ timeoutMs, withTimeout }) {
    return withTimeout(
      window.BCCAuth.api("/api/admin/prospects/dashboard"),
      timeoutMs,
      "Supabase no respondio a tiempo al cargar prospectos."
    );
  }

  function saveProspect(id, payload) {
    return id
      ? window.BCCAuth.api(`/api/admin/prospects/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) })
      : window.BCCAuth.api("/api/admin/prospects", { method: "POST", body: JSON.stringify(payload) });
  }

  function deleteProspect(id) {
    return window.BCCAuth.api(`/api/admin/prospects/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  function saveTemplate(id, payload) {
    return id
      ? window.BCCAuth.api(`/api/admin/prospect-templates/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) })
      : window.BCCAuth.api("/api/admin/prospect-templates", { method: "POST", body: JSON.stringify(payload) });
  }

  function deleteTemplate(id) {
    return window.BCCAuth.api(`/api/admin/prospect-templates/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  function persistEmail(prospectId, payload, emailId = "") {
    return emailId
      ? window.BCCAuth.api(`/api/admin/prospect-emails/${encodeURIComponent(emailId)}`, { method: "PATCH", body: JSON.stringify(payload) })
      : window.BCCAuth.api(`/api/admin/prospects/${encodeURIComponent(prospectId)}/emails`, { method: "POST", body: JSON.stringify(payload) });
  }

  function deleteEmail(id) {
    return window.BCCAuth.api(`/api/admin/prospect-emails/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  function saveActivity(prospectId, activityId, payload) {
    return activityId
      ? window.BCCAuth.api(`/api/admin/prospect-activities/${encodeURIComponent(activityId)}`, { method: "PATCH", body: JSON.stringify(payload) })
      : window.BCCAuth.api(`/api/admin/prospects/${encodeURIComponent(prospectId)}/activities`, { method: "POST", body: JSON.stringify(payload) });
  }

  function deleteActivity(id) {
    return window.BCCAuth.api(`/api/admin/prospect-activities/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  async function sendEmail(id, { edgeFunctionError }) {
    const supabase = await window.BCCAuth.loadSupabaseClient();
    const { data, error } = await supabase.functions.invoke("send-prospect-email", {
      body: { emailId: id }
    });
    if (error) throw await edgeFunctionError(error, "No fue posible enviar el correo.");
    if (data?.ok === false) throw new Error(data.error || "No fue posible enviar el correo.");
    return data;
  }

  window.BCCWorkspaceProspectsApi = {
    loadDashboard,
    saveProspect,
    deleteProspect,
    saveTemplate,
    deleteTemplate,
    persistEmail,
    deleteEmail,
    saveActivity,
    deleteActivity,
    sendEmail
  };
})();
