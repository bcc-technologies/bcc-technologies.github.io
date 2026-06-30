(() => {
  function handled(value) {
    return { handled: true, value };
  }

  function unhandled() {
    return { handled: false };
  }

  function createAdminAccessApi(deps) {
    async function requireUsersManage() {
      const me = await deps.authorizedUser();
      if (!me?.permissions.includes("users:manage")) throw new Error("Permiso insuficiente.");
      return me;
    }

    async function handle(path, options = {}) {
      const {
        supabase,
        loadWorkspaceRoleDefinitions,
        publicProfile,
        publicWorkspaceRoleDefinition,
        builtInRoleDefinitions,
        permissionCatalog,
        sanitizeWorkspaceRoleInput,
        normalizeAccessPayload,
        normalizeCustomRoleList
      } = deps;

      if (path === "/api/admin/users") {
        await requireUsersManage();
        const [{ data, error }, customRoles] = await Promise.all([
          supabase.from("profiles").select("*").order("created_at", { ascending: false }),
          loadWorkspaceRoleDefinitions(supabase)
        ]);
        if (error) throw error;
        return handled({ ok: true, users: data.map(profile => publicProfile(profile, null, customRoles)) });
      }

      if (path === "/api/admin/roles" && (!options.method || options.method === "GET")) {
        await requireUsersManage();
        const customRoles = await loadWorkspaceRoleDefinitions(supabase);
        return handled({ ok: true, roles: [...builtInRoleDefinitions(), ...customRoles], permissions: permissionCatalog(customRoles) });
      }

      if (path === "/api/admin/roles" && options.method === "POST") {
        await requireUsersManage();
        const existing = await loadWorkspaceRoleDefinitions(supabase);
        const payload = sanitizeWorkspaceRoleInput(JSON.parse(options.body || "{}"), existing);
        const { data, error } = await supabase
          .from("workspace_role_definitions")
          .insert(payload)
          .select("id, key, name, description, hierarchy_level, permissions, created_at, updated_at")
          .single();
        if (error) throw error;
        const roles = await loadWorkspaceRoleDefinitions(supabase);
        return handled({ ok: true, role: publicWorkspaceRoleDefinition(data), roles: [...builtInRoleDefinitions(), ...roles], permissions: permissionCatalog(roles) });
      }

      const roleDefinitionMatch = path.match(/^\/api\/admin\/roles\/([^/]+)$/);
      if (roleDefinitionMatch && (options.method === "PATCH" || options.method === "DELETE")) {
        await requireUsersManage();
        const id = decodeURIComponent(roleDefinitionMatch[1]);
        if (!id.startsWith("custom:")) throw new Error("Solo los roles personalizados se pueden modificar.");
        const existing = await loadWorkspaceRoleDefinitions(supabase);
        const target = existing.find(role => role.id === id);
        if (!target) throw new Error("Rol no encontrado.");
        if (options.method === "DELETE") {
          const { error } = await supabase.from("workspace_role_definitions").delete().eq("id", id);
          if (error) throw error;
          const roles = await loadWorkspaceRoleDefinitions(supabase);
          return handled({ ok: true, roles: [...builtInRoleDefinitions(), ...roles], permissions: permissionCatalog(roles) });
        }
        const payload = sanitizeWorkspaceRoleInput({ ...JSON.parse(options.body || "{}"), id }, existing.filter(role => role.id !== id));
        const { data, error } = await supabase
          .from("workspace_role_definitions")
          .update({ key: payload.key, name: payload.name, description: payload.description, hierarchy_level: payload.hierarchy_level, permissions: payload.permissions })
          .eq("id", id)
          .select("id, key, name, description, hierarchy_level, permissions, created_at, updated_at")
          .single();
        if (error) throw error;
        const roles = await loadWorkspaceRoleDefinitions(supabase);
        return handled({ ok: true, role: publicWorkspaceRoleDefinition(data), roles: [...builtInRoleDefinitions(), ...roles], permissions: permissionCatalog(roles) });
      }

      if (path === "/api/admin/access-audit") {
        await requireUsersManage();
        const { data, error } = await supabase
          .from("access_audit_logs")
          .select("id, actor_email, target_email, before_access, after_access, created_at")
          .order("created_at", { ascending: false })
          .limit(50);
        if (error) throw error;
        return handled({
          ok: true,
          logs: data.map(log => ({
            id: log.id,
            actorEmail: log.actor_email,
            targetEmail: log.target_email,
            beforeAccess: normalizeAccessPayload(log.before_access),
            afterAccess: normalizeAccessPayload(log.after_access),
            createdAt: log.created_at
          }))
        });
      }

      const roleMatch = path.match(/^\/api\/admin\/users\/([^/]+)\/role$/);
      if (roleMatch && options.method === "PATCH") {
        const body = JSON.parse(options.body || "{}");
        const customRoles = await loadWorkspaceRoleDefinitions(supabase);
        const { error } = await supabase.rpc("set_user_access", {
          target_user_id: decodeURIComponent(roleMatch[1]),
          next_role: body.role,
          next_staff_roles: body.staffRoles || [],
          next_departments: body.departments || [],
          next_custom_roles: normalizeCustomRoleList(body.customRoles, customRoles)
        });
        if (error) throw error;
        return handled({ ok: true });
      }

      return unhandled();
    }

    return { handle };
  }

  window.BCCAuthAdminAccessApi = { createAdminAccessApi };
})();
