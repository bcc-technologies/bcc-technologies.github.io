const ROLE_PERMISSIONS = {
  client: ["dashboard:view", "profile:update", "downloads:view", "support:create"],
  staff: ["dashboard:view", "staff:view", "profile:update", "downloads:view", "support:create", "clients:view", "content:view"],
  admin: ["dashboard:view", "staff:view", "profile:update", "downloads:view", "support:create", "clients:view", "content:view", "cms:access", "users:manage", "admin:view"]
};

const STAFF_ROLE_PERMISSIONS = {
  author: ["content:write", "cms:access"],
  cofounder: ["content:write", "cms:access", "strategy:view"],
  department_director: ["content:write", "cms:access", "department:manage"]
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

  return publicProfile(profile, userData.user);
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
  return publicProfile(data, sessionData.user);
}

async function bccApi(path, options = {}) {
  const supabase = await loadSupabaseClient();

  if (path === "/api/auth/me") {
    return { ok: true, user: await currentUser() };
  }

  if (path === "/api/auth/logout") {
    await supabase.auth.signOut();
    return { ok: true };
  }

  if (path === "/api/auth/profile" && options.method === "PATCH") {
    const body = JSON.parse(options.body || "{}");
    return { ok: true, user: await updateProfile(body) };
  }

  if (path === "/api/admin/users") {
    const me = await currentUser();
    if (!me?.permissions.includes("users:manage")) throw new Error("Permiso insuficiente.");
    const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return { ok: true, users: data.map(profile => publicProfile(profile)) };
  }

  if (path === "/api/admin/access-audit") {
    const me = await currentUser();
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
