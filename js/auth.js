const ROLE_PERMISSIONS = {
  client: ["dashboard:view", "profile:update", "downloads:view", "support:create"],
  staff: ["dashboard:view", "staff:view", "profile:update", "downloads:view", "support:create", "clients:view", "content:view"],
  admin: ["dashboard:view", "staff:view", "profile:update", "downloads:view", "support:create", "clients:view", "content:view", "cms:access", "users:manage", "forms:manage", "admin:view"]
};

const STAFF_ROLE_PERMISSIONS = {
  author: ["content:write", "cms:access"],
  cofounder: ["content:write", "cms:access", "strategy:view"],
  department_director: ["content:write", "cms:access", "department:manage", "forms:manage"]
};

const BASE_ROLE_HIERARCHY = { admin: 0, staff: 50, client: 90 };
const STAFF_ROLE_HIERARCHY = { cofounder: 10, department_director: 20, author: 40 };
const DEFAULT_CUSTOM_ROLE_HIERARCHY = 50;

const DEPARTMENT_PERMISSIONS = {
  technology: ["department:technology"],
  finance: ["department:finance"],
  operations: ["department:operations"],
  marketing: ["department:marketing"],
  hr: ["department:hr"]
};

const STAFF_ROLES = Object.keys(STAFF_ROLE_PERMISSIONS);
const DEPARTMENTS = Object.keys(DEPARTMENT_PERMISSIONS);

const PERMISSION_LABELS = {
  "dashboard:view": "Ver dashboard",
  "profile:update": "Actualizar perfil",
  "downloads:view": "Ver descargas",
  "support:create": "Crear solicitudes",
  "staff:view": "Vista de personal",
  "clients:view": "Ver clientes",
  "content:view": "Ver contenido",
  "cms:access": "Acceso CMS",
  "users:manage": "Administrar usuarios",
  "forms:manage": "Administrar formularios",
  "admin:view": "Vista administrador",
  "content:write": "Crear contenido",
  "strategy:view": "Ver estrategia",
  "department:manage": "Gestionar departamento",
  "department:technology": "Departamento tecnología",
  "department:finance": "Departamento finanzas",
  "department:operations": "Departamento operaciones",
  "department:marketing": "Departamento marketing",
  "department:hr": "Departamento RR. HH."
};

const ROLE_LABELS = {
  client: "Cliente",
  staff: "Personal",
  admin: "Administrador",
  author: "Autor",
  cofounder: "Cofounder",
  department_director: "Director",
  technology: "Tecnología",
  finance: "Finanzas",
  operations: "Operaciones",
  marketing: "Marketing",
  hr: "Recursos humanos"
};

let currentPageUser = null;
let currentUserPromise = null;
const PASSWORD_RULE_MESSAGE = "La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un símbolo.";

function normalizeList(value, allowed) {
  const list = Array.isArray(value) ? value : [];
  return [...new Set(list.map(item => String(item || "").trim()).filter(item => allowed.includes(item)))];
}

function validatePassword(password) {
  const value = String(password || "");
  return value.length >= 8 && /[A-Z]/.test(value) && /[a-z]/.test(value) && /[^A-Za-z0-9]/.test(value);
}

function normalizeCustomRoleList(value, definitions = []) {
  const allowed = new Set((definitions || []).map(role => role.id));
  const list = Array.isArray(value) ? value : [];
  const clean = [...new Set(list.map(item => String(item || "").trim()).filter(Boolean))];
  return allowed.size ? clean.filter(item => allowed.has(item)) : clean;
}

function hierarchyLevelForProfile(role, staffRoles = [], customRoles = [], customRoleDefinitions = []) {
  const levels = [BASE_ROLE_HIERARCHY[role] ?? BASE_ROLE_HIERARCHY.client];
  normalizeList(staffRoles, STAFF_ROLES).forEach(staffRole => levels.push(STAFF_ROLE_HIERARCHY[staffRole] ?? DEFAULT_CUSTOM_ROLE_HIERARCHY));
  const customDefinitions = new Map((customRoleDefinitions || []).map(customRole => [customRole.id, customRole]));
  normalizeCustomRoleList(customRoles, customRoleDefinitions).forEach(customRoleId => {
    levels.push(Number(customDefinitions.get(customRoleId)?.hierarchyLevel ?? DEFAULT_CUSTOM_ROLE_HIERARCHY));
  });
  return Math.min(...levels.filter(level => Number.isFinite(level)));
}

function permissionsForProfile(role, staffRoles = [], departments = [], customRoles = [], customRoleDefinitions = []) {
  const permissions = new Set(ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.client);
  normalizeList(staffRoles, STAFF_ROLES).forEach(staffRole => {
    (STAFF_ROLE_PERMISSIONS[staffRole] || []).forEach(permission => permissions.add(permission));
  });
  normalizeList(departments, DEPARTMENTS).forEach(department => {
    (DEPARTMENT_PERMISSIONS[department] || []).forEach(permission => permissions.add(permission));
  });
  const customDefinitions = new Map((customRoleDefinitions || []).map(customRole => [customRole.id, customRole]));
  normalizeCustomRoleList(customRoles, customRoleDefinitions).forEach(customRoleId => {
    (customDefinitions.get(customRoleId)?.permissions || []).forEach(permission => permissions.add(permission));
  });
  if (role === "admin") {
    STAFF_ROLES.forEach(staffRole => (STAFF_ROLE_PERMISSIONS[staffRole] || []).forEach(permission => permissions.add(permission)));
    DEPARTMENTS.forEach(department => (DEPARTMENT_PERMISSIONS[department] || []).forEach(permission => permissions.add(permission)));
  }
  return [...permissions];
}

function builtInRoleDefinitions() {
  const base = Object.entries(ROLE_PERMISSIONS).map(([id, permissions]) => ({
    id: `base:${id}`,
    key: id,
    name: ROLE_LABELS[id] || id,
    description: id === "client" ? "Acceso externo para clientes." : id === "staff" ? "Acceso interno operativo." : "Control completo del workspace.",
    type: "base",
    locked: true,
    hierarchyLevel: BASE_ROLE_HIERARCHY[id] ?? DEFAULT_CUSTOM_ROLE_HIERARCHY,
    permissions: [...permissions].sort()
  }));
  const staff = Object.entries(STAFF_ROLE_PERMISSIONS).map(([id, permissions]) => ({
    id: `staff:${id}`,
    key: id,
    name: ROLE_LABELS[id] || id,
    description: "Rol interno acumulable para personal y administradores.",
    type: "staff",
    locked: true,
    hierarchyLevel: STAFF_ROLE_HIERARCHY[id] ?? DEFAULT_CUSTOM_ROLE_HIERARCHY,
    permissions: [...permissions].sort()
  }));
  const departments = Object.entries(DEPARTMENT_PERMISSIONS).map(([id, permissions]) => ({
    id: `department:${id}`,
    key: id,
    name: ROLE_LABELS[id] || id,
    description: "Ámbito departamental acumulable.",
    type: "department",
    locked: true,
    hierarchyLevel: DEFAULT_CUSTOM_ROLE_HIERARCHY,
    permissions: [...permissions].sort()
  }));
  return [...base, ...staff, ...departments];
}

function permissionCatalog(customRoles = []) {
  const values = new Set([
    ...Object.values(ROLE_PERMISSIONS).flat(),
    ...Object.values(STAFF_ROLE_PERMISSIONS).flat(),
    ...Object.values(DEPARTMENT_PERMISSIONS).flat(),
    ...(customRoles || []).flatMap(role => Array.isArray(role.permissions) ? role.permissions : [])
  ]);
  return [...values].sort().map(value => ({
    value,
    label: PERMISSION_LABELS[value] || value,
    group: value.includes(":") ? value.split(":")[0] : "general"
  }));
}

function slugifyRole(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function publicWorkspaceRoleDefinition(row = {}) {
  const id = String(row.id || "");
  return {
    id,
    key: String(row.key || id).replace(/^custom:/, ""),
    name: String(row.name || "Rol personalizado"),
    description: String(row.description || ""),
    type: "custom",
    locked: false,
    hierarchyLevel: normalizeHierarchyLevel(row.hierarchy_level ?? row.hierarchyLevel),
    permissions: [...new Set(Array.isArray(row.permissions) ? row.permissions.map(String) : [])].sort(),
    createdAt: row.created_at || row.createdAt || "",
    updatedAt: row.updated_at || row.updatedAt || ""
  };
}

function normalizeHierarchyLevel(value, fallback = DEFAULT_CUSTOM_ROLE_HIERARCHY) {
  const level = Number(value);
  if (!Number.isFinite(level)) return fallback;
  return Math.max(0, Math.min(100, Math.round(level)));
}

function sanitizeWorkspaceRoleInput(body = {}, existing = []) {
  const name = String(body.name || "").trim().replace(/\s+/g, " ");
  if (!name) throw new Error("Nombre de rol requerido.");
  const allowed = new Set(permissionCatalog(existing).map(permission => permission.value));
  const permissions = [...new Set((Array.isArray(body.permissions) ? body.permissions : [])
    .map(permission => String(permission || "").trim())
    .filter(permission => allowed.has(permission)))]
    .sort();
  if (!permissions.length) throw new Error("Selecciona al menos un permiso.");
  const providedId = String(body.id || "").trim();
  const baseId = providedId.startsWith("custom:") ? providedId.slice(7) : slugifyRole(name);
  const ids = new Set(existing.map(role => role.id));
  let id = providedId || `custom:${baseId || Math.random().toString(16).slice(2, 10)}`;
  if (!providedId) {
    const original = id;
    let suffix = 2;
    while (ids.has(id)) id = `${original}-${suffix++}`;
  }
  return {
    id,
    key: id.replace(/^custom:/, ""),
    name,
    description: String(body.description || "").trim(),
    hierarchy_level: normalizeHierarchyLevel(body.hierarchyLevel ?? body.hierarchy_level),
    permissions
  };
}

async function loadSupabaseClient() {
  if (window.BCCSupabaseClient) return window.BCCSupabaseClient;
  if (!window.BCC_SUPABASE) throw new Error("Falta configuración de Supabase.");
  if (!window.supabase?.createClient) {
    await new Promise((resolve, reject) => {
      const existing = document.querySelector("script[data-bcc-supabase-js=\"true\"], script[data-supabase-js]");
      if (existing) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", () => reject(new Error("No se pudo cargar Supabase.")), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
      script.dataset.bccSupabaseJs = "true";
      script.onload = resolve;
      script.onerror = () => reject(new Error("No se pudo cargar Supabase."));
      document.head.appendChild(script);
    });
  }

  window.BCCSupabaseClient = window.supabase.createClient(
    window.BCC_SUPABASE.url,
    window.BCC_SUPABASE.anonKey,
    { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
  );
  return window.BCCSupabaseClient;
}

async function waitForSupabaseSession(timeoutMs = 5000) {
  const supabase = await loadSupabaseClient();
  const deadline = Date.now() + timeoutMs;
  let lastSession = null;

  while (Date.now() < deadline) {
    const { data } = await supabase.auth.getSession();
    if (data?.session) return data.session;
    lastSession = data?.session || null;
    await new Promise(resolve => setTimeout(resolve, 150));
  }

  return lastSession;
}

async function supabaseFunctionError(error, fallback) {
  if (typeof error?.context?.json === "function") {
    try {
      const payload = await error.context.json();
      if (payload?.error) return new Error(String(payload.error));
    } catch {}
  }
  return error instanceof Error ? error : new Error(fallback);
}

async function preparePasswordRecovery(timeoutMs = 7000) {
  const supabase = await loadSupabaseClient();
  const params = new URLSearchParams(location.search);
  const code = params.get("code");

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    history.replaceState(null, "", location.pathname);
    return waitForSupabaseSession(timeoutMs);
  }

  if (location.hash) {
    const hash = new URLSearchParams(location.hash.slice(1));
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      });
      if (error) throw error;
      history.replaceState(null, "", location.pathname);
      return waitForSupabaseSession(timeoutMs);
    }
  }

  return waitForSupabaseSession(timeoutMs);
}

function parsePersonName(name) {
  const clean = String(name || "").trim().replace(/\s+/g, " ");
  const parts = clean ? clean.split(" ") : [];
  const firstName = parts[0] || "";
  let middleNames = "";
  let firstLastName = "";
  let secondLastName = "";
  if (parts.length === 2) firstLastName = parts[1];
  else if (parts.length === 3) {
    firstLastName = parts[1];
    secondLastName = parts[2];
  } else if (parts.length >= 4) {
    middleNames = parts.slice(1, -2).join(" ");
    firstLastName = parts[parts.length - 2];
    secondLastName = parts[parts.length - 1];
  }
  return { fullName: clean, firstName, middleNames, firstLastName, secondLastName, displayName: firstName || clean };
}

function publicProfile(profile, authUser = null, customRoleDefinitions = []) {
  if (!profile && !authUser) return null;
  const metadata = authUser?.user_metadata || {};
  const fullName = profile?.full_name || metadata.full_name || metadata.name || authUser?.email || "";
  const parsed = parsePersonName(fullName);
  const role = profile?.role || "client";
  const staffRoles = normalizeList(profile?.staff_roles, STAFF_ROLES);
  const departments = normalizeList(profile?.departments, DEPARTMENTS);
  const customRoles = normalizeCustomRoleList(profile?.custom_roles, customRoleDefinitions);
  return {
    id: profile?.id || authUser?.id,
    name: fullName,
    displayName: profile?.display_name || parsed.displayName,
    nameParts: {
      fullName,
      firstName: profile?.first_name || parsed.firstName,
      middleNames: profile?.middle_names || parsed.middleNames,
      firstLastName: profile?.first_last_name || parsed.firstLastName,
      secondLastName: profile?.second_last_name || parsed.secondLastName,
      displayName: profile?.display_name || parsed.displayName
    },
    email: authUser?.email || profile?.email || "",
    emails: [],
    company: profile?.company || metadata.company || "",
    title: profile?.title || metadata.title || "",
    role,
    staffRoles,
    departments,
    customRoles,
    status: "active",
    hierarchyLevel: hierarchyLevelForProfile(role, staffRoles, customRoles, customRoleDefinitions),
    permissions: permissionsForProfile(role, staffRoles, departments, customRoles, customRoleDefinitions),
    createdAt: profile?.created_at || authUser?.created_at || "",
    lastLoginAt: authUser?.last_sign_in_at || ""
  };
}
async function currentUser() {
  if (currentPageUser) return currentPageUser;
  if (currentUserPromise) return currentUserPromise;

  currentUserPromise = (async () => {
    try {
      const supabase = await loadSupabaseClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (!userError && userData?.user) {
        let { data: profile, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userData.user.id)
          .maybeSingle();

        if (error) throw error;

        if (!profile) {
          const metadata = userData.user.user_metadata || {};
          const parsed = parsePersonName(metadata.full_name || metadata.name || "");
          const payload = {
            id: userData.user.id,
            email: userData.user.email || "",
            full_name: parsed.fullName,
            first_name: parsed.firstName,
            middle_names: parsed.middleNames,
            first_last_name: parsed.firstLastName,
            second_last_name: parsed.secondLastName,
            display_name: parsed.displayName,
            company: metadata.company || "",
            title: metadata.title || "",
            role: "client",
            staff_roles: [],
            departments: [],
            custom_roles: []
          };
          const created = await supabase.from("profiles").insert(payload).select("*").single();
          if (!created.error) profile = created.data;
        }

        currentPageUser = publicProfile(profile, userData.user);
        return currentPageUser;
      }
    } catch (_error) {
      // Fall back to local account server when Supabase auth is unavailable.
    }

    try {
      const res = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
      if (!res.ok) return null;
      const payload = await res.json().catch(() => null);
      if (payload?.ok && payload?.user) {
        currentPageUser = payload.user;
        return payload.user;
      }
    } catch (_error) {
      // Ignore and continue with a null user.
    }

    return null;
  })();

  try {
    return await currentUserPromise;
  } finally {
    currentUserPromise = null;
  }
}


function canManageSignalWorkspace(user) {
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  return permissions.includes("admin:view") || permissions.includes("department:manage");
}

async function authorizedUser() {
  return currentPageUser || currentUser();
}

function authMessage(text, tone = "error") {
  const el = document.querySelector("[data-auth-message]");
  if (!el) return;
  el.textContent = text || "";
  el.dataset.tone = tone;
  el.hidden = !text;
}

function routeForUser(user) {
  if (user?.permissions?.includes("admin:view")) return "/staff-dashboard.html";
  if (user?.permissions?.includes("staff:view")) return "/staff-dashboard.html";
  return "/dashboard.html";
}

async function requireAuth({ admin = false, roles = null, permission = "" } = {}) {
  try {
    if (location.hash || location.search.includes("code=")) {
      await waitForSupabaseSession();
      if (location.hash) history.replaceState(null, "", location.pathname + location.search);
    }

    const user = await currentUser();
    if (!user) {
      window.location.replace(`/login.html?next=${encodeURIComponent(location.pathname)}`);
      return null;
    }
    if (admin && !user.permissions.includes("admin:view")) {
      window.location.replace(routeForUser(user));
      return null;
    }
    if (permission && !user.permissions.includes(permission)) {
      window.location.replace(routeForUser(user));
      return null;
    }
    if (Array.isArray(roles) && roles.length && !roles.includes(user.role) && !user.permissions.includes("admin:view")) {
      window.location.replace(routeForUser(user));
      return null;
    }
    return user;
  } catch (error) {
    console.error(error);
    window.location.replace(`/login.html?next=${encodeURIComponent(location.pathname)}`);
    return null;
  }
}

async function logout() {
  const supabase = await loadSupabaseClient();
  await supabase.auth.signOut();
  currentPageUser = null;
  currentUserPromise = null;
  window.location.assign("/login.html");
}

async function updateProfile(payload) {
  const supabase = await loadSupabaseClient();
  const { data: sessionData } = await supabase.auth.getUser();
  if (!sessionData.user) throw new Error("No autenticado.");
  const parsed = parsePersonName(payload.name);
  const { data, error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.fullName,
      first_name: parsed.firstName,
      middle_names: parsed.middleNames,
      first_last_name: parsed.firstLastName,
      second_last_name: parsed.secondLastName,
      display_name: parsed.displayName,
      company: String(payload.company || "").trim(),
      title: String(payload.title || "").trim(),
      updated_at: new Date().toISOString()
    })
    .eq("id", sessionData.user.id)
    .select("*")
    .single();
  if (error) throw error;
  currentPageUser = publicProfile(data, sessionData.user);
  return currentPageUser;
}

const ACCOUNT_EMAIL_COLUMNS = "id, email, is_primary, is_confirmed, created_at, confirmed_at";

function normalizeAccountEmailRow(row) {
  return {
    id: row.id,
    email: row.email || "",
    primary: Boolean(row.is_primary),
    confirmed: Boolean(row.is_confirmed),
    createdAt: row.created_at || "",
    confirmedAt: row.confirmed_at || ""
  };
}

function generateConfirmationCode() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function ensurePrimaryAccountEmail(supabase, authUser) {
  const email = String(authUser?.email || "").trim().toLowerCase();
  if (!authUser?.id || !email) return;
  const { data } = await supabase
    .from("account_emails")
    .select("id")
    .eq("user_id", authUser.id)
    .eq("email", email)
    .maybeSingle();
  if (data?.id) return;
  await supabase
    .from("account_emails")
    .insert({
      user_id: authUser.id,
      email,
      is_primary: true,
      is_confirmed: true,
      confirmed_at: new Date().toISOString()
    });
}

async function listAccountEmails() {
  const supabase = await loadSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("No autenticado.");
  await ensurePrimaryAccountEmail(supabase, userData.user);
  const { data, error } = await supabase
    .from("account_emails")
    .select(ACCOUNT_EMAIL_COLUMNS)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).map(normalizeAccountEmailRow);
}

async function addAccountEmail(payload) {
  const email = String(payload?.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Escribe un correo valido.");
  const supabase = await loadSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("No autenticado.");
  await ensurePrimaryAccountEmail(supabase, userData.user);
  const confirmationToken = generateConfirmationCode();
  const { error } = await supabase
    .from("account_emails")
    .insert({
      user_id: userData.user.id,
      email,
      is_primary: false,
      is_confirmed: false,
      confirmation_token: confirmationToken
    });
  if (error) throw error;
  return { ok: true, emails: await listAccountEmails() };
}

async function confirmAccountEmail(payload) {
  const email = String(payload?.email || "").trim().toLowerCase();
  const token = String(payload?.token || "").trim();
  if (!email || !token) throw new Error("Escribe el correo y el codigo de confirmacion.");
  const supabase = await loadSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("No autenticado.");
  const { error } = await supabase.rpc("confirm_account_email", { target_email: email, token });
  if (error) throw error;
  return { ok: true, emails: await listAccountEmails() };
}

async function makePrimaryAccountEmail(emailId) {
  const supabase = await loadSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("No autenticado.");
  const { data: target, error: targetError } = await supabase
    .from("account_emails")
    .select(ACCOUNT_EMAIL_COLUMNS)
    .eq("id", emailId)
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (targetError) throw targetError;
  if (!target) throw new Error("Correo no encontrado.");
  if (!target.is_confirmed) throw new Error("Confirma el correo antes de hacerlo principal.");

  const { error: authError } = await supabase.auth.updateUser({ email: target.email }, {
    emailRedirectTo: `${location.origin}/auth-callback.html`
  });
  if (authError) throw authError;

  const { error } = await supabase.rpc("set_primary_account_email", { target_email_id: emailId });
  if (error) throw error;
  if (currentPageUser) currentPageUser = { ...currentPageUser, email: target.email };
  return { ok: true, user: currentPageUser, emails: await listAccountEmails(), pendingAuthConfirmation: true };
}

async function deleteAccountEmail(emailId) {
  const supabase = await loadSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("No autenticado.");
  const { data: target, error: targetError } = await supabase
    .from("account_emails")
    .select("id, is_primary")
    .eq("id", emailId)
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (targetError) throw targetError;
  if (!target) throw new Error("Correo no encontrado.");
  if (target.is_primary) throw new Error("No puedes eliminar el correo principal.");
  const { error } = await supabase.rpc("delete_account_email", { target_email_id: emailId });
  if (error) throw error;
  return { ok: true, emails: await listAccountEmails() };
}

async function bccApi(path, options = {}) {
  const supabase = await loadSupabaseClient();

  if (path === "/api/auth/me") {
    return { ok: true, user: await currentUser() };
  }

  if (path === "/api/auth/logout") {
    await supabase.auth.signOut();
    currentPageUser = null;
    currentUserPromise = null;
    return { ok: true };
  }

  if (path === "/api/auth/profile" && options.method === "PATCH") {
    const body = JSON.parse(options.body || "{}");
    return { ok: true, user: await updateProfile(body) };
  }

  if (path === "/api/account/emails" && (!options.method || options.method === "GET")) {
    return { ok: true, emails: await listAccountEmails() };
  }

  if (path === "/api/account/emails" && options.method === "POST") {
    return addAccountEmail(JSON.parse(options.body || "{}"));
  }

  if (path === "/api/account/emails/confirm" && options.method === "POST") {
    return confirmAccountEmail(JSON.parse(options.body || "{}"));
  }

  const primaryEmailMatch = path.match(/^\/api\/account\/emails\/([^/]+)\/primary$/);
  if (primaryEmailMatch && options.method === "PATCH") {
    return makePrimaryAccountEmail(decodeURIComponent(primaryEmailMatch[1]));
  }

  const deleteEmailMatch = path.match(/^\/api\/account\/emails\/([^/]+)$/);
  if (deleteEmailMatch && options.method === "DELETE") {
    return deleteAccountEmail(decodeURIComponent(deleteEmailMatch[1]));
  }

  if (path.startsWith("/api/workspace/")) {
    const workspaceApi = window.BCCAuthWorkspaceApi?.createWorkspaceApi?.({
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
      columns: {
        tasks: WORKSPACE_TASK_COLUMNS,
        events: WORKSPACE_EVENT_COLUMNS,
        forms: WORKSPACE_FORM_COLUMNS,
        responses: WORKSPACE_RESPONSE_COLUMNS
      }
    });
    const workspaceResult = await workspaceApi?.handle(path, options);
    if (workspaceResult?.handled) return workspaceResult.value;
  }

  if (path.startsWith("/api/admin/prospect")) {
    const prospectsApi = window.BCCAuthProspectsApi?.createProspectsApi?.({
      supabase,
      authorizedUser,
      canManageSignalWorkspace,
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
      columns: {
        prospectBase: WORKSPACE_PROSPECT_BASE_COLUMNS,
        prospects: WORKSPACE_PROSPECT_COLUMNS,
        templates: WORKSPACE_PROSPECT_TEMPLATE_COLUMNS,
        emails: WORKSPACE_PROSPECT_EMAIL_COLUMNS,
        activities: WORKSPACE_PROSPECT_ACTIVITY_COLUMNS
      }
    });
    const prospectsResult = await prospectsApi?.handle(path, options);
    if (prospectsResult?.handled) return prospectsResult.value;
  }

  if (path.startsWith("/api/admin/users") || path.startsWith("/api/admin/roles") || path === "/api/admin/access-audit") {
    const adminAccessApi = window.BCCAuthAdminAccessApi?.createAdminAccessApi?.({
      supabase,
      authorizedUser,
      loadWorkspaceRoleDefinitions,
      publicProfile,
      publicWorkspaceRoleDefinition,
      builtInRoleDefinitions,
      permissionCatalog,
      sanitizeWorkspaceRoleInput,
      normalizeAccessPayload,
      normalizeCustomRoleList
    });
    const adminAccessResult = await adminAccessApi?.handle(path, options);
    if (adminAccessResult?.handled) return adminAccessResult.value;
  }

  if (path.startsWith("/api/admin/dominican") || path.startsWith("/api/admin/dominican%20intelligence")) {
    const dominicanIntelligenceApi = window.BCCAuthDominicanIntelligenceApi?.createDominicanIntelligenceApi?.({
      supabase,
      authorizedUser,
      canManageSignalWorkspace
    });
    const dominicanIntelligenceResult = await dominicanIntelligenceApi?.handle(path, options);
    if (dominicanIntelligenceResult?.handled) return dominicanIntelligenceResult.value;
  }

  const intelligenceRequestUrl = path.startsWith("/api/admin/intelligence")
    ? new URL(path, window.location.origin)
    : null;
  const intelligencePath = intelligenceRequestUrl?.pathname || "";

  if (intelligencePath === "/api/admin/intelligence/overview" && (!options.method || options.method === "GET")) {
    await requireAdminViewUser();
    const dashboard = await loadIntelligenceDashboardData(supabase);
    return { ok: true, overview: dashboard.overview };
  }

  if (intelligencePath === "/api/admin/intelligence/dashboard" && (!options.method || options.method === "GET")) {
    await requireAdminViewUser();
    return { ok: true, dashboard: await loadIntelligenceDashboardData(supabase) };
  }

  if (intelligencePath === "/api/admin/intelligence/signals" && (!options.method || options.method === "GET")) {
    await requireAdminViewUser();
    const limit = normalizeIntelligenceLimit(intelligenceRequestUrl.searchParams.get("limit"), 200, 500);
    const status = normalizeIntelligenceEnumQuery(intelligenceRequestUrl.searchParams.get("status"), INTELLIGENCE_SIGNAL_STATUSES, "Estado de señal");
    const signalType = normalizeIntelligenceEnumQuery(intelligenceRequestUrl.searchParams.get("signalType"), INTELLIGENCE_SIGNAL_TYPES, "Tipo de señal");
    const relatedLine = normalizeIntelligenceLine(intelligenceRequestUrl.searchParams.get("relatedLine"));
    let query = supabase
      .from("intelligence_signals")
      .select(INTELLIGENCE_SIGNAL_COLUMNS)
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (status) query = query.eq("status", status);
    if (signalType) query = query.eq("signal_type", signalType);
    if (relatedLine) query = query.eq("related_line", relatedLine);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, signals: (data || []).map(publicIntelligenceSignal) };
  }

  const intelligenceSignalMatch = intelligencePath.match(/^\/api\/admin\/intelligence\/signals\/([^/]+)$/);
  if (intelligenceSignalMatch && (!options.method || options.method === "GET")) {
    await requireAdminViewUser();
    const { data, error } = await supabase
      .from("intelligence_signals")
      .select(INTELLIGENCE_SIGNAL_COLUMNS)
      .eq("id", decodeURIComponent(intelligenceSignalMatch[1]))
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Señal no encontrada.");
    return { ok: true, signal: publicIntelligenceSignal(data) };
  }

  if (intelligenceSignalMatch && options.method === "PATCH") {
    await requireAdminViewUser();
    const body = normalizeIntelligenceSignalInput(JSON.parse(options.body || "{}"));
    const { data, error } = await supabase
      .from("intelligence_signals")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("id", decodeURIComponent(intelligenceSignalMatch[1]))
      .select(INTELLIGENCE_SIGNAL_COLUMNS)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Señal no encontrada.");
    return { ok: true, signal: publicIntelligenceSignal(data) };
  }

  if (intelligencePath === "/api/admin/intelligence/papers" && (!options.method || options.method === "GET")) {
    await requireAdminViewUser();
    const limit = normalizeIntelligenceLimit(intelligenceRequestUrl.searchParams.get("limit"), 200, 500);
    const topic = normalizeIntelligenceTextQuery(intelligenceRequestUrl.searchParams.get("topic"), 160, "Topic");
    const source = normalizeIntelligenceTextQuery(intelligenceRequestUrl.searchParams.get("source"), 120, "Source");
    const dateFrom = normalizeIntelligenceDateQuery(intelligenceRequestUrl.searchParams.get("dateFrom"), "Fecha desde");
    const dateTo = normalizeIntelligenceDateQuery(intelligenceRequestUrl.searchParams.get("dateTo"), "Fecha hasta");
    const keyword = normalizeIntelligenceTextQuery(intelligenceRequestUrl.searchParams.get("keyword"), 200, "Keyword");
    let query = supabase
      .from("intelligence_papers")
      .select(INTELLIGENCE_PAPER_COLUMNS)
      .order("publication_date", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (topic) query = query.contains("topics", [topic]);
    if (source) query = query.eq("source_name", source);
    if (dateFrom) query = query.gte("publication_date", dateFrom);
    if (dateTo) query = query.lte("publication_date", dateTo);
    if (keyword) query = query.ilike("title", `%${keyword}%`);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, papers: (data || []).map(publicIntelligencePaper) };
  }

  if (intelligencePath === "/api/admin/intelligence/grants" && (!options.method || options.method === "GET")) {
    await requireAdminViewUser();
    const limit = normalizeIntelligenceLimit(intelligenceRequestUrl.searchParams.get("limit"), 200, 500);
    const topic = normalizeIntelligenceTextQuery(intelligenceRequestUrl.searchParams.get("topic"), 160, "Topic");
    const dateFrom = normalizeIntelligenceDateQuery(intelligenceRequestUrl.searchParams.get("dateFrom"), "Fecha desde");
    const dateTo = normalizeIntelligenceDateQuery(intelligenceRequestUrl.searchParams.get("dateTo"), "Fecha hasta");
    const keyword = normalizeIntelligenceTextQuery(intelligenceRequestUrl.searchParams.get("keyword"), 200, "Keyword");
    let query = supabase
      .from("intelligence_grants")
      .select(INTELLIGENCE_GRANT_COLUMNS)
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (topic) query = query.contains("topics", [topic]);
    if (dateFrom) query = query.gte("start_date", dateFrom);
    if (dateTo) query = query.lte("end_date", dateTo);
    if (keyword) query = query.ilike("title", `%${keyword}%`);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, grants: (data || []).map(publicIntelligenceGrant) };
  }

  if (intelligencePath === "/api/admin/intelligence/patents" && (!options.method || options.method === "GET")) {
    await requireAdminViewUser();
    const limit = normalizeIntelligenceLimit(intelligenceRequestUrl.searchParams.get("limit"), 200, 500);
    const topic = normalizeIntelligenceTextQuery(intelligenceRequestUrl.searchParams.get("topic"), 160, "Topic");
    const dateFrom = normalizeIntelligenceDateQuery(intelligenceRequestUrl.searchParams.get("dateFrom"), "Fecha desde");
    const dateTo = normalizeIntelligenceDateQuery(intelligenceRequestUrl.searchParams.get("dateTo"), "Fecha hasta");
    const keyword = normalizeIntelligenceTextQuery(intelligenceRequestUrl.searchParams.get("keyword"), 200, "Keyword");
    let query = supabase
      .from("intelligence_patents")
      .select(INTELLIGENCE_PATENT_COLUMNS)
      .order("publication_date", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (topic) query = query.contains("topics", [topic]);
    if (dateFrom) query = query.gte("publication_date", dateFrom);
    if (dateTo) query = query.lte("publication_date", dateTo);
    if (keyword) query = query.ilike("title", `%${keyword}%`);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, patents: (data || []).map(publicIntelligencePatent) };
  }

  if (intelligencePath === "/api/admin/intelligence/trials" && (!options.method || options.method === "GET")) {
    await requireAdminViewUser();
    const limit = normalizeIntelligenceLimit(intelligenceRequestUrl.searchParams.get("limit"), 200, 500);
    const topic = normalizeIntelligenceTextQuery(intelligenceRequestUrl.searchParams.get("topic"), 160, "Topic");
    const dateFrom = normalizeIntelligenceDateQuery(intelligenceRequestUrl.searchParams.get("dateFrom"), "Fecha desde");
    const dateTo = normalizeIntelligenceDateQuery(intelligenceRequestUrl.searchParams.get("dateTo"), "Fecha hasta");
    const keyword = normalizeIntelligenceTextQuery(intelligenceRequestUrl.searchParams.get("keyword"), 200, "Keyword");
    let query = supabase
      .from("intelligence_trials")
      .select(INTELLIGENCE_TRIAL_COLUMNS)
      .order("start_date", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (topic) query = query.contains("topics", [topic]);
    if (dateFrom) query = query.gte("start_date", dateFrom);
    if (dateTo) query = query.lte("completion_date", dateTo);
    if (keyword) query = query.ilike("title", `%${keyword}%`);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, trials: (data || []).map(publicIntelligenceTrial) };
  }

  if (intelligencePath === "/api/admin/intelligence/institutions" && (!options.method || options.method === "GET")) {
    await requireAdminViewUser();
    const limit = normalizeIntelligenceLimit(intelligenceRequestUrl.searchParams.get("limit"), 200, 500);
    const topic = normalizeIntelligenceTextQuery(intelligenceRequestUrl.searchParams.get("topic"), 160, "Topic");
    const type = normalizeIntelligenceTextQuery(intelligenceRequestUrl.searchParams.get("type"), 80, "Tipo");
    const country = normalizeIntelligenceTextQuery(intelligenceRequestUrl.searchParams.get("country"), 120, "Pais");
    const keyword = normalizeIntelligenceTextQuery(intelligenceRequestUrl.searchParams.get("keyword"), 200, "Keyword");
    let query = supabase
      .from("intelligence_institutions")
      .select(INTELLIGENCE_INSTITUTION_COLUMNS)
      .order("related_papers_count", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (topic) query = query.contains("topics", [topic]);
    if (type) query = query.eq("type", type);
    if (country) query = query.eq("country", country);
    if (keyword) query = query.ilike("name", `%${keyword}%`);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, institutions: (data || []).map(publicIntelligenceInstitution) };
  }

  if (intelligencePath === "/api/admin/intelligence/topics" && (!options.method || options.method === "GET")) {
    await requireAdminViewUser();
    const limit = normalizeIntelligenceLimit(intelligenceRequestUrl.searchParams.get("limit"), 100, 500);
    const category = normalizeIntelligenceEnumQuery(intelligenceRequestUrl.searchParams.get("category"), INTELLIGENCE_TOPIC_CATEGORIES, "Categoria de topic");
    const enabled = normalizeIntelligenceBooleanQuery(intelligenceRequestUrl.searchParams.get("enabled"));
    let query = supabase
      .from("intelligence_topics")
      .select(INTELLIGENCE_TOPIC_COLUMNS)
      .order("enabled", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (category) query = query.eq("category", category);
    if (enabled !== null) query = query.eq("enabled", enabled);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, topics: (data || []).map(publicIntelligenceTopic) };
  }

  if (intelligencePath === "/api/admin/intelligence/topics" && options.method === "POST") {
    await requireAdminViewUser();
    const body = normalizeIntelligenceTopicInput(JSON.parse(options.body || "{}"), true);
    const { data, error } = await supabase
      .from("intelligence_topics")
      .insert(body)
      .select(INTELLIGENCE_TOPIC_COLUMNS)
      .single();
    if (error) throw error;
    return { ok: true, topic: publicIntelligenceTopic(data) };
  }

  const intelligenceTopicMatch = intelligencePath.match(/^\/api\/admin\/intelligence\/topics\/([^/]+)$/);
  if (intelligenceTopicMatch && options.method === "PATCH") {
    await requireAdminViewUser();
    const body = normalizeIntelligenceTopicInput(JSON.parse(options.body || "{}"));
    const { data, error } = await supabase
      .from("intelligence_topics")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("id", decodeURIComponent(intelligenceTopicMatch[1]))
      .select(INTELLIGENCE_TOPIC_COLUMNS)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Topic no encontrado.");
    return { ok: true, topic: publicIntelligenceTopic(data) };
  }

  if (intelligenceTopicMatch && options.method === "DELETE") {
    await requireAdminViewUser();
    const { data, error } = await supabase
      .from("intelligence_topics")
      .delete()
      .eq("id", decodeURIComponent(intelligenceTopicMatch[1]))
      .select(INTELLIGENCE_TOPIC_COLUMNS)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Topic no encontrado.");
    return { ok: true, topic: publicIntelligenceTopic(data) };
  }

  if (intelligencePath === "/api/admin/intelligence/sources" && (!options.method || options.method === "GET")) {
    await requireAdminViewUser();
    const limit = normalizeIntelligenceLimit(intelligenceRequestUrl.searchParams.get("limit"), 50, 200);
    const type = normalizeIntelligenceEnumQuery(intelligenceRequestUrl.searchParams.get("type"), INTELLIGENCE_SOURCE_TYPES, "Tipo de fuente");
    const enabled = normalizeIntelligenceBooleanQuery(intelligenceRequestUrl.searchParams.get("enabled"));
    let query = supabase
      .from("intelligence_sources")
      .select(INTELLIGENCE_SOURCE_COLUMNS)
      .order("enabled", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (type) query = query.eq("type", type);
    if (enabled !== null) query = query.eq("enabled", enabled);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, sources: (data || []).map(publicIntelligenceSource) };
  }

  const intelligenceSourceMatch = intelligencePath.match(/^\/api\/admin\/intelligence\/sources\/([^/]+)$/);
  if (intelligenceSourceMatch && options.method === "PATCH") {
    await requireAdminViewUser();
    const body = normalizeIntelligenceSourceInput(JSON.parse(options.body || "{}"));
    const { data, error } = await supabase
      .from("intelligence_sources")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("id", decodeURIComponent(intelligenceSourceMatch[1]))
      .select(INTELLIGENCE_SOURCE_COLUMNS)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Fuente no encontrada.");
    return { ok: true, source: publicIntelligenceSource(data) };
  }

  if (intelligencePath === "/api/admin/intelligence/sync" && options.method === "POST") {
    await requireAdminViewUser();
    const supabaseClient = await loadSupabaseClient();
    const body = JSON.parse(options.body || "{}");
    const action = normalizeIntelligenceEnumQuery(body.action || "sync_papers", INTELLIGENCE_RUN_ACTIONS, "Accion de intelligence");
    const payload = {
      action: action || "sync_papers",
      dryRun: Boolean(body.dryRun),
      reason: normalizeIntelligenceTextQuery(body.reason || "Manual intelligence sync from dashboard", 180, "Motivo"),
      sourceTypes: Array.isArray(body.sourceTypes)
        ? body.sourceTypes.map(item => normalizeIntelligenceEnumQuery(item, INTELLIGENCE_SOURCE_TYPES, "Tipo de fuente")).filter(Boolean).slice(0, 8)
        : [],
      queryText: normalizeIntelligenceTextQuery(body.queryText || "", 400, "Query de sync"),
      keywords: Array.isArray(body.keywords)
        ? body.keywords.map(item => normalizeIntelligenceTextQuery(item, 120, "Keyword")).filter(Boolean).slice(0, 24)
        : [],
      limit: normalizeIntelligenceLimit(body.limit, 20, 100)
    };
    const { data, error } = await supabaseClient.functions.invoke("run-intelligence-sync", {
      body: payload
    });
    if (error) throw await supabaseFunctionError(error, "No fue posible disparar la sincronizacion.");
    if (!data?.ok) throw new Error(data?.error || "No fue posible disparar la sincronizacion.");
    return data;
  }

  if (intelligencePath === "/api/admin/intelligence/runs" && (!options.method || options.method === "GET")) {
    await requireAdminViewUser();
    const limit = normalizeIntelligenceLimit(intelligenceRequestUrl.searchParams.get("limit"), 50, 200);
    const status = normalizeIntelligenceEnumQuery(intelligenceRequestUrl.searchParams.get("status"), INTELLIGENCE_RUN_STATUSES, "Estado de run");
    const actionType = normalizeIntelligenceEnumQuery(intelligenceRequestUrl.searchParams.get("actionType"), INTELLIGENCE_RUN_ACTIONS, "Accion de run");
    const dryRun = normalizeIntelligenceBooleanQuery(intelligenceRequestUrl.searchParams.get("dryRun"));
    let query = supabase
      .from("intelligence_runs")
      .select(INTELLIGENCE_RUN_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (status) query = query.eq("status", status);
    if (actionType) query = query.eq("action_type", actionType);
    if (dryRun !== null) query = query.eq("dry_run", dryRun);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, runs: (data || []).map(publicIntelligenceRun) };
  }

  if (intelligencePath === "/api/admin/intelligence/settings" && options.method === "PATCH") {
    await requireAdminViewUser();
    const body = normalizeIntelligenceSettingsInput(JSON.parse(options.body || "{}"));
    const { data: existingRows, error: existingError } = await supabase
      .from("intelligence_settings")
      .select(INTELLIGENCE_SETTINGS_COLUMNS)
      .order("updated_at", { ascending: false })
      .limit(1);
    if (existingError) throw existingError;
    const existing = Array.isArray(existingRows) ? existingRows[0] : null;
    if (existing?.id) {
      const { data, error } = await supabase
        .from("intelligence_settings")
        .update({ ...body, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select(INTELLIGENCE_SETTINGS_COLUMNS)
        .single();
      if (error) throw error;
      return { ok: true, settings: publicIntelligenceSettings(data) };
    }
    const { data, error } = await supabase
      .from("intelligence_settings")
      .insert(body)
      .select(INTELLIGENCE_SETTINGS_COLUMNS)
      .single();
    if (error) throw error;
    return { ok: true, settings: publicIntelligenceSettings(data) };
  }

  if (path.startsWith("/api/admin/analytics/overview")) {
    const me = await authorizedUser();
    if (!canManageSignalWorkspace(me)) throw new Error("Permiso insuficiente.");
    const requestUrl = new URL(path, window.location.origin);
    const days = normalizeAnalyticsRange(requestUrl.searchParams.get("days"));
    const { data, error } = await supabase.rpc("get_admin_analytics_dashboard", { range_days: days });
    if (error) throw error;
    return { ok: true, dashboard: normalizeAnalyticsDashboard(data, days) };
  }

  throw new Error(`Endpoint no migrado a Supabase: ${path}`);
}

async function loadWorkspaceTaskCollaborators(supabase) {
  const { data, error } = await supabase.rpc("get_workspace_task_collaborators");
  if (error) throw error;
  return (Array.isArray(data) ? data : []).map(item => ({
    id: String(item.id || ""),
    name: String(item.name || item.display_name || item.email || "Cuenta"),
    email: String(item.email || ""),
    role: String(item.role || "staff"),
    hierarchyLevel: normalizeHierarchyLevel(item.hierarchy_level ?? item.hierarchyLevel),
    relation: item.relation === "assign" ? "assign" : "suggest"
  })).filter(item => item.id);
}

function resolveWorkspaceTaskAssignment(raw = {}, me = {}, collaborators = []) {
  const assigneeId = String(raw.assigneeId || raw.assignee_id || me.id || "").trim();
  if (!assigneeId || assigneeId === me.id) {
    return {
      user_id: me.id,
      assignee_id: me.id,
      created_by: me.id,
      assignment_mode: "self",
      assignment_status: "accepted"
    };
  }
  const collaborator = collaborators.find(item => item.id === assigneeId);
  if (!collaborator) throw new Error("No puedes asignar o sugerir tareas a esta cuenta.");
  const mode = collaborator.relation === "assign" ? "assigned" : "suggested";
  return {
    user_id: collaborator.id,
    assignee_id: collaborator.id,
    created_by: me.id,
    assignment_mode: mode,
    assignment_status: mode === "assigned" ? "accepted" : "pending"
  };
}

async function loadWorkspaceRoleDefinitions(supabase) {
  const { data, error } = await supabase
    .from("workspace_role_definitions")
    .select("id, key, name, description, hierarchy_level, permissions, created_at, updated_at")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).map(publicWorkspaceRoleDefinition);
}

function normalizeAccessPayload(value) {
  const payload = value && typeof value === "object" ? value : {};
  return {
    role: payload.role || "client",
    staffRoles: normalizeList(payload.staffRoles, STAFF_ROLES),
    departments: normalizeList(payload.departments, DEPARTMENTS),
    customRoles: Array.isArray(payload.customRoles) ? payload.customRoles.map(String) : []
  };
}

function normalizeAnalyticsRange(value) {
  const parsed = Number.parseInt(String(value || "30"), 10);
  if (!Number.isFinite(parsed)) return 30;
  return Math.max(1, Math.min(parsed, 365));
}

function normalizeAnalyticsDashboard(value, fallbackDays = 30) {
  const payload = value && typeof value === "object" ? value : {};
  const totals = payload.totals && typeof payload.totals === "object" ? payload.totals : {};
  const normalizeListItems = list => Array.isArray(list) ? list : [];
  const normalizeDomainBlock = (block, config = {}) => {
    const source = block && typeof block === "object" ? block : {};
    const sourceTotals = source.totals && typeof source.totals === "object" ? source.totals : {};
    const totalsOut = {};
    (config.totalKeys || []).forEach(key => {
      totalsOut[key] = Number(sourceTotals[key] || 0);
    });
    const listsOut = {};
    Object.entries(config.listKeys || {}).forEach(([key, itemShape]) => {
      listsOut[key] = normalizeListItems(source[key]).map(item => itemShape(item));
    });
    return { totals: totalsOut, ...listsOut };
  };
  return {
    rangeDays: normalizeAnalyticsRange(payload.rangeDays || fallbackDays),
    totals: {
      pageViews: Number(totals.pageViews || 0),
      uniqueVisitors: Number(totals.uniqueVisitors || 0),
      engagedVisits: Number(totals.engagedVisits || 0),
      contactSubmits: Number(totals.contactSubmits || 0),
      quoteSignals: Number(totals.quoteSignals || 0),
      ctaClicks: Number(totals.ctaClicks || 0)
    },
    daily: normalizeListItems(payload.daily).map(item => ({
      day: String(item?.day || ""),
      pageViews: Number(item?.pageViews || 0),
      keyActions: Number(item?.keyActions || 0)
    })),
    topPages: normalizeListItems(payload.topPages).map(item => ({
      pagePath: String(item?.pagePath || ""),
      pageTitle: String(item?.pageTitle || ""),
      views: Number(item?.views || 0)
    })),
    topEvents: normalizeListItems(payload.topEvents).map(item => ({
      eventName: String(item?.eventName || ""),
      total: Number(item?.total || 0)
    })),
    topCtas: normalizeListItems(payload.topCtas).map(item => ({
      label: String(item?.label || ""),
      targetPath: String(item?.targetPath || ""),
      total: Number(item?.total || 0)
    })),
    domainBreakdowns: {
      products: normalizeDomainBlock(payload.domainBreakdowns?.products, {
        totalKeys: ["filterApplies", "compareAdds", "detailOpens", "ctaClicks"],
        listKeys: {
          topProducts: item => ({
            label: String(item?.label || ""),
            total: Number(item?.total || 0)
          }),
          topEvents: item => ({
            eventName: String(item?.eventName || ""),
            total: Number(item?.total || 0)
          })
        }
      }),
      blog: normalizeDomainBlock(payload.domainBreakdowns?.blog, {
        totalKeys: ["searches", "tagFilters", "postOpens"],
        listKeys: {
          topPosts: item => ({
            label: String(item?.label || ""),
            total: Number(item?.total || 0)
          }),
          topSearches: item => ({
            label: String(item?.label || ""),
            total: Number(item?.total || 0)
          })
        }
      }),
      science: normalizeDomainBlock(payload.domainBreakdowns?.science, {
        totalKeys: ["arxivFilters", "paperOpens", "deckOpens", "templateApplies"],
        listKeys: {
          topActions: item => ({
            label: String(item?.label || ""),
            total: Number(item?.total || 0)
          }),
          topEvents: item => ({
            eventName: String(item?.eventName || ""),
            total: Number(item?.total || 0)
          })
        }
      })
    },
    recentSignals: normalizeListItems(payload.recentSignals).map(item => ({
      eventName: String(item?.eventName || ""),
      pagePath: String(item?.pagePath || ""),
      createdAt: String(item?.createdAt || ""),
      label: String(item?.label || "")
    })),
    internalActivity: {
      totals: {
        events: Number(payload.internalActivity?.totals?.events || 0),
        activeUsers: Number(payload.internalActivity?.totals?.activeUsers || 0),
        adminEvents: Number(payload.internalActivity?.totals?.adminEvents || 0),
        staffEvents: Number(payload.internalActivity?.totals?.staffEvents || 0)
      },
      topPages: normalizeListItems(payload.internalActivity?.topPages).map(item => ({
        pagePath: String(item?.pagePath || ""),
        pageTitle: String(item?.pageTitle || ""),
        views: Number(item?.views || 0)
      })),
      topEvents: normalizeListItems(payload.internalActivity?.topEvents).map(item => ({
        eventName: String(item?.eventName || ""),
        total: Number(item?.total || 0)
      })),
      recentActivity: normalizeListItems(payload.internalActivity?.recentActivity).map(item => ({
        eventName: String(item?.eventName || ""),
        actorRole: String(item?.actorRole || ""),
        pagePath: String(item?.pagePath || ""),
        pageTitle: String(item?.pageTitle || ""),
        createdAt: String(item?.createdAt || ""),
        label: String(item?.label || "")
      }))
    }
  };
}

const WORKSPACE_TASK_COLUMNS = "id, user_id, created_by, assignee_id, assignment_mode, assignment_status, assignment_note, responded_at, title, description, status, priority, importance, urgency, due_date, completed_at, created_at, updated_at";
const WORKSPACE_TASK_STATUSES = ["backlog", "in_progress", "done"];
const WORKSPACE_TASK_PRIORITIES = ["low", "medium", "high"];
const WORKSPACE_TASK_ASSIGNMENT_MODES = ["self", "assigned", "suggested"];
const WORKSPACE_TASK_ASSIGNMENT_STATUSES = ["accepted", "pending", "rejected"];
const WORKSPACE_EVENT_COLUMNS = "id, title, type, event_date, start_time, end_time, description, location, link, visibility, related_task_id, created_at, updated_at";
const WORKSPACE_EVENT_TYPES = ["meeting", "call", "milestone", "blocker", "reminder", "availability", "review"];
const WORKSPACE_EVENT_VISIBILITIES = ["private", "team", "client"];
const WORKSPACE_FORM_COLUMNS = "id, title, purpose, audience, questions, status, created_at, updated_at";
const WORKSPACE_RESPONSE_COLUMNS = "id, form_id, respondent_id, answers, submitted_at";
const WORKSPACE_FORM_AUDIENCES = ["client", "staff"];
const WORKSPACE_FORM_STATUSES = ["draft", "published"];
const WORKSPACE_QUESTION_TYPES = ["short_text", "long_text", "scale", "choice"];
const WORKSPACE_PROSPECT_BASE_COLUMNS = "id, full_name, company, email, phone, phase, tags, source, notes, value_estimate, next_follow_up_on, last_contact_at, created_at, updated_at";
const WORKSPACE_PROSPECT_COLUMNS = "id, full_name, company, email, phone, phase, tags, source, notes, value_estimate, next_follow_up_on, last_contact_at, owner_label, assignment_status, assignment_note, created_at, updated_at";
const WORKSPACE_PROSPECT_TEMPLATE_COLUMNS = "id, name, category, tags, subject, body, is_active, created_at, updated_at";
const WORKSPACE_PROSPECT_EMAIL_COLUMNS = "id, prospect_id, template_id, recipient_email, subject, body, attachments, status, scheduled_for, sent_at, provider_message_id, created_at, updated_at";
const WORKSPACE_PROSPECT_ACTIVITY_COLUMNS = "id, prospect_id, activity_type, title, details, due_at, occurred_at, meta, created_at, updated_at";
const WORKSPACE_PROSPECT_PHASES = ["lead", "qualified", "contacted", "proposal", "negotiation", "won", "lost"];
const WORKSPACE_PROSPECT_EMAIL_STATUSES = ["draft", "scheduled", "sent", "archived"];
const WORKSPACE_PROSPECT_ACTIVITY_TYPES = ["note", "call", "meeting", "email", "follow_up"];
const WORKSPACE_PROSPECT_ASSIGNMENT_STATUSES = ["unassigned", "assigned", "accepted", "declined", "needs_reassignment"];
const INTELLIGENCE_TOPIC_CATEGORIES = ["nano", "bio", "med", "ing", "general"];
const INTELLIGENCE_SOURCE_TYPES = ["arxiv", "openalex", "crossref", "semantic_scholar", "pubmed", "nih_reporter", "nsf", "clinicaltrials", "epo_ops", "cordis", "uspto", "custom"];
const INTELLIGENCE_SIGNAL_TYPES = ["product_opportunity", "market_trend", "research_trend", "partnership", "content_idea", "competitive_risk", "grant_opportunity"];
const INTELLIGENCE_SIGNAL_STATUSES = ["new", "reviewing", "accepted", "rejected", "archived"];
const INTELLIGENCE_RUN_ACTIONS = ["sync_papers", "fetch_papers", "fetch_grants", "fetch_patents", "fetch_trials", "generate_signals"];
const INTELLIGENCE_RUN_STATUSES = ["pending", "running", "completed", "failed"];
const INTELLIGENCE_SETTINGS_FREQUENCIES = ["daily", "weekly", "biweekly", "monthly"];
const INTELLIGENCE_SOURCE_COLUMNS = "id, name, type, base_url, enabled, requires_api_key, rate_limit_notes, last_sync_at, created_at, updated_at";
const INTELLIGENCE_PAPER_COLUMNS = "id, external_id, doi, arxiv_id, normalized_title, title, abstract, authors, institutions, publication_date, source_name, source_url, journal_or_venue, topics, keywords, citations_count, open_access_url, possible_duplicate, duplicate_candidates, raw_data, created_at, updated_at";
const INTELLIGENCE_GRANT_COLUMNS = "id, external_id, title, abstract, agency, program, amount, currency, start_date, end_date, principal_investigators, institutions, country, source_url, topics, raw_data, created_at, updated_at";
const INTELLIGENCE_PATENT_COLUMNS = "id, external_id, title, abstract, inventors, assignees, publication_date, filing_date, jurisdiction, status, source_url, topics, raw_data, created_at, updated_at";
const INTELLIGENCE_TRIAL_COLUMNS = "id, external_id, title, summary, conditions, interventions, phase, status, study_type, sponsor, collaborators, start_date, completion_date, locations, countries, source_url, topics, keywords, raw_data, created_at, updated_at";
const INTELLIGENCE_INSTITUTION_COLUMNS = "id, name, ror_id, country, city, type, website, source_url, related_papers_count, related_grants_count, related_patents_count, topics, created_at, updated_at";
const INTELLIGENCE_TOPIC_COLUMNS = "id, name, description, category, keywords, enabled, created_at, updated_at";
const INTELLIGENCE_SIGNAL_COLUMNS = "id, title, summary, signal_type, related_line, confidence_score, opportunity_score, actionability_score, evidence_count, evidence_refs, score_breakdown, recommended_action, status, created_at, updated_at";
const INTELLIGENCE_RUN_COLUMNS = "id, status, action_type, dry_run, started_at, finished_at, sources_used, items_fetched, items_created, items_updated, signals_generated, error_message, created_at, updated_at";
const INTELLIGENCE_SETTINGS_COLUMNS = "id, max_results_per_source, default_date_range_days, suggested_frequency, default_dry_run, scoring_thresholds, monitored_lines, created_at, updated_at";

function normalizeWorkspaceTagList(value, maxItems = 12) {
  const source = Array.isArray(value)
    ? value
    : String(value || "").split(",");
  return [...new Set(source.map(item => String(item || "").trim()).filter(Boolean))].slice(0, maxItems);
}

function normalizeWorkspaceAttachments(value) {
  const source = Array.isArray(value)
    ? value
    : [];
  return source.map(item => {
    const payload = item && typeof item === "object" ? item : {};
    const path = String(payload.path || "").trim();
    const filename = String(payload.filename || "").trim();
    if (!path || !/^https?:\/\//i.test(path)) throw new Error("Cada adjunto necesita una URL valida.");
    if (!filename || filename.length > 180) throw new Error("Cada adjunto necesita un nombre valido.");
    return { filename, path };
  }).slice(0, 10);
}

function normalizeWorkspaceTaskInput(value, requireTitle = false) {
  const payload = value && typeof value === "object" ? value : {};
  const task = {};

  if (requireTitle || Object.prototype.hasOwnProperty.call(payload, "title")) {
    const title = String(payload.title || "").trim();
    if (!title || title.length > 160) throw new Error("Escribe un titulo valido para la tarea.");
    task.title = title;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "description")) {
    const description = String(payload.description || "").trim();
    if (description.length > 500) throw new Error("El detalle de la tarea es demasiado largo.");
    task.description = description;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "priority")) {
    if (!WORKSPACE_TASK_PRIORITIES.includes(payload.priority)) throw new Error("Prioridad invalida.");
    task.priority = payload.priority;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "importance")) {
    const importance = Number(payload.importance);
    if (!Number.isInteger(importance) || importance < 1 || importance > 5) throw new Error("Importancia invalida.");
    task.importance = importance;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "urgency")) {
    const urgency = Number(payload.urgency);
    if (!Number.isInteger(urgency) || urgency < 1 || urgency > 5) throw new Error("Urgencia invalida.");
    task.urgency = urgency;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "dueDate")) {
    const dueDate = payload.dueDate ? String(payload.dueDate) : null;
    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) throw new Error("Fecha limite invalida.");
    task.due_date = dueDate;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "assignmentStatus")) {
    if (!WORKSPACE_TASK_ASSIGNMENT_STATUSES.includes(payload.assignmentStatus)) throw new Error("Estado de asignacion invalido.");
    task.assignment_status = payload.assignmentStatus;
    task.responded_at = ["accepted", "rejected"].includes(payload.assignmentStatus) ? new Date().toISOString() : null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "assignmentNote")) {
    const note = String(payload.assignmentNote || "").trim();
    if (note.length > 500) throw new Error("La nota de asignacion es demasiado larga.");
    task.assignment_note = note;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "status")) {
    if (!WORKSPACE_TASK_STATUSES.includes(payload.status)) throw new Error("Estado invalido.");
    task.status = payload.status;
    task.completed_at = payload.status === "done" ? new Date().toISOString() : null;
  }
  return task;
}

function normalizeWorkspacePushSubscriptionInput(value, options = {}) {
  const payload = value && typeof value === "object" ? value : {};
  const endpoint = String(payload.endpoint || "").trim();
  if (!/^https:\/\//i.test(endpoint) || endpoint.length > 600) throw new Error("Suscripcion push invalida.");
  const keys = payload.keys && typeof payload.keys === "object" ? payload.keys : {};
  const p256dh = String(keys.p256dh || payload.p256dh || "").trim();
  const auth = String(keys.auth || payload.auth || "").trim();
  if (!options.allowMissingKeys && (!p256dh || !auth)) throw new Error("Faltan claves de suscripcion push.");
  return {
    endpoint,
    p256dh,
    auth,
    user_agent: navigator.userAgent || ""
  };
}

function normalizeWorkspaceEventInput(value, requireTitle = false) {
  const payload = value && typeof value === "object" ? value : {};
  const event = {};

  if (requireTitle || Object.prototype.hasOwnProperty.call(payload, "title")) {
    const title = String(payload.title || "").trim();
    if (!title || title.length > 160) throw new Error("Escribe un titulo valido para el evento.");
    event.title = title;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "type")) {
    const type = String(payload.type || "").trim();
    if (!WORKSPACE_EVENT_TYPES.includes(type)) throw new Error("Tipo de evento invalido.");
    event.type = type;
  }
  if (requireTitle || Object.prototype.hasOwnProperty.call(payload, "date")) {
    const date = String(payload.date || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Fecha de evento invalida.");
    event.event_date = date;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "startTime")) {
    const startTime = payload.startTime ? String(payload.startTime) : null;
    if (startTime && !/^\d{2}:\d{2}$/.test(startTime)) throw new Error("Hora de inicio invalida.");
    event.start_time = startTime;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "endTime")) {
    const endTime = payload.endTime ? String(payload.endTime) : null;
    if (endTime && !/^\d{2}:\d{2}$/.test(endTime)) throw new Error("Hora de cierre invalida.");
    event.end_time = endTime;
  }
  if (event.start_time && event.end_time && event.end_time < event.start_time) {
    throw new Error("La hora de cierre no puede ser anterior al inicio.");
  }
  if (Object.prototype.hasOwnProperty.call(payload, "description")) {
    const description = String(payload.description || "").trim();
    if (description.length > 700) throw new Error("La descripcion del evento es demasiado larga.");
    event.description = description;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "location")) {
    const location = String(payload.location || "").trim();
    if (location.length > 180) throw new Error("La ubicacion del evento es demasiado larga.");
    event.location = location;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "link")) {
    const link = String(payload.link || "").trim();
    if (link && !/^https?:\/\//i.test(link)) throw new Error("El enlace del evento debe ser una URL valida.");
    if (link.length > 300) throw new Error("El enlace del evento es demasiado largo.");
    event.link = link;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "visibility")) {
    const visibility = String(payload.visibility || "private").trim();
    if (!WORKSPACE_EVENT_VISIBILITIES.includes(visibility)) throw new Error("Visibilidad invalida.");
    event.visibility = visibility;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "relatedTaskId")) {
    const relatedTaskId = payload.relatedTaskId ? String(payload.relatedTaskId) : null;
    if (relatedTaskId && !/^[0-9a-f-]{36}$/i.test(relatedTaskId)) throw new Error("Tarea relacionada invalida.");
    event.related_task_id = relatedTaskId;
  }
  if (requireTitle) {
    if (!Object.prototype.hasOwnProperty.call(event, "type")) event.type = "meeting";
    if (!Object.prototype.hasOwnProperty.call(event, "visibility")) event.visibility = "private";
  }
  return event;
}

function publicWorkspaceEvent(event) {
  return {
    id: event.id,
    title: event.title,
    type: event.type,
    date: event.event_date,
    startTime: event.start_time || "",
    endTime: event.end_time || "",
    description: event.description || "",
    location: event.location || "",
    link: event.link || "",
    visibility: event.visibility || "private",
    relatedTaskId: event.related_task_id || "",
    createdAt: event.created_at,
    updatedAt: event.updated_at
  };
}

function priorityImportanceFallback(priority) {
  if (priority === "high") return 5;
  if (priority === "medium") return 3;
  return 2;
}

function priorityUrgencyFallback(priority, dueDate) {
  if (dueDate) return priority === "high" ? 4 : 3;
  if (priority === "high") return 3;
  if (priority === "medium") return 3;
  return 2;
}

function publicWorkspaceTask(task, collaborators = []) {
  const collaboratorById = new Map((collaborators || []).map(collaborator => [collaborator.id, collaborator]));
  const assignee = collaboratorById.get(task.assignee_id || task.user_id) || null;
  const creator = collaboratorById.get(task.created_by) || null;
  const me = currentPageUser || null;
  return {
    id: task.id,
    ownerId: task.user_id || task.assignee_id || "",
    createdBy: task.created_by || task.user_id || "",
    assigneeId: task.assignee_id || task.user_id || "",
    assigneeName: assignee?.name || (task.assignee_id === me?.id || task.user_id === me?.id ? "Tu" : ""),
    creatorName: creator?.name || (task.created_by === me?.id ? "Tu" : ""),
    assignmentMode: WORKSPACE_TASK_ASSIGNMENT_MODES.includes(task.assignment_mode) ? task.assignment_mode : "self",
    assignmentStatus: WORKSPACE_TASK_ASSIGNMENT_STATUSES.includes(task.assignment_status) ? task.assignment_status : "accepted",
    assignmentNote: task.assignment_note || "",
    respondedAt: task.responded_at || null,
    canRespond: task.assignee_id === me?.id && task.assignment_mode === "suggested" && task.assignment_status === "pending",
    title: task.title,
    description: task.description || "",
    status: task.status,
    priority: task.priority,
    importance: Number(task.importance || priorityImportanceFallback(task.priority)),
    urgency: Number(task.urgency || priorityUrgencyFallback(task.priority, task.due_date)),
    dueDate: task.due_date || null,
    completedAt: task.completed_at || null,
    createdAt: task.created_at,
    updatedAt: task.updated_at
  };
}

function publicIntelligenceSource(source) {
  return {
    id: source.id,
    name: source.name,
    type: source.type,
    baseUrl: source.base_url || "",
    enabled: Boolean(source.enabled),
    requiresApiKey: Boolean(source.requires_api_key),
    rateLimitNotes: source.rate_limit_notes || "",
    lastSyncAt: source.last_sync_at || "",
    createdAt: source.created_at,
    updatedAt: source.updated_at
  };
}

function publicIntelligencePaper(paper) {
  return {
    id: paper.id,
    externalId: paper.external_id || "",
    doi: paper.doi || "",
    arxivId: paper.arxiv_id || "",
    normalizedTitle: paper.normalized_title || "",
    title: paper.title,
    abstract: paper.abstract || "",
    authors: Array.isArray(paper.authors) ? paper.authors : [],
    institutions: Array.isArray(paper.institutions) ? paper.institutions : [],
    publicationDate: paper.publication_date || "",
    sourceName: paper.source_name || "",
    sourceUrl: paper.source_url || "",
    journalOrVenue: paper.journal_or_venue || "",
    topics: Array.isArray(paper.topics) ? paper.topics : [],
    keywords: Array.isArray(paper.keywords) ? paper.keywords : [],
    citationsCount: Number(paper.citations_count || 0),
    openAccessUrl: paper.open_access_url || "",
    possibleDuplicate: Boolean(paper.possible_duplicate),
    duplicateCandidates: Array.isArray(paper.duplicate_candidates) ? paper.duplicate_candidates : [],
    rawData: paper.raw_data && typeof paper.raw_data === "object" ? paper.raw_data : {},
    createdAt: paper.created_at,
    updatedAt: paper.updated_at
  };
}

function publicIntelligenceGrant(grant) {
  return {
    id: grant.id,
    externalId: grant.external_id || "",
    title: grant.title,
    abstract: grant.abstract || "",
    agency: grant.agency || "",
    program: grant.program || "",
    amount: grant.amount === null || typeof grant.amount === "undefined" ? null : Number(grant.amount),
    currency: grant.currency || "",
    startDate: grant.start_date || "",
    endDate: grant.end_date || "",
    principalInvestigators: Array.isArray(grant.principal_investigators) ? grant.principal_investigators : [],
    institutions: Array.isArray(grant.institutions) ? grant.institutions : [],
    country: grant.country || "",
    sourceUrl: grant.source_url || "",
    topics: Array.isArray(grant.topics) ? grant.topics : [],
    rawData: grant.raw_data && typeof grant.raw_data === "object" ? grant.raw_data : {},
    createdAt: grant.created_at,
    updatedAt: grant.updated_at
  };
}

function publicIntelligencePatent(patent) {
  return {
    id: patent.id,
    externalId: patent.external_id || "",
    title: patent.title,
    abstract: patent.abstract || "",
    inventors: Array.isArray(patent.inventors) ? patent.inventors : [],
    assignees: Array.isArray(patent.assignees) ? patent.assignees : [],
    publicationDate: patent.publication_date || "",
    filingDate: patent.filing_date || "",
    jurisdiction: patent.jurisdiction || "",
    status: patent.status || "unknown",
    sourceUrl: patent.source_url || "",
    topics: Array.isArray(patent.topics) ? patent.topics : [],
    rawData: patent.raw_data && typeof patent.raw_data === "object" ? patent.raw_data : {},
    createdAt: patent.created_at,
    updatedAt: patent.updated_at
  };
}

function publicIntelligenceTrial(trial) {
  return {
    id: trial.id,
    externalId: trial.external_id || "",
    title: trial.title,
    summary: trial.summary || "",
    conditions: Array.isArray(trial.conditions) ? trial.conditions : [],
    interventions: Array.isArray(trial.interventions) ? trial.interventions : [],
    phase: trial.phase || "",
    status: trial.status || "",
    studyType: trial.study_type || "",
    sponsor: trial.sponsor || "",
    collaborators: Array.isArray(trial.collaborators) ? trial.collaborators : [],
    startDate: trial.start_date || "",
    completionDate: trial.completion_date || "",
    locations: Array.isArray(trial.locations) ? trial.locations : [],
    countries: Array.isArray(trial.countries) ? trial.countries : [],
    sourceUrl: trial.source_url || "",
    topics: Array.isArray(trial.topics) ? trial.topics : [],
    keywords: Array.isArray(trial.keywords) ? trial.keywords : [],
    rawData: trial.raw_data && typeof trial.raw_data === "object" ? trial.raw_data : {},
    createdAt: trial.created_at,
    updatedAt: trial.updated_at
  };
}

function publicIntelligenceInstitution(institution) {
  return {
    id: institution.id,
    name: institution.name,
    rorId: institution.ror_id || "",
    country: institution.country || "",
    city: institution.city || "",
    type: institution.type || "other",
    website: institution.website || "",
    sourceUrl: institution.source_url || "",
    relatedPapersCount: Number(institution.related_papers_count || 0),
    relatedGrantsCount: Number(institution.related_grants_count || 0),
    relatedPatentsCount: Number(institution.related_patents_count || 0),
    topics: Array.isArray(institution.topics) ? institution.topics : [],
    createdAt: institution.created_at,
    updatedAt: institution.updated_at
  };
}

function publicIntelligenceTopic(topic) {
  return {
    id: topic.id,
    name: topic.name,
    description: topic.description || "",
    category: topic.category || "general",
    keywords: Array.isArray(topic.keywords) ? topic.keywords : [],
    enabled: Boolean(topic.enabled),
    createdAt: topic.created_at,
    updatedAt: topic.updated_at
  };
}

function publicIntelligenceSignal(signal) {
  return {
    id: signal.id,
    title: signal.title,
    summary: signal.summary || "",
    signalType: signal.signal_type,
    relatedLine: signal.related_line || "General",
    confidenceScore: Number(signal.confidence_score || 0),
    opportunityScore: Number(signal.opportunity_score || 0),
    actionabilityScore: Number(signal.actionability_score || 0),
    evidenceCount: Number(signal.evidence_count || 0),
    evidenceRefs: Array.isArray(signal.evidence_refs) ? signal.evidence_refs : [],
    scoreBreakdown: signal.score_breakdown && typeof signal.score_breakdown === "object" ? signal.score_breakdown : {},
    recommendedAction: signal.recommended_action || "",
    status: signal.status || "new",
    createdAt: signal.created_at,
    updatedAt: signal.updated_at
  };
}

function publicIntelligenceRun(run) {
  return {
    id: run.id,
    status: run.status || "pending",
    actionType: run.action_type || "sync_papers",
    dryRun: Boolean(run.dry_run),
    startedAt: run.started_at || "",
    finishedAt: run.finished_at || "",
    sourcesUsed: Array.isArray(run.sources_used) ? run.sources_used : [],
    itemsFetched: Number(run.items_fetched || 0),
    itemsCreated: Number(run.items_created || 0),
    itemsUpdated: Number(run.items_updated || 0),
    signalsGenerated: Number(run.signals_generated || 0),
    errorMessage: run.error_message || "",
    createdAt: run.created_at,
    updatedAt: run.updated_at
  };
}

function publicIntelligenceSettings(settings) {
  return {
    id: settings.id,
    maxResultsPerSource: Number(settings.max_results_per_source || 20),
    defaultDateRangeDays: Number(settings.default_date_range_days || 90),
    suggestedFrequency: settings.suggested_frequency || "daily",
    defaultDryRun: Boolean(settings.default_dry_run),
    scoringThresholds: settings.scoring_thresholds && typeof settings.scoring_thresholds === "object"
      ? settings.scoring_thresholds
      : { opportunity: 60, actionability: 50, confidence: 50 },
    monitoredLines: Array.isArray(settings.monitored_lines) ? settings.monitored_lines : ["MAP-Nano", "MAP-Bio", "MAP-Med", "MAP-Ing", "MAPs", "General"],
    createdAt: settings.created_at,
    updatedAt: settings.updated_at
  };
}

function normalizeIntelligenceKeywords(value) {
  const source = Array.isArray(value)
    ? value
    : String(value || "").split(",");
  return [...new Set(source.map(item => String(item || "").trim()).filter(Boolean))].slice(0, 64);
}

function normalizeIntelligenceTopicInput(value, requireName = false) {
  const payload = value && typeof value === "object" ? value : {};
  const topic = {};

  if (requireName || Object.prototype.hasOwnProperty.call(payload, "name")) {
    const name = String(payload.name || "").trim();
    if (!name || name.length > 160) throw new Error("Escribe un nombre valido para el topic.");
    topic.name = name;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "description")) {
    const description = String(payload.description || "").trim();
    if (description.length > 2000) throw new Error("La descripcion del topic es demasiado larga.");
    topic.description = description;
  }

  if (requireName || Object.prototype.hasOwnProperty.call(payload, "category")) {
    const category = String(payload.category || "general").trim().toLowerCase();
    if (!INTELLIGENCE_TOPIC_CATEGORIES.includes(category)) throw new Error("Categoria de topic invalida.");
    topic.category = category;
  }

  if (requireName || Object.prototype.hasOwnProperty.call(payload, "keywords")) {
    topic.keywords = normalizeIntelligenceKeywords(payload.keywords);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "enabled")) {
    topic.enabled = Boolean(payload.enabled);
  }

  return topic;
}

function normalizeIntelligenceSignalInput(value) {
  const payload = value && typeof value === "object" ? value : {};
  const signal = {};
  if (Object.prototype.hasOwnProperty.call(payload, "status")) {
    const status = String(payload.status || "").trim().toLowerCase();
    if (!INTELLIGENCE_SIGNAL_STATUSES.includes(status)) throw new Error("Estado de señal invalido.");
    signal.status = status;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "summary")) {
    const summary = String(payload.summary || "").trim();
    if (summary.length > 6000) throw new Error("El resumen de la señal es demasiado largo.");
    signal.summary = summary;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "recommendedAction")) {
    const recommendedAction = String(payload.recommendedAction || "").trim();
    if (recommendedAction.length > 6000) throw new Error("La recomendacion es demasiado larga.");
    signal.recommended_action = recommendedAction;
  }
  return signal;
}

function normalizeIntelligenceSourceInput(value) {
  const payload = value && typeof value === "object" ? value : {};
  const source = {};
  if (Object.prototype.hasOwnProperty.call(payload, "enabled")) {
    source.enabled = Boolean(payload.enabled);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "rateLimitNotes")) {
    const notes = String(payload.rateLimitNotes || "").trim();
    if (notes.length > 2000) throw new Error("Las notas de la fuente son demasiado largas.");
    source.rate_limit_notes = notes;
  }
  return source;
}

function normalizeIntelligenceSettingsInput(value) {
  const payload = value && typeof value === "object" ? value : {};
  const settings = {};
  if (Object.prototype.hasOwnProperty.call(payload, "maxResultsPerSource")) {
    const maxResults = Number(payload.maxResultsPerSource);
    if (!Number.isFinite(maxResults) || maxResults < 1 || maxResults > 200) throw new Error("Maximo de resultados por fuente invalido.");
    settings.max_results_per_source = Math.round(maxResults);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "defaultDateRangeDays")) {
    const range = Number(payload.defaultDateRangeDays);
    if (!Number.isFinite(range) || range < 1 || range > 3650) throw new Error("Rango temporal por defecto invalido.");
    settings.default_date_range_days = Math.round(range);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "suggestedFrequency")) {
    const frequency = String(payload.suggestedFrequency || "").trim().toLowerCase();
    if (!INTELLIGENCE_SETTINGS_FREQUENCIES.includes(frequency)) throw new Error("Frecuencia sugerida invalida.");
    settings.suggested_frequency = frequency;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "defaultDryRun")) {
    settings.default_dry_run = Boolean(payload.defaultDryRun);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "scoringThresholds")) {
    const thresholds = payload.scoringThresholds && typeof payload.scoringThresholds === "object" ? payload.scoringThresholds : {};
    const normalized = {
      opportunity: Math.max(0, Math.min(100, Number(thresholds.opportunity) || 0)),
      actionability: Math.max(0, Math.min(100, Number(thresholds.actionability) || 0)),
      confidence: Math.max(0, Math.min(100, Number(thresholds.confidence) || 0))
    };
    settings.scoring_thresholds = normalized;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "monitoredLines")) {
    const lines = Array.isArray(payload.monitoredLines) ? payload.monitoredLines : String(payload.monitoredLines || "").split(",");
    settings.monitored_lines = [...new Set(lines.map(item => String(item || "").trim()).filter(Boolean))].slice(0, 16);
  }
  return settings;
}

async function requireAdminViewUser() {
  const me = await authorizedUser();
  if (!canManageSignalWorkspace(me)) throw new Error("Permiso insuficiente.");
  return me;
}

function normalizeIntelligenceLimit(value, fallback = 50, max = 200) {
  if (value === null || typeof value === "undefined" || value === "") return fallback;
  const limit = Number(value);
  if (!Number.isFinite(limit) || limit < 1 || limit > max) throw new Error("Limite de intelligence invalido.");
  return Math.round(limit);
}

function normalizeIntelligenceDateQuery(value, label = "Fecha") {
  if (value === null || typeof value === "undefined" || value === "") return "";
  const normalized = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) throw new Error(`${label} invalida.`);
  return normalized;
}

function normalizeIntelligenceEnumQuery(value, allowed, label) {
  if (value === null || typeof value === "undefined" || value === "") return "";
  const normalized = String(value).trim().toLowerCase();
  if (!allowed.includes(normalized)) throw new Error(`${label} invalido.`);
  return normalized;
}

function normalizeIntelligenceTextQuery(value, max = 200, label = "Filtro") {
  if (value === null || typeof value === "undefined") return "";
  const normalized = String(value).trim();
  if (normalized.length > max) throw new Error(`${label} demasiado largo.`);
  return normalized;
}

function normalizeIntelligenceBooleanQuery(value) {
  if (value === null || typeof value === "undefined" || value === "") return null;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "si"].includes(normalized)) return true;
  if (["false", "0", "no"].includes(normalized)) return false;
  throw new Error("Valor booleano invalido.");
}

function normalizeIntelligenceLine(value) {
  if (value === null || typeof value === "undefined" || value === "") return "";
  const normalized = String(value).trim();
  const allowed = ["MAP-Nano", "MAP-Bio", "MAP-Med", "MAP-Ing", "MAPs", "General"];
  if (!allowed.includes(normalized)) throw new Error("Linea relacionada invalida.");
  return normalized;
}

function mapTopicCategoryToLine(category) {
  return {
    nano: "MAP-Nano",
    bio: "MAP-Bio",
    med: "MAP-Med",
    ing: "MAP-Ing",
    general: "General"
  }[String(category || "").trim().toLowerCase()] || "General";
}

function inferIntelligenceLineFromTopics(topics, knownTopics = []) {
  const topicNames = Array.isArray(topics) ? topics : [];
  for (const topicName of topicNames) {
    const normalized = String(topicName || "").trim();
    if (["MAP-Nano", "MAP-Bio", "MAP-Med", "MAP-Ing", "MAPs", "General"].includes(normalized)) return normalized;
    const topic = knownTopics.find(item => String(item?.name || "").trim().toLowerCase() === normalized.toLowerCase());
    if (topic?.category) return mapTopicCategoryToLine(topic.category);
  }
  return "General";
}

function buildIntelligenceOverviewPayload({ sources = [], papers = [], grants = [], patents = [], trials = [], topics = [], signals = [], runs = [] } = {}) {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const activeTopics = topics.filter(item => item.enabled);
  const openSignals = signals.filter(item => ["new", "reviewing"].includes(item.status));
  const lineCounts = new Map([["MAP-Nano", 0], ["MAP-Bio", 0], ["MAP-Med", 0], ["MAP-Ing", 0], ["MAPs", 0], ["General", 0]]);

  signals.forEach(signal => {
    const line = ["MAP-Nano", "MAP-Bio", "MAP-Med", "MAP-Ing", "MAPs", "General"].includes(signal.relatedLine) ? signal.relatedLine : "General";
    lineCounts.set(line, (lineCounts.get(line) || 0) + 1);
  });
  if (![...lineCounts.values()].some(Boolean)) {
    [...papers, ...grants, ...patents, ...trials].forEach(item => {
      const line = inferIntelligenceLineFromTopics(item.topics, topics);
      lineCounts.set(line, (lineCounts.get(line) || 0) + 1);
    });
  }

  return {
    openSignals: openSignals.length,
    trackedSources: sources.filter(item => item.enabled).length,
    priorityTopics: activeTopics.length,
    newThisWeek: papers.filter(item => {
      const publicationDate = item.publicationDate ? new Date(item.publicationDate) : null;
      return publicationDate && !Number.isNaN(publicationDate.getTime()) && publicationDate >= weekAgo;
    }).length,
    papersTracked: papers.length,
    totalGrants: grants.length,
    totalPatents: patents.length,
    totalTrials: trials.length,
    newSignals: openSignals.length,
    lastSync: runs[0] || null,
    recentErrors: runs.filter(item => item.status === "failed" && item.errorMessage).slice(0, 5),
    topRelatedLine: [...lineCounts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || "General"
  };
}

async function loadIntelligenceDashboardData(supabase) {
  const [
    { data: sources, error: sourcesError },
    { data: papers, error: papersError },
    { data: grants, error: grantsError },
    { data: patents, error: patentsError },
    { data: trials, error: trialsError },
    { data: institutions, error: institutionsError },
    { data: topics, error: topicsError },
    { data: signals, error: signalsError },
    { data: runs, error: runsError },
    { data: settingsRows, error: settingsError }
  ] = await Promise.all([
    supabase.from("intelligence_sources").select(INTELLIGENCE_SOURCE_COLUMNS).order("enabled", { ascending: false }).order("updated_at", { ascending: false }).limit(50),
    supabase.from("intelligence_papers").select(INTELLIGENCE_PAPER_COLUMNS).order("publication_date", { ascending: false, nullsFirst: false }).order("updated_at", { ascending: false }).limit(200),
    supabase.from("intelligence_grants").select(INTELLIGENCE_GRANT_COLUMNS).order("updated_at", { ascending: false }).limit(200),
    supabase.from("intelligence_patents").select(INTELLIGENCE_PATENT_COLUMNS).order("publication_date", { ascending: false, nullsFirst: false }).order("updated_at", { ascending: false }).limit(200),
    supabase.from("intelligence_trials").select(INTELLIGENCE_TRIAL_COLUMNS).order("start_date", { ascending: false, nullsFirst: false }).order("updated_at", { ascending: false }).limit(200),
    supabase.from("intelligence_institutions").select(INTELLIGENCE_INSTITUTION_COLUMNS).order("related_papers_count", { ascending: false }).order("updated_at", { ascending: false }).limit(200),
    supabase.from("intelligence_topics").select(INTELLIGENCE_TOPIC_COLUMNS).order("enabled", { ascending: false }).order("updated_at", { ascending: false }).limit(100),
    supabase.from("intelligence_signals").select(INTELLIGENCE_SIGNAL_COLUMNS).order("updated_at", { ascending: false }).limit(200),
    supabase.from("intelligence_runs").select(INTELLIGENCE_RUN_COLUMNS).order("created_at", { ascending: false }).limit(50),
    supabase.from("intelligence_settings").select(INTELLIGENCE_SETTINGS_COLUMNS).order("updated_at", { ascending: false }).limit(1)
  ]);

  if (sourcesError) throw sourcesError;
  if (papersError) throw papersError;
  if (grantsError) throw grantsError;
  if (patentsError) throw patentsError;
  if (trialsError) throw trialsError;
  if (institutionsError) throw institutionsError;
  if (topicsError) throw topicsError;
  if (signalsError) throw signalsError;
  if (runsError) throw runsError;
  if (settingsError) throw settingsError;

  const publicSources = (sources || []).map(publicIntelligenceSource);
  const publicPapers = (papers || []).map(publicIntelligencePaper);
  const publicGrants = (grants || []).map(publicIntelligenceGrant);
  const publicPatents = (patents || []).map(publicIntelligencePatent);
  const publicTrials = (trials || []).map(publicIntelligenceTrial);
  const publicInstitutions = (institutions || []).map(publicIntelligenceInstitution);
  const publicTopics = (topics || []).map(publicIntelligenceTopic);
  const publicSignals = (signals || []).map(publicIntelligenceSignal);
  const publicRuns = (runs || []).map(publicIntelligenceRun);
  const publicSettings = settingsRows?.[0] ? publicIntelligenceSettings(settingsRows[0]) : publicIntelligenceSettings({});

  return {
    overview: buildIntelligenceOverviewPayload({
      sources: publicSources,
      papers: publicPapers,
      grants: publicGrants,
      patents: publicPatents,
      trials: publicTrials,
      topics: publicTopics,
      signals: publicSignals,
      runs: publicRuns
    }),
    sources: publicSources,
    papers: publicPapers,
    grants: publicGrants,
    patents: publicPatents,
    trials: publicTrials,
    institutions: publicInstitutions,
    topics: publicTopics,
    signals: publicSignals,
    runs: publicRuns,
    settings: publicSettings
  };
}

function normalizeWorkspaceFormInput(value, requireContent = false) {
  const payload = value && typeof value === "object" ? value : {};
  const form = {};
  if (requireContent || Object.prototype.hasOwnProperty.call(payload, "title")) {
    const title = String(payload.title || "").trim();
    if (!title || title.length > 120) throw new Error("Escribe un titulo valido para el formulario.");
    form.title = title;
  }
  if (requireContent || Object.prototype.hasOwnProperty.call(payload, "purpose")) {
    const purpose = String(payload.purpose || "").trim();
    if (!purpose || purpose.length > 280) throw new Error("Escribe un objetivo valido para el formulario.");
    form.purpose = purpose;
  }
  if (requireContent || Object.prototype.hasOwnProperty.call(payload, "audience")) {
    if (!WORKSPACE_FORM_AUDIENCES.includes(payload.audience)) throw new Error("Audiencia invalida.");
    form.audience = payload.audience;
  }
  if (requireContent || Object.prototype.hasOwnProperty.call(payload, "questions")) {
    if (!Array.isArray(payload.questions) || !payload.questions.length || payload.questions.length > 12) {
      throw new Error("Incluye entre 1 y 12 preguntas.");
    }
    form.questions = payload.questions.map((item, index) => {
      const id = String(item.id || `question_${index + 1}`).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48);
      const label = String(item.label || "").trim().slice(0, 180);
      const type = WORKSPACE_QUESTION_TYPES.includes(item.type) ? item.type : "long_text";
      if (!id || !label) throw new Error("Cada pregunta necesita un identificador y texto.");
      const options = type === "choice"
        ? [...new Set((Array.isArray(item.options) ? item.options : []).map(option => String(option).trim()).filter(Boolean))].slice(0, 8)
        : [];
      if (type === "choice" && options.length < 2) throw new Error("Una pregunta de opciones requiere al menos dos respuestas.");
      return { id, label, type, required: Boolean(item.required), options };
    });
  }
  if (Object.prototype.hasOwnProperty.call(payload, "status")) {
    if (!WORKSPACE_FORM_STATUSES.includes(payload.status)) throw new Error("Estado invalido.");
    form.status = payload.status;
  }
  return form;
}

function publicWorkspaceForm(form) {
  return {
    id: form.id,
    title: form.title,
    purpose: form.purpose,
    audience: form.audience,
    questions: Array.isArray(form.questions) ? form.questions : [],
    status: form.status,
    createdAt: form.created_at,
    updatedAt: form.updated_at
  };
}

function normalizeWorkspaceAnswers(value, questions) {
  const payload = value && typeof value === "object" ? value : {};
  const answers = {};
  (Array.isArray(questions) ? questions : []).forEach(item => {
    const answer = String(payload[item.id] || "").trim();
    if (item.required && !answer) throw new Error("Responde las preguntas obligatorias.");
    if (answer.length > 1500) throw new Error("Una respuesta es demasiado larga.");
    if (item.type === "scale" && answer && !["1", "2", "3", "4", "5"].includes(answer)) throw new Error("Valor de escala invalido.");
    if (item.type === "choice" && answer && !(item.options || []).includes(answer)) throw new Error("Seleccion invalida.");
    answers[item.id] = answer;
  });
  return answers;
}

function publicWorkspaceResponse(response) {
  return {
    id: response.id,
    formId: response.form_id,
    answers: response.answers || {},
    submittedAt: response.submitted_at
  };
}

function isMissingProspectAssignmentSchema(error) {
  const message = String(error?.message || error?.details || "");
  return /owner_label|assignment_status|assignment_note|column .* does not exist|schema cache/i.test(message);
}

function workspaceProspectWithoutAssignment(value) {
  const payload = { ...(value || {}) };
  delete payload.owner_label;
  delete payload.assignment_status;
  delete payload.assignment_note;
  return payload;
}

function normalizeWorkspaceProspectInput(value, requireContent = false) {
  const payload = value && typeof value === "object" ? value : {};
  const prospect = {};
  if (requireContent || Object.prototype.hasOwnProperty.call(payload, "fullName")) {
    const fullName = String(payload.fullName || "").trim();
    if (!fullName || fullName.length > 120) throw new Error("Escribe un nombre valido para el prospecto.");
    prospect.full_name = fullName;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "company")) {
    const company = String(payload.company || "").trim();
    if (company.length > 120) throw new Error("La empresa es demasiado larga.");
    prospect.company = company;
  }
  if (requireContent || Object.prototype.hasOwnProperty.call(payload, "email")) {
    const email = String(payload.email || "").trim().toLowerCase();
    if (!email || email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Escribe un correo valido para el prospecto.");
    prospect.email = email;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "phone")) {
    const phone = String(payload.phone || "").trim();
    if (phone.length > 60) throw new Error("El telefono es demasiado largo.");
    prospect.phone = phone;
  }
  if (requireContent || Object.prototype.hasOwnProperty.call(payload, "phase")) {
    if (!WORKSPACE_PROSPECT_PHASES.includes(payload.phase)) throw new Error("Fase invalida.");
    prospect.phase = payload.phase;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "tags")) {
    prospect.tags = normalizeWorkspaceTagList(payload.tags);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "source")) {
    const source = String(payload.source || "").trim();
    if (source.length > 80) throw new Error("La fuente es demasiado larga.");
    prospect.source = source;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "notes")) {
    const notes = String(payload.notes || "").trim();
    if (notes.length > 4000) throw new Error("Las notas del prospecto son demasiado largas.");
    prospect.notes = notes;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "valueEstimate")) {
    if (payload.valueEstimate === "" || payload.valueEstimate === null || typeof payload.valueEstimate === "undefined") {
      prospect.value_estimate = null;
    } else {
      const amount = Number(payload.valueEstimate);
      if (!Number.isFinite(amount) || amount < 0 || amount > 1000000000) throw new Error("Monto estimado invalido.");
      prospect.value_estimate = amount;
    }
  }
  if (Object.prototype.hasOwnProperty.call(payload, "nextFollowUpOn")) {
    const nextFollowUpOn = payload.nextFollowUpOn ? String(payload.nextFollowUpOn) : null;
    if (nextFollowUpOn && !/^\d{4}-\d{2}-\d{2}$/.test(nextFollowUpOn)) throw new Error("Fecha de seguimiento invalida.");
    prospect.next_follow_up_on = nextFollowUpOn;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "lastContactAt")) {
    const lastContactAt = payload.lastContactAt ? new Date(payload.lastContactAt) : null;
    if (lastContactAt && Number.isNaN(lastContactAt.getTime())) throw new Error("Fecha de ultimo contacto invalida.");
    prospect.last_contact_at = lastContactAt ? lastContactAt.toISOString() : null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "ownerLabel")) {
    const ownerLabel = String(payload.ownerLabel || "").trim();
    if (ownerLabel.length > 120) throw new Error("El responsable es demasiado largo.");
    prospect.owner_label = ownerLabel;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "assignmentStatus")) {
    const assignmentStatus = String(payload.assignmentStatus || "unassigned").trim();
    if (!WORKSPACE_PROSPECT_ASSIGNMENT_STATUSES.includes(assignmentStatus)) throw new Error("Estado de asignacion invalido.");
    prospect.assignment_status = assignmentStatus;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "assignmentNote")) {
    const assignmentNote = String(payload.assignmentNote || "").trim();
    if (assignmentNote.length > 240) throw new Error("La nota de asignacion es demasiado larga.");
    prospect.assignment_note = assignmentNote;
  }
  return prospect;
}

function publicWorkspaceProspect(prospect) {
  return {
    id: prospect.id,
    fullName: prospect.full_name,
    company: prospect.company || "",
    email: prospect.email,
    phone: prospect.phone || "",
    phase: prospect.phase,
    tags: Array.isArray(prospect.tags) ? prospect.tags : [],
    source: prospect.source || "",
    notes: prospect.notes || "",
    valueEstimate: prospect.value_estimate ?? null,
    nextFollowUpOn: prospect.next_follow_up_on || null,
    lastContactAt: prospect.last_contact_at || null,
    ownerLabel: prospect.owner_label || "",
    assignmentStatus: prospect.assignment_status || "unassigned",
    assignmentNote: prospect.assignment_note || "",
    createdAt: prospect.created_at,
    updatedAt: prospect.updated_at
  };
}

function normalizeWorkspaceProspectTemplateInput(value, requireContent = false) {
  const payload = value && typeof value === "object" ? value : {};
  const template = {};
  if (requireContent || Object.prototype.hasOwnProperty.call(payload, "name")) {
    const name = String(payload.name || "").trim();
    if (!name || name.length > 120) throw new Error("Escribe un nombre valido para la plantilla.");
    template.name = name;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "category")) {
    const category = String(payload.category || "").trim();
    if (category.length > 80) throw new Error("La categoria es demasiado larga.");
    template.category = category;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "tags")) {
    template.tags = normalizeWorkspaceTagList(payload.tags);
  }
  if (requireContent || Object.prototype.hasOwnProperty.call(payload, "subject")) {
    const subject = String(payload.subject || "").trim();
    if (!subject || subject.length > 180) throw new Error("El asunto de la plantilla no es valido.");
    template.subject = subject;
  }
  if (requireContent || Object.prototype.hasOwnProperty.call(payload, "body")) {
    const body = String(payload.body || "").trim();
    if (!body || body.length > 12000) throw new Error("El cuerpo de la plantilla es demasiado largo.");
    template.body = body;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "isActive")) {
    template.is_active = Boolean(payload.isActive);
  }
  return template;
}

function publicWorkspaceProspectTemplate(template) {
  return {
    id: template.id,
    name: template.name,
    category: template.category || "",
    tags: Array.isArray(template.tags) ? template.tags : [],
    subject: template.subject,
    body: template.body,
    isActive: Boolean(template.is_active),
    createdAt: template.created_at,
    updatedAt: template.updated_at
  };
}

function normalizeWorkspaceProspectEmailInput(value, requireContent = false) {
  const payload = value && typeof value === "object" ? value : {};
  const email = {};
  if (Object.prototype.hasOwnProperty.call(payload, "templateId")) {
    email.template_id = payload.templateId ? String(payload.templateId).trim() : null;
  }
  if (requireContent || Object.prototype.hasOwnProperty.call(payload, "recipientEmail")) {
    const recipientEmail = String(payload.recipientEmail || "").trim().toLowerCase();
    if (!recipientEmail || recipientEmail.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) throw new Error("Escribe un correo destinatario valido.");
    email.recipient_email = recipientEmail;
  }
  if (requireContent || Object.prototype.hasOwnProperty.call(payload, "subject")) {
    const subject = String(payload.subject || "").trim();
    if (!subject || subject.length > 180) throw new Error("El asunto del correo no es valido.");
    email.subject = subject;
  }
  if (requireContent || Object.prototype.hasOwnProperty.call(payload, "body")) {
    const body = String(payload.body || "").trim();
    if (!body || body.length > 12000) throw new Error("El cuerpo del correo es demasiado largo.");
    email.body = body;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "attachments")) {
    email.attachments = normalizeWorkspaceAttachments(payload.attachments);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "status")) {
    if (!WORKSPACE_PROSPECT_EMAIL_STATUSES.includes(payload.status)) throw new Error("Estado de correo invalido.");
    email.status = payload.status;
    email.sent_at = payload.status === "sent" ? new Date().toISOString() : null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "scheduledFor")) {
    const scheduledFor = payload.scheduledFor ? new Date(payload.scheduledFor) : null;
    if (scheduledFor && Number.isNaN(scheduledFor.getTime())) throw new Error("Fecha programada invalida.");
    email.scheduled_for = scheduledFor ? scheduledFor.toISOString() : null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "sentAt") && payload.sentAt) {
    const sentAt = new Date(payload.sentAt);
    if (Number.isNaN(sentAt.getTime())) throw new Error("Fecha de envio invalida.");
    email.sent_at = sentAt.toISOString();
  }
  if (Object.prototype.hasOwnProperty.call(payload, "providerMessageId")) {
    email.provider_message_id = String(payload.providerMessageId || "").trim().slice(0, 200);
  }
  return email;
}

function publicWorkspaceProspectEmail(email) {
  return {
    id: email.id,
    prospectId: email.prospect_id,
    templateId: email.template_id || "",
    recipientEmail: email.recipient_email,
    subject: email.subject,
    body: email.body,
    attachments: Array.isArray(email.attachments) ? email.attachments : [],
    status: email.status,
    scheduledFor: email.scheduled_for || null,
    sentAt: email.sent_at || null,
    providerMessageId: email.provider_message_id || "",
    createdAt: email.created_at,
    updatedAt: email.updated_at
  };
}

function normalizeWorkspaceProspectActivityInput(value, requireContent = false) {
  const payload = value && typeof value === "object" ? value : {};
  const activity = {};
  if (requireContent || Object.prototype.hasOwnProperty.call(payload, "activityType")) {
    if (!WORKSPACE_PROSPECT_ACTIVITY_TYPES.includes(payload.activityType)) throw new Error("Tipo de actividad invalido.");
    activity.activity_type = payload.activityType;
  }
  if (requireContent || Object.prototype.hasOwnProperty.call(payload, "title")) {
    const title = String(payload.title || "").trim();
    if (!title || title.length > 160) throw new Error("Escribe un titulo valido para la actividad.");
    activity.title = title;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "details")) {
    const details = String(payload.details || "").trim();
    if (details.length > 4000) throw new Error("El detalle de la actividad es demasiado largo.");
    activity.details = details;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "dueAt")) {
    const dueAt = payload.dueAt ? new Date(payload.dueAt) : null;
    if (dueAt && Number.isNaN(dueAt.getTime())) throw new Error("Fecha de seguimiento invalida.");
    activity.due_at = dueAt ? dueAt.toISOString() : null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "occurredAt")) {
    const occurredAt = payload.occurredAt ? new Date(payload.occurredAt) : null;
    if (occurredAt && Number.isNaN(occurredAt.getTime())) throw new Error("Fecha de actividad invalida.");
    activity.occurred_at = occurredAt ? occurredAt.toISOString() : null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "meta")) {
    const meta = payload.meta && typeof payload.meta === "object" ? payload.meta : {};
    activity.meta = meta;
  }
  return activity;
}

function publicWorkspaceProspectActivity(activity) {
  return {
    id: activity.id,
    prospectId: activity.prospect_id,
    activityType: activity.activity_type,
    title: activity.title,
    details: activity.details || "",
    dueAt: activity.due_at || null,
    occurredAt: activity.occurred_at || null,
    meta: activity.meta && typeof activity.meta === "object" ? activity.meta : {},
    createdAt: activity.created_at,
    updatedAt: activity.updated_at
  };
}

window.BCCAuth = { api: bccApi, requireAuth, logout, routeForUser, currentUser, updateProfile, loadSupabaseClient };

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-account-trigger]").forEach(button => {
    const menu = button.closest("[data-account-menu]");
    const dropdown = menu?.querySelector("[data-account-dropdown]");
    if (!menu || !dropdown) return;

    button.addEventListener("click", event => {
      event.stopPropagation();
      const open = dropdown.hidden;
      dropdown.hidden = !open;
      button.setAttribute("aria-expanded", String(open));
    });

    document.addEventListener("click", event => {
      if (dropdown.hidden || menu.contains(event.target)) return;
      dropdown.hidden = true;
      button.setAttribute("aria-expanded", "false");
    });
  });

  document.querySelectorAll("[data-logout]").forEach(button => {
    button.addEventListener("click", () => logout().catch(() => window.location.assign("/login.html")));
  });

  const loginForm = document.querySelector("[data-login-form]");
  if (loginForm) {
    loginForm.addEventListener("submit", async event => {
      event.preventDefault();
      authMessage("");
      const form = new FormData(loginForm);
      const email = String(form.get("email") || "").trim();
      const password = String(form.get("password") || "");
      try {
        try {
          const supabase = await loadSupabaseClient();
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });
          if (!error && data?.user) {
            const user = await currentUser();
            const next = new URLSearchParams(location.search).get("next");
            window.location.assign(next || routeForUser(user || publicProfile(null, data.user)));
            return;
          }
        } catch (_supabaseError) {
          // Fall back to local account server login.
        }

        const res = await fetch("/api/auth/login", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password })
        });
        const payload = await res.json().catch(() => null);
        if (!res.ok || payload?.ok === false) throw new Error(payload?.error || "Credenciales inválidas.");
        const user = payload?.user || null;
        const next = new URLSearchParams(location.search).get("next");
        window.location.assign(next || routeForUser(user));
      } catch (error) {
        authMessage(error.message);
      }
    });
  }

  const signupForm = document.querySelector("[data-signup-form]");
  if (signupForm) {
    signupForm.addEventListener("submit", async event => {
      event.preventDefault();
      authMessage("");
      const form = new FormData(signupForm);
      const password = String(form.get("password") || "");
      if (password !== String(form.get("confirmPassword") || "")) {
        authMessage("Las contraseñas no coinciden.");
        return;
      }
      if (!validatePassword(password)) {
        authMessage(PASSWORD_RULE_MESSAGE);
        return;
      }
      try {
        const supabase = await loadSupabaseClient();
        const parsed = parsePersonName(form.get("name"));
        const { data, error } = await supabase.auth.signUp({
          email: String(form.get("email") || "").trim(),
          password,
          options: {
            data: {
              full_name: parsed.fullName,
              first_name: parsed.firstName,
              middle_names: parsed.middleNames,
              first_last_name: parsed.firstLastName,
              second_last_name: parsed.secondLastName,
              display_name: parsed.displayName,
              company: String(form.get("company") || "").trim(),
              title: String(form.get("title") || "").trim()
            },
            emailRedirectTo: `${location.origin}/auth-callback.html`
          }
        });
        if (error) throw error;

        if (!data.session) {
          window.location.assign(`/check-email.html?email=${encodeURIComponent(String(form.get("email") || "").trim())}`);
          return;
        }

        window.location.assign(routeForUser(await currentUser()));
      } catch (error) {
        authMessage(error.message);
      }
    });
  }

  const forgotPasswordForm = document.querySelector("[data-forgot-password-form]");
  if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener("submit", async event => {
      event.preventDefault();
      authMessage("");
      const form = new FormData(forgotPasswordForm);
      try {
        const supabase = await loadSupabaseClient();
        const { error } = await supabase.auth.resetPasswordForEmail(String(form.get("email") || "").trim(), {
          redirectTo: `${location.origin}/reset-password.html`
        });
        if (error) throw error;
        forgotPasswordForm.hidden = true;
        authMessage("Te enviamos un enlace para cambiar tu contraseña. Revisa tu correo.", "ok");
      } catch (error) {
        authMessage(error.message);
      }
    });
  }

  const resetPasswordForm = document.querySelector("[data-reset-password-form]");
  if (resetPasswordForm) {
    const status = document.querySelector("[data-reset-status]");
    resetPasswordForm.hidden = true;

    preparePasswordRecovery()
      .then(session => {
        if (!session) throw new Error("El enlace expiró o ya fue usado. Solicita uno nuevo.");
        if (status) status.textContent = "Escribe tu nueva contraseña.";
        resetPasswordForm.hidden = false;
      })
      .catch(error => {
        if (status) {
          status.textContent = error.message || "No se pudo validar el enlace de recuperación.";
          status.dataset.tone = "error";
        }
      });

    resetPasswordForm.addEventListener("submit", async event => {
      event.preventDefault();
      authMessage("");
      const form = new FormData(resetPasswordForm);
      const password = String(form.get("password") || "");
      if (password !== String(form.get("confirmPassword") || "")) {
        authMessage("Las contraseñas no coinciden.");
        return;
      }
      if (!validatePassword(password)) {
        authMessage(PASSWORD_RULE_MESSAGE);
        return;
      }
      try {
        const supabase = await loadSupabaseClient();
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        authMessage("Contraseña actualizada. Ya puedes entrar con tu nueva contraseña.", "ok");
        resetPasswordForm.hidden = true;
        setTimeout(() => window.location.assign("/login.html"), 1600);
      } catch (error) {
        authMessage(error.message);
      }
    });
  }
});
