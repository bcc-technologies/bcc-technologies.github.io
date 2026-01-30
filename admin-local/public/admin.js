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
    headers: { "Content-Type": "application/json" },
    ...opts
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function parseTags(s) {
  return String(s || "")
    .split(",")
    .map(x => x.trim())
    .filter(Boolean);
}

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

// Preview markdown (rápido, sin libs externas)
function mdToHtml(md) {
  const lines = String(md || "").split("\n");
  let out = [];
  let inCode = false;
  let codeBuf = [];

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (!inCode) { inCode = true; codeBuf = []; }
      else {
        inCode = false;
        out.push(`<pre><code>${escapeHtml(codeBuf.join("\n"))}</code></pre>`);
      }
      continue;
    }

    if (inCode) { codeBuf.push(line); continue; }

    if (line.startsWith("### ")) out.push(`<h3>${escapeHtml(line.slice(4))}</h3>`);
    else if (line.startsWith("## ")) out.push(`<h2>${escapeHtml(line.slice(3))}</h2>`);
    else if (line.startsWith("# ")) out.push(`<h1>${escapeHtml(line.slice(2))}</h1>`);
    else if (line.trim() === "") out.push("");
    else {
      const p = escapeHtml(line)
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        .replace(/`(.+?)`/g, "<code>$1</code>");
      out.push(`<p>${p}</p>`);
    }
  }
  return out.join("\n");
}

// Tabs
document.querySelectorAll(".nav-item").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("is-active"));
    btn.classList.add("is-active");

    const tab = btn.dataset.tab;
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("is-active"));
    $("#tab-" + tab).classList.add("is-active");
  });
});

// State
let INDEX = { posts: [], products: [], services: [] };
let currentPostId = "";
let currentProductId = "";
let currentServiceId = "";

// Load
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

// POSTS UI
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
          <span class="muted">${escapeHtml((p.tags||[]).slice(0,3).join(", "))}</span>
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

// PRODUCTS UI
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

  list.querySelectorAll(".item").forEach(el => {
    el.addEventListener("click", () => loadProduct(el.dataset.id));
  });
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

    const r = await api("/api/products/upsert", {
      method: "POST",
      body: JSON.stringify(payload)
    });

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

// SERVICES UI
function renderServices() {
  $("#servicesCount").textContent = `${INDEX.services.length} servicio(s)`;

  const list = $("#servicesList");
  list.innerHTML = INDEX.services.map(s => `
    <div class="item" data-id="${s.id}">
      <div>
        <div class="item-title">${escapeHtml(s.name || "(sin nombre)")}</div>
        <div class="meta">
          <span class="badge">${escapeHtml(s.category || "—")}</span>
          <span class="muted">${escapeHtml((s.tags||[]).slice(0,3).join(", "))}</span>
        </div>
      </div>
      <div class="badge">${escapeHtml(s.id)}</div>
    </div>
  `).join("") || `<div class="muted" style="padding:10px;">No hay servicios.</div>`;

  list.querySelectorAll(".item").forEach(el => {
    el.addEventListener("click", () => loadService(el.dataset.id));
  });
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
      deliverables: $("#serviceDeliverables").value.trim(),
      requirements: $("#serviceRequirements").value.trim()
    };

    const r = await api("/api/services/upsert", {
      method: "POST",
      body: JSON.stringify(payload)
    });

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

// Publish + refresh
$("#btnPublish").addEventListener("click", async () => {
  try {
    const msg = $("#commitMsg").value.trim() || "Update content";
    await api("/api/git/publish", {
      method: "POST",
      body: JSON.stringify({ message: msg })
    });
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

// Boot
(async () => {
  try {
    await refreshAll();
    clearPostEditor();
    clearProductEditor();
    clearServiceEditor();
  } catch (e) {
    toast(`Error cargando: ${e.message}`, false);
  }
})();
