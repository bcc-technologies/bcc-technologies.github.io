const $ = (sel) => document.querySelector(sel);

const toastEl = $("#toast");
function toast(msg, ok = true) {
  toastEl.textContent = msg;
  toastEl.style.display = "block";
  toastEl.style.borderColor = ok ? "rgba(86,255,166,0.35)" : "rgba(237,70,36,0.35)";
  setTimeout(() => (toastEl.style.display = "none"), 2400);
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
      const safeUrl = escapeHtml(String(url).trim());
      const cap = safeAlt ? `<figcaption>${safeAlt}</figcaption>` : "";
      return `<figure class="article-figure"><img src="${safeUrl}" alt="${safeAlt}"/>${cap}</figure>`;
    });
    // links
    return withImgs.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, text, url) => {
      const safeText = escapeHtml(text);
      const safeUrl = escapeHtml(String(url).trim());
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeText}</a>`;
    })
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
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
let INDEX = { posts: [], products: [], services: [] };
let currentPostId = "";
let currentProductId = "";
let currentServiceId = "";

let previewOn = true;

// ---- Load
async function refreshAll() {
  const { index } = await api("/api/index");
  INDEX = index;

  renderPosts();
  renderProducts();
  renderServices();
  await refreshGitStatus();
}

async function refreshGitStatus() {
  const st = await api("/api/git/status");
  const el = $("#gitStatus");
  el.classList.remove("clean", "dirty");
  el.classList.add(st.dirty ? "dirty" : "clean");
  el.querySelector(".status-text").textContent = st.dirty ? "Cambios sin publicar" : "Repo limpio";
}

// ---- POSTS
function renderPosts() {
  $("#postsCount").textContent = `${INDEX.posts.length} entrada(s)`;

  const q = ($("#postsSearch").value || "").toLowerCase().trim();
  const sec = ($("#postsSectionFilter").value || "").trim();

  const items = INDEX.posts.filter(p => {
    const hay = `${p.title} ${p.section} ${(p.tags||[]).join(" ")} ${p.excerpt||""}`.toLowerCase();
    if (q && !hay.includes(q)) return false;
    if (sec && p.section !== sec) return false;
    return true;
  });

  const list = $("#postsList");
  list.innerHTML = items.map(p => `
    <div class="item" data-id="${p.id}">
      <div>
        <div class="item-title">${escapeHtml(p.title || "(sin título)")}</div>
        <div class="meta">
          <span class="badge">${escapeHtml(p.section || "Otros")}</span>
          <span class="badge">${escapeHtml(p.date || "")}</span>
        </div>
      </div>
      <div class="badge">${escapeHtml(p.id)}</div>
    </div>
  `).join("") || `<div class="muted" style="padding:10px;">No hay entradas.</div>`;

  list.querySelectorAll(".item").forEach(el => {
    el.addEventListener("click", () => loadPost(el.dataset.id));
  });
}

async function loadPost(id) {
  const p = INDEX.posts.find(x => x.id === id);
  if (!p) return;

  currentPostId = p.id;
  $("#postEditorHint").textContent = `Editando: ${p.id}`;

  $("#postId").value = p.id;
  $("#postTitle").value = p.title || "";
  $("#postDate").value = p.date || "";
  $("#postSection").value = p.section || "Otros";
  $("#postTags").value = (p.tags || []).join(", ");
  $("#postCover").value = p.cover || "";
  $("#postExcerpt").value = p.excerpt || "";

  const bodyRes = await api(`/api/posts/body?id=${encodeURIComponent(p.id)}`);
  $("#postBody").value = bodyRes.body || "";
  $("#postPreview").innerHTML = mdToHtml($("#postBody").value);
}

function clearPostEditor() {
  currentPostId = "";
  $("#postEditorHint").textContent = "Nueva entrada";
  $("#postId").value = "";
  $("#postTitle").value = "";
  $("#postDate").value = new Date().toISOString().slice(0, 10);
  $("#postSection").value = "Empresa";
  $("#postTags").value = "";
  $("#postCover").value = "";
  $("#postExcerpt").value = "";
  $("#postBody").value = "";
  $("#postPreview").innerHTML = "";
}

$("#postBody").addEventListener("input", () => {
  $("#postPreview").innerHTML = mdToHtml($("#postBody").value);
});

$("#postsSearch").addEventListener("input", renderPosts);
$("#postsSectionFilter").addEventListener("change", renderPosts);

$("#btnNewPost").addEventListener("click", clearPostEditor);

$("#btnSavePost").addEventListener("click", async () => {
  try {
    const payload = {
      id: $("#postId").value.trim() || undefined,
      title: $("#postTitle").value.trim(),
      date: $("#postDate").value,
      section: $("#postSection").value,
      tags: parseTags($("#postTags").value),
      excerpt: $("#postExcerpt").value.trim(),
      cover: $("#postCover").value.trim(),
      body: $("#postBody").value
    };

    const r = await api("/api/posts/upsert", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    toast(`Guardado: ${r.id}`);
    await refreshAll();
    await loadPost(r.id);
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
  const opts = type === "service" ? currentServiceOptions() : currentProductOptions();
  blockId.innerHTML = opts.map(o => `<option value="${o.id}">${escapeHtml(o.label)}</option>`).join("");
  const id = blockId.value || opts[0]?.id || "";
  blockPreview.innerHTML = blockPreviewHtml(type, id);
}

blockType.addEventListener("change", fillBlockIds);
blockId.addEventListener("change", () => {
  blockPreview.innerHTML = blockPreviewHtml(blockType.value, blockId.value);
});

$("#btnInsertBlock").addEventListener("click", () => {
  const type = blockType.value;
  const id = blockId.value;
  if (!id) return toast("No hay item para insertar", false);

  insertAtCursor(postBody, () => `\n[[${type}:${id}]]\n`);
  $("#postPreview").innerHTML = mdToHtml(postBody.value);
  closeDlg(dlgBlock);
});

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
  });
});

// Preview toggle
$("#btnTogglePreview").addEventListener("click", () => {
  previewOn = !previewOn;
  const split = $("#editorSplit");
  split.classList.toggle("is-preview-hidden", !previewOn);
});

// Collapse library
$("#btnCollapseLibrary").addEventListener("click", () => {
  $("#postsLibrary").classList.toggle("is-collapsed");
});

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
    await refreshAll();
    clearPostEditor();
    clearProductEditor();
    clearServiceEditor();
    $("#editorSplit").classList.toggle("is-preview-hidden", !previewOn);
  } catch (e) {
    toast(`Error cargando: ${e.message}`, false);
  }
})();
