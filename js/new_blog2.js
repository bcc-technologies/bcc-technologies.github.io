// new_blog.js — Local content (file-based) + filters + modal reader
// Reads: /content/content-index.json
// Posts: index.posts[] with bodyUrl -> /content/posts/<id>.md
// Supports blocks: [[service:ID]] [[product:ID]]
// Supports images: ![alt](url) and lists/links/quotes/basic markdown.

document.addEventListener('DOMContentLoaded', () => {
  const listEl = document.getElementById('journal-list');
  const sectionbarEl = document.getElementById('sectionbar');
  const tagbarEl = document.getElementById('tagbar');
  const searchEl = document.getElementById('journal-search');
  const hintEl = document.getElementById('results-hint');
  const servicesEl = document.getElementById('services-list');

  const modal = document.getElementById('article-modal');
  const modalClose = document.getElementById('modal-close');
  const modalTitle = document.getElementById('modal-title');
  const modalDate = document.getElementById('modal-date');
  const modalTags = document.getElementById('modal-tags');
  const modalImage = document.getElementById('modal-image');
  const modalContent = document.getElementById('modal-content');

  let allArticles = [];
  let allProducts = [];
  let allServices = [];

  let activeTag = 'Todos';
  let activeSections = new Set();

  let tagbarBound = false;
  let sectionbarBound = false;

  const bodyCache = new Map(); // id -> html

  const safeText = (s) => (typeof s === 'string' ? s : '');
  const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

  const escapeHtml = (s) => String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const fmtDate = (isoOrYmd) => {
    try {
      const d = new Date(isoOrYmd);
      if (Number.isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('es', { year: 'numeric', month: 'short', day: '2-digit' }).toUpperCase();
    } catch {
      return '—';
    }
  };

  // Sections now based on post.section
  const SECTION_DEFS = [
    { id: 'company',  label: 'Empresa' },
    { id: 'research', label: 'Investigación' },
    { id: 'products', label: 'Productos' },
    { id: 'services', label: 'Servicios' },
    { id: 'other',    label: 'Otros' }
  ];

  const sectionIdByLabel = (() => {
    const m = new Map();
    SECTION_DEFS.forEach(s => m.set(norm(s.label), s.id));
    return m;
  })();

  const setAllSectionsActive = () => {
    activeSections = new Set(SECTION_DEFS.map(s => s.id));
  };
  setAllSectionsActive();

  function articleSectionIds(article) {
    const secLabel = norm(article.section || '');
    const id = sectionIdByLabel.get(secLabel) || 'other';
    return [id];
  }

  const reservedTagSet = (() => {
    const s = new Set();
    SECTION_DEFS.forEach(sec => s.add(norm(sec.label)));
    return s;
  })();

  async function fetchLocalIndex() {
    const res = await fetch('/content/content-index.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  }

  function serviceCardHtml(id) {
    const s = (allServices || []).find(x => x.id === id);
    if (!s) return `<div class="bcc-card"><div class="bcc-card-title">Servicio</div><div class="bcc-card-sub">(no encontrado: ${escapeHtml(id)})</div></div>`;

    const caps = String(s.capabilities || "")
      .split("\n").map(x => x.trim()).filter(Boolean).slice(0, 8);

    return `
      <div class="bcc-card">
        <div class="bcc-card-kicker">SERVICIO</div>
        <div class="bcc-card-title">${escapeHtml(s.name || id)}</div>
        <div class="bcc-card-sub">${escapeHtml(s.category || "BCC")}</div>
        ${s.summary ? `<div class="bcc-card-body">${escapeHtml(s.summary)}</div>` : ""}
        ${caps.length ? `<ul class="bcc-card-list">${caps.map(c => `<li>${escapeHtml(c)}</li>`).join("")}</ul>` : ""}
        ${s.pageUrl ? `<a class="bcc-card-link" href="${escapeHtml(s.pageUrl)}">Ver servicio ↗</a>` : ""}
      </div>
    `;
  }

  function productCardHtml(id) {
    const p = (allProducts || []).find(x => x.id === id);
    if (!p) return `<div class="bcc-card"><div class="bcc-card-title">Producto</div><div class="bcc-card-sub">(no encontrado: ${escapeHtml(id)})</div></div>`;

    return `
      <div class="bcc-card">
        <div class="bcc-card-kicker">PRODUCTO</div>
        <div class="bcc-card-title">${escapeHtml(p.name || id)}</div>
        <div class="bcc-card-sub">${escapeHtml(p.category || p.status || "BCC")}</div>
        ${p.summary ? `<div class="bcc-card-body">${escapeHtml(p.summary)}</div>` : ""}
        ${p.pageUrl ? `<a class="bcc-card-link" href="${escapeHtml(p.pageUrl)}">Ver producto ↗</a>` : ""}
      </div>
    `;
  }

  // Markdown -> HTML (images, lists, links, quote, hr, codeblocks)
  function mdToHtml(md) {
    const lines = String(md || '').split('\n');
    let out = [];
    let inCode = false;
    let codeBuf = [];
    let inUl = false;
    let inOl = false;

    const closeLists = () => {
      if (inUl) { out.push('</ul>'); inUl = false; }
      if (inOl) { out.push('</ol>'); inOl = false; }
    };

    const renderInline = (s) => {
      let esc = escapeHtml(s);

      // images
      esc = esc.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, url) => {
        const safeAlt = escapeHtml(alt);
        const safeUrl = escapeHtml(String(url).trim());
        const cap = safeAlt ? `<figcaption>${safeAlt}</figcaption>` : "";
        return `<figure class="article-figure"><img src="${safeUrl}" alt="${safeAlt}"/>${cap}</figure>`;
      });

      // links
      esc = esc.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, text, url) => {
        const safeText = escapeHtml(text);
        const safeUrl = escapeHtml(String(url).trim());
        return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeText}</a>`;
      });

      // inline formatting
      esc = esc
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code>$1</code>');

      return esc;
    };

    for (const line of lines) {
      const t = line.trim();

      // blocks: [[service:id]] / [[product:id]]
      const block = t.match(/^\[\[(service|product):([a-z0-9\-]+)\]\]$/i);
      if (block) {
        closeLists();
        const type = block[1].toLowerCase();
        const id = block[2];
        out.push(type === "service" ? serviceCardHtml(id) : productCardHtml(id));
        continue;
      }

      if (line.startsWith('```')) {
        closeLists();
        if (!inCode) { inCode = true; codeBuf = []; }
        else {
          inCode = false;
          out.push(`<pre><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`);
        }
        continue;
      }
      if (inCode) { codeBuf.push(line); continue; }

      if (t === '---' || t === '***' || t === '___') { closeLists(); out.push('<hr/>'); continue; }

      if (line.startsWith('# ')) { closeLists(); out.push(`<h1>${renderInline(line.slice(2))}</h1>`); continue; }
      if (line.startsWith('## ')) { closeLists(); out.push(`<h2>${renderInline(line.slice(3))}</h2>`); continue; }
      if (line.startsWith('### ')) { closeLists(); out.push(`<h3>${renderInline(line.slice(4))}</h3>`); continue; }

      if (line.startsWith('> ')) { closeLists(); out.push(`<blockquote>${renderInline(line.slice(2))}</blockquote>`); continue; }

      const mUl = line.match(/^\s*[-*]\s+(.+)$/);
      if (mUl) {
        if (!inUl) { closeLists(); out.push('<ul>'); inUl = true; }
        out.push(`<li>${renderInline(mUl[1])}</li>`);
        continue;
      }

      const mOl = line.match(/^\s*\d+\.\s+(.+)$/);
      if (mOl) {
        if (!inOl) { closeLists(); out.push('<ol>'); inOl = true; }
        out.push(`<li>${renderInline(mOl[1])}</li>`);
        continue;
      }

      if (t === '') { closeLists(); out.push(''); continue; }

      closeLists();
      out.push(`<p>${renderInline(line)}</p>`);
    }

    closeLists();
    return out.join('\n');
  }

  async function fetchPostBodyHtml(article) {
    if (article?.id && bodyCache.has(article.id)) return bodyCache.get(article.id);

    const url = article?.bodyUrl;
    if (!url) {
      const fallback = '<p>(Sin contenido)</p>';
      if (article?.id) bodyCache.set(article.id, fallback);
      return fallback;
    }

    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      const fallback = '<p>(No se pudo cargar el contenido)</p>';
      if (article?.id) bodyCache.set(article.id, fallback);
      return fallback;
    }

    const md = await res.text();
    const html = mdToHtml(md);
    if (article?.id) bodyCache.set(article.id, html);
    return html;
  }

  function buildSectionbar(articles) {
    if (!sectionbarEl) return;

    const counts = {};
    SECTION_DEFS.forEach(s => counts[s.id] = 0);

    articles.forEach(a => {
      articleSectionIds(a).forEach(id => counts[id] = (counts[id] || 0) + 1);
    });

    const isAllActive = activeSections.size === SECTION_DEFS.length;

    sectionbarEl.innerHTML = `
      <button type="button" class="section-pill ${isAllActive ? 'is-active' : ''}" data-sec="__all">
        Todas <span class="count">${articles.length}</span>
      </button>
      ${SECTION_DEFS.map(sec => `
        <button type="button" class="section-pill ${activeSections.has(sec.id) ? 'is-active' : ''}" data-sec="${sec.id}">
          ${sec.label} <span class="count">${counts[sec.id] || 0}</span>
        </button>
      `).join('')}
    `;

    if (!sectionbarBound) {
      sectionbarEl.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-sec]');
        if (!btn) return;

        const id = btn.dataset.sec;
        if (id === '__all') {
          setAllSectionsActive();
        } else {
          if (activeSections.has(id)) activeSections.delete(id);
          else activeSections.add(id);
          if (activeSections.size === 0) setAllSectionsActive();
        }

        const allActiveNow = activeSections.size === SECTION_DEFS.length;
        sectionbarEl.querySelectorAll('.section-pill').forEach(b => {
          if (b.dataset.sec === '__all') b.classList.toggle('is-active', allActiveNow);
          else b.classList.toggle('is-active', activeSections.has(b.dataset.sec));
        });

        render();
      });
      sectionbarBound = true;
    }
  }

  function buildTagbar(articles) {
    if (!tagbarEl) return;

    const tags = new Set();
    articles.forEach(a => (a.tags || []).forEach(t => {
      if (!reservedTagSet.has(norm(t))) tags.add(t);
    }));

    const all = ['Todos', ...Array.from(tags).sort((a, b) => a.localeCompare(b))];

    tagbarEl.innerHTML = all.map(t => `
      <button type="button" class="tag-pill ${t === activeTag ? 'is-active' : ''}" data-tag="${t}">
        ${t}
      </button>
    `).join('');

    if (!tagbarBound) {
      tagbarEl.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-tag]');
        if (!btn) return;

        activeTag = btn.dataset.tag || 'Todos';
        tagbarEl.querySelectorAll('.tag-pill')
          .forEach(b => b.classList.toggle('is-active', b.dataset.tag === activeTag));

        render();
      });
      tagbarBound = true;
    }
  }

  function filteredArticles() {
    const q = safeText(searchEl?.value).toLowerCase().trim();
    const activeTagN = norm(activeTag);

    return allArticles.filter(a => {
      const secIds = articleSectionIds(a);
      if (!secIds.some(id => activeSections.has(id))) return false;

      const tagsN = (a.tags || []).map(norm);
      const matchesTag = (activeTag === 'Todos') || tagsN.includes(activeTagN);
      if (!matchesTag) return false;

      if (!q) return true;
      const hay = [a.title, a.excerpt || '', (a.tags || []).join(' ')].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }

  function render() {
    const items = filteredArticles();
    if (hintEl) hintEl.textContent = `${items.length} resultado(s) • ${allArticles.length} total`;

    if (!items.length) {
      listEl.innerHTML = `<div class="journal-loading">No hay entradas con ese filtro.</div>`;
      return;
    }

    listEl.innerHTML = items.map((a, idx) => {
      const sectionLabel = (a.section ? String(a.section).toUpperCase() : 'JOURNAL');
      const excerpt = safeText(a.excerpt).slice(0, 180);
      const date = fmtDate(a.date);

      return `
        <button class="journal-open" type="button" data-idx="${idx}">
          <div class="journal-row">
            <div class="journal-date">${date}</div>
            <div class="journal-content">
              <div class="journal-tag">${sectionLabel}</div>
              <h3 class="journal-title">${escapeHtml(safeText(a.title))}</h3>
              <p class="journal-excerpt">${escapeHtml(excerpt)}${excerpt.length >= 180 ? '…' : ''}</p>
            </div>
            <div class="journal-action">↗</div>
          </div>
        </button>
      `;
    }).join('');

    listEl.querySelectorAll('button[data-idx]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const localIdx = Number(btn.dataset.idx);
        const article = items[localIdx];
        await openModal(article);
      });
    });
  }

  async function openModal(article) {
    modalTitle.textContent = safeText(article.title);
    modalDate.textContent = fmtDate(article.date);

    const tags = (article.tags || []).slice(0, 6);
    modalTags.innerHTML = tags.length
      ? tags.map(t => `<span class="tagchip">${escapeHtml(t)}</span>`).join('')
      : `<span class="tagchip">Journal</span>`;

    const imgUrl = article.cover || '';
    modalImage.style.display = imgUrl ? 'block' : 'none';
    if (imgUrl) {
      modalImage.src = imgUrl;
      modalImage.alt = article.title || 'Imagen del artículo';
    } else {
      modalImage.removeAttribute('src');
      modalImage.alt = '';
    }

    modalContent.innerHTML = `<p style="opacity:.75;">Cargando…</p>`;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    try {
      const html = await fetchPostBodyHtml(article);
      modalContent.innerHTML = html || '<p>(Sin contenido)</p>';
    } catch (e) {
      modalContent.innerHTML = `<p>(No se pudo cargar el contenido)</p>`;
      console.error(e);
    }
  }

  function closeModal() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  modalClose?.addEventListener('click', closeModal);
  modal?.addEventListener('click', (e) => {
    if (e.target?.dataset?.close === 'true') closeModal();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
  });

  searchEl?.addEventListener('input', render);

  function renderRail() {
    if (!servicesEl) return;

    const hasServices = Array.isArray(allServices) && allServices.length > 0;
    const items = hasServices
      ? allServices.slice(0, 6).map(s => ({ title: s.name, subtitle: s.category || 'Servicio', url: s.pageUrl || '' }))
      : (allProducts || []).slice(0, 6).map(p => ({ title: p.name, subtitle: p.category || (p.status || 'Producto'), url: p.pageUrl || '' }));

    servicesEl.innerHTML = items.length
      ? items.map(it => it.url
        ? `<li><a href="${escapeHtml(it.url)}" style="text-decoration:none; color:inherit;">
            <div style="font-weight:700; margin-bottom:4px;">${escapeHtml(it.title)}</div>
            <div style="color: rgba(15,17,21,0.68); font-size:0.92rem;">${escapeHtml(it.subtitle)}</div>
          </a></li>`
        : `<li>
            <div style="font-weight:700; margin-bottom:4px;">${escapeHtml(it.title)}</div>
            <div style="color: rgba(15,17,21,0.68); font-size:0.92rem;">${escapeHtml(it.subtitle)}</div>
          </li>`
      ).join('')
      : `<li class="rail-muted">No hay elementos.</li>`;
  }

  (async () => {
    try {
      const data = await fetchLocalIndex();

      allProducts = Array.isArray(data.products) ? data.products : [];
      allServices = Array.isArray(data.services) ? data.services : [];

      const posts = Array.isArray(data.posts) ? data.posts : [];
      allArticles = posts.map(p => ({
        id: p.id,
        title: p.title,
        excerpt: p.excerpt || '',
        date: p.date,
        section: p.section || 'Otros',
        tags: Array.isArray(p.tags) ? p.tags : [],
        cover: p.cover || '',
        bodyUrl: p.bodyUrl || ''
      }));

      buildSectionbar(allArticles);
      buildTagbar(allArticles);

      render();
      renderRail();
    } catch (err) {
      console.error(err);
      if (hintEl) hintEl.textContent = 'Error cargando.';
      if (listEl) listEl.innerHTML = `<div class="journal-loading">No se pudieron cargar las entradas.</div>`;
      if (servicesEl) servicesEl.innerHTML = `<li class="rail-muted">No se pudieron cargar.</li>`;
    }
  })();
});
