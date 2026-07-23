(() => {
  const LICENSE_COLUMNS = `
    id, organization_id, contact_email, plan, seats, used_seats, status, platform,
    starts_at, ends_at, created_at, updated_at,
    organization:organizations(id,name),
    entitlements:map_license_entitlements(
      product:map_products(key,name)
    )
  `;

  const publicLicense = row => ({
    id: row.id,
    organizationId: row.organization_id,
    organization: row.organization?.name || "Organización",
    contactEmail: row.contact_email || "",
    products: (row.entitlements || []).map(item => item.product?.name || item.product?.key).filter(Boolean),
    plan: row.plan,
    seats: Number(row.seats || 0),
    usedSeats: Number(row.used_seats || 0),
    status: row.status,
    platform: row.platform,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });

  const publicUser = row => ({
    id: row.user_id,
    name: row.name || "Usuario",
    email: row.email || "",
    role: row.role || "client"
  });

  const publicAssignment = row => ({
    id: row.id,
    userId: row.user_id,
    name: row.name || "Usuario",
    email: row.email || "",
    status: row.status,
    assignedAt: row.assigned_at,
    revokedAt: row.revoked_at || ""
  });

  function handled(value) { return { handled: true, value }; }
  function unhandled() { return { handled: false }; }

  function createMapLicensesApi({ supabase, authorizedUser }) {
    async function requirePermission(permission) {
      const me = await authorizedUser();
      const permissions = new Set(me?.permissions || []);
      const allowed = permissions.has(permission)
        || (permission === "licenses:view" && (permissions.has("licenses:manage") || permissions.has("licenses:assign")));
      if (!allowed) throw new Error("Permiso insuficiente.");
      return me;
    }

    async function loadLicense(id) {
      const { data, error } = await supabase
        .from("map_licenses")
        .select(LICENSE_COLUMNS)
        .eq("id", id)
        .single();
      if (error) throw error;
      return publicLicense(data);
    }

    async function handle(path, options = {}) {
      const url = new URL(path, window.location.origin);
      const method = options.method || "GET";

      if (url.pathname === "/api/admin/licenses/assignable-users" && method === "GET") {
        await requirePermission("licenses:assign");
        const { data, error } = await supabase.rpc("list_license_assignable_users");
        if (error) throw error;
        return handled({ ok: true, users: (data || []).map(publicUser) });
      }

      if (url.pathname === "/api/admin/licenses" && method === "GET") {
        await requirePermission("licenses:view");
        const { data, error } = await supabase.from("map_licenses").select(LICENSE_COLUMNS).order("created_at", { ascending: false });
        if (error) throw error;
        return handled({ ok: true, licenses: (data || []).map(publicLicense) });
      }

      if (url.pathname === "/api/admin/licenses" && method === "POST") {
        await requirePermission("licenses:manage");
        const payload = JSON.parse(options.body || "{}");
        const { data, error } = await supabase.rpc("create_map_license", { payload });
        if (error) throw error;
        return handled({ ok: true, license: await loadLicense(data) });
      }

      const assignmentsMatch = url.pathname.match(/^\/api\/admin\/licenses\/([^/]+)\/assignments$/);
      if (assignmentsMatch && method === "GET") {
        await requirePermission("licenses:view");
        const licenseId = decodeURIComponent(assignmentsMatch[1]);
        const { data, error } = await supabase.rpc("list_map_license_assignments", {
          target_license_id: licenseId
        });
        if (error) throw error;
        return handled({ ok: true, assignments: (data || []).map(publicAssignment) });
      }

      if (assignmentsMatch && method === "POST") {
        await requirePermission("licenses:assign");
        const licenseId = decodeURIComponent(assignmentsMatch[1]);
        const body = JSON.parse(options.body || "{}");
        const { data, error } = await supabase.rpc("assign_map_license_user", {
          target_license_id: licenseId,
          target_user_id: body.userId
        });
        if (error) throw error;
        const assignment = Array.isArray(data) ? data[0] : data;
        return handled({
          ok: true,
          license: await loadLicense(licenseId),
          assignment: publicAssignment(assignment || {})
        });
      }

      const assignmentUserMatch = url.pathname.match(/^\/api\/admin\/licenses\/([^/]+)\/assignments\/([^/]+)$/);
      if (assignmentUserMatch && method === "DELETE") {
        await requirePermission("licenses:assign");
        const licenseId = decodeURIComponent(assignmentUserMatch[1]);
        const { error } = await supabase.rpc("revoke_map_license_user", {
          target_license_id: licenseId,
          target_user_id: decodeURIComponent(assignmentUserMatch[2])
        });
        if (error) throw error;
        return handled({ ok: true, license: await loadLicense(licenseId) });
      }

      const statusMatch = url.pathname.match(/^\/api\/admin\/licenses\/([^/]+)\/status$/);
      if (statusMatch && method === "PATCH") {
        await requirePermission("licenses:manage");
        const licenseId = decodeURIComponent(statusMatch[1]);
        const body = JSON.parse(options.body || "{}");
        const { error } = await supabase.rpc("set_map_license_status", {
          target_license_id: licenseId,
          next_status: body.status
        });
        if (error) throw error;
        return handled({ ok: true, license: await loadLicense(licenseId) });
      }
      return unhandled();
    }
    return { handle };
  }

  window.BCCAuthMapLicensesApi = { createMapLicensesApi };
})();
