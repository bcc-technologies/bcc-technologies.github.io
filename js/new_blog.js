// new_blog.js — Shopify fetch + render Journal archive + filters + modal reader

document.addEventListener('DOMContentLoaded', () => {
  const SHOPIFY_DOMAIN = '2e2e5e-7c.myshopify.com';
  const STOREFRONT_TOKEN = '60ee1e20cccd72924afe74642353e01c'; // Storefront token (public)

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

  // ---- State
  let allArticles = [];
  let activeTag = 'Todos';
  let activeSections = new Set(); // multi-select

  let tagbarBound = false;
  let sectionbarBound = false;

  // ---- Helpers
  const safeText = (s) => (typeof s === 'string' ? s : '');

  const norm = (s) => String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  const stripHtml = (html) => {
    const div = document.createElement('div');
    div.innerHTML = html || '';
    return (div.textContent || div.innerText || '').trim();
  };

  const fmtDate = (iso) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('es', { year: 'numeric', month: 'short', day: '2-digit' }).toUpperCase();
    } catch {
      return '—';
    }
  };

  // ---- Section definitions
  // Recomendación editorial:
  // En Shopify, ponle a cada post EXACTAMENTE 1 tag de sección:
  // "Empresa" o "Investigación" o "Productos" o "Servicios".
  // (Si no tiene ninguno, cae en "Otros".)
  const SECTION_DEFS = [
    { id: 'company',  label: 'Empresa',        tokens: ['empresa', 'company', 'news', 'press', 'pr'] },
    { id: 'research', label: 'Investigación',  tokens: ['investigacion', 'investigación', 'research', 'paper', 'rd', 'r&d', 'i+d'] },
    { id: 'products', label: 'Productos',      tokens: ['producto', 'productos', 'product', 'release', 'maps', 'aquaspecter'] },
    { id: 'services', label: 'Servicios',      tokens: ['servicio', 'servicios', 'service', 'consulting', 'diagnostico', 'diagnóstico'] },
    { id: 'other',    label: 'Otros',          tokens: [] }
  ];

  const setAllSectionsActive = () => {
    activeSections = new Set(SECTION_DEFS.map(s => s.id));
  };

  // Default: todas activas
  setAllSectionsActive();

  const reservedTagSet = (() => {
    const s = new Set();
    SECTION_DEFS.forEach(sec => {
      s.add(norm(sec.label));
      (sec.tokens || []).forEach(t => s.add(norm(t)));
    });
    return s;
  })();

  function articleSectionIds(article) {
    const tagSet = new Set((article.tags || []).map(norm));

    const matched = [];
    for (const sec of SECTION_DEFS) {
      if (sec.id === 'other') continue;
      if ((sec.tokens || []).some(tok => tagSet.has(norm(tok)))) matched.push(sec.id);
    }

    if (matched.length === 0) matched.push('other');
    return matched;
  }

  // ---- Shopify
  async function fetchShopifyData() {
    const query = `
      {
        blogs(first: 1) {
          edges {
            node {
              articles(first: 50, sortKey: PUBLISHED_AT, reverse: true) {
                edges {
                  node {
                    title
                    excerptHtml
                    contentHtml
                    handle
                    publishedAt
                    tags
                    image { url altText }
                  }
                }
              }
            }
          }
        }
        products(first: 6) {
          edges {
            node {
              title
              handle
              variants(first: 1) {
                edges {
                  node {
                    priceV2 { amount currencyCode }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const res = await fetch(`https://${SHOPIFY_DOMAIN}/api/2024-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': STOREFRONT_TOKEN
      },
      body: JSON.stringify({ query })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.errors) throw new Error(JSON.stringify(json.errors));
    return json.data;
  }

  // ---- UI builders
  function buildSectionbar(articles) {
    if (!sectionbarEl) return;

    const counts = {};
    SECTION_DEFS.forEach(s => counts[s.id] = 0);

    articles.forEach(a => {
      const secs = articleSectionIds(a);
      secs.forEach(id => counts[id] = (counts[id] || 0) + 1);
    });

    const isAllActive = activeSections.size === SECTION_DEFS.length;
    const total = articles.length;

    sectionbarEl.innerHTML = `
      <button type="button" class="section-pill ${isAllActive ? 'is-active' : ''}" data-sec="__all">
        Todas <span class="count">${total}</span>
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

          // si apagan todas por accidente, reseteamos a "todas"
          if (activeSections.size === 0) setAllSectionsActive();
        }

        // refresh active states
        const allActiveNow = activeSections.size === SECTION_DEFS.length;
        Array.from(sectionbarEl.querySelectorAll('.section-pill')).forEach(b => {
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
      // evita duplicar “secciones” en el tagbar
      if (!reservedTagSet.has(norm(t))) tags.add(t);
    }));

    const all = ['Todos', ...Array.from(tags).sort((a,b) => a.localeCompare(b))];

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
        Array.from(tagbarEl.querySelectorAll('.tag-pill'))
          .forEach(b => b.classList.toggle('is-active', b.dataset.tag === activeTag));

        render();
      });

      tagbarBound = true;
    }
  }

  // ---- Filtering
  function filteredArticles() {
    const q = safeText(searchEl.value).toLowerCase().trim();
    const activeTagN = norm(activeTag);

    return allArticles.filter(a => {
      // 1) Section filter (multi-select)
      const secIds = articleSectionIds(a);
      const matchesSection = secIds.some(id => activeSections.has(id));
      if (!matchesSection) return false;

      // 2) Tag filter (single)
      const tagsN = (a.tags || []).map(norm);
      const matchesTag = (activeTag === 'Todos') || tagsN.includes(activeTagN);
      if (!matchesTag) return false;

      // 3) Search
      if (!q) return true;
      const hay = [
        a.title,
        stripHtml(a.excerptHtml),
        (a.tags || []).join(' ')
      ].join(' ').toLowerCase();

      return hay.includes(q);
    });
  }

  // ---- Render
  function render() {
    const items = filteredArticles();
    hintEl.textContent = `${items.length} resultado(s) • ${allArticles.length} total`;

    if (!items.length) {
      listEl.innerHTML = `<div class="journal-loading">No hay entradas con ese filtro.</div>`;
      return;
    }

    listEl.innerHTML = items.map((a, idx) => {
      // Mantén tu “tag” visible: si existe un tag de sección, úsalo como el principal
      const tagsN = (a.tags || []).map(norm);
      const sectionLabel =
        tagsN.includes(norm('empresa')) ? 'EMPRESA' :
        (tagsN.includes(norm('investigación')) || tagsN.includes(norm('investigacion'))) ? 'INVESTIGACIÓN' :
        tagsN.includes(norm('productos')) ? 'PRODUCTOS' :
        tagsN.includes(norm('servicios')) ? 'SERVICIOS' :
        ((a.tags && a.tags.length) ? String(a.tags[0]).toUpperCase() : 'JOURNAL');

      const excerpt = stripHtml(a.excerptHtml).slice(0, 180);
      const date = fmtDate(a.publishedAt);

      return `
        <button class="journal-open" type="button" data-idx="${idx}">
          <div class="journal-row">
            <div class="journal-date">${date}</div>
            <div class="journal-content">
              <div class="journal-tag">${sectionLabel}</div>
              <h3 class="journal-title">${safeText(a.title)}</h3>
              <p class="journal-excerpt">${excerpt}${excerpt.length >= 180 ? '…' : ''}</p>
            </div>
            <div class="journal-action">↗</div>
          </div>
        </button>
      `;
    }).join('');

    listEl.querySelectorAll('button[data-idx]').forEach(btn => {
      btn.addEventListener('click', () => {
        const localIdx = Number(btn.dataset.idx);
        const article = items[localIdx];
        openModal(article);
      });
    });
  }

  // ---- Modal
  function openModal(article) {
    modalTitle.textContent = safeText(article.title);
    modalDate.textContent = fmtDate(article.publishedAt);

    const tags = (article.tags || []).slice(0, 6);
    modalTags.innerHTML = tags.length
      ? tags.map(t => `<span class="tagchip">${t}</span>`).join('')
      : `<span class="tagchip">Journal</span>`;

    const imgUrl = article.image?.url || '';
    modalImage.style.display = imgUrl ? 'block' : 'none';
    if (imgUrl) {
      modalImage.src = imgUrl;
      modalImage.alt = article.image?.altText || article.title || 'Imagen del artículo';
    } else {
      modalImage.removeAttribute('src');
      modalImage.alt = '';
    }

    modalContent.innerHTML = article.contentHtml || '<p>(Sin contenido)</p>';

    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  modalClose?.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target?.dataset?.close === 'true') closeModal();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
  });

  searchEl.addEventListener('input', () => render());

  // ---- Sidebar services
  function renderServices(products) {
    if (!products.length) {
      servicesEl.innerHTML = `<li class="rail-muted">No hay productos.</li>`;
      return;
    }

    servicesEl.innerHTML = products.map(p => {
      const priceNode = p?.variants?.edges?.[0]?.node?.priceV2;
      const price = priceNode ? `${priceNode.amount} ${priceNode.currencyCode}` : '—';
      return `
        <li>
          <div style="font-weight:700; margin-bottom:4px;">${safeText(p.title)}</div>
          <div style="color: rgba(15,17,21,0.68); font-size:0.92rem;">Base: ${price}</div>
        </li>
      `;
    }).join('');
  }

  // ---- Boot
  (async () => {
    try {
      const data = await fetchShopifyData();

      const articles = data.blogs.edges?.[0]?.node?.articles?.edges?.map(e => e.node) || [];
      const products = data.products.edges?.map(e => e.node) || [];

      allArticles = articles;

      buildSectionbar(allArticles);
      buildTagbar(allArticles);

      render();
      renderServices(products);

    } catch (err) {
      console.error(err);
      hintEl.textContent = 'Error cargando.';
      listEl.innerHTML = `<div class="journal-loading">No se pudieron cargar las entradas. Intenta de nuevo.</div>`;
      servicesEl.innerHTML = `<li class="rail-muted">No se pudieron cargar.</li>`;
    }
  })();
});
