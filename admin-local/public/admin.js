const $ = (sel) => document.querySelector(sel);

const toastEl = $("#toast");
function toast(msg, ok = true) {
  toastEl.textContent = msg;
  toastEl.style.display = "block";
  toastEl.style.borderColor = ok ? "rgba(86,255,166,0.35)" : "rgba(237,70,36,0.35)";
  setTimeout(() => (toastEl.style.display = "none"), 2400);
}

function roleLabel(role) {
  return { client: "Cliente", staff: "Personal", admin: "Administrador" }[role] || role || "Usuario";
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: opts.body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    ...opts
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function parseTags(s) {
  return String(s || "").split(",").map(x => x.trim()).filter(Boolean);
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttr(s) {
  return escapeHtml(s).replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

const SAFE_URL_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

function safeUrl(value, { allowRelative = true } = {}) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (allowRelative && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  try {
    const parsed = new URL(raw);
    return SAFE_URL_PROTOCOLS.has(parsed.protocol) ? raw : "";
  } catch (_e) {
    return "";
  }
}

// ---- Minimal Markdown preview (includes images + lists + links + quotes)
function mdToHtml(md) {
  const lines = String(md || "").split("\n");
  let out = [];
  let inCode = false;
  let codeBuf = [];
  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) { out.push("</ul>"); inUl = false; }
    if (inOl) { out.push("</ol>"); inOl = false; }
  };

  const renderInline = (s) => {
    const esc = escapeHtml(s);
    // images
    const withImgs = esc.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, url) => {
      const safeAlt = escapeHtml(alt);
      const cleanUrl = safeUrl(String(url).trim());
      if (!cleanUrl) return safeAlt;
      const cap = safeAlt ? `<figcaption>${safeAlt}</figcaption>` : "";
      return `<figure class="article-figure"><img src="${escapeAttr(cleanUrl)}" alt="${safeAlt}"/>${cap}</figure>`;
    });
    // links
    return withImgs.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, text, url) => {
      const safeText = escapeHtml(text);
      const cleanUrl = safeUrl(String(url).trim());
      if (!cleanUrl) return safeText;
      return `<a href="${escapeAttr(cleanUrl)}" target="_blank" rel="noopener noreferrer">${safeText}</a>`;
    })
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\[@([A-Za-z0-9_.:-]+)\]/g, (_m, id) => inlineRefHtml(id));
  };

  for (const line of lines) {
    if (line.startsWith("```")) {
      closeLists();
      if (!inCode) { inCode = true; codeBuf = []; }
      else {
        inCode = false;
        out.push(`<pre><code>${escapeHtml(codeBuf.join("\n"))}</code></pre>`);
      }
      continue;
    }

    if (inCode) { codeBuf.push(line); continue; }

    const t = line.trim();

    if (t === "---" || t === "***" || t === "___") { closeLists(); out.push("<hr/>"); continue; }

    const mLiveBlock = t.match(/^\[\[(service|product|author|ref|reference|resource|music|widget):([^\]]+)\]\]$/i);
    if (mLiveBlock) {
      closeLists();
      out.push(blockPreviewHtml(mLiveBlock[1].toLowerCase(), mLiveBlock[2].trim()));
      continue;
    }

    if (line.startsWith("# ")) { closeLists(); out.push(`<h1>${renderInline(line.slice(2))}</h1>`); continue; }
    if (line.startsWith("## ")) { closeLists(); out.push(`<h2>${renderInline(line.slice(3))}</h2>`); continue; }
    if (line.startsWith("### ")) { closeLists(); out.push(`<h3>${renderInline(line.slice(4))}</h3>`); continue; }

    if (line.startsWith("> ")) { closeLists(); out.push(`<blockquote>${renderInline(line.slice(2))}</blockquote>`); continue; }

    const mUl = line.match(/^\s*[-*]\s+(.+)$/);
    if (mUl) {
      if (!inUl) { closeLists(); out.push("<ul>"); inUl = true; }
      out.push(`<li>${renderInline(mUl[1])}</li>`);
      continue;
    }

    const mOl = line.match(/^\s*\d+\.\s+(.+)$/);
    if (mOl) {
      if (!inOl) { closeLists(); out.push("<ol>"); inOl = true; }
      out.push(`<li>${renderInline(mOl[1])}</li>`);
      continue;
    }

    if (t === "") { closeLists(); out.push(""); continue; }

    closeLists();
    out.push(`<p>${renderInline(line)}</p>`);
  }

  closeLists();
  return out.join("\n");
}

// ---- Insert helpers
function insertAtCursor(el, text) {
  el.focus();
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  const before = el.value.slice(0, start);
  const sel = el.value.slice(start, end);
  const after = el.value.slice(end);

  const final = typeof text === "function" ? text(sel) : text;
  el.value = before + final + after;

  const pos = (before + final).length;
  el.selectionStart = el.selectionEnd = pos;
  if (typeof dispatchEditorInput === "function") dispatchEditorInput();
}

function prefixLines(sel, prefix) {
  const lines = (sel || "").split("\n");
  return lines.map(l => (l.trim() ? prefix + l : l)).join("\n");
}

function lineStartForHeading(textarea, level) {
  const h = "#".repeat(level) + " ";
  insertAtCursor(textarea, (sel) => sel ? prefixLines(sel, h) : `${h}Título\n`);
}

// ---- Tabs
document.querySelectorAll(".nav-item").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("is-active"));
    btn.classList.add("is-active");

    const tab = btn.dataset.tab;
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("is-active"));
    $("#tab-" + tab).classList.add("is-active");
  });
});

// ---- State
let INDEX = { posts: [], products: [], services: [], authors: [], references: [], resources: [], widgets: [] };
let currentPostId = "";
let currentProductId = "";
let currentServiceId = "";

let previewOn = true;


// ---- Authors + references + resources local fallback
const ENTITY_STORE = {
  authors: "bccAdmin.localAuthors",
  references: "bccAdmin.localReferences",
  resources: "bccAdmin.localResources",
  widgets: "bccAdmin.localWidgets"
};

function entityStorageGet(kind) {
  try {
    const raw = localStorage.getItem(ENTITY_STORE[kind]);
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data : [];
  } catch (_e) {
    return [];
  }
}

function entityStorageSet(kind, items) {
  try {
    localStorage.setItem(ENTITY_STORE[kind], JSON.stringify(Array.isArray(items) ? items : []));
    return true;
  } catch (_e) {
    return false;
  }
}

function slugifyId(text, fallback = "item") {
  const base = String(text || fallback)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return base || `${fallback}-${Date.now().toString(36)}`;
}

function dedupeById(items) {
  const map = new Map();
  (items || []).forEach(item => {
    if (!item) return;
    const id = String(item.id || "").trim();
    if (!id) return;
    map.set(id, item);
  });
  return [...map.values()];
}

function normalizeIndex(index = {}) {
  const normalized = {
    posts: Array.isArray(index.posts) ? index.posts : [],
    products: Array.isArray(index.products) ? index.products : [],
    services: Array.isArray(index.services) ? index.services : [],
    authors: dedupeById([...(Array.isArray(index.authors) ? index.authors : []), ...entityStorageGet("authors").map(x => ({ ...x, __local: true }))]),
    references: dedupeById([...(Array.isArray(index.references) ? index.references : []), ...entityStorageGet("references").map(x => ({ ...x, __local: true }))]),
    resources: dedupeById([...(Array.isArray(index.resources) ? index.resources : []), ...entityStorageGet("resources").map(x => ({ ...x, __local: true }))]),
    widgets: dedupeById([...(Array.isArray(index.widgets) ? index.widgets : []), ...entityStorageGet("widgets").map(x => ({ ...x, __local: true }))])
  };
  return normalized;
}

async function upsertEntity(kind, payload, endpointBase) {
  const idFallbackSource = payload.name || payload.title || payload.id || kind.slice(0, -1);
  const cleanPayload = { ...payload, id: String(payload.id || slugifyId(idFallbackSource)).trim() };
  try {
    const r = await api(`/api/${endpointBase}/upsert`, {
      method: "POST",
      body: JSON.stringify(cleanPayload)
    });
    toast(`Guardado: ${r.id || cleanPayload.id}`);
    await refreshAll();
    return r.id || cleanPayload.id;
  } catch (e) {
    const local = entityStorageGet(kind);
    const next = dedupeById([...local.filter(x => x.id !== cleanPayload.id), cleanPayload]);
    entityStorageSet(kind, next);
    INDEX[kind] = dedupeById([...(INDEX[kind] || []).filter(x => x.id !== cleanPayload.id), { ...cleanPayload, __local: true }]);
    toast(`Guardado local: ${cleanPayload.id} · falta endpoint /api/${endpointBase}/upsert`, true);
    return cleanPayload.id;
  }
}

async function deleteEntity(kind, id, endpointBase) {
  const cleanId = String(id || "").trim();
  if (!cleanId) return toast("No hay elemento cargado", false);
  try {
    await api(`/api/${endpointBase}/delete`, { method: "POST", body: JSON.stringify({ id: cleanId }) });
    toast("Eliminado");
    await refreshAll();
  } catch (_e) {
    const next = entityStorageGet(kind).filter(x => x.id !== cleanId);
    entityStorageSet(kind, next);
    INDEX[kind] = (INDEX[kind] || []).filter(x => x.id !== cleanId);
    toast(`Eliminado localmente: ${cleanId}`);
  }
}

function inlineRefHtml(id) {
  const ref = (INDEX.references || []).find(x => String(x.id) === String(id));
  const label = ref ? `${ref.authors ? String(ref.authors).split(",")[0].trim() : ref.title || id}${ref.year ? ", " + ref.year : ""}` : id;
  return `<sup class="inline-citation" title="${escapeAttr(ref?.title || id)}">[@${escapeHtml(label)}]</sup>`;
}

const UI_PREFS = {
  sideCollapsed: "bccAdmin.sideCollapsed",
  postsLibraryCollapsed: "bccAdmin.postsLibraryCollapsed",
  postDetailsCollapsed: "bccAdmin.postDetailsCollapsed",
  outlineCollapsed: "bccAdmin.outlineCollapsed",
  focusWriting: "bccAdmin.focusWriting",
  lightTheme: "bccAdmin.lightTheme"
};

// ---- Bilingual section definitions
// The canonical/stored value is always the ES label.
// EN labels are shown in the editor when editing an EN post.
const SECTION_PAIRS = [
  { es: "Ensayos",                en: "Essays" },
  { es: "Notas de Laboratorio",   en: "Lab Notes" },
  { es: "Cultura BCC",            en: "BCC Culture" },
  { es: "Anecdotas",              en: "Anecdotes" },
  { es: "Divulgaci\u00f3n Cient\u00edfica",  en: "Science Communication" },
  { es: "Otros",                  en: "Others" }
];

/**
 * Returns the canonical (ES) value for any section label regardless of language.
 */
function canonicalSection(section) {
  const s = String(section || "").trim();
  const pair = SECTION_PAIRS.find(p => p.es === s || p.en === s);
  return pair ? pair.es : s;
}

/**
 * Translates a section label to the target language.
 * Always works from/to the canonical ES value.
 */
function translateSection(section, toLang) {
  const canonical = canonicalSection(section);
  const pair = SECTION_PAIRS.find(p => p.es === canonical);
  if (!pair) return section;
  return toLang === "en" ? pair.en : pair.es;
}

/**
 * Rebuilds the #postSection <select> options for the given lang.
 * The stored/submitted VALUE is always the canonical ES label;
 * only the visible text changes per language.
 */
function refreshSectionOptions(lang) {
  const sel = $("#postSection");
  if (!sel) return;
  const currentCanonical = canonicalSection(sel.value);
  const isEn = String(lang || "es").toLowerCase() === "en";
  sel.innerHTML = SECTION_PAIRS.map(p =>
    `<option value="${escapeAttr(p.es)}">${escapeHtml(isEn ? p.en : p.es)}</option>`
  ).join("");
  // Restore canonical value (falls back to first option if not found)
  sel.value = currentCanonical;
  if (!sel.value) sel.selectedIndex = 0;
}

function readBoolPref(key, fallback = false) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : raw === "true";
  } catch (_e) {
    return fallback;
  }
}

function writeBoolPref(key, value) {
  try {
    localStorage.setItem(key, String(Boolean(value)));
  } catch (_e) {
    // localStorage may be unavailable in restricted contexts.
  }
}

function setButtonIcon(btn, icon) {
  if (!btn) return;
  if (btn.classList?.contains("doc-more-action")) {
    const first = btn.querySelector("span[aria-hidden='true']") || btn.querySelector("span");
    if (first) first.textContent = icon;
    else btn.insertAdjacentHTML("afterbegin", `<span aria-hidden="true">${icon}</span>`);
    return;
  }
  btn.innerHTML = `<span aria-hidden="true">${icon}</span>`;
}

function setLightTheme(enabled, persist = true) {
  const value = Boolean(enabled);
  document.body.classList.toggle("theme-light", value);
  document.documentElement.classList.toggle("theme-light", value);
  document.documentElement.style.colorScheme = value ? "light" : "dark";

  const btn = $("#btnToggleTheme");
  if (btn) {
    setButtonIcon(btn, value ? "◐" : "☀");
    btn.setAttribute("aria-pressed", String(value));
    btn.setAttribute("aria-label", value ? "Activar modo oscuro" : "Activar modo claro");
    btn.title = value ? "Activar modo oscuro" : "Activar modo claro";
    btn.classList.toggle("is-active", value);
  }

  if (persist) writeBoolPref(UI_PREFS.lightTheme, value);
}

function setSideCollapsed(collapsed, persist = true) {
  const value = Boolean(collapsed);
  document.body.classList.toggle("side-collapsed", value);

  const btn = $("#btnToggleSide");
  if (btn) {
    setButtonIcon(btn, "☰");
    btn.setAttribute("aria-pressed", String(value));
    btn.setAttribute("aria-label", value ? "Mostrar barra lateral" : "Ocultar barra lateral");
    btn.title = value ? "Mostrar barra lateral" : "Ocultar barra lateral";
    btn.classList.toggle("is-active", value);
  }

  if (persist) writeBoolPref(UI_PREFS.sideCollapsed, value);
}

function setPostsLibraryCollapsed(collapsed, persist = true) {
  const value = Boolean(collapsed);
  document.body.classList.toggle("posts-library-collapsed", value);

  const library = $("#postsLibrary");
  if (library) library.classList.toggle("is-collapsed", value);

  const topBtn = $("#btnToggleLibraryTop");
  if (topBtn) {
    setButtonIcon(topBtn, value ? "▤" : "▥");
    topBtn.setAttribute("aria-pressed", String(value));
    topBtn.setAttribute("aria-label", value ? "Mostrar selector de entradas" : "Ocultar selector de entradas");
    topBtn.title = value ? "Mostrar selector de entradas" : "Ocultar selector de entradas";
    topBtn.classList.toggle("is-active", value);
  }

  const localBtn = $("#btnCollapseLibrary");
  if (localBtn) {
    setButtonIcon(localBtn, value ? "▤" : "▥");
    localBtn.setAttribute("aria-pressed", String(value));
    localBtn.setAttribute("aria-label", value ? "Mostrar selector de entradas" : "Ocultar selector de entradas");
    localBtn.title = value ? "Mostrar selector de entradas" : "Ocultar selector de entradas";
    localBtn.classList.toggle("is-active", value);
  }

  if (persist) writeBoolPref(UI_PREFS.postsLibraryCollapsed, value);
}


function setPostDetailsCollapsed(collapsed, persist = true) {
  const value = Boolean(collapsed);
  const panel = $("#postDetails");
  if (panel) panel.classList.toggle("is-collapsed", value);

  const btn = $("#btnTogglePostDetails");
  if (btn) {
    setButtonIcon(btn, "⚙");
    btn.setAttribute("aria-pressed", String(!value));
    btn.setAttribute("aria-label", value ? "Mostrar detalles de publicación" : "Ocultar detalles de publicación");
    btn.title = value ? "Mostrar detalles de publicación" : "Ocultar detalles de publicación";
    btn.classList.toggle("is-active", !value);
  }

  if (persist) writeBoolPref(UI_PREFS.postDetailsCollapsed, value);
}

function setOutlineCollapsed(collapsed, persist = true) {
  const value = Boolean(collapsed);
  document.body.classList.toggle("outline-collapsed", value);

  const updateBtn = (btn) => {
    if (!btn) return;
    setButtonIcon(btn, value ? "☰" : "☷");
    btn.setAttribute("aria-pressed", String(!value));
    btn.setAttribute("aria-label", value ? "Mostrar outline" : "Ocultar outline");
    btn.title = value ? "Mostrar outline" : "Ocultar outline";
    btn.classList.toggle("is-active", !value);
  };

  updateBtn($("#btnToggleOutline"));
  updateBtn($("#btnToggleOutlineInline"));

  if (persist) writeBoolPref(UI_PREFS.outlineCollapsed, value);
  requestAnimationFrame(syncEditorPanelHeights);
}

function getCurrentPostRecord() {
  if (!currentPostId) return null;
  return (INDEX.posts || []).find(p => p.id === currentPostId) || null;
}

function getCurrentTranslationKey() {
  const current = getCurrentPostRecord();
  return (
    ($("#postTranslationId")?.value || "").trim() ||
    current?.translationId ||
    current?.id ||
    ($("#postId")?.value || "").trim()
  );
}

function getCurrentTranslationGroup() {
  const key = getCurrentTranslationKey();
  if (!key) return [];
  return (INDEX.posts || []).filter(p => (p.translationId || p.id) === key);
}

function setPostLanguage(lang) {
  const targetLang = String(lang || "es").toLowerCase();
  const group = getCurrentTranslationGroup();
  const existingVersion = group.find(p => String(p.lang || "es").toLowerCase() === targetLang);

  if (existingVersion && existingVersion.id !== currentPostId) {
    loadPost(existingVersion.id);
    return;
  }

  // Avoid silently converting an existing ES post into EN, or vice versa.
  // Missing translations should be created deliberately with a new post ID and the same translationId.
  if (currentPostId && group.length && !existingVersion) {
    toast(`No existe versión ${targetLang.toUpperCase()}. Crea una entrada nueva y usa el mismo grupo de traducción.`, false);
    refreshPostHeader();
    return;
  }

  const select = $("#postLang");
  if (select) select.value = targetLang;
  refreshSectionOptions(targetLang);
  refreshPostHeader();
}

function refreshPostHeader() {
  const lang = String($("#postLang")?.value || "es").toLowerCase();
  const section = $("#postSection")?.value || "Ensayos";
  const date = $("#postDate")?.value || "sin fecha";
  const id = ($("#postId")?.value || "").trim();
  const translationKey = getCurrentTranslationKey();
  const group = getCurrentTranslationGroup();
  const availableLangs = new Set(group.map(p => String(p.lang || "es").toLowerCase()));

  const summary = $("#postMetaSummary");
  if (summary) {
    const idPart = id ? ` · ${id}` : "";
    const translationPart = translationKey && translationKey !== id ? ` · grupo ${translationKey}` : "";
    summary.textContent = `${section} · ${lang.toUpperCase()} · ${date}${idPart}${translationPart}`;
  }

  document.querySelectorAll(".lang-chip[data-lang]").forEach(btn => {
    const btnLang = String(btn.dataset.lang || "").toLowerCase();
    const exists = availableLangs.has(btnLang) || !translationKey;
    btn.classList.toggle("is-active", btnLang === lang);
    btn.classList.toggle("is-missing", Boolean(translationKey) && !exists);
    btn.title = exists ? `Versión ${btnLang.toUpperCase()}` : `Crear o marcar versión ${btnLang.toUpperCase()}`;
  });

  renderTranslationBreadcrumbs();
}

function initUiToggles() {
  setSideCollapsed(readBoolPref(UI_PREFS.sideCollapsed), false);
  setPostsLibraryCollapsed(readBoolPref(UI_PREFS.postsLibraryCollapsed), false);
  setPostDetailsCollapsed(readBoolPref(UI_PREFS.postDetailsCollapsed, true), false);
  setOutlineCollapsed(readBoolPref(UI_PREFS.outlineCollapsed, false), false);
  setLightTheme(readBoolPref(UI_PREFS.lightTheme, false), false);

  $("#btnToggleTheme")?.addEventListener("click", () => {
    setLightTheme(!document.body.classList.contains("theme-light"));
  });

  $("#btnToggleSide")?.addEventListener("click", () => {
    setSideCollapsed(!document.body.classList.contains("side-collapsed"));
    requestAnimationFrame(syncEditorPanelHeights);
  });

  $("#btnAccountMenu")?.addEventListener("click", (event) => {
    event.stopPropagation();
    const dropdown = $("#accountDropdown");
    if (!dropdown) return;
    const open = dropdown.hidden;
    dropdown.hidden = !open;
    $("#btnAccountMenu")?.setAttribute("aria-expanded", String(open));
  });

  document.addEventListener("click", (event) => {
    const menu = $("#accountMenu");
    const dropdown = $("#accountDropdown");
    if (!menu || !dropdown || dropdown.hidden || menu.contains(event.target)) return;
    dropdown.hidden = true;
    $("#btnAccountMenu")?.setAttribute("aria-expanded", "false");
  });

  $("#btnLogout")?.addEventListener("click", async () => {
    try {
      await api("/api/auth/logout", { method: "POST", body: "{}" });
    } catch (_e) {
      // Continue to the login screen even if the local request fails.
    }
    window.location.assign("http://localhost:3888/login.html");
  });

  $("#btnToggleLibraryTop")?.addEventListener("click", () => {
    setPostsLibraryCollapsed(!document.body.classList.contains("posts-library-collapsed"));
    requestAnimationFrame(syncEditorPanelHeights);
  });

  $("#btnTogglePostDetails")?.addEventListener("click", () => {
    setPostDetailsCollapsed(!$("#postDetails")?.classList.contains("is-collapsed"));
    requestAnimationFrame(syncEditorPanelHeights);
  });

  ["#btnToggleOutline", "#btnToggleOutlineInline"].forEach(sel => {
    $(sel)?.addEventListener("click", () => {
      setOutlineCollapsed(!document.body.classList.contains("outline-collapsed"));
    });
  });

  document.querySelectorAll(".lang-chip[data-lang]").forEach(btn => {
    btn.addEventListener("click", () => setPostLanguage(btn.dataset.lang));
  });

  document.querySelectorAll(".doc-more-action").forEach(btn => {
    btn.addEventListener("click", () => {
      const menu = document.getElementById("docMoreMenu");
      if (menu) requestAnimationFrame(() => { menu.open = false; });
    });
  });

  ["#postDate", "#postSection", "#postLang", "#postTranslationId", "#postId"].forEach(sel => {
    $(sel)?.addEventListener("input", refreshPostHeader);
    $(sel)?.addEventListener("change", refreshPostHeader);
  });
}


function syncEditorPanelHeights() {
  const body = $("#postBody");
  const preview = $("#postPreview");
  if (!body || !preview) return;

  const height = Math.round(body.getBoundingClientRect().height);
  if (height > 0) preview.style.height = `${height}px`;
}

function initEditorResizeSync() {
  const body = $("#postBody");
  if (!body) return;

  if ("ResizeObserver" in window) {
    const ro = new ResizeObserver(syncEditorPanelHeights);
    ro.observe(body);
  }

  window.addEventListener("resize", syncEditorPanelHeights);
  requestAnimationFrame(syncEditorPanelHeights);
}

// ---- Load
async function refreshAll() {
  const { index } = await api("/api/index");
  INDEX = normalizeIndex(index);

  renderPosts();
  renderProducts();
  renderServices();
  renderAuthors();
  renderPostAuthorPicker();
  renderArticleAuthorshipPreview();
  renderReferences();
  renderResources();
  renderWidgets();
  populateTemplatePostSelect();
  await refreshGitStatus();
  renderHealthDashboard();
}

async function refreshGitStatus() {
  const st = await api("/api/git/status");
  const el = $("#gitStatus");
  el.classList.remove("clean", "dirty");
  el.classList.add(st.dirty ? "dirty" : "clean");
  el.querySelector(".status-text").textContent = st.dirty ? "Cambios sin publicar" : "Repo limpio";
}

async function hydrateAccountMenu() {
  try {
    const { user } = await api("/api/auth/me");
    const display = user?.displayName || user?.name || "Cuenta";
    if ($("#accountName")) $("#accountName").textContent = display;
    if ($("#accountRole")) $("#accountRole").textContent = roleLabel(user?.role);
    if ($("#accountInitial")) $("#accountInitial").textContent = display.trim().charAt(0).toUpperCase() || "?";
  } catch (_e) {
    // The CMS guard handles invalid sessions on API/page load.
  }
}

function markCurrent(scopeSelector, id) {
  document.querySelectorAll(`${scopeSelector} .item`).forEach(el => {
    const isCurrent = el.dataset.id === id || Boolean(el.querySelector(`[data-id="${CSS.escape(id || "")}"]`));
    el.classList.toggle("is-current", isCurrent);
  });
}

function refreshActiveLanguage(id) {
  document.querySelectorAll("#postsList .lang-badge").forEach(btn => {
    btn.classList.toggle("is-active-lang", btn.dataset.id === id);
  });
  markCurrent("#postsList", id);
}

// ---- POSTS
function normalizeLang(lang) {
  return String(lang || "es").toLowerCase();
}

const SUPPORTED_POST_LANGS = ["es", "en"];

function postGroupKey(post) {
  return String(post?.translationId || post?.id || "").trim();
}

function buildPostGroups(posts = INDEX.posts || []) {
  const groups = new Map();
  for (const p of posts) {
    const key = postGroupKey(p);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  return groups;
}

function getPostGroup(key) {
  return buildPostGroups().get(String(key || "")) || [];
}

function postGroupMain(posts) {
  return posts.find(p => normalizeLang(p.lang) === "es") || posts[0] || {};
}

function postGroupDate(posts) {
  const dates = posts.map(p => p.date).filter(Boolean).sort();
  return dates[dates.length - 1] || "";
}

function postGroupCompleteness(posts) {
  const langs = new Set(posts.map(p => normalizeLang(p.lang)));
  const missing = SUPPORTED_POST_LANGS.filter(lang => !langs.has(lang));
  return { langs, missing, complete: missing.length === 0 };
}

function groupMatchesQuery(posts, key, query) {
  if (!query) return true;
  const hay = posts.map(p => [
    p.id,
    p.translationId,
    p.title,
    p.section,
    p.date,
    normalizeLang(p.lang),
    (p.tags || []).join(" "),
    p.excerpt || ""
  ].join(" ")).join(" ");
  return `${key} ${hay}`.toLowerCase().includes(query);
}

function comparePostGroups(sort) {
  return ([keyA, postsA], [keyB, postsB]) => {
    const a = postGroupMain(postsA);
    const b = postGroupMain(postsB);
    if (sort === "date-asc") return String(postGroupDate(postsA)).localeCompare(String(postGroupDate(postsB)));
    if (sort === "title-asc") return String(a.title || keyA).localeCompare(String(b.title || keyB), "es", { sensitivity: "base" });
    if (sort === "section-asc") {
      const sec = String(a.section || "").localeCompare(String(b.section || ""), "es", { sensitivity: "base" });
      return sec || String(a.title || keyA).localeCompare(String(b.title || keyB), "es", { sensitivity: "base" });
    }
    return String(postGroupDate(postsB)).localeCompare(String(postGroupDate(postsA))) ||
      String(b.title || keyB).localeCompare(String(a.title || keyA), "es", { sensitivity: "base" });
  };
}

function renderPosts() {
  const allGroupsMap = buildPostGroups();
  const allGroups = [...allGroupsMap.entries()];
  const totalGroups = allGroups.length;
  const totalVersions = INDEX.posts.length;

  const q = ($("#postsSearch")?.value || "").toLowerCase().trim();
  const sec = ($("#postsSectionFilter")?.value || "").trim();
  const langFilter = ($("#postsLangFilter")?.value || "").trim();
  const completenessFilter = ($("#postsCompletenessFilter")?.value || "").trim();
  const sort = ($("#postsSort")?.value || "date-desc").trim();

  let groups = allGroups.filter(([key, posts]) => {
    const completeness = postGroupCompleteness(posts);
    if (!groupMatchesQuery(posts, key, q)) return false;
    if (sec && !posts.some(p => p.section === sec)) return false;

    if (langFilter === "es" && !completeness.langs.has("es")) return false;
    if (langFilter === "en" && !completeness.langs.has("en")) return false;
    if (langFilter === "missing-es" && completeness.langs.has("es")) return false;
    if (langFilter === "missing-en" && completeness.langs.has("en")) return false;

    if (completenessFilter === "missing" && completeness.complete) return false;
    if (completenessFilter === "complete" && !completeness.complete) return false;
    return true;
  }).sort(comparePostGroups(sort));

  const count = $("#postsCount");
  if (count) {
    const visibleVersions = groups.reduce((acc, [, posts]) => acc + posts.length, 0);
    count.textContent = `${groups.length}/${totalGroups} grupo(s) · ${visibleVersions}/${totalVersions} versión(es)`;
  }

  const groupedItems = groups.map(([key, posts]) => {
    const main = postGroupMain(posts);
    const completeness = postGroupCompleteness(posts);
    const isCurrent = posts.some(p => p.id === currentPostId);
    const date = postGroupDate(posts) || main.date || "sin fecha";
    const section = main.section || posts.find(p => p.section)?.section || "Otros";
    const excerpt = String(main.excerpt || posts.find(p => p.excerpt)?.excerpt || "").trim();
    const stateLabel = completeness.complete ? "Completo" : `Falta ${completeness.missing.map(x => x.toUpperCase()).join("/")}`;

    const langButtons = SUPPORTED_POST_LANGS.map(lang => {
      const p = posts.find(x => normalizeLang(x.lang) === lang);
      if (p) {
        return `
          <button class="entry-lang-chip lang-badge ${p.id === currentPostId ? "is-active-lang" : ""}" data-id="${escapeAttr(p.id)}" type="button" aria-label="Abrir versión ${lang.toUpperCase()}" title="Abrir versión ${lang.toUpperCase()}">
            ${lang.toUpperCase()}
          </button>
        `;
      }
      return `
        <button class="entry-lang-chip missing-lang-badge" data-group="${escapeAttr(key)}" data-lang="${escapeAttr(lang)}" type="button" aria-label="Crear traducción ${lang.toUpperCase()}" title="Preparar traducción ${lang.toUpperCase()}">
          +${lang.toUpperCase()}
        </button>
      `;
    }).join("");

    return `
      <div class="item entry-card post-group ${isCurrent ? "is-current" : ""} ${completeness.complete ? "is-complete" : "is-incomplete"}" data-group="${escapeAttr(key)}">
        <div class="entry-card-main">
          <div class="entry-title-row">
            <div class="item-title" title="${escapeAttr(main.title || "(sin título)")}">${escapeHtml(main.title || "(sin título)")}</div>
            <span class="entry-state ${completeness.complete ? "is-ok" : "is-warn"}">${escapeHtml(stateLabel)}</span>
          </div>

          <div class="entry-meta-line">
            <span>${escapeHtml(section)}</span>
            <span>·</span>
            <span>${escapeHtml(date)}</span>
            <span>·</span>
            <span class="entry-id" title="Grupo de traducción">${escapeHtml(key)}</span>
          </div>

          ${excerpt ? `<div class="entry-excerpt">${escapeHtml(excerpt)}</div>` : ""}

          <div class="entry-lang-row">
            ${langButtons}
          </div>
        </div>

        <div class="entry-quick-actions" aria-label="Acciones rápidas">
          <button class="entry-mini-action" data-action="copy-key" data-group="${escapeAttr(key)}" type="button" aria-label="Copiar grupo de traducción" title="Copiar grupo de traducción">⧉</button>
          <button class="entry-mini-action" data-action="duplicate" data-group="${escapeAttr(key)}" type="button" aria-label="Duplicar como borrador" title="Duplicar como borrador">⎘</button>
        </div>
      </div>
    `;
  });

  const list = $("#postsList");
  list.innerHTML = groupedItems.join("") || `<div class="entry-empty muted">No hay entradas con esos filtros.</div>`;

  list.querySelectorAll(".lang-badge").forEach(btn => {
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      loadPost(btn.dataset.id);
    });
  });

  list.querySelectorAll(".missing-lang-badge").forEach(btn => {
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      createTranslationDraftFromGroup(btn.dataset.group, btn.dataset.lang);
    });
  });

  list.querySelectorAll(".entry-mini-action").forEach(btn => {
    btn.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      const action = btn.dataset.action;
      const key = btn.dataset.group;
      if (action === "copy-key") return copyTextToClipboard(key, "Grupo copiado");
      if (action === "duplicate") return duplicatePostDraftFromGroup(key);
    });
  });

  list.querySelectorAll(".post-group").forEach(el => {
    el.addEventListener("click", () => {
      const key = el.dataset.group;
      const posts = getPostGroup(key);
      const current = posts.find(p => p.id === currentPostId);
      const main = current || posts.find(p => normalizeLang(p.lang) === "es") || posts[0];
      if (main?.id) loadPost(main.id);
    });
  });

  refreshActiveLanguage(currentPostId);
}

function collectPostDraftFromSource(source, overrides = {}) {
  return {
    id: overrides.id ?? "",
    title: overrides.title ?? source?.title ?? "",
    date: overrides.date ?? source?.date ?? new Date().toISOString().slice(0, 10),
    section: overrides.section ?? source?.section ?? "Ensayos",
    lang: overrides.lang ?? normalizeLang(source?.lang || "es"),
    translationId: overrides.translationId ?? postGroupKey(source) ?? "",
    tags: overrides.tags ?? (source?.tags || []),
    authorIds: overrides.authorIds ?? (source?.authorIds || source?.authors || []),
    referenceIds: overrides.referenceIds ?? (source?.referenceIds || source?.references || []),
    resourceIds: overrides.resourceIds ?? (source?.resourceIds || source?.resources || []),
    excerpt: overrides.excerpt ?? source?.excerpt ?? "",
    cover: overrides.cover ?? source?.cover ?? "",
    body: overrides.body ?? ""
  };
}

function applyPostDraft(payload, hint = "Nueva entrada") {
  currentPostId = "";
  $("#postEditorHint").textContent = hint;
  $("#postId").value = payload.id || "";
  $("#postTitle").value = payload.title || "";
  $("#postDate").value = payload.date || new Date().toISOString().slice(0, 10);
  refreshSectionOptions(payload.lang || "es");
  $("#postSection").value = canonicalSection(payload.section) || "Ensayos";
  $("#postLang").value = normalizeLang(payload.lang || "es");
  $("#postTranslationId").value = payload.translationId || "";
  $("#postTags").value = (payload.tags || []).join(", ");
  if ($("#postAuthors")) $("#postAuthors").value = (payload.authorIds || payload.authors || []).join(", ");
  renderPostAuthorPicker();
  if ($("#postReferences")) $("#postReferences").value = (payload.referenceIds || payload.references || []).join(", ");
  if ($("#postResources")) $("#postResources").value = (payload.resourceIds || payload.resources || []).join(", ");
  $("#postCover").value = payload.cover || "";
  $("#postExcerpt").value = payload.excerpt || "";
  $("#postBody").value = payload.body || "";
  updateEditorDerivedViews();
  refreshActiveLanguage("");
  refreshPostHeader();
  setAutosaveStatus("dirty", "Borrador local");
  scheduleAutosave({ immediate: true, reason: "borrador preparado" });
  requestAnimationFrame(syncEditorPanelHeights);
}

function createTranslationDraftFromGroup(key, lang) {
  const posts = getPostGroup(key);
  const targetLang = normalizeLang(lang);
  const existing = posts.find(p => normalizeLang(p.lang) === targetLang);
  if (existing?.id) return loadPost(existing.id);

  const source = postGroupMain(posts);
  if (!source?.id) return toast("No encontré la entrada base para crear traducción", false);

  const draft = collectPostDraftFromSource(source, {
    id: "",
    lang: targetLang,
    translationId: key,
    body: ""
  });

  applyPostDraft(draft, `Nueva traducción ${targetLang.toUpperCase()} · grupo ${key}`);
  setPostDetailsCollapsed(false);
  toast(`Traducción ${targetLang.toUpperCase()} preparada. Guarda para crearla.`);
}

async function duplicatePostDraftFromGroup(key) {
  try {
    const posts = getPostGroup(key);
    const source = posts.find(p => p.id === currentPostId) || postGroupMain(posts);
    if (!source?.id) return toast("No encontré una entrada para duplicar", false);

    const bodyRes = await api(`/api/posts/body?id=${encodeURIComponent(source.id)}`);
    const draft = collectPostDraftFromSource(source, {
      id: "",
      title: `${source.title || "Entrada"} (copia)`,
      translationId: "",
      body: bodyRes.body || ""
    });

    applyPostDraft(draft, `Copia local de ${source.id}`);
    setPostDetailsCollapsed(false);
    toast("Copia preparada. Revisa ID/grupo antes de guardar.");
  } catch (e) {
    toast(`No pude duplicar: ${e.message}`, false);
  }
}

function copyTextToClipboard(text, okMessage = "Copiado") {
  const value = String(text || "");
  if (!value) return toast("Nada que copiar", false);

  const done = () => toast(okMessage);
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(value).then(done).catch(() => fallbackCopyText(value, done));
  } else {
    fallbackCopyText(value, done);
  }
}

function fallbackCopyText(text, done) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); done?.(); }
  catch (_e) { toast("No pude copiar automáticamente", false); }
  ta.remove();
}


function postAuthorIdsFromInput() {
  return parseTags($("#postAuthors")?.value || "");
}

function setPostAuthorIds(ids, { silent = false } = {}) {
  const clean = dedupeById((ids || []).map(id => ({ id: String(id || "").trim() }))).map(x => x.id);
  const input = $("#postAuthors");
  if (input) input.value = clean.join(", ");
  renderPostAuthorPicker();
  renderArticleAuthorshipPreview();
  refreshPostHeader();
  if (!silent && typeof scheduleAutosave === "function") scheduleAutosave();
}

function selectedAuthorsForPost() {
  const ids = postAuthorIdsFromInput();
  return ids.map(id => (INDEX.authors || []).find(a => a.id === id) || { id, name: id, __missing: true });
}

function renderPostAuthorPicker() {
  const el = $("#postAuthorPicker");
  if (!el) return;

  const selected = new Set(postAuthorIdsFromInput());
  const authors = INDEX.authors || [];

  if (!authors.length) {
    el.innerHTML = `<div class="author-picker-empty">No hay autores creados. Crea perfiles en la pestaña Autores y luego selecciónalos aquí.</div>`;
    return;
  }

  const selectedUnknown = [...selected].filter(id => !authors.some(a => a.id === id));
  const buttons = authors.map(a => {
    const active = selected.has(a.id);
    return `
      <button class="author-pick-chip ${active ? "is-selected" : ""}" data-author-id="${escapeAttr(a.id)}" type="button" title="${escapeAttr(a.id)}">
        ${a.avatar ? `<img src="${escapeAttr(a.avatar)}" alt=""/>` : ""}
        <span>${escapeHtml(a.name || a.id)}</span>
      </button>
    `;
  }).join("");

  const unknown = selectedUnknown.length
    ? `<div class="author-picker-missing">IDs no encontrados: ${selectedUnknown.map(escapeHtml).join(", ")}</div>`
    : "";

  el.innerHTML = `<div class="author-picker-list">${buttons}</div>${unknown}`;
  el.querySelectorAll("[data-author-id]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.authorId;
      const next = new Set(postAuthorIdsFromInput());
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setPostAuthorIds([...next]);
    });
  });
}

function renderArticleAuthorshipPreview() {
  const el = $("#articleAuthorshipPreview");
  if (!el) return;

  const authors = selectedAuthorsForPost();
  if (!authors.length) {
    el.innerHTML = `<div class="preview-author-empty">Sin autoría asignada.</div>`;
    return;
  }

  el.innerHTML = `
    <div class="preview-author-kicker">Autoría</div>
    <div class="preview-author-list">
      ${authors.map(a => `
        <span class="preview-author-pill ${a.__missing ? "is-missing" : ""}">
          ${a.avatar ? `<img src="${escapeAttr(a.avatar)}" alt=""/>` : ""}
          <span>${escapeHtml(a.name || a.id)}</span>
        </span>
      `).join("")}
    </div>
  `;
}

async function loadPost(id) {
  const p = INDEX.posts.find(x => x.id === id);
  if (!p) return;

  currentPostId = p.id;
  $("#postEditorHint").textContent = `Editando ${String(p.lang || "es").toUpperCase()}: ${p.id}`;

  $("#postId").value = p.id;
  $("#postTitle").value = p.title || "";
  $("#postDate").value = p.date || "";
  refreshSectionOptions(p.lang || "es");
  $("#postSection").value = canonicalSection(p.section) || "Otros";
  $("#postLang").value = (p.lang || "es");
  $("#postTranslationId").value = (p.translationId || "");
  $("#postTags").value = (p.tags || []).join(", ");
  if ($("#postAuthors")) $("#postAuthors").value = (p.authorIds || p.authors || []).join(", ");
  renderPostAuthorPicker();
  if ($("#postReferences")) $("#postReferences").value = (p.referenceIds || p.references || []).join(", ");
  if ($("#postResources")) $("#postResources").value = (p.resourceIds || p.resources || []).join(", ");
  $("#postCover").value = p.cover || "";
  $("#postExcerpt").value = p.excerpt || "";

  const bodyRes = await api(`/api/posts/body?id=${encodeURIComponent(p.id)}`);
  $("#postBody").value = bodyRes.body || "";
  updateEditorDerivedViews();
  refreshActiveLanguage(p.id);
  refreshPostHeader();
  setAutosaveStatus("clean", "Autosave listo");
  checkForNewerLocalDraft(p.id);
  requestAnimationFrame(syncEditorPanelHeights);
}

function clearPostEditor() {
  currentPostId = "";
  $("#postEditorHint").textContent = "Nueva entrada";
  $("#postId").value = "";
  $("#postTitle").value = "";
  $("#postDate").value = new Date().toISOString().slice(0, 10);
  refreshSectionOptions("es");
  $("#postSection").value = "Ensayos";
  $("#postLang").value = "es";
  $("#postTranslationId").value = "";
  $("#postTags").value = "";
  if ($("#postAuthors")) $("#postAuthors").value = "";
  renderPostAuthorPicker();
  if ($("#postReferences")) $("#postReferences").value = "";
  if ($("#postResources")) $("#postResources").value = "";
  $("#postCover").value = "";
  $("#postExcerpt").value = "";
  $("#postBody").value = "";
  updateEditorDerivedViews();
  refreshActiveLanguage("");
  refreshPostHeader();
  setAutosaveStatus("clean", "Autosave listo");
  requestAnimationFrame(syncEditorPanelHeights);
}

$("#postBody").addEventListener("input", handlePostBodyInput);

["#postsSearch", "#postsSectionFilter", "#postsLangFilter", "#postsCompletenessFilter", "#postsSort"].forEach(sel => {
  $(sel)?.addEventListener("input", renderPosts);
  $(sel)?.addEventListener("change", renderPosts);
});

$("#btnNewPost").addEventListener("click", clearPostEditor);

$("#btnSavePost").addEventListener("click", async () => {
  try {
    const payload = {
      id: $("#postId").value.trim() || undefined,
      title: $("#postTitle").value.trim(),
      date: $("#postDate").value,
      section: $("#postSection").value,
      lang: $("#postLang").value,
      translationId: $("#postTranslationId").value.trim(),
      tags: parseTags($("#postTags").value),
      authorIds: parseTags($("#postAuthors")?.value || ""),
      referenceIds: parseTags($("#postReferences")?.value || ""),
      resourceIds: parseTags($("#postResources")?.value || ""),
      excerpt: $("#postExcerpt").value.trim(),
      cover: $("#postCover").value.trim(),
      body: $("#postBody").value
    };

    const r = await api("/api/posts/upsert", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    saveLocalSnapshot("guardado manual", { force: true, payload: { ...payload, id: r.id } });
    clearAutosaveDraft(r.id);
    toast(`Guardado: ${r.id}`);
    await refreshAll();
    await loadPost(r.id);
    setAutosaveStatus("clean", "Guardado");
  } catch (e) {
    toast(`Error: ${e.message}`, false);
  }
});

$("#btnDeletePost").addEventListener("click", async () => {
  try {
    const id = ($("#postId").value || "").trim() || currentPostId;
    if (!id) return toast("No hay post cargado", false);

    await api("/api/posts/delete", { method: "POST", body: JSON.stringify({ id }) });
    toast("Eliminado");
    clearPostEditor();
    await refreshAll();
  } catch (e) {
    toast(`Error: ${e.message}`, false);
  }
});

// ---- Toolbar commands
const postBody = $("#postBody");

function openDlg(dlg) {
  if (!dlg) return;
  dlg.showModal();
}

function closeDlg(dlg) {
  if (!dlg) return;
  dlg.close();
}

function currentServiceOptions() {
  return (INDEX.services || []).map(s => ({ id: s.id, label: `${s.name} (${s.id})` }));
}
function currentProductOptions() {
  return (INDEX.products || []).map(p => ({ id: p.id, label: `${p.name} (${p.id})` }));
}
function currentAuthorOptions() {
  return (INDEX.authors || []).map(a => ({ id: a.id, label: `${a.name || a.id} (${a.id})` }));
}
function currentReferenceOptions() {
  return (INDEX.references || []).map(r => ({ id: r.id, label: `${r.title || r.id} (${r.id})` }));
}
function currentResourceOptions() {
  return (INDEX.resources || []).map(r => ({ id: r.id, label: `${r.title || r.id} (${r.type || "resource"} · ${r.id})` }));
}
function currentWidgetOptions() {
  return (INDEX.widgets || []).map(w => ({ id: w.id, label: `${w.title || w.id} (${widgetTypeLabel(w.type)} · ${w.id})` }));
}

function blockPreviewHtml(type, id) {
  if (type === "service") {
    const s = (INDEX.services || []).find(x => x.id === id);
    if (!s) return "<p>(Servicio no encontrado)</p>";
    const caps = String(s.capabilities || "").split("\n").map(x => x.trim()).filter(Boolean).slice(0, 6);
    return `
      <div style="border:1px solid rgba(255,255,255,0.14); border-radius:14px; padding:10px;">
        <div style="font-weight:800;">${escapeHtml(s.name)}</div>
        <div style="opacity:.75; margin-top:2px;">${escapeHtml(s.category || "Servicio")}</div>
        <div style="margin-top:8px; opacity:.85;">${escapeHtml(s.summary || "")}</div>
        ${caps.length ? `<ul style="margin:10px 0 0; padding-left:18px;">${caps.map(c => `<li>${escapeHtml(c)}</li>`).join("")}</ul>` : ""}
      </div>
    `;
  }
  if (type === "author") {
    const a = (INDEX.authors || []).find(x => x.id === id);
    if (!a) return "<p>(Autor no encontrado)</p>";
    const avatarUrl = safeUrl(a.avatar);
    return `
      <div class="entity-preview-card author-preview-card ${avatarUrl ? "has-avatar" : "no-avatar"}">
        ${avatarUrl ? `<img class="entity-avatar" src="${escapeAttr(avatarUrl)}" alt="${escapeAttr(a.name || a.id)}"/>` : ""}
        <div>
          <div class="entity-preview-title">${escapeHtml(a.name || a.id)}</div>
          <div class="entity-preview-meta">${escapeHtml([a.role, a.affiliation].filter(Boolean).join(" · ") || "Autor")}</div>
          ${a.bio ? `<div class="entity-preview-body">${escapeHtml(a.bio)}</div>` : ""}
        </div>
      </div>
    `;
  }
  if (type === "ref" || type === "reference") {
    const r = (INDEX.references || []).find(x => x.id === id);
    if (!r) return "<p>(Referencia no encontrada)</p>";
    const citation = r.citation || [r.authors, r.year ? `(${r.year})` : "", r.title, r.venue].filter(Boolean).join(". ");
    const refUrl = safeUrl(r.url);
    return `
      <div class="entity-preview-card reference-preview-card">
        <div class="entity-preview-title">${escapeHtml(r.title || r.id)}</div>
        <div class="entity-preview-meta">${escapeHtml([r.type || "referencia", r.year, r.venue].filter(Boolean).join(" · "))}</div>
        ${citation ? `<div class="entity-preview-body">${escapeHtml(citation)}</div>` : ""}
        ${r.doi || refUrl ? `<div class="entity-preview-links">${r.doi ? `DOI: ${escapeHtml(r.doi)}` : ""}${r.doi && refUrl ? " · " : ""}${refUrl ? `<a href="${escapeAttr(refUrl)}" target="_blank" rel="noopener noreferrer">Abrir fuente</a>` : ""}</div>` : ""}
      </div>
    `;
  }

  if (type === "resource" || type === "music") {
    const r = (INDEX.resources || []).find(x => x.id === id);
    if (!r) return "<p>(Recurso no encontrado)</p>";
    const icon = resourceTypeIcon(r.type || type);
    const kicker = resourceTypeLabel(r.type || type);
    const resourceUrl = safeUrl(r.url);
    const meta = [r.creator, r.year, r.relation].filter(Boolean).join(" · ");
    return `
      <div class="entity-preview-card resource-preview-card">
        <div class="resource-preview-icon" aria-hidden="true">${escapeHtml(icon)}</div>
        <div>
          <div class="entity-preview-meta">${escapeHtml(kicker)}</div>
          <div class="entity-preview-title">${escapeHtml(r.title || r.id)}</div>
          ${meta ? `<div class="entity-preview-meta">${escapeHtml(meta)}</div>` : ""}
          ${r.note ? `<div class="entity-preview-body">${escapeHtml(r.note)}</div>` : ""}
          ${resourceUrl ? `<div class="entity-preview-links"><a href="${escapeAttr(resourceUrl)}" target="_blank" rel="noopener noreferrer">Abrir recurso</a></div>` : ""}
        </div>
      </div>
    `;
  }


  if (type === "widget") {
    const w = (INDEX.widgets || []).find(x => x.id === id);
    if (!w) return "<p>(Widget no encontrado)</p>";
    return widgetPreviewHtml(w);
  }
  const p = (INDEX.products || []).find(x => x.id === id);
  if (!p) return "<p>(Producto no encontrado)</p>";
  return `
    <div style="border:1px solid rgba(255,255,255,0.14); border-radius:14px; padding:10px;">
      <div style="font-weight:800;">${escapeHtml(p.name)}</div>
      <div style="opacity:.75; margin-top:2px;">${escapeHtml(p.category || p.status || "Producto")}</div>
      <div style="margin-top:8px; opacity:.85;">${escapeHtml(p.summary || "")}</div>
    </div>
  `;
}

// Image dialog
const dlgImage = $("#dlgImage");
const imgAlt = $("#imgAlt");
const imgUrl = $("#imgUrl");
const imgFile = $("#imgFile");
const imgUploadHint = $("#imgUploadHint");

$("#btnUploadImage").addEventListener("click", async () => {
  try {
    const f = imgFile.files?.[0];
    if (!f) return toast("Selecciona una imagen", false);

    const fd = new FormData();
    fd.append("file", f);

    const res = await api("/api/uploads/image", { method: "POST", body: fd });
    imgUrl.value = res.url;
    imgUploadHint.textContent = `Subida ok: ${res.url}`;
    addAsset({ url: res.url, alt: imgAlt.value || f.name });
    toast("Imagen subida");
  } catch (e) {
    toast(`Upload falló: ${e.message}`, false);
  }
});

$("#btnInsertImage").addEventListener("click", () => {
  const alt = (imgAlt.value || "").trim();
  const url = (imgUrl.value || "").trim();
  if (!url) return toast("Primero sube o pega una URL", false);

  insertAtCursor(postBody, () => `\n![${alt || "imagen"}](${url})\n`);
  $("#postPreview").innerHTML = mdToHtml(postBody.value);

  imgAlt.value = "";
  imgUrl.value = "";
  imgFile.value = "";
  imgUploadHint.textContent = "—";
  closeDlg(dlgImage);
});

// Block dialog
const dlgBlock = $("#dlgInsertBlock");
const blockType = $("#blockType");
const blockId = $("#blockId");
const blockPreview = $("#blockPreview");

function fillBlockIds() {
  const type = blockType.value;
  const optionMap = {
    service: currentServiceOptions,
    product: currentProductOptions,
    ref: currentReferenceOptions,
    reference: currentReferenceOptions,
    resource: currentResourceOptions,
    music: currentResourceOptions,
    widget: currentWidgetOptions
  };
  const opts = (optionMap[type] || currentProductOptions)();
  blockId.innerHTML = opts.map(o => `<option value="${escapeAttr(o.id)}">${escapeHtml(o.label)}</option>`).join("");
  const id = blockId.value || opts[0]?.id || "";
  blockPreview.innerHTML = id ? blockPreviewHtml(type, id) : `<p class="muted">No hay elementos disponibles.</p>`;
}

blockType.addEventListener("change", fillBlockIds);
blockId.addEventListener("change", () => {
  blockPreview.innerHTML = blockPreviewHtml(blockType.value, blockId.value);
});

$("#btnInsertBlock").addEventListener("click", () => {
  const type = blockType.value;
  const id = blockId.value;
  if (!id) return toast("No hay item para insertar", false);

  const tokenType = type === "reference" ? "ref" : type === "music" ? "resource" : type;
  insertAtCursor(postBody, () => `
[[${tokenType}:${id}]]
`);
  $("#postPreview").innerHTML = mdToHtml(postBody.value);
  closeDlg(dlgBlock);
});


// ---- Slash commands
const slashMenu = $("#slashMenu");
let slashOpen = false;
let slashQuery = "";
let slashItems = [];
let slashIndex = 0;

const SLASH_COMMANDS = [
  {
    id: "h2",
    title: "Título H2",
    desc: "Inserta una sección principal",
    icon: "H2",
    keys: "heading titulo sección",
    run: () => replaceSlashToken("## Título\n")
  },
  {
    id: "h3",
    title: "Título H3",
    desc: "Inserta una subsección",
    icon: "H3",
    keys: "heading subtitulo subsección",
    run: () => replaceSlashToken("### Título\n")
  },
  {
    id: "p",
    title: "Párrafo",
    desc: "Limpia el slash y empieza a escribir",
    icon: "¶",
    keys: "texto parrafo",
    run: () => replaceSlashToken("")
  },
  {
    id: "ul",
    title: "Lista",
    desc: "Lista con viñetas",
    icon: "•",
    keys: "bullet viñetas puntos lista",
    run: () => replaceSlashToken("- Item 1\n- Item 2\n")
  },
  {
    id: "ol",
    title: "Lista numerada",
    desc: "Lista ordenada",
    icon: "1.",
    keys: "numerada ordenada lista",
    run: () => replaceSlashToken("1. Item 1\n2. Item 2\n")
  },
  {
    id: "quote",
    title: "Cita",
    desc: "Bloque de cita o nota",
    icon: "❝",
    keys: "quote cita nota blockquote",
    run: () => replaceSlashToken("> Nota: ...\n")
  },
  {
    id: "hr",
    title: "Separador",
    desc: "Línea divisoria",
    icon: "—",
    keys: "linea separador divisor hr",
    run: () => replaceSlashToken("---\n")
  },
  {
    id: "code",
    title: "Código",
    desc: "Bloque de código",
    icon: "{ }",
    keys: "codigo code bloque snippet",
    run: () => replaceSlashToken("```\n// código\n```\n")
  },
  {
    id: "link",
    title: "Link",
    desc: "Inserta un enlace Markdown",
    icon: "🔗",
    keys: "enlace url link",
    run: () => {
      const url = prompt("URL del link:", "https://");
      if (!url) return;
      replaceSlashToken(`[texto](${url})`);
    }
  },
  {
    id: "image",
    title: "Imagen",
    desc: "Sube una imagen o pega una URL",
    icon: "🖼",
    keys: "imagen image foto upload",
    run: () => {
      removeSlashToken();
      openDlg(dlgImage);
    }
  },
  {
    id: "service",
    title: "Servicio",
    desc: "Inserta un bloque vivo de servicio",
    icon: "▣",
    keys: "servicio service bloque vivo",
    run: () => {
      removeSlashToken();
      blockType.value = "service";
      fillBlockIds();
      openDlg(dlgBlock);
    }
  },
  {
    id: "product",
    title: "Producto",
    desc: "Inserta un bloque vivo de producto",
    icon: "◈",
    keys: "producto product bloque vivo",
    run: () => {
      removeSlashToken();
      blockType.value = "product";
      fillBlockIds();
      openDlg(dlgBlock);
    }
  },
  {
    id: "ref",
    title: "Referencia",
    desc: "Inserta una referencia bibliográfica",
    icon: "[@]",
    keys: "referencia bibliografia paper cita citation",
    run: () => {
      removeSlashToken();
      blockType.value = "ref";
      fillBlockIds();
      openDlg(dlgBlock);
    }
  },

  {
    id: "resource",
    title: "Recurso",
    desc: "Inserta un recurso recomendado",
    icon: "✦",
    keys: "recurso recomendado profundizar resource rail",
    run: () => {
      removeSlashToken();
      blockType.value = "resource";
      fillBlockIds();
      openDlg(dlgBlock);
    }
  },
  {
    id: "widget",
    title: "Widget",
    desc: "Inserta un widget interactivo de contenido",
    icon: "▧",
    keys: "widget bloque interactivo tabla grafico video scrollbox callout",
    run: () => {
      removeSlashToken();
      blockType.value = "widget";
      fillBlockIds();
      openDlg(dlgBlock);
    }
  },
  {
    id: "music",
    title: "Resonancia",
    desc: "Inserta una pieza musical o resonancia",
    icon: "♫",
    keys: "musica music resonancia soundtrack pieza",
    run: () => {
      removeSlashToken();
      blockType.value = "resource";
      fillBlockIds();
      openDlg(dlgBlock);
    }
  },
  {
    id: "cite",
    title: "Cita inline",
    desc: "Inserta una cita tipo [@id]",
    icon: "@",
    keys: "cita inline citation referencia",
    run: () => {
      const opts = currentReferenceOptions();
      const chosen = prompt("ID de referencia:", opts[0]?.id || "");
      if (!chosen) return removeSlashToken();
      replaceSlashToken(`[@${chosen}]`);
    }
  },
  {
    id: "preview",
    title: "Preview",
    desc: "Muestra u oculta la vista previa",
    icon: "◐",
    keys: "vista previa preview split",
    run: () => {
      removeSlashToken();
      togglePreviewPane();
    }
  },
  {
    id: "details",
    title: "Detalles",
    desc: "Muestra u oculta metadata de publicación",
    icon: "⚙",
    keys: "metadata detalles publicación config",
    run: () => {
      removeSlashToken();
      setPostDetailsCollapsed(!$("#postDetails")?.classList.contains("is-collapsed"));
      requestAnimationFrame(syncEditorPanelHeights);
    }
  }
];

function getActiveSlashRange() {
  const el = postBody;
  if (!el) return null;

  const pos = el.selectionStart ?? 0;
  if (pos !== (el.selectionEnd ?? pos)) return null;

  const before = el.value.slice(0, pos);
  const lineStart = before.lastIndexOf("\n") + 1;
  const linePrefix = before.slice(lineStart);
  const m = linePrefix.match(/(^|\s)\/([\p{L}\p{N}_-]*)$/u);
  if (!m) return null;

  const slashOffset = linePrefix.lastIndexOf("/");
  const start = lineStart + slashOffset;
  return { start, end: pos, query: before.slice(start + 1, pos) };
}

function dispatchEditorInput() {
  postBody?.dispatchEvent(new Event("input", { bubbles: true }));
  requestAnimationFrame(syncEditorPanelHeights);
}

function replaceSlashToken(text) {
  const el = postBody;
  if (!el) return;

  const range = getActiveSlashRange();
  const start = range?.start ?? (el.selectionStart ?? el.value.length);
  const end = range?.end ?? (el.selectionEnd ?? start);

  el.value = el.value.slice(0, start) + text + el.value.slice(end);
  const pos = start + text.length;
  el.focus();
  el.selectionStart = el.selectionEnd = pos;
  hideSlashMenu();
  dispatchEditorInput();
}

function removeSlashToken() {
  replaceSlashToken("");
}

function filteredSlashCommands(query) {
  const q = String(query || "").toLowerCase().trim();
  if (!q) return SLASH_COMMANDS;

  return SLASH_COMMANDS.filter(cmd => {
    const hay = `${cmd.id} ${cmd.title} ${cmd.desc} ${cmd.keys || ""}`.toLowerCase();
    return hay.includes(q);
  });
}

function getTextareaCaretPoint(el) {
  const rect = el.getBoundingClientRect();
  const pos = el.selectionStart ?? 0;
  const style = getComputedStyle(el);
  const mirror = document.createElement("div");

  const props = [
    "boxSizing", "width", "height", "fontFamily", "fontSize", "fontWeight", "fontStyle", "letterSpacing",
    "textTransform", "wordSpacing", "textIndent", "whiteSpace", "lineHeight", "paddingTop", "paddingRight",
    "paddingBottom", "paddingLeft", "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth"
  ];

  mirror.style.position = "fixed";
  mirror.style.left = `${rect.left}px`;
  mirror.style.top = `${rect.top}px`;
  mirror.style.width = `${rect.width}px`;
  mirror.style.height = `${rect.height}px`;
  mirror.style.overflow = "hidden";
  mirror.style.visibility = "hidden";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.overflowWrap = "break-word";
  props.forEach(prop => { mirror.style[prop] = style[prop]; });

  const before = el.value.slice(0, pos);
  mirror.textContent = before;

  const marker = document.createElement("span");
  marker.textContent = "\u200b";
  mirror.appendChild(marker);
  document.body.appendChild(mirror);

  mirror.scrollTop = el.scrollTop;
  mirror.scrollLeft = el.scrollLeft;

  const markerRect = marker.getBoundingClientRect();
  const point = {
    left: markerRect.left - el.scrollLeft,
    top: markerRect.top - el.scrollTop
  };

  mirror.remove();

  if (!Number.isFinite(point.left) || !Number.isFinite(point.top)) {
    return { left: rect.left + 20, top: rect.top + 45 };
  }

  return point;
}

function placeSlashMenu() {
  const menu = slashMenu;
  const el = postBody;
  if (!menu || !el) return;

  const pt = getTextareaCaretPoint(el);
  const menuWidth = Math.min(360, window.innerWidth - 28);
  const left = Math.max(14, Math.min(pt.left, window.innerWidth - menuWidth - 14));
  let top = pt.top + 26;

  const estimatedHeight = Math.min(340, Math.max(92, slashItems.length * 58 + 42));
  if (top + estimatedHeight > window.innerHeight - 14) {
    top = Math.max(14, pt.top - estimatedHeight - 8);
  }

  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

function renderSlashMenu(query = "") {
  if (!slashMenu) return;

  slashQuery = query;
  slashItems = filteredSlashCommands(query);
  slashIndex = Math.min(slashIndex, Math.max(0, slashItems.length - 1));

  slashMenu.innerHTML = slashItems.length
    ? slashItems.map((cmd, i) => `
      <button class="slash-item ${i === slashIndex ? "is-selected" : ""}" data-id="${escapeHtml(cmd.id)}" role="option" type="button" aria-selected="${i === slashIndex ? "true" : "false"}">
        <span class="slash-icon">${escapeHtml(cmd.icon)}</span>
        <span>
          <span class="slash-title">${escapeHtml(cmd.title)}</span>
          <span class="slash-desc">${escapeHtml(cmd.desc)}</span>
        </span>
        <span class="slash-key">/${escapeHtml(cmd.id)}</span>
      </button>
    `).join("") + `<div class="slash-hint">↑↓ para moverte · Enter para insertar · Esc para cerrar</div>`
    : `<div class="slash-empty">No encontré comandos para <span class="mono">/${escapeHtml(query)}</span>.</div>`;

  slashMenu.querySelectorAll(".slash-item").forEach(btn => {
    btn.addEventListener("mousedown", ev => ev.preventDefault());
    btn.addEventListener("click", () => runSlashCommand(btn.dataset.id));
  });

  placeSlashMenu();
}

function showSlashMenu(query = "") {
  if (!slashMenu || !postBody) return;
  slashOpen = true;
  slashMenu.hidden = false;
  slashIndex = 0;
  renderSlashMenu(query);
}

function hideSlashMenu() {
  slashOpen = false;
  if (slashMenu) slashMenu.hidden = true;
}

function updateSlashMenuFromCursor() {
  const range = getActiveSlashRange();
  if (!range) {
    hideSlashMenu();
    return;
  }
  if (!slashOpen) showSlashMenu(range.query);
  else renderSlashMenu(range.query);
}

function runSlashCommand(id) {
  const cmd = SLASH_COMMANDS.find(x => x.id === id) || slashItems[slashIndex];
  if (!cmd) return;
  cmd.run();
}

function handleSlashKeydown(ev) {
  if (!slashOpen) return;

  if (ev.key === "ArrowDown") {
    ev.preventDefault();
    slashIndex = Math.min(slashIndex + 1, Math.max(0, slashItems.length - 1));
    renderSlashMenu(slashQuery);
    return;
  }

  if (ev.key === "ArrowUp") {
    ev.preventDefault();
    slashIndex = Math.max(slashIndex - 1, 0);
    renderSlashMenu(slashQuery);
    return;
  }

  if (ev.key === "Enter" || ev.key === "Tab") {
    if (!slashItems.length) return;
    ev.preventDefault();
    runSlashCommand(slashItems[slashIndex]?.id);
    return;
  }

  if (ev.key === "Escape") {
    ev.preventDefault();
    hideSlashMenu();
  }
}

function openSlashMenuFromToolbar() {
  if (!postBody) return;
  postBody.focus();
  const range = getActiveSlashRange();
  if (!range) insertAtCursor(postBody, "/");
  showSlashMenu(getActiveSlashRange()?.query || "");
}

function initSlashCommands() {
  if (!postBody || !slashMenu) return;

  postBody.addEventListener("keydown", handleSlashKeydown);
  postBody.addEventListener("input", updateSlashMenuFromCursor);
  postBody.addEventListener("click", updateSlashMenuFromCursor);
  postBody.addEventListener("blur", () => setTimeout(hideSlashMenu, 140));
  window.addEventListener("resize", () => slashOpen && placeSlashMenu());
  window.addEventListener("scroll", () => slashOpen && placeSlashMenu(), true);

  $("#btnSlashCommands")?.addEventListener("click", openSlashMenuFromToolbar);

  document.addEventListener("mousedown", ev => {
    if (!slashOpen) return;
    if (slashMenu?.contains(ev.target) || ev.target === postBody || ev.target === $("#btnSlashCommands")) return;
    hideSlashMenu();
  });
}

// Toolbar click routing
document.querySelectorAll(".editor-toolbar .tbtn[data-cmd]").forEach(btn => {
  btn.addEventListener("click", () => {
    const cmd = btn.dataset.cmd;

    if (cmd === "h2") return lineStartForHeading(postBody, 2);
    if (cmd === "h3") return lineStartForHeading(postBody, 3);

    if (cmd === "bold") return insertAtCursor(postBody, (sel) => `**${sel || "texto"}**`);
    if (cmd === "italic") return insertAtCursor(postBody, (sel) => `*${sel || "texto"}*`);
    if (cmd === "code") return insertAtCursor(postBody, (sel) => sel ? `\`${sel}\`` : "`código`");

    if (cmd === "ul") return insertAtCursor(postBody, (sel) => sel ? prefixLines(sel, "- ") : "\n- Item 1\n- Item 2\n");
    if (cmd === "ol") return insertAtCursor(postBody, (sel) => {
      if (!sel) return "\n1. Item 1\n2. Item 2\n";
      const lines = sel.split("\n").filter(Boolean);
      return lines.map((l, i) => `${i + 1}. ${l}`).join("\n");
    });
    if (cmd === "quote") return insertAtCursor(postBody, (sel) => sel ? prefixLines(sel, "> ") : "\n> Nota: ...\n");
    if (cmd === "hr") return insertAtCursor(postBody, () => "\n---\n");

    if (cmd === "link") {
      const url = prompt("URL del link:", "https://");
      if (!url) return;
      return insertAtCursor(postBody, (sel) => `[${sel || "texto"}](${url})`);
    }

    if (cmd === "image") {
      openDlg(dlgImage);
      return;
    }

    if (cmd === "service") {
      blockType.value = "service";
      fillBlockIds();
      openDlg(dlgBlock);
      return;
    }

    if (cmd === "product") {
      blockType.value = "product";
      fillBlockIds();
      openDlg(dlgBlock);
      return;
    }


    if (cmd === "reference") {
      blockType.value = "ref";
      fillBlockIds();
      openDlg(dlgBlock);
      return;
    }

    if (cmd === "resource") {
      blockType.value = "resource";
      fillBlockIds();
      openDlg(dlgBlock);
      return;
    }

    if (cmd === "widget") {
      blockType.value = "widget";
      fillBlockIds();
      openDlg(dlgBlock);
      return;
    }
  });
});

// Preview toggle
function togglePreviewPane() {
  previewOn = !previewOn;
  const split = $("#editorSplit");
  split?.classList.toggle("is-preview-hidden", !previewOn);
  requestAnimationFrame(syncEditorPanelHeights);
}

$("#btnTogglePreview")?.addEventListener("click", togglePreviewPane);

// Collapse library
$("#btnCollapseLibrary")?.addEventListener("click", () => {
  setPostsLibraryCollapsed(!document.body.classList.contains("posts-library-collapsed"));
  requestAnimationFrame(syncEditorPanelHeights);
});


// ---- Editorial suite: autosave, history, breadcrumbs, assets, outline, focus, command palette
const EDITOR_STORE = {
  draftPrefix: "bccAdmin.draft.",
  historyPrefix: "bccAdmin.history.",
  assets: "bccAdmin.assets"
};

let autosaveTimer = null;
let autosaveDirty = false;
let lastAutosaveSignature = "";
let lastSnapshotAt = 0;
let selectedHistoryIndex = 0;
let commandPaletteIndex = 0;
let commandPaletteItems = [];

function safeJsonParse(raw, fallback) {
  try { return raw ? JSON.parse(raw) : fallback; }
  catch (_e) { return fallback; }
}

function storageGet(key, fallback = null) {
  try { return safeJsonParse(localStorage.getItem(key), fallback); }
  catch (_e) { return fallback; }
}

function storageSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch (_e) { return false; }
}

function storageRemove(key) {
  try { localStorage.removeItem(key); } catch (_e) {}
}

function stablePostKey(id = null) {
  const explicit = String(id || currentPostId || $("#postId")?.value || "").trim();
  if (explicit) return explicit;
  const title = String($("#postTitle")?.value || "untitled").trim().toLowerCase().replace(/\s+/g, "-").slice(0, 64) || "untitled";
  return `new-${title}`;
}

function draftKey(id = null) { return EDITOR_STORE.draftPrefix + stablePostKey(id); }
function historyKey(id = null) { return EDITOR_STORE.historyPrefix + stablePostKey(id); }

function collectPostPayload() {
  return {
    id: $("#postId")?.value.trim() || currentPostId || "",
    title: $("#postTitle")?.value.trim() || "",
    date: $("#postDate")?.value || "",
    section: $("#postSection")?.value || "Ensayos",
    lang: $("#postLang")?.value || "es",
    translationId: $("#postTranslationId")?.value.trim() || "",
    tags: parseTags($("#postTags")?.value || ""),
    authorIds: parseTags($("#postAuthors")?.value || ""),
    referenceIds: parseTags($("#postReferences")?.value || ""),
    resourceIds: parseTags($("#postResources")?.value || ""),
    excerpt: $("#postExcerpt")?.value.trim() || "",
    cover: $("#postCover")?.value.trim() || "",
    body: $("#postBody")?.value || ""
  };
}

function applyPostPayload(payload) {
  if (!payload) return;
  $("#postId").value = payload.id || "";
  $("#postTitle").value = payload.title || "";
  $("#postDate").value = payload.date || "";
  $("#postSection").value = payload.section || "Ensayos";
  $("#postLang").value = payload.lang || "es";
  $("#postTranslationId").value = payload.translationId || "";
  $("#postTags").value = (payload.tags || []).join(", ");
  if ($("#postAuthors")) $("#postAuthors").value = (payload.authorIds || payload.authors || []).join(", ");
  renderPostAuthorPicker();
  if ($("#postReferences")) $("#postReferences").value = (payload.referenceIds || payload.references || []).join(", ");
  if ($("#postResources")) $("#postResources").value = (payload.resourceIds || payload.resources || []).join(", ");
  $("#postCover").value = payload.cover || "";
  $("#postExcerpt").value = payload.excerpt || "";
  $("#postBody").value = payload.body || "";
  updateEditorDerivedViews();
  refreshPostHeader();
  scheduleAutosave({ immediate: true, reason: "restaurado" });
}

function signatureForPayload(payload) {
  return JSON.stringify(payload || collectPostPayload());
}

function setAutosaveStatus(kind, label) {
  const el = $("#autosaveStatus");
  if (!el) return;
  el.classList.remove("clean", "dirty", "saving");
  el.classList.add(kind);
  const text = el.querySelector(".status-text");
  if (text) text.textContent = label;
}

function saveLocalDraft(reason = "autosave") {
  const payload = collectPostPayload();
  const sig = signatureForPayload(payload);
  if (sig === lastAutosaveSignature && reason !== "manual") {
    setAutosaveStatus("clean", "Autosave listo");
    return;
  }
  const now = Date.now();
  const record = { ts: now, reason, payload };
  setAutosaveStatus("saving", "Guardando local…");
  const ok = storageSet(draftKey(payload.id), record);
  if (ok) {
    lastAutosaveSignature = sig;
    autosaveDirty = false;
    setAutosaveStatus("clean", `Autosave ${formatShortTime(now)}`);
    if (now - lastSnapshotAt > 30000 || reason === "manual") {
      saveLocalSnapshot(reason, { payload });
      lastSnapshotAt = now;
    }
  } else {
    setAutosaveStatus("dirty", "Autosave lleno/bloqueado");
  }
}

function clearAutosaveDraft(id = null) {
  storageRemove(draftKey(id));
}

function scheduleAutosave(opts = {}) {
  const { immediate = false, reason = "autosave" } = opts;
  autosaveDirty = true;
  setAutosaveStatus("dirty", "Cambios locales");
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => saveLocalDraft(reason), immediate ? 80 : 900);
}

function saveLocalSnapshot(reason = "snapshot", options = {}) {
  const payload = options.payload || collectPostPayload();
  const key = historyKey(payload.id);
  const list = storageGet(key, []) || [];
  const sig = signatureForPayload(payload);
  if (!options.force && list[0]?.signature === sig) return;
  const snapshot = {
    ts: Date.now(),
    reason,
    signature: sig,
    stats: textStats(payload.body || ""),
    payload
  };
  list.unshift(snapshot);
  storageSet(key, list.slice(0, 32));
}

function getLocalHistory(id = null) {
  const list = storageGet(historyKey(id), []) || [];
  const draft = storageGet(draftKey(id), null);
  if (draft?.payload) {
    const snapshot = {
      ts: draft.ts || Date.now(),
      reason: draft.reason || "autosave local",
      signature: signatureForPayload(draft.payload),
      stats: textStats(draft.payload.body || ""),
      payload: draft.payload
    };
    if (!list.some(x => x.signature === snapshot.signature)) return [snapshot, ...list];
  }
  return list;
}

function formatShortTime(ts) {
  try { return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  catch (_e) { return "ahora"; }
}

function formatFullTime(ts) {
  try { return new Date(ts).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }); }
  catch (_e) { return "—"; }
}

function textStats(text) {
  const s = String(text || "");
  const words = (s.trim().match(/\S+/g) || []).length;
  const headings = (s.match(/^#{1,3}\s+/gm) || []).length;
  return { chars: s.length, words, headings, lines: s.split("\n").length };
}

function checkForNewerLocalDraft(id) {
  const draft = storageGet(draftKey(id), null);
  if (!draft?.payload) return;
  const currentSig = signatureForPayload(collectPostPayload());
  const draftSig = signatureForPayload(draft.payload);
  if (draftSig !== currentSig) {
    setAutosaveStatus("dirty", "Draft local disponible");
    toast("Hay un autosave local para esta entrada. Ábrelo en ↺ Historial.");
  }
}


function articleAuthorshipPreviewHtml() {
  const authors = selectedAuthorsForPost();
  if (!authors.length) return "";
  return `
    <div class="preview-byline-block">
      <div class="preview-byline-kicker">Artículo por</div>
      <div class="preview-byline-authors">
        ${authors.map(a => `
          <span class="preview-byline-author ${a.__missing ? "is-missing" : ""}">
            ${a.avatar ? `<img src="${escapeAttr(a.avatar)}" alt=""/>` : ""}
            <span>${escapeHtml(a.name || a.id)}</span>
          </span>
        `).join("")}
      </div>
    </div>
  `;
}

function updateEditorDerivedViews() {
  const body = $("#postBody")?.value || "";
  const preview = $("#postPreview");
  if (preview) preview.innerHTML = `${articleAuthorshipPreviewHtml()}${mdToHtml(body)}`;
  renderArticleAuthorshipPreview();
  renderOutline(body);
  requestAnimationFrame(syncEditorPanelHeights);
}

function handlePostBodyInput() {
  updateEditorDerivedViews();
  scheduleAutosave();
}

function renderOutline(body = $("#postBody")?.value || "") {
  const list = $("#outlineList");
  if (!list) return;
  const headings = [];
  String(body || "").split("\n").forEach((line, idx) => {
    const m = line.match(/^(#{2,3})\s+(.+)$/);
    if (m) headings.push({ level: m[1].length, text: m[2].trim(), line: idx });
  });
  list.innerHTML = headings.length
    ? headings.map(h => `<button class="outline-item level-${h.level}" data-line="${h.line}" type="button"><span class="outline-line">${h.line + 1}</span>${escapeHtml(h.text)}</button>`).join("")
    : `<div class="outline-empty">Los títulos H2/H3 aparecerán aquí.</div>`;
  list.querySelectorAll(".outline-item").forEach(btn => {
    btn.addEventListener("click", () => jumpToEditorLine(Number(btn.dataset.line || 0)));
  });
}

function jumpToEditorLine(lineNumber) {
  const el = $("#postBody");
  if (!el) return;
  const lines = el.value.split("\n");
  const pos = lines.slice(0, Math.max(0, lineNumber)).join("\n").length + (lineNumber > 0 ? 1 : 0);
  el.focus();
  el.selectionStart = el.selectionEnd = pos;
  const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 22;
  el.scrollTop = Math.max(0, lineNumber * lineHeight - 80);
}

function renderTranslationBreadcrumbs() {
  const el = $("#postBreadcrumbs");
  if (!el) return;
  const group = getCurrentTranslationGroup();
  const currentLang = String($("#postLang")?.value || "es").toLowerCase();
  const currentTitle = $("#postTitle")?.value || "Nueva entrada";
  const langs = ["es", "en"];
  const pieces = [];
  const key = getCurrentTranslationKey();

  if (!key && !currentPostId) {
    el.innerHTML = `<span class="crumb is-active"><span>Nuevo</span><span class="crumb-title">${escapeHtml(currentTitle)}</span></span>`;
    return;
  }

  for (const lang of langs) {
    const post = group.find(p => String(p.lang || "es").toLowerCase() === lang);
    if (post) {
      pieces.push(`<button class="crumb ${post.id === currentPostId || lang === currentLang ? "is-active" : ""}" data-id="${escapeHtml(post.id)}" type="button"><span>${lang.toUpperCase()}</span><span class="crumb-title">${escapeHtml(post.title || post.id)}</span></button>`);
    } else {
      pieces.push(`<span class="crumb crumb-missing"><span>+${lang.toUpperCase()}</span><span class="crumb-title">faltante</span></span>`);
    }
  }
  el.innerHTML = pieces.join("");
  el.querySelectorAll(".crumb[data-id]").forEach(btn => btn.addEventListener("click", () => loadPost(btn.dataset.id)));
}

function bodyLineDiff(oldText, newText) {
  const oldLines = String(oldText || "").split("\n");
  const newLines = String(newText || "").split("\n");
  const oldSet = new Set(oldLines.map(x => x.trim()).filter(Boolean));
  const newSet = new Set(newLines.map(x => x.trim()).filter(Boolean));
  const removed = oldLines.filter(x => x.trim() && !newSet.has(x.trim())).slice(0, 18);
  const added = newLines.filter(x => x.trim() && !oldSet.has(x.trim())).slice(0, 18);
  return { added, removed };
}

function renderHistoryDialog(selected = 0) {
  const history = getLocalHistory();
  const list = $("#historyList");
  const detail = $("#historyDetail");
  selectedHistoryIndex = Math.max(0, Math.min(selected, history.length - 1));
  if (!list || !detail) return;

  list.innerHTML = history.length ? history.map((h, i) => `
    <button class="history-item ${i === selectedHistoryIndex ? "is-active" : ""}" data-index="${i}" type="button">
      <span class="history-item-title">${escapeHtml(h.reason || "snapshot")}</span>
      <span class="history-item-meta">${escapeHtml(formatFullTime(h.ts))} · ${h.stats?.words || 0} palabras</span>
    </button>
  `).join("") : `<div class="muted" style="padding:12px;">Todavía no hay historial local para esta entrada.</div>`;

  list.querySelectorAll(".history-item").forEach(btn => btn.addEventListener("click", () => renderHistoryDialog(Number(btn.dataset.index || 0))));

  const h = history[selectedHistoryIndex];
  if (!h) {
    detail.innerHTML = `<div class="muted">El historial se llenará automáticamente con autosave y guardados manuales.</div>`;
    return;
  }
  const current = collectPostPayload();
  const diff = bodyLineDiff(h.payload?.body || "", current.body || "");
  detail.innerHTML = `
    <div class="history-diff">
      <div>
        <div class="dlg-title">${escapeHtml(h.payload?.title || "(sin título)")}</div>
        <div class="muted mono">${escapeHtml(formatFullTime(h.ts))} · ${escapeHtml(h.reason || "snapshot")}</div>
      </div>
      <div class="history-stats">
        <span class="badge">${h.stats?.words || 0} palabras</span>
        <span class="badge">${h.stats?.chars || 0} chars</span>
        <span class="badge">${h.stats?.headings || 0} títulos</span>
      </div>
      <div>
        <button class="btn btn-primary" id="btnRestoreSnapshot" type="button">Restaurar esta versión</button>
      </div>
      <div class="history-preview">${escapeHtml((h.payload?.body || "").slice(0, 5000))}</div>
      <div class="history-preview">
        <div class="line-added">+ Añadido desde esta versión hasta ahora:</div>
        ${diff.added.length ? diff.added.map(x => `<div class="line-added">+ ${escapeHtml(x)}</div>`).join("") : `<div class="muted">Sin líneas añadidas relevantes.</div>`}
        <br/>
        <div class="line-removed">− Presente aquí y ausente ahora:</div>
        ${diff.removed.length ? diff.removed.map(x => `<div class="line-removed">− ${escapeHtml(x)}</div>`).join("") : `<div class="muted">Sin líneas removidas relevantes.</div>`}
      </div>
    </div>
  `;
  $("#btnRestoreSnapshot")?.addEventListener("click", () => {
    applyPostPayload(h.payload);
    closeDlg($("#dlgHistory"));
    toast("Versión restaurada localmente");
  });
}

function openHistoryDialog() {
  saveLocalSnapshot("snapshot antes de historial", { force: true });
  renderHistoryDialog(0);
  openDlg($("#dlgHistory"));
}

function readAssets() { return storageGet(EDITOR_STORE.assets, []) || []; }
function writeAssets(assets) { storageSet(EDITOR_STORE.assets, assets.slice(0, 80)); }
function normalizeAsset(asset) {
  return {
    url: String(asset.url || "").trim(),
    alt: String(asset.alt || asset.name || "imagen").trim() || "imagen",
    ts: asset.ts || Date.now()
  };
}
function addAsset(asset) {
  const a = normalizeAsset(asset);
  if (!a.url) return;
  const current = readAssets().filter(x => x.url !== a.url);
  current.unshift(a);
  writeAssets(current);
  renderAssetsGrid();
}
function insertImageMarkdown(asset) {
  insertAtCursor(postBody, `\n![${asset.alt || "imagen"}](${asset.url})\n`);
  closeDlg($("#dlgAssets"));
}
function renderAssetsGrid() {
  const grid = $("#assetsGrid");
  if (!grid) return;
  const assets = readAssets();
  grid.innerHTML = assets.length ? assets.map((a, i) => `
    <div class="asset-card" draggable="true" data-index="${i}">
      <img src="${escapeHtml(a.url)}" alt="${escapeHtml(a.alt)}" loading="lazy" />
      <div class="asset-card-body">
        <div class="asset-card-title" title="${escapeHtml(a.alt)}">${escapeHtml(a.alt)}</div>
        <div class="asset-card-actions">
          <button class="btn" data-action="insert" data-index="${i}" type="button">Insertar</button>
          <button class="btn" data-action="copy" data-index="${i}" type="button">Copiar</button>
        </div>
      </div>
    </div>
  `).join("") : `<div class="muted">No hay assets locales todavía.</div>`;

  grid.querySelectorAll("[data-action='insert']").forEach(btn => btn.addEventListener("click", () => insertImageMarkdown(assets[Number(btn.dataset.index || 0)])));
  grid.querySelectorAll("[data-action='copy']").forEach(btn => btn.addEventListener("click", async () => {
    const a = assets[Number(btn.dataset.index || 0)];
    try { await navigator.clipboard.writeText(a.url); toast("URL copiada"); }
    catch (_e) { toast(a.url); }
  }));
  grid.querySelectorAll(".asset-card").forEach(card => {
    card.addEventListener("dragstart", ev => {
      const a = assets[Number(card.dataset.index || 0)];
      ev.dataTransfer.setData("text/plain", `![${a.alt || "imagen"}](${a.url})`);
    });
  });
}

async function uploadAssetFile(file) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await api("/api/uploads/image", { method: "POST", body: fd });
  addAsset({ url: res.url, alt: file.name });
  return res.url;
}

async function uploadSelectedAssetFiles(files) {
  const arr = Array.from(files || []).filter(f => f.type?.startsWith("image/"));
  if (!arr.length) return toast("Selecciona una imagen", false);
  for (const f of arr) await uploadAssetFile(f);
  toast(`${arr.length} asset(s) subidos`);
}

function openAssetsDialog() {
  renderAssetsGrid();
  openDlg($("#dlgAssets"));
}

function setFocusWriting(enabled, persist = true) {
  const value = Boolean(enabled);
  document.body.classList.toggle("focus-writing", value);
  const btn = $("#btnFocusMode");
  if (btn) {
    btn.classList.toggle("is-active", value);
    btn.setAttribute("aria-pressed", String(value));
    btn.title = value ? "Salir de modo foco" : "Modo foco";
    btn.setAttribute("aria-label", value ? "Salir de modo foco" : "Modo foco");
  }
  if (persist) writeBoolPref(UI_PREFS.focusWriting, value);
  requestAnimationFrame(syncEditorPanelHeights);
}

function editorialCommands() {
  return [
    { id: "save", icon: "✓", title: "Guardar entrada", desc: "Guarda en el backend", run: () => $("#btnSavePost")?.click() },
    { id: "publish", icon: "↑", title: "Publicar cambios", desc: "Commit y push del contenido", run: () => $("#btnPublish")?.click() },
    { id: "focus", icon: "⛶", title: "Modo foco", desc: "Oculta navegación y paneles", run: () => setFocusWriting(!document.body.classList.contains("focus-writing")) },
    { id: "assets", icon: "🗂", title: "Assets", desc: "Abrir librería local de imágenes", run: openAssetsDialog },
    { id: "posts", icon: "✎", title: "Entradas", desc: "Volver al editor principal", run: () => document.querySelector('[data-tab="posts"]')?.click() },
    { id: "templates", icon: "▧", title: "Plantillas", desc: "Renderizar, auditar y aplicar plantillas", run: () => document.querySelector('[data-tab="templates"]')?.click() },
    { id: "health", icon: "✓", title: "Salud editorial", desc: "Revisar checklist, widgets y pendientes", run: () => document.querySelector('[data-tab="health"]')?.click() },
    { id: "authors", icon: "👤", title: "Autores", desc: "Abrir panel de perfiles de autor", run: () => document.querySelector('[data-tab="authors"]')?.click() },
    { id: "references", icon: "[@]", title: "Referencias", desc: "Abrir biblioteca bibliográfica", run: () => document.querySelector('[data-tab="references"]')?.click() },
    { id: "resources", icon: "✦", title: "Recursos", desc: "Abrir biblioteca de recursos recomendados", run: () => document.querySelector('[data-tab="resources"]')?.click() },
    { id: "widgets", icon: "▧", title: "Widgets", desc: "Abrir bloques interactivos de contenido", run: () => document.querySelector('[data-tab="widgets"]')?.click() },
    { id: "history", icon: "↺", title: "Historial local", desc: "Autosaves, snapshots y restauración", run: openHistoryDialog },
    { id: "preview", icon: "◐", title: "Preview", desc: "Mostrar/ocultar preview", run: togglePreviewPane },
    { id: "details", icon: "⚙", title: "Detalles", desc: "Mostrar/ocultar metadata", run: () => setPostDetailsCollapsed(!$("#postDetails")?.classList.contains("is-collapsed")) },
    { id: "library", icon: "▥", title: "Selector de entradas", desc: "Mostrar/ocultar biblioteca", run: () => setPostsLibraryCollapsed(!document.body.classList.contains("posts-library-collapsed")) },
    { id: "new", icon: "＋", title: "Nueva entrada", desc: "Limpia el editor", run: clearPostEditor },
    ...SLASH_COMMANDS.map(cmd => ({ id: `slash-${cmd.id}`, icon: cmd.icon, title: `/${cmd.id} · ${cmd.title}`, desc: cmd.desc, run: () => cmd.run() }))
  ];
}

function renderCommandPalette(query = "") {
  const list = $("#commandPaletteList");
  if (!list) return;
  const q = String(query || "").toLowerCase().trim();
  commandPaletteItems = editorialCommands().filter(cmd => `${cmd.id} ${cmd.title} ${cmd.desc}`.toLowerCase().includes(q));
  commandPaletteIndex = Math.max(0, Math.min(commandPaletteIndex, commandPaletteItems.length - 1));
  list.innerHTML = commandPaletteItems.length ? commandPaletteItems.map((cmd, i) => `
    <button class="command-item ${i === commandPaletteIndex ? "is-selected" : ""}" data-index="${i}" type="button">
      <span class="slash-icon">${escapeHtml(cmd.icon)}</span>
      <span><span class="slash-title">${escapeHtml(cmd.title)}</span><span class="slash-desc">${escapeHtml(cmd.desc)}</span></span>
      <span class="command-kbd">Enter</span>
    </button>
  `).join("") : `<div class="slash-empty">Sin resultados.</div>`;
  list.querySelectorAll(".command-item").forEach(btn => btn.addEventListener("click", () => runCommandPaletteItem(Number(btn.dataset.index || 0))));
}
function runCommandPaletteItem(index = commandPaletteIndex) {
  const cmd = commandPaletteItems[index];
  if (!cmd) return;
  closeDlg($("#dlgCommandPalette"));
  cmd.run();
}
function openCommandPalette() {
  const dlg = $("#dlgCommandPalette");
  const input = $("#commandPaletteInput");
  if (!dlg || !input) return;
  input.value = "";
  commandPaletteIndex = 0;
  renderCommandPalette("");
  openDlg(dlg);
  setTimeout(() => input.focus(), 30);
}

function initEditorialSuite() {
  setFocusWriting(readBoolPref(UI_PREFS.focusWriting, false), false);

  $("#btnFocusMode")?.addEventListener("click", () => setFocusWriting(!document.body.classList.contains("focus-writing")));
  $("#btnOpenHistory")?.addEventListener("click", openHistoryDialog);
  $("#btnOpenAssets")?.addEventListener("click", openAssetsDialog);
  $("#btnOpenCommandPalette")?.addEventListener("click", openCommandPalette);

  ["#postTitle", "#postDate", "#postSection", "#postLang", "#postTranslationId", "#postTags", "#postAuthors", "#postReferences", "#postCover", "#postExcerpt", "#postId"].forEach(sel => {
    const el = $(sel);
    if (!el) return;
    el.addEventListener("input", () => { refreshPostHeader(); scheduleAutosave(); });
    el.addEventListener("change", () => { refreshPostHeader(); scheduleAutosave(); });
  });

  $("#btnClearHistory")?.addEventListener("click", () => {
    if (!confirm("¿Limpiar historial local de esta entrada?")) return;
    storageRemove(historyKey());
    renderHistoryDialog(0);
    toast("Historial local limpiado");
  });

  $("#btnAddAssetUrl")?.addEventListener("click", () => {
    const url = $("#assetUrl")?.value.trim();
    if (!url) return toast("Pega una URL", false);
    addAsset({ url, alt: $("#assetAlt")?.value.trim() || "imagen" });
    $("#assetUrl").value = "";
    $("#assetAlt").value = "";
    toast("Asset añadido");
  });
  $("#btnUploadAsset")?.addEventListener("click", () => uploadSelectedAssetFiles($("#assetFile")?.files));
  $("#btnClearAssets")?.addEventListener("click", () => {
    if (!confirm("¿Limpiar librería local de assets?")) return;
    writeAssets([]); renderAssetsGrid(); toast("Assets locales limpiados");
  });

  const drop = $("#assetDropzone");
  if (drop) {
    ["dragenter", "dragover"].forEach(name => drop.addEventListener(name, ev => { ev.preventDefault(); drop.classList.add("is-dragover"); }));
    ["dragleave", "drop"].forEach(name => drop.addEventListener(name, ev => { ev.preventDefault(); drop.classList.remove("is-dragover"); }));
    drop.addEventListener("drop", ev => uploadSelectedAssetFiles(ev.dataTransfer?.files));
  }

  const input = $("#commandPaletteInput");
  input?.addEventListener("input", () => { commandPaletteIndex = 0; renderCommandPalette(input.value); });
  input?.addEventListener("keydown", ev => {
    if (ev.key === "ArrowDown") { ev.preventDefault(); commandPaletteIndex = Math.min(commandPaletteIndex + 1, Math.max(0, commandPaletteItems.length - 1)); renderCommandPalette(input.value); }
    if (ev.key === "ArrowUp") { ev.preventDefault(); commandPaletteIndex = Math.max(0, commandPaletteIndex - 1); renderCommandPalette(input.value); }
    if (ev.key === "Enter") { ev.preventDefault(); runCommandPaletteItem(); }
  });

  document.addEventListener("keydown", ev => {
    const isPalette = (ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "k";
    if (isPalette) { ev.preventDefault(); openCommandPalette(); }
    if (ev.key === "Escape" && document.body.classList.contains("focus-writing")) setFocusWriting(false);
  });

  window.addEventListener("beforeunload", () => { if (autosaveDirty) saveLocalDraft("beforeunload"); });
  updateEditorDerivedViews();
}


// ---- AUTHORS + REFERENCES
let currentAuthorId = "";
let currentReferenceId = "";
let currentResourceId = "";
let currentWidgetId = "";

function authorPayloadFromForm() {
  return {
    id: $("#authorId")?.value.trim() || slugifyId($("#authorName")?.value, "author"),
    name: $("#authorName")?.value.trim() || "",
    role: $("#authorRole")?.value.trim() || "",
    affiliation: $("#authorAffiliation")?.value.trim() || "",
    avatar: $("#authorAvatar")?.value.trim() || "",
    url: $("#authorUrl")?.value.trim() || "",
    email: $("#authorEmail")?.value.trim() || "",
    tags: parseTags($("#authorTags")?.value || ""),
    bio: $("#authorBio")?.value.trim() || ""
  };
}

function referencePayloadFromForm() {
  return {
    id: $("#referenceId")?.value.trim() || slugifyId($("#referenceTitle")?.value, "ref"),
    title: $("#referenceTitle")?.value.trim() || "",
    type: $("#referenceType")?.value || "article",
    year: $("#referenceYear")?.value.trim() || "",
    authors: $("#referenceAuthors")?.value.trim() || "",
    venue: $("#referenceVenue")?.value.trim() || "",
    doi: $("#referenceDoi")?.value.trim() || "",
    url: $("#referenceUrl")?.value.trim() || "",
    tags: parseTags($("#referenceTags")?.value || ""),
    citation: $("#referenceCitation")?.value.trim() || "",
    notes: $("#referenceNotes")?.value.trim() || ""
  };
}


const RESOURCE_TYPE_LABELS = {
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

const RESOURCE_TYPE_ICONS = {
  music: "♫",
  book: "📘",
  paper: "paper",
  article: "↗",
  video: "▶",
  tool: "⚙",
  product: "◈",
  service: "▣",
  dataset: "data",
  website: "web",
  other: "✦"
};

function resourceTypeLabel(type) {
  return RESOURCE_TYPE_LABELS[String(type || "other").toLowerCase()] || RESOURCE_TYPE_LABELS.other;
}

function resourceTypeIcon(type) {
  return RESOURCE_TYPE_ICONS[String(type || "other").toLowerCase()] || RESOURCE_TYPE_ICONS.other;
}

function resourcePayloadFromForm() {
  return {
    id: $("#resourceId")?.value.trim() || slugifyId($("#resourceTitle")?.value || "resource", "resource"),
    type: $("#resourceType")?.value || "other",
    title: $("#resourceTitle")?.value.trim() || "",
    creator: $("#resourceCreator")?.value.trim() || "",
    year: $("#resourceYear")?.value.trim() || "",
    url: $("#resourceUrl")?.value.trim() || "",
    tags: parseTags($("#resourceTags")?.value || ""),
    relation: $("#resourceRelation")?.value.trim() || "",
    note: $("#resourceNote")?.value.trim() || ""
  };
}

function renderAuthors() {
  const list = $("#authorsList");
  if (!list) return;
  const q = String($("#authorsSearch")?.value || "").toLowerCase().trim();
  const items = (INDEX.authors || []).filter(a => {
    const hay = `${a.id} ${a.name} ${a.role} ${a.affiliation} ${(a.tags||[]).join(" ")} ${a.bio||""}`.toLowerCase();
    return !q || hay.includes(q);
  }).sort((a,b) => String(a.name || a.id).localeCompare(String(b.name || b.id)));
  $("#authorsCount").textContent = `${items.length} autor(es)`;
  list.innerHTML = items.length ? items.map(a => `
    <div class="item entity-item ${a.id === currentAuthorId ? "is-current" : ""}" data-id="${escapeAttr(a.id)}">
      <div class="entity-row-main">
        ${a.avatar ? `<img class="entity-thumb" src="${escapeAttr(a.avatar)}" alt="${escapeAttr(a.name || a.id)}"/>` : `<div class="entity-thumb entity-thumb-placeholder">👤</div>`}
        <div>
          <div class="item-title">${escapeHtml(a.name || a.id)}</div>
          <div class="meta">
            ${a.role ? `<span class="badge">${escapeHtml(a.role)}</span>` : ""}
            ${a.affiliation ? `<span class="muted">${escapeHtml(a.affiliation)}</span>` : ""}
            ${a.__local ? `<span class="badge local-badge">LOCAL</span>` : ""}
          </div>
        </div>
      </div>
      <button class="mini-action" data-copy-author="${escapeAttr(a.id)}" type="button" title="Copiar ID">⧉</button>
    </div>
  `).join("") : `<div class="muted" style="padding:10px;">No hay autores.</div>`;
  list.querySelectorAll(".entity-item").forEach(el => el.addEventListener("click", () => loadAuthor(el.dataset.id)));
  list.querySelectorAll("[data-copy-author]").forEach(btn => btn.addEventListener("click", ev => {
    ev.stopPropagation(); copyTextToClipboard(btn.dataset.copyAuthor, "ID de autor copiado");
  }));
  renderPostAuthorPicker();
  renderArticleAuthorshipPreview();
}

function renderReferences() {
  const list = $("#referencesList");
  if (!list) return;
  const q = String($("#referencesSearch")?.value || "").toLowerCase().trim();
  const type = String($("#referencesTypeFilter")?.value || "").trim();
  const items = (INDEX.references || []).filter(r => {
    const hay = `${r.id} ${r.title} ${r.authors} ${r.year} ${r.venue} ${r.doi} ${(r.tags||[]).join(" ")} ${r.citation||""}`.toLowerCase();
    if (q && !hay.includes(q)) return false;
    if (type && r.type !== type) return false;
    return true;
  }).sort((a,b) => String(b.year || "0").localeCompare(String(a.year || "0")) || String(a.title || a.id).localeCompare(String(b.title || b.id)));
  $("#referencesCount").textContent = `${items.length} referencia(s)`;
  list.innerHTML = items.length ? items.map(r => `
    <div class="item entity-item reference-item ${r.id === currentReferenceId ? "is-current" : ""}" data-id="${escapeAttr(r.id)}">
      <div>
        <div class="item-title">${escapeHtml(r.title || r.id)}</div>
        <div class="meta">
          <span class="badge">${escapeHtml(r.type || "ref")}</span>
          ${r.year ? `<span class="badge">${escapeHtml(r.year)}</span>` : ""}
          ${r.authors ? `<span class="muted">${escapeHtml(r.authors)}</span>` : ""}
          ${r.__local ? `<span class="badge local-badge">LOCAL</span>` : ""}
        </div>
      </div>
      <button class="mini-action" data-copy-ref="${escapeAttr(r.id)}" type="button" title="Copiar cita inline">[@]</button>
    </div>
  `).join("") : `<div class="muted" style="padding:10px;">No hay referencias.</div>`;
  list.querySelectorAll(".entity-item").forEach(el => el.addEventListener("click", () => loadReference(el.dataset.id)));
  list.querySelectorAll("[data-copy-ref]").forEach(btn => btn.addEventListener("click", ev => {
    ev.stopPropagation(); copyTextToClipboard(`[@${btn.dataset.copyRef}]`, "Cita inline copiada");
  }));
}

function loadAuthor(id) {
  const a = (INDEX.authors || []).find(x => x.id === id);
  if (!a) return;
  currentAuthorId = a.id;
  $("#authorEditorHint").textContent = `Editando: ${a.id}${a.__local ? " · local" : ""}`;
  $("#authorId").value = a.id || "";
  $("#authorName").value = a.name || "";
  $("#authorRole").value = a.role || "";
  $("#authorAffiliation").value = a.affiliation || "";
  $("#authorAvatar").value = a.avatar || "";
  $("#authorUrl").value = a.url || "";
  $("#authorEmail").value = a.email || "";
  $("#authorTags").value = (a.tags || []).join(", ");
  $("#authorBio").value = a.bio || "";
  renderAuthorLivePreview();
  renderAuthors();
}

function clearAuthorEditor() {
  currentAuthorId = "";
  $("#authorEditorHint").textContent = "Nuevo autor";
  ["#authorId", "#authorName", "#authorRole", "#authorAffiliation", "#authorAvatar", "#authorUrl", "#authorEmail", "#authorTags", "#authorBio"].forEach(sel => { if ($(sel)) $(sel).value = ""; });
  renderAuthorLivePreview();
  renderAuthors();
}

function loadReference(id) {
  const r = (INDEX.references || []).find(x => x.id === id);
  if (!r) return;
  currentReferenceId = r.id;
  $("#referenceEditorHint").textContent = `Editando: ${r.id}${r.__local ? " · local" : ""}`;
  $("#referenceId").value = r.id || "";
  $("#referenceTitle").value = r.title || "";
  $("#referenceType").value = r.type || "article";
  $("#referenceYear").value = r.year || "";
  $("#referenceAuthors").value = r.authors || "";
  $("#referenceVenue").value = r.venue || "";
  $("#referenceDoi").value = r.doi || "";
  $("#referenceUrl").value = r.url || "";
  $("#referenceTags").value = (r.tags || []).join(", ");
  $("#referenceCitation").value = r.citation || "";
  $("#referenceNotes").value = r.notes || "";
  renderReferenceLivePreview();
  renderReferences();
}

function clearReferenceEditor() {
  currentReferenceId = "";
  $("#referenceEditorHint").textContent = "Nueva referencia";
  ["#referenceId", "#referenceTitle", "#referenceYear", "#referenceAuthors", "#referenceVenue", "#referenceDoi", "#referenceUrl", "#referenceTags", "#referenceCitation", "#referenceNotes"].forEach(sel => { if ($(sel)) $(sel).value = ""; });
  if ($("#referenceType")) $("#referenceType").value = "article";
  renderReferenceLivePreview();
  renderReferences();
}

function renderAuthorLivePreview() {
  const el = $("#authorLivePreview");
  if (!el) return;
  const a = authorPayloadFromForm();
  el.innerHTML = `
    <div class="entity-preview-card author-preview-card ${a.avatar ? "has-avatar" : "no-avatar"}">
      ${a.avatar ? `<img class="entity-avatar" src="${escapeAttr(a.avatar)}" alt="${escapeAttr(a.name || a.id)}"/>` : ""}
      <div>
        <div class="entity-preview-title">${escapeHtml(a.name || "Autor sin nombre")}</div>
        <div class="entity-preview-meta">${escapeHtml([a.role, a.affiliation].filter(Boolean).join(" · ") || "Autor")}</div>
        ${a.bio ? `<div class="entity-preview-body">${escapeHtml(a.bio)}</div>` : ""}
      </div>
    </div>`;
}

function renderReferenceLivePreview() {
  const el = $("#referenceLivePreview");
  if (!el) return;
  const r = referencePayloadFromForm();
  const citation = r.citation || [r.authors, r.year ? `(${r.year})` : "", r.title, r.venue].filter(Boolean).join(". ");
  el.innerHTML = `
    <div class="entity-preview-card reference-preview-card">
      <div class="entity-preview-title">${escapeHtml(r.title || "Referencia sin título")}</div>
      <div class="entity-preview-meta">${escapeHtml([r.type || "referencia", r.year, r.venue].filter(Boolean).join(" · "))}</div>
      ${citation ? `<div class="entity-preview-body">${escapeHtml(citation)}</div>` : ""}
      ${r.doi || r.url ? `<div class="entity-preview-links">${r.doi ? `DOI: ${escapeHtml(r.doi)}` : ""}${r.doi && r.url ? " · " : ""}${r.url ? `<a href="${escapeAttr(r.url)}" target="_blank" rel="noopener noreferrer">Abrir fuente</a>` : ""}</div>` : ""}
    </div>`;
}

$("#postAuthors")?.addEventListener("input", () => {
  renderPostAuthorPicker();
  renderArticleAuthorshipPreview();
  updateEditorDerivedViews();
});

["#authorName", "#authorRole", "#authorAffiliation", "#authorAvatar", "#authorUrl", "#authorEmail", "#authorTags", "#authorBio"].forEach(sel => $(sel)?.addEventListener("input", renderAuthorLivePreview));
["#referenceTitle", "#referenceType", "#referenceYear", "#referenceAuthors", "#referenceVenue", "#referenceDoi", "#referenceUrl", "#referenceTags", "#referenceCitation", "#referenceNotes"].forEach(sel => {
  $(sel)?.addEventListener("input", renderReferenceLivePreview);
  $(sel)?.addEventListener("change", renderReferenceLivePreview);
});
$("#authorsSearch")?.addEventListener("input", renderAuthors);
$("#referencesSearch")?.addEventListener("input", renderReferences);
$("#referencesTypeFilter")?.addEventListener("change", renderReferences);
$("#btnNewAuthor")?.addEventListener("click", clearAuthorEditor);
$("#btnNewReference")?.addEventListener("click", clearReferenceEditor);
$("#btnSaveAuthor")?.addEventListener("click", async () => {
  const payload = authorPayloadFromForm();
  if (!payload.name) return toast("El autor necesita nombre", false);
  const id = await upsertEntity("authors", payload, "authors");
  loadAuthor(id);
  updateEditorDerivedViews();
});
$("#btnSaveReference")?.addEventListener("click", async () => {
  const payload = referencePayloadFromForm();
  if (!payload.title) return toast("La referencia necesita título", false);
  const id = await upsertEntity("references", payload, "references");
  loadReference(id);
  updateEditorDerivedViews();
});
$("#btnDeleteAuthor")?.addEventListener("click", async () => {
  const id = $("#authorId")?.value || currentAuthorId;
  await deleteEntity("authors", id, "authors");
  clearAuthorEditor();
});
$("#btnDeleteReference")?.addEventListener("click", async () => {
  const id = $("#referenceId")?.value || currentReferenceId;
  await deleteEntity("references", id, "references");
  clearReferenceEditor();
});


function renderResources() {
  const list = $("#resourcesList");
  if (!list) return;
  const q = String($("#resourcesSearch")?.value || "").toLowerCase().trim();
  const type = String($("#resourcesTypeFilter")?.value || "").trim();

  const items = (INDEX.resources || []).filter(r => {
    const hay = `${r.id} ${r.type} ${r.title} ${r.creator} ${r.year} ${r.url} ${r.relation} ${(r.tags||[]).join(" ")} ${r.note||""}`.toLowerCase();
    if (q && !hay.includes(q)) return false;
    if (type && r.type !== type) return false;
    return true;
  }).sort((a,b) => String(a.type || "").localeCompare(String(b.type || "")) || String(a.title || a.id).localeCompare(String(b.title || b.id), "es", { sensitivity: "base" }));

  $("#resourcesCount").textContent = `${items.length} recurso(s)`;
  list.innerHTML = items.length ? items.map(r => `
    <div class="item entity-item resource-item ${r.id === currentResourceId ? "is-current" : ""}" data-id="${escapeAttr(r.id)}">
      <div class="resource-row-main">
        <div class="resource-type-icon" aria-hidden="true">${escapeHtml(resourceTypeIcon(r.type))}</div>
        <div>
          <div class="item-title">${escapeHtml(r.title || r.id)}</div>
          <div class="meta">
            <span class="badge">${escapeHtml(resourceTypeLabel(r.type))}</span>
            ${r.creator ? `<span class="muted">${escapeHtml(r.creator)}</span>` : ""}
            ${r.year ? `<span class="badge">${escapeHtml(r.year)}</span>` : ""}
            ${r.__local ? `<span class="badge local-badge">LOCAL</span>` : ""}
          </div>
        </div>
      </div>
      <button class="mini-action" data-copy-resource="${escapeAttr(r.id)}" type="button" title="Copiar bloque">✦</button>
    </div>
  `).join("") : `<div class="muted" style="padding:10px;">No hay recursos.</div>`;

  list.querySelectorAll(".entity-item").forEach(el => el.addEventListener("click", () => loadResource(el.dataset.id)));
  list.querySelectorAll("[data-copy-resource]").forEach(btn => btn.addEventListener("click", ev => {
    ev.stopPropagation();
    copyTextToClipboard(`[[resource:${btn.dataset.copyResource}]]`, "Bloque de recurso copiado");
  }));
}

function loadResource(id) {
  const r = (INDEX.resources || []).find(x => x.id === id);
  if (!r) return;
  currentResourceId = r.id;
  $("#resourceEditorHint").textContent = `Editando: ${r.id}${r.__local ? " · local" : ""}`;
  $("#resourceId").value = r.id || "";
  $("#resourceTitle").value = r.title || "";
  $("#resourceType").value = r.type || "other";
  $("#resourceCreator").value = r.creator || "";
  $("#resourceYear").value = r.year || "";
  $("#resourceUrl").value = r.url || "";
  $("#resourceTags").value = (r.tags || []).join(", ");
  $("#resourceRelation").value = r.relation || "";
  $("#resourceNote").value = r.note || "";
  renderResourceLivePreview();
  renderResources();
}

function clearResourceEditor() {
  currentResourceId = "";
  $("#resourceEditorHint").textContent = "Nuevo recurso";
  ["#resourceId", "#resourceTitle", "#resourceCreator", "#resourceYear", "#resourceUrl", "#resourceTags", "#resourceRelation", "#resourceNote"].forEach(sel => { if ($(sel)) $(sel).value = ""; });
  if ($("#resourceType")) $("#resourceType").value = "music";
  renderResourceLivePreview();
  renderResources();
}

function renderResourceLivePreview() {
  const el = $("#resourceLivePreview");
  if (!el) return;
  const r = resourcePayloadFromForm();
  const meta = [r.creator, r.year, r.relation].filter(Boolean).join(" · ");
  el.innerHTML = `
    <div class="entity-preview-card resource-preview-card">
      <div class="resource-preview-icon" aria-hidden="true">${escapeHtml(resourceTypeIcon(r.type))}</div>
      <div>
        <div class="entity-preview-meta">${escapeHtml(resourceTypeLabel(r.type))}</div>
        <div class="entity-preview-title">${escapeHtml(r.title || "Recurso sin título")}</div>
        ${meta ? `<div class="entity-preview-meta">${escapeHtml(meta)}</div>` : ""}
        ${r.note ? `<div class="entity-preview-body">${escapeHtml(r.note)}</div>` : ""}
        ${r.url ? `<div class="entity-preview-links"><a href="${escapeAttr(r.url)}" target="_blank" rel="noopener noreferrer">Abrir recurso</a></div>` : ""}
      </div>
    </div>`;
}

["#resourceTitle", "#resourceType", "#resourceCreator", "#resourceYear", "#resourceUrl", "#resourceTags", "#resourceRelation", "#resourceNote"].forEach(sel => {
  $(sel)?.addEventListener("input", renderResourceLivePreview);
  $(sel)?.addEventListener("change", renderResourceLivePreview);
});
$("#resourcesSearch")?.addEventListener("input", renderResources);
$("#resourcesTypeFilter")?.addEventListener("change", renderResources);
$("#btnNewResource")?.addEventListener("click", clearResourceEditor);
$("#btnSaveResource")?.addEventListener("click", async () => {
  const payload = resourcePayloadFromForm();
  if (!payload.title) return toast("El recurso necesita título", false);
  const id = await upsertEntity("resources", payload, "resources");
  loadResource(id);
  updateEditorDerivedViews();
});
$("#btnDeleteResource")?.addEventListener("click", async () => {
  const id = $("#resourceId")?.value || currentResourceId;
  await deleteEntity("resources", id, "resources");
  clearResourceEditor();
});


// ---- WIDGETS
const WIDGET_TYPE_LABELS = {
  callout: "Idea clave",
  image: "Imagen",
  "image-compare": "Comparador",
  video: "Video",
  scrollbox: "Ventana",
  table: "Tabla",
  chart: "Gráfico",
  metrics: "Métricas",
  "product-preview": "Preview producto",
  "service-preview": "Preview servicio",
  demo: "Demo"
};
const WIDGET_TYPE_ICONS = {
  callout: "💡",
  image: "🖼",
  "image-compare": "⇄",
  video: "▶",
  scrollbox: "▤",
  table: "▦",
  chart: "📊",
  metrics: "▥",
  "product-preview": "◈",
  "service-preview": "▣",
  demo: "🧪"
};
const WIDGET_TYPES = Object.keys(WIDGET_TYPE_LABELS);

function widgetTypeLabel(type) {
  return WIDGET_TYPE_LABELS[String(type || "callout").toLowerCase()] || WIDGET_TYPE_LABELS.callout;
}
function widgetTypeIcon(type) {
  return WIDGET_TYPE_ICONS[String(type || "callout").toLowerCase()] || WIDGET_TYPE_ICONS.callout;
}
function parseWidgetConfig(raw) {
  const text = typeof raw === "string" ? raw.trim() : JSON.stringify(raw || {});
  if (!text || text === "{}") return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (_e) {
    return {};
  }
}
function widgetConfigString(obj) {
  const clean = obj && typeof obj === "object" ? obj : {};
  return Object.keys(clean).length ? JSON.stringify(clean, null, 2) : "";
}
function csvTextToTable(text) {
  const lines = String(text || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map(x => x.trim())
    .filter(Boolean);
  if (!lines.length) return { columns: [], rows: [] };
  const split = (line) => {
    const delimiter = line.includes("\t") ? "\t" : ",";
    return line.split(delimiter).map(x => x.trim());
  };
  return { columns: split(lines[0]), rows: lines.slice(1).map(split) };
}
function tableToCsvText(columns = [], rows = []) {
  const lines = [];
  if (Array.isArray(columns) && columns.length) lines.push(columns.join(","));
  if (Array.isArray(rows)) rows.forEach(row => lines.push((Array.isArray(row) ? row : []).join(",")));
  return lines.join("\n");
}
function chartTextToConfig(text) {
  const table = csvTextToTable(text);
  const labels = [];
  const values = [];
  for (const row of table.rows || []) {
    if (!row.length) continue;
    labels.push(row[0]);
    const n = Number(String(row[1] ?? "").replace(",", "."));
    values.push(Number.isFinite(n) ? n : 0);
  }
  return { labels, values };
}
function chartConfigToText(cfg = {}) {
  const labels = Array.isArray(cfg.labels) ? cfg.labels : [];
  const values = Array.isArray(cfg.values) ? cfg.values : [];
  const rows = labels.map((label, i) => [label, values[i] ?? ""]);
  return tableToCsvText([cfg.xLabel || "x", cfg.yLabel || "y"], rows);
}
function metricsTextToConfig(text) {
  const table = csvTextToTable(text);
  const metrics = (table.rows || []).map(row => ({
    label: row[0] || "",
    value: row[1] || "",
    unit: row[2] || "",
    note: row[3] || ""
  })).filter(x => x.label || x.value);
  return { metrics };
}
function metricsConfigToText(cfg = {}) {
  const metrics = Array.isArray(cfg.metrics) ? cfg.metrics : [];
  const rows = metrics.map(m => [m.label || "", m.value || "", m.unit || "", m.note || ""]);
  return tableToCsvText(["Métrica", "Valor", "Unidad", "Nota"], rows);
}
function setFieldValue(sel, value = "") {
  const el = $(sel);
  if (el) el.value = value ?? "";
}
function getFieldValue(sel) {
  return ($(sel)?.value || "").trim();
}
function setWidgetType(type, preserve = true) {
  const cleanType = WIDGET_TYPES.includes(String(type || "").toLowerCase()) ? String(type).toLowerCase() : "callout";
  const typeEl = $("#widgetType");
  if (typeEl) typeEl.value = cleanType;

  document.querySelectorAll(".widget-type-tile[data-widget-type]").forEach(btn => {
    btn.classList.toggle("is-active", btn.dataset.widgetType === cleanType);
    btn.setAttribute("aria-pressed", String(btn.dataset.widgetType === cleanType));
  });
  document.querySelectorAll(".widget-fields[data-widget-panel]").forEach(panel => {
    panel.classList.toggle("is-active", panel.dataset.widgetPanel === cleanType);
  });

  populateWidgetRelationOptions(cleanType);
  if (!preserve) seedWidgetDefaults(cleanType);
  renderWidgetLivePreview();
}
function seedWidgetDefaults(type) {
  if (type === "table" && !getFieldValue("#widgetTableCsv")) {
    setFieldValue("#widgetTableCsv", "Parámetro,Valor,Unidad\nPorosidad,0.34,%\nUmbral,128,px");
  }
  if (type === "chart" && !getFieldValue("#widgetChartData")) {
    setFieldValue("#widgetChartData", "Umbral,Porosidad\n10,0.12\n20,0.19\n30,0.27");
  }
  if (type === "metrics" && !getFieldValue("#widgetMetricsCsv")) {
    setFieldValue("#widgetMetricsCsv", "Métrica,Valor,Unidad,Nota\nPorosidad,34,%,Promedio estimado\nUmbral,128,px,Valor usado");
  }
  if (type === "image-compare") {
    if (!getFieldValue("#widgetCompareBeforeLabel")) setFieldValue("#widgetCompareBeforeLabel", "Antes");
    if (!getFieldValue("#widgetCompareAfterLabel")) setFieldValue("#widgetCompareAfterLabel", "Después");
    if (!getFieldValue("#widgetCompareSplit")) setFieldValue("#widgetCompareSplit", "50");
  }
  if (type === "demo") {
    if (!getFieldValue("#widgetDemoVariable")) setFieldValue("#widgetDemoVariable", "Umbral");
    if (!getFieldValue("#widgetDemoMin")) setFieldValue("#widgetDemoMin", "0");
    if (!getFieldValue("#widgetDemoMax")) setFieldValue("#widgetDemoMax", "255");
    if (!getFieldValue("#widgetDemoInitial")) setFieldValue("#widgetDemoInitial", "128");
  }
}
function populateSelectOptions(select, items, emptyLabel) {
  if (!select) return;
  const current = select.value;
  const options = [`<option value="">${escapeHtml(emptyLabel)}</option>`].concat(
    items.map(item => `<option value="${escapeAttr(item.id)}">${escapeHtml(item.label)}</option>`)
  );
  select.innerHTML = options.join("");
  if (current && items.some(item => item.id === current)) select.value = current;
}
function populateWidgetRelationOptions(type = $("#widgetType")?.value || "callout") {
  if (type === "product-preview") {
    populateSelectOptions($("#widgetProductTarget"), currentProductOptions().map(x => ({ id: x.id, label: x.label })), "Selecciona un producto");
  }
  if (type === "service-preview") {
    populateSelectOptions($("#widgetServiceTarget"), currentServiceOptions().map(x => ({ id: x.id, label: x.label })), "Selecciona un servicio");
  }
}
function widgetPayloadFromBuilder() {
  const type = String($("#widgetType")?.value || "callout").toLowerCase();
  let sourceUrl = "";
  let targetId = "";
  let body = "";
  let config = {};

  if (type === "callout") {
    body = getFieldValue("#widgetCalloutBody");
    config = {
      variant: getFieldValue("#widgetCalloutTone") || "insight",
      label: getFieldValue("#widgetCalloutLabel")
    };
  } else if (type === "image") {
    sourceUrl = getFieldValue("#widgetImageUrl");
    body = getFieldValue("#widgetImageCaption");
    config = {
      alt: getFieldValue("#widgetImageAlt"),
      caption: getFieldValue("#widgetImageCaption"),
      credit: getFieldValue("#widgetImageCredit"),
      mode: getFieldValue("#widgetImageMode") || "inline"
    };
  } else if (type === "image-compare") {
    sourceUrl = getFieldValue("#widgetCompareBeforeUrl");
    body = getFieldValue("#widgetCompareCaption");
    config = {
      beforeUrl: getFieldValue("#widgetCompareBeforeUrl"),
      afterUrl: getFieldValue("#widgetCompareAfterUrl"),
      beforeLabel: getFieldValue("#widgetCompareBeforeLabel") || "Antes",
      afterLabel: getFieldValue("#widgetCompareAfterLabel") || "Después",
      alt: getFieldValue("#widgetCompareAlt"),
      caption: getFieldValue("#widgetCompareCaption"),
      split: Number(getFieldValue("#widgetCompareSplit") || 50)
    };
  } else if (type === "video") {
    sourceUrl = getFieldValue("#widgetVideoUrl");
    body = getFieldValue("#widgetVideoBody");
    config = {
      thumbnail: getFieldValue("#widgetVideoThumb"),
      load: getFieldValue("#widgetVideoLoad") || "lazy"
    };
  } else if (type === "table") {
    body = getFieldValue("#widgetTableCsv");
    const parsed = csvTextToTable(body);
    config = {
      description: getFieldValue("#widgetTableDescription"),
      density: getFieldValue("#widgetTableDensity") || "comfortable",
      columns: parsed.columns,
      rows: parsed.rows
    };
  } else if (type === "chart") {
    body = getFieldValue("#widgetChartDescription");
    const chart = chartTextToConfig(getFieldValue("#widgetChartData"));
    config = {
      chartType: getFieldValue("#widgetChartType") || "bar",
      xLabel: getFieldValue("#widgetChartXLabel"),
      yLabel: getFieldValue("#widgetChartYLabel"),
      labels: chart.labels,
      values: chart.values
    };
  } else if (type === "metrics") {
    body = getFieldValue("#widgetMetricsDescription");
    const metricConfig = metricsTextToConfig(getFieldValue("#widgetMetricsCsv"));
    config = {
      description: getFieldValue("#widgetMetricsDescription"),
      metrics: metricConfig.metrics
    };
  } else if (type === "scrollbox") {
    body = getFieldValue("#widgetScrollBody");
    config = {
      label: getFieldValue("#widgetScrollLabel") || "Detalle técnico",
      height: getFieldValue("#widgetScrollHeight") || "medium"
    };
  } else if (type === "product-preview") {
    targetId = getFieldValue("#widgetProductTarget");
    body = getFieldValue("#widgetProductNote");
    config = { mode: getFieldValue("#widgetProductMode") || "compact" };
  } else if (type === "service-preview") {
    targetId = getFieldValue("#widgetServiceTarget");
    body = getFieldValue("#widgetServiceNote");
    config = { mode: getFieldValue("#widgetServiceMode") || "compact" };
  } else if (type === "demo") {
    body = getFieldValue("#widgetDemoBody");
    config = {
      demoType: getFieldValue("#widgetDemoKind") || "slider",
      variable: getFieldValue("#widgetDemoVariable"),
      min: Number(getFieldValue("#widgetDemoMin")),
      max: Number(getFieldValue("#widgetDemoMax")),
      initial: Number(getFieldValue("#widgetDemoInitial"))
    };
  }

  Object.keys(config).forEach(key => {
    if (config[key] === "" || config[key] === null || config[key] === undefined) delete config[key];
    if (typeof config[key] === "number" && !Number.isFinite(config[key])) delete config[key];
  });

  setFieldValue("#widgetSourceUrl", sourceUrl);
  setFieldValue("#widgetTargetId", targetId);
  setFieldValue("#widgetBody", body);
  setFieldValue("#widgetConfig", widgetConfigString(config));
  setFieldValue("#widgetAdvancedConfigView", widgetConfigString(config));

  return {
    id: $("#widgetId")?.value.trim() || slugifyId($("#widgetTitle")?.value || "widget", "widget"),
    type,
    title: $("#widgetTitle")?.value.trim() || "",
    sourceUrl,
    targetId,
    tags: parseTags($("#widgetTags")?.value || ""),
    body,
    config: widgetConfigString(config)
  };
}
function widgetPayloadFromForm() {
  return widgetPayloadFromBuilder();
}
function applyWidgetPayloadToBuilder(w = {}) {
  const type = String(w.type || "callout").toLowerCase();
  const cfg = parseWidgetConfig(w.config);
  setWidgetType(type, true);

  if (type === "callout") {
    setFieldValue("#widgetCalloutTone", cfg.variant || cfg.tone || "insight");
    setFieldValue("#widgetCalloutLabel", cfg.label || "");
    setFieldValue("#widgetCalloutBody", w.body || "");
  } else if (type === "image") {
    setFieldValue("#widgetImageUrl", w.sourceUrl || w.url || cfg.url || "");
    setFieldValue("#widgetImageAlt", cfg.alt || "");
    setFieldValue("#widgetImageCaption", cfg.caption || w.body || "");
    setFieldValue("#widgetImageCredit", cfg.credit || "");
    setFieldValue("#widgetImageMode", cfg.mode || "inline");
  } else if (type === "image-compare") {
    setFieldValue("#widgetCompareBeforeUrl", cfg.beforeUrl || w.sourceUrl || "");
    setFieldValue("#widgetCompareAfterUrl", cfg.afterUrl || "");
    setFieldValue("#widgetCompareBeforeLabel", cfg.beforeLabel || "Antes");
    setFieldValue("#widgetCompareAfterLabel", cfg.afterLabel || "Después");
    setFieldValue("#widgetCompareAlt", cfg.alt || "");
    setFieldValue("#widgetCompareSplit", Number.isFinite(Number(cfg.split)) ? cfg.split : 50);
    setFieldValue("#widgetCompareCaption", cfg.caption || w.body || "");
  } else if (type === "video") {
    setFieldValue("#widgetVideoUrl", w.sourceUrl || w.url || cfg.url || "");
    setFieldValue("#widgetVideoThumb", cfg.thumbnail || "");
    setFieldValue("#widgetVideoLoad", cfg.load || "lazy");
    setFieldValue("#widgetVideoBody", w.body || "");
  } else if (type === "table") {
    setFieldValue("#widgetTableDescription", cfg.description || "");
    setFieldValue("#widgetTableDensity", cfg.density || "comfortable");
    setFieldValue("#widgetTableCsv", (Array.isArray(cfg.columns) || Array.isArray(cfg.rows)) ? tableToCsvText(cfg.columns, cfg.rows) : (w.body || ""));
  } else if (type === "chart") {
    setFieldValue("#widgetChartType", cfg.chartType || "bar");
    setFieldValue("#widgetChartDescription", w.body || cfg.description || "");
    setFieldValue("#widgetChartXLabel", cfg.xLabel || "");
    setFieldValue("#widgetChartYLabel", cfg.yLabel || "");
    setFieldValue("#widgetChartData", (Array.isArray(cfg.labels) || Array.isArray(cfg.values)) ? chartConfigToText(cfg) : "");
  } else if (type === "metrics") {
    setFieldValue("#widgetMetricsDescription", w.body || cfg.description || "");
    setFieldValue("#widgetMetricsCsv", Array.isArray(cfg.metrics) ? metricsConfigToText(cfg) : "");
  } else if (type === "scrollbox") {
    setFieldValue("#widgetScrollLabel", cfg.label || "Detalle técnico");
    setFieldValue("#widgetScrollHeight", cfg.height || "medium");
    setFieldValue("#widgetScrollBody", w.body || "");
  } else if (type === "product-preview") {
    populateWidgetRelationOptions(type);
    setFieldValue("#widgetProductTarget", w.targetId || cfg.targetId || cfg.id || "");
    setFieldValue("#widgetProductMode", cfg.mode || "compact");
    setFieldValue("#widgetProductNote", w.body || "");
  } else if (type === "service-preview") {
    populateWidgetRelationOptions(type);
    setFieldValue("#widgetServiceTarget", w.targetId || cfg.targetId || cfg.id || "");
    setFieldValue("#widgetServiceMode", cfg.mode || "compact");
    setFieldValue("#widgetServiceNote", w.body || "");
  } else if (type === "demo") {
    setFieldValue("#widgetDemoKind", cfg.demoType || "slider");
    setFieldValue("#widgetDemoVariable", cfg.variable || "");
    setFieldValue("#widgetDemoMin", Number.isFinite(Number(cfg.min)) ? cfg.min : "");
    setFieldValue("#widgetDemoMax", Number.isFinite(Number(cfg.max)) ? cfg.max : "");
    setFieldValue("#widgetDemoInitial", Number.isFinite(Number(cfg.initial)) ? cfg.initial : "");
    setFieldValue("#widgetDemoBody", w.body || "");
  }
  setFieldValue("#widgetAdvancedConfigView", widgetConfigString(cfg));
  renderWidgetLivePreview();
}
function widgetPreviewHtml(w) {
  const type = String(w.type || "callout").toLowerCase();
  const cfg = parseWidgetConfig(w.config);
  const meta = [widgetTypeLabel(type), w.targetId, w.sourceUrl].filter(Boolean).join(" · ");
  let extra = "";
  if (type === "table") {
    const parsed = parseWidgetConfig(w.config);
    const count = Array.isArray(parsed.rows) ? parsed.rows.length : csvTextToTable(w.body).rows.length;
    extra = `<div class="entity-preview-links mono">${count} fila(s)</div>`;
  } else if (type === "chart") {
    const count = Array.isArray(cfg.values) ? cfg.values.length : 0;
    extra = `<div class="entity-preview-links mono">${cfg.chartType || "bar"} · ${count} punto(s)</div>`;
  } else if (type === "metrics") {
    const count = Array.isArray(cfg.metrics) ? cfg.metrics.length : 0;
    extra = `<div class="entity-preview-links mono">${count} métrica(s)</div>`;
  } else if (type === "image-compare") {
    extra = `<div class="entity-preview-links mono">comparador · ${escapeHtml(cfg.beforeLabel || "antes")} / ${escapeHtml(cfg.afterLabel || "después")}</div>`;
  } else if ((type === "product-preview" || type === "service-preview") && w.targetId) {
    extra = `<div class="entity-preview-links mono">relacionado: ${escapeHtml(w.targetId)}</div>`;
  }
  return `
    <div class="entity-preview-card widget-preview-card">
      <div class="resource-preview-icon" aria-hidden="true">${escapeHtml(widgetTypeIcon(type))}</div>
      <div>
        <div class="entity-preview-meta">${escapeHtml(meta || widgetTypeLabel(type))}</div>
        <div class="entity-preview-title">${escapeHtml(w.title || w.id || "Widget sin título")}</div>
        ${w.body ? `<div class="entity-preview-body">${escapeHtml(w.body).slice(0, 260)}</div>` : ""}
        ${extra}
      </div>
    </div>`;
}

function validateWidgetPayload(w = widgetPayloadFromBuilder()) {
  const warnings = [];
  const errors = [];
  const type = String(w.type || "callout").toLowerCase();
  const cfg = parseWidgetConfig(w);
  const title = String(w.title || "").trim();
  const body = String(w.body || "").trim();
  const sourceUrl = String(w.sourceUrl || "").trim();
  const targetId = String(w.targetId || "").trim();

  if (!title) errors.push("Falta título.");

  if (type === "callout" && !body) warnings.push("La idea clave no tiene texto.");

  if (type === "image") {
    if (!sourceUrl) errors.push("Falta la URL de la imagen.");
    if (!cfg.alt) warnings.push("Falta alt text accesible.");
    if (!cfg.caption && !body) warnings.push("Falta caption o explicación.");
  }

  if (type === "image-compare") {
    if (!cfg.beforeUrl || !cfg.afterUrl) errors.push("El comparador necesita dos imágenes.");
    if (!cfg.alt) warnings.push("Falta descripción accesible del comparador.");
  }

  if (type === "video") {
    if (!sourceUrl) errors.push("Falta URL del video.");
    if (!body) warnings.push("Agrega una nota breve sobre qué aporta el video.");
  }

  if (type === "table") {
    const parsed = Array.isArray(cfg.rows) ? cfg : csvTextToTable(body);
    if (!Array.isArray(parsed.rows) || parsed.rows.length === 0) errors.push("La tabla no tiene filas.");
    if (!Array.isArray(parsed.columns) || parsed.columns.length === 0) warnings.push("La tabla no tiene encabezados claros.");
  }

  if (type === "chart") {
    const values = Array.isArray(cfg.values) ? cfg.values : [];
    const labels = Array.isArray(cfg.labels) ? cfg.labels : [];
    if (!values.length || !labels.length) errors.push("El gráfico no tiene datos suficientes.");
    if (!cfg.xLabel || !cfg.yLabel) warnings.push("Conviene indicar nombres de ejes.");
  }

  if (type === "metrics") {
    if (!Array.isArray(cfg.metrics) || !cfg.metrics.length) errors.push("No hay métricas configuradas.");
  }

  if (type === "scrollbox" && !body) errors.push("La ventana scrolleable no tiene contenido.");

  if (type === "product-preview") {
    if (!targetId) errors.push("Selecciona un producto.");
    else if (!(INDEX.products || []).some(p => p.id === targetId)) errors.push(`Producto no encontrado: ${targetId}`);
  }

  if (type === "service-preview") {
    if (!targetId) errors.push("Selecciona un servicio.");
    else if (!(INDEX.services || []).some(s => s.id === targetId)) errors.push(`Servicio no encontrado: ${targetId}`);
  }

  if (type === "demo") {
    const min = Number(cfg.min);
    const max = Number(cfg.max);
    const initial = Number(cfg.initial);
    if (!cfg.variable) warnings.push("La demo no tiene nombre de variable.");
    if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) errors.push("Rango inválido: mínimo debe ser menor que máximo.");
    if (Number.isFinite(initial) && Number.isFinite(min) && Number.isFinite(max) && (initial < min || initial > max)) warnings.push("El valor inicial queda fuera del rango.");
  }

  return { ok: errors.length === 0, errors, warnings };
}

function renderWidgetValidation(payload = widgetPayloadFromBuilder()) {
  const el = $("#widgetValidationList");
  if (!el) return validateWidgetPayload(payload);
  const v = validateWidgetPayload(payload);
  const rows = [
    ...v.errors.map(msg => ({ type: "error", msg })),
    ...v.warnings.map(msg => ({ type: "warn", msg }))
  ];
  el.innerHTML = rows.length ? rows.map(row => `
    <div class="validation-item is-${escapeAttr(row.type)}">
      <span>${row.type === "error" ? "×" : "!"}</span>
      <div>${escapeHtml(row.msg)}</div>
    </div>
  `).join("") : `<div class="validation-item is-ok"><span>✓</span><div>Listo.</div></div>`;
  return v;
}

function applyWidgetPreset(preset) {
  clearWidgetEditor();
  if (preset === "callout-insight") {
    setWidgetType("callout", false);
    setFieldValue("#widgetTitle", "Idea clave");
    setFieldValue("#widgetCalloutTone", "insight");
    setFieldValue("#widgetCalloutLabel", "Principio");
    setFieldValue("#widgetCalloutBody", "Escribe aquí la idea central que el lector debe recordar.");
  } else if (preset === "data-table") {
    setWidgetType("table", false);
    setFieldValue("#widgetTitle", "Tabla de datos");
    setFieldValue("#widgetTableDescription", "Datos principales del análisis.");
    setFieldValue("#widgetTableCsv", "Parámetro,Valor,Unidad\nPorosidad,34,%\nUmbral,128,px");
  } else if (preset === "result-chart") {
    setWidgetType("chart", false);
    setFieldValue("#widgetTitle", "Resultados comparados");
    setFieldValue("#widgetChartType", "bar");
    setFieldValue("#widgetChartXLabel", "Condición");
    setFieldValue("#widgetChartYLabel", "Resultado");
    setFieldValue("#widgetChartData", "Condición,Resultado\nA,0.12\nB,0.19\nC,0.27");
  } else if (preset === "compare") {
    setWidgetType("image-compare", false);
    setFieldValue("#widgetTitle", "Comparación visual");
    setFieldValue("#widgetCompareBeforeLabel", "Antes");
    setFieldValue("#widgetCompareAfterLabel", "Después");
    setFieldValue("#widgetCompareSplit", "50");
    setFieldValue("#widgetCompareCaption", "Describe qué cambia entre ambas imágenes.");
  } else if (preset === "metrics") {
    setWidgetType("metrics", false);
    setFieldValue("#widgetTitle", "Métricas principales");
    setFieldValue("#widgetMetricsDescription", "Resumen numérico del resultado.");
    setFieldValue("#widgetMetricsCsv", "Métrica,Valor,Unidad,Nota\nPorosidad,34,%,Promedio estimado\nUmbral,128,px,Valor usado");
  } else if (preset === "slider-demo") {
    setWidgetType("demo", false);
    setFieldValue("#widgetTitle", "Demo con slider");
    setFieldValue("#widgetDemoKind", "slider");
    setFieldValue("#widgetDemoVariable", "Umbral");
    setFieldValue("#widgetDemoMin", "0");
    setFieldValue("#widgetDemoMax", "255");
    setFieldValue("#widgetDemoInitial", "128");
    setFieldValue("#widgetDemoBody", "Mueve el control para explorar cómo cambia la variable.");
  }
  renderWidgetLivePreview();
  toast("Preset aplicado");
}

function widgetValidationSummary(w) {
  const v = validateWidgetPayload(w);
  if (!v.ok) return { label: `${v.errors.length} error(es)`, cls: "is-error" };
  if (v.warnings.length) return { label: `${v.warnings.length} aviso(s)`, cls: "is-warn" };
  return { label: "OK", cls: "is-ok" };
}

function renderWidgets() {
  const list = $("#widgetsList");
  if (!list) return;
  const q = String($("#widgetsSearch")?.value || "").toLowerCase().trim();
  const type = String($("#widgetsTypeFilter")?.value || "").trim();
  const items = (INDEX.widgets || []).filter(w => {
    const hay = `${w.id} ${w.type} ${w.title} ${w.sourceUrl} ${w.targetId} ${(w.tags||[]).join(" ")} ${w.body||""} ${w.config||""}`.toLowerCase();
    if (q && !hay.includes(q)) return false;
    if (type && w.type !== type) return false;
    return true;
  }).sort((a,b) => String(a.type || "").localeCompare(String(b.type || "")) || String(a.title || a.id).localeCompare(String(b.title || b.id), "es", { sensitivity: "base" }));
  $("#widgetsCount").textContent = `${items.length} widget(s)`;
  list.innerHTML = items.length ? items.map(w => `
    <div class="item entity-item widget-item ${w.id === currentWidgetId ? "is-current" : ""}" data-id="${escapeAttr(w.id)}">
      <div class="resource-row-main">
        <div class="resource-type-icon" aria-hidden="true">${escapeHtml(widgetTypeIcon(w.type))}</div>
        <div>
          <div class="item-title">${escapeHtml(w.title || w.id)}</div>
          <div class="meta">
            <span class="badge">${escapeHtml(widgetTypeLabel(w.type))}</span>
              <span class="badge widget-validation-badge ${escapeAttr(widgetValidationSummary(w).cls)}">${escapeHtml(widgetValidationSummary(w).label)}</span>
            ${w.targetId ? `<span class="muted">${escapeHtml(w.targetId)}</span>` : ""}
            ${w.__local ? `<span class="badge local-badge">LOCAL</span>` : ""}
          </div>
        </div>
      </div>
      <button class="mini-action" data-copy-widget="${escapeAttr(w.id)}" type="button" title="Copiar bloque">▧</button>
    </div>
  `).join("") : `<div class="muted" style="padding:10px;">No hay widgets.</div>`;
  list.querySelectorAll(".entity-item").forEach(el => el.addEventListener("click", () => loadWidget(el.dataset.id)));
  list.querySelectorAll("[data-copy-widget]").forEach(btn => btn.addEventListener("click", ev => {
    ev.stopPropagation();
    copyTextToClipboard(`[[widget:${btn.dataset.copyWidget}]]`, "Bloque de widget copiado");
  }));
}
function loadWidget(id) {
  const w = (INDEX.widgets || []).find(x => x.id === id);
  if (!w) return;
  currentWidgetId = w.id;
  $("#widgetEditorHint").textContent = `Editando: ${w.id}${w.__local ? " · local" : ""}`;
  $("#widgetId").value = w.id || "";
  $("#widgetTitle").value = w.title || "";
  $("#widgetType").value = w.type || "callout";
  $("#widgetSourceUrl").value = w.sourceUrl || w.url || "";
  $("#widgetTargetId").value = w.targetId || "";
  $("#widgetTags").value = (w.tags || []).join(", ");
  $("#widgetBody").value = w.body || "";
  $("#widgetConfig").value = typeof w.config === "string" ? w.config : (w.config ? JSON.stringify(w.config, null, 2) : "");
  applyWidgetPayloadToBuilder(w);
  renderWidgets();
}
function clearWidgetEditor() {
  currentWidgetId = "";
  $("#widgetEditorHint").textContent = "Nuevo widget";
  const clearSelectors = [
    "#widgetId", "#widgetTitle", "#widgetSourceUrl", "#widgetTargetId", "#widgetTags", "#widgetBody", "#widgetConfig", "#widgetAdvancedConfigView",
    "#widgetCalloutLabel", "#widgetCalloutBody", "#widgetImageUrl", "#widgetImageAlt", "#widgetImageCaption", "#widgetImageCredit",
    "#widgetCompareBeforeUrl", "#widgetCompareAfterUrl", "#widgetCompareBeforeLabel", "#widgetCompareAfterLabel", "#widgetCompareAlt", "#widgetCompareSplit", "#widgetCompareCaption",
    "#widgetVideoUrl", "#widgetVideoThumb", "#widgetVideoBody", "#widgetTableDescription", "#widgetTableCsv", "#widgetChartDescription", "#widgetChartXLabel", "#widgetChartYLabel", "#widgetChartData", "#widgetMetricsDescription", "#widgetMetricsCsv", "#widgetScrollBody", "#widgetProductNote", "#widgetServiceNote", "#widgetDemoVariable", "#widgetDemoMin", "#widgetDemoMax", "#widgetDemoInitial", "#widgetDemoBody"
  ];
  clearSelectors.forEach(sel => { if ($(sel)) $(sel).value = ""; });
  setFieldValue("#widgetCalloutTone", "insight");
  setFieldValue("#widgetImageMode", "inline");
  setFieldValue("#widgetVideoLoad", "lazy");
  setFieldValue("#widgetTableDensity", "comfortable");
  setFieldValue("#widgetChartType", "bar");
  setFieldValue("#widgetCompareBeforeLabel", "Antes");
  setFieldValue("#widgetCompareAfterLabel", "Después");
  setFieldValue("#widgetCompareSplit", "50");
  setFieldValue("#widgetScrollLabel", "Detalle técnico");
  setFieldValue("#widgetScrollHeight", "medium");
  setFieldValue("#widgetProductMode", "compact");
  setFieldValue("#widgetServiceMode", "compact");
  setFieldValue("#widgetDemoKind", "slider");
  setWidgetType("callout", true);
  renderWidgets();
}
function renderWidgetLivePreview() {
  const el = $("#widgetLivePreview");
  if (!el) return;
  const payload = widgetPayloadFromBuilder();
  el.innerHTML = widgetPreviewHtml(payload);
  renderWidgetValidation(payload);
}
function applyWidgetAdvancedJson() {
  const raw = getFieldValue("#widgetAdvancedConfigView");
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    const current = widgetPayloadFromBuilder();
    current.config = JSON.stringify(parsed, null, 2);
    $("#widgetConfig").value = current.config;
    applyWidgetPayloadToBuilder(current);
    toast("JSON aplicado");
  } catch (_e) {
    toast("JSON inválido", false);
  }
}
function initWidgetBuilder() {
  document.querySelectorAll(".widget-type-tile[data-widget-type]").forEach(btn => {
    btn.addEventListener("click", () => setWidgetType(btn.dataset.widgetType, false));
  });
  document.querySelectorAll("[data-widget-preset]").forEach(btn => {
    btn.addEventListener("click", () => applyWidgetPreset(btn.dataset.widgetPreset));
  });
  const builderSelectors = [
    "#widgetTitle", "#widgetId", "#widgetTags", "#widgetCalloutTone", "#widgetCalloutLabel", "#widgetCalloutBody",
    "#widgetImageUrl", "#widgetImageAlt", "#widgetImageCaption", "#widgetImageCredit", "#widgetImageMode",
    "#widgetCompareBeforeUrl", "#widgetCompareAfterUrl", "#widgetCompareBeforeLabel", "#widgetCompareAfterLabel", "#widgetCompareAlt", "#widgetCompareSplit", "#widgetCompareCaption",
    "#widgetVideoUrl", "#widgetVideoThumb", "#widgetVideoLoad", "#widgetVideoBody",
    "#widgetTableDescription", "#widgetTableDensity", "#widgetTableCsv",
    "#widgetChartType", "#widgetChartDescription", "#widgetChartXLabel", "#widgetChartYLabel", "#widgetChartData",
    "#widgetMetricsDescription", "#widgetMetricsCsv",
    "#widgetScrollLabel", "#widgetScrollHeight", "#widgetScrollBody",
    "#widgetProductTarget", "#widgetProductMode", "#widgetProductNote",
    "#widgetServiceTarget", "#widgetServiceMode", "#widgetServiceNote",
    "#widgetDemoKind", "#widgetDemoVariable", "#widgetDemoMin", "#widgetDemoMax", "#widgetDemoInitial", "#widgetDemoBody"
  ];
  builderSelectors.forEach(sel => {
    $(sel)?.addEventListener("input", renderWidgetLivePreview);
    $(sel)?.addEventListener("change", renderWidgetLivePreview);
  });
  $("#btnApplyWidgetAdvancedJson")?.addEventListener("click", applyWidgetAdvancedJson);
  setWidgetType($("#widgetType")?.value || "callout", true);
}
$("#widgetsSearch")?.addEventListener("input", renderWidgets);
$("#widgetsTypeFilter")?.addEventListener("change", renderWidgets);
$("#btnNewWidget")?.addEventListener("click", clearWidgetEditor);
$("#btnSaveWidget")?.addEventListener("click", async () => {
  const payload = widgetPayloadFromForm();
  const validation = renderWidgetValidation(payload);
  if (!validation.ok) return toast(validation.errors[0] || "El widget tiene errores", false);
  const id = await upsertEntity("widgets", payload, "widgets");
  loadWidget(id);
  updateEditorDerivedViews();
});
$("#btnDeleteWidget")?.addEventListener("click", async () => {
  const id = $("#widgetId")?.value || currentWidgetId;
  await deleteEntity("widgets", id, "widgets");
  clearWidgetEditor();
});
initWidgetBuilder();





// ---- Editorial health dashboard
function postUsesWidgets(post) {
  try {
    const body = post?.id ? (localStorage.getItem(`bccAdmin.autosave.${post.id}`) || "") : "";
    return (body.match(/\[\[widget:([^\]]+)\]\]/g) || []).length;
  } catch (_e) {
    return 0;
  }
}

function currentPostChecklistItems() {
  const post = getCurrentPostRecord() || collectPostPayload?.() || {};
  const body = $("#postBody")?.value || "";
  const widgetIds = [...body.matchAll(/\[\[widget:([^\]]+)\]\]/g)].map(m => m[1].trim());
  const missingWidgets = widgetIds.filter(id => !(INDEX.widgets || []).some(w => w.id === id));
  return [
    { ok: Boolean(post.title || $("#postTitle")?.value), label: "Título" },
    { ok: Boolean(post.excerpt || $("#postExcerpt")?.value), label: "Excerpt / bajada" },
    { ok: parseTags($("#postAuthors")?.value || post.authorIds || "").length > 0, label: "Autoría" },
    { ok: parseTags($("#postTags")?.value || post.tags || "").length > 0, label: "Tags" },
    { ok: Boolean(post.cover || $("#postCover")?.value), label: "Cover" },
    { ok: parseTags($("#postResources")?.value || post.resourceIds || "").length > 0, label: "Recursos recomendados", soft: true },
    { ok: missingWidgets.length === 0, label: missingWidgets.length ? `Widgets faltantes: ${missingWidgets.join(", ")}` : "Widgets referenciados" },
    { ok: Boolean(post.translationId || $("#postTranslationId")?.value), label: "Grupo de traducción", soft: true }
  ];
}

function healthItemHtml(item) {
  const cls = item.ok ? "is-ok" : (item.soft ? "is-soft" : "is-warn");
  const icon = item.ok ? "✓" : (item.soft ? "·" : "!");
  return `<div class="health-item ${cls}"><span>${icon}</span><div>${escapeHtml(item.label)}</div></div>`;
}

function renderCurrentPostChecklist() {
  const el = $("#currentPostChecklist");
  if (!el) return;
  const items = currentPostChecklistItems();
  el.innerHTML = items.map(healthItemHtml).join("");
}

function renderWidgetHealth() {
  const el = $("#widgetHealthList");
  if (!el) return { errors: 0, warnings: 0 };
  const widgets = INDEX.widgets || [];
  let errors = 0;
  let warnings = 0;
  const rows = widgets.map(w => {
    const v = validateWidgetPayload(w);
    errors += v.errors.length;
    warnings += v.warnings.length;
    const status = !v.ok ? "is-warn" : (v.warnings.length ? "is-soft" : "is-ok");
    const msg = !v.ok ? v.errors[0] : (v.warnings[0] || "Listo");
    return `<div class="health-item ${status}"><span>${!v.ok ? "!" : "✓"}</span><div><strong>${escapeHtml(w.title || w.id)}</strong><small>${escapeHtml(widgetTypeLabel(w.type))} · ${escapeHtml(msg)}</small></div></div>`;
  });
  el.innerHTML = rows.join("") || `<div class="muted" style="padding:10px;">No hay widgets.</div>`;
  return { errors, warnings };
}

function renderBlogHealth() {
  const el = $("#blogHealthList");
  if (!el) return;
  const posts = INDEX.posts || [];
  const groups = buildPostGroups(posts);
  const missingTranslation = [...groups.values()].filter(g => postGroupCompleteness(g).complete === false).length;
  const withoutAuthor = posts.filter(p => !(p.authorIds || p.authors || []).length).slice(0, 8);
  const withoutExcerpt = posts.filter(p => !String(p.excerpt || "").trim()).slice(0, 8);
  const withoutCover = posts.filter(p => !String(p.cover || "").trim()).slice(0, 8);
  const orphanResources = (INDEX.resources || []).filter(r => !posts.some(p => (p.resourceIds || p.resources || []).includes(r.id))).slice(0, 8);
  const rows = [
    { ok: missingTranslation === 0, label: missingTranslation ? `${missingTranslation} grupo(s) con traducción incompleta` : "Traducciones completas" },
    { ok: withoutAuthor.length === 0, label: withoutAuthor.length ? `${withoutAuthor.length} entrada(s) sin autoría visible` : "Autoría asignada" },
    { ok: withoutExcerpt.length === 0, label: withoutExcerpt.length ? `${withoutExcerpt.length} entrada(s) sin excerpt` : "Excerpts completos", soft: true },
    { ok: withoutCover.length === 0, label: withoutCover.length ? `${withoutCover.length} entrada(s) sin cover` : "Covers completos", soft: true },
    { ok: orphanResources.length === 0, label: orphanResources.length ? `${orphanResources.length} recurso(s) sin uso` : "Recursos conectados", soft: true }
  ];
  el.innerHTML = rows.map(healthItemHtml).join("");
}

function renderHealthSummary(widgetResult = renderWidgetHealth()) {
  const grid = $("#healthSummaryGrid");
  const score = $("#healthScore");
  if (!grid || !score) return;
  const posts = INDEX.posts || [];
  const groups = buildPostGroups(posts);
  const completeGroups = [...groups.values()].filter(g => postGroupCompleteness(g).complete).length;
  const widgets = INDEX.widgets || [];
  const badWidgets = widgets.filter(w => !validateWidgetPayload(w).ok).length;
  const withoutAuthor = posts.filter(p => !(p.authorIds || p.authors || []).length).length;
  const metrics = [
    ["Entradas", posts.length],
    ["Grupos ES/EN", groups.size],
    ["Grupos completos", completeGroups],
    ["Widgets", widgets.length],
    ["Widgets con error", badWidgets],
    ["Sin autor", withoutAuthor]
  ];
  const penalty = badWidgets * 10 + withoutAuthor * 4 + Math.max(0, groups.size - completeGroups) * 6;
  const value = Math.max(0, Math.min(100, 100 - penalty));
  score.innerHTML = `<strong>${value}%</strong><span>preparación</span>`;
  grid.innerHTML = metrics.map(([label, value]) => `<div class="health-metric"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`).join("");
}

function renderHealthDashboard() {
  renderCurrentPostChecklist();
  const widgetResult = renderWidgetHealth();
  renderBlogHealth();
  renderHealthSummary(widgetResult);
}

function initHealthDashboard() {
  $("#btnRefreshHealth")?.addEventListener("click", () => {
    renderHealthDashboard();
    toast("Diagnóstico actualizado");
  });
  $("#btnOpenWidgetDocs")?.addEventListener("click", () => {
    window.open("/EDITORIAL_GUIDE.md", "_blank", "noopener,noreferrer");
  });
}

// ---- Template render + maintenance
let lastRenderedTemplateHtml = "";
let lastRenderedTemplateUrl = "";
let templatePreviewViewport = "desktop";
const TEMPLATE_VIEWPORT_PREF = "bccAdmin.templatePreviewViewport";

function setTemplatePreviewViewport(mode, persist = true) {
  const value = mode === "mobile" ? "mobile" : "desktop";
  templatePreviewViewport = value;

  const shell = $("#templatePreviewShell") || document.querySelector(".template-preview-shell");
  if (shell) {
    shell.classList.toggle("is-mobile", value === "mobile");
    shell.classList.toggle("is-desktop", value !== "mobile");
  }

  document.querySelectorAll("[data-template-viewport]").forEach(btn => {
    const active = btn.dataset.templateViewport === value;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-pressed", String(active));
  });

  if (persist) {
    try { localStorage.setItem(TEMPLATE_VIEWPORT_PREF, value); } catch (_e) {}
  }
}

function initTemplatePreviewViewport() {
  let saved = "desktop";
  try { saved = localStorage.getItem(TEMPLATE_VIEWPORT_PREF) || "desktop"; } catch (_e) {}
  setTemplatePreviewViewport(saved === "mobile" ? "mobile" : "desktop", false);

  document.querySelectorAll("[data-template-viewport]").forEach(btn => {
    btn.addEventListener("click", () => setTemplatePreviewViewport(btn.dataset.templateViewport));
  });
}

function templateSelectedPostId() {
  return String($("#templateRenderPostSelect")?.value || currentPostId || $("#postId")?.value || "").trim();
}

function isCurrentEditorPost(id) {
  const currentId = String(currentPostId || $("#postId")?.value || "").trim();
  return Boolean(id && currentId && id === currentId);
}

function populateTemplatePostSelect() {
  const sel = $("#templateRenderPostSelect");
  if (!sel) return;
  const currentValue = sel.value || currentPostId;
  const posts = (INDEX.posts || []).slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  sel.innerHTML = posts.map(p => {
    const lang = String(p.lang || "es").toUpperCase();
    const date = p.date ? ` · ${p.date}` : "";
    return `<option value="${escapeAttr(p.id)}">${escapeHtml(lang)} · ${escapeHtml(p.title || p.id)}${escapeHtml(date)}</option>`;
  }).join("") || `<option value="">No hay entradas</option>`;
  if (currentValue && posts.some(p => p.id === currentValue)) sel.value = currentValue;
}

function templateRenderPayload() {
  const id = templateSelectedPostId();
  const useDraft = Boolean($("#templateUseEditorDraft")?.checked);
  const includeResources = $("#templateIncludeResources")?.checked !== false;
  const payload = { id, includeResources };
  if (useDraft && isCurrentEditorPost(id)) payload.draft = collectPostPayload();
  return payload;
}

function setTemplateRenderStatus(message, ok = true) {
  const el = $("#templateRenderStatus");
  if (!el) return;
  el.textContent = message;
  el.style.borderColor = ok ? "rgba(86,255,166,0.26)" : "rgba(255,101,79,0.36)";
}

function injectPreviewBase(html) {
  const raw = String(html || "");
  if (!raw.trim()) return "";

  // srcdoc documents do not always resolve root/relative assets the way a
  // normal /blog/*.html page does. Force the preview to resolve /css, /js,
  // /static and relative links against the admin server origin.
  const baseTag = '<base href="/" target="_blank">';
  if (/<base\s/i.test(raw)) return raw;
  if (/<head[^>]*>/i.test(raw)) return raw.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`);
  return `<!doctype html><html><head>${baseTag}</head><body>${raw}</body></html>`;
}

function writeTemplateIframe(html) {
  const frame = $("#templateRenderFrame");
  if (!frame) return;
  frame.srcdoc = injectPreviewBase(html);
}

function setRenderedTemplateHtml(html) {
  lastRenderedTemplateHtml = String(html || "");
  const source = $("#templateRenderSource");
  if (source) source.value = lastRenderedTemplateHtml;
  writeTemplateIframe(lastRenderedTemplateHtml);

  if (lastRenderedTemplateUrl) URL.revokeObjectURL(lastRenderedTemplateUrl);
  lastRenderedTemplateUrl = lastRenderedTemplateHtml
    ? URL.createObjectURL(new Blob([lastRenderedTemplateHtml], { type: "text/html" }))
    : "";

  const openBtn = $("#btnOpenRenderedTemplate");
  const copyBtn = $("#btnCopyRenderedTemplate");
  if (openBtn) openBtn.disabled = !lastRenderedTemplateHtml;
  if (copyBtn) copyBtn.disabled = !lastRenderedTemplateHtml;
}

async function renderSelectedTemplate() {
  try {
    const payload = templateRenderPayload();
    if (!payload.id) return setTemplateRenderStatus("Selecciona una entrada primero.", false);
    setTemplateRenderStatus("Renderizando plantilla…");
    const res = await api("/api/posts/render-template", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    setRenderedTemplateHtml(res.html || "");
    setTemplateRenderStatus(`Render listo: ${res.id || payload.id} · ${String(res.lang || "").toUpperCase()} · ${res.bytes || 0} bytes`);
  } catch (e) {
    setTemplateRenderStatus(`Error renderizando: ${e.message}`, false);
    toast(`Render falló: ${e.message}`, false);
  }
}

function templateMaintenancePayload(scope) {
  return {
    scope,
    id: String(currentPostId || $("#postId")?.value || "").trim(),
    dryRun: Boolean($("#templateDryRun")?.checked),
    createBackups: Boolean($("#templateCreateBackups")?.checked),
    includeResources: $("#templateRegenerateResources")?.checked !== false
  };
}

function setTemplateAuditStatus(message, ok = true) {
  const el = $("#templateAuditStatus");
  if (!el) return;
  el.textContent = message;
  el.style.borderColor = ok ? "rgba(86,255,166,0.26)" : "rgba(255,101,79,0.36)";
}

function renderTemplateAuditResult(result) {
  const list = $("#templateAuditList");
  if (!list) return;
  const items = Array.isArray(result.items) ? result.items : [];
  const totals = result.totals || {};
  setTemplateAuditStatus(`${result.message || "Resultado"} · total ${totals.total ?? items.length} · actual ${totals.current ?? 0} · obsoletos ${totals.stale ?? 0} · faltantes ${totals.missing ?? 0} · actualizados ${totals.updated ?? 0} · errores ${totals.error ?? 0}`);
  list.innerHTML = items.map(item => {
    const status = String(item.status || "unknown").toLowerCase();
    const cls = status.replace(/[^a-z0-9_-]/g, "");
    return `
      <div class="audit-item">
        <div>
          <div class="audit-title">${escapeHtml(item.title || item.id || "(sin título)")}</div>
          <div class="audit-meta">${escapeHtml(String(item.lang || "").toUpperCase())} · ${escapeHtml(item.output || item.path || "")} · ${escapeHtml(item.reason || "")}</div>
        </div>
        <div class="audit-status ${escapeAttr(cls)}">${escapeHtml(status)}</div>
      </div>
    `;
  }).join("") || `<div class="muted" style="padding:10px;">Sin resultados.</div>`;
}

async function runTemplateAudit() {
  try {
    setTemplateAuditStatus("Auditando plantillas…");
    const res = await api("/api/posts/template-audit", {
      method: "POST",
      body: JSON.stringify({ includeResources: $("#templateRegenerateResources")?.checked !== false })
    });
    renderTemplateAuditResult(res);
  } catch (e) {
    setTemplateAuditStatus(`Error auditando: ${e.message}`, false);
    toast(`Auditoría falló: ${e.message}`, false);
  }
}

async function regenerateTemplates(scope) {
  try {
    const payload = templateMaintenancePayload(scope);
    if (scope === "current" && !payload.id) return toast("No hay entrada actual para regenerar", false);
    setTemplateAuditStatus(payload.dryRun ? "Simulando regeneración…" : "Regenerando plantillas…");
    const res = await api("/api/posts/regenerate", { method: "POST", body: JSON.stringify(payload) });
    renderTemplateAuditResult(res);
    if (!payload.dryRun) await refreshGitStatus();
  } catch (e) {
    setTemplateAuditStatus(`Error regenerando: ${e.message}`, false);
    toast(`Regeneración falló: ${e.message}`, false);
  }
}

function initTemplateTools() {
  initTemplatePreviewViewport();
  $("#templateRenderPostSelect")?.addEventListener("change", () => setRenderedTemplateHtml(""));
  $("#btnTemplateUseCurrent")?.addEventListener("click", () => {
    populateTemplatePostSelect();
    const id = String(currentPostId || $("#postId")?.value || "").trim();
    if (!id) return toast("No hay entrada actual", false);
    const sel = $("#templateRenderPostSelect");
    if (sel) sel.value = id;
    toast("Entrada actual seleccionada");
  });
  $("#btnRenderTemplate")?.addEventListener("click", renderSelectedTemplate);
  $("#btnOpenRenderedTemplate")?.addEventListener("click", () => {
    if (lastRenderedTemplateUrl) window.open(lastRenderedTemplateUrl, "_blank", "noopener,noreferrer");
  });
  $("#btnCopyRenderedTemplate")?.addEventListener("click", () => {
    if (lastRenderedTemplateHtml) copyTextToClipboard(lastRenderedTemplateHtml, "HTML renderizado copiado");
  });
  $("#btnAuditTemplates")?.addEventListener("click", runTemplateAudit);
  $("#btnRegenerateCurrent")?.addEventListener("click", () => regenerateTemplates("current"));
  $("#btnRegenerateStale")?.addEventListener("click", () => regenerateTemplates("stale"));
  $("#btnRegenerateAll")?.addEventListener("click", () => regenerateTemplates("all"));
}

// ---- PRODUCTS
function renderProducts() {
  $("#productsCount").textContent = `${INDEX.products.length} producto(s)`;
  const list = $("#productsList");

  list.innerHTML = INDEX.products.map(p => `
    <div class="item" data-id="${p.id}">
      <div>
        <div class="item-title">${escapeHtml(p.name || "(sin nombre)")}</div>
        <div class="meta">
          <span class="badge">${escapeHtml(p.status || "Activo")}</span>
          <span class="muted">${escapeHtml(p.category || "")}</span>
        </div>
      </div>
      <div class="badge">${escapeHtml(p.id)}</div>
    </div>
  `).join("") || `<div class="muted" style="padding:10px;">No hay productos.</div>`;

  list.querySelectorAll(".item").forEach(el => el.addEventListener("click", () => loadProduct(el.dataset.id)));
}

function loadProduct(id) {
  const p = INDEX.products.find(x => x.id === id);
  if (!p) return;

  currentProductId = p.id;
  $("#productEditorHint").textContent = `Editando: ${p.id}`;

  $("#productId").value = p.id;
  $("#productName").value = p.name || "";
  $("#productCategory").value = p.category || "";
  $("#productStatus").value = p.status || "Activo";
  $("#productPageUrl").value = p.pageUrl || "";
  $("#productTags").value = (p.tags || []).join(", ");
  $("#productSummary").value = p.summary || "";
  markCurrent("#productsList", p.id);
}

function clearProductEditor() {
  currentProductId = "";
  $("#productEditorHint").textContent = "Nuevo producto";
  $("#productId").value = "";
  $("#productName").value = "";
  $("#productCategory").value = "";
  $("#productStatus").value = "Activo";
  $("#productPageUrl").value = "";
  $("#productTags").value = "";
  $("#productSummary").value = "";
  markCurrent("#productsList", "");
}

$("#btnNewProduct").addEventListener("click", clearProductEditor);

$("#btnSaveProduct").addEventListener("click", async () => {
  try {
    const payload = {
      id: $("#productId").value.trim() || undefined,
      name: $("#productName").value.trim(),
      category: $("#productCategory").value.trim(),
      status: $("#productStatus").value,
      pageUrl: $("#productPageUrl").value.trim(),
      tags: parseTags($("#productTags").value),
      summary: $("#productSummary").value.trim()
    };

    const r = await api("/api/products/upsert", { method: "POST", body: JSON.stringify(payload) });
    toast(`Guardado: ${r.id}`);
    await refreshAll();
    loadProduct(r.id);
  } catch (e) {
    toast(`Error: ${e.message}`, false);
  }
});

$("#btnDeleteProduct").addEventListener("click", async () => {
  try {
    const id = ($("#productId").value || "").trim() || currentProductId;
    if (!id) return toast("No hay producto cargado", false);

    await api("/api/products/delete", { method: "POST", body: JSON.stringify({ id }) });
    toast("Eliminado");
    clearProductEditor();
    await refreshAll();
  } catch (e) {
    toast(`Error: ${e.message}`, false);
  }
});

// ---- SERVICES
function renderServices() {
  $("#servicesCount").textContent = `${INDEX.services.length} servicio(s)`;
  const list = $("#servicesList");

  list.innerHTML = INDEX.services.map(s => `
    <div class="item" data-id="${s.id}">
      <div>
        <div class="item-title">${escapeHtml(s.name || "(sin nombre)")}</div>
        <div class="meta">
          <span class="badge">${escapeHtml(s.category || "Servicio")}</span>
          <span class="muted">${escapeHtml((s.tags||[]).slice(0,3).join(", "))}</span>
        </div>
      </div>
      <div class="badge">${escapeHtml(s.id)}</div>
    </div>
  `).join("") || `<div class="muted" style="padding:10px;">No hay servicios.</div>`;

  list.querySelectorAll(".item").forEach(el => el.addEventListener("click", () => loadService(el.dataset.id)));
}

function loadService(id) {
  const s = INDEX.services.find(x => x.id === id);
  if (!s) return;

  currentServiceId = s.id;
  $("#serviceEditorHint").textContent = `Editando: ${s.id}`;

  $("#serviceId").value = s.id;
  $("#serviceName").value = s.name || "";
  $("#serviceCategory").value = s.category || "";
  $("#servicePageUrl").value = s.pageUrl || "";
  $("#serviceTags").value = (s.tags || []).join(", ");
  $("#serviceSummary").value = s.summary || "";
  $("#serviceCapabilities").value = s.capabilities || "";
  $("#serviceDeliverables").value = s.deliverables || "";
  $("#serviceRequirements").value = s.requirements || "";
  markCurrent("#servicesList", s.id);
}

function clearServiceEditor() {
  currentServiceId = "";
  $("#serviceEditorHint").textContent = "Nuevo servicio";
  $("#serviceId").value = "";
  $("#serviceName").value = "";
  $("#serviceCategory").value = "";
  $("#servicePageUrl").value = "";
  $("#serviceTags").value = "";
  $("#serviceSummary").value = "";
  $("#serviceCapabilities").value = "";
  $("#serviceDeliverables").value = "";
  $("#serviceRequirements").value = "";
  markCurrent("#servicesList", "");
}

$("#btnNewService").addEventListener("click", clearServiceEditor);

$("#btnSaveService").addEventListener("click", async () => {
  try {
    const payload = {
      id: $("#serviceId").value.trim() || undefined,
      name: $("#serviceName").value.trim(),
      category: $("#serviceCategory").value.trim(),
      pageUrl: $("#servicePageUrl").value.trim(),
      tags: parseTags($("#serviceTags").value),
      summary: $("#serviceSummary").value.trim(),
      capabilities: $("#serviceCapabilities").value.trim(),
      deliverables: $("#serviceDeliverables").value.trim(),
      requirements: $("#serviceRequirements").value.trim()
    };

    const r = await api("/api/services/upsert", { method: "POST", body: JSON.stringify(payload) });
    toast(`Guardado: ${r.id}`);
    await refreshAll();
    loadService(r.id);
  } catch (e) {
    toast(`Error: ${e.message}`, false);
  }
});

$("#btnDeleteService").addEventListener("click", async () => {
  try {
    const id = ($("#serviceId").value || "").trim() || currentServiceId;
    if (!id) return toast("No hay servicio cargado", false);

    await api("/api/services/delete", { method: "POST", body: JSON.stringify({ id }) });
    toast("Eliminado");
    clearServiceEditor();
    await refreshAll();
  } catch (e) {
    toast(`Error: ${e.message}`, false);
  }
});

// ---- Publish + refresh
$("#btnPublish").addEventListener("click", async () => {
  try {
    const msg = $("#commitMsg").value.trim() || "Update content";
    await api("/api/git/publish", { method: "POST", body: JSON.stringify({ message: msg }) });
    toast("Publicado (push ok)");
    $("#commitMsg").value = "";
    await refreshGitStatus();
  } catch (e) {
    toast(`Publish falló: ${e.message}`, false);
  }
});

$("#btnRefresh").addEventListener("click", async () => {
  try {
    await refreshAll();
    toast("Refrescado");
  } catch (e) {
    toast(`Error: ${e.message}`, false);
  }
});

// ---- Boot
(async () => {
  try {
    initUiToggles();
    await hydrateAccountMenu();
    await refreshAll();
    clearPostEditor();
    clearProductEditor();
    clearServiceEditor();
    clearAuthorEditor();
    clearReferenceEditor();
    clearResourceEditor();
    clearWidgetEditor();
    $("#editorSplit").classList.toggle("is-preview-hidden", !previewOn);
    initEditorResizeSync();
    initSlashCommands();
    initEditorialSuite();
    initTemplateTools();
    initHealthDashboard();
    renderHealthDashboard();
  } catch (e) {
    toast(`Error cargando: ${e.message}`, false);
  }
})();
