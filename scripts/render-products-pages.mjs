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

function statusToneClass(tone) {
  if (!tone) return 'product-status';
  return `product-status product-status--${escapeHtml(tone)}`;
}

function getDecisionEntries(localeContent, product) {
  const labels = localeContent.cardLabels || {};
  return [
    { key: 'bestFor', label: labels.bestFor || '', value: product.bestFor || '' },
    { key: 'outputs', label: labels.outputs || '', value: product.outputs || '' },
    { key: 'deployment', label: labels.deployment || '', value: product.deployment || '' },
    { key: 'readiness', label: labels.readiness || '', value: product.readiness || '' }
  ].filter((entry) => entry.label && entry.value);
}

function renderAction(action, { enableHashScroll = false } = {}) {
  const attrs = [
    `class="${buttonClass(action.variant)}"`,
    `href="${escapeHtml(action.href || '#')}"`
  ];

  if (action.detailId) {
    attrs.push(`data-product-detail="${escapeHtml(action.detailId)}"`);
    attrs.push('aria-haspopup="dialog"');
  }
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
        <div class="hero-visual">
          <div class="hero-visual-head">
            <div class="hero-context">
              <p class="eyebrow" id="productsHeroEyebrow">${escapeHtml(copy.eyebrow || '')}</p>
              <div class="hero-intro">
                <h1 id="productsHeroTitle">${escapeHtml(copy.title || '')}</h1>
                <p id="productsHeroLead" class="hero-lead"${copy.lead ? '' : ' hidden'}>${escapeHtml(copy.lead || '')}</p>
              </div>
              <nav class="hero-tabs" id="productsHeroTabs" role="tablist" aria-label="${escapeHtml(visual.tablistLabel || '')}">
                ${panes.map((pane, index) => `<button role="tab" aria-selected="${index === 0 ? 'true' : 'false'}" aria-controls="pane-${escapeHtml(pane.id || '')}" id="tab-${escapeHtml(pane.id || '')}" data-pane="#pane-${escapeHtml(pane.id || '')}">${escapeHtml(pane.tabLabel || '')}</button>`).join('')}
              </nav>
            </div>
          </div>
          <div id="productsHeroPanes">
            ${panes.map((pane, index) => `
            <div class="hero-pane${index === 0 ? ' active' : ''}" id="pane-${escapeHtml(pane.id || '')}" role="tabpanel" aria-labelledby="tab-${escapeHtml(pane.id || '')}"${index === 0 ? ' aria-hidden="false"' : ' hidden aria-hidden="true"'}>
              <div class="hero-showcase">
                ${(pane.showcase || []).map((item) => {
                  const metaAttrs = [
                    'class="showcase-meta"',
                    `href="${escapeHtml(item.href || '#')}"`
                  ];
                  if (item.scrollTarget) metaAttrs.push(`data-scroll-to="${escapeHtml(item.scrollTarget)}"`);
                  const imageMarkup = `<img src="${escapeHtml(item.image || '')}" alt="${escapeHtml(item.alt || item.title || '')}" loading="lazy" />`;
                  const topicsMarkup = (item.topics || []).length
                    ? `<ul class="showcase-topics">${(item.topics || []).map((topic) => `<li class="showcase-topic">${escapeHtml(topic)}</li>`).join('')}</ul>`
                    : '';
                  const mediaMarkup = item.media === 'hero'
                    ? `<div class="showcase-stage" data-layout="${escapeHtml(item.topicsLayout || 'default')}">${imageMarkup}${topicsMarkup}</div>`
                    : imageMarkup;
                  return `<article class="showcase-item" data-media="${escapeHtml(item.media || 'ui')}">${mediaMarkup}<strong>${escapeHtml(item.title || '')}</strong><a ${metaAttrs.join(' ')}>${escapeHtml(item.meta || '')}</a></article>`;
                }).join('')}
              </div>
              <div class="hero-family-cta" data-family="${escapeHtml(pane.id || 'software')}">
                <div class="hero-family-info">
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
          <button type="button" id="filtersToggle" class="filters-toggle" aria-expanded="false" aria-controls="filtersControls"><span class="filters-toggle-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M4 7h16M7 12h10M10 17h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></span><span class="filters-toggle-label">${toggleLabel}</span><span class="filters-toggle-count" aria-hidden="true" hidden></span></button>
        </div>

        <div class="filters-collapsible" id="filtersControls" hidden>
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

        <div class="filters-meta" id="filtersMeta" hidden>
          <div class="filters-meta-left">
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

function renderProductDecision(localeContent, product, options = {}) {
  const entries = getDecisionEntries(localeContent, product);
  const visibleEntries = options.compact
    ? entries.filter((entry) => entry.key === 'bestFor' || entry.key === 'outputs')
    : entries;
  if (!visibleEntries.length) return '';
  return `<dl class="product-decision${options.compact ? ' product-decision--compact' : ''}">${visibleEntries.map((entry) => `<div class="product-decision-row product-decision-row--${escapeHtml(entry.key)}"><dt>${escapeHtml(entry.label)}</dt><dd>${escapeHtml(entry.value)}</dd></div>`).join('')}</dl>`;
}

function renderProductCard(localeContent, product) {
  const status = product.status || {};
  const compare = localeContent.compare || {};
  const compareLabel = compare.toggleAdd || 'Compare';
  const compareAria = [compareLabel, product.title || ''].filter(Boolean).join(' ');
  return `<article class="product-card reveal is-visible${product.featured ? ' product-card-open' : ''}" data-family="${escapeHtml(product.family || '')}" data-method="${escapeHtml((product.methods || []).join(','))}" data-use="${escapeHtml((product.uses || []).join(','))}" data-product-id="${escapeHtml(product.id || '')}"${product.anchorId ? ` id="${escapeHtml(product.anchorId)}"` : ''}><img src="${escapeHtml(product.image || '')}" alt="${escapeHtml(product.alt || product.title || '')}" loading="lazy" /><div class="product-card-head"><div class="product-card-topline">${status.label ? `<span class="${statusToneClass(status.tone)}">${escapeHtml(status.label)}</span>` : ''}${product.id ? `<button type="button" class="compare-toggle" data-compare-toggle="${escapeHtml(product.id)}" aria-pressed="false" data-state="idle" aria-label="${escapeHtml(compareAria)}">${escapeHtml(compareLabel)}</button>` : ''}</div><h3>${escapeHtml(product.title || '')}</h3><p class="product-summary">${escapeHtml(product.description || '')}</p></div>${renderProductDecision(localeContent, product, { compact: true })}<div class="product-tags">${(product.tags || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div><div class="card-cta">${(product.actions || []).map((action) => renderAction(action)).join('')}</div></article>`;
}

function renderProducts(localeContent) {
  return `
  <section class="products section">
    <div class="container">
      <h2 id="productsCatalogTitle">${escapeHtml(localeContent.catalogTitle || '')}</h2>
      <div class="products-grid" id="productsGrid">
        ${(localeContent.products || []).map((product) => renderProductCard(localeContent, product)).join('')}
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
      <div class="compare-shell">
        <div class="compare-overview">
          <p class="compare-eyebrow" id="productsCompareEyebrow">${escapeHtml(compare.autoEyebrow || '')}</p>
          <h3 class="compare-mode-title" id="productsCompareModeTitle">${escapeHtml(compare.autoTitle || '')}</h3>
          <div class="lead" id="productsCompareLead">${escapeHtml(compare.lead || compare.autoLead || '')}</div>
        </div>
        <div class="compare-toolbar">
          <p class="compare-hint" id="productsCompareHint">${escapeHtml(compare.instructions || '')}</p>
          <div class="compare-actions">
            <span class="compare-count" id="productsCompareCount">${escapeHtml(compare.autoCount || '')}</span>
            <button type="button" id="clearCompare" class="compare-clear" hidden>${escapeHtml(compare.clearSelection || '')}</button>
          </div>
        </div>
        <div class="compare-selection" id="productsCompareSelection" aria-live="polite"></div>
      </div>
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

