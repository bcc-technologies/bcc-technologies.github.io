(() => {
  function handled(value) {
    return { handled: true, value };
  }

  function unhandled() {
    return { handled: false };
  }

  function createProspectsApi(deps) {
    async function requireProspectAccess() {
      const me = await deps.authorizedUser();
      if (!deps.canManageSignalWorkspace(me)) throw new Error("Permiso insuficiente.");
      return me;
    }

    async function handle(path, options = {}) {
      const {
        supabase,
        isMissingProspectAssignmentSchema,
        workspaceProspectWithoutAssignment,
        normalizeWorkspaceProspectInput,
        normalizeWorkspaceProspectTemplateInput,
        normalizeWorkspaceProspectEmailInput,
        normalizeWorkspaceProspectActivityInput,
        publicWorkspaceProspect,
        publicWorkspaceProspectTemplate,
        publicWorkspaceProspectEmail,
        publicWorkspaceProspectActivity,
        columns
      } = deps;

      if (path === "/api/admin/prospects/dashboard" && (!options.method || options.method === "GET")) {
        await requireProspectAccess();
        let prospectsResult = await supabase.from("workspace_prospects").select(columns.prospects).order("updated_at", { ascending: false });
        if (isMissingProspectAssignmentSchema(prospectsResult.error)) {
          prospectsResult = await supabase.from("workspace_prospects").select(columns.prospectBase).order("updated_at", { ascending: false });
        }
        const [{ data: templates, error: templatesError }, { data: emails, error: emailsError }, { data: activities, error: activitiesError }] = await Promise.all([
          supabase.from("workspace_prospect_templates").select(columns.templates).order("updated_at", { ascending: false }),
          supabase.from("workspace_prospect_emails").select(columns.emails).order("created_at", { ascending: false }).limit(200),
          supabase.from("workspace_prospect_activities").select(columns.activities).order("occurred_at", { ascending: false }).order("created_at", { ascending: false }).limit(400)
        ]);
        const { data: prospects, error: prospectsError } = prospectsResult;
        if (prospectsError) throw prospectsError;
        if (templatesError) throw templatesError;
        if (emailsError) throw emailsError;
        if (activitiesError) throw activitiesError;
        return handled({
          ok: true,
          prospects: (prospects || []).map(publicWorkspaceProspect),
          templates: (templates || []).map(publicWorkspaceProspectTemplate),
          emails: (emails || []).map(publicWorkspaceProspectEmail),
          activities: (activities || []).map(publicWorkspaceProspectActivity)
        });
      }

      if (path === "/api/admin/prospects" && options.method === "POST") {
        await requireProspectAccess();
        const body = normalizeWorkspaceProspectInput(JSON.parse(options.body || "{}"), true);
        let { data, error } = await supabase
          .from("workspace_prospects")
          .insert(body)
          .select(columns.prospects)
          .single();
        if (isMissingProspectAssignmentSchema(error)) {
          const fallback = await supabase
            .from("workspace_prospects")
            .insert(workspaceProspectWithoutAssignment(body))
            .select(columns.prospectBase)
            .single();
          data = fallback.data;
          error = fallback.error;
        }
        if (error) throw error;
        return handled({ ok: true, prospect: publicWorkspaceProspect(data) });
      }

      const adminProspectMatch = path.match(/^\/api\/admin\/prospects\/([^/]+)$/);
      if (adminProspectMatch && options.method === "PATCH") {
        await requireProspectAccess();
        const prospectId = decodeURIComponent(adminProspectMatch[1]);
        const body = normalizeWorkspaceProspectInput(JSON.parse(options.body || "{}"));
        let { data, error } = await supabase
          .from("workspace_prospects")
          .update({ ...body, updated_at: new Date().toISOString() })
          .eq("id", prospectId)
          .select(columns.prospects)
          .single();
        if (isMissingProspectAssignmentSchema(error)) {
          const fallback = await supabase
            .from("workspace_prospects")
            .update({ ...workspaceProspectWithoutAssignment(body), updated_at: new Date().toISOString() })
            .eq("id", prospectId)
            .select(columns.prospectBase)
            .single();
          data = fallback.data;
          error = fallback.error;
        }
        if (error) throw error;
        return handled({ ok: true, prospect: publicWorkspaceProspect(data) });
      }

      if (adminProspectMatch && options.method === "DELETE") {
        await requireProspectAccess();
        const { error } = await supabase
          .from("workspace_prospects")
          .delete()
          .eq("id", decodeURIComponent(adminProspectMatch[1]));
        if (error) throw error;
        return handled({ ok: true });
      }

      if (path === "/api/admin/prospect-templates" && options.method === "POST") {
        await requireProspectAccess();
        const body = normalizeWorkspaceProspectTemplateInput(JSON.parse(options.body || "{}"), true);
        const { data, error } = await supabase
          .from("workspace_prospect_templates")
          .insert(body)
          .select(columns.templates)
          .single();
        if (error) throw error;
        return handled({ ok: true, template: publicWorkspaceProspectTemplate(data) });
      }

      const templateMatch = path.match(/^\/api\/admin\/prospect-templates\/([^/]+)$/);
      if (templateMatch && options.method === "PATCH") {
        await requireProspectAccess();
        const body = normalizeWorkspaceProspectTemplateInput(JSON.parse(options.body || "{}"));
        const { data, error } = await supabase
          .from("workspace_prospect_templates")
          .update({ ...body, updated_at: new Date().toISOString() })
          .eq("id", decodeURIComponent(templateMatch[1]))
          .select(columns.templates)
          .single();
        if (error) throw error;
        return handled({ ok: true, template: publicWorkspaceProspectTemplate(data) });
      }

      if (templateMatch && options.method === "DELETE") {
        await requireProspectAccess();
        const { error } = await supabase
          .from("workspace_prospect_templates")
          .delete()
          .eq("id", decodeURIComponent(templateMatch[1]));
        if (error) throw error;
        return handled({ ok: true });
      }

      const createEmailMatch = path.match(/^\/api\/admin\/prospects\/([^/]+)\/emails$/);
      if (createEmailMatch && options.method === "POST") {
        await requireProspectAccess();
        const body = normalizeWorkspaceProspectEmailInput(JSON.parse(options.body || "{}"), true);
        body.prospect_id = decodeURIComponent(createEmailMatch[1]);
        const { data, error } = await supabase
          .from("workspace_prospect_emails")
          .insert(body)
          .select(columns.emails)
          .single();
        if (error) throw error;
        return handled({ ok: true, email: publicWorkspaceProspectEmail(data) });
      }

      const prospectEmailMatch = path.match(/^\/api\/admin\/prospect-emails\/([^/]+)$/);
      if (prospectEmailMatch && options.method === "PATCH") {
        await requireProspectAccess();
        const body = normalizeWorkspaceProspectEmailInput(JSON.parse(options.body || "{}"));
        const { data, error } = await supabase
          .from("workspace_prospect_emails")
          .update({ ...body, updated_at: new Date().toISOString() })
          .eq("id", decodeURIComponent(prospectEmailMatch[1]))
          .select(columns.emails)
          .single();
        if (error) throw error;
        return handled({ ok: true, email: publicWorkspaceProspectEmail(data) });
      }

      if (prospectEmailMatch && options.method === "DELETE") {
        await requireProspectAccess();
        const { error } = await supabase
          .from("workspace_prospect_emails")
          .delete()
          .eq("id", decodeURIComponent(prospectEmailMatch[1]));
        if (error) throw error;
        return handled({ ok: true });
      }

      const createActivityMatch = path.match(/^\/api\/admin\/prospects\/([^/]+)\/activities$/);
      if (createActivityMatch && options.method === "POST") {
        await requireProspectAccess();
        const body = normalizeWorkspaceProspectActivityInput(JSON.parse(options.body || "{}"), true);
        body.prospect_id = decodeURIComponent(createActivityMatch[1]);
        const { data, error } = await supabase
          .from("workspace_prospect_activities")
          .insert(body)
          .select(columns.activities)
          .single();
        if (error) throw error;
        return handled({ ok: true, activity: publicWorkspaceProspectActivity(data) });
      }

      const prospectActivityMatch = path.match(/^\/api\/admin\/prospect-activities\/([^/]+)$/);
      if (prospectActivityMatch && options.method === "PATCH") {
        await requireProspectAccess();
        const body = normalizeWorkspaceProspectActivityInput(JSON.parse(options.body || "{}"));
        const { data, error } = await supabase
          .from("workspace_prospect_activities")
          .update({ ...body, updated_at: new Date().toISOString() })
          .eq("id", decodeURIComponent(prospectActivityMatch[1]))
          .select(columns.activities)
          .single();
        if (error) throw error;
        return handled({ ok: true, activity: publicWorkspaceProspectActivity(data) });
      }

      if (prospectActivityMatch && options.method === "DELETE") {
        await requireProspectAccess();
        const { error } = await supabase
          .from("workspace_prospect_activities")
          .delete()
          .eq("id", decodeURIComponent(prospectActivityMatch[1]));
        if (error) throw error;
        return handled({ ok: true });
      }

      return unhandled();
    }

    return { handle };
  }

  window.BCCAuthProspectsApi = { createProspectsApi };
})();
