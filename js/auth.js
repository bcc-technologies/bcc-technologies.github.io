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

const DEPARTMENT_PERMISSIONS = {
  technology: ["department:technology"],
  finance: ["department:finance"],
  operations: ["department:operations"],
  marketing: ["department:marketing"],
  hr: ["department:hr"]
};

const STAFF_ROLES = Object.keys(STAFF_ROLE_PERMISSIONS);
const DEPARTMENTS = Object.keys(DEPARTMENT_PERMISSIONS);
let currentPageUser = null;
const PASSWORD_RULE_MESSAGE = "La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un símbolo.";

function normalizeList(value, allowed) {
  const list = Array.isArray(value) ? value : [];
  return [...new Set(list.map(item => String(item || "").trim()).filter(item => allowed.includes(item)))];
}

function validatePassword(password) {
  const value = String(password || "");
  return value.length >= 8 && /[A-Z]/.test(value) && /[a-z]/.test(value) && /[^A-Za-z0-9]/.test(value);
}

function permissionsForProfile(role, staffRoles = [], departments = []) {
  const permissions = new Set(ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.client);
  normalizeList(staffRoles, STAFF_ROLES).forEach(staffRole => {
    (STAFF_ROLE_PERMISSIONS[staffRole] || []).forEach(permission => permissions.add(permission));
  });
  normalizeList(departments, DEPARTMENTS).forEach(department => {
    (DEPARTMENT_PERMISSIONS[department] || []).forEach(permission => permissions.add(permission));
  });
  if (role === "admin") {
    STAFF_ROLES.forEach(staffRole => (STAFF_ROLE_PERMISSIONS[staffRole] || []).forEach(permission => permissions.add(permission)));
    DEPARTMENTS.forEach(department => (DEPARTMENT_PERMISSIONS[department] || []).forEach(permission => permissions.add(permission)));
  }
  return [...permissions];
}

async function loadSupabaseClient() {
  if (window.BCCSupabaseClient) return window.BCCSupabaseClient;
  if (!window.BCC_SUPABASE) throw new Error("Falta configuración de Supabase.");

  if (!window.supabase?.createClient) {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
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

function publicProfile(profile, authUser = null) {
  if (!profile && !authUser) return null;
  const metadata = authUser?.user_metadata || {};
  const fullName = profile?.full_name || metadata.full_name || metadata.name || authUser?.email || "";
  const parsed = parsePersonName(fullName);
  const role = profile?.role || "client";
  const staffRoles = normalizeList(profile?.staff_roles, STAFF_ROLES);
  const departments = normalizeList(profile?.departments, DEPARTMENTS);
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
    status: "active",
    permissions: permissionsForProfile(role, staffRoles, departments),
    createdAt: profile?.created_at || authUser?.created_at || "",
    lastLoginAt: authUser?.last_sign_in_at || ""
  };
}

async function currentUser() {
  const supabase = await loadSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return null;

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
      departments: []
    };
    const created = await supabase.from("profiles").insert(payload).select("*").single();
    if (!created.error) profile = created.data;
  }

  currentPageUser = publicProfile(profile, userData.user);
  return currentPageUser;
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
  if (user?.permissions?.includes("admin:view")) return "/admin-dashboard.html";
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

  if (path === "/api/workspace/tasks" && (!options.method || options.method === "GET")) {
    const { data, error } = await supabase
      .from("workspace_tasks")
      .select(WORKSPACE_TASK_COLUMNS)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { ok: true, tasks: data.map(publicWorkspaceTask) };
  }

  if (path === "/api/workspace/tasks" && options.method === "POST") {
    const body = normalizeWorkspaceTaskInput(JSON.parse(options.body || "{}"), true);
    const { data, error } = await supabase
      .from("workspace_tasks")
      .insert(body)
      .select(WORKSPACE_TASK_COLUMNS)
      .single();
    if (error) throw error;
    return { ok: true, task: publicWorkspaceTask(data) };
  }

  const workspaceTaskMatch = path.match(/^\/api\/workspace\/tasks\/([^/]+)$/);
  if (workspaceTaskMatch && options.method === "PATCH") {
    const body = normalizeWorkspaceTaskInput(JSON.parse(options.body || "{}"));
    const { data, error } = await supabase
      .from("workspace_tasks")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("id", decodeURIComponent(workspaceTaskMatch[1]))
      .select(WORKSPACE_TASK_COLUMNS)
      .single();
    if (error) throw error;
    return { ok: true, task: publicWorkspaceTask(data) };
  }

  if (workspaceTaskMatch && options.method === "DELETE") {
    const { error } = await supabase
      .from("workspace_tasks")
      .delete()
      .eq("id", decodeURIComponent(workspaceTaskMatch[1]));
    if (error) throw error;
    return { ok: true };
  }

  if (path === "/api/workspace/forms" && (!options.method || options.method === "GET")) {
    const { data, error } = await supabase
      .from("workspace_forms")
      .select(WORKSPACE_FORM_COLUMNS)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { ok: true, forms: data.map(publicWorkspaceForm) };
  }

  if (path === "/api/workspace/forms" && options.method === "POST") {
    const me = await authorizedUser();
    if (!me?.permissions.includes("forms:manage")) throw new Error("Permiso insuficiente.");
    const body = normalizeWorkspaceFormInput(JSON.parse(options.body || "{}"), true);
    const { data, error } = await supabase
      .from("workspace_forms")
      .insert(body)
      .select(WORKSPACE_FORM_COLUMNS)
      .single();
    if (error) throw error;
    return { ok: true, form: publicWorkspaceForm(data) };
  }

  if (path === "/api/workspace/form-responses/me") {
    const { data, error } = await supabase
      .from("workspace_form_responses")
      .select(WORKSPACE_RESPONSE_COLUMNS)
      .order("submitted_at", { ascending: false });
    if (error) throw error;
    return { ok: true, responses: data.map(publicWorkspaceResponse) };
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
      .select(WORKSPACE_FORM_COLUMNS)
      .single();
    if (error) throw error;
    return { ok: true, form: publicWorkspaceForm(data) };
  }

  const responseListMatch = path.match(/^\/api\/workspace\/forms\/([^/]+)\/responses$/);
  if (responseListMatch) {
    const me = await authorizedUser();
    if (!me?.permissions.includes("forms:manage")) throw new Error("Permiso insuficiente.");
    const formId = decodeURIComponent(responseListMatch[1]);
    const { data, error } = await supabase
      .from("workspace_form_responses")
      .select(WORKSPACE_RESPONSE_COLUMNS)
      .eq("form_id", formId)
      .order("submitted_at", { ascending: false });
    if (error) throw error;
    const profileIds = [...new Set(data.map(item => item.respondent_id))];
    const { data: profiles, error: profileError } = profileIds.length
      ? await supabase.from("profiles").select("id, display_name, full_name, email").in("id", profileIds)
      : { data: [], error: null };
    if (profileError) throw profileError;
    const labels = new Map(profiles.map(profile => [profile.id, profile.display_name || profile.full_name || profile.email]));
    return {
      ok: true,
      responses: data.map(item => ({ ...publicWorkspaceResponse(item), respondentLabel: labels.get(item.respondent_id) || "Usuario" }))
    };
  }

  const responseSubmitMatch = path.match(/^\/api\/workspace\/forms\/([^/]+)\/response$/);
  if (responseSubmitMatch && options.method === "POST") {
    const me = await authorizedUser();
    if (!me) throw new Error("No autenticado.");
    const formId = decodeURIComponent(responseSubmitMatch[1]);
    const { data: form, error: formError } = await supabase
      .from("workspace_forms")
      .select(WORKSPACE_FORM_COLUMNS)
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
      .select(WORKSPACE_RESPONSE_COLUMNS)
      .single();
    if (error) throw error;
    return { ok: true, response: publicWorkspaceResponse(data) };
  }

  if (path === "/api/admin/prospects/dashboard" && (!options.method || options.method === "GET")) {
    const me = await authorizedUser();
    if (!me?.permissions.includes("admin:view")) throw new Error("Permiso insuficiente.");
    const [{ data: prospects, error: prospectsError }, { data: templates, error: templatesError }, { data: emails, error: emailsError }, { data: activities, error: activitiesError }] = await Promise.all([
      supabase.from("workspace_prospects").select(WORKSPACE_PROSPECT_COLUMNS).order("updated_at", { ascending: false }),
      supabase.from("workspace_prospect_templates").select(WORKSPACE_PROSPECT_TEMPLATE_COLUMNS).order("updated_at", { ascending: false }),
      supabase.from("workspace_prospect_emails").select(WORKSPACE_PROSPECT_EMAIL_COLUMNS).order("created_at", { ascending: false }).limit(200),
      supabase.from("workspace_prospect_activities").select(WORKSPACE_PROSPECT_ACTIVITY_COLUMNS).order("occurred_at", { ascending: false }).order("created_at", { ascending: false }).limit(400)
    ]);
    if (prospectsError) throw prospectsError;
    if (templatesError) throw templatesError;
    if (emailsError) throw emailsError;
    if (activitiesError) throw activitiesError;
    return {
      ok: true,
      prospects: (prospects || []).map(publicWorkspaceProspect),
      templates: (templates || []).map(publicWorkspaceProspectTemplate),
      emails: (emails || []).map(publicWorkspaceProspectEmail),
      activities: (activities || []).map(publicWorkspaceProspectActivity)
    };
  }

  if (path === "/api/admin/prospects" && options.method === "POST") {
    const me = await authorizedUser();
    if (!me?.permissions.includes("admin:view")) throw new Error("Permiso insuficiente.");
    const body = normalizeWorkspaceProspectInput(JSON.parse(options.body || "{}"), true);
    const { data, error } = await supabase
      .from("workspace_prospects")
      .insert(body)
      .select(WORKSPACE_PROSPECT_COLUMNS)
      .single();
    if (error) throw error;
    return { ok: true, prospect: publicWorkspaceProspect(data) };
  }

  const adminProspectMatch = path.match(/^\/api\/admin\/prospects\/([^/]+)$/);
  if (adminProspectMatch && options.method === "PATCH") {
    const me = await authorizedUser();
    if (!me?.permissions.includes("admin:view")) throw new Error("Permiso insuficiente.");
    const body = normalizeWorkspaceProspectInput(JSON.parse(options.body || "{}"));
    const { data, error } = await supabase
      .from("workspace_prospects")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("id", decodeURIComponent(adminProspectMatch[1]))
      .select(WORKSPACE_PROSPECT_COLUMNS)
      .single();
    if (error) throw error;
    return { ok: true, prospect: publicWorkspaceProspect(data) };
  }

  if (adminProspectMatch && options.method === "DELETE") {
    const me = await authorizedUser();
    if (!me?.permissions.includes("admin:view")) throw new Error("Permiso insuficiente.");
    const { error } = await supabase
      .from("workspace_prospects")
      .delete()
      .eq("id", decodeURIComponent(adminProspectMatch[1]));
    if (error) throw error;
    return { ok: true };
  }

  if (path === "/api/admin/prospect-templates" && options.method === "POST") {
    const me = await authorizedUser();
    if (!me?.permissions.includes("admin:view")) throw new Error("Permiso insuficiente.");
    const body = normalizeWorkspaceProspectTemplateInput(JSON.parse(options.body || "{}"), true);
    const { data, error } = await supabase
      .from("workspace_prospect_templates")
      .insert(body)
      .select(WORKSPACE_PROSPECT_TEMPLATE_COLUMNS)
      .single();
    if (error) throw error;
    return { ok: true, template: publicWorkspaceProspectTemplate(data) };
  }

  const templateMatch = path.match(/^\/api\/admin\/prospect-templates\/([^/]+)$/);
  if (templateMatch && options.method === "PATCH") {
    const me = await authorizedUser();
    if (!me?.permissions.includes("admin:view")) throw new Error("Permiso insuficiente.");
    const body = normalizeWorkspaceProspectTemplateInput(JSON.parse(options.body || "{}"));
    const { data, error } = await supabase
      .from("workspace_prospect_templates")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("id", decodeURIComponent(templateMatch[1]))
      .select(WORKSPACE_PROSPECT_TEMPLATE_COLUMNS)
      .single();
    if (error) throw error;
    return { ok: true, template: publicWorkspaceProspectTemplate(data) };
  }

  if (templateMatch && options.method === "DELETE") {
    const me = await authorizedUser();
    if (!me?.permissions.includes("admin:view")) throw new Error("Permiso insuficiente.");
    const { error } = await supabase
      .from("workspace_prospect_templates")
      .delete()
      .eq("id", decodeURIComponent(templateMatch[1]));
    if (error) throw error;
    return { ok: true };
  }

  const createEmailMatch = path.match(/^\/api\/admin\/prospects\/([^/]+)\/emails$/);
  if (createEmailMatch && options.method === "POST") {
    const me = await authorizedUser();
    if (!me?.permissions.includes("admin:view")) throw new Error("Permiso insuficiente.");
    const prospectId = decodeURIComponent(createEmailMatch[1]);
    const body = normalizeWorkspaceProspectEmailInput(JSON.parse(options.body || "{}"), true);
    body.prospect_id = prospectId;
    const { data, error } = await supabase
      .from("workspace_prospect_emails")
      .insert(body)
      .select(WORKSPACE_PROSPECT_EMAIL_COLUMNS)
      .single();
    if (error) throw error;
    return { ok: true, email: publicWorkspaceProspectEmail(data) };
  }

  const prospectEmailMatch = path.match(/^\/api\/admin\/prospect-emails\/([^/]+)$/);
  if (prospectEmailMatch && options.method === "PATCH") {
    const me = await authorizedUser();
    if (!me?.permissions.includes("admin:view")) throw new Error("Permiso insuficiente.");
    const body = normalizeWorkspaceProspectEmailInput(JSON.parse(options.body || "{}"));
    const { data, error } = await supabase
      .from("workspace_prospect_emails")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("id", decodeURIComponent(prospectEmailMatch[1]))
      .select(WORKSPACE_PROSPECT_EMAIL_COLUMNS)
      .single();
    if (error) throw error;
    return { ok: true, email: publicWorkspaceProspectEmail(data) };
  }

  if (prospectEmailMatch && options.method === "DELETE") {
    const me = await authorizedUser();
    if (!me?.permissions.includes("admin:view")) throw new Error("Permiso insuficiente.");
    const { error } = await supabase
      .from("workspace_prospect_emails")
      .delete()
      .eq("id", decodeURIComponent(prospectEmailMatch[1]));
    if (error) throw error;
    return { ok: true };
  }

  const createActivityMatch = path.match(/^\/api\/admin\/prospects\/([^/]+)\/activities$/);
  if (createActivityMatch && options.method === "POST") {
    const me = await authorizedUser();
    if (!me?.permissions.includes("admin:view")) throw new Error("Permiso insuficiente.");
    const prospectId = decodeURIComponent(createActivityMatch[1]);
    const body = normalizeWorkspaceProspectActivityInput(JSON.parse(options.body || "{}"), true);
    body.prospect_id = prospectId;
    const { data, error } = await supabase
      .from("workspace_prospect_activities")
      .insert(body)
      .select(WORKSPACE_PROSPECT_ACTIVITY_COLUMNS)
      .single();
    if (error) throw error;
    return { ok: true, activity: publicWorkspaceProspectActivity(data) };
  }

  const prospectActivityMatch = path.match(/^\/api\/admin\/prospect-activities\/([^/]+)$/);
  if (prospectActivityMatch && options.method === "PATCH") {
    const me = await authorizedUser();
    if (!me?.permissions.includes("admin:view")) throw new Error("Permiso insuficiente.");
    const body = normalizeWorkspaceProspectActivityInput(JSON.parse(options.body || "{}"));
    const { data, error } = await supabase
      .from("workspace_prospect_activities")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("id", decodeURIComponent(prospectActivityMatch[1]))
      .select(WORKSPACE_PROSPECT_ACTIVITY_COLUMNS)
      .single();
    if (error) throw error;
    return { ok: true, activity: publicWorkspaceProspectActivity(data) };
  }

  if (prospectActivityMatch && options.method === "DELETE") {
    const me = await authorizedUser();
    if (!me?.permissions.includes("admin:view")) throw new Error("Permiso insuficiente.");
    const { error } = await supabase
      .from("workspace_prospect_activities")
      .delete()
      .eq("id", decodeURIComponent(prospectActivityMatch[1]));
    if (error) throw error;
    return { ok: true };
  }

  if (path === "/api/admin/users") {
    const me = await authorizedUser();
    if (!me?.permissions.includes("users:manage")) throw new Error("Permiso insuficiente.");
    const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return { ok: true, users: data.map(profile => publicProfile(profile)) };
  }

  if (path === "/api/admin/access-audit") {
    const me = await authorizedUser();
    if (!me?.permissions.includes("users:manage")) throw new Error("Permiso insuficiente.");
    const { data, error } = await supabase
      .from("access_audit_logs")
      .select("id, actor_email, target_email, before_access, after_access, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return {
      ok: true,
      logs: data.map(log => ({
        id: log.id,
        actorEmail: log.actor_email,
        targetEmail: log.target_email,
        beforeAccess: normalizeAccessPayload(log.before_access),
        afterAccess: normalizeAccessPayload(log.after_access),
        createdAt: log.created_at
      }))
    };
  }

  if (path.startsWith("/api/admin/analytics/overview")) {
    const me = await authorizedUser();
    if (!me?.permissions.includes("admin:view")) throw new Error("Permiso insuficiente.");
    const requestUrl = new URL(path, window.location.origin);
    const days = normalizeAnalyticsRange(requestUrl.searchParams.get("days"));
    const { data, error } = await supabase.rpc("get_admin_analytics_dashboard", { range_days: days });
    if (error) throw error;
    return { ok: true, dashboard: normalizeAnalyticsDashboard(data, days) };
  }

  const roleMatch = path.match(/^\/api\/admin\/users\/([^/]+)\/role$/);
  if (roleMatch && options.method === "PATCH") {
    const body = JSON.parse(options.body || "{}");
    const { error } = await supabase.rpc("set_user_access", {
      target_user_id: decodeURIComponent(roleMatch[1]),
      next_role: body.role,
      next_staff_roles: body.staffRoles || [],
      next_departments: body.departments || []
    });
    if (error) throw error;
    return { ok: true };
  }

  throw new Error(`Endpoint no migrado a Supabase: ${path}`);
}

function normalizeAccessPayload(value) {
  const payload = value && typeof value === "object" ? value : {};
  return {
    role: payload.role || "client",
    staffRoles: normalizeList(payload.staffRoles, STAFF_ROLES),
    departments: normalizeList(payload.departments, DEPARTMENTS)
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
    }))
  };
}

const WORKSPACE_TASK_COLUMNS = "id, title, description, status, priority, due_date, completed_at, created_at, updated_at";
const WORKSPACE_TASK_STATUSES = ["backlog", "in_progress", "done"];
const WORKSPACE_TASK_PRIORITIES = ["low", "medium", "high"];
const WORKSPACE_FORM_COLUMNS = "id, title, purpose, audience, questions, status, created_at, updated_at";
const WORKSPACE_RESPONSE_COLUMNS = "id, form_id, respondent_id, answers, submitted_at";
const WORKSPACE_FORM_AUDIENCES = ["client", "staff"];
const WORKSPACE_FORM_STATUSES = ["draft", "published"];
const WORKSPACE_QUESTION_TYPES = ["short_text", "long_text", "scale", "choice"];
const WORKSPACE_PROSPECT_COLUMNS = "id, full_name, company, email, phone, phase, tags, source, notes, value_estimate, next_follow_up_on, last_contact_at, created_at, updated_at";
const WORKSPACE_PROSPECT_TEMPLATE_COLUMNS = "id, name, category, tags, subject, body, is_active, created_at, updated_at";
const WORKSPACE_PROSPECT_EMAIL_COLUMNS = "id, prospect_id, template_id, recipient_email, subject, body, attachments, status, scheduled_for, sent_at, provider_message_id, created_at, updated_at";
const WORKSPACE_PROSPECT_ACTIVITY_COLUMNS = "id, prospect_id, activity_type, title, details, due_at, occurred_at, meta, created_at, updated_at";
const WORKSPACE_PROSPECT_PHASES = ["lead", "qualified", "contacted", "proposal", "negotiation", "won", "lost"];
const WORKSPACE_PROSPECT_EMAIL_STATUSES = ["draft", "scheduled", "sent", "archived"];
const WORKSPACE_PROSPECT_ACTIVITY_TYPES = ["note", "call", "meeting", "email", "follow_up"];

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
  if (Object.prototype.hasOwnProperty.call(payload, "dueDate")) {
    const dueDate = payload.dueDate ? String(payload.dueDate) : null;
    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) throw new Error("Fecha limite invalida.");
    task.due_date = dueDate;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "status")) {
    if (!WORKSPACE_TASK_STATUSES.includes(payload.status)) throw new Error("Estado invalido.");
    task.status = payload.status;
    task.completed_at = payload.status === "done" ? new Date().toISOString() : null;
  }
  return task;
}

function publicWorkspaceTask(task) {
  return {
    id: task.id,
    title: task.title,
    description: task.description || "",
    status: task.status,
    priority: task.priority,
    dueDate: task.due_date || null,
    completedAt: task.completed_at || null,
    createdAt: task.created_at,
    updatedAt: task.updated_at
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
      try {
        const supabase = await loadSupabaseClient();
        const { data, error } = await supabase.auth.signInWithPassword({
          email: String(form.get("email") || "").trim(),
          password: String(form.get("password") || "")
        });
        if (error) throw error;
        const user = await currentUser();
        const next = new URLSearchParams(location.search).get("next");
        window.location.assign(next || routeForUser(user || publicProfile(null, data.user)));
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
