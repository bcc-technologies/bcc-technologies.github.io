import express from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, "..");

const CONTENT_DIR = path.join(REPO_ROOT, "content");
const POSTS_DIR = path.join(CONTENT_DIR, "posts");
const INDEX_PATH = path.join(CONTENT_DIR, "content-index.json");

const STATIC_DIR = path.join(REPO_ROOT, "static");
const UPLOAD_DIR = path.join(STATIC_DIR, "uploads");
const BLOG_DIR = path.join(REPO_ROOT, "blog");
const BLOG_EN_DIR = path.join(REPO_ROOT, "en", "blog");
const BLOG_TEMPLATES_DIR = path.join(__dirname, "templates");
const BLOG_TEMPLATE_ES = path.join(BLOG_TEMPLATES_DIR, "blog-post.es.html");
const BLOG_TEMPLATE_EN = path.join(BLOG_TEMPLATES_DIR, "blog-post.en.html");
const BLOG_GEN_MARKER = "BCC-GENERATED: blog-post";
const ACCOUNTS_DATA_DIR = path.resolve(process.env.BCC_ACCOUNTS_DATA_DIR || path.join(REPO_ROOT, "server-data"));
const ACCOUNTS_USERS_PATH = path.join(ACCOUNTS_DATA_DIR, "users.json");
const ACCOUNTS_SESSIONS_PATH = path.join(ACCOUNTS_DATA_DIR, "sessions.json");
const SESSION_COOKIE = "bcc_session";
const ACCOUNT_LOGIN_URL = process.env.BCC_ACCOUNTS_LOGIN_URL || "http://localhost:3888/login.html";
const CMS_ALLOWED_STAFF_ROLES = new Set(["author", "cofounder", "department_director"]);
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const SAFE_URL_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

const app = express();
app.use(express.json({ limit: "10mb" }));

app.use((req, res, next) => {
  if (!MUTATING_METHODS.has(req.method)) return next();
  const origin = req.headers.origin;
  if (!origin) return next();
  const expected = `${req.protocol}://${req.get("host")}`;
  if (origin === expected) return next();
  return res.status(403).json({ ok: false, error: "Origen no permitido" });
});

function readAccountJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8") || "null") ?? fallback;
  } catch {
    return fallback;
  }
}

function parseCookies(header = "") {
  return Object.fromEntries(String(header || "").split(";").map(part => {
    const [key, ...rest] = part.trim().split("=");
    return [key, decodeURIComponent(rest.join("=") || "")];
  }).filter(([key]) => key));
}

function accountUserFromRequest(req) {
  const token = parseCookies(req.headers.cookie || "")[SESSION_COOKIE];
  if (!token) return null;
  const sessions = readAccountJson(ACCOUNTS_SESSIONS_PATH, []);
  const session = sessions.find(s => s.token === token && new Date(s.expiresAt).getTime() > Date.now());
  if (!session) return null;
  const users = readAccountJson(ACCOUNTS_USERS_PATH, []);
  return users.find(u => u.id === session.userId && u.status !== "disabled") || null;
}

function parsePersonName(name) {
  const clean = String(name || "").trim().replace(/\s+/g, " ");
  const firstName = clean ? clean.split(" ")[0] : "";
  return { displayName: firstName || clean };
}

function publicAccountUser(user) {
  const parsed = parsePersonName(user?.name);
  return {
    id: user?.id,
    name: user?.name || "",
    displayName: user?.nameParts?.displayName || parsed.displayName || user?.name || "",
    email: user?.email || "",
    role: user?.role || "client",
    staffRoles: Array.isArray(user?.staffRoles) ? user.staffRoles : []
  };
}

function canAccessCms(user) {
  if (user?.role === "admin") return true;
  const staffRoles = Array.isArray(user?.staffRoles) ? user.staffRoles : [];
  return staffRoles.some(role => CMS_ALLOWED_STAFF_ROLES.has(role));
}

function wantsHtml(req) {
  return String(req.headers.accept || "").includes("text/html") || req.path === "/";
}

function requireCmsAccess(req, res, next) {
  const user = accountUserFromRequest(req);
  if (!user) {
    if (req.path.startsWith("/api/")) return res.status(401).json({ ok: false, error: "No autenticado" });
    const nextUrl = `${req.protocol}://${req.get("host")}${req.originalUrl || "/"}`;
    return res.redirect(`${ACCOUNT_LOGIN_URL}?next=${encodeURIComponent(nextUrl)}`);
  }
  if (!canAccessCms(user)) {
    if (req.path.startsWith("/api/") || !wantsHtml(req)) return res.status(403).json({ ok: false, error: "Permiso insuficiente" });
    return res.status(403).send("Permiso insuficiente para abrir el CMS local.");
  }
  req.accountUser = user;
  next();
}

app.post("/api/auth/logout", (req, res) => {
  const token = parseCookies(req.headers.cookie || "")[SESSION_COOKIE];
  if (token) {
    const sessions = readAccountJson(ACCOUNTS_SESSIONS_PATH, []);
    fs.writeFileSync(ACCOUNTS_SESSIONS_PATH, `${JSON.stringify(sessions.filter(s => s.token !== token), null, 2)}\n`, "utf-8");
  }
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  res.json({ ok: true });
});

app.use(requireCmsAccess);

app.get("/api/auth/me", (req, res) => {
  res.json({ ok: true, user: publicAccountUser(req.accountUser) });
});

// Admin UI assets live in this package's public folder.
app.use("/", express.static(path.join(__dirname, "public")));

// Site assets live at the repository root. The template renderer returns full
// blog HTML that references /css, /js, /static, etc. Without these mounts,
// iframe previews render as unstyled HTML in the CMS.
app.use("/css", express.static(path.join(REPO_ROOT, "css")));
app.use("/js", express.static(path.join(REPO_ROOT, "js")));
app.use("/static", express.static(STATIC_DIR));
app.use("/content", express.static(CONTENT_DIR));
app.use("/blog", express.static(BLOG_DIR));
app.use("/en", express.static(path.join(REPO_ROOT, "en")));

const DEFAULT_INDEX = {
  posts: [],
  products: [],
  services: [],
  authors: [],
  references: [],
  resources: [],
  widgets: []
};

function ensureDirs() {
  if (!fs.existsSync(CONTENT_DIR)) fs.mkdirSync(CONTENT_DIR, { recursive: true });
  if (!fs.existsSync(POSTS_DIR)) fs.mkdirSync(POSTS_DIR, { recursive: true });
  if (!fs.existsSync(STATIC_DIR)) fs.mkdirSync(STATIC_DIR, { recursive: true });
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  if (!fs.existsSync(BLOG_DIR)) fs.mkdirSync(BLOG_DIR, { recursive: true });
  if (!fs.existsSync(BLOG_EN_DIR)) fs.mkdirSync(BLOG_EN_DIR, { recursive: true });

  if (!fs.existsSync(INDEX_PATH)) {
    fs.writeFileSync(INDEX_PATH, JSON.stringify(DEFAULT_INDEX, null, 2), "utf-8");
  }
}

function normalizeIndex(idx = {}) {
  return {
    posts: Array.isArray(idx.posts) ? idx.posts : [],
    products: Array.isArray(idx.products) ? idx.products : [],
    services: Array.isArray(idx.services) ? idx.services : [],
    authors: Array.isArray(idx.authors) ? idx.authors : [],
    references: Array.isArray(idx.references) ? idx.references : [],
    resources: Array.isArray(idx.resources) ? idx.resources : [],
    widgets: Array.isArray(idx.widgets) ? idx.widgets : []
  };
}

function readIndex() {
  ensureDirs();
  const raw = fs.readFileSync(INDEX_PATH, "utf-8");
  return normalizeIndex(JSON.parse(raw || "{}"));
}

function writeIndex(data) {
  ensureDirs();
  fs.writeFileSync(INDEX_PATH, JSON.stringify(normalizeIndex(data), null, 2), "utf-8");
}

function normSlug(s) {
  return String(s || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function requireSafeId(value, fallbackSource = "") {
  const raw = String(value || "").trim();
  const normalized = normSlug(raw || fallbackSource);
  if (!normalized) throw new Error("ID invalido");
  if (raw && raw !== normalized) throw new Error("ID invalido: usa solo letras, numeros y guiones");
  return normalized;
}

function safeUrl(value, { allowRelative = true } = {}) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (allowRelative && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  try {
    const parsed = new URL(raw);
    return SAFE_URL_PROTOCOLS.has(parsed.protocol) ? raw : "";
  } catch {
    return "";
  }
}

function run(cmd, args, cwd = REPO_ROOT) {
  const out = spawnSync(cmd, args, { cwd, encoding: "utf-8" });
  if (out.error) throw out.error;
  if (out.status !== 0) {
    const msg = (out.stderr || out.stdout || "").trim();
    throw new Error(msg || `${cmd} failed`);
  }
  return (out.stdout || "").trim();
}

const TEMPLATE_CACHE = new Map();

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s) {
  return escapeHtml(s);
}

function stripMarkdown(md) {
  let s = String(md || "");
  s = s.replace(/```[\s\S]*?```/g, " ");
  s = s.replace(/!\[[^\]]*\]\([^)]+\)/g, " ");
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  s = s.replace(/`([^`]+)`/g, "$1");
  s = s.replace(/\[\[([^\]]+)\]\]/g, " ");
  s = s.replace(/[>#*_~]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function itemById(items, id) {
  return (Array.isArray(items) ? items : []).find(x => String(x?.id || "") === String(id || ""));
}

function entityCardHtml(type, id, idx) {
  const cleanType = String(type || "").toLowerCase();
  const cleanId = String(id || "").trim();

  if (["service"].includes(cleanType)) {
    const s = itemById(idx.services, cleanId);
    if (!s) return `<div class="bcc-card"><div class="bcc-card-kicker">Servicio</div><div class="bcc-card-title">Servicio no encontrado</div><div class="bcc-card-sub">${escapeHtml(cleanId)}</div></div>`;
    const caps = String(s.capabilities || "").split("\n").map(x => x.trim()).filter(Boolean).slice(0, 6);
    return `
      <div class="bcc-card bcc-service-card">
        <div class="bcc-card-kicker">Servicio</div>
        <div class="bcc-card-title">${escapeHtml(s.name || s.id)}</div>
        ${s.category ? `<div class="bcc-card-sub">${escapeHtml(s.category)}</div>` : ""}
        ${s.summary ? `<div class="bcc-card-body">${escapeHtml(s.summary)}</div>` : ""}
        ${caps.length ? `<ul class="bcc-card-list">${caps.map(c => `<li>${escapeHtml(c)}</li>`).join("")}</ul>` : ""}
        ${safeUrl(s.pageUrl) ? `<a class="bcc-card-link" href="${escapeAttr(safeUrl(s.pageUrl))}">Ver servicio</a>` : ""}
      </div>
    `.trim();
  }

  if (["product"].includes(cleanType)) {
    const p = itemById(idx.products, cleanId);
    if (!p) return `<div class="bcc-card"><div class="bcc-card-kicker">Producto</div><div class="bcc-card-title">Producto no encontrado</div><div class="bcc-card-sub">${escapeHtml(cleanId)}</div></div>`;
    return `
      <div class="bcc-card bcc-product-card">
        <div class="bcc-card-kicker">Producto</div>
        <div class="bcc-card-title">${escapeHtml(p.name || p.id)}</div>
        ${p.category || p.status ? `<div class="bcc-card-sub">${escapeHtml([p.category, p.status].filter(Boolean).join(" · "))}</div>` : ""}
        ${p.summary ? `<div class="bcc-card-body">${escapeHtml(p.summary)}</div>` : ""}
        ${safeUrl(p.pageUrl) ? `<a class="bcc-card-link" href="${escapeAttr(safeUrl(p.pageUrl))}">Ver producto</a>` : ""}
      </div>
    `.trim();
  }

  if (["author"].includes(cleanType)) {
    const a = itemById(idx.authors, cleanId);
    if (!a) return `<div class="bcc-card"><div class="bcc-card-kicker">Autor</div><div class="bcc-card-title">Autor no encontrado</div><div class="bcc-card-sub">${escapeHtml(cleanId)}</div></div>`;
    return `
      <div class="bcc-card bcc-author-card">
        <div class="bcc-card-kicker">Autor</div>
        <div class="bcc-card-title">${escapeHtml(a.name || a.id)}</div>
        ${a.role || a.affiliation ? `<div class="bcc-card-sub">${escapeHtml([a.role, a.affiliation].filter(Boolean).join(" · "))}</div>` : ""}
        ${a.bio ? `<div class="bcc-card-body">${escapeHtml(a.bio)}</div>` : ""}
        ${safeUrl(a.url) ? `<a class="bcc-card-link" href="${escapeAttr(safeUrl(a.url))}" target="_blank" rel="noopener noreferrer">Perfil</a>` : ""}
      </div>
    `.trim();
  }

  if (["ref", "reference"].includes(cleanType)) {
    const r = itemById(idx.references, cleanId);
    if (!r) return `<div class="bcc-card"><div class="bcc-card-kicker">Referencia</div><div class="bcc-card-title">Referencia no encontrada</div><div class="bcc-card-sub">${escapeHtml(cleanId)}</div></div>`;
    const citation = r.citation || [r.authors, r.year ? `(${r.year})` : "", r.title, r.venue].filter(Boolean).join(". ");
    return `
      <div class="bcc-card bcc-reference-card">
        <div class="bcc-card-kicker">Referencia</div>
        <div class="bcc-card-title">${escapeHtml(r.title || r.id)}</div>
        ${[r.type, r.year, r.venue].filter(Boolean).length ? `<div class="bcc-card-sub">${escapeHtml([r.type, r.year, r.venue].filter(Boolean).join(" · "))}</div>` : ""}
        ${citation ? `<div class="bcc-card-body">${escapeHtml(citation)}</div>` : ""}
        ${safeUrl(r.url || (r.doi ? `https://doi.org/${r.doi}` : "")) ? `<a class="bcc-card-link" href="${escapeAttr(safeUrl(r.url || `https://doi.org/${r.doi}`))}" target="_blank" rel="noopener noreferrer">Abrir fuente</a>` : ""}
      </div>
    `.trim();
  }

  if (["resource", "music"].includes(cleanType)) {
    const r = itemById(idx.resources, cleanId);
    if (!r) return `<div class="bcc-card"><div class="bcc-card-kicker">Recurso</div><div class="bcc-card-title">Recurso no encontrado</div><div class="bcc-card-sub">${escapeHtml(cleanId)}</div></div>`;
    return `
      <div class="bcc-card bcc-resource-card">
        <div class="bcc-card-kicker">${escapeHtml(resourceTypeLabel(r.type))}</div>
        <div class="bcc-card-title">${escapeHtml(r.title || r.id)}</div>
        ${[r.creator, r.year, r.relation].filter(Boolean).length ? `<div class="bcc-card-sub">${escapeHtml([r.creator, r.year, r.relation].filter(Boolean).join(" · "))}</div>` : ""}
        ${r.note ? `<div class="bcc-card-body">${escapeHtml(r.note)}</div>` : ""}
        ${safeUrl(r.url) ? `<a class="bcc-card-link" href="${escapeAttr(safeUrl(r.url))}" target="_blank" rel="noopener noreferrer">Abrir recurso</a>` : ""}
      </div>
    `.trim();
  }

  if (["widget"].includes(cleanType)) return renderWidgetHtml(cleanType, cleanId, idx);

  return `<div class="bcc-card"><div class="bcc-card-title">Bloque no reconocido</div><div class="bcc-card-sub">${escapeHtml(cleanType)}:${escapeHtml(cleanId)}</div></div>`;
}

function inlineRefHtml(id, idx) {
  const ref = itemById(idx.references, id);
  const label = ref
    ? `${ref.authors ? String(ref.authors).split(",")[0].trim() : ref.title || id}${ref.year ? ", " + ref.year : ""}`
    : id;
  return `<sup class="inline-citation" title="${escapeAttr(ref?.title || id)}">[@${escapeHtml(label)}]</sup>`;
}

function mdInline(s, idx) {
  s = String(s || "");

  s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, url) => {
    const u = String(url || "").trim().replace(/^<|>$/g, "");
    const caption = String(alt || "").trim();
    const cleanUrl = safeUrl(u);
    if (!cleanUrl) return escapeHtml(caption);
    return `
      <figure class="md-figure">
        <img src="${escapeAttr(cleanUrl)}" alt="${escapeAttr(caption)}" loading="lazy" />
        ${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ``}
      </figure>
    `.trim();
  });

  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, text, url) => {
    const u = String(url || "").trim().replace(/^<|>$/g, "");
    const cleanUrl = safeUrl(u);
    if (!cleanUrl) return escapeHtml(text);
    return `<a href="${escapeAttr(cleanUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`;
  });

  s = s.replace(/`([^`]+)`/g, (_m, code) => `<code>${escapeHtml(code)}</code>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, (_m, b) => `<strong>${escapeHtml(b)}</strong>`);
  s = s.replace(/\*([^*]+)\*/g, (_m, i) => `<em>${escapeHtml(i)}</em>`);
  s = s.replace(/\[@([A-Za-z0-9_.:-]+)\]/g, (_m, id) => inlineRefHtml(id, idx));

  return s;
}

function mdToHtml(md, idx = DEFAULT_INDEX) {
  const lines = String(md || "").replace(/\r\n/g, "\n").split("\n");
  let html = "";
  let inCode = false;
  let codeBuf = [];
  let inUl = false;
  let inOl = false;

  const flushList = () => {
    if (inUl) { html += "</ul>"; inUl = false; }
    if (inOl) { html += "</ol>"; inOl = false; }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith("```")) {
      if (!inCode) {
        flushList();
        inCode = true;
        codeBuf = [];
      } else {
        inCode = false;
        const code = escapeHtml(codeBuf.join("\n"));
        html += `<pre><code>${code}</code></pre>`;
      }
      continue;
    }

    if (inCode) { codeBuf.push(line); continue; }

    const t = line.trim();
    if (!t) { flushList(); continue; }

    const live = t.match(/^\[\[(service|product|author|ref|reference|resource|music|widget):([^\]]+)\]\]$/i);
    if (live) {
      flushList();
      html += entityCardHtml(live[1].toLowerCase(), live[2].trim(), idx);
      continue;
    }

    if (/^(-{3,}|_{3,}|\*{3,})$/.test(t)) {
      flushList();
      html += "<hr />";
      continue;
    }

    const h = t.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flushList();
      const level = h[1].length;
      html += `<h${level}>${mdInline(h[2], idx)}</h${level}>`;
      continue;
    }

    if (t.startsWith(">")) {
      flushList();
      html += `<blockquote>${mdInline(t.replace(/^>\s?/, ""), idx)}</blockquote>`;
      continue;
    }

    const ul = t.match(/^[-*+]\s+(.*)$/);
    if (ul) {
      if (!inUl) { flushList(); html += "<ul>"; inUl = true; }
      html += `<li>${mdInline(ul[1], idx)}</li>`;
      continue;
    }

    const ol = t.match(/^\d+\.\s+(.*)$/);
    if (ol) {
      if (!inOl) { flushList(); html += "<ol>"; inOl = true; }
      html += `<li>${mdInline(ol[1], idx)}</li>`;
      continue;
    }

    flushList();
    html += `<p>${mdInline(t, idx)}</p>`;
  }

  if (inCode) {
    const code = escapeHtml(codeBuf.join("\n"));
    html += `<pre><code>${code}</code></pre>`;
  }
  if (inUl) html += "</ul>";
  if (inOl) html += "</ol>";

  return html;
}

function countWords(text) {
  try {
    return (String(text).match(/\b[\p{L}\p{N}']+\b/gu) || []).length;
  } catch {
    return String(text).trim().split(/\s+/).filter(Boolean).length;
  }
}

function estimateReadTimeFromText(text) {
  const words = countWords(text);
  const minutes = Math.max(1, Math.round(words / 220));
  return { words, minutes };
}

function formatDateDisplay(iso, locale) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso || "");
  try {
    return new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "2-digit" }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

function getTemplate(lang) {
  const key = lang === "en" ? "en" : "es";
  if (TEMPLATE_CACHE.has(key)) return TEMPLATE_CACHE.get(key);
  const file = key === "en" ? BLOG_TEMPLATE_EN : BLOG_TEMPLATE_ES;
  if (!fs.existsSync(file)) throw new Error(`Template not found: ${file}`);
  const tpl = fs.readFileSync(file, "utf-8");
  TEMPLATE_CACHE.set(key, tpl);
  return tpl;
}

function fillTemplate(tpl, data) {
  let out = tpl;
  for (const [key, value] of Object.entries(data)) {
    out = out.split(`{{${key}}}`).join(value ?? "");
  }
  return out;
}

function cleanJsonLd(obj) {
  return JSON.parse(JSON.stringify(obj, (_k, v) => (v === undefined || v === "" ? undefined : v)));
}

function cleanGeneratedDir(dir, keepSet) {
  if (!fs.existsSync(dir)) return [];
  const removed = [];
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".html"));
  for (const f of files) {
    const full = path.join(dir, f);
    if (keepSet.has(full)) continue;
    try {
      const content = fs.readFileSync(full, "utf-8");
      if (content.includes(BLOG_GEN_MARKER)) {
        fs.unlinkSync(full);
        removed.push(full);
      }
    } catch {
      // ignore
    }
  }
  return removed;
}

function resourceTypeLabel(type) {
  const map = {
    music: "Resonancia",
    book: "Libro",
    paper: "Paper",
    article: "Artículo",
    video: "Video",
    tool: "Herramienta",
    product: "Producto",
    service: "Servicio",
    dataset: "Dataset",
    website: "Sitio web",
    other: "Recurso"
  };
  return map[String(type || "other").toLowerCase()] || map.other;
}

function serializeResourcesForPost(post, idx, includeResources = true) {
  if (!includeResources) return "[]";
  const ids = Array.isArray(post.resourceIds)
    ? post.resourceIds
    : Array.isArray(post.resources)
      ? post.resources
      : [];

  const items = ids
    .map(id => itemById(idx.resources, id))
    .filter(Boolean)
    .map(r => ({
      id: r.id || "",
      type: r.type || "other",
      typeLabel: resourceTypeLabel(r.type),
      title: r.title || "",
      creator: r.creator || "",
      year: r.year || "",
      url: safeUrl(r.url),
      relation: r.relation || "",
      note: r.note || "",
      tags: Array.isArray(r.tags) ? r.tags : []
    }));

  return JSON.stringify(items).replace(/</g, "\\u003c").replace(/<\//g, "<\\/");
}


function widgetTypeLabel(type) {
  const map = {
    callout: "Callout",
    image: "Imagen",
    "image-compare": "Comparador",
    video: "Video",
    scrollbox: "Detalle",
    table: "Tabla de datos",
    chart: "Gráfico",
    metrics: "Métricas",
    "product-preview": "Producto",
    "service-preview": "Servicio",
    demo: "Prueba de concepto"
  };
  return map[String(type || "callout").toLowerCase()] || "Widget";
}

function widgetTypeIcon(type) {
  const map = {
    callout: "※",
    image: "🖼",
    "image-compare": "⇄",
    video: "▶",
    scrollbox: "▤",
    table: "▦",
    chart: "⌁",
    metrics: "▥",
    "product-preview": "◈",
    "service-preview": "▣",
    demo: "⚗"
  };
  return map[String(type || "callout").toLowerCase()] || "▧";
}

function parseWidgetConfig(widget = {}) {
  const cfg = widget.config;
  if (cfg && typeof cfg === "object" && !Array.isArray(cfg)) return cfg;
  const raw = String(cfg || "").trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parseCsvTable(text = "") {
  const lines = String(text || "").split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return { columns: [], rows: [] };
  const split = l => {
    const delimiter = l.includes("\t") ? "\t" : ",";
    return l.split(delimiter).map(x => x.trim());
  };
  const columns = split(lines[0]);
  const rows = lines.slice(1).map(split);
  return { columns, rows };
}

function renderWidgetMetrics(widget, cfg) {
  const metrics = Array.isArray(cfg.metrics) ? cfg.metrics : parseCsvTable(widget.body || "").rows.map(row => ({ label: row[0] || "", value: row[1] || "", unit: row[2] || "", note: row[3] || "" }));
  const clean = metrics.filter(m => m && (m.label || m.value));
  if (!clean.length) return `<div class="bcc-widget-empty">Sin métricas.</div>`;
  return `<div class="bcc-metric-grid">${clean.map(m => `
    <div class="bcc-metric-card">
      <div class="bcc-metric-label">${escapeHtml(m.label || "Métrica")}</div>
      <div class="bcc-metric-value">${escapeHtml(m.value || "—")}${m.unit ? `<span>${escapeHtml(m.unit)}</span>` : ""}</div>
      ${m.note ? `<div class="bcc-metric-note">${escapeHtml(m.note)}</div>` : ""}
    </div>
  `).join("")}</div>`;
}

function widgetTextHtml(text, idx) {
  return mdToHtml(String(text || ""), idx);
}

function youtubeEmbedFromUrl(url = "") {
  const s = String(url || "").trim();
  const m = s.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : s;
}

function renderWidgetChart(widget, cfg) {
  const labels = Array.isArray(cfg.labels) ? cfg.labels : [];
  const values = Array.isArray(cfg.values) ? cfg.values.map(Number) : [];
  if (!values.length) return `<div class="bcc-widget-empty">Sin datos para graficar.</div>`;
  const chartType = String(cfg.chartType || "bar").toLowerCase();
  const cleanValues = values.map(v => Number.isFinite(v) ? v : 0);
  const max = Math.max(...cleanValues, 1);
  const min = Math.min(...cleanValues, 0);
  const range = Math.max(1, max - min);

  if (chartType === "line" || chartType === "scatter") {
    const width = 640;
    const height = 240;
    const padX = 28;
    const padY = 22;
    const points = cleanValues.map((v, i) => {
      const x = values.length === 1 ? width / 2 : padX + (i / Math.max(1, values.length - 1)) * (width - padX * 2);
      const y = height - padY - ((v - min) / range) * (height - padY * 2);
      return { x, y, value: v, label: labels[i] ?? String(i + 1) };
    });
    const poly = points.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
    return `<div class="bcc-widget-chart is-${escapeAttr(chartType)}" role="img" aria-label="${escapeAttr(widget.title || "Gráfico")}">
      <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
        <line class="bcc-chart-axis" x1="${padX}" y1="${height - padY}" x2="${width - padX}" y2="${height - padY}" />
        ${chartType === "line" ? `<polyline class="bcc-chart-line" points="${poly}" />` : ""}
        ${points.map(p => `<circle class="bcc-chart-point" cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="4"><title>${escapeHtml(p.label)}: ${escapeHtml(p.value)}</title></circle>`).join("")}
      </svg>
      <div class="bcc-chart-xlabels">${points.map(p => `<span>${escapeHtml(p.label)}</span>`).join("")}</div>
    </div>`;
  }

  const bars = cleanValues.map((v, i) => {
    const h = Math.max(3, Math.round((v - Math.min(min, 0)) / Math.max(1, max - Math.min(min, 0)) * 100));
    const label = labels[i] ?? String(i + 1);
    return `<div class="bcc-chart-bar" style="--h:${h}%" title="${escapeAttr(label)}: ${escapeAttr(v)}"><span></span><em>${escapeHtml(label)}</em></div>`;
  }).join("");
  return `<div class="bcc-widget-chart is-bar" role="img" aria-label="${escapeAttr(widget.title || "Gráfico")}">${bars}</div>`;
}

function renderWidgetTable(widget, cfg) {
  const parsed = Array.isArray(cfg.columns) || Array.isArray(cfg.rows) ? { columns: cfg.columns || [], rows: cfg.rows || [] } : parseCsvTable(widget.body || "");
  const columns = Array.isArray(parsed.columns) ? parsed.columns : [];
  const rows = Array.isArray(parsed.rows) ? parsed.rows : [];
  if (!columns.length && !rows.length) return `<div class="bcc-widget-empty">Sin datos de tabla.</div>`;
  const head = columns.length ? `<thead><tr>${columns.map(c => `<th>${escapeHtml(c)}</th>`).join("")}</tr></thead>` : "";
  const body = `<tbody>${rows.map(row => `<tr>${(Array.isArray(row) ? row : []).map(cell => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody>`;
  return `<div class="bcc-table-scroll"><table class="bcc-data-table">${head}${body}</table></div>`;
}

function clampNumber(n, min, max, fallback) {
  const value = Number(n);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function renderImageCompare(widget, cfg) {
  const beforeUrl = safeUrl(cfg.beforeUrl || widget.sourceUrl || "");
  const afterUrl = safeUrl(cfg.afterUrl || "");
  if (!beforeUrl || !afterUrl) return `<div class="bcc-widget-empty">Comparador incompleto: faltan dos imágenes.</div>`;
  const split = clampNumber(cfg.split, 5, 95, 50);
  const beforeLabel = cfg.beforeLabel || "Antes";
  const afterLabel = cfg.afterLabel || "Después";
  const caption = cfg.caption || widget.body || "";
  return `<figure class="bcc-widget bcc-widget-compare" style="--split:${split}%">
    <div class="bcc-compare-stage">
      <img class="bcc-compare-img bcc-compare-img-after" src="${escapeAttr(afterUrl)}" alt="${escapeAttr(cfg.alt || afterLabel)}" loading="lazy" />
      <div class="bcc-compare-before">
        <img class="bcc-compare-img" src="${escapeAttr(beforeUrl)}" alt="${escapeAttr(cfg.alt || beforeLabel)}" loading="lazy" />
      </div>
      <span class="bcc-compare-label is-before">${escapeHtml(beforeLabel)}</span>
      <span class="bcc-compare-label is-after">${escapeHtml(afterLabel)}</span>
      <span class="bcc-compare-divider" aria-hidden="true"></span>
      <input class="bcc-compare-range" type="range" min="5" max="95" value="${split}" aria-label="Mover comparador" oninput="this.closest('.bcc-widget-compare').style.setProperty('--split', this.value + '%')" />
    </div>
    ${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ""}
  </figure>`;
}

function renderWidgetDemo(widget, cfg, idx) {
  const demoType = String(cfg.demoType || "slider").toLowerCase();
  const title = escapeHtml(widget.title || "Demo");
  const body = String(widget.body || "").trim();
  if (demoType === "toggle") {
    return `<section class="bcc-widget bcc-widget-demo">
      <div class="bcc-widget-head"><span>${escapeHtml(widgetTypeIcon("demo"))}</span><strong>${title}</strong></div>
      <div class="bcc-demo-toggle">
        <label class="bcc-demo-switch"><input type="checkbox" /><span></span></label>
        <div class="bcc-demo-toggle-states">
          <div><strong>Estado A</strong><p>${escapeHtml(cfg.offText || "Condición base")}</p></div>
          <div><strong>Estado B</strong><p>${escapeHtml(cfg.onText || "Condición alternativa")}</p></div>
        </div>
      </div>
      ${body ? `<div class="bcc-demo-box">${widgetTextHtml(body, idx)}</div>` : ""}
    </section>`;
  }
  const min = Number.isFinite(Number(cfg.min)) ? Number(cfg.min) : 0;
  const max = Number.isFinite(Number(cfg.max)) ? Number(cfg.max) : 100;
  const initial = clampNumber(cfg.initial, min, max, Math.round((min + max) / 2));
  const variable = cfg.variable || "Variable";
  return `<section class="bcc-widget bcc-widget-demo" style="--demo:${((initial - min) / Math.max(1, max - min) * 100).toFixed(2)}%">
    <div class="bcc-widget-head"><span>${escapeHtml(widgetTypeIcon("demo"))}</span><strong>${title}</strong></div>
    <div class="bcc-demo-control">
      <div class="bcc-demo-readout"><span>${escapeHtml(variable)}</span><strong data-demo-output>${escapeHtml(initial)}</strong></div>
      <input type="range" min="${escapeAttr(min)}" max="${escapeAttr(max)}" value="${escapeAttr(initial)}" oninput="const box=this.closest('.bcc-widget-demo'); const min=Number(this.min), max=Number(this.max), val=Number(this.value); box.style.setProperty('--demo', ((val-min)/Math.max(1,max-min)*100)+'%'); box.querySelector('[data-demo-output]').textContent=this.value;" />
      <div class="bcc-demo-scale"><span>${escapeHtml(min)}</span><span>${escapeHtml(max)}</span></div>
    </div>
    ${body ? `<div class="bcc-demo-box">${widgetTextHtml(body, idx)}</div>` : ""}
  </section>`;
}

function renderWidgetHtml(type, id, idx) {
  const widget = itemById(idx.widgets, id);
  if (!widget) return `<div class="bcc-widget bcc-widget-missing"><div class="bcc-widget-title">Widget no encontrado</div><div class="bcc-widget-sub">${escapeHtml(id)}</div></div>`;
  const cleanType = String(widget.type || type || "callout").toLowerCase();
  const cfg = parseWidgetConfig(widget);
  const title = escapeHtml(widget.title || widget.id || "Widget");
  const body = String(widget.body || "").trim();
  const sourceUrl = safeUrl(widget.sourceUrl || widget.url || cfg.url || "");
  const targetId = String(widget.targetId || cfg.targetId || cfg.id || "").trim();

  if (cleanType === "product-preview" && targetId) return entityCardHtml("product", targetId, idx);
  if (cleanType === "service-preview" && targetId) return entityCardHtml("service", targetId, idx);

  if (cleanType === "image-compare") {
    return renderImageCompare(widget, cfg);
  }

  if (cleanType === "image") {
    const caption = cfg.caption || body;
    return `<figure class="bcc-widget bcc-widget-image ${cfg.mode ? `is-${escapeAttr(cfg.mode)}` : ""}">
      <img src="${escapeAttr(sourceUrl)}" alt="${escapeAttr(cfg.alt || widget.title || "")}" loading="lazy" />
      ${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ""}
    </figure>`;
  }

  if (cleanType === "video") {
    const src = safeUrl(youtubeEmbedFromUrl(sourceUrl), { allowRelative: false });
    if (!src) return `<div class="bcc-widget-empty">URL de video no permitida.</div>`;
    return `<section class="bcc-widget bcc-widget-video">
      <div class="bcc-widget-head"><span>${escapeHtml(widgetTypeIcon(cleanType))}</span><strong>${title}</strong></div>
      <div class="bcc-video-frame"><iframe src="${escapeAttr(src)}" loading="lazy" title="${escapeAttr(widget.title || "Video")}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>
      ${body ? `<p class="bcc-widget-note">${escapeHtml(body)}</p>` : ""}
    </section>`;
  }

  if (cleanType === "metrics") {
    return `<section class="bcc-widget bcc-widget-metrics">
      <div class="bcc-widget-head"><span>${escapeHtml(widgetTypeIcon(cleanType))}</span><strong>${title}</strong></div>
      ${renderWidgetMetrics(widget, cfg)}
      ${body ? `<p class="bcc-widget-note">${escapeHtml(body)}</p>` : ""}
    </section>`;
  }

  if (cleanType === "scrollbox") {
    return `<section class="bcc-widget bcc-widget-scrollbox">
      <div class="bcc-widget-head"><span>${escapeHtml(widgetTypeIcon(cleanType))}</span><strong>${title}</strong></div>
      <div class="bcc-scrollbox-body">${widgetTextHtml(body, idx)}</div>
    </section>`;
  }

  if (cleanType === "table") {
    return `<section class="bcc-widget bcc-widget-table">
      <div class="bcc-widget-head"><span>${escapeHtml(widgetTypeIcon(cleanType))}</span><strong>${title}</strong></div>
      ${renderWidgetTable(widget, cfg)}
    </section>`;
  }

  if (cleanType === "chart") {
    return `<section class="bcc-widget bcc-widget-chart-card">
      <div class="bcc-widget-head"><span>${escapeHtml(widgetTypeIcon(cleanType))}</span><strong>${title}</strong></div>
      ${renderWidgetChart(widget, cfg)}
      ${body ? `<p class="bcc-widget-note">${escapeHtml(body)}</p>` : ""}
    </section>`;
  }

  if (cleanType === "demo") {
    return renderWidgetDemo(widget, cfg, idx);
  }

  const variant = String(cfg.variant || "insight").toLowerCase();
  return `<aside class="bcc-widget bcc-widget-callout is-${escapeAttr(variant)}">
    <div class="bcc-widget-head"><span>${escapeHtml(widgetTypeIcon(cleanType))}</span><strong>${title}</strong></div>
    ${body ? `<div class="bcc-widget-body">${widgetTextHtml(body, idx)}</div>` : ""}
  </aside>`;
}


function authorBylineHtml(authors, lang = "es") {
  if (!Array.isArray(authors) || !authors.length) return "";
  const label = lang === "en" ? "Written by" : "Escrito por";
  const hint = lang === "en" ? "View profile" : "Ver perfil";
  const items = authors.map(a => {
    const rawName = a.name || a.id || "Autor";
    const name = escapeHtml(rawName);
    const meta = [a.role, a.affiliation].filter(Boolean).join(" · ");
    const bio = String(a.bio || "").trim();
    const avatarUrl = safeUrl(a.avatar);
    const profileUrl = safeUrl(a.url);
    const hasAvatar = Boolean(avatarUrl);
    const avatar = hasAvatar
      ? `<img class="post-author-avatar" src="${escapeAttr(avatarUrl)}" alt="" loading="lazy" />`
      : "";
    const body = `
      ${avatar}
      <span class="post-author-text">
        <span class="post-author-name">${name}</span>
        ${meta ? `<span class="post-author-meta">${escapeHtml(meta)}</span>` : ""}
        ${bio ? `<span class="post-author-bio">${escapeHtml(bio)}</span>` : ""}
        ${profileUrl ? `<span class="post-author-link-hint">${escapeHtml(hint)} →</span>` : ""}
      </span>
    `.trim();
    const cls = `post-author${hasAvatar ? " has-avatar" : " no-avatar"}`;
    return profileUrl
      ? `<a class="${cls}" href="${escapeAttr(profileUrl)}" target="_blank" rel="noopener noreferrer">${body}</a>`
      : `<span class="${cls}">${body}</span>`;
  }).join("");
  return `
    <section class="post-authors" aria-label="${escapeAttr(label)}">
      <div class="post-authors-card">
        <div class="post-authors-head">
          <div class="post-authors-label">${escapeHtml(label)}</div>
          <div class="post-authors-mark" aria-hidden="true">∴</div>
        </div>
        <div class="post-authors-list">${items}</div>
      </div>
    </section>
  `.trim();
}

function authorArticleMeta(authors) {
  if (!Array.isArray(authors) || !authors.length) return "";
  return authors.map(a => {
    const value = a.url || a.name || a.id || "";
    return value ? `<meta property="article:author" content="${escapeAttr(value)}" />` : "";
  }).filter(Boolean).join("\n  ");
}

function postTagsBlockHtml(tags, lang = "es") {
  const clean = (Array.isArray(tags) ? tags : []).filter(Boolean).slice(0, 10);
  if (!clean.length) return "";
  const label = lang === "en" ? "Tags" : "Etiquetas";
  return `
    <section class="post-article-tags" aria-label="${escapeAttr(label)}">
      <div class="post-article-tags-label">${escapeHtml(label)}</div>
      <div class="post-article-tags-list">
        ${clean.map(t => `<span class="post-article-tag">${escapeHtml(t)}</span>`).join("")}
      </div>
    </section>
  `.trim();
}

function tagOverlapScore(aTags, bTags) {
  const a = new Set((Array.isArray(aTags) ? aTags : []).map(x => String(x).toLowerCase().trim()).filter(Boolean));
  const b = new Set((Array.isArray(bTags) ? bTags : []).map(x => String(x).toLowerCase().trim()).filter(Boolean));
  let score = 0;
  for (const t of a) if (b.has(t)) score += 2;
  return score;
}

function recommendedPostsHtml(currentPost, idx, lang = "es") {
  const posts = Array.isArray(idx.posts) ? idx.posts : [];
  const sameLang = posts.filter(p => p && p.id && p.id !== currentPost.id && postLang(p) === lang);
  if (!sameLang.length) return "";

  const currentTags = [currentPost.section, ...(Array.isArray(currentPost.tags) ? currentPost.tags : [])].filter(Boolean);
  const scored = sameLang.map(p => {
    const tags = [p.section, ...(Array.isArray(p.tags) ? p.tags : [])].filter(Boolean);
    let score = tagOverlapScore(currentTags, tags);
    if (p.section && currentPost.section && p.section === currentPost.section) score += 3;
    return { post: p, score };
  }).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return String(b.post.date || "").localeCompare(String(a.post.date || ""));
  }).slice(0, 3);

  if (!scored.length) return "";
  const title = lang === "en" ? "Recommended reading" : "Lecturas recomendadas";
  const hint = lang === "en" ? "Continue in the BCC Blog" : "Sigue leyendo en el BCC Blog";
  const readLabel = lang === "en" ? "Read" : "Leer";

  return `
    <section class="post-related" aria-label="${escapeAttr(title)}">
      <div class="post-related-head">
        <div>
          <div class="post-related-kicker">${escapeHtml(hint)}</div>
          <h2 class="post-related-title">${escapeHtml(title)}</h2>
        </div>
      </div>
      <div class="post-related-list">
        ${scored.map(({ post }) => {
          const url = postOutputUrl(post);
          const date = formatDateDisplay(post.date, lang === "en" ? "en-US" : "es-ES");
          const excerpt = String(post.excerpt || "").trim();
          return `
            <a class="post-related-card" href="${escapeAttr(url)}">
              <span class="post-related-meta">${escapeHtml([post.section, date].filter(Boolean).join(" · "))}</span>
              <span class="post-related-card-title">${escapeHtml(post.title || post.id)}</span>
              ${excerpt ? `<span class="post-related-excerpt">${escapeHtml(excerpt)}</span>` : ""}
              <span class="post-related-link">${escapeHtml(readLabel)} →</span>
            </a>
          `.trim();
        }).join("")}
      </div>
    </section>
  `.trim();
}

function postLang(post) {
  return String(post?.lang || "es").toLowerCase().startsWith("en") ? "en" : "es";
}

function postOutputPath(post) {
  const lang = postLang(post);
  const outDir = lang === "en" ? BLOG_EN_DIR : BLOG_DIR;
  return path.join(outDir, `${requireSafeId(post?.id || "")}.html`);
}

function postOutputUrl(post) {
  const lang = postLang(post);
  const id = requireSafeId(post?.id || "");
  return lang === "en" ? `/en/blog/${id}.html` : `/blog/${id}.html`;
}

function buildTranslationMap(posts) {
  const translationMap = new Map();
  for (const post of posts) {
    if (!post?.id) continue;
    const key = String(post.translationId || "").trim();
    if (!key) continue;
    const lang = postLang(post);
    const entry = translationMap.get(key) || {};
    entry[lang] = post.id;
    translationMap.set(key, entry);
  }
  return translationMap;
}


function postHeroTitleHtml(post) {
  const title = escapeHtml(post?.title || "");
  const excerpt = String(post?.excerpt || "").trim();
  if (!excerpt) return title;
  return `
    <button class="post-title-toggle" type="button" data-post-title-toggle aria-expanded="false" aria-controls="postDek">
      <span>${title}</span>
      <span class="post-title-cue" aria-hidden="true">⌄</span>
    </button>
  `.trim();
}

function postDekHtml(post) {
  const excerpt = String(post?.excerpt || "").trim();
  if (!excerpt) return "";
  return `
    <div class="post-dek-wrap" id="postDek" data-open="false">
      <p class="post-dek">${escapeHtml(excerpt)}</p>
    </div>
  `.trim();
}

function renderPostHtml(post, idx, options = {}) {
  const { includeResources = true } = options;
  const posts = Array.isArray(idx.posts) ? idx.posts : [];
  const lang = postLang(post);
  const tpl = getTemplate(lang);
  const translationMap = buildTranslationMap(posts);

  const translationKey = String(post.translationId || "").trim();
  const pair = translationKey ? translationMap.get(translationKey) : null;
  const altEsId = pair?.es;
  const altEnId = pair?.en;
  const hrefEs = altEsId ? `/blog/${altEsId}.html` : "";
  const hrefEn = altEnId ? `/en/blog/${altEnId}.html` : "";
  const langTargets = (altEsId && altEnId) ? "es,en" : lang;
  const langSwitchHref = lang === "en" ? (hrefEs || "/blog.html") : (hrefEn || "/en/blog.html");

  const postId = requireSafeId(post.id || "");
  const mdPath = path.join(POSTS_DIR, `${postId}.md`);
  const raw = typeof options.rawBody === "string"
    ? options.rawBody
    : (fs.existsSync(mdPath) ? fs.readFileSync(mdPath, "utf-8") : "");
  const bodyHtml = mdToHtml(raw, idx);
  const text = stripMarkdown(raw);

  const descSource = String(post.excerpt || text || "").trim();
  const description = descSource.length > 170 ? descSource.slice(0, 167).trim() + "..." : descSource;

  const read = estimateReadTimeFromText(text || raw);
  const displayDate = formatDateDisplay(post.date, lang === "en" ? "en-US" : "es-ES");

  const tagSet = [];
  if (post.section) tagSet.push(post.section);
  if (Array.isArray(post.tags)) tagSet.push(...post.tags);
  const tags = tagSet.filter(Boolean).slice(0, 8);
  const tagsHtml = tags.length
    ? tags.map(t => `<span class="tagchip">${escapeHtml(t)}</span>`).join("")
    : "";

  const coverUrl = safeUrl(post.cover);
  const coverHtml = coverUrl
    ? `<div class="modal-cover"><img class="modal-cover-img" src="${escapeAttr(coverUrl)}" alt="${escapeAttr(post.title || "")}" loading="lazy" /></div>`
    : "";

  const canonical = postOutputUrl(post);

  const dateObj = new Date(post.date);
  const dateIso = Number.isNaN(dateObj.getTime()) ? "" : dateObj.toISOString();

  const authorIds = Array.isArray(post.authorIds) ? post.authorIds : Array.isArray(post.authors) ? post.authors : [];
  const authors = authorIds.map(id => itemById(idx.authors, id)).filter(Boolean);
  const authorJson = authors.length
    ? authors.map(a => cleanJsonLd({
        "@type": "Person",
        name: a.name || a.id,
        url: a.url || undefined,
        affiliation: a.affiliation ? { "@type": "Organization", name: a.affiliation } : undefined
      }))
    : undefined;

  const jsonLd = JSON.stringify(cleanJsonLd({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title || "",
    datePublished: dateIso || undefined,
    image: coverUrl || undefined,
    author: authorJson,
    mainEntityOfPage: canonical
  })).replace(/<\//g, "<\\/");

  const data = {
    GEN_MARKER: BLOG_GEN_MARKER,
    LANG_TARGETS: langTargets,
    LANG_SWITCH_HREF: langSwitchHref,
    HREFLANG_ES: hrefEs ? `<link rel="alternate" hreflang="es" href="${hrefEs}" />` : "",
    HREFLANG_EN: hrefEn ? `<link rel="alternate" hreflang="en" href="${hrefEn}" />` : "",
    TITLE: escapeHtml(`${post.title || ""} | BCC Blog`),
    DESCRIPTION: escapeHtml(description || (lang === "en" ? "BCC Blog article." : "Entrada de BCC Blog.")),
    CANONICAL: canonical,
    OG_TITLE: escapeHtml(post.title || ""),
    OG_DESC: escapeHtml(description || ""),
    OG_URL: canonical,
    OG_IMAGE_META: coverUrl ? `<meta property="og:image" content="${escapeAttr(coverUrl)}" />` : "",
    ARTICLE_META: [dateIso ? `<meta property="article:published_time" content="${escapeAttr(dateIso)}" />` : "", authorArticleMeta(authors)].filter(Boolean).join("\n  "),
    JSON_LD: jsonLd,
    POST_TITLE: escapeHtml(post.title || ""),
    POST_HERO_TITLE: postHeroTitleHtml(post),
    POST_DEK: postDekHtml(post),
    POST_DATE: escapeHtml(displayDate || ""),
    POST_READTIME: escapeHtml(`${read.minutes} min`),
    POST_AUTHORS: authorBylineHtml(authors, lang),
    POST_TAGS: tagsHtml,
    POST_TAGS_BLOCK: postTagsBlockHtml(tags, lang),
    POST_RECOMMENDED_POSTS: recommendedPostsHtml(post, idx, lang),
    POST_COVER: coverHtml,
    POST_BODY: bodyHtml,
    POST_RESOURCES_JSON: serializeResourcesForPost(post, idx, includeResources)
  };

  return fillTemplate(tpl, data);
}

function templateVersion() {
  const parts = [];
  for (const [lang, file] of [["es", BLOG_TEMPLATE_ES], ["en", BLOG_TEMPLATE_EN]]) {
    if (!fs.existsSync(file)) {
      parts.push(`${lang}:missing`);
      continue;
    }
    const st = fs.statSync(file);
    parts.push(`${lang}:${Math.round(st.mtimeMs)}`);
  }
  return parts.join("|");
}

function auditPosts(options = {}) {
  ensureDirs();
  const idx = readIndex();
  const posts = Array.isArray(idx.posts) ? idx.posts : [];
  const includeResources = options.includeResources !== false;

  const items = posts.map(post => {
    try {
      const outPath = postOutputPath(post);
      const output = path.relative(REPO_ROOT, outPath).replace(/\\/g, "/");
      const html = renderPostHtml(post, idx, { includeResources });
      if (!fs.existsSync(outPath)) {
        return { id: post.id, title: post.title, lang: postLang(post), path: postOutputUrl(post), output, status: "missing", reason: "HTML generado no existe" };
      }
      const current = fs.readFileSync(outPath, "utf-8");
      if (!current.includes(BLOG_GEN_MARKER)) {
        return { id: post.id, title: post.title, lang: postLang(post), path: postOutputUrl(post), output, status: "stale", reason: "HTML existe, pero no tiene marcador de generación" };
      }
      if (current !== html) {
        return { id: post.id, title: post.title, lang: postLang(post), path: postOutputUrl(post), output, status: "stale", reason: "Difiere de la plantilla/render actual" };
      }
      return { id: post.id, title: post.title, lang: postLang(post), path: postOutputUrl(post), output, status: "current", reason: "HTML actualizado" };
    } catch (e) {
      return { id: post.id, title: post.title, lang: postLang(post), path: "", output: "", status: "error", reason: String(e.message || e) };
    }
  });

  return withTemplateTotals({
    ok: true,
    dryRun: true,
    includeResources,
    templateVersion: templateVersion(),
    generatedAt: new Date().toISOString(),
    message: "Auditoría de plantillas completada",
    items
  });
}

function withTemplateTotals(result) {
  const items = Array.isArray(result.items) ? result.items : [];
  const lower = s => String(s || "").toLowerCase();
  result.totals = {
    total: items.length,
    current: items.filter(x => ["current", "ok", "clean"].includes(lower(x.status))).length,
    stale: items.filter(x => ["stale", "outdated", "changed"].includes(lower(x.status))).length,
    missing: items.filter(x => ["missing", "not_found"].includes(lower(x.status))).length,
    updated: items.filter(x => ["updated", "written"].includes(lower(x.status))).length,
    skipped: items.filter(x => ["skipped"].includes(lower(x.status))).length,
    error: items.filter(x => ["error"].includes(lower(x.status))).length
  };
  return result;
}

function backupFile(file) {
  if (!fs.existsSync(file)) return "";
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const backup = `${file}.bak.${stamp}`;
  fs.copyFileSync(file, backup);
  return backup;
}

function selectPostsForRegeneration(idx, payload = {}) {
  const scope = String(payload.scope || payload.mode || "all").toLowerCase();
  const posts = Array.isArray(idx.posts) ? idx.posts : [];

  if (scope === "current") {
    const id = String(payload.id || "").trim();
    return posts.filter(p => p.id === id);
  }

  if (scope === "stale" || scope === "changed" || scope === "outdated") {
    const audit = auditPosts({ includeResources: payload.includeResources !== false });
    const staleIds = new Set((audit.items || [])
      .filter(x => ["stale", "missing", "error"].includes(String(x.status || "").toLowerCase()))
      .map(x => x.id));
    return posts.filter(p => staleIds.has(p.id));
  }

  return posts;
}

function generateBlogPages(options = {}) {
  ensureDirs();
  const idx = readIndex();
  const posts = selectPostsForRegeneration(idx, options);
  const allPosts = Array.isArray(idx.posts) ? idx.posts : [];
  const dryRun = Boolean(options.dryRun);
  const createBackups = Boolean(options.createBackups);
  const includeResources = options.includeResources !== false;
  const cleanOrphans = options.cleanOrphans === true || String(options.scope || options.mode || "").toLowerCase() === "all";

  const keepEs = new Set();
  const keepEn = new Set();
  for (const post of allPosts) {
    try {
      const outPath = postOutputPath(post);
      if (postLang(post) === "en") keepEn.add(outPath);
      else keepEs.add(outPath);
    } catch {
      // Invalid stored post IDs are reported during the render loop.
    }
  }

  const items = [];
  for (const post of posts) {
    if (!post?.id) continue;
    try {
      const outPath = postOutputPath(post);
      const output = path.relative(REPO_ROOT, outPath).replace(/\\/g, "/");
      const html = renderPostHtml(post, idx, { includeResources });
      const exists = fs.existsSync(outPath);
      const current = exists ? fs.readFileSync(outPath, "utf-8") : "";
      const changed = !exists || current !== html;

      if (dryRun) {
        items.push({
          id: post.id,
          title: post.title,
          lang: postLang(post),
          path: postOutputUrl(post),
          output,
          status: changed ? (exists ? "stale" : "missing") : "current",
          reason: changed ? "Dry-run: se escribiría una versión actualizada" : "Dry-run: no requiere cambios"
        });
        continue;
      }

      if (changed) {
        if (createBackups && exists) backupFile(outPath);
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, html, "utf-8");
        items.push({ id: post.id, title: post.title, lang: postLang(post), path: postOutputUrl(post), output, status: "updated", reason: exists ? "HTML reescrito" : "HTML creado" });
      } else {
        items.push({ id: post.id, title: post.title, lang: postLang(post), path: postOutputUrl(post), output, status: "skipped", reason: "Ya estaba actualizado" });
      }
    } catch (e) {
      items.push({ id: post.id, title: post.title, lang: postLang(post), path: "", output: "", status: "error", reason: String(e.message || e) });
    }
  }

  if (!dryRun && cleanOrphans) {
    const removed = [...cleanGeneratedDir(BLOG_DIR, keepEs), ...cleanGeneratedDir(BLOG_EN_DIR, keepEn)];
    for (const full of removed) {
      items.push({
        id: path.basename(full),
        title: path.basename(full),
        lang: full.includes(`${path.sep}en${path.sep}`) ? "en" : "es",
        path: path.relative(REPO_ROOT, full).replace(/\\/g, "/"),
        output: path.relative(REPO_ROOT, full).replace(/\\/g, "/"),
        status: "updated",
        reason: "HTML generado obsoleto eliminado"
      });
    }
  }

  return withTemplateTotals({
    ok: true,
    dryRun,
    includeResources,
    templateVersion: templateVersion(),
    generatedAt: new Date().toISOString(),
    message: dryRun ? "Dry-run de regeneración completado" : "Regeneración de plantillas completada",
    items
  });
}


function renderPostFromPayload(payload = {}) {
  ensureDirs();
  const idx = readIndex();
  const id = requireSafeId(payload.id || payload.draft?.id || "");
  if (!id) throw new Error("missing id");

  const basePost = (Array.isArray(idx.posts) ? idx.posts : []).find(p => p.id === id);
  if (!basePost && !payload.draft) throw new Error(`Post not found: ${id}`);

  const draft = payload.draft && typeof payload.draft === "object" ? payload.draft : null;
  const post = {
    ...(basePost || {}),
    ...(draft || {}),
    id: requireSafeId(draft?.id || id)
  };

  const tempIdx = {
    ...idx,
    posts: Array.isArray(idx.posts) ? [...idx.posts] : []
  };

  const i = tempIdx.posts.findIndex(p => p.id === post.id);
  if (i >= 0) tempIdx.posts[i] = post;
  else tempIdx.posts.unshift(post);

  const html = renderPostHtml(post, tempIdx, {
    includeResources: payload.includeResources !== false,
    rawBody: typeof draft?.body === "string" ? draft.body : undefined
  });

  return {
    ok: true,
    id: post.id,
    title: post.title || "",
    lang: postLang(post),
    path: postOutputUrl(post),
    output: path.relative(REPO_ROOT, postOutputPath(post)).replace(/\\/g, "/"),
    bytes: Buffer.byteLength(html, "utf-8"),
    includeResources: payload.includeResources !== false,
    renderedAt: new Date().toISOString(),
    html
  };
}

function upsertCollectionItem(collectionName, req, res, requiredField = "name", defaultValues = {}) {
  try {
    const payload = req.body || {};
    if (requiredField && !String(payload[requiredField] || "").trim()) {
      return res.status(400).json({ ok: false, error: `${requiredField} requerido` });
    }

    const idSource = payload.id || payload.name || payload.title || collectionName.slice(0, -1);
    const id = payload.id && String(payload.id).trim()
      ? requireSafeId(payload.id)
      : requireSafeId("", idSource);
    if (!id) return res.status(400).json({ ok: false, error: "id inválido" });

    const idx = readIndex();
    const existing = idx[collectionName].find(x => x.id === id) || {};
    const item = {
      ...defaultValues,
      ...existing,
      ...payload,
      id,
      tags: Array.isArray(payload.tags) ? payload.tags : Array.isArray(existing.tags) ? existing.tags : []
    };

    const i = idx[collectionName].findIndex(x => x.id === id);
    if (i >= 0) idx[collectionName][i] = item;
    else idx[collectionName].unshift(item);

    writeIndex(idx);
    res.json({ ok: true, id });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}

function deleteCollectionItem(collectionName, req, res) {
  try {
    const id = requireSafeId(req.body?.id || "");
    if (!id) return res.status(400).json({ ok: false, error: "missing id" });
    const idx = readIndex();
    idx[collectionName] = idx[collectionName].filter(x => x.id !== id);
    writeIndex(idx);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}

// ---------- Uploads (images) ----------
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const original = file.originalname || "image";
    const ext = path.extname(original).toLowerCase();
    const base = normSlug(path.basename(original, ext)) || "image";
    const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
    cb(null, `${stamp}-${base}${ext}`);
  }
});

function isAllowedImage(file) {
  const okMime = new Set([
    "image/png", "image/jpeg", "image/webp", "image/gif"
  ]);
  const ext = path.extname(file.originalname || "").toLowerCase();
  const okExt = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
  return okMime.has(file.mimetype) && okExt.has(ext);
}

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, isAllowedImage(file))
});

app.post("/api/uploads/image", upload.single("file"), (req, res) => {
  try {
    ensureDirs();
    if (!req.file) return res.status(400).json({ ok: false, error: "No file received" });
    const url = `/static/uploads/${req.file.filename}`;
    res.json({ ok: true, url, filename: req.file.filename });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.get("/api/uploads/list", (_req, res) => {
  try {
    ensureDirs();
    const files = fs.readdirSync(UPLOAD_DIR)
      .filter(f => !f.startsWith("."))
      .sort()
      .reverse()
      .slice(0, 200);
    res.json({ ok: true, files: files.map(f => ({ url: `/static/uploads/${f}`, name: f })) });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// ---------- API ----------
app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.get("/api/index", (_req, res) => {
  try {
    const idx = readIndex();
    res.json({ ok: true, index: idx });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.get("/api/posts/body", (req, res) => {
  try {
    const id = requireSafeId(req.query.id || "");
    if (!id) return res.status(400).json({ ok: false, error: "missing id" });

    const mdPath = path.join(POSTS_DIR, `${id}.md`);
    const body = fs.existsSync(mdPath) ? fs.readFileSync(mdPath, "utf-8") : "";
    res.json({ ok: true, body });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.post("/api/posts/upsert", (req, res) => {
  try {
    const {
      id: idIn,
      title,
      date,
      section,
      lang = "es",
      translationId = "",
      tags = [],
      authorIds = [],
      authors = [],
      referenceIds = [],
      references = [],
      resourceIds = [],
      resources = [],
      excerpt = "",
      cover = "",
      body = ""
    } = req.body || {};

    if (!title || !date || !section) {
      return res.status(400).json({ ok: false, error: "title, date, section requeridos" });
    }

    const id = idIn && String(idIn).trim()
      ? requireSafeId(idIn)
      : requireSafeId("", `${date}-${normSlug(title)}`);

    ensureDirs();
    fs.writeFileSync(path.join(POSTS_DIR, `${id}.md`), body, "utf-8");

    const idx = readIndex();
    const previous = idx.posts.find(p => p.id === id) || {};
    const post = {
      ...previous,
      id,
      title,
      date,
      section,
      lang,
      translationId,
      tags: Array.isArray(tags) ? tags : [],
      authorIds: Array.isArray(authorIds) ? authorIds : Array.isArray(authors) ? authors : [],
      referenceIds: Array.isArray(referenceIds) ? referenceIds : Array.isArray(references) ? references : [],
      resourceIds: Array.isArray(resourceIds) ? resourceIds : Array.isArray(resources) ? resources : [],
      excerpt,
      cover,
      bodyUrl: `/content/posts/${id}.md`
    };

    const i = idx.posts.findIndex(p => p.id === id);

    const incomingAuthorIds = Array.isArray(post.authorIds) ? post.authorIds.filter(Boolean) : [];
    const groupKey = String(translationId || "").trim();
    const groupBefore = groupKey
      ? idx.posts.filter(p => p && String(p.translationId || "").trim() === groupKey)
      : [];
    const groupHadAuthors = groupBefore.some(p => {
      const ids = Array.isArray(p.authorIds) ? p.authorIds : Array.isArray(p.authors) ? p.authors : [];
      return ids.filter(Boolean).length > 0;
    });

    if (i >= 0) idx.posts[i] = post;
    else idx.posts.unshift(post);

    // If this is the first time authorship is assigned to a translation group,
    // apply it to sibling translations by default. Individual translations can
    // still be edited later without being overwritten.
    if (groupKey && incomingAuthorIds.length && !groupHadAuthors) {
      idx.posts = idx.posts.map(p => {
        if (!p || String(p.translationId || "").trim() !== groupKey) return p;
        const ids = Array.isArray(p.authorIds) ? p.authorIds : Array.isArray(p.authors) ? p.authors : [];
        if (ids.filter(Boolean).length) return p;
        return { ...p, authorIds: incomingAuthorIds };
      });
    }

    writeIndex(idx);
    res.json({ ok: true, id });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.post("/api/posts/delete", (req, res) => {
  try {
    const id = requireSafeId(req.body?.id || "");
    if (!id) return res.status(400).json({ ok: false, error: "missing id" });

    const idx = readIndex();
    idx.posts = idx.posts.filter(p => p.id !== id);
    writeIndex(idx);

    const mdPath = path.join(POSTS_DIR, `${id}.md`);
    if (fs.existsSync(mdPath)) fs.unlinkSync(mdPath);

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.post("/api/posts/template-audit", (req, res) => {
  try {
    res.json(auditPosts(req.body || {}));
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.post("/api/posts/render-template", (req, res) => {
  try {
    res.json(renderPostFromPayload(req.body || {}));
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.post("/api/posts/regenerate", (req, res) => {
  try {
    const payload = req.body || {};
    const result = generateBlogPages({
      scope: payload.scope || payload.mode || "all",
      id: payload.id,
      dryRun: Boolean(payload.dryRun),
      createBackups: Boolean(payload.createBackups),
      includeResources: payload.includeResources !== false,
      cleanOrphans: String(payload.scope || payload.mode || "").toLowerCase() === "all"
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.post("/api/products/upsert", (req, res) => {
  try {
    const { id: idIn, name, category = "", status = "Activo", summary = "", pageUrl = "", tags = [] } = req.body || {};
    if (!name) return res.status(400).json({ ok: false, error: "name requerido" });

    const id = idIn && String(idIn).trim() ? requireSafeId(idIn) : requireSafeId("", name);

    const idx = readIndex();
    const item = { id, name, category, status, summary, pageUrl: safeUrl(pageUrl), tags: Array.isArray(tags) ? tags : [] };

    const i = idx.products.findIndex(x => x.id === id);
    if (i >= 0) idx.products[i] = item;
    else idx.products.unshift(item);

    writeIndex(idx);
    res.json({ ok: true, id });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.post("/api/products/delete", (req, res) => {
  try {
    const id = requireSafeId(req.body?.id || "");
    if (!id) return res.status(400).json({ ok: false, error: "missing id" });

    const idx = readIndex();
    idx.products = idx.products.filter(x => x.id !== id);
    writeIndex(idx);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.post("/api/services/upsert", (req, res) => {
  try {
    const {
      id: idIn,
      name,
      category = "",
      summary = "",
      capabilities = "",
      deliverables = "",
      requirements = "",
      pageUrl = "",
      tags = []
    } = req.body || {};

    if (!name) return res.status(400).json({ ok: false, error: "name requerido" });

    const id = idIn && String(idIn).trim() ? requireSafeId(idIn) : requireSafeId("", name);

    const idx = readIndex();
    const item = {
      id, name, category, summary,
      capabilities, deliverables, requirements,
      pageUrl: safeUrl(pageUrl),
      tags: Array.isArray(tags) ? tags : []
    };

    const i = idx.services.findIndex(x => x.id === id);
    if (i >= 0) idx.services[i] = item;
    else idx.services.unshift(item);

    writeIndex(idx);
    res.json({ ok: true, id });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.post("/api/services/delete", (req, res) => {
  try {
    const id = requireSafeId(req.body?.id || "");
    if (!id) return res.status(400).json({ ok: false, error: "missing id" });

    const idx = readIndex();
    idx.services = idx.services.filter(x => x.id !== id);
    writeIndex(idx);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.post("/api/authors/upsert", (req, res) => upsertCollectionItem("authors", req, res, "name", {
  role: "", affiliation: "", avatar: "", url: "", email: "", bio: "", tags: []
}));
app.post("/api/authors/delete", (req, res) => deleteCollectionItem("authors", req, res));

app.post("/api/references/upsert", (req, res) => upsertCollectionItem("references", req, res, "title", {
  type: "article", year: "", authors: "", venue: "", doi: "", url: "", citation: "", notes: "", tags: []
}));
app.post("/api/references/delete", (req, res) => deleteCollectionItem("references", req, res));

app.post("/api/resources/upsert", (req, res) => upsertCollectionItem("resources", req, res, "title", {
  type: "other", creator: "", year: "", url: "", relation: "", note: "", tags: []
}));
app.post("/api/resources/delete", (req, res) => deleteCollectionItem("resources", req, res));

app.post("/api/widgets/upsert", (req, res) => upsertCollectionItem("widgets", req, res, "title", {
  type: "callout", sourceUrl: "", targetId: "", body: "", config: "", tags: []
}));
app.post("/api/widgets/delete", (req, res) => deleteCollectionItem("widgets", req, res));

app.get("/api/git/status", (_req, res) => {
  try {
    const out = run("git", ["status", "--porcelain"]);
    res.json({ ok: true, dirty: out.length > 0, lines: out ? out.split("\n") : [] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.post("/api/git/publish", (req, res) => {
  try {
    const message = String(req.body?.message || "Update content").trim() || "Update content";

    generateBlogPages({ scope: "all", dryRun: false, createBackups: false, includeResources: true, cleanOrphans: true });

    // OJO: -A para que incluya uploads, deletes, y nuevos archivos.
    run("git", ["add", "-A"]);

    try {
      run("git", ["commit", "-m", message]);
    } catch (e) {
      const m = String(e.message || "");
      if (!m.toLowerCase().includes("nothing to commit")) throw e;
    }

    run("git", ["push"]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

const PORT = Number(process.env.PORT || process.env.BCC_CMS_PORT || 3777);
const HOST = process.env.BCC_CMS_HOST || "127.0.0.1";
app.listen(PORT, HOST, () => {
  ensureDirs();
  console.log(`Admin local protegido: http://${HOST}:${PORT}`);
});
