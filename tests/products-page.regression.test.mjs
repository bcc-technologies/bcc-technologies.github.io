import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';

class TestClassList {
  constructor(element) {
    this.element = element;
    this.tokens = new Set();
  }

  set(value = '') {
    this.tokens = new Set(String(value).split(/\s+/).filter(Boolean));
  }

  add(...tokens) {
    tokens.filter(Boolean).forEach((token) => this.tokens.add(token));
    this.element._syncClassAttribute();
  }

  remove(...tokens) {
    tokens.forEach((token) => this.tokens.delete(token));
    this.element._syncClassAttribute();
  }

  toggle(token, force) {
    if (force === true) {
      this.add(token);
      return true;
    }
    if (force === false) {
      this.remove(token);
      return false;
    }
    if (this.tokens.has(token)) {
      this.tokens.delete(token);
      this.element._syncClassAttribute();
      return false;
    }
    this.tokens.add(token);
    this.element._syncClassAttribute();
    return true;
  }

  contains(token) {
    return this.tokens.has(token);
  }

  toString() {
    return Array.from(this.tokens).join(' ');
  }
}

class TestElement {
  constructor(ownerDocument, tagName, options = {}) {
    this.ownerDocument = ownerDocument;
    this.tagName = String(tagName).toLowerCase();
    this.children = [];
    this.parentElement = null;
    this.attributes = new Map();
    this.dataset = {};
    this.eventListeners = new Map();
    this.classList = new TestClassList(this);
    this.style = {};
    this.hidden = false;
    this.value = '';
    this.checked = false;
    this.type = '';
    this.tabIndex = 0;
    this.options = [];
    this._textContent = '';
    this._innerHTML = '';
    this._id = '';
    this._className = '';

    if (options.id) this.id = options.id;
    if (options.className) this.className = options.className;
    if (options.textContent) this.textContent = options.textContent;
  }

  get id() {
    return this._id;
  }

  set id(value) {
    this._id = String(value);
    this.attributes.set('id', this._id);
    this.ownerDocument.registerElement(this);
  }

  get className() {
    return this.classList.toString();
  }

  set className(value) {
    this.classList.set(value);
    this._syncClassAttribute();
  }

  _syncClassAttribute() {
    this._className = this.classList.toString();
    if (this._className) {
      this.attributes.set('class', this._className);
    } else {
      this.attributes.delete('class');
    }
  }

  setAttribute(name, value) {
    const key = String(name);
    const nextValue = String(value);
    this.attributes.set(key, nextValue);

    if (key === 'id') {
      this._id = nextValue;
      this.ownerDocument.registerElement(this);
    } else if (key === 'class') {
      this.classList.set(nextValue);
      this._syncClassAttribute();
    } else if (key === 'value') {
      this.value = nextValue;
    } else if (key === 'type') {
      this.type = nextValue;
    } else if (key.startsWith('data-')) {
      const dataKey = key
        .slice(5)
        .replace(/-([a-z])/g, (_, char) => char.toUpperCase());
      this.dataset[dataKey] = nextValue;
    }
  }

  getAttribute(name) {
    const key = String(name);
    return this.attributes.has(key) ? this.attributes.get(key) : null;
  }

  append(...nodes) {
    nodes.forEach((node) => this.appendChild(node));
  }

  appendChild(node) {
    if (!(node instanceof TestElement)) return node;
    node.parentElement = this;
    this.children.push(node);
    if (node.id) this.ownerDocument.registerElement(node);
    return node;
  }

  replaceChildren(...nodes) {
    this.children = [];
    nodes.forEach((node) => this.appendChild(node));
  }

  addEventListener(type, handler) {
    const list = this.eventListeners.get(type) || [];
    list.push(handler);
    this.eventListeners.set(type, list);
  }

  dispatchEvent(event) {
    const payload = event && typeof event === 'object' ? event : { type: String(event) };
    const type = payload.type;
    const handlers = this.eventListeners.get(type) || [];
    handlers.forEach((handler) => {
      handler({
        ...payload,
        target: this,
        currentTarget: this,
        preventDefault: payload.preventDefault || (() => {}),
        stopPropagation: payload.stopPropagation || (() => {})
      });
    });
    return true;
  }

  click() {
    this.dispatchEvent({ type: 'click' });
  }

  focus() {
    this.ownerDocument.activeElement = this;
  }

  scrollIntoView() {}

  getBoundingClientRect() {
    if (this.tagName === 'header') {
      return { top: 0, height: 88 };
    }
    return { top: 0, height: 0 };
  }

  get textContent() {
    const own = this._textContent || '';
    if (this.children.length) {
      return own + this.children.map((child) => child.textContent).join('');
    }
    return own;
  }

  set textContent(value) {
    this._textContent = String(value);
    this._innerHTML = this._textContent;
    this.children = [];
  }

  get innerHTML() {
    return this._innerHTML;
  }

  get childElementCount() {
    return this.children.length;
  }

  set innerHTML(value) {
    this._innerHTML = String(value);
    this.children = [];
    this.options = [];

    if (this.tagName === 'select') {
      this._parseOptions(this._innerHTML);
      return;
    }

    if (this.id === 'productsGrid') {
      this._parseProductCards(this._innerHTML);
      return;
    }

    if (this.classList.contains('multi-menu')) {
      this._parseMultiOptions(this._innerHTML);
      return;
    }

    if (this.id === 'productsHeroTabs') {
      this._parseHeroTabs(this._innerHTML);
      return;
    }

    if (this.id === 'productsHeroPanes') {
      this._parseHeroPanes(this._innerHTML);
    }
  }

  _parseOptions(html) {
    const optionPattern = /<option value="([^"]*)">([\s\S]*?)<\/option>/g;
    for (const match of html.matchAll(optionPattern)) {
      const option = this.ownerDocument.createElement('option');
      option.setAttribute('value', decode(match[1]));
      option.textContent = decode(stripTags(match[2]).trim());
      this.options.push(option);
      this.appendChild(option);
    }
  }

  _parseMultiOptions(html) {
    const optionPattern = /<label class="multi-option"><input type="checkbox" value="([^"]*)">([\s\S]*?)<\/label>/g;
    for (const match of html.matchAll(optionPattern)) {
      const label = this.ownerDocument.createElement('label');
      label.className = 'multi-option';
      label.textContent = decode(stripTags(match[2]).trim());

      const input = this.ownerDocument.createElement('input');
      input.setAttribute('type', 'checkbox');
      input.setAttribute('value', decode(match[1]));
      input.type = 'checkbox';
      input.value = decode(match[1]);

      label.appendChild(input);
      this.appendChild(label);
    }
  }

  _parseHeroTabs(html) {
    const tabPattern = /<button role="tab" aria-selected="([^"]*)" aria-controls="([^"]*)" id="([^"]*)" data-pane="([^"]*)">([\s\S]*?)<\/button>/g;
    for (const match of html.matchAll(tabPattern)) {
      const button = this.ownerDocument.createElement('button');
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', decode(match[1]));
      button.setAttribute('aria-controls', decode(match[2]));
      button.id = decode(match[3]);
      button.setAttribute('data-pane', decode(match[4]));
      button.textContent = decode(stripTags(match[5]).trim());
      this.appendChild(button);
    }
  }

  _parseHeroPanes(html) {
    const panePattern = /<div class="([^"]*hero-pane[^"]*)" id="([^"]*)" role="tabpanel" aria-labelledby="([^"]*)"([^>]*)>/g;
    for (const match of html.matchAll(panePattern)) {
      const pane = this.ownerDocument.createElement('div');
      pane.className = decode(match[1]);
      pane.id = decode(match[2]);
      pane.setAttribute('role', 'tabpanel');
      pane.setAttribute('aria-labelledby', decode(match[3]));
      if (match[4].includes('hidden')) pane.hidden = true;
      this.appendChild(pane);
    }
  }

  _parseProductCards(html) {
    const articlePattern = /<article class="([^"]*)" data-family="([^"]*)" data-method="([^"]*)" data-use="([^"]*)"([^>]*)>([\s\S]*?)<\/article>/g;
    for (const match of html.matchAll(articlePattern)) {
      const card = this.ownerDocument.createElement('article');
      card.className = decode(match[1]);
      card.dataset.family = decode(match[2]);
      card.dataset.method = decode(match[3]);
      card.dataset.use = decode(match[4]);

      const productIdMatch = match[5].match(/\sdata-product-id="([^"]*)"/);
      if (productIdMatch) card.setAttribute('data-product-id', decode(productIdMatch[1]));

      const idMatch = match[5].match(/\sid="([^"]*)"/);
      if (idMatch) card.id = decode(idMatch[1]);

      card._textContent = decode(stripTags(match[6]).replace(/\s+/g, ' ').trim());

      const comparePattern = /<button type="button" class="compare-toggle" data-compare-toggle="([^"]*)"([^>]*)>([\s\S]*?)<\/button>/g;
      for (const buttonMatch of match[6].matchAll(comparePattern)) {
        const button = this.ownerDocument.createElement('button');
        button.className = 'compare-toggle';
        button.setAttribute('type', 'button');
        button.setAttribute('data-compare-toggle', decode(buttonMatch[1]));
        const pressedMatch = buttonMatch[2].match(/aria-pressed="([^"]*)"/);
        if (pressedMatch) button.setAttribute('aria-pressed', decode(pressedMatch[1]));
        button.textContent = decode(stripTags(buttonMatch[3]).trim());
        card.appendChild(button);
      }

      this.appendChild(card);
    }
  }

  matches(selector) {
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    if (selector.startsWith('.')) return this.classList.contains(selector.slice(1));
    if (selector === 'header') return this.tagName === 'header';
    if (selector === 'input') return this.tagName === 'input';
    if (selector === '[role="tab"]') return this.getAttribute('role') === 'tab';
    if (selector === 'input[type="checkbox"]') return this.tagName === 'input' && this.type === 'checkbox';
    if (selector === 'input[type="checkbox"]:checked') return this.tagName === 'input' && this.type === 'checkbox' && this.checked;

    const dataSelector = selector.match(/^\[data-([a-z-]+)(?:=\"([^\"]*)\")?\]$/);
    if (dataSelector) {
      const attrName = 'data-' + dataSelector[1];
      if (!this.attributes.has(attrName)) return false;
      if (typeof dataSelector[2] === 'string') return this.getAttribute(attrName) === dataSelector[2];
      return true;
    }

    return this.tagName === selector.toLowerCase();
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const results = [];
    walkTree(this, (node) => {
      if (node !== this && node.matches(selector)) results.push(node);
    });
    return results;
  }

  closest(selector) {
    let current = this;
    while (current) {
      if (current.matches(selector)) return current;
      current = current.parentElement;
    }
    return null;
  }
}

class TestDocument {
  constructor(lang) {
    this.readyState = 'complete';
    this.activeElement = null;
    this.listeners = new Map();
    this.elementsById = new Map();
    this.documentElement = {
      lang,
      dataset: {},
      style: {
        values: new Map(),
        setProperty(name, value) {
          this.values.set(name, value);
        }
      }
    };

    this.body = new TestElement(this, 'body');
    this.rootNodes = [this.body];
  }

  registerElement(element) {
    if (element.id) this.elementsById.set(element.id, element);
  }

  createElement(tagName) {
    return new TestElement(this, tagName);
  }

  getElementById(id) {
    return this.elementsById.get(id) || null;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const results = [];
    this.rootNodes.forEach((root) => {
      if (root.matches(selector)) results.push(root);
      results.push(...root.querySelectorAll(selector));
    });
    return results;
  }

  addEventListener(type, handler) {
    const list = this.listeners.get(type) || [];
    list.push(handler);
    this.listeners.set(type, list);
  }
}

function walkTree(root, visit) {
  root.children.forEach((child) => {
    visit(child);
    walkTree(child, visit);
  });
}

function stripTags(value) {
  return String(value).replace(/<[^>]+>/g, ' ');
}

function decode(value) {
  return String(value)
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function createMultiSelect(document, id, group) {
  const root = document.createElement('div');
  root.id = id;
  root.className = 'multi-select';
  root.dataset.group = group;

  const toggle = document.createElement('button');
  toggle.className = 'multi-toggle';
  toggle.setAttribute('aria-expanded', 'false');

  const value = document.createElement('span');
  value.className = 'multi-value';
  toggle.appendChild(value);

  const menu = document.createElement('div');
  menu.className = 'multi-menu';

  root.append(toggle, menu);
  return root;
}

function buildProductsDocument(lang) {
  const document = new TestDocument(lang);

  const header = document.createElement('header');
  const hero = document.createElement('section');
  hero.className = 'hero';

  const productsHeroEyebrow = document.createElement('p');
  productsHeroEyebrow.id = 'productsHeroEyebrow';
  const productsHeroTitle = document.createElement('h1');
  productsHeroTitle.id = 'productsHeroTitle';
  const productsHeroSignals = document.createElement('div');
  productsHeroSignals.id = 'productsHeroSignals';
  const productsHeroActions = document.createElement('div');
  productsHeroActions.id = 'productsHeroActions';
  const productsHeroBadge = document.createElement('span');
  productsHeroBadge.id = 'productsHeroBadge';
  const productsHeroTabs = document.createElement('nav');
  productsHeroTabs.id = 'productsHeroTabs';
  productsHeroTabs.className = 'hero-tabs';
  const productsHeroPanes = document.createElement('div');
  productsHeroPanes.id = 'productsHeroPanes';

  hero.append(
    productsHeroEyebrow,
    productsHeroTitle,
    productsHeroSignals,
    productsHeroActions,
    productsHeroBadge,
    productsHeroTabs,
    productsHeroPanes
  );

  const filterSearch = document.createElement('input');
  filterSearch.id = 'filterSearch';
  const filterSearchLabel = document.createElement('label');
  filterSearchLabel.id = 'filterSearchLabel';

  const familyLabel = document.createElement('span');
  familyLabel.id = 'familyLabel';
  const familySelectLabel = document.createElement('label');
  familySelectLabel.id = 'familySelectLabel';
  const familySelect = document.createElement('select');
  familySelect.id = 'familySelect';

  const methodLabel = document.createElement('span');
  methodLabel.id = 'methodLabel';
  const useLabel = document.createElement('span');
  useLabel.id = 'useLabel';
  const methodSelect = createMultiSelect(document, 'methodSelect', 'method');
  const useSelect = createMultiSelect(document, 'useSelect', 'use');

  const clearFilters = document.createElement('button');
  clearFilters.id = 'clearFilters';
  clearFilters.hidden = true;
  const activeChips = document.createElement('div');
  activeChips.id = 'activeChips';
  const resultCount = document.createElement('span');
  resultCount.id = 'resultCount';

  const productsCatalogTitle = document.createElement('h2');
  productsCatalogTitle.id = 'productsCatalogTitle';
  const productsGrid = document.createElement('div');
  productsGrid.id = 'productsGrid';

  const productsCompareTitle = document.createElement('h2');
  productsCompareTitle.id = 'productsCompareTitle';
  const productsCompareLead = document.createElement('div');
  productsCompareLead.id = 'productsCompareLead';
  const productsCompareHint = document.createElement('p');
  productsCompareHint.id = 'productsCompareHint';
  const clearCompare = document.createElement('button');
  clearCompare.id = 'clearCompare';
  clearCompare.hidden = true;
  const productsCompareSelection = document.createElement('div');
  productsCompareSelection.id = 'productsCompareSelection';
  const productsCompareHead = document.createElement('tr');
  productsCompareHead.id = 'productsCompareHead';
  const productsCompareBody = document.createElement('tbody');
  productsCompareBody.id = 'productsCompareBody';

  document.body.append(
    header,
    hero,
    filterSearchLabel,
    filterSearch,
    familyLabel,
    familySelectLabel,
    familySelect,
    methodLabel,
    methodSelect,
    useLabel,
    useSelect,
    clearFilters,
    activeChips,
    resultCount,
    productsCatalogTitle,
    productsGrid,
    productsCompareTitle,
    productsCompareLead,
    productsCompareHint,
    clearCompare,
    productsCompareSelection,
    productsCompareHead,
    productsCompareBody
  );

  return document;
}

function loadProductsPage({ lang = 'es', search = '' } = {}) {
  const document = buildProductsDocument(lang);
  const historyState = { lastUrl: '' };
  const windowStub = {
    BCC_PRODUCTS_CONTENT: undefined,
    location: { pathname: lang === 'en' ? '/en/products.html' : '/products.html', search, hash: '' },
    history: {
      replaceState: (_state, _title, url) => {
        historyState.lastUrl = url;
      }
    },
    addEventListener: () => {},
    requestAnimationFrame: (callback) => {
      callback();
      return 1;
    },
    setTimeout,
    clearTimeout
  };

  const context = {
    window: windowStub,
    document,
    console,
    URL,
    URLSearchParams,
    Element: TestElement,
    Math,
    Number,
    String,
    Array,
    Object,
    Set,
    Map,
    RegExp,
    parseInt,
    parseFloat,
    isNaN,
    setTimeout,
    clearTimeout
  };

  context.globalThis = context;
  vm.createContext(context);

  const contentCode = fs.readFileSync(path.resolve(process.cwd(), 'js/products-content.js'), 'utf8');
  const productsCode = fs.readFileSync(path.resolve(process.cwd(), 'js/products.js'), 'utf8');

  vm.runInContext(contentCode, context, { filename: 'products-content.js' });
  windowStub.BCC_PRODUCTS_CONTENT = context.window.BCC_PRODUCTS_CONTENT;
  vm.runInContext(productsCode, context, { filename: 'products.js' });

  return { document, window: windowStub, historyState };
}

test('products page renders shared Spanish content and initial count', () => {
  const { document } = loadProductsPage({ lang: 'es' });

  assert.equal(document.getElementById('productsHeroTitle').textContent, 'Empieza por lo que necesitas lograr');
  assert.equal(document.getElementById('productsCatalogTitle').textContent, 'Tecnologia disponible');
  assert.equal(document.getElementById('productsGrid').querySelectorAll('.product-card').length, 8);
  assert.equal(document.getElementById('resultCount').textContent, '8 productos');
  assert.match(document.getElementById('productsCompareHead').innerHTML, /<th>Producto<\/th>/);
  assert.equal(document.getElementById('productsCompareHint').textContent, 'Selecciona hasta 3 productos o deja que el comparador use los visibles.');
  assert.match(document.getElementById('productsGrid').innerHTML, /data-product-detail="map-nano"/);
  assert.match(document.getElementById('productsGrid').innerHTML, /data-compare-toggle="map-nano"/);
  assert.doesNotMatch(document.getElementById('productsGrid').innerHTML, /href="#"/);
});

test('legacy family alias normalizes to current value and filters English catalog', () => {
  const { document, historyState } = loadProductsPage({ lang: 'en', search: '?family=instrumentation' });

  const visibleCards = document
    .getElementById('productsGrid')
    .querySelectorAll('.product-card')
    .filter((card) => !card.hidden);

  assert.equal(document.getElementById('familySelect').value, 'instrumentacion');
  assert.equal(visibleCards.length, 3);
  assert.equal(document.getElementById('resultCount').textContent, '3 products');
  assert.match(historyState.lastUrl, /\?family=instrumentacion$/);
});

test('legacy method alias maps to Data and narrows results', () => {
  const { document } = loadProductsPage({ lang: 'en', search: '?method=Datos' });

  const visibleCards = document
    .getElementById('productsGrid')
    .querySelectorAll('.product-card')
    .filter((card) => !card.hidden);

  assert.equal(document.getElementById('methodSelect').querySelector('.multi-value').textContent, 'Data');
  assert.equal(visibleCards.length, 1);
  assert.equal(visibleCards[0].dataset.family, 'software');
  assert.equal(document.getElementById('resultCount').textContent, '1 product');
});


test('compare table follows visible products when filters narrow the catalog', () => {
  const { document } = loadProductsPage({ lang: 'en', search: '?family=bundles' });

  const compareBody = document.getElementById('productsCompareBody').innerHTML;
  assert.match(compareBody, /EIS \+ MAP-Bio/);
  assert.match(compareBody, /EIS \+ EIS-Toolkit/);
  assert.doesNotMatch(compareBody, /AquaSpecter/);
});

test('compare selection pins chosen products and exposes clear state', () => {
  const { document } = loadProductsPage({ lang: 'en' });

  document.querySelector('[data-compare-toggle="map-nano"]').click();
  document.querySelector('[data-compare-toggle="bundle-toolkit"]').click();

  const compareBody = document.getElementById('productsCompareBody').innerHTML;
  assert.match(compareBody, /MAP-Nano/);
  assert.match(compareBody, /EIS \+ EIS-Toolkit/);
  assert.equal(document.getElementById('productsCompareLead').textContent, 'Comparing your current selection.');
  assert.equal(document.getElementById('productsCompareHint').textContent, '2/3 selected');
  assert.equal(document.getElementById('clearCompare').hidden, false);
  assert.match(document.getElementById('productsCompareSelection').textContent, /MAP-Nano x/);
  assert.match(document.getElementById('productsCompareSelection').textContent, /EIS \+ EIS-Toolkit x/);
});

test('products page generator stays in sync with committed HTML', () => {
  const result = spawnSync(process.execPath, ['scripts/render-products-pages.mjs', '--check'], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});
