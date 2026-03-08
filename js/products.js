(() => {
  const locale = (document.documentElement.lang || '').toLowerCase().startsWith('en') ? 'en' : 'es';
  const content = window.BCC_PRODUCTS_CONTENT && window.BCC_PRODUCTS_CONTENT[locale];

  const i18n = locale === 'en'
    ? {
        family: 'Family',
        method: 'Method',
        use: 'Use',
        search: 'Search',
        all: 'All',
        selected: 'selected',
        filters: 'Filters',
        showFilters: 'Filters',
        hideFilters: 'Hide filters',
        removeFilter: 'Remove filter',
        results: (count) => `${count} product${count === 1 ? '' : 's'}`
      }
    : {
        family: 'Familia',
        method: 'Metodo',
        use: 'Uso',
        search: 'Buscar',
        all: 'Todos',
        selected: 'seleccionados',
        filters: 'Filtros',
        showFilters: 'Filtros',
        hideFilters: 'Ocultar filtros',
        removeFilter: 'Quitar filtro',
        results: (count) => `${count} producto${count === 1 ? '' : 's'}`
      };

  const GROUP_LABELS = {
    family: i18n.family,
    method: i18n.method,
    use: i18n.use,
    search: i18n.search
  };

  const ALIASES = {
    family: new Map([
      ['all', 'all'],
      ['todo', 'all'],
      ['todos', 'all'],
      ['software', 'software'],
      ['instrumentacion', 'instrumentacion'],
      ['instrumentation', 'instrumentacion'],
      ['bundles', 'bundles']
    ]),
    method: new Map([
      ['eis', 'EIS'],
      ['dls', 'DLS'],
      ['imaging', 'Imaging'],
      ['data', 'Data'],
      ['datos', 'Data']
    ]),
    use: new Map([
      ['id', 'ID'],
      ['i+d', 'ID'],
      ['r&d', 'ID'],
      ['rd', 'ID'],
      ['qa', 'QA'],
      ['qa/qc', 'QA'],
      ['teaching', 'Teaching'],
      ['docencia', 'Teaching']
    ])
  };

  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
      return;
    }
    callback();
  }

  function normalize(value = '') {
    return String(value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
  }

  function cleanSearch(value = '') {
    const text = String(value).trim();
    return /^[.•·]+$/.test(text) ? '' : text;
  }

  function escapeHtml(value = '') {
    return String(value).replace(/[&<>"']/g, (char) => {
      switch (char) {
        case '&': return '&amp;';
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '"': return '&quot;';
        case "'": return '&#39;';
        default: return char;
      }
    });
  }

  function rafThrottle(callback) {
    let frameId = 0;
    return () => {
      if (frameId) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        callback();
      });
    };
  }

  function canonicalizeValue(group, value) {
    const text = String(value || '').trim();
    if (!text) return '';
    const alias = ALIASES[group] && ALIASES[group].get(normalize(text));
    return alias || text;
  }

  function canonicalizeList(group, values) {
    return Array.from(new Set(
      (values || [])
        .map((value) => canonicalizeValue(group, value))
        .filter(Boolean)
    ));
  }

  function buttonClass(variant) {
    if (variant === 'dark') return 'btn btn-dark';
    if (variant === 'ghost') return 'btn btn-ghost';
    return 'btn';
  }

  function familyIconClass(family) {
    if (family === 'instrumentacion') return 'family-icon family-icon--instrument';
    if (family === 'bundles') return 'family-icon family-icon--bundles';
    return 'family-icon family-icon--software';
  }

  function statusToneClass(tone) {
    if (!tone) return 'product-status';
    return `product-status product-status--${escapeHtml(tone)}`;
  }

  function getDecisionEntries(product) {
    const labels = content.cardLabels || {};
    return [
      { key: 'bestFor', label: labels.bestFor || '', value: product.bestFor || '' },
      { key: 'outputs', label: labels.outputs || '', value: product.outputs || '' },
      { key: 'deployment', label: labels.deployment || '', value: product.deployment || '' },
      { key: 'readiness', label: labels.readiness || '', value: product.readiness || '' }
    ].filter((entry) => entry.label && entry.value);
  }

  function getCompareRow(product) {
    const status = product.status || {};
    return [
      product.title || '',
      (product.methods || []).join(' + '),
      product.outputs || product.description || '',
      product.deployment || '',
      status.label || product.readiness || ''
    ];
  }

  function renderAction(action, options = {}) {
    const attrs = [`class="${buttonClass(action.variant)}"`, `href="${escapeHtml(action.href || '#')}"`];

    if (action.detailId) {
      attrs.push(`data-product-detail="${escapeHtml(action.detailId)}"`);
      attrs.push('aria-haspopup="dialog"');
    }
    if (action.scrollTarget) {
      attrs.push(`data-scroll-to="${escapeHtml(action.scrollTarget)}"`);
    } else if (options.enableHashScroll && action.href && action.href.startsWith('#')) {
      attrs.push(`data-scroll-to="${escapeHtml(action.href.slice(1))}"`);
    }

    return `<a ${attrs.join(' ')}>${escapeHtml(action.label || '')}</a>`;
  }

  function renderHeroOutcomes(pane) {
    const outcomes = pane.outcomes || [];
    if (!outcomes.length) return '';
    return `<div class="hero-family-list">${outcomes.map((item) => `<span class="hero-family-chip">${escapeHtml(item)}</span>`).join('')}</div>`;
  }

  function renderProductDecision(product) {
    return `
      <dl class="product-decision">
        ${getDecisionEntries(product).map((entry) => `
          <div class="product-decision-row product-decision-row--${escapeHtml(entry.key)}">
            <dt>${escapeHtml(entry.label)}</dt>
            <dd>${escapeHtml(entry.value)}</dd>
          </div>
        `).join('')}
      </dl>
    `;
  }

  function renderProductCard(product) {
    const status = product.status || {};
    const compare = content.compare || {};
    const compareLabel = compare.toggleAdd || (locale === 'en' ? 'Compare' : 'Comparar');
    const compareAria = [compareLabel, product.title || ''].filter(Boolean).join(' ');

    return `
      <article class="product-card reveal${product.featured ? ' product-card-open' : ''}" data-family="${escapeHtml(product.family || '')}" data-method="${escapeHtml((product.methods || []).join(','))}" data-use="${escapeHtml((product.uses || []).join(','))}" data-product-id="${escapeHtml(product.id || '')}"${product.anchorId ? ` id="${escapeHtml(product.anchorId)}"` : ''}>
        <img src="${escapeHtml(product.image || '')}" alt="${escapeHtml(product.alt || product.title || '')}" loading="lazy" />
        <div class="product-card-head">
          <div class="product-card-topline">
            ${status.label ? `<span class="${statusToneClass(status.tone)}">${escapeHtml(status.label)}</span>` : ''}
            ${product.id ? `<button type="button" class="compare-toggle" data-compare-toggle="${escapeHtml(product.id)}" aria-pressed="false" aria-label="${escapeHtml(compareAria)}">${escapeHtml(compareLabel)}</button>` : ''}
          </div>
          <h3>${escapeHtml(product.title || '')}</h3>
          <p class="product-summary">${escapeHtml(product.description || '')}</p>
        </div>
        ${renderProductDecision(product)}
        <div class="product-tags">${(product.tags || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>
        <div class="card-cta">${(product.actions || []).map((action) => renderAction(action)).join('')}</div>
      </article>
    `;
  }

  function renderHero() {
    if (!content || !content.hero) return;

    const copy = content.hero.copy || {};
    const visual = content.hero.visual || {};
    const panes = visual.panes || [];

    const eyebrow = document.getElementById('productsHeroEyebrow');
    const title = document.getElementById('productsHeroTitle');
    const signals = document.getElementById('productsHeroSignals');
    const actions = document.getElementById('productsHeroActions');
    const badge = document.getElementById('productsHeroBadge');
    const tabs = document.getElementById('productsHeroTabs');
    const paneWrap = document.getElementById('productsHeroPanes');

    if (eyebrow) eyebrow.textContent = copy.eyebrow || '';
    if (title) title.textContent = copy.title || '';
    if (signals) {
      signals.setAttribute('aria-label', copy.signalsAriaLabel || '');
      signals.innerHTML = (copy.signals || []).map((signal) => `
        <div class="hero-signal">
          <span class="hero-signal-value">${escapeHtml(signal.value || '')}</span>
          <span class="hero-signal-label">${escapeHtml(signal.label || '')}</span>
        </div>
      `).join('');
    }
    if (actions) {
      actions.innerHTML = (copy.actions || []).map((action) => renderAction(action, { enableHashScroll: true })).join('');
    }
    if (badge) badge.textContent = visual.badge || '';
    if (tabs) {
      tabs.setAttribute('aria-label', visual.tablistLabel || '');
      tabs.innerHTML = panes.map((pane, index) => `
        <button role="tab" aria-selected="${index === 0 ? 'true' : 'false'}" aria-controls="pane-${escapeHtml(pane.id || '')}" id="tab-${escapeHtml(pane.id || '')}" data-pane="#pane-${escapeHtml(pane.id || '')}">${escapeHtml(pane.tabLabel || '')}</button>
      `).join('');
    }
    if (paneWrap) {
      paneWrap.innerHTML = panes.map((pane, index) => `
        <div class="hero-pane${index === 0 ? ' active' : ''}" id="pane-${escapeHtml(pane.id || '')}" role="tabpanel" aria-labelledby="tab-${escapeHtml(pane.id || '')}" ${index === 0 ? 'aria-hidden="false"' : 'hidden aria-hidden="true"'}>
          <div class="hero-showcase">
            ${(pane.showcase || []).map((item) => {
              const attrs = [`class="showcase-item"`, `data-media="${escapeHtml(item.media || 'ui')}"`, `href="${escapeHtml(item.href || '#')}"`];
              if (item.scrollTarget) attrs.push(`data-scroll-to="${escapeHtml(item.scrollTarget)}"`);
              return `
                <a ${attrs.join(' ')}>
                  <img src="${escapeHtml(item.image || '')}" alt="${escapeHtml(item.alt || item.title || '')}" loading="lazy" />
                  <strong>${escapeHtml(item.title || '')}</strong>
                  <div class="showcase-meta">${escapeHtml(item.meta || '')}</div>
                </a>
              `;
            }).join('')}
          </div>
          <div class="hero-family-cta" data-family="${escapeHtml(pane.id || 'software')}">
            <div class="hero-family-info">
              <p class="hero-family-kicker"><span class="${familyIconClass(pane.id)}" aria-hidden="true"></span>${escapeHtml(pane.kicker || '')}</p>
              <h3 class="hero-family-title">${escapeHtml(pane.title || '')}</h3>
              <p class="hero-family-text">${escapeHtml(pane.text || '')}</p>
              ${renderHeroOutcomes(pane)}
            </div>
            <div class="hero-family-actions">
              ${(pane.actions || []).map((action) => renderAction(action)).join('')}
            </div>
          </div>
        </div>
      `).join('');
    }
  }

  function populateSelect(select, options) {
    if (!select) return;
    select.innerHTML = (options || []).map((option) => `
      <option value="${escapeHtml(option.value || '')}">${escapeHtml(option.label || '')}</option>
    `).join('');
  }

  function populateMultiSelect(root, options, emptyLabel, selectedLabel) {
    if (!root) return;
    root.dataset.emptyLabel = emptyLabel;
    root.dataset.selectedLabel = selectedLabel;

    const value = root.querySelector('.multi-value');
    const menu = root.querySelector('.multi-menu');

    if (value) value.textContent = emptyLabel;
    if (menu) {
      menu.innerHTML = (options || []).map((option) => `
        <label class="multi-option"><input type="checkbox" value="${escapeHtml(option.value || '')}">${escapeHtml(option.label || '')}</label>
      `).join('');
    }
  }

  function renderFilters() {
    if (!content || !content.filters) return;

    const filters = content.filters;
    const searchLabel = document.getElementById('filterSearchLabel');
    const searchInput = document.getElementById('filterSearch');
    const familyLabel = document.getElementById('familyLabel');
    const familySrLabel = document.getElementById('familySelectLabel');
    const familySelect = document.getElementById('familySelect');
    const methodLabel = document.getElementById('methodLabel');
    const useLabel = document.getElementById('useLabel');
    const clearButton = document.getElementById('clearFilters');

    if (searchLabel) searchLabel.textContent = filters.searchLabel || i18n.search;
    if (searchInput) {
      searchInput.placeholder = filters.searchPlaceholder || '';
      searchInput.setAttribute('aria-label', filters.searchLabel || i18n.search);
    }
    if (familyLabel) familyLabel.textContent = filters.familyLabel || '';
    if (familySrLabel) familySrLabel.textContent = filters.familySrLabel || i18n.family;
    if (methodLabel) methodLabel.textContent = filters.methodLabel || '';
    if (useLabel) useLabel.textContent = filters.useLabel || '';
    if (clearButton) {
      clearButton.setAttribute('aria-label', filters.clearFilters || '');
      clearButton.title = filters.clearFilters || '';
    }

    populateSelect(familySelect, filters.familyOptions || []);
    populateMultiSelect(document.getElementById('methodSelect'), filters.methodOptions || [], i18n.all, filters.selectedLabel || i18n.selected);
    populateMultiSelect(document.getElementById('useSelect'), filters.useOptions || [], i18n.all, filters.selectedLabel || i18n.selected);
  }

  function renderProducts() {
    if (!content) return;

    const title = document.getElementById('productsCatalogTitle');
    const grid = document.getElementById('productsGrid');

    if (title) title.textContent = content.catalogTitle || '';
    if (!grid) return;

    grid.innerHTML = (content.products || []).map((product) => renderProductCard(product)).join('');
  }

  function buildProductDetailMarkup(product) {
    const panel = content.detailPanel || {};
    const status = product.status || {};
    const actions = (product.actions || []).filter((action) => !action.detailId);
    return `
      <div class="product-detail-backdrop" data-product-detail-close></div>
      <section class="product-detail-panel" role="dialog" aria-modal="true" aria-labelledby="productDetailTitle">
        <button type="button" class="product-detail-close" data-product-detail-close aria-label="${escapeHtml(panel.close || 'Close')}">&times;</button>
        <div class="product-detail-header">
          <p class="product-detail-eyebrow">${escapeHtml(panel.badge || '')}</p>
          ${status.label ? `<span class="${statusToneClass(status.tone)}">${escapeHtml(status.label)}</span>` : ''}
          <h2 id="productDetailTitle">${escapeHtml(product.title || '')}</h2>
          <p class="product-detail-summary">${escapeHtml(product.description || '')}</p>
        </div>
        <div class="product-detail-body">
          ${renderProductDecision(product)}
          <div class="product-tags">${(product.tags || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>
        </div>
        <div class="product-detail-actions">${actions.map((action) => renderAction(action)).join('')}</div>
      </section>
    `;
  }

  function ensureProductDetailShell() {
    let shell = document.getElementById('productDetailDialog');
    if (shell) return shell;

    shell = document.createElement('div');
    shell.id = 'productDetailDialog';
    shell.className = 'product-detail-shell';
    shell.hidden = true;
    document.body.appendChild(shell);
    return shell;
  }

  function setupProductDetails() {
    const productsById = new Map((content.products || []).map((product) => [String(product.id || ''), product]));
    if (!productsById.size) return;

    const shell = ensureProductDetailShell();
    let openId = '';

    const closeDetail = () => {
      if (shell.hidden) return;
      shell.hidden = true;
      shell.innerHTML = '';
      openId = '';
      document.body.classList.remove('product-detail-open');
    };

    const openDetail = (productId) => {
      const product = productsById.get(String(productId || ''));
      if (!product) return;
      if (openId === product.id && !shell.hidden) return;
      shell.innerHTML = buildProductDetailMarkup(product);
      shell.hidden = false;
      openId = product.id;
      document.body.classList.add('product-detail-open');

      shell.querySelectorAll('[data-product-detail-close]').forEach((element) => {
        element.addEventListener('click', closeDetail);
      });
    };

    document.querySelectorAll('[data-product-detail]').forEach((trigger) => {
      trigger.addEventListener('click', (event) => {
        event.preventDefault();
        openDetail(trigger.getAttribute('data-product-detail'));
      });
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeDetail();
    });
  }

  function renderCompare() {
    if (!content || !content.compare) return;

    const compare = content.compare;
    const title = document.getElementById('productsCompareTitle');
    const lead = document.getElementById('productsCompareLead');
    const hint = document.getElementById('productsCompareHint');
    const clear = document.getElementById('clearCompare');
    const head = document.getElementById('productsCompareHead');
    const body = document.getElementById('productsCompareBody');

    if (title) title.textContent = compare.title || '';
    if (lead) lead.textContent = compare.lead || compare.autoLead || '';
    if (hint) hint.textContent = compare.instructions || '';
    if (clear) {
      clear.textContent = compare.clearSelection || '';
      clear.hidden = true;
    }
    if (head) {
      head.innerHTML = (compare.columns || []).map((column) => `<th>${escapeHtml(column)}</th>`).join('');
    }
    if (body) {
      body.innerHTML = (compare.rows || []).map((row) => `
        <tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>
      `).join('');
    }
  }

  function renderPage() {
    renderHero();
    renderFilters();
    renderProducts();
    renderCompare();
  }

  function pageNeedsRender() {
    const heroTitle = document.getElementById('productsHeroTitle');
    const grid = document.getElementById('productsGrid');
    return !heroTitle || !heroTitle.textContent.trim() || !grid || !grid.querySelector('.product-card');
  }

  function setupStickyOffset() {
    const header = document.querySelector('header');
    if (!header) return;

    const update = () => {
      const rect = header.getBoundingClientRect();
      const topOffset = Math.max(rect.top, 0);
      const nextOffset = Math.max(56, Math.ceil(rect.height + topOffset));
      document.documentElement.style.setProperty('--nav-h', `${nextOffset}px`);
      document.documentElement.style.setProperty('--header-offset', `${nextOffset}px`);
    };

    const requestUpdate = rafThrottle(update);

    update();
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate, { passive: true });

    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(requestUpdate);
      observer.observe(header);
    }
  }

  function setupHeroTabs() {
    const hero = document.querySelector('.hero');
    const tabList = document.querySelector('.hero-tabs');
    if (!hero || !tabList) return;

    const tabs = Array.from(tabList.querySelectorAll('[role="tab"]'));
    if (!tabs.length) return;

    const setThemeFromTab = (tabId) => {
      const theme = tabId === 'tab-instrumentacion'
        ? 'instrumentacion'
        : tabId === 'tab-bundles'
          ? 'bundles'
          : 'software';
      hero.setAttribute('data-theme', theme);
    };

    const activateTab = (nextTab, shouldFocus) => {
      tabs.forEach((tab) => {
        const isActive = tab === nextTab;
        const selector = tab.getAttribute('data-pane');
        const pane = selector ? document.querySelector(selector) : null;

        tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        tab.tabIndex = isActive ? 0 : -1;

        if (pane) {
          pane.classList.toggle('active', isActive);
          pane.hidden = !isActive;
          pane.setAttribute('aria-hidden', isActive ? 'false' : 'true');
        }
      });

      setThemeFromTab(nextTab.id || 'tab-software');
      if (shouldFocus) nextTab.focus();
    };

    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => activateTab(tab, false));
      tab.addEventListener('keydown', (event) => {
        let nextIndex = null;

        switch (event.key) {
          case 'ArrowRight':
          case 'ArrowDown':
            nextIndex = (index + 1) % tabs.length;
            break;
          case 'ArrowLeft':
          case 'ArrowUp':
            nextIndex = (index - 1 + tabs.length) % tabs.length;
            break;
          case 'Home':
            nextIndex = 0;
            break;
          case 'End':
            nextIndex = tabs.length - 1;
            break;
          default:
            break;
        }

        if (nextIndex === null) return;
        event.preventDefault();
        activateTab(tabs[nextIndex], true);
      });
    });

    const initialTab = tabs.find((tab) => tab.getAttribute('aria-selected') === 'true') || tabs[0];
    activateTab(initialTab, false);
  }

  function setupScrollLinks() {
    document.querySelectorAll('[data-scroll-to]').forEach((element) => {
      element.addEventListener('click', (event) => {
        const id = element.getAttribute('data-scroll-to');
        const target = id ? document.getElementById(id) : null;
        if (!target) return;
        event.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  function setupReveal() {
    const elements = document.querySelectorAll('.reveal');
    if (!elements.length) return;

    if (!('IntersectionObserver' in window)) {
      elements.forEach((element) => element.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.15 });

    elements.forEach((element) => observer.observe(element));
  }

  function setupFilters() {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;

    const query = (selector, root = document) => (root ? root.querySelector(selector) : null);
    const queryAll = (selector, root = document) => (root ? Array.from(root.querySelectorAll(selector)) : []);
    const cards = queryAll('.product-card', grid);
    const productsById = new Map((content.products || []).map((product) => [String(product.id || ''), product]));
    const familySelect = document.getElementById('familySelect');
    const multiSelects = queryAll('.multi-select');
    const searchInput = document.getElementById('filterSearch');
    const clearButton = document.getElementById('clearFilters');
    const chipsWrap = document.getElementById('activeChips');
    const resultCount = document.getElementById('resultCount');
    const filterBar = document.querySelector('.filter-bar');
    const controlsPanel = document.getElementById('filtersControls');
    const toggleButton = document.getElementById('filtersToggle');
    const compareLead = document.getElementById('productsCompareLead');
    const compareHint = document.getElementById('productsCompareHint');
    const compareBody = document.getElementById('productsCompareBody');
    const compareSelection = document.getElementById('productsCompareSelection');
    const clearCompare = document.getElementById('clearCompare');
    const compareToggleButtons = queryAll('[data-compare-toggle]', grid);
    const compare = content.compare || {};
    const compareLimit = Math.max(1, Number(compare.limit) || 3);
    const compareState = { selected: [] };
    const mobileQuery = window.matchMedia ? window.matchMedia('(max-width: 640px)') : null;
    const params = new URLSearchParams(window.location.search);
    const state = {
      family: canonicalizeValue('family', params.get('family') || 'all') || 'all',
      method: canonicalizeList('method', (params.get('method') || '').split(',').filter(Boolean)),
      use: canonicalizeList('use', (params.get('use') || '').split(',').filter(Boolean)),
      search: cleanSearch(params.get('q') || '')
    };

    const optionLabels = {
      family: new Map(Array.from(familySelect ? familySelect.options : []).map((option) => [option.value, option.textContent.trim()])),
      method: new Map(),
      use: new Map()
    };

    ['method', 'use'].forEach((group) => {
      const root = document.getElementById(`${group}Select`);
      queryAll('.multi-option', root).forEach((label) => {
        const input = query('input', label);
        if (!input) return;
        optionLabels[group].set(input.value, label.textContent.trim());
      });
    });

    if (familySelect) {
      const validFamilies = new Set(Array.from(familySelect.options).map((option) => option.value));
      if (!validFamilies.has(state.family)) state.family = 'all';
    }

    state.method = state.method.filter((value) => optionLabels.method.has(value));
    state.use = state.use.filter((value) => optionLabels.use.has(value));

    let mobilePanelOpen = false;

    function activeFilterCount() {
      return (state.family !== 'all' ? 1 : 0) + state.method.length + state.use.length + (state.search ? 1 : 0);
    }

    function isMobileFilters() {
      return Boolean(mobileQuery && mobileQuery.matches);
    }

    function syncMobilePanel() {
      if (!toggleButton || !controlsPanel) return;

      if (!isMobileFilters()) {
        toggleButton.hidden = true;
        toggleButton.setAttribute('aria-expanded', 'false');
        controlsPanel.hidden = false;
        filterBar?.classList.remove('is-mobile-filters-collapsed');
        return;
      }

      toggleButton.hidden = false;
      controlsPanel.hidden = !mobilePanelOpen;
      toggleButton.setAttribute('aria-expanded', mobilePanelOpen ? 'true' : 'false');
      filterBar?.classList.toggle('is-mobile-filters-collapsed', !mobilePanelOpen);

      const activeCount = activeFilterCount();
      const baseLabel = mobilePanelOpen ? i18n.hideFilters : i18n.showFilters;
      toggleButton.textContent = activeCount ? `${baseLabel} (${activeCount})` : baseLabel;
    }

    function labelFor(group, value) {
      return optionLabels[group].get(value) || value;
    }

    function syncURL() {
      const nextParams = new URLSearchParams();
      if (state.family !== 'all') nextParams.set('family', state.family);
      if (state.method.length) nextParams.set('method', state.method.join(','));
      if (state.use.length) nextParams.set('use', state.use.join(','));
      if (state.search) nextParams.set('q', state.search);

      const queryString = nextParams.toString();
      const nextUrl = `${window.location.pathname}${queryString ? `?${queryString}` : ''}${window.location.hash}`;
      window.history.replaceState(null, '', nextUrl);
    }

    function closeAllMultiMenus() {
      multiSelects.forEach((root) => {
        root.classList.remove('is-open');
        const toggle = query('.multi-toggle', root);
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
      });
    }

    function updateMultiLabel(root) {
      const group = root.dataset.group;
      const selected = queryAll('input[type="checkbox"]:checked', root).map((input) => input.value);
      const valueEl = query('.multi-value', root);
      if (!valueEl) return;

      const emptyLabel = root.dataset.emptyLabel || i18n.all;
      const selectedLabel = root.dataset.selectedLabel || i18n.selected;

      if (!selected.length) {
        valueEl.textContent = emptyLabel;
      } else if (selected.length === 1) {
        valueEl.textContent = labelFor(group, selected[0]);
      } else {
        valueEl.textContent = `${selected.length} ${selectedLabel}`;
      }
    }

    function syncMultiFromState(root) {
      const group = root.dataset.group;
      const selected = new Set(Array.isArray(state[group]) ? state[group] : []);
      queryAll('input[type="checkbox"]', root).forEach((input) => {
        input.checked = selected.has(input.value);
      });
      updateMultiLabel(root);
    }

    function addChip(labelText, group, value) {
      if (!chipsWrap) return;

      const chip = document.createElement('span');
      chip.className = 'chip';

      const label = document.createElement('span');
      label.textContent = labelText;

      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-label', `${i18n.removeFilter}: ${labelText}`);
      button.textContent = 'x';
      button.addEventListener('click', () => {
        if (group === 'family') {
          state.family = 'all';
        } else if (group === 'search') {
          state.search = '';
        } else if (Array.isArray(state[group])) {
          state[group] = state[group].filter((entry) => entry !== value);
        }
        apply();
      });

      chip.append(label, button);
      chipsWrap.appendChild(chip);
    }

    function renderChips() {
      if (!chipsWrap) return;
      chipsWrap.replaceChildren();

      if (state.family !== 'all') addChip(`${GROUP_LABELS.family}: ${labelFor('family', state.family)}`, 'family', state.family);
      state.method.forEach((value) => addChip(`${GROUP_LABELS.method}: ${labelFor('method', value)}`, 'method', value));
      state.use.forEach((value) => addChip(`${GROUP_LABELS.use}: ${labelFor('use', value)}`, 'use', value));
      if (state.search) addChip(`${GROUP_LABELS.search}: ${state.search}`, 'search', '');

      if (clearButton) clearButton.hidden = chipsWrap.childElementCount === 0;
      syncMobilePanel();
    }

    function syncUIFromState() {
      if (familySelect) familySelect.value = state.family;
      multiSelects.forEach(syncMultiFromState);
      if (searchInput) searchInput.value = cleanSearch(state.search);
    }

    function getVisibleProducts() {
      return cards
        .filter((card) => !card.hidden)
        .map((card) => productsById.get(String(card.dataset.productId || '')))
        .filter(Boolean);
    }

    function getSelectedProducts() {
      return compareState.selected
        .map((productId) => productsById.get(String(productId || '')))
        .filter(Boolean);
    }

    function syncCompareButtons() {
      const addLabel = compare.toggleAdd || (locale === 'en' ? 'Compare' : 'Comparar');
      const removeLabel = compare.toggleRemove || (locale === 'en' ? 'Remove' : 'Quitar');

      compareToggleButtons.forEach((button) => {
        const productId = String(button.getAttribute('data-compare-toggle') || '');
        const product = productsById.get(productId);
        const isSelected = compareState.selected.includes(productId);
        const atLimit = compareState.selected.length >= compareLimit && !isSelected;
        const label = isSelected ? removeLabel : addLabel;

        button.textContent = label;
        button.disabled = atLimit;
        button.classList.toggle('is-active', isSelected);
        button.classList.toggle('is-disabled', atLimit);
        button.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        button.setAttribute('aria-label', [label, product && product.title ? product.title : ''].filter(Boolean).join(' '));
      });
    }

    function renderCompareSelection(selectedProducts) {
      if (!compareSelection) return;

      compareSelection.replaceChildren();
      selectedProducts.forEach((product) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'compare-chip';
        chip.setAttribute('data-compare-remove', product.id || '');
        chip.setAttribute('aria-label', [compare.toggleRemove || '', product.title || ''].filter(Boolean).join(' '));
        chip.textContent = `${product.title || ''} x`;
        chip.addEventListener('click', () => {
          compareState.selected = compareState.selected.filter((entry) => entry !== product.id);
          updateCompare();
        });
        compareSelection.appendChild(chip);
      });
    }

    function updateCompare() {
      const selectedProducts = getSelectedProducts();
      const activeProducts = selectedProducts.length ? selectedProducts.slice(0, compareLimit) : getVisibleProducts().slice(0, compareLimit);
      const mode = selectedProducts.length ? 'selected' : activeProducts.length ? 'auto' : 'empty';

      if (compareLead) {
        if (mode === 'selected') compareLead.textContent = compare.selectedLead || compare.lead || '';
        else if (mode === 'auto') compareLead.textContent = compare.autoLead || compare.lead || '';
        else compareLead.textContent = compare.emptyLead || compare.lead || '';
      }

      if (compareHint) {
        compareHint.textContent = selectedProducts.length
          ? `${selectedProducts.length}/${compareLimit} ${compare.selectionLabel || i18n.selected}`
          : (compare.instructions || '');
      }

      if (compareBody) {
        if (!activeProducts.length) {
          const colSpan = Math.max((compare.columns || []).length, 1);
          compareBody.innerHTML = `<tr><td class="compare-empty" colspan="${colSpan}">${escapeHtml(compare.emptyState || '')}</td></tr>`;
        } else {
          compareBody.innerHTML = activeProducts.map((product) => {
            const row = getCompareRow(product);
            return `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`;
          }).join('');
        }
      }

      if (clearCompare) clearCompare.hidden = selectedProducts.length === 0;
      renderCompareSelection(selectedProducts);
      syncCompareButtons();
    }

    function apply() {
      const search = normalize(state.search);
      let visible = 0;

      cards.forEach((card) => {
        const family = card.dataset.family || '';
        const methods = String(card.dataset.method || '').split(',').map((value) => value.trim()).filter(Boolean);
        const uses = String(card.dataset.use || '').split(',').map((value) => value.trim()).filter(Boolean);
        const text = normalize(card.textContent || '');

        let matches = true;
        if (state.family !== 'all') matches = matches && family === state.family;
        if (state.method.length) matches = matches && state.method.some((value) => methods.includes(value));
        if (state.use.length) matches = matches && state.use.some((value) => uses.includes(value));
        if (search) matches = matches && text.includes(search);

        card.hidden = !matches;
        if (matches) visible += 1;
      });

      if (resultCount) resultCount.textContent = i18n.results(visible);
      syncUIFromState();
      renderChips();
      updateCompare();
      syncURL();
    }

    familySelect && familySelect.addEventListener('change', () => {
      state.family = canonicalizeValue('family', familySelect.value) || 'all';
      apply();
    });

    multiSelects.forEach((root) => {
      const toggle = query('.multi-toggle', root);
      if (!toggle) return;

      toggle.addEventListener('click', (event) => {
        event.stopPropagation();
        const willOpen = !root.classList.contains('is-open');
        closeAllMultiMenus();
        root.classList.toggle('is-open', willOpen);
        toggle.setAttribute('aria-expanded', String(willOpen));
      });

      queryAll('input[type="checkbox"]', root).forEach((input) => {
        input.addEventListener('change', () => {
          const group = root.dataset.group;
          state[group] = canonicalizeList(group, queryAll('input[type="checkbox"]:checked', root).map((entry) => entry.value));
          updateMultiLabel(root);
          apply();
        });
      });
    });

    compareToggleButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const productId = String(button.getAttribute('data-compare-toggle') || '');
        if (!productId || !productsById.has(productId)) return;
        if (compareState.selected.includes(productId)) {
          compareState.selected = compareState.selected.filter((entry) => entry !== productId);
        } else if (compareState.selected.length < compareLimit) {
          compareState.selected = [...compareState.selected, productId];
        }
        updateCompare();
      });
    });

    document.addEventListener('click', (event) => {
      if (!(event.target instanceof Element)) return;
      if (!event.target.closest('.multi-select')) closeAllMultiMenus();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeAllMultiMenus();
    });

    if (searchInput) {
      let timeoutId = 0;
      searchInput.addEventListener('input', () => {
        window.clearTimeout(timeoutId);
        timeoutId = window.setTimeout(() => {
          state.search = cleanSearch(searchInput.value);
          apply();
        }, 160);
      });
    }

    clearButton && clearButton.addEventListener('click', () => {
      state.family = 'all';
      state.method = [];
      state.use = [];
      state.search = '';
      closeAllMultiMenus();
      apply();
    });

    clearCompare && clearCompare.addEventListener('click', () => {
      compareState.selected = [];
      updateCompare();
    });

    toggleButton && toggleButton.addEventListener('click', () => {
      mobilePanelOpen = !mobilePanelOpen;
      syncMobilePanel();
    });

    if (mobileQuery && typeof mobileQuery.addEventListener === 'function') {
      mobileQuery.addEventListener('change', () => {
        if (!mobileQuery.matches) mobilePanelOpen = false;
        syncMobilePanel();
      });
    }

    syncUIFromState();
    syncMobilePanel();
    apply();
  }

  onReady(() => {
    if (!content) return;
    if (pageNeedsRender()) renderPage();
    setupStickyOffset();
    setupHeroTabs();
    setupScrollLinks();
    setupReveal();
    setupFilters();
    setupProductDetails();
  });
})();
