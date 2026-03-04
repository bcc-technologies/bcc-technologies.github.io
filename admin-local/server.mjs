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

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use("/", express.static(path.join(__dirname, "public")));

function ensureDirs() {
  if (!fs.existsSync(CONTENT_DIR)) fs.mkdirSync(CONTENT_DIR, { recursive: true });
  if (!fs.existsSync(POSTS_DIR)) fs.mkdirSync(POSTS_DIR, { recursive: true });
  if (!fs.existsSync(STATIC_DIR)) fs.mkdirSync(STATIC_DIR, { recursive: true });
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  if (!fs.existsSync(BLOG_DIR)) fs.mkdirSync(BLOG_DIR, { recursive: true });
  if (!fs.existsSync(BLOG_EN_DIR)) fs.mkdirSync(BLOG_EN_DIR, { recursive: true });

  if (!fs.existsSync(INDEX_PATH)) {
    fs.writeFileSync(
      INDEX_PATH,
      JSON.stringify({ posts: [], products: [], services: [] }, null, 2),
      "utf-8"
    );
  }
}

function readIndex() {
  ensureDirs();
  return JSON.parse(fs.readFileSync(INDEX_PATH, "utf-8"));
}

function writeIndex(data) {
  ensureDirs();
  fs.writeFileSync(INDEX_PATH, JSON.stringify(data, null, 2), "utf-8");
}

function normSlug(s) {
  return String(s || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
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

function stripMarkdown(md) {
  let s = String(md || "");
  s = s.replace(/```[\s\S]*?```/g, " ");
  s = s.replace(/!\[[^\]]*\]\([^)]+\)/g, " ");
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  s = s.replace(/`([^`]+)`/g, "$1");
  s = s.replace(/[>#*_~]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function mdInline(s) {
  s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, url) => {
    const u = String(url || "").trim().replace(/^<|>$/g, "");
    const caption = String(alt || "").trim();
    return `
      <figure class="md-figure">
        <img src="${escapeHtml(u)}" alt="${escapeHtml(caption)}" loading="lazy" />
        ${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ``}
      </figure>
    `.trim();
  });

  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, text, url) => {
    const u = String(url || "").trim().replace(/^<|>$/g, "");
    return `<a href="${escapeHtml(u)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`;
  });

  s = s.replace(/`([^`]+)`/g, (_m, code) => `<code>${escapeHtml(code)}</code>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, (_m, b) => `<strong>${escapeHtml(b)}</strong>`);
  s = s.replace(/\*([^*]+)\*/g, (_m, i) => `<em>${escapeHtml(i)}</em>`);

  return s;
}

function mdToHtml(md) {
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

    if (/^(-{3,}|_{3,}|\*{3,})$/.test(t)) {
      flushList();
      html += "<hr />";
      continue;
    }

    const h = t.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flushList();
      const level = h[1].length;
      html += `<h${level}>${mdInline(h[2])}</h${level}>`;
      continue;
    }

    if (t.startsWith(">")) {
      flushList();
      html += `<blockquote>${mdInline(t.replace(/^>\s?/, ""))}</blockquote>`;
      continue;
    }

    const ul = t.match(/^[-*+]\s+(.*)$/);
    if (ul) {
      if (!inUl) { flushList(); html += "<ul>"; inUl = true; }
      html += `<li>${mdInline(ul[1])}</li>`;
      continue;
    }

    const ol = t.match(/^\d+\.\s+(.*)$/);
    if (ol) {
      if (!inOl) { flushList(); html += "<ol>"; inOl = true; }
      html += `<li>${mdInline(ol[1])}</li>`;
      continue;
    }

    flushList();
    html += `<p>${mdInline(t)}</p>`;
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
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".html"));
  for (const f of files) {
    const full = path.join(dir, f);
    if (keepSet.has(full)) continue;
    try {
      const content = fs.readFileSync(full, "utf-8");
      if (content.includes(BLOG_GEN_MARKER)) fs.unlinkSync(full);
    } catch {
      // ignore
    }
  }
}

function generateBlogPages() {
  ensureDirs();
  const idx = readIndex();
  const posts = Array.isArray(idx.posts) ? idx.posts : [];

  const translationMap = new Map();
  for (const post of posts) {
    if (!post?.id) continue;
    const key = String(post.translationId || "").trim();
    if (!key) continue;
    const lang = String(post.lang || "es").toLowerCase().startsWith("en") ? "en" : "es";
    const entry = translationMap.get(key) || {};
    entry[lang] = post.id;
    translationMap.set(key, entry);
  }

  const keepEs = new Set();
  const keepEn = new Set();

  for (const post of posts) {
    if (!post?.id) continue;
    const lang = String(post.lang || "es").toLowerCase().startsWith("en") ? "en" : "es";
    const tpl = getTemplate(lang);

    const translationKey = String(post.translationId || "").trim();
    const pair = translationKey ? translationMap.get(translationKey) : null;
    const altEsId = pair?.es;
    const altEnId = pair?.en;
    const hrefEs = altEsId ? `/blog/${altEsId}.html` : "";
    const hrefEn = altEnId ? `/en/blog/${altEnId}.html` : "";
    const langTargets = (altEsId && altEnId) ? "es,en" : lang;
    const langSwitchHref = lang === "en" ? (hrefEs || "/blog.html") : (hrefEn || "/en/blog.html");

    const mdPath = path.join(POSTS_DIR, `${post.id}.md`);
    const raw = fs.existsSync(mdPath) ? fs.readFileSync(mdPath, "utf-8") : "";
    const bodyHtml = mdToHtml(raw);
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

    const coverUrl = String(post.cover || "").trim();
    const coverHtml = coverUrl
      ? `<div class="modal-cover"><img class="modal-cover-img" src="${escapeHtml(coverUrl)}" alt="${escapeHtml(post.title || "")}" loading="lazy" /></div>`
      : "";

    const canonical = lang === "en"
      ? `/en/blog/${post.id}.html`
      : `/blog/${post.id}.html`;

    const dateObj = new Date(post.date);
    const dateIso = Number.isNaN(dateObj.getTime()) ? "" : dateObj.toISOString();

    const jsonLd = JSON.stringify(cleanJsonLd({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: post.title || "",
      datePublished: dateIso || undefined,
      image: coverUrl || undefined,
      mainEntityOfPage: canonical
    })).replace(/<\//g, "<\\/");

    const data = {
      GEN_MARKER: BLOG_GEN_MARKER,
      LANG_TARGETS: langTargets,
      LANG_SWITCH_HREF: langSwitchHref,
      HREFLANG_ES: hrefEs ? `<link rel="alternate" hreflang="es" href="${hrefEs}" />` : "",
      HREFLANG_EN: hrefEn ? `<link rel="alternate" hreflang="en" href="${hrefEn}" />` : "",
      TITLE: escapeHtml(`${post.title || ""} | BCC Journal`),
      DESCRIPTION: escapeHtml(description || (lang === "en" ? "BCC Journal article." : "Entrada de BCC Journal.")),
      CANONICAL: canonical,
      OG_TITLE: escapeHtml(post.title || ""),
      OG_DESC: escapeHtml(description || ""),
      OG_URL: canonical,
      OG_IMAGE_META: coverUrl ? `<meta property="og:image" content="${escapeHtml(coverUrl)}" />` : "",
      ARTICLE_META: dateIso ? `<meta property="article:published_time" content="${escapeHtml(dateIso)}" />` : "",
      JSON_LD: jsonLd,
      POST_TITLE: escapeHtml(post.title || ""),
      POST_DATE: escapeHtml(displayDate || ""),
      POST_READTIME: escapeHtml(`${read.minutes} min`),
      POST_TAGS: tagsHtml,
      POST_COVER: coverHtml,
      POST_BODY: bodyHtml
    };

    const html = fillTemplate(tpl, data);
    const outDir = lang === "en" ? BLOG_EN_DIR : BLOG_DIR;
    const outPath = path.join(outDir, `${post.id}.html`);
    fs.writeFileSync(outPath, html, "utf-8");

    if (lang === "en") keepEn.add(outPath);
    else keepEs.add(outPath);
  }

  cleanGeneratedDir(BLOG_DIR, keepEs);
  cleanGeneratedDir(BLOG_EN_DIR, keepEn);
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
    "image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"
  ]);
  const ext = path.extname(file.originalname || "").toLowerCase();
  const okExt = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"]);
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
    const id = String(req.query.id || "");
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
      section,\n      lang = "es",\n      translationId = "",
      tags = [],
      excerpt = "",
      cover = "",
      body = ""
    } = req.body || {};

    if (!title || !date || !section) {
      return res.status(400).json({ ok: false, error: "title, date, section requeridos" });
    }

    const id = idIn && idIn.trim()
      ? String(idIn).trim()
      : `${date}-${normSlug(title)}`;

    ensureDirs();
    fs.writeFileSync(path.join(POSTS_DIR, `${id}.md`), body, "utf-8");

    const idx = readIndex();
    const post = {
      id,
      title,
      date,
      section,\n      lang,\n      translationId,
      tags: Array.isArray(tags) ? tags : [],
      excerpt,
      cover,
      bodyUrl: `/content/posts/${id}.md`
    };

    const i = idx.posts.findIndex(p => p.id === id);
    if (i >= 0) idx.posts[i] = post;
    else idx.posts.unshift(post);

    writeIndex(idx);
    res.json({ ok: true, id });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.post("/api/posts/delete", (req, res) => {
  try {
    const id = String(req.body?.id || "");
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

app.post("/api/products/upsert", (req, res) => {
  try {
    const { id: idIn, name, category = "", status = "Activo", summary = "", pageUrl = "", tags = [] } = req.body || {};
    if (!name) return res.status(400).json({ ok: false, error: "name requerido" });

    const id = idIn && idIn.trim() ? String(idIn).trim() : normSlug(name);

    const idx = readIndex();
    const item = { id, name, category, status, summary, pageUrl, tags: Array.isArray(tags) ? tags : [] };

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
    const id = String(req.body?.id || "");
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

    const id = idIn && idIn.trim() ? String(idIn).trim() : normSlug(name);

    const idx = readIndex();
    const item = {
      id, name, category, summary,
      capabilities, deliverables, requirements,
      pageUrl,
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
    const id = String(req.body?.id || "");
    if (!id) return res.status(400).json({ ok: false, error: "missing id" });

    const idx = readIndex();
    idx.services = idx.services.filter(x => x.id !== id);
    writeIndex(idx);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

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

    generateBlogPages();

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

const PORT = 3777;
app.listen(PORT, () => {
  ensureDirs();
  console.log(`Admin local: http://localhost:${PORT}`);
});
















