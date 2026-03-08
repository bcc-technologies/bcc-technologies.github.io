import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const CONTENT_PATH = path.join(ROOT, 'js', 'products-content.js');
const PAGES = [
  { locale: 'es', file: path.join(ROOT, 'products.html') },
  { locale: 'en', file: path.join(ROOT, 'en', 'products.html') }
];

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

function renderAction(action, { enableHashScroll = false } = {}) {
  const attrs = [
    `class="${buttonClass(action.variant)}"`,
    `href="${escapeHtml(action.href || '#')}"`
  ];

  if (action.scrollTarget) {
    attrs.push(`data-scroll-to="${escapeHtml(action.scrollTarget)}"`);
  } else if (enableHashScroll && action.href && action.href.startsWith('#')) {
    attrs.push(`data-scroll-to="${escapeHtml(action.href.slice(1))}"`);
  }

  return `<a ${attrs.join(' ')}>${escapeHtml(action.label || '')}</a>`;
}

function renderHero(hero) {
  const copy = hero.copy || {};
  const visual = hero.visual || {};
  const panes = visual.panes || [];

  return `
  <section class="hero" data-theme="software">
    <div class="hero-bg" aria-hidden="true">
      <div class="layer base"></div>
      <div class="layer grid"></div>
      <div class="layer rings"></div>
      <div class="layer arcs"></div>
      <div class="layer stripes"></div>
    </div>

    <div class="container">
      <div class="hero-shell hero-grid">
        <div class="hero-copy">
          <p class="eyebrow" id="productsHeroEyebrow">${escapeHtml(copy.eyebrow || '')}</p>
          <h1 id="productsHeroTitle">${escapeHtml(copy.title || '')}</h1>
          <div class="hero-signals" id="productsHeroSignals" aria-label="${escapeHtml(copy.signalsAriaLabel || '')}">
            ${(copy.signals || []).map((signal) => `
            <div class="hero-signal">
              <span class="hero-signal-value">${escapeHtml(signal.value || '')}</span>
              <span class="hero-signal-label">${escapeHtml(signal.label || '')}</span>
            </div>`).join('')}
          </div>
          <div class="hero-cta" id="productsHeroActions">${(copy.actions || []).map((action) => renderAction(action, { enableHashScroll: true })).join('')}</div>
        </div>

        <div class="hero-visual">
          <div class="hero-visual-head">
            <span class="hero-pane-badge" id="productsHeroBadge">${escapeHtml(visual.badge || '')}</span>
            <nav class="hero-tabs" id="productsHeroTabs" role="tablist" aria-label="${escapeHtml(visual.tablistLabel || '')}">
              ${panes.map((pane, index) => `<button role="tab" aria-selected="${index === 0 ? 'true' : 'false'}" aria-controls="pane-${escapeHtml(pane.id || '')}" id="tab-${escapeHtml(pane.id || '')}" data-pane="#pane-${escapeHtml(pane.id || '')}">${escapeHtml(pane.tabLabel || '')}</button>`).join('')}
            </nav>
          </div>
          <div id="productsHeroPanes">
            ${panes.map((pane, index) => `
            <div class="hero-pane${index === 0 ? ' active' : ''}" id="pane-${escapeHtml(pane.id || '')}" role="tabpanel" aria-labelledby="tab-${escapeHtml(pane.id || '')}"${index === 0 ? ' aria-hidden="false"' : ' hidden aria-hidden="true"'}>
              <div class="hero-showcase">
                ${(pane.showcase || []).map((item) => {
                  const attrs = [
                    'class="showcase-item"',
                    `data-media="${escapeHtml(item.media || 'ui')}"`,
                    `href="${escapeHtml(item.href || '#')}"`
                  ];
                  if (item.scrollTarget) attrs.push(`data-scroll-to="${escapeHtml(item.scrollTarget)}"`);
                  return `<a ${attrs.join(' ')}><img src="${escapeHtml(item.image || '')}" alt="${escapeHtml(item.alt || item.title || '')}" loading="lazy" /><strong>${escapeHtml(item.title || '')}</strong><div class="showcase-meta">${escapeHtml(item.meta || '')}</div></a>`;
                }).join('')}
              </div>
              <div class="hero-family-cta" data-family="${escapeHtml(pane.id || 'software')}">
                <div class="hero-family-info">
                  <p class="hero-family-kicker"><span class="${familyIconClass(pane.id)}" aria-hidden="true"></span>${escapeHtml(pane.kicker || '')}</p>
                  <h3 class="hero-family-title">${escapeHtml(pane.title || '')}</h3>
                  <p class="hero-family-text">${escapeHtml(pane.text || '')}</p>
                </div>
                <div class="hero-family-actions">${(pane.actions || []).map((action) => renderAction(action)).join('')}</div>
              </div>
            </div>`).join('')}
          </div>
        </div>
      </div>
    </div>
  </section>`;
}

function renderFilters(filters, locale) {
  const selectedLabel = escapeHtml(filters.selectedLabel || 'selected');
  const emptyLabel = locale === 'en' ? 'All' : 'Todos';
  const toggleLabel = locale === 'en' ? 'Filters' : 'Filtros';

  return `
  <div class="filter-bar" id="catalogo">
    <div class="container">
      <form id="filtersForm" class="filters" role="search">
        <div class="filters-row row-search">
          <div class="group search">
            <label for="filterSearch" class="visually-hidden" id="filterSearchLabel">${escapeHtml(filters.searchLabel || '')}</label>
            <input id="filterSearch" type="search" inputmode="search" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" aria-label="${escapeHtml(filters.searchLabel || '')}" placeholder="${escapeHtml(filters.searchPlaceholder || '')}" />
          </div>
        </div>

        <div class="filters-collapsible" id="filtersControls">
          <div class="filters-row row-controls">
            <div class="group group-single">
              <span class="label" id="familyLabel">${escapeHtml(filters.familyLabel || '')}</span>
              <label for="familySelect" class="visually-hidden" id="familySelectLabel">${escapeHtml(filters.familySrLabel || '')}</label>
              <select id="familySelect" class="single-select" data-group="family">
                ${(filters.familyOptions || []).map((option) => `<option value="${escapeHtml(option.value || '')}">${escapeHtml(option.label || '')}</option>`).join('')}
              </select>
            </div>

            <div class="group group-multi">
              <span class="label" id="methodLabel">${escapeHtml(filters.methodLabel || '')}</span>
              <div class="multi-select" id="methodSelect" data-group="method" data-empty-label="${escapeHtml(emptyLabel)}" data-selected-label="${selectedLabel}">
                <button type="button" class="multi-toggle" aria-expanded="false">
                  <span class="multi-value">${escapeHtml(emptyLabel)}</span>
                </button>
                <div class="multi-menu" role="listbox" aria-multiselectable="true">
                  ${(filters.methodOptions || []).map((option) => `<label class="multi-option"><input type="checkbox" value="${escapeHtml(option.value || '')}">${escapeHtml(option.label || '')}</label>`).join('')}
                </div>
              </div>
            </div>

            <div class="group group-multi">
              <span class="label" id="useLabel">${escapeHtml(filters.useLabel || '')}</span>
              <div class="multi-select" id="useSelect" data-group="use" data-empty-label="${escapeHtml(emptyLabel)}" data-selected-label="${selectedLabel}">
                <button type="button" class="multi-toggle" aria-expanded="false">
                  <span class="multi-value">${escapeHtml(emptyLabel)}</span>
                </button>
                <div class="multi-menu" role="listbox" aria-multiselectable="true">
                  ${(filters.useOptions || []).map((option) => `<label class="multi-option"><input type="checkbox" value="${escapeHtml(option.value || '')}">${escapeHtml(option.label || '')}</label>`).join('')}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="filters-meta">
          <div class="filters-meta-left">
            <button type="button" id="filtersToggle" class="filters-toggle" hidden aria-expanded="false" aria-controls="filtersControls">${toggleLabel}</button>
            <button type="button" id="clearFilters" class="icon-clear" hidden aria-label="${escapeHtml(filters.clearFilters || '')}" title="${escapeHtml(filters.clearFilters || '')}">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M6 6l12 12M18 6L6 18"/>
              </svg>
            </button>
            <div class="active-chips" id="activeChips" aria-live="polite"></div>
          </div>
          <div class="result-meta"><span id="resultCount"></span></div>
        </div>
      </form>
    </div>
  </div>`;
}

function renderProducts(localeContent) {
  return `
  <section class="products section">
    <div class="container">
      <h2 id="productsCatalogTitle">${escapeHtml(localeContent.catalogTitle || '')}</h2>
      <div class="products-grid" id="productsGrid">
        ${(localeContent.products || []).map((product) => `<article class="product-card reveal is-visible${product.featured ? ' product-card-open' : ''}" data-family="${escapeHtml(product.family || '')}" data-method="${escapeHtml((product.methods || []).join(','))}" data-use="${escapeHtml((product.uses || []).join(','))}"${product.anchorId ? ` id="${escapeHtml(product.anchorId)}"` : ''}><img src="${escapeHtml(product.image || '')}" alt="${escapeHtml(product.alt || product.title || '')}" loading="lazy" /><h3>${escapeHtml(product.title || '')}</h3><p>${escapeHtml(product.description || '')}</p><div class="product-tags">${(product.tags || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div><div class="card-cta">${(product.actions || []).map((action) => renderAction(action)).join('')}</div></article>`).join('')}
      </div>
      <noscript>
        <p class="lead">Interactive filters require JavaScript / Los filtros interactivos requieren JavaScript.</p>
      </noscript>
    </div>
  </section>`;
}

function renderCompare(compare) {
  return `
  <section class="compare section" id="comparador">
    <div class="container">
      <h2 id="productsCompareTitle">${escapeHtml(compare.title || '')}</h2>
      <div class="lead" id="productsCompareLead">${escapeHtml(compare.lead || '')}</div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr id="productsCompareHead">${(compare.columns || []).map((column) => `<th>${escapeHtml(column)}</th>`).join('')}</tr>
          </thead>
          <tbody id="productsCompareBody">
            ${(compare.rows || []).map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </section>`;
}

function renderMain(localeContent, locale) {
  return `  <main class="with-header-offset">
  <!-- Generated by scripts/render-products-pages.mjs. -->${renderHero(localeContent.hero)}${renderFilters(localeContent.filters, locale)}${renderProducts(localeContent)}${renderCompare(localeContent.compare)}
  </main>`;
}

async function loadProductsContent() {
  const code = await fs.readFile(CONTENT_PATH, 'utf8');
  const context = { window: {} };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(code, context, { filename: 'products-content.js' });
  return context.window.BCC_PRODUCTS_CONTENT;
}

function renderPageFile(source, localeContent, locale) {
  return source.replace(/  <main class="with-header-offset">[\s\S]*?<\/main>/, renderMain(localeContent, locale));
}

async function main() {
  const checkOnly = process.argv.includes('--check');
  const content = await loadProductsContent();
  let dirty = false;

  for (const page of PAGES) {
    const current = await fs.readFile(page.file, 'utf8');
    const next = renderPageFile(current, content[page.locale], page.locale);

    if (next !== current) {
      dirty = true;
      if (checkOnly) {
        console.error(`${path.relative(ROOT, page.file)} is out of sync.`);
      } else {
        await fs.writeFile(page.file, next, 'utf8');
        console.log(`Rendered ${path.relative(ROOT, page.file)}.`);
      }
    }
  }

  if (checkOnly) {
    if (dirty) process.exit(1);
    console.log('Products pages are in sync.');
    return;
  }

  if (!dirty) {
    console.log('Products pages were already up to date.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
