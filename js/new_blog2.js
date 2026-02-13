// new_blog.js — Local Journal + filters + refined modal reader (NO Shopify)

document.addEventListener('DOMContentLoaded', () => {
  const isEn = (document.documentElement.lang || '').toLowerCase().startsWith('en');
  const i18n = isEn ? {
    locale: 'en',
    allTag: 'All',
    results: (items, total) => `${items} result(s) - ${total} total`,
    noEntries: 'No entries for this filter.',
    loadingEntries: 'Loading entries...',
    loadingShort: 'Loading...',
    searchPlaceholder: 'title, tag, topic...',
    readTimeSuffix: 'min',
    coverAlt: 'Cover',
    contentError: (path) => `(Could not load content: ${path})`,
    noContent: '(No content)',
    errorLoading: 'Error loading.',
    errorLoadingEntries: 'Could not load entries. Check content-index.json.',
    tagFallback: 'Journal',
    services: [
      { title: 'MAPs Analysis', desc: 'Image analysis - microstructures' },
      { title: 'Materials diagnostics', desc: 'Characterization - technical report' },
      { title: 'Custom services', desc: 'Validation - integration - training' }
    ]
  } : {
    locale: 'es',
    allTag: 'Todos',
    results: (items, total) => `${items} resultado(s) - ${total} total`,
    noEntries: 'No hay entradas con ese filtro.',
    loadingEntries: 'Cargando entradas...',
    loadingShort: 'Cargando...',
    searchPlaceholder: 'titulo, tag, tema...',
    readTimeSuffix: 'min',
    coverAlt: 'Portada',
    contentError: (path) => `(No se pudo cargar el contenido: ${path})`,
    noContent: '(Sin contenido)',
    errorLoading: 'Error cargando.',
    errorLoadingEntries: 'No se pudieron cargar las entradas. Revisa content-index.json.',
    tagFallback: 'Journal',
    services: [
      { title: 'MAPs Analysis', desc: 'Analisis por imagen - microestructuras' },
      { title: 'Diagnostico de materiales', desc: 'Caracterizacion - informe tecnico' },
      { title: 'Servicios a medida', desc: 'Validacion - integracion - training' }
    ]
  };

  const CONTENT_INDEX_URL = '/content/content-index.json';
  const DEFAULT_POST_DIR = '/content/posts/';

  const listEl = document.getElementById('journal-list');
  const tagbarEl = document.getElementById('tagbar');
  const searchEl = document.getElementById('journal-search');
  const hintEl = document.getElementById('results-hint');
  const servicesEl = document.getElementById('services-list');

  const modal = document.getElementById('article-modal');
  const modalClose = document.getElementById('modal-close');
  const modalTitle = document.getElementById('modal-title');
  const modalDate = document.getElementById('modal-date');
  const modalDot = document.getElementById('modal-dot');
  const modalReadtime = document.getElementById('modal-readtime');
  const modalTags = document.getElementById('modal-tags');
  const modalCoverWrap = document.getElementById('modal-cover');
  const modalImage = document.getElementById('modal-image');
  const modalContent = document.getElementById('modal-content');

  let allArticles = [];
  let activeTag = i18n.allTag;
  let lastOpenedId = '';

  const safeText = (s) => (typeof s === 'string' ? s : '');

  function fmtDate(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString(i18n.locale, { year: 'numeric', month: 'short', day: '2-digit' }).toUpperCase();
  }

  function getPostId(p) {
    return (p?.id || p?.slug || p?.handle || '').toString().trim();
  }

  function normalizePost(p) {
    const id = getPostId(p);
    const title = safeText(p?.title) || (isEn ? 'Entry' : 'Entrada');
    const date = safeText(p?.date || p?.publishedAt || '');
    const tags = Array.isArray(p?.tags) ? p.tags.map(String) : [];
    const section = safeText(p?.section || '');
    const excerpt = safeText(p?.excerpt || p?.summary || '');
    const cover = safeText(p?.cover || p?.image || '');
    const file = safeText(p?.file || p?.path || p?.body || '');

    const bodyPath = file ? file : (id ? `${DEFAULT_POST_DIR}${id}.md` : '');
    return { id, title, date, tags, section, excerpt, cover, bodyPath };
  }

  async function fetchIndex() {
    const res = await fetch(CONTENT_INDEX_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const posts = Array.isArray(json?.posts) ? json.posts : [];
    return posts.map(normalizePost).filter(p => p.id);
  }

  function buildTagbar(articles) {
    const tags = new Set();
    articles.forEach(a => (a.tags || []).forEach(t => tags.add(t)));
    articles.forEach(a => { if (a.section) tags.add(a.section); });

    const all = [i18n.allTag, ...Array.from(tags).sort((a, b) => a.localeCompare(b))];

    tagbarEl.innerHTML = all.map(t => `
      <button type="button" class="tag-pill ${t === activeTag ? 'is-active' : ''}" data-tag="${escapeHtml(t)}">
        ${escapeHtml(t)}
      </button>
    `).join('');

    tagbarEl.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-tag]');
      if (!btn) return;
      activeTag = btn.dataset.tag || i18n.allTag;

      Array.from(tagbarEl.querySelectorAll('.tag-pill'))
        .forEach(b => b.classList.toggle('is-active', b.dataset.tag === activeTag));

      render();
    });
  }

  function filteredArticles() {
    const q = safeText(searchEl.value).toLowerCase().trim();

    return allArticles.filter(a => {
      const allTags = new Set([...(a.tags || []), ...(a.section ? [a.section] : [])]);
      const matchesTag = (activeTag === i18n.allTag) || allTags.has(activeTag);
      if (!matchesTag) return false;
      if (!q) return true;

      const hay = [a.title, a.excerpt, [...allTags].join(' ')].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }

  function render() {
    const items = filteredArticles();
    hintEl.textContent = i18n.results(items.length, allArticles.length);

    if (!items.length) {
      listEl.innerHTML = `<div class="journal-loading">${i18n.noEntries}</div>`;
      return;
    }

    listEl.innerHTML = items.map((a) => {
      const tag = a.section || (a.tags?.[0] || i18n.tagFallback);
      const excerpt = (a.excerpt || '').trim().slice(0, 180);
      const date = fmtDate(a.date);

      return `
        <button class="journal-open" type="button" data-id="${escapeHtml(a.id)}">
          <div class="journal-row">
            <div class="journal-date">${escapeHtml(date)}</div>
            <div class="journal-content">
              <div class="journal-tag">${escapeHtml(tag)}</div>
              <h3 class="journal-title">${escapeHtml(a.title)}</h3>
              ${excerpt ? `<p class="journal-excerpt">${escapeHtml(excerpt)}${excerpt.length >= 180 ? '…' : ''}</p>` : ''}
            </div>
            <div class="journal-action">↗</div>
          </div>
        </button>
      `;
    }).join('');

    listEl.querySelectorAll('button[data-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id || '';
        const article = allArticles.find(x => x.id === id);
        if (article) openModal(article, { pushHash: true });
      });
    });
  }

  async function loadArticleRaw(article) {
    if (!article?.bodyPath) return '';
    const res = await fetch(article.bodyPath, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  }

  function countWords(text) {
    // unicode-safe if available; fallback otherwise
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

  async function openModal(article, { pushHash = false } = {}) {
    lastOpenedId = article.id;

    modalTitle.textContent = safeText(article.title);
    modalDate.textContent = fmtDate(article.date);

    // tags
    const tagSet = new Set([...(article.tags || []), ...(article.section ? [article.section] : [])]);
    const tags = Array.from(tagSet).slice(0, 8);
    modalTags.innerHTML = tags.length
      ? tags.map(t => `<span class="tagchip">${escapeHtml(t)}</span>`).join('')
      : `<span class="tagchip">${i18n.tagFallback}</span>`;

    // cover
    const imgUrl = article.cover || '';
    if (imgUrl) {
      modalCoverWrap.hidden = false;
      modalImage.src = imgUrl;
      modalImage.alt = article.title || i18n.coverAlt;
    } else {
      modalCoverWrap.hidden = true;
      modalImage.removeAttribute('src');
      modalImage.alt = '';
    }

    // loading state
    modalContent.innerHTML = `<p style="opacity:.75;">${i18n.loadingShort}</p>`;
    modalReadtime.textContent = '';
    modalReadtime.style.display = 'none';
    modalDot.style.display = 'none';

    let raw = '';
    try {
      raw = await loadArticleRaw(article);
    } catch (e) {
      console.warn(e);
      modalContent.innerHTML = `<p>${i18n.contentError(escapeHtml(article.bodyPath))}</p>`;
    }

    // read time
    if (raw) {
      const rt = estimateReadTimeFromText(raw);
      modalReadtime.textContent = `${rt.minutes} ${i18n.readTimeSuffix}`;
      modalReadtime.style.display = 'inline';
      modalDot.style.display = 'inline';
    }

    // render body
    const path = (article.bodyPath || '').toLowerCase();
    if (raw) {
      if (path.endsWith('.html') || raw.trim().startsWith('<')) {
        modalContent.innerHTML = raw;
      } else {
        modalContent.innerHTML = mdToHtml(raw);
      }
    }

    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    if (pushHash) setHashPostId(article.id);
  }

  function closeModal({ clearHash = true } = {}) {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';

    if (clearHash) {
      const current = getHashPostId();
      if (current) clearHashPostId();
    }
  }

  modalClose?.addEventListener('click', () => closeModal({ clearHash: true }));
  modal.addEventListener('click', (e) => {
    if (e.target?.dataset?.close === 'true') closeModal({ clearHash: true });
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal({ clearHash: true });
  });

  searchEl.addEventListener('input', () => render());

  function getHashPostId() {
    const raw = (location.hash || '').replace(/^#/, '').trim();
    if (!raw) return '';
    const params = new URLSearchParams(raw);
    const viaParam = params.get('post');
    if (viaParam) return decodeURIComponent(viaParam);
    if (raw.startsWith('post:')) return decodeURIComponent(raw.slice(5));
    return '';
  }

  function setHashPostId(id) {
    const newHash = `post=${encodeURIComponent(id)}`;
    if (location.hash.replace(/^#/, '') === newHash) return;
    history.replaceState(null, '', `${location.pathname}${location.search}#${newHash}`);
  }

  function clearHashPostId() {
    history.replaceState(null, '', `${location.pathname}${location.search}`);
  }

  function applyDeepLinkIfAny() {
    const id = getHashPostId();
    if (!id) return;

    const article = allArticles.find(x => x.id === id);
    if (!article) return;

    // fallback: escribe el título en el buscador + filtra
    searchEl.value = article.title;
    activeTag = i18n.allTag;
    Array.from(tagbarEl.querySelectorAll('.tag-pill'))
      .forEach(b => b.classList.toggle('is-active', b.dataset.tag === activeTag));
    render();

    // abre directamente
    openModal(article, { pushHash: false });
  }

  window.addEventListener('hashchange', () => {
    const id = getHashPostId();
    if (!id) {
      if (modal.classList.contains('is-open')) closeModal({ clearHash: false });
      return;
    }

    const article = allArticles.find(x => x.id === id);
    if (article && id !== lastOpenedId) {
      searchEl.value = article.title;
      activeTag = i18n.allTag;
      render();
      openModal(article, { pushHash: false });
    }
  });

  function renderServicesFallback() {
    if (!servicesEl) return;
    servicesEl.innerHTML = `
      <li><div style="font-weight:700; margin-bottom:4px;">${i18n.services[0].title}</div><div style="opacity:.75; font-size:.92rem;">${i18n.services[0].desc}</div></li>
      <li><div style="font-weight:700; margin-bottom:4px;">${i18n.services[1].title}</div><div style="opacity:.75; font-size:.92rem;">${i18n.services[1].desc}</div></li>
      <li><div style="font-weight:700; margin-bottom:4px;">${i18n.services[2].title}</div><div style="opacity:.75; font-size:.92rem;">${i18n.services[2].desc}</div></li>
    `;
  }

  // --- Markdown renderer (minimal + figures) ---
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }

  function mdInline(s) {
    // images -> figure
    s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, url) => {
      const u = url.trim().replace(/^<|>$/g,'');
      const caption = (alt || '').trim();
      return `
        <figure class="md-figure">
          <img src="${escapeHtml(u)}" alt="${escapeHtml(caption)}" loading="lazy" />
          ${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ``}
        </figure>
      `.trim();
    });

    // links
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, text, url) => {
      const u = url.trim().replace(/^<|>$/g,'');
      return `<a href="${escapeHtml(u)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`;
    });

    // inline code
    s = s.replace(/`([^`]+)`/g, (_m, code) => `<code>${escapeHtml(code)}</code>`);

    // bold
    s = s.replace(/\*\*([^*]+)\*\*/g, (_m, b) => `<strong>${escapeHtml(b)}</strong>`);

    // italic (simple)
    s = s.replace(/\*([^*]+)\*/g, (_m, i) => `<em>${escapeHtml(i)}</em>`);

    return s;
  }

  function mdToHtml(md) {
    const lines = String(md || '').replace(/\r\n/g, '\n').split('\n');
    let html = '';
    let inCode = false;
    let codeBuf = [];
    let inUl = false;
    let inOl = false;

    const flushList = () => {
      if (inUl) { html += '</ul>'; inUl = false; }
      if (inOl) { html += '</ol>'; inOl = false; }
    };

    for (let i=0; i<lines.length; i++) {
      const line = lines[i];

      if (line.trim().startsWith('```')) {
        if (!inCode) {
          flushList();
          inCode = true;
          codeBuf = [];
        } else {
          inCode = false;
          const code = escapeHtml(codeBuf.join('\n'));
          html += `<pre><code>${code}</code></pre>`;
        }
        continue;
      }

      if (inCode) { codeBuf.push(line); continue; }

      const t = line.trim();
      if (!t) { flushList(); continue; }

      if (/^(-{3,}|_{3,}|\*{3,})$/.test(t)) {
        flushList();
        html += '<hr />';
        continue;
      }

      const h = t.match(/^(#{1,6})\s+(.*)$/);
      if (h) {
        flushList();
        const level = h[1].length;
        html += `<h${level}>${mdInline(h[2])}</h${level}>`;
        continue;
      }

      if (t.startsWith('>')) {
        flushList();
        html += `<blockquote>${mdInline(t.replace(/^>\s?/, ''))}</blockquote>`;
        continue;
      }

      const ul = t.match(/^[-*+]\s+(.*)$/);
      if (ul) {
        if (!inUl) { flushList(); html += '<ul>'; inUl = true; }
        html += `<li>${mdInline(ul[1])}</li>`;
        continue;
      }

      const ol = t.match(/^\d+\.\s+(.*)$/);
      if (ol) {
        if (!inOl) { flushList(); html += '<ol>'; inOl = true; }
        html += `<li>${mdInline(ol[1])}</li>`;
        continue;
      }

      flushList();
      html += `<p>${mdInline(t)}</p>`;
    }

    if (inCode) {
      const code = escapeHtml(codeBuf.join('\n'));
      html += `<pre><code>${code}</code></pre>`;
    }
    if (inUl) html += '</ul>';
    if (inOl) html += '</ol>';

    return html || `<p>${i18n.noContent}</p>`;
  }

  // Boot
  (async () => {
    try {
      allArticles = await fetchIndex();
      allArticles.sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));

      buildTagbar(allArticles);
      render();
      renderServicesFallback();

      applyDeepLinkIfAny();
    } catch (err) {
      console.error(err);
      hintEl.textContent = i18n.errorLoading;
      listEl.innerHTML = `<div class="journal-loading">${i18n.errorLoadingEntries}</div>`;
      renderServicesFallback();
    }
  })();
});
