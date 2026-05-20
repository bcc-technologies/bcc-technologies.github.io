import http from "http";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = __dirname;
const DATA_DIR = path.resolve(process.env.BCC_ACCOUNTS_DATA_DIR || path.join(ROOT, "server-data"));
const USERS_PATH = path.join(DATA_DIR, "users.json");
const SESSIONS_PATH = path.join(DATA_DIR, "sessions.json");

const PORT = Number(process.env.PORT || process.env.BCC_ACCOUNTS_PORT || 3888);
const SESSION_COOKIE = "bcc_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const MAX_BODY_BYTES = 1024 * 1024;

const ROLE_PERMISSIONS = {
  client: ["dashboard:view", "profile:update", "downloads:view", "support:create"],
  staff: ["dashboard:view", "profile:update", "downloads:view", "support:create", "clients:view", "content:view", "cms:access"],
  admin: ["dashboard:view", "profile:update", "downloads:view", "support:create", "clients:view", "content:view", "cms:access", "users:manage", "admin:view"]
};

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
  const permissions = ROLE_PERMISSIONS[user.role] || ROLE_PERMISSIONS.client;
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
    company: user.company || "",
    title: user.title || "",
    role: user.role || "client",
    status: user.status || "active",
    permissions,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt || ""
  };
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
  return (ROLE_PERMISSIONS[user?.role] || []).includes(permission);
}

async function handleApi(req, res, url) {
  try {
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
      if (password.length < 8) return sendJson(res, 400, { ok: false, error: "La contraseña debe tener al menos 8 caracteres." });

      const users = readJson(USERS_PATH, []);
      if (users.some(u => u.email === email)) return sendJson(res, 409, { ok: false, error: "Ya existe una cuenta con ese correo." });

      const adminEmails = String(process.env.BCC_ADMIN_EMAILS || "").split(",").map(normalizeEmail).filter(Boolean);
      const role = users.length === 0 || adminEmails.includes(email) ? "admin" : "client";
      const now = new Date().toISOString();
      const nameParts = parsePersonName(name);
      const user = {
        id: crypto.randomUUID(),
        name,
        nameParts,
        email,
        company: String(body.company || "").trim(),
        title: String(body.title || "").trim(),
        role,
        status: "active",
        passwordHash: hashPassword(password),
        createdAt: now,
        lastLoginAt: now
      };
      users.push(user);
      writeJson(USERS_PATH, users);

      const token = createSession(user.id);
      return sendJson(res, 201, { ok: true, user: publicUser(user), redirectTo: role === "admin" ? "/admin-dashboard.html" : "/dashboard.html" }, {
        "Set-Cookie": cookieHeader(SESSION_COOKIE, token, { maxAge: Math.floor(SESSION_TTL_MS / 1000) })
      });
    }

    if (req.method === "POST" && url.pathname === "/api/auth/login") {
      const body = await readBody(req);
      const email = normalizeEmail(body.email);
      const user = readJson(USERS_PATH, []).find(u => u.email === email);
      if (!user || user.status === "disabled" || !verifyPassword(body.password, user.passwordHash)) {
        return sendJson(res, 401, { ok: false, error: "Credenciales inválidas." });
      }
      const users = readJson(USERS_PATH, []);
      const updated = users.map(u => u.id === user.id ? { ...u, lastLoginAt: new Date().toISOString() } : u);
      writeJson(USERS_PATH, updated);
      const nextUser = updated.find(u => u.id === user.id);
      const token = createSession(user.id);
      return sendJson(res, 200, { ok: true, user: publicUser(nextUser), redirectTo: can(nextUser, "admin:view") ? "/admin-dashboard.html" : "/dashboard.html" }, {
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

    if (req.method === "GET" && url.pathname === "/api/admin/users") {
      const user = requireUser(req, res);
      if (!user) return;
      if (!can(user, "users:manage")) return sendJson(res, 403, { ok: false, error: "Permiso insuficiente" });
      const users = readJson(USERS_PATH, []).map(publicUser);
      return sendJson(res, 200, { ok: true, users });
    }

    const roleMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)\/role$/);
    if (req.method === "PATCH" && roleMatch) {
      const user = requireUser(req, res);
      if (!user) return;
      if (!can(user, "users:manage")) return sendJson(res, 403, { ok: false, error: "Permiso insuficiente" });
      const body = await readBody(req);
      const role = String(body.role || "");
      if (!ROLE_PERMISSIONS[role]) return sendJson(res, 400, { ok: false, error: "Rol inválido" });
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
      const updated = users.map(u => u.id === targetId ? { ...u, role } : u);
      writeJson(USERS_PATH, updated);
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

server.listen(PORT, () => {
  ensureStore();
  console.log(`BCC accounts server: http://localhost:${PORT}`);
  console.log("First registered user becomes admin unless BCC_ADMIN_EMAILS is set.");
});
