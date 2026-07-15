import http from "http";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { loadDominicanDashboard, runDominicanSync } from "./scripts/dominican-intelligence/sync.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = __dirname;
const DATA_DIR = path.resolve(process.env.BCC_ACCOUNTS_DATA_DIR || path.join(ROOT, "server-data"));
const USERS_PATH = path.join(DATA_DIR, "users.json");
const SESSIONS_PATH = path.join(DATA_DIR, "sessions.json");
const ACCESS_AUDIT_PATH = path.join(DATA_DIR, "access-audit.json");
const ROLES_PATH = path.join(DATA_DIR, "roles.json");

const PORT = Number(process.env.PORT || process.env.BCC_ACCOUNTS_PORT || 3888);
const SESSION_COOKIE = "bcc_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const MAX_BODY_BYTES = 1024 * 1024;
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const ROLE_PERMISSIONS = {
  client: ["dashboard:view", "profile:update", "downloads:view", "support:create"],
  staff: ["dashboard:view", "staff:view", "profile:update", "downloads:view", "support:create", "clients:view", "content:view"],
  admin: ["dashboard:view", "staff:view", "profile:update", "downloads:view", "support:create", "clients:view", "content:view", "cms:access", "users:manage", "forms:manage", "admin:view", "maps:developer:access", "maps:developer:read", "maps:developer:write", "maps:developer:release"]
};

const STAFF_ROLE_PERMISSIONS = {
  author: ["content:write", "cms:access"],
  cofounder: ["content:write", "cms:access", "strategy:view"],
  department_director: ["content:write", "cms:access", "department:manage", "forms:manage"],
  maps_developer: ["maps:developer:access", "maps:developer:read", "maps:developer:write"],
  maps_release_manager: ["maps:developer:access", "maps:developer:read", "maps:developer:release"]
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

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon"
};

function ensureStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(USERS_PATH)) fs.writeFileSync(USERS_PATH, "[]\n", "utf-8");
  if (!fs.existsSync(SESSIONS_PATH)) fs.writeFileSync(SESSIONS_PATH, "[]\n", "utf-8");
  if (!fs.existsSync(ACCESS_AUDIT_PATH)) fs.writeFileSync(ACCESS_AUDIT_PATH, "[]\n", "utf-8");
  if (!fs.existsSync(ROLES_PATH)) fs.writeFileSync(ROLES_PATH, "[]\n", "utf-8");
}

function readJson(file, fallback) {
  ensureStore();
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8") || "null") ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  ensureStore();
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""));
}

function normalizeUserEmails(user) {
  const primaryEmail = normalizeEmail(user?.email);
  const raw = Array.isArray(user?.emails) ? user.emails : [];
  const seen = new Set();
  const emails = raw
    .map(item => ({
      id: item.id || crypto.randomUUID(),
      email: normalizeEmail(item.email),
      primary: Boolean(item.primary),
      confirmed: Boolean(item.confirmed),
      confirmationToken: item.confirmationToken || "",
      createdAt: item.createdAt || user?.createdAt || new Date().toISOString(),
      confirmedAt: item.confirmedAt || ""
    }))
    .filter(item => item.email && !seen.has(item.email) && seen.add(item.email));

  if (primaryEmail && !emails.some(item => item.email === primaryEmail)) {
    emails.unshift({
      id: crypto.randomUUID(),
      email: primaryEmail,
      primary: true,
      confirmed: true,
      createdAt: user?.createdAt || new Date().toISOString(),
      confirmedAt: user?.createdAt || new Date().toISOString()
    });
  }

  return emails.map(item => ({
    ...item,
    primary: item.email === primaryEmail,
    confirmed: item.email === primaryEmail ? true : item.confirmed
  }));
}

function publicEmails(user) {
  return normalizeUserEmails(user).map(({ confirmationToken, ...item }) => item);
}

function emailBelongsToAnotherUser(users, userId, email) {
  return users.some(user => user.id !== userId && normalizeUserEmails(user).some(item => item.email === email));
}

function parsePersonName(name) {
  const clean = String(name || "").trim().replace(/\s+/g, " ");
  const parts = clean ? clean.split(" ") : [];
  const firstName = parts[0] || "";
  let middleNames = "";
  let firstLastName = "";
  let secondLastName = "";

  if (parts.length === 2) {
    firstLastName = parts[1];
  } else if (parts.length === 3) {
    firstLastName = parts[1];
    secondLastName = parts[2];
  } else if (parts.length >= 4) {
    middleNames = parts.slice(1, -2).join(" ");
    firstLastName = parts[parts.length - 2];
    secondLastName = parts[parts.length - 1];
  }

  return {
    fullName: clean,
    firstName,
    middleNames,
    firstLastName,
    secondLastName,
    displayName: firstName || clean
  };
}

function publicUser(user) {
  if (!user) return null;
  const staffRoles = normalizeList(user.staffRoles || user.staff_roles, STAFF_ROLES);
  const departments = normalizeList(user.departments, DEPARTMENTS);
  const customRoles = normalizeCustomRoleList(user.customRoles || user.custom_roles);
  const permissions = permissionsForUser(user.role, staffRoles, departments, customRoles);
  const nameParts = {
    ...parsePersonName(user.name),
    ...(user.nameParts && typeof user.nameParts === "object" ? user.nameParts : {})
  };
  return {
    id: user.id,
    name: user.name,
    displayName: nameParts.displayName || nameParts.firstName || user.name,
    nameParts,
    email: user.email,
    emails: publicEmails(user),
    company: user.company || "",
    title: user.title || "",
    role: user.role || "client",
    staffRoles,
    departments,
    customRoles,
    status: user.status || "active",
    permissions,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt || ""
  };
}

function normalizeList(value, allowed) {
  const list = Array.isArray(value) ? value : [];
  return [...new Set(list.map(item => String(item || "").trim()).filter(item => allowed.includes(item)))];
}

function validatePassword(password) {
  const value = String(password || "");
  return value.length >= 8 && /[A-Z]/.test(value) && /[a-z]/.test(value) && /[^A-Za-z0-9]/.test(value);
}

function permissionsForUser(role, staffRoles = [], departments = [], customRoles = []) {
  const permissions = new Set(ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.client);
  normalizeList(staffRoles, STAFF_ROLES).forEach(staffRole => {
    (STAFF_ROLE_PERMISSIONS[staffRole] || []).forEach(permission => permissions.add(permission));
  });
  normalizeList(departments, DEPARTMENTS).forEach(department => {
    (DEPARTMENT_PERMISSIONS[department] || []).forEach(permission => permissions.add(permission));
  });
  const customDefinitions = new Map(readCustomRoles().map(customRole => [customRole.id, customRole]));
  normalizeCustomRoleList(customRoles).forEach(customRoleId => {
    (customDefinitions.get(customRoleId)?.permissions || []).forEach(permission => permissions.add(permission));
  });
  if (role === "admin") {
    STAFF_ROLES.forEach(staffRole => (STAFF_ROLE_PERMISSIONS[staffRole] || []).forEach(permission => permissions.add(permission)));
    DEPARTMENTS.forEach(department => (DEPARTMENT_PERMISSIONS[department] || []).forEach(permission => permissions.add(permission)));
  }
  return [...permissions];
}


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
  "maps:developer:access": "Acceder a desarrolladores de MAPs",
  "maps:developer:read": "Consultar datos técnicos de MAPs",
  "maps:developer:write": "Modificar configuraciones de MAPs",
  "maps:developer:release": "Publicar versiones de MAPs",
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
  maps_developer: "Desarrollador MAPs",
  maps_release_manager: "Responsable de releases MAPs",
  technology: "Tecnología",
  finance: "Finanzas",
  operations: "Operaciones",
  marketing: "Marketing",
  hr: "Recursos humanos"
};

function allKnownPermissions() {
  return [...new Set([
    ...Object.values(ROLE_PERMISSIONS).flat(),
    ...Object.values(STAFF_ROLE_PERMISSIONS).flat(),
    ...Object.values(DEPARTMENT_PERMISSIONS).flat(),
    ...readJson(ROLES_PATH, []).flatMap(role => Array.isArray(role.permissions) ? role.permissions : [])
  ])].sort();
}

function permissionCatalog() {
  return allKnownPermissions().map(value => ({
    value,
    label: PERMISSION_LABELS[value] || value,
    group: value.includes(":") ? value.split(":")[0] : "general"
  }));
}

function builtInRoleDefinitions() {
  const base = Object.entries(ROLE_PERMISSIONS).map(([id, permissions]) => ({
    id: `base:${id}`,
    key: id,
    name: ROLE_LABELS[id] || id,
    description: id === "client" ? "Acceso externo para clientes." : id === "staff" ? "Acceso interno operativo." : "Control completo del workspace.",
    type: "base",
    locked: true,
    permissions: [...permissions].sort()
  }));
  const staff = Object.entries(STAFF_ROLE_PERMISSIONS).map(([id, permissions]) => ({
    id: `staff:${id}`,
    key: id,
    name: ROLE_LABELS[id] || id,
    description: "Rol interno acumulable para personal y administradores.",
    type: "staff",
    locked: true,
    permissions: [...permissions].sort()
  }));
  const departments = Object.entries(DEPARTMENT_PERMISSIONS).map(([id, permissions]) => ({
    id: `department:${id}`,
    key: id,
    name: ROLE_LABELS[id] || id,
    description: "Ámbito departamental acumulable.",
    type: "department",
    locked: true,
    permissions: [...permissions].sort()
  }));
  return [...base, ...staff, ...departments];
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

function sanitizeCustomRole(body, existing = []) {
  const name = String(body.name || "").trim().replace(/\s+/g, " ");
  if (!name) return { error: "Nombre de rol requerido." };
  const allowed = new Set(allKnownPermissions());
  const permissions = [...new Set((Array.isArray(body.permissions) ? body.permissions : [])
    .map(permission => String(permission || "").trim())
    .filter(permission => allowed.has(permission)))]
    .sort();
  if (!permissions.length) return { error: "Selecciona al menos un permiso." };
  const now = new Date().toISOString();
  const providedId = String(body.id || "").trim();
  const baseId = providedId.startsWith("custom:") ? providedId.slice(7) : slugifyRole(name);
  const fallback = crypto.randomBytes(4).toString("hex");
  let id = `custom:${baseId || fallback}`;
  const ids = new Set(existing.map(role => role.id));
  if (!providedId) {
    let suffix = 2;
    const original = id;
    while (ids.has(id)) id = `${original}-${suffix++}`;
  }
  return {
    role: {
      id,
      key: id.slice(7),
      name,
      description: String(body.description || "").trim(),
      type: "custom",
      locked: false,
      permissions,
      createdAt: body.createdAt || now,
      updatedAt: now
    }
  };
}

function readCustomRoles() {
  return readJson(ROLES_PATH, [])
    .filter(role => role && typeof role === "object" && String(role.id || "").startsWith("custom:"))
    .map(role => ({
      id: String(role.id),
      key: String(role.key || role.id).replace(/^custom:/, ""),
      name: String(role.name || "Rol personalizado"),
      description: String(role.description || ""),
      type: "custom",
      locked: false,
      permissions: [...new Set(Array.isArray(role.permissions) ? role.permissions.map(String) : [])].sort(),
      createdAt: role.createdAt || "",
      updatedAt: role.updatedAt || ""
    }));
}

function roleCatalog() {
  return [...builtInRoleDefinitions(), ...readCustomRoles()];
}

function normalizeCustomRoleList(value) {
  const allowed = new Set(readCustomRoles().map(role => role.id));
  const list = Array.isArray(value) ? value : [];
  return [...new Set(list.map(item => String(item || "").trim()).filter(item => allowed.has(item)))];
}

function accessSnapshot(user) {
  return {
    role: user?.role || "client",
    staffRoles: normalizeList(user?.staffRoles || user?.staff_roles, STAFF_ROLES),
    departments: normalizeList(user?.departments, DEPARTMENTS),
    customRoles: normalizeCustomRoleList(user?.customRoles || user?.custom_roles)
  };
}

function sameAccess(left, right) {
  return left.role === right.role
    && left.staffRoles.length === right.staffRoles.length
    && left.departments.length === right.departments.length
    && (left.customRoles || []).length === (right.customRoles || []).length
    && left.staffRoles.every(value => right.staffRoles.includes(value))
    && left.departments.every(value => right.departments.includes(value))
    && (left.customRoles || []).every(value => (right.customRoles || []).includes(value));
}

function writeAccessAudit(actor, target, before, after) {
  const logs = readJson(ACCESS_AUDIT_PATH, []);
  logs.push({
    id: crypto.randomUUID(),
    actorId: actor.id,
    actorEmail: actor.email,
    targetUserId: target.id,
    targetEmail: target.email,
    before,
    after,
    createdAt: new Date().toISOString()
  });
  writeJson(ACCESS_AUDIT_PATH, logs.slice(-1000));
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const derived = crypto.pbkdf2Sync(String(password || ""), salt, 210000, 32, "sha256").toString("hex");
  return `${salt}:${derived}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const attempt = hashPassword(password, salt).split(":")[1];
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(attempt, "hex"));
}

function parseCookies(header = "") {
  return Object.fromEntries(String(header || "").split(";").map(part => {
    const [key, ...rest] = part.trim().split("=");
    return [key, decodeURIComponent(rest.join("=") || "")];
  }).filter(([key]) => key));
}

function cookieHeader(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "SameSite=Lax"];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

function sendJson(res, status, payload, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...headers });
  res.end(JSON.stringify(payload));
}

function assertSameOrigin(req, res) {
  if (!MUTATING_METHODS.has(req.method)) return true;
  const origin = req.headers.origin;
  if (!origin) return true;
  const expected = `http://${req.headers.host || "localhost"}`;
  if (origin === expected) return true;
  sendJson(res, 403, { ok: false, error: "Origen no permitido" });
  return false;
}

function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let raw = "";
    req.on("data", chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("payload too large"));
        req.destroy();
        return;
      }
      raw += chunk;
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("invalid json"));
      }
    });
    req.on("error", reject);
  });
}

function getSession(req) {
  const token = parseCookies(req.headers.cookie || "")[SESSION_COOKIE];
  if (!token) return null;
  const sessions = readJson(SESSIONS_PATH, []);
  const now = Date.now();
  const active = sessions.filter(s => new Date(s.expiresAt).getTime() > now);
  if (active.length !== sessions.length) writeJson(SESSIONS_PATH, active);
  const session = active.find(s => s.token === token);
  if (!session) return null;
  const user = readJson(USERS_PATH, []).find(u => u.id === session.userId && u.status !== "disabled");
  return user ? { token, user } : null;
}

function requireUser(req, res) {
  const session = getSession(req);
  if (!session) {
    sendJson(res, 401, { ok: false, error: "No autenticado" });
    return null;
  }
  return session.user;
}

function can(user, permission) {
  if (!permission) return true;
  return permissionsForUser(user?.role, user?.staffRoles || [], user?.departments || [], user?.customRoles || []).includes(permission);
}

async function handleApi(req, res, url) {
  try {
    if (!assertSameOrigin(req, res)) return;
    if (req.method === "GET" && url.pathname === "/api/auth/me") {
      const session = getSession(req);
      return sendJson(res, 200, { ok: true, user: publicUser(session?.user) });
    }

    if (req.method === "POST" && url.pathname === "/api/auth/signup") {
      const body = await readBody(req);
      const email = normalizeEmail(body.email);
      const password = String(body.password || "");
      const name = String(body.name || "").trim();
      if (!name || !email || !password) return sendJson(res, 400, { ok: false, error: "Nombre, email y contraseña son requeridos." });
      if (!validatePassword(password)) return sendJson(res, 400, { ok: false, error: PASSWORD_RULE_MESSAGE });

      const users = readJson(USERS_PATH, []);
      if (users.some(u => normalizeUserEmails(u).some(item => item.email === email))) return sendJson(res, 409, { ok: false, error: "Ya existe una cuenta con ese correo." });

      const adminEmails = String(process.env.BCC_ADMIN_EMAILS || "").split(",").map(normalizeEmail).filter(Boolean);
      const role = users.length === 0 || adminEmails.includes(email) ? "admin" : "client";
      const now = new Date().toISOString();
      const nameParts = parsePersonName(name);
      const user = {
        id: crypto.randomUUID(),
        name,
        nameParts,
        email,
        emails: [{
          id: crypto.randomUUID(),
          email,
          primary: true,
          confirmed: true,
          createdAt: now,
          confirmedAt: now
        }],
        company: String(body.company || "").trim(),
        title: String(body.title || "").trim(),
        role,
        staffRoles: [],
        departments: [],
        status: "active",
        passwordHash: hashPassword(password),
        createdAt: now,
        lastLoginAt: now
      };
      users.push(user);
      writeJson(USERS_PATH, users);

      const token = createSession(user.id);
      return sendJson(res, 201, { ok: true, user: publicUser(user), redirectTo: role === "admin" ? "/staff-dashboard.html" : role === "staff" ? "/staff-dashboard.html" : "/dashboard.html" }, {
        "Set-Cookie": cookieHeader(SESSION_COOKIE, token, { maxAge: Math.floor(SESSION_TTL_MS / 1000) })
      });
    }

    if (req.method === "POST" && url.pathname === "/api/auth/login") {
      const body = await readBody(req);
      const email = normalizeEmail(body.email);
      const user = readJson(USERS_PATH, []).find(u => normalizeUserEmails(u).some(item => item.email === email && item.confirmed));
      if (!user || user.status === "disabled" || !verifyPassword(body.password, user.passwordHash)) {
        return sendJson(res, 401, { ok: false, error: "Credenciales inválidas." });
      }
      const users = readJson(USERS_PATH, []);
      const updated = users.map(u => u.id === user.id ? { ...u, lastLoginAt: new Date().toISOString() } : u);
      writeJson(USERS_PATH, updated);
      const nextUser = updated.find(u => u.id === user.id);
      const token = createSession(user.id);
      return sendJson(res, 200, { ok: true, user: publicUser(nextUser), redirectTo: can(nextUser, "staff:view") ? "/staff-dashboard.html" : "/dashboard.html" }, {
        "Set-Cookie": cookieHeader(SESSION_COOKIE, token, { maxAge: Math.floor(SESSION_TTL_MS / 1000) })
      });
    }

    if (req.method === "POST" && url.pathname === "/api/auth/logout") {
      const token = parseCookies(req.headers.cookie || "")[SESSION_COOKIE];
      if (token) writeJson(SESSIONS_PATH, readJson(SESSIONS_PATH, []).filter(s => s.token !== token));
      return sendJson(res, 200, { ok: true }, { "Set-Cookie": cookieHeader(SESSION_COOKIE, "", { maxAge: 0 }) });
    }

    if (req.method === "PATCH" && url.pathname === "/api/auth/profile") {
      const user = requireUser(req, res);
      if (!user) return;
      const body = await readBody(req);
      const name = String(body.name || "").trim();
      if (!name) return sendJson(res, 400, { ok: false, error: "Nombre requerido." });
      const nameParts = parsePersonName(name);

      const users = readJson(USERS_PATH, []);
      const updated = users.map(u => u.id === user.id ? {
        ...u,
        name,
        nameParts,
        company: String(body.company || "").trim(),
        title: String(body.title || "").trim(),
        updatedAt: new Date().toISOString()
      } : u);
      writeJson(USERS_PATH, updated);
      return sendJson(res, 200, { ok: true, user: publicUser(updated.find(u => u.id === user.id)) });
    }

    if (req.method === "GET" && url.pathname === "/api/account/emails") {
      const user = requireUser(req, res);
      if (!user) return;
      return sendJson(res, 200, { ok: true, emails: publicEmails(user) });
    }

    if (req.method === "POST" && url.pathname === "/api/account/emails") {
      const user = requireUser(req, res);
      if (!user) return;
      const body = await readBody(req);
      const email = normalizeEmail(body.email);
      if (!isEmail(email)) return sendJson(res, 400, { ok: false, error: "Escribe un correo valido." });
      const users = readJson(USERS_PATH, []);
      if (emailBelongsToAnotherUser(users, user.id, email)) return sendJson(res, 409, { ok: false, error: "Ese correo ya pertenece a otra cuenta." });
      const currentEmails = normalizeUserEmails(user);
      if (currentEmails.some(item => item.email === email)) return sendJson(res, 409, { ok: false, error: "Ese correo ya esta en tu cuenta." });
      const now = new Date().toISOString();
      const confirmationToken = crypto.randomBytes(24).toString("base64url");
      const nextEmail = {
        id: crypto.randomUUID(),
        email,
        primary: false,
        confirmed: false,
        confirmationToken,
        createdAt: now,
        confirmedAt: ""
      };
      const updated = users.map(item => item.id === user.id ? { ...item, emails: [...currentEmails, nextEmail], updatedAt: now } : item);
      writeJson(USERS_PATH, updated);
      const nextUser = updated.find(item => item.id === user.id);
      return sendJson(res, 201, { ok: true, email: publicEmails(nextUser).find(item => item.email === email), emails: publicEmails(nextUser) });
    }

    if (req.method === "POST" && url.pathname === "/api/account/emails/confirm") {
      const user = requireUser(req, res);
      if (!user) return;
      const body = await readBody(req);
      const email = normalizeEmail(body.email);
      const token = String(body.token || "").trim();
      const currentEmails = normalizeUserEmails(user);
      const target = currentEmails.find(item => item.email === email);
      if (!target) return sendJson(res, 404, { ok: false, error: "Correo no encontrado." });
      if (target.confirmed) return sendJson(res, 200, { ok: true, emails: publicEmails(user) });
      if (!token || token !== String(target.confirmationToken || "")) return sendJson(res, 400, { ok: false, error: "Codigo de confirmacion invalido." });
      const now = new Date().toISOString();
      const users = readJson(USERS_PATH, []);
      const updated = users.map(item => item.id === user.id ? {
        ...item,
        emails: currentEmails.map(emailItem => emailItem.email === email ? { ...emailItem, confirmed: true, confirmedAt: now, confirmationToken: "" } : emailItem),
        updatedAt: now
      } : item);
      writeJson(USERS_PATH, updated);
      return sendJson(res, 200, { ok: true, emails: publicEmails(updated.find(item => item.id === user.id)) });
    }

    const primaryEmailMatch = url.pathname.match(/^\/api\/account\/emails\/([^/]+)\/primary$/);
    if (req.method === "PATCH" && primaryEmailMatch) {
      const user = requireUser(req, res);
      if (!user) return;
      const targetId = decodeURIComponent(primaryEmailMatch[1]);
      const currentEmails = normalizeUserEmails(user);
      const target = currentEmails.find(item => item.id === targetId);
      if (!target) return sendJson(res, 404, { ok: false, error: "Correo no encontrado." });
      if (!target.confirmed) return sendJson(res, 400, { ok: false, error: "Confirma el correo antes de hacerlo principal." });
      const users = readJson(USERS_PATH, []);
      if (emailBelongsToAnotherUser(users, user.id, target.email)) return sendJson(res, 409, { ok: false, error: "Ese correo ya pertenece a otra cuenta." });
      const now = new Date().toISOString();
      const updated = users.map(item => item.id === user.id ? {
        ...item,
        email: target.email,
        emails: currentEmails.map(emailItem => ({ ...emailItem, primary: emailItem.id === targetId, confirmed: emailItem.id === targetId ? true : emailItem.confirmed })),
        updatedAt: now
      } : item);
      writeJson(USERS_PATH, updated);
      const nextUser = updated.find(item => item.id === user.id);
      return sendJson(res, 200, { ok: true, user: publicUser(nextUser), emails: publicEmails(nextUser) });
    }

    const deleteEmailMatch = url.pathname.match(/^\/api\/account\/emails\/([^/]+)$/);
    if (req.method === "DELETE" && deleteEmailMatch) {
      const user = requireUser(req, res);
      if (!user) return;
      const targetId = decodeURIComponent(deleteEmailMatch[1]);
      const currentEmails = normalizeUserEmails(user);
      const target = currentEmails.find(item => item.id === targetId);
      if (!target) return sendJson(res, 404, { ok: false, error: "Correo no encontrado." });
      if (target.primary) return sendJson(res, 400, { ok: false, error: "No puedes eliminar el correo principal." });
      const users = readJson(USERS_PATH, []);
      const updated = users.map(item => item.id === user.id ? {
        ...item,
        emails: currentEmails.filter(emailItem => emailItem.id !== targetId),
        updatedAt: new Date().toISOString()
      } : item);
      writeJson(USERS_PATH, updated);
      return sendJson(res, 200, { ok: true, emails: publicEmails(updated.find(item => item.id === user.id)) });
    }

    if (req.method === "GET" && url.pathname === "/api/admin/users") {
      const user = requireUser(req, res);
      if (!user) return;
      if (!can(user, "users:manage")) return sendJson(res, 403, { ok: false, error: "Permiso insuficiente" });
      const users = readJson(USERS_PATH, []).map(publicUser);
      return sendJson(res, 200, { ok: true, users });
    }


    if (req.method === "GET" && url.pathname === "/api/admin/roles") {
      const user = requireUser(req, res);
      if (!user) return;
      if (!can(user, "users:manage")) return sendJson(res, 403, { ok: false, error: "Permiso insuficiente" });
      return sendJson(res, 200, { ok: true, roles: roleCatalog(), permissions: permissionCatalog() });
    }

    if (req.method === "POST" && url.pathname === "/api/admin/roles") {
      const user = requireUser(req, res);
      if (!user) return;
      if (!can(user, "users:manage")) return sendJson(res, 403, { ok: false, error: "Permiso insuficiente" });
      const body = await readBody(req);
      const existing = readCustomRoles();
      const { role, error } = sanitizeCustomRole(body, existing);
      if (error) return sendJson(res, 400, { ok: false, error });
      const roles = [...existing, role];
      writeJson(ROLES_PATH, roles);
      return sendJson(res, 201, { ok: true, role, roles: roleCatalog(), permissions: permissionCatalog() });
    }

    const roleDefinitionMatch = url.pathname.match(/^\/api\/admin\/roles\/([^/]+)$/);
    if ((req.method === "PATCH" || req.method === "DELETE") && roleDefinitionMatch) {
      const user = requireUser(req, res);
      if (!user) return;
      if (!can(user, "users:manage")) return sendJson(res, 403, { ok: false, error: "Permiso insuficiente" });
      const id = decodeURIComponent(roleDefinitionMatch[1]);
      if (!id.startsWith("custom:")) return sendJson(res, 400, { ok: false, error: "Solo los roles personalizados se pueden modificar." });
      const existing = readCustomRoles();
      const target = existing.find(role => role.id === id);
      if (!target) return sendJson(res, 404, { ok: false, error: "Rol no encontrado." });
      if (req.method === "DELETE") {
        writeJson(ROLES_PATH, existing.filter(role => role.id !== id));
        return sendJson(res, 200, { ok: true, roles: roleCatalog(), permissions: permissionCatalog() });
      }
      const body = await readBody(req);
      const { role, error } = sanitizeCustomRole({ ...body, id, createdAt: target.createdAt }, existing.filter(item => item.id !== id));
      if (error) return sendJson(res, 400, { ok: false, error });
      writeJson(ROLES_PATH, existing.map(item => item.id === id ? role : item));
      return sendJson(res, 200, { ok: true, role, roles: roleCatalog(), permissions: permissionCatalog() });
    }

    if (req.method === "GET" && url.pathname === "/api/admin/access-audit") {
      const user = requireUser(req, res);
      if (!user) return;
      if (!can(user, "users:manage")) return sendJson(res, 403, { ok: false, error: "Permiso insuficiente" });
      const logs = readJson(ACCESS_AUDIT_PATH, [])
        .slice()
        .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
        .slice(0, 50)
        .map(log => ({
          id: log.id,
          actorEmail: log.actorEmail || "",
          targetEmail: log.targetEmail || "",
          beforeAccess: accessSnapshot(log.before || {}),
          afterAccess: accessSnapshot(log.after || {}),
          createdAt: log.createdAt || ""
        }));
      return sendJson(res, 200, { ok: true, logs });
    }

    if (req.method === "GET" && url.pathname === "/api/admin/dominican-intelligence/dashboard") {
      const user = requireUser(req, res);
      if (!user) return;
      if (!can(user, "department:manage")) return sendJson(res, 403, { ok: false, error: "Permiso insuficiente" });
      const dashboard = await loadDominicanDashboard({ dataDir: DATA_DIR });
      return sendJson(res, 200, { ok: true, dashboard });
    }

    if (req.method === "POST" && url.pathname === "/api/admin/dominican-intelligence/sync") {
      const user = requireUser(req, res);
      if (!user) return;
      if (!can(user, "department:manage")) return sendJson(res, 403, { ok: false, error: "Permiso insuficiente" });
      const body = await readBody(req);
      const result = await runDominicanSync({
        dataDir: DATA_DIR,
        target: body.target || "all",
        limit: body.limit || 50,
        limitPerTerm: body.limitPerTerm || 8
      });
      return sendJson(res, result.ok ? 200 : 207, { ok: result.ok, ...result });
    }

    const roleMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)\/role$/);
    if (req.method === "PATCH" && roleMatch) {
      const user = requireUser(req, res);
      if (!user) return;
      if (!can(user, "users:manage")) return sendJson(res, 403, { ok: false, error: "Permiso insuficiente" });
      const body = await readBody(req);
      const role = String(body.role || "");
      if (!ROLE_PERMISSIONS[role]) return sendJson(res, 400, { ok: false, error: "Rol inválido" });
      const staffRoles = normalizeList(body.staffRoles, STAFF_ROLES);
      const departments = normalizeList(body.departments, DEPARTMENTS);
      const customRoles = normalizeCustomRoleList(body.customRoles);
      const users = readJson(USERS_PATH, []);
      const targetId = roleMatch[1];
      const target = users.find(u => u.id === targetId);
      if (!target) return sendJson(res, 404, { ok: false, error: "Usuario no encontrado" });
      if (targetId === user.id && target.role === "admin" && role !== "admin") {
        return sendJson(res, 400, { ok: false, error: "No puedes quitarte tu propio rol de administrador." });
      }
      const adminCount = users.filter(u => u.role === "admin" && u.status !== "disabled").length;
      if (target.role === "admin" && role !== "admin" && adminCount <= 1) {
        return sendJson(res, 400, { ok: false, error: "Debe existir al menos un administrador activo." });
      }
      const beforeAccess = accessSnapshot(target);
      const afterAccess = {
        role,
        staffRoles: role === "client" ? [] : staffRoles,
        departments: role === "client" ? [] : departments,
        customRoles: role === "client" ? [] : customRoles
      };
      const updated = users.map(u => u.id === targetId ? {
        ...u,
        ...afterAccess,
        updatedAt: new Date().toISOString()
      } : u);
      writeJson(USERS_PATH, updated);
      if (!sameAccess(beforeAccess, afterAccess)) writeAccessAudit(user, target, beforeAccess, afterAccess);
      return sendJson(res, 200, { ok: true });
    }

    return sendJson(res, 404, { ok: false, error: "Endpoint no encontrado" });
  } catch (error) {
    return sendJson(res, 500, { ok: false, error: String(error.message || error) });
  }
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString("base64url");
  const sessions = readJson(SESSIONS_PATH, []).filter(s => new Date(s.expiresAt).getTime() > Date.now());
  sessions.push({ token, userId, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString() });
  writeJson(SESSIONS_PATH, sessions);
  return token;
}

function staticFileFor(urlPath) {
  const clean = decodeURIComponent(urlPath.split("?")[0]);
  if (clean.startsWith("/server-data") || clean.includes("..")) return null;
  const resolved = path.resolve(ROOT, clean === "/" ? "index.html" : clean.slice(1));
  if (!resolved.startsWith(ROOT)) return null;
  return resolved;
}

function serveStatic(req, res, url) {
  if (url.pathname === "/admin-local" || url.pathname === "/admin-local/") {
    redirect(res, "http://localhost:3777/");
    return;
  }
  const file = staticFileFor(url.pathname);
  if (!file || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }
  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, { "Content-Type": CONTENT_TYPES[ext] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  if (url.pathname.startsWith("/api/")) return handleApi(req, res, url);
  return serveStatic(req, res, url);
});

const HOST = process.env.BCC_ACCOUNTS_HOST || "127.0.0.1";
server.listen(PORT, HOST, () => {
  ensureStore();
  console.log(`BCC accounts server: http://${HOST}:${PORT}`);
  console.log("First registered user becomes admin unless BCC_ADMIN_EMAILS is set.");
});
