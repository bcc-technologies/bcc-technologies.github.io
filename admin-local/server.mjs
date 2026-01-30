import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Asumimos: /admin-local está dentro del repo
const REPO_ROOT = path.resolve(__dirname, "..");

const CONTENT_DIR = path.join(REPO_ROOT, "content");
const POSTS_DIR = path.join(CONTENT_DIR, "posts");
const INDEX_PATH = path.join(CONTENT_DIR, "content-index.json");

const app = express();
app.use(express.json({ limit: "5mb" }));

// Sirve la UI del admin
app.use("/", express.static(path.join(__dirname, "public")));

// Helpers
function ensureDirs() {
  if (!fs.existsSync(CONTENT_DIR)) fs.mkdirSync(CONTENT_DIR, { recursive: true });
  if (!fs.existsSync(POSTS_DIR)) fs.mkdirSync(POSTS_DIR, { recursive: true });
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

// API
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

/**
 * Upsert Post
 * body: { id?, title, date(YYYY-MM-DD), section, tags[], excerpt, cover, body(md) }
 */
app.post("/api/posts/upsert", (req, res) => {
  try {
    const {
      id: idIn,
      title,
      date,
      section,
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

    const mdFilename = `${id}.md`;
    const mdPath = path.join(POSTS_DIR, mdFilename);
    ensureDirs();
    fs.writeFileSync(mdPath, body, "utf-8");

    const idx = readIndex();
    const post = {
      id,
      title,
      date,
      section,            // Empresa | Investigación | Productos | Servicios | Otros
      tags: Array.isArray(tags) ? tags : [],
      excerpt,
      cover,
      bodyUrl: `/content/posts/${mdFilename}`
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

/**
 * Upsert Product
 * body: { id?, name, category, status, summary, pageUrl, tags[] }
 */
app.post("/api/products/upsert", (req, res) => {
  try {
    const { id: idIn, name, category = "", status = "Activo", summary = "", pageUrl = "", tags = [] } = req.body || {};
    if (!name) return res.status(400).json({ ok: false, error: "name requerido" });

    const id = idIn && idIn.trim()
      ? String(idIn).trim()
      : normSlug(name);

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

/**
 * Upsert Service
 * body: { id?, name, category, summary, deliverables, requirements, pageUrl, tags[] }
 */
app.post("/api/services/upsert", (req, res) => {
  try {
    const {
      id: idIn,
      name,
      category = "",
      summary = "",
      deliverables = "",
      requirements = "",
      pageUrl = "",
      tags = []
    } = req.body || {};

    if (!name) return res.status(400).json({ ok: false, error: "name requerido" });

    const id = idIn && idIn.trim()
      ? String(idIn).trim()
      : normSlug(name);

    const idx = readIndex();
    const item = {
      id, name, category, summary, deliverables, requirements, pageUrl,
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

// Git status (para indicador)
app.get("/api/git/status", (_req, res) => {
  try {
    const out = run("git", ["status", "--porcelain"]);
    res.json({ ok: true, dirty: out.length > 0, lines: out ? out.split("\n") : [] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// Publish: git add + commit + push
app.post("/api/git/publish", (req, res) => {
  try {
    const message = String(req.body?.message || "Update content").trim() || "Update content";

    run("git", ["add", "content"]);
    // commit puede fallar si no hay cambios; lo manejamos suave
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
