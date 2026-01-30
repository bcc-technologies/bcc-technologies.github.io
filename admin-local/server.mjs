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

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use("/", express.static(path.join(__dirname, "public")));

function ensureDirs() {
  if (!fs.existsSync(CONTENT_DIR)) fs.mkdirSync(CONTENT_DIR, { recursive: true });
  if (!fs.existsSync(POSTS_DIR)) fs.mkdirSync(POSTS_DIR, { recursive: true });
  if (!fs.existsSync(STATIC_DIR)) fs.mkdirSync(STATIC_DIR, { recursive: true });
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

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

    ensureDirs();
    fs.writeFileSync(path.join(POSTS_DIR, `${id}.md`), body, "utf-8");

    const idx = readIndex();
    const post = {
      id,
      title,
      date,
      section,
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
