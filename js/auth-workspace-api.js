(() => {
  function handled(value) {
    return { handled: true, value };
  }

  function unhandled() {
    return { handled: false };
  }

  function createWorkspaceApi(deps) {
    async function handle(path, options = {}) {
      const {
        supabase,
        authorizedUser,
        loadWorkspaceTaskCollaborators,
        resolveWorkspaceTaskAssignment,
        normalizeWorkspacePushSubscriptionInput,
        normalizeWorkspaceTaskInput,
        normalizeWorkspaceEventInput,
        normalizeWorkspaceFormInput,
        normalizeWorkspaceAnswers,
        publicWorkspaceTask,
        publicWorkspaceEvent,
        publicWorkspaceForm,
        publicWorkspaceResponse,
        columns
      } = deps;

      if (path === "/api/workspace/push-subscriptions" && options.method === "POST") {
        const me = await authorizedUser();
        const body = normalizeWorkspacePushSubscriptionInput(JSON.parse(options.body || "{}"));
        const { data, error } = await supabase
          .from("workspace_push_subscriptions")
          .upsert({ ...body, user_id: me.id, updated_at: new Date().toISOString() }, { onConflict: "endpoint" })
          .select("id")
          .single();
        if (error) throw error;
        return handled({ ok: true, subscriptionId: data.id });
      }

      if (path === "/api/workspace/push-subscriptions" && options.method === "DELETE") {
        const body = normalizeWorkspacePushSubscriptionInput(JSON.parse(options.body || "{}"), { allowMissingKeys: true });
        const { error } = await supabase
          .from("workspace_push_subscriptions")
          .delete()
          .eq("endpoint", body.endpoint);
        if (error) throw error;
        return handled({ ok: true });
      }

      if (path === "/api/workspace/task-collaborators" && (!options.method || options.method === "GET")) {
        const collaborators = await loadWorkspaceTaskCollaborators(supabase);
        return handled({ ok: true, collaborators });
      }

      if (path === "/api/workspace/tasks" && (!options.method || options.method === "GET")) {
        const collaborators = await loadWorkspaceTaskCollaborators(supabase).catch(() => []);
        const { data, error } = await supabase
          .from("workspace_tasks")
          .select(columns.tasks)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return handled({ ok: true, tasks: data.map(task => publicWorkspaceTask(task, collaborators)) });
      }

      if (path === "/api/workspace/tasks" && options.method === "POST") {
        const me = await authorizedUser();
        const raw = JSON.parse(options.body || "{}");
        const collaborators = await loadWorkspaceTaskCollaborators(supabase).catch(() => []);
        const body = normalizeWorkspaceTaskInput(raw, true);
        Object.assign(body, resolveWorkspaceTaskAssignment(raw, me, collaborators));
        const { data, error } = await supabase
          .from("workspace_tasks")
          .insert(body)
          .select(columns.tasks)
          .single();
        if (error) throw error;
        return handled({ ok: true, task: publicWorkspaceTask(data, collaborators) });
      }

      const workspaceTaskMatch = path.match(/^\/api\/workspace\/tasks\/([^/]+)$/);
      if (workspaceTaskMatch && options.method === "PATCH") {
        const collaborators = await loadWorkspaceTaskCollaborators(supabase).catch(() => []);
        const body = normalizeWorkspaceTaskInput(JSON.parse(options.body || "{}"));
        const { data, error } = await supabase
          .from("workspace_tasks")
          .update({ ...body, updated_at: new Date().toISOString() })
          .eq("id", decodeURIComponent(workspaceTaskMatch[1]))
          .select(columns.tasks)
          .single();
        if (error) throw error;
        return handled({ ok: true, task: publicWorkspaceTask(data, collaborators) });
      }

      if (workspaceTaskMatch && options.method === "DELETE") {
        const { error } = await supabase
          .from("workspace_tasks")
          .delete()
          .eq("id", decodeURIComponent(workspaceTaskMatch[1]));
        if (error) throw error;
        return handled({ ok: true });
      }

      if (path === "/api/workspace/events" && (!options.method || options.method === "GET")) {
        const { data, error } = await supabase
          .from("workspace_events")
          .select(columns.events)
          .order("event_date", { ascending: true })
          .order("start_time", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: false });
        if (error) throw error;
        return handled({ ok: true, events: data.map(publicWorkspaceEvent) });
      }

      if (path === "/api/workspace/events" && options.method === "POST") {
        const body = normalizeWorkspaceEventInput(JSON.parse(options.body || "{}"), true);
        const { data, error } = await supabase
          .from("workspace_events")
          .insert(body)
          .select(columns.events)
          .single();
        if (error) throw error;
        return handled({ ok: true, event: publicWorkspaceEvent(data) });
      }

      const workspaceEventMatch = path.match(/^\/api\/workspace\/events\/([^/]+)$/);
      if (workspaceEventMatch && options.method === "PATCH") {
        const body = normalizeWorkspaceEventInput(JSON.parse(options.body || "{}"));
        const { data, error } = await supabase
          .from("workspace_events")
          .update({ ...body, updated_at: new Date().toISOString() })
          .eq("id", decodeURIComponent(workspaceEventMatch[1]))
          .select(columns.events)
          .single();
        if (error) throw error;
        return handled({ ok: true, event: publicWorkspaceEvent(data) });
      }

      if (workspaceEventMatch && options.method === "DELETE") {
        const { error } = await supabase
          .from("workspace_events")
          .delete()
          .eq("id", decodeURIComponent(workspaceEventMatch[1]));
        if (error) throw error;
        return handled({ ok: true });
      }

      if (path === "/api/workspace/forms" && (!options.method || options.method === "GET")) {
        const { data, error } = await supabase
          .from("workspace_forms")
          .select(columns.forms)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return handled({ ok: true, forms: data.map(publicWorkspaceForm) });
      }

      if (path === "/api/workspace/forms" && options.method === "POST") {
        const me = await authorizedUser();
        if (!me?.permissions.includes("forms:manage")) throw new Error("Permiso insuficiente.");
        const body = normalizeWorkspaceFormInput(JSON.parse(options.body || "{}"), true);
        const { data, error } = await supabase
          .from("workspace_forms")
          .insert(body)
          .select(columns.forms)
          .single();
        if (error) throw error;
        return handled({ ok: true, form: publicWorkspaceForm(data) });
      }

      if (path === "/api/workspace/form-responses/me") {
        const { data, error } = await supabase
          .from("workspace_form_responses")
          .select(columns.responses)
          .order("submitted_at", { ascending: false });
        if (error) throw error;
        return handled({ ok: true, responses: data.map(publicWorkspaceResponse) });
      }

      const workspaceFormMatch = path.match(/^\/api\/workspace\/forms\/([^/]+)$/);
      if (workspaceFormMatch && options.method === "PATCH") {
        const me = await authorizedUser();
        if (!me?.permissions.includes("forms:manage")) throw new Error("Permiso insuficiente.");
        const body = normalizeWorkspaceFormInput(JSON.parse(options.body || "{}"));
        const { data, error } = await supabase
          .from("workspace_forms")
          .update({ ...body, updated_at: new Date().toISOString() })
          .eq("id", decodeURIComponent(workspaceFormMatch[1]))
          .select(columns.forms)
          .single();
        if (error) throw error;
        return handled({ ok: true, form: publicWorkspaceForm(data) });
      }

      const responseListMatch = path.match(/^\/api\/workspace\/forms\/([^/]+)\/responses$/);
      if (responseListMatch) {
        const me = await authorizedUser();
        if (!me?.permissions.includes("forms:manage")) throw new Error("Permiso insuficiente.");
        const formId = decodeURIComponent(responseListMatch[1]);
        const { data, error } = await supabase
          .from("workspace_form_responses")
          .select(columns.responses)
          .eq("form_id", formId)
          .order("submitted_at", { ascending: false });
        if (error) throw error;
        const profileIds = [...new Set(data.map(item => item.respondent_id))];
        const { data: profiles, error: profileError } = profileIds.length
          ? await supabase.from("profiles").select("id, display_name, full_name, email").in("id", profileIds)
          : { data: [], error: null };
        if (profileError) throw profileError;
        const labels = new Map(profiles.map(profile => [profile.id, profile.display_name || profile.full_name || profile.email]));
        return handled({
          ok: true,
          responses: data.map(item => ({ ...publicWorkspaceResponse(item), respondentLabel: labels.get(item.respondent_id) || "Usuario" }))
        });
      }

      const responseSubmitMatch = path.match(/^\/api\/workspace\/forms\/([^/]+)\/response$/);
      if (responseSubmitMatch && options.method === "POST") {
        const me = await authorizedUser();
        if (!me) throw new Error("No autenticado.");
        const formId = decodeURIComponent(responseSubmitMatch[1]);
        const { data: form, error: formError } = await supabase
          .from("workspace_forms")
          .select(columns.forms)
          .eq("id", formId)
          .single();
        if (formError) throw formError;
        const answers = normalizeWorkspaceAnswers(JSON.parse(options.body || "{}").answers, form.questions);
        const { data, error } = await supabase
          .from("workspace_form_responses")
          .upsert({
            form_id: formId,
            respondent_id: me.id,
            answers,
            submitted_at: new Date().toISOString()
          }, { onConflict: "form_id,respondent_id" })
          .select(columns.responses)
          .single();
        if (error) throw error;
        return handled({ ok: true, response: publicWorkspaceResponse(data) });
      }

      return unhandled();
    }

    return { handle };
  }

  window.BCCAuthWorkspaceApi = { createWorkspaceApi };
})();
