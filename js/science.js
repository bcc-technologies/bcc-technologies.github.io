(() => {
  const isEn = (document.documentElement.lang || '').toLowerCase().startsWith('en');
  const pageLang = isEn ? 'en' : 'es';

  const GROUP_ORDER = ['physics', 'math', 'cs', 'q-bio', 'stat', 'q-fin', 'eess', 'econ'];
  const HERO_DEFAULT_GROUPS = ['physics', 'math', 'cs', 'q-bio'];
  const GROUP_LABELS = isEn ? {
    physics: 'Physics',
    math: 'Mathematics',
    cs: 'Computer Science',
    'q-bio': 'Quantitative Biology',
    stat: 'Statistics',
    'q-fin': 'Quantitative Finance',
    eess: 'Electrical Engineering & Systems Science',
    econ: 'Economics'
  } : {
    physics: 'Fisica',
    math: 'Matematicas',
    cs: 'Ciencias de la computacion',
    'q-bio': 'Biologia cuantitativa',
    stat: 'Estadistica',
    'q-fin': 'Finanzas cuantitativas',
    eess: 'Ing. electrica y sistemas',
    econ: 'Economia'
  };

  const GROUP_COLORS = {
    physics: '#2f7dd1',
    math: '#16a085',
    cs: '#f39c12',
    'q-bio': '#e74c3c',
    stat: '#7c5cfa',
    'q-fin': '#0ea5a6',
    eess: '#64748b',
    econ: '#10b981'
  };

  const i18n = isEn ? {
    updated: 'Last updated:',
    all: 'All',
    arxivError: 'Could not load ArXiv cache.',
    journalError: 'Could not load Blog.',
    apodError: 'Could not load NASA APOD.',
    viewVideo: 'View video',
    journalEmpty: 'No entries yet.',
    arxivEmpty: 'No entries for this filter.',
    arxivKeywordPlaceholder: 'Search keywords, title, author, or category',
    arxivClear: 'Clear',
    arxivAreaLabel: 'Area',
    arxivPeriodLabel: 'Period',
    arxivPeriodAll: 'All periods',
    arxivViewPapers: 'Papers',
    arxivViewKeywords: 'Top keywords',
    arxivKeywordsTitle: 'Most used keywords',
    arxivKeywordsEmpty: 'No keywords for this selection.',
    arxivGroupsLabel: 'Keyword groups',
    arxivGroupPick: 'Pick group',
    arxivGroupAdd: 'Use',
    arxivGroupClear: 'Clear',
    arxivGroupNamePlaceholder: 'Group name',
    arxivGroupTermsPlaceholder: 'Keywords separated by comma',
    arxivGroupSave: 'Save group',
    arxivGroupDelete: 'Delete',
    arxivGroupSaveCurrent: 'Save current search',
    arxivGroupClose: 'Close',
    arxivGroupAutoName: 'Keyword group',
    arxivNoActiveGroups: 'No active groups',
    arxivTopFiltersLabel: 'Top filters',
    arxivTopModeLabel: 'Type',
    arxivTopModeAll: 'All',
    arxivTopModePhrases: 'Phrases',
    arxivTopModeTerms: 'Terms',
    arxivTopModeAcronyms: 'Acronyms',
    arxivTopMinCountLabel: 'Min count',
    arxivTopSortLabel: 'Sort',
    arxivTopSortCount: 'Frequency',
    arxivTopSortAlpha: 'A-Z',
    arxivTopExcludeLabel: 'Custom exclude',
    arxivTopExcludePlaceholder: 'word1, word2',
    rangeLabel: (range) => `Last ${range} months`,
    totalLabel: (range) => `Total papers (${range}m)`,
    heatmapLow: 'Low',
    heatmapHigh: 'High',
    heatmapValue: 'Papers',
    growthEmpty: '--'
  } : {
    updated: 'Ultima actualizacion:',
    all: 'Todos',
    arxivError: 'No se pudo cargar ArXiv.',
    journalError: 'No se pudo cargar Blog.',
    apodError: 'No se pudo cargar NASA APOD.',
    viewVideo: 'Ver video',
    journalEmpty: 'No hay entradas aun.',
    arxivEmpty: 'No hay entradas con ese filtro.',
    arxivKeywordPlaceholder: 'Buscar keywords, titulo, autor o categoria',
    arxivClear: 'Limpiar',
    arxivAreaLabel: 'Area',
    arxivPeriodLabel: 'Periodo',
    arxivPeriodAll: 'Todo periodo',
    arxivViewPapers: 'Publicaciones',
    arxivViewKeywords: 'Top keywords',
    arxivKeywordsTitle: 'Keywords mas usadas',
    arxivKeywordsEmpty: 'No hay keywords para esta seleccion.',
    arxivGroupsLabel: 'Grupos de keywords',
    arxivGroupPick: 'Elegir grupo',
    arxivGroupAdd: 'Usar',
    arxivGroupClear: 'Limpiar',
    arxivGroupNamePlaceholder: 'Nombre del grupo',
    arxivGroupTermsPlaceholder: 'Keywords separadas por coma',
    arxivGroupSave: 'Guardar grupo',
    arxivGroupDelete: 'Eliminar',
    arxivGroupSaveCurrent: 'Guardar busqueda actual',
    arxivGroupClose: 'Cerrar',
    arxivGroupAutoName: 'Grupo keywords',
    arxivNoActiveGroups: 'Sin grupos activos',
    arxivTopFiltersLabel: 'Filtros top',
    arxivTopModeLabel: 'Tipo',
    arxivTopModeAll: 'Todos',
    arxivTopModePhrases: 'Frases',
    arxivTopModeTerms: 'Terminos',
    arxivTopModeAcronyms: 'Siglas',
    arxivTopMinCountLabel: 'Min repeticiones',
    arxivTopSortLabel: 'Orden',
    arxivTopSortCount: 'Frecuencia',
    arxivTopSortAlpha: 'A-Z',
    arxivTopExcludeLabel: 'Exclusion personalizada',
    arxivTopExcludePlaceholder: 'palabra1, palabra2',
    rangeLabel: (range) => `Ultimos ${range} meses`,
    totalLabel: (range) => `Total publicaciones (${range}m)`,
    heatmapLow: 'Bajo',
    heatmapHigh: 'Alto',
    heatmapValue: 'Publicaciones',
    growthEmpty: '--'
  };

  const elGlobalUpdated = document.getElementById('science-global-updated');
  const elHeroRangeLabel = document.getElementById('hero-range-label');
  const elHeroRange = document.getElementById('hero-range');
  const elHeroFilters = document.getElementById('hero-filters');
  const elHeroChart = document.getElementById('hero-chart');
  const elHeroChartWrap = document.getElementById('hero-chart-wrap');
  const elHeroTooltip = document.getElementById('hero-tooltip');
  const elHeroTotal = document.getElementById('hero-total');
  const elHeroTotalLabel = document.getElementById('hero-total-label');
  const elHeroGrowth = document.getElementById('hero-growth');
  const elHeroTop = document.getElementById('hero-top');
  const elHeroBreakdown = document.getElementById('hero-breakdown');

  const elHeroApodMedia = document.getElementById('hero-apod-media');
  const elHeroApodTitle = document.getElementById('hero-apod-title');
  const elHeroApodDate = document.getElementById('hero-apod-date');
  const elHeroApodDesc = document.getElementById('hero-apod-desc');

  const elArxivUpdated = document.getElementById('arxiv-updated');
  const elArxivFilters = document.getElementById('arxiv-filters');
  const elArxivList = document.getElementById('arxiv-list');

  const elJournalUpdated = document.getElementById('journal-updated');
  const elJournalList = document.getElementById('science-journal-list');

  const elApodUpdated = document.getElementById('apod-updated');
  const elApodMedia = document.getElementById('apod-media');
  const elApodTitle = document.getElementById('apod-title');
  const elApodDate = document.getElementById('apod-date');
  const elApodDesc = document.getElementById('apod-desc');
  const elApodLink = document.getElementById('apod-link');

  const heroState = {
    range: 6,
    chartType: 'line',
    active: new Set(HERO_DEFAULT_GROUPS),
    data: null,
    months: [],
    series: null
  };

  const scienceCache = {
    arxiv: null,
    journalPosts: [],
    apod: null
  };

  let widgetBoardEls = null;
  let heatmapHideTimer = null;
  let lastHeatmapCell = null;
  let globalUpdated = null;
  let scienceCacheRevision = 0;
  const chartDatasetMemo = new Map();
  const chartDatasetMemoStats = { hits: 0, misses: 0 };
  const CHART_DATASET_MEMO_LIMIT = 160;
  const metricContextMemo = new Map();
  const metricContextMemoStats = { hits: 0, misses: 0 };
  const METRIC_CONTEXT_MEMO_LIMIT = 48;
  const chartLegendMemo = new Map();
  const CHART_LEGEND_MEMO_LIMIT = 160;
  const chartPreviewMarkupMemo = new Map();
  const CHART_PREVIEW_MEMO_LIMIT = 160;
  let traceRenderContextMemoKey = '';
  let traceRenderContextMemoValue = null;

  const safeText = (s) => (typeof s === 'string' ? s : '');
  const FETCH_CACHE_MODE = {
    arxiv: 'default',
    journal: 'no-cache',
    apod: 'default'
  };

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  function escapeRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function safeHref(raw, fallback = '#') {
    if (!raw) return fallback;
    try {
      const url = new URL(String(raw), window.location.href);
      const protocol = String(url.protocol || '').toLowerCase();
      if (protocol === 'http:' || protocol === 'https:') return url.href;
      return fallback;
    } catch {
      return fallback;
    }
  }

  function formatDate(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '--';
    try {
      return new Intl.DateTimeFormat(isEn ? 'en-US' : 'es-ES', {
        year: 'numeric', month: 'short', day: '2-digit'
      }).format(d);
    } catch {
      return d.toISOString().slice(0, 10);
    }
  }

  function formatDateTime(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '--';
    try {
      return new Intl.DateTimeFormat(isEn ? 'en-US' : 'es-ES', {
        year: 'numeric', month: 'short', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      }).format(d);
    } catch {
      return d.toISOString().replace('T', ' ').slice(0, 16);
    }
  }

  function formatMonthLabel(monthKey) {
    const d = new Date(`${monthKey}-01T00:00:00`);
    if (Number.isNaN(d.getTime())) return monthKey;
    try {
      return new Intl.DateTimeFormat(isEn ? 'en-US' : 'es-ES', {
        month: 'short', year: '2-digit'
      }).format(d);
    } catch {
      return monthKey;
    }
  }

  function updateGlobalUpdated(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return;
    if (!globalUpdated || d > globalUpdated) {
      globalUpdated = d;
      if (elGlobalUpdated) elGlobalUpdated.textContent = formatDateTime(d.toISOString());
    }
  }

  function setUpdated(el, iso) {
    if (!el) return;
    el.textContent = `${i18n.updated} ${formatDateTime(iso)}`;
  }

  function truncate(text, max) {
    const s = safeText(text).trim();
    if (s.length <= max) return s;
    return s.slice(0, max - 1).trim() + '...';
  }

  async function fetchJson(url, cacheMode = 'default') {
    const res = await fetch(url, { cache: cacheMode });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  function bumpScienceCacheRevision() {
    scienceCacheRevision += 1;
    chartDatasetMemo.clear();
    metricContextMemo.clear();
    chartLegendMemo.clear();
    chartPreviewMarkupMemo.clear();
    traceRenderContextMemoKey = '';
    traceRenderContextMemoValue = null;
  }

  function postUrl(id) {
    const base = pageLang === 'en' ? '/en/blog/' : '/blog/';
    return `${base}${encodeURIComponent(id)}.html`;
  }

  function detectGroup(cat) {
    const c = String(cat || '').toLowerCase();
    if (!c) return '';
    if (GROUP_ORDER.includes(c)) return c;
    if (c.startsWith('cs.')) return 'cs';
    if (c.startsWith('math.')) return 'math';
    if (c.startsWith('q-bio.')) return 'q-bio';
    if (c.startsWith('q-fin.')) return 'q-fin';
    if (c.startsWith('stat.')) return 'stat';
    if (c.startsWith('eess.')) return 'eess';
    if (c.startsWith('econ.')) return 'econ';
    if (c.startsWith('physics.') || c.startsWith('astro-ph') || c.startsWith('cond-mat') || c.startsWith('gr-qc') || c.startsWith('hep-') || c.startsWith('math-ph') || c.startsWith('nlin') || c.startsWith('nucl-') || c.startsWith('quant-ph')) return 'physics';
    return '';
  }
  function buildMonthKeys(endDate, count) {
    const end = new Date(endDate || Date.now());
    end.setDate(1);
    const out = [];
    for (let i = count - 1; i >= 0; i -= 1) {
      const d = new Date(end);
      d.setMonth(end.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      out.push(key);
    }
    return out;
  }

  function getRangeMonths(data, range) {
    const months = Array.isArray(data?.months) && data.months.length
      ? data.months
      : buildMonthKeys(data?.updatedAt || Date.now(), 12);
    return months.slice(-range);
  }

  function buildSeries(data, range) {
    const months = getRangeMonths(data, range);
    const series = {};
    GROUP_ORDER.forEach((id) => {
      series[id] = months.map((m) => (data?.series?.[id]?.[m] || 0));
    });
    return { months, series };
  }

  function buildSeriesFromItems(items, months) {
    if (!Array.isArray(items) || !items.length || !Array.isArray(months) || !months.length) return null;
    const series = {};
    GROUP_ORDER.forEach((id) => {
      series[id] = {};
      months.forEach((m) => {
        series[id][m] = 0;
      });
    });

    items.forEach((item) => {
      const group = detectGroup(item?.group || item?.primaryCategory || item?.categories?.[0]);
      if (!group || !series[group]) return;
      const date = new Date(item?.published || item?.updated || item?.updatedAt || '');
      if (Number.isNaN(date.getTime())) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (series[group][key] === undefined) return;
      series[group][key] += 1;
    });

    return series;
  }

  const KEYWORD_STOPWORDS = new Set([
    'a', 'about', 'above', 'across', 'after', 'again', 'against', 'all', 'also', 'an', 'and', 'any', 'are', 'as', 'at',
    'algorithm', 'algorithms', 'analysis', 'analyze', 'approach',
    'based', 'be', 'because', 'been', 'before', 'being', 'between', 'beyond', 'both', 'build', 'but', 'by',
    'called', 'can', 'cannot', 'case', 'cases',
    'data', 'dataset', 'datasets', 'design', 'develop', 'detection', 'different', 'do', 'does', 'done', 'during', 'dynamics',
    'each', 'effects', 'either', 'else',
    'field', 'fields', 'first', 'for', 'from', 'further',
    'general', 'get', 'gets', 'got',
    'had', 'has', 'have', 'having', 'high', 'however',
    'if', 'in', 'into', 'is', 'it', 'its', 'itself',
    'image', 'images',
    'just',
    'large', 'level', 'low',
    'many', 'may', 'method', 'methods', 'model', 'models', 'more', 'most', 'much', 'must',
    'new', 'next', 'no', 'nor', 'not', 'now', 'novel',
    'of', 'off', 'on', 'once', 'one', 'only', 'or', 'other', 'our', 'out', 'over',
    'paper', 'papers', 'problem', 'proposed',
    'results', 'research',
    'same', 'show', 'shows', 'since', 'so', 'some', 'such', 'study', 'system', 'systems',
    'than', 'that', 'the', 'their', 'them', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to',
    'toward', 'towards',
    'under', 'until', 'up', 'use', 'used', 'using',
    'very', 'via',
    'was', 'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'why', 'will', 'with', 'within', 'without', 'work', 'works',
    'you', 'your',
    'sobre', 'entre', 'hacia', 'desde', 'para', 'como', 'con', 'sin', 'segun', 'tambien',
    'que', 'del', 'las', 'los', 'una', 'uno', 'unos', 'unas', 'por', 'de', 'en', 'el', 'la', 'al', 'se'
  ]);

  const KEYWORD_MULTI_PHRASES = [
    { token: 'artificial intelligence', variants: ['artificial intelligence', 'ai'] },
    { token: 'machine learning', variants: ['machine learning', 'ml'] },
    { token: 'deep learning', variants: ['deep learning', 'dl'] },
    { token: 'large language model', variants: ['large language model', 'large language models', 'llm', 'llms'] },
    { token: 'retrieval augmented generation', variants: ['retrieval augmented generation', 'rag'] },
    { token: 'computer vision', variants: ['computer vision'] },
    { token: 'natural language processing', variants: ['natural language processing', 'nlp'] },
    { token: 'reinforcement learning', variants: ['reinforcement learning'] },
    { token: 'quantum computing', variants: ['quantum computing'] },
    { token: 'quantum mechanics', variants: ['quantum mechanics'] },
    { token: 'general relativity', variants: ['general relativity'] },
    { token: 'graph neural network', variants: ['graph neural network', 'graph neural networks', 'gnn', 'gnns'] }
  ];

  function monthKeyFromIso(iso) {
    if (!iso) return '';
    const value = String(iso);
    return value.length >= 7 ? value.slice(0, 7) : '';
  }

  function normalizeToken(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  const KEYWORD_MULTI_PHRASE_PATTERNS = KEYWORD_MULTI_PHRASES.map((entry) => ({
    token: entry.token,
    patterns: Array.from(new Set(entry.variants.map((variant) => normalizeToken(variant).trim()).filter(Boolean)))
      .map((variant) => new RegExp(`(^|[^a-z0-9])${escapeRegExp(variant)}(?=$|[^a-z0-9])`))
  }));

  function containsNormalizedTerm(haystack, normalizedTerm) {
    const text = String(haystack || '');
    const term = String(normalizedTerm || '').trim();
    if (!text || !term) return false;
    if (term.length <= 3 || term.includes(' ')) {
      const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(term)}(?=$|[^a-z0-9])`);
      return pattern.test(text);
    }
    return text.includes(term);
  }

  function collectKeywordCounts(items) {
    const counts = new Map();
    if (!Array.isArray(items) || !items.length) return counts;

    items.forEach((item) => {
      const text = normalizeToken(`${safeText(item?.title)} ${safeText(item?.summary)}`);
      if (!text) return;
      const uniqueTokens = new Set();

      const wordTokens = text.match(/[a-z][a-z0-9-]{3,}/g) || [];
      wordTokens.forEach((token) => {
        if (KEYWORD_STOPWORDS.has(token)) return;
        uniqueTokens.add(token);
      });

      KEYWORD_MULTI_PHRASE_PATTERNS.forEach((entry) => {
        if (entry.patterns.some((pattern) => pattern.test(text))) {
          uniqueTokens.add(entry.token);
        }
      });

      uniqueTokens.forEach((token) => {
        counts.set(token, (counts.get(token) || 0) + 1);
      });
    });

    return counts;
  }

  function sanitizeKeywordInput(value) {
    return String(value || '')
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .trim()
      .slice(0, 32);
  }

  function countWords(text) {
    const tokens = normalizeToken(text).match(/[a-z][a-z0-9-]{1,}/g) || [];
    return tokens.length;
  }

  function getArxivItemsInMonths(items, months) {
    if (!Array.isArray(items) || !items.length || !Array.isArray(months) || !months.length) return [];
    const monthSet = new Set(months);
    return items.filter((item) => monthSet.has(monthKeyFromIso(item?.updated || item?.published)));
  }

  function extractTopKeyword(items) {
    if (!Array.isArray(items) || !items.length) return { token: '', count: 0 };
    const counts = collectKeywordCounts(items);

    let bestToken = '';
    let bestCount = 0;
    counts.forEach((count, token) => {
      if (count > bestCount) {
        bestToken = token;
        bestCount = count;
      }
    });

    return { token: bestToken, count: bestCount };
  }

  function toTitleCase(token) {
    const str = String(token || '');
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function formatPercent(value, digits = 0) {
    if (!Number.isFinite(value)) return '--';
    return `${value.toFixed(digits)}%`;
  }

  function formatSignedPercent(value, digits = 0) {
    if (!Number.isFinite(value)) return i18n.growthEmpty;
    const rounded = Number(value.toFixed(digits));
    const sign = rounded > 0 ? '+' : '';
    return `${sign}${rounded}%`;
  }

  const RANGE_OPTIONS = [3, 6, 9, 12];

  function clampRangeMonths(raw) {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return 6;
    const normalized = Math.round(parsed);
    if (normalized <= 3) return 3;
    if (normalized <= 6) return 6;
    if (normalized <= 9) return 9;
    return 12;
  }

  function formatRangeMonthsLabel(rawMonths) {
    const months = clampRangeMonths(rawMonths);
    if (isEn) return `${months} month${months === 1 ? '' : 's'}`;
    return `${months} mes${months === 1 ? '' : 'es'}`;
  }

  const SOURCE_KEYS = ['arxiv', 'journal', 'nasa'];
  const SOURCE_LABELS = { arxiv: 'ArXiv', journal: 'Blog', nasa: 'NASA' };
  const SOURCE_DEFAULT_BLEND = { arxiv: 100, journal: 0, nasa: 0 };
  const JOURNAL_SOURCE_PROFILE = {
    physics: 0.08,
    math: 0.28,
    cs: 0.42,
    'q-bio': 0.11,
    stat: 0.06,
    'q-fin': 0.02,
    eess: 0.02,
    econ: 0.01
  };
  const NASA_SOURCE_PROFILE = {
    physics: 0.54,
    math: 0.12,
    cs: 0.19,
    'q-bio': 0.05,
    stat: 0.03,
    'q-fin': 0.02,
    eess: 0.04,
    econ: 0.01
  };

  function cloneSourceBlend(blend) {
    return {
      arxiv: Number(blend?.arxiv) || 0,
      journal: Number(blend?.journal) || 0,
      nasa: Number(blend?.nasa) || 0
    };
  }

  function normalizeSourceBlend(rawBlend) {
    const base = cloneSourceBlend(rawBlend);
    SOURCE_KEYS.forEach((key) => {
      base[key] = Math.max(0, Number(base[key]) || 0);
    });

    const total = SOURCE_KEYS.reduce((sum, key) => sum + base[key], 0);
    if (!total) return { ...SOURCE_DEFAULT_BLEND };

    const normalized = {};
    let running = 0;

    SOURCE_KEYS.forEach((key, index) => {
      if (index === SOURCE_KEYS.length - 1) {
        normalized[key] = Math.max(0, 100 - running);
      } else {
        const value = Math.round((base[key] / total) * 100);
        normalized[key] = value;
        running += value;
      }
    });

    return normalized;
  }

  function parseSourceBlendFromText(rawValue, fallbackBlend = SOURCE_DEFAULT_BLEND) {
    const text = String(rawValue || '').trim();
    if (!text) return normalizeSourceBlend(fallbackBlend);

    const parsed = cloneSourceBlend({ arxiv: 0, journal: 0, nasa: 0 });
    const regex = /([A-Za-z][A-Za-z0-9-]*)\s*(\d+(?:\.\d+)?)%/g;
    let match = regex.exec(text);

    while (match) {
      const token = normalizeToken(match[1]);
      const value = Number(match[2]);
      if (Number.isFinite(value)) {
        if (token.includes('arxiv')) parsed.arxiv = value;
        if (token.includes('journal')) parsed.journal = value;
        if (token.includes('nasa')) parsed.nasa = value;
      }
      match = regex.exec(text);
    }

    const hasAny = SOURCE_KEYS.some((key) => parsed[key] > 0);
    return normalizeSourceBlend(hasAny ? parsed : fallbackBlend);
  }

  function formatSourceBlendText(blend) {
    const normalized = normalizeSourceBlend(blend);
    return `${SOURCE_LABELS.arxiv} ${normalized.arxiv}% / ${SOURCE_LABELS.journal} ${normalized.journal}% / ${SOURCE_LABELS.nasa} ${normalized.nasa}%`;
  }

  function getDefaultSourceBlendFromCache() {
    const arxivData = scienceCache.arxiv || heroState.data;
    const range = clampRangeMonths(heroState.range || 6);

    const arxivCount = Array.isArray(arxivData?.items)
      ? getArxivItemsInMonths(arxivData.items, getRangeMonths(arxivData, range)).length
      : 0;
    const journalCount = Array.isArray(scienceCache.journalPosts) ? scienceCache.journalPosts.length : 0;
    const nasaCount = scienceCache.apod ? 1 : 0;
    const total = arxivCount + journalCount + nasaCount;

    if (!total) return { ...SOURCE_DEFAULT_BLEND };

    return normalizeSourceBlend({
      arxiv: (arxivCount / total) * 100,
      journal: (journalCount / total) * 100,
      nasa: (nasaCount / total) * 100
    });
  }

  function rebalanceSourceBlend(currentBlend, editedKey, rawValue) {
    const current = normalizeSourceBlend(currentBlend);
    const key = String(editedKey || '').toLowerCase();
    if (!SOURCE_KEYS.includes(key)) return current;

    const nextValue = clampNumber(Math.round(Number(rawValue) || 0), 0, 100);
    const remaining = SOURCE_KEYS.filter((sourceKey) => sourceKey !== key);
    const remainingPool = Math.max(0, 100 - nextValue);

    const othersTotal = remaining.reduce((sum, sourceKey) => sum + current[sourceKey], 0);
    const nextBlend = { ...current, [key]: nextValue };

    if (!othersTotal) {
      const split = remaining.length ? Math.floor(remainingPool / remaining.length) : 0;
      let assigned = 0;
      remaining.forEach((sourceKey, index) => {
        if (index === remaining.length - 1) {
          nextBlend[sourceKey] = Math.max(0, remainingPool - assigned);
        } else {
          nextBlend[sourceKey] = split;
          assigned += split;
        }
      });
      return normalizeSourceBlend(nextBlend);
    }

    let assigned = 0;
    remaining.forEach((sourceKey, index) => {
      if (index === remaining.length - 1) {
        nextBlend[sourceKey] = Math.max(0, remainingPool - assigned);
      } else {
        const mapped = Math.round((current[sourceKey] / othersTotal) * remainingPool);
        nextBlend[sourceKey] = mapped;
        assigned += mapped;
      }
    });

    return normalizeSourceBlend(nextBlend);
  }

  function getNodeSourceBlend(node) {
    if (!node || node.role !== 'control' || node.cardId !== 'source-control') {
      return { ...SOURCE_DEFAULT_BLEND };
    }
    ensureNodeSettings(node);
    return normalizeSourceBlend(node.settings?.sourceBlend || SOURCE_DEFAULT_BLEND);
  }

  function getChartSourceBlend(chartNode) {
    const controls = getChartLinkedNodes(chartNode, 'top');
    const sourceNode = controls.find((node) => node.cardId === 'source-control');
    if (sourceNode) return getNodeSourceBlend(sourceNode);
    return { ...SOURCE_DEFAULT_BLEND };
  }

  const STYLE_DEPTH_DEFAULT = { depth: 52, glow: 34 };
  const STYLE_COLOR_DEFAULT = { palette: 'balanced', contrast: 58 };
  const STYLE_3D_DEFAULT = { relief: 64, softness: 62 };
  const STYLE_PALETTES = {
    balanced: {
      start: [37, 99, 235],
      end: [239, 68, 68],
      area: [239, 91, 47],
      labelEn: 'Balanced',
      labelEs: 'Balanceado'
    },
    cool: {
      start: [37, 99, 235],
      end: [14, 165, 233],
      area: [37, 99, 235],
      labelEn: 'Cool',
      labelEs: 'Frio'
    },
    warm: {
      start: [245, 158, 11],
      end: [239, 68, 68],
      area: [239, 91, 47],
      labelEn: 'Warm',
      labelEs: 'Calido'
    },
    mono: {
      start: [148, 163, 184],
      end: [71, 85, 105],
      area: [100, 116, 139],
      labelEn: 'Monochrome',
      labelEs: 'Monocromo'
    }
  };

  function normalizeStyleDepthSettings(rawSettings) {
    return {
      depth: clampNumber(Math.round(Number(rawSettings?.depth) || STYLE_DEPTH_DEFAULT.depth), 0, 100),
      glow: clampNumber(Math.round(Number(rawSettings?.glow) || STYLE_DEPTH_DEFAULT.glow), 0, 100)
    };
  }

  function normalizeStyleColorSettings(rawSettings) {
    const palette = String(rawSettings?.palette || STYLE_COLOR_DEFAULT.palette).toLowerCase();
    const safePalette = Object.prototype.hasOwnProperty.call(STYLE_PALETTES, palette)
      ? palette
      : STYLE_COLOR_DEFAULT.palette;

    return {
      palette: safePalette,
      contrast: clampNumber(Math.round(Number(rawSettings?.contrast) || STYLE_COLOR_DEFAULT.contrast), 0, 100)
    };
  }

  function normalizeStyleThreeDSettings(rawSettings) {
    return {
      relief: clampNumber(Math.round(Number(rawSettings?.relief) || STYLE_3D_DEFAULT.relief), 0, 100),
      softness: clampNumber(Math.round(Number(rawSettings?.softness) || STYLE_3D_DEFAULT.softness), 0, 100)
    };
  }

  function getStylePaletteLabel(paletteId) {
    const palette = STYLE_PALETTES[String(paletteId || '').toLowerCase()] || STYLE_PALETTES[STYLE_COLOR_DEFAULT.palette];
    return isEn ? palette.labelEn : palette.labelEs;
  }

  function getStylePaletteOptions() {
    return Object.keys(STYLE_PALETTES).map((id) => ({
      id,
      label: getStylePaletteLabel(id)
    }));
  }

  function formatStyleDepthValue(rawSettings) {
    const settings = normalizeStyleDepthSettings(rawSettings);
    return isEn
      ? `Depth ${settings.depth}% / Glow ${settings.glow}%`
      : `Profundidad ${settings.depth}% / Glow ${settings.glow}%`;
  }

  function formatStyleColorValue(rawSettings) {
    const settings = normalizeStyleColorSettings(rawSettings);
    const paletteLabel = getStylePaletteLabel(settings.palette);
    return `${paletteLabel} ${settings.contrast}%`;
  }

  function formatStyleThreeDValue(rawSettings) {
    const settings = normalizeStyleThreeDSettings(rawSettings);
    return isEn
      ? `Relief ${settings.relief}% / Softness ${settings.softness}%`
      : `Relieve ${settings.relief}% / Suavidad ${settings.softness}%`;
  }

  function createDefaultChartStyleConfig() {
    const palette = STYLE_PALETTES[STYLE_COLOR_DEFAULT.palette];
    return {
      depth: STYLE_DEPTH_DEFAULT.depth / 100,
      glow: STYLE_DEPTH_DEFAULT.glow / 100,
      threeDRelief: 0.18,
      threeDSoftness: 0.58,
      lineWidth: 2,
      lineGlowStrength: 0.28,
      lineDepthOffset: 0.4,
      lineShadowOpacity: 0.06,
      lineHighlightOpacity: 0.05,
      lineAreaShadowOpacity: 0.04,
      areaOpacity: 0.2,
      radarDepth: 0.4,
      radarShadow: 0.18,
      radarFloorOffset: 0.9,
      radarHighlightLift: 0.35,
      radarPolygonShadowOpacity: 0.08,
      radarPolygonHighlightOpacity: 0.05,
      heatContrast: 1,
      heatAlphaBase: 0.22,
      heatAlphaSpan: 0.62,
      heatCellLift: 0.35,
      heatCellShadowOpacity: 0.07,
      heatCellHighlightOpacity: 0.08,
      heatCellRadiusBoost: 0.35,
      paletteId: STYLE_COLOR_DEFAULT.palette,
      paletteStart: palette.start.slice(),
      paletteEnd: palette.end.slice(),
      areaTint: palette.area.slice()
    };
  }

  function getChartStyleConfig(chartNode, dataset = null) {
    const styleConfig = createDefaultChartStyleConfig();
    const styleNodes = chartNode && chartNode.role === 'chart'
      ? getChartLinkedNodes(chartNode, 'bottom')
      : (Array.isArray(dataset?.styles) ? dataset.styles : []);

    styleNodes.forEach((node) => {
      if (!node || node.role !== 'style') return;
      ensureNodeSettings(node);

      if (node.cardId === 'style-depth') {
        const depthSettings = normalizeStyleDepthSettings(node.settings?.styleDepth);
        const depth = depthSettings.depth / 100;
        const glow = depthSettings.glow / 100;
        styleConfig.depth = depth;
        styleConfig.glow = glow;
        styleConfig.lineWidth = 1.6 + depth * 2.1;
        styleConfig.lineGlowStrength = 0.08 + glow * 1.1;
        styleConfig.areaOpacity = 0.1 + depth * 0.32;
        styleConfig.radarDepth = 0.16 + depth * 0.72;
        styleConfig.radarShadow = 0.08 + glow * 0.28;
        styleConfig.heatAlphaBase = 0.16 + depth * 0.2;
        styleConfig.heatAlphaSpan = 0.42 + glow * 0.5;
      }

      if (node.cardId === 'style-color') {
        const colorSettings = normalizeStyleColorSettings(node.settings?.styleColor);
        const palette = STYLE_PALETTES[colorSettings.palette] || STYLE_PALETTES[STYLE_COLOR_DEFAULT.palette];
        const contrastFactor = 0.74 + (colorSettings.contrast / 100) * 0.92;

        styleConfig.paletteId = colorSettings.palette;
        styleConfig.paletteStart = palette.start.slice();
        styleConfig.paletteEnd = palette.end.slice();
        styleConfig.areaTint = palette.area.slice();
        styleConfig.heatContrast = contrastFactor;
      }

      if (node.cardId === 'style-3d') {
        const styleThreeD = normalizeStyleThreeDSettings(node.settings?.style3d);
        const relief = styleThreeD.relief / 100;
        const softness = styleThreeD.softness / 100;
        const crispness = 1 - softness;

        styleConfig.threeDRelief = relief;
        styleConfig.threeDSoftness = softness;
        styleConfig.lineDepthOffset = 0.35 + relief * 2.45;
        styleConfig.lineShadowOpacity = 0.04 + relief * 0.21;
        styleConfig.lineHighlightOpacity = 0.03 + softness * 0.21;
        styleConfig.lineAreaShadowOpacity = 0.03 + relief * 0.16;

        styleConfig.radarFloorOffset = 0.75 + relief * 3.2;
        styleConfig.radarHighlightLift = 0.28 + softness * 1.65;
        styleConfig.radarPolygonShadowOpacity = 0.06 + relief * 0.22;
        styleConfig.radarPolygonHighlightOpacity = 0.04 + softness * 0.24;
        styleConfig.radarDepth = clampNumber(styleConfig.radarDepth + relief * 0.42, 0.08, 1.65);
        styleConfig.radarShadow = clampNumber(styleConfig.radarShadow + relief * 0.2 + crispness * 0.08, 0.05, 1.45);

        styleConfig.heatCellLift = 0.3 + relief * 1.55;
        styleConfig.heatCellShadowOpacity = 0.05 + relief * 0.21;
        styleConfig.heatCellHighlightOpacity = 0.06 + softness * 0.2;
        styleConfig.heatCellRadiusBoost = 0.2 + relief * 1.1;
        styleConfig.heatAlphaBase = clampNumber(styleConfig.heatAlphaBase + relief * 0.05, 0.12, 0.62);
        styleConfig.heatAlphaSpan = clampNumber(styleConfig.heatAlphaSpan + relief * 0.08, 0.22, 0.86);
      }
    });

    return styleConfig;
  }

  function getChartStyleSignature(chartNode) {
    if (!chartNode || chartNode.role !== 'chart') return 'default';

    const styleNodes = getChartLinkedNodes(chartNode, 'bottom');
    if (!styleNodes.length) return 'default';

    return styleNodes.map((node) => {
      if (!node || node.role !== 'style') {
        return `${String(node?.uid || '')}:${String(node?.cardId || '')}`;
      }

      ensureNodeSettings(node);

      if (node.cardId === 'style-depth') {
        const settings = normalizeStyleDepthSettings(node.settings?.styleDepth);
        return `${node.uid}:depth:${settings.depth}:${settings.glow}`;
      }

      if (node.cardId === 'style-color') {
        const settings = normalizeStyleColorSettings(node.settings?.styleColor);
        return `${node.uid}:color:${settings.palette}:${settings.contrast}`;
      }

      if (node.cardId === 'style-3d') {
        const settings = normalizeStyleThreeDSettings(node.settings?.style3d);
        return `${node.uid}:three-d:${settings.relief}:${settings.softness}`;
      }

      return `${node.uid}:${String(node.cardId || '')}:${JSON.stringify(node.settings || {})}`;
    }).join('|');
  }

  function getBoardChartPreviewCacheKey(chartNode) {
    if (!chartNode || chartNode.role !== 'chart') return '';
    const kind = getChartKindFromCard(chartNode);
    const expandedFlag = isExpandedChartLegend(chartNode) ? 'expanded' : 'compact';
    return [
      pageLang,
      kind,
      expandedFlag,
      getChartDatasetMemoKey(chartNode),
      getChartStyleSignature(chartNode)
    ].join('|');
  }

  function pushChartPreviewMarkupMemo(cacheKey, markup) {
    if (!cacheKey || !markup) return;
    if (chartPreviewMarkupMemo.size >= CHART_PREVIEW_MEMO_LIMIT) {
      const oldestKey = chartPreviewMarkupMemo.keys().next().value;
      if (oldestKey) chartPreviewMarkupMemo.delete(oldestKey);
    }
    chartPreviewMarkupMemo.set(cacheKey, markup);
  }

  function summarizeSourceBlendValue(rawValue) {
    const normalized = String(rawValue || '').replace(/\s*[|+]\s*/g, ' / ').replace(/\s{2,}/g, ' ').trim();
    if (!normalized) return '--';

    const entries = [];
    const regex = /([A-Za-z][A-Za-z0-9-]*)\s*(\d+(?:\.\d+)?)%/g;
    let match = regex.exec(normalized);
    while (match) {
      const label = String(match[1] || '').trim();
      const pct = Number(match[2]);
      if (label && Number.isFinite(pct)) entries.push({ label, pct });
      match = regex.exec(normalized);
    }

    if (!entries.length) return normalized;

    entries.sort((a, b) => b.pct - a.pct);

    const fullName = (label) => {
      const token = normalizeToken(label);
      if (token.includes('arxiv')) return 'ArXiv';
      if (token.includes('journal') || token.includes('blog')) return 'Blog';
      if (token.includes('nasa')) return 'NASA';
      return toTitleCase(String(label).slice(0, 8));
    };

    const shortName = (label) => {
      const token = normalizeToken(label);
      if (token.includes('arxiv')) return 'AX';
      if (token.includes('journal') || token.includes('blog')) return 'BG';
      if (token.includes('nasa')) return 'NA';
      return toTitleCase(String(label).replace(/[^a-z0-9]/gi, '').slice(0, 2) || '--');
    };

    const top = entries[0];
    if (top.pct >= 85 || entries.length === 1) {
      return `${fullName(top.label)} ${Math.round(top.pct)}%`;
    }

    return entries
      .slice(0, 3)
      .map((entry) => `${shortName(entry.label)}${Math.round(entry.pct)}`)
      .join('/');
  }

  function formatControlCompactValue(node) {
    if (!node || node.role !== 'control') return String(node?.value || '--');

    const cardId = String(node.cardId || '').toLowerCase();
    if (cardId === 'period-control') {
      const months = Number(node.settings?.rangeMonths);
      return formatRangeMonthsLabel(Number.isFinite(months) ? months : 6);
    }

    if (cardId === 'source-control') {
      return summarizeSourceBlendValue(node.value || '');
    }

    return String(node.value || '--').trim() || '--';
  }

  function getControlTopicLabel(node) {
    if (!node || node.role !== 'control') return '';

    const cardId = String(node.cardId || '').toLowerCase();
    if (cardId === 'period-control') return isEn ? 'period' : 'periodo';
    if (cardId === 'source-control') return isEn ? 'sources' : 'fuentes';

    const title = safeText(node.title).trim();
    if (!title) return isEn ? 'Control' : 'Control';

    const tokens = title.split(/\s+/).filter(Boolean);
    const stopwords = new Set(isEn
      ? ['selector', 'control', 'controls', 'of', 'the', 'and']
      : ['selector', 'selectora', 'control', 'de', 'del', 'la', 'el', 'y']);

    const preferred = tokens.find((token) => {
      const normalized = normalizeToken(token).replace(/[^a-z0-9]/g, '');
      return normalized && !stopwords.has(normalized);
    }) || tokens[0];

    return String(preferred || '').replace(/[|:,].*$/, '').trim().toLowerCase() || (isEn ? 'control' : 'control');
  }

  function getStyleTopicLabel(node) {
    if (!node || node.role !== 'style') return '';

    const cardId = String(node.cardId || '').toLowerCase();
    if (cardId === 'style-depth') return isEn ? 'depth' : 'profundidad';
    if (cardId === 'style-color') return isEn ? 'color' : 'color';
    if (cardId === 'style-3d') return '3d';

    const title = safeText(node.title).trim();
    if (!title) return isEn ? 'style' : 'estilo';

    const tokens = title.split(/\s+/).filter(Boolean);
    const stopwords = new Set(isEn
      ? ['style', 'visual', 'profile', 'and', 'of', 'the']
      : ['estilo', 'visual', 'perfil', 'y', 'de', 'del', 'la', 'el']);

    const preferred = tokens.find((token) => {
      const normalized = normalizeToken(token).replace(/[^a-z0-9]/g, '');
      return normalized && !stopwords.has(normalized);
    }) || tokens[0];

    return String(preferred || '').replace(/[|:,].*$/, '').trim().toLowerCase() || (isEn ? 'style' : 'estilo');
  }

  function formatStyleCompactValue(node) {
    if (!node || node.role !== 'style') return String(node?.value || '--').trim() || '--';

    if (node.cardId === 'style-depth') {
      const settings = normalizeStyleDepthSettings(node.settings?.styleDepth);
      return `${settings.depth}% / ${settings.glow}%`;
    }

    if (node.cardId === 'style-color') {
      const settings = normalizeStyleColorSettings(node.settings?.styleColor);
      return `${getStylePaletteLabel(settings.palette)} ${settings.contrast}%`;
    }

    if (node.cardId === 'style-3d') {
      const settings = normalizeStyleThreeDSettings(node.settings?.style3d);
      return `${settings.relief}% / ${settings.softness}%`;
    }

    return String(node.value || '--').trim() || '--';
  }

  function getOutputTopicLabel(node) {
    if (!node || node.role !== 'output') return '';

    const cardId = String(node.cardId || '').toLowerCase();
    if (cardId === 'top-category-share') return isEn ? 'leader' : 'lider';
    if (cardId === 'topic-density') return isEn ? 'topics' : 'temas';
    if (cardId === 'context-output') return isEn ? 'matches' : 'coincidencias';
    if (cardId === 'sp-imp-admit-rate') return isEn ? 'conversion' : 'conversion';
    if (cardId === 'sp-imp-applications') return isEn ? 'demand' : 'demanda';
    if (cardId === 'sp-eth-transfer') return isEn ? 'pipeline' : 'pipeline';

    const title = safeText(node.title).trim();
    if (!title) return isEn ? 'output' : 'salida';

    const tokens = title.split(/\s+/).filter(Boolean);
    const stopwords = new Set(isEn
      ? ['kpi', 'signal', 'index', 'context', 'cross-reference', 'map', 'rate', 'score', 'trend', 'output', 'of', 'the', 'and']
      : ['kpi', 'senal', 'indice', 'contexto', 'referencia', 'mapa', 'tasa', 'score', 'tendencia', 'salida', 'de', 'del', 'la', 'el', 'y']);

    const preferred = tokens.find((token) => {
      const normalized = normalizeToken(token).replace(/[^a-z0-9]/g, '');
      return normalized && !stopwords.has(normalized);
    }) || tokens[0];

    return String(preferred || '').replace(/[|:,].*$/, '').trim().toLowerCase() || (isEn ? 'output' : 'salida');
  }

  function getOutputCompactValue(node) {
    if (!node || node.role !== 'output') return String(node?.value || '--').trim() || '--';

    const raw = safeText(node.value).trim();
    if (!raw) return '--';

    const cardId = String(node.cardId || '').toLowerCase();

    if (cardId === 'top-category-share') {
      const pctMatch = raw.match(/-?\d+(?:[\.,]\d+)?\s*%/);
      return pctMatch ? pctMatch[0].replace(/\s+/g, '') : raw;
    }

    if (cardId === 'topic-density' || cardId === 'context-output') {
      const numMatch = raw.match(/-?\d+(?:[\.,]\d+)?/);
      return numMatch ? numMatch[0] : raw;
    }

    const pctMatch = raw.match(/-?\d+(?:[\.,]\d+)?\s*%/);
    if (pctMatch) return pctMatch[0].replace(/\s+/g, '');

    const numMatch = raw.match(/-?\d+(?:[\.,]\d+)?/);
    if (numMatch) return numMatch[0];

    return truncate(raw, 18);
  }

  function buildOutputCompactSummary(node) {
    if (!node || node.role !== 'output' || !node.attachedTo) return '';
    const topic = getOutputTopicLabel(node);
    const value = getOutputCompactValue(node);
    if (!topic) return value || '--';
    return `${topic}: ${value || '--'}`;
  }

  function getDefaultMetricForCard(cardId) {
    const id = String(cardId || '').toLowerCase();
    if (id === 'keyword-frequency') return 'keyword-top';
    if (id === 'apod-index') return 'apod-words';
    if (id === 'total-papers') return 'total';
    return 'total';
  }

  function getDataMetricOptions() {
    const groups = GROUP_ORDER.map((id) => ({
      id: `group:${id}`,
      label: isEn ? `${GROUP_LABELS[id] || id} publications` : `Publicaciones ${GROUP_LABELS[id] || id}`
    }));

    return [
      { id: 'total', label: isEn ? 'Total publications' : 'Total publicaciones' },
      ...groups,
      { id: 'keyword-top', label: isEn ? 'Top keyword frequency' : 'Frecuencia keyword lider' },
      { id: 'keyword-custom', label: isEn ? 'Custom keyword frequency' : 'Frecuencia keyword personalizada' },
      { id: 'apod-words', label: isEn ? 'APOD word volume' : 'Volumen de palabras APOD' }
    ];
  }

  function getDataTransformOptions() {
    return [
      { id: 'raw', label: isEn ? 'Raw series' : 'Serie original' },
      { id: 'moving3', label: isEn ? 'Moving average (3m)' : 'Promedio movil (3m)' },
      { id: 'cumulative', label: isEn ? 'Cumulative sum' : 'Suma acumulada' },
      { id: 'delta', label: isEn ? 'Monthly delta' : 'Delta mensual' }
    ];
  }

  function getAggregateOptions() {
    return [
      { id: 'last', label: isEn ? 'Last point' : 'Ultimo punto' },
      { id: 'sum', label: isEn ? 'Period sum' : 'Suma del periodo' },
      { id: 'avg', label: isEn ? 'Period average' : 'Promedio del periodo' },
      { id: 'max', label: isEn ? 'Period max' : 'Maximo del periodo' },
      { id: 'growth', label: isEn ? 'Monthly growth %' : 'Crecimiento mensual %' }
    ];
  }

  function normalizeTransformId(raw) {
    const id = String(raw || '').toLowerCase();
    const allowed = new Set(getDataTransformOptions().map((entry) => entry.id));
    return allowed.has(id) ? id : 'raw';
  }

  function normalizeAggregateId(raw) {
    const id = String(raw || '').toLowerCase();
    const allowed = new Set(getAggregateOptions().map((entry) => entry.id));
    return allowed.has(id) ? id : 'last';
  }

  function getTransformLabel(transformId) {
    const id = normalizeTransformId(transformId);
    const item = getDataTransformOptions().find((entry) => entry.id === id);
    return item ? item.label : (isEn ? 'Raw series' : 'Serie original');
  }

  function getAggregateLabel(aggregateId) {
    const id = normalizeAggregateId(aggregateId);
    const item = getAggregateOptions().find((entry) => entry.id === id);
    return item ? item.label : (isEn ? 'Last point' : 'Ultimo punto');
  }

  function applySeriesTransform(values, transformId) {
    const input = Array.isArray(values) ? values.map((value) => Number(value) || 0) : [];
    const transform = normalizeTransformId(transformId);

    if (transform === 'cumulative') {
      let running = 0;
      return input.map((value) => {
        running += value;
        return running;
      });
    }

    if (transform === 'moving3') {
      return input.map((_, index) => {
        const start = Math.max(0, index - 2);
        const window = input.slice(start, index + 1);
        const total = window.reduce((sum, value) => sum + value, 0);
        return total / window.length;
      });
    }

    if (transform === 'delta') {
      return input.map((value, index) => (index ? value - input[index - 1] : 0));
    }

    return input;
  }

  function computeSeriesAggregate(values, aggregateId) {
    const clean = Array.isArray(values) ? values.map((value) => Number(value) || 0) : [];
    if (!clean.length) return null;

    const aggregate = normalizeAggregateId(aggregateId);

    if (aggregate === 'sum') {
      return clean.reduce((sum, value) => sum + value, 0);
    }

    if (aggregate === 'avg') {
      return clean.reduce((sum, value) => sum + value, 0) / clean.length;
    }

    if (aggregate === 'max') {
      return Math.max(...clean);
    }

    if (aggregate === 'growth') {
      if (clean.length < 2) return null;
      const last = clean[clean.length - 1];
      const prev = clean[clean.length - 2];
      if (!prev) return null;
      return ((last - prev) / prev) * 100;
    }

    return clean[clean.length - 1];
  }

  function formatAggregateOutput(aggregateId, value) {
    const aggregate = normalizeAggregateId(aggregateId);
    if (!Number.isFinite(value)) return i18n.growthEmpty;

    if (aggregate === 'growth') {
      return formatSignedPercent(value, 1);
    }

    const digits = aggregate === 'avg' ? 1 : 0;
    return Number(value).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits
    });
  }

  function getMetricLabel(metricId, keyword = '') {
    const metric = String(metricId || '').toLowerCase();
    if (metric === 'total') return isEn ? 'Total publications' : 'Total publicaciones';
    if (metric.startsWith('group:')) {
      const groupId = metric.split(':')[1] || '';
      const groupLabel = GROUP_LABELS[groupId] || groupId;
      return isEn ? `${groupLabel} publications` : `Publicaciones ${groupLabel}`;
    }
    if (metric === 'keyword-top') return isEn ? 'Top keyword frequency' : 'Frecuencia keyword lider';
    if (metric === 'keyword-custom') {
      const normalized = String(keyword || '').trim();
      if (!normalized) return isEn ? 'Custom keyword frequency' : 'Frecuencia keyword personalizada';
      return isEn ? `Keyword: ${normalized}` : `Keyword: ${normalized}`;
    }
    if (metric === 'apod-words') return isEn ? 'APOD word volume' : 'Volumen de palabras APOD';
    return isEn ? 'Total publications' : 'Total publicaciones';
  }

  function getMetricSourceLabel(metricId) {
    const metric = String(metricId || '').toLowerCase();
    if (metric === 'apod-words') return 'NASA APOD';
    return 'ArXiv';
  }

  function getMetricSubjectForTitle(metricId, keyword = '') {
    const metric = String(metricId || '').toLowerCase();

    if (metric === 'total') {
      return isEn ? 'publications' : 'publicaciones';
    }

    if (metric.startsWith('group:')) {
      const groupId = metric.split(':')[1] || '';
      const groupLabel = String(GROUP_LABELS[groupId] || groupId).toLowerCase();
      return isEn ? `publications in ${groupLabel}` : `publicaciones en ${groupLabel}`;
    }

    if (metric === 'keyword-top') {
      return isEn ? 'top keyword mentions' : 'menciones del termino lider';
    }

    if (metric === 'keyword-custom') {
      const cleanedKeyword = sanitizeKeywordInput(keyword);
      if (cleanedKeyword) {
        return isEn ? `mentions of "${cleanedKeyword}"` : `menciones de "${cleanedKeyword}"`;
      }
      return isEn ? 'keyword mentions' : 'menciones de keyword';
    }

    if (metric === 'apod-words') {
      return isEn ? 'APOD text volume' : 'volumen de texto APOD';
    }

    return isEn ? 'publications' : 'publicaciones';
  }

  function composeDataNodeTitle(metricId, transformId, aggregateId, keyword = '') {
    const metric = String(metricId || '').toLowerCase();
    const transform = normalizeTransformId(transformId);
    const aggregate = normalizeAggregateId(aggregateId);
    const subject = getMetricSubjectForTitle(metric, keyword);
    const source = getMetricSourceLabel(metric);
    let titleHead = '';

    if (aggregate === 'growth') {
      titleHead = isEn ? `Monthly growth in ${subject}` : `Crecimiento mensual de ${subject}`;
    } else if (aggregate === 'sum') {
      titleHead = isEn ? `Total ${subject}` : `Total de ${subject}`;
    } else if (aggregate === 'avg') {
      titleHead = isEn ? `Monthly average of ${subject}` : `Promedio mensual de ${subject}`;
    } else if (aggregate === 'max') {
      titleHead = isEn ? `Monthly peak of ${subject}` : `Pico mensual de ${subject}`;
    } else if (transform === 'cumulative') {
      titleHead = isEn ? `Accumulated ${subject}` : `Acumulado de ${subject}`;
    } else if (transform === 'delta') {
      titleHead = isEn ? `Monthly change in ${subject}` : `Cambio mensual de ${subject}`;
    } else if (transform === 'moving3') {
      titleHead = isEn ? `Smoothed trend of ${subject}` : `Tendencia suavizada de ${subject}`;
    } else {
      titleHead = isEn ? `Current ${subject}` : `Dato actual de ${subject}`;
    }

    return `${titleHead} - ${source}`;
  }

  function ensureNodeSettings(node) {
    if (!node) return;
    if (!node.settings || typeof node.settings !== 'object') node.settings = {};

    if (node.role === 'data') {
      const defaultMetric = getDefaultMetricForCard(node.cardId);
      node.settings.metric = String(node.settings.metric || defaultMetric).toLowerCase();
      node.settings.transform = normalizeTransformId(node.settings.transform);
      node.settings.aggregate = normalizeAggregateId(node.settings.aggregate);

      if (node.settings.metric !== 'keyword-custom') {
        node.settings.keyword = '';
      } else {
        node.settings.keyword = sanitizeKeywordInput(node.settings.keyword || '');
      }
    }

    if (node.role === 'control' && node.cardId === 'period-control') {
      node.settings.rangeMonths = clampRangeMonths(node.settings.rangeMonths || heroState.range || 6);
    }

    if (node.role === 'control' && node.cardId === 'source-control') {
      const fallback = getDefaultSourceBlendFromCache();
      const parsed = parseSourceBlendFromText(node.value || '', fallback);
      node.settings.sourceBlend = normalizeSourceBlend(node.settings.sourceBlend || parsed || fallback);
    }

    if (node.role === 'style' && node.cardId === 'style-depth') {
      node.settings.styleDepth = normalizeStyleDepthSettings(node.settings.styleDepth);
    }

    if (node.role === 'style' && node.cardId === 'style-color') {
      node.settings.styleColor = normalizeStyleColorSettings(node.settings.styleColor);
    }

    if (node.role === 'style' && node.cardId === 'style-3d') {
      node.settings.style3d = normalizeStyleThreeDSettings(node.settings.style3d);
    }
  }

  function resolveMetricForNode(node) {
    ensureNodeSettings(node);
    return String(node?.settings?.metric || getDefaultMetricForCard(node?.cardId)).toLowerCase();
  }

  function getMetricContextMemoKey(range = heroState.range || 6, sourceBlend = SOURCE_DEFAULT_BLEND) {
    const normalizedBlend = normalizeSourceBlend(sourceBlend || SOURCE_DEFAULT_BLEND);
    return [
      scienceCacheRevision,
      clampRangeMonths(range),
      normalizedBlend.arxiv,
      normalizedBlend.journal,
      normalizedBlend.nasa
    ].join('|');
  }

  function pushMetricContextMemo(cacheKey, context) {
    if (!cacheKey || !context) return;
    if (metricContextMemo.size >= METRIC_CONTEXT_MEMO_LIMIT) {
      const oldestKey = metricContextMemo.keys().next().value;
      if (oldestKey) metricContextMemo.delete(oldestKey);
    }
    metricContextMemo.set(cacheKey, context);
  }

  function buildMetricContext(range = heroState.range || 6, sourceBlend = SOURCE_DEFAULT_BLEND) {
    const cacheKey = getMetricContextMemoKey(range, sourceBlend);
    if (cacheKey && metricContextMemo.has(cacheKey)) {
      metricContextMemoStats.hits += 1;
      return metricContextMemo.get(cacheKey) || null;
    }
    metricContextMemoStats.misses += 1;

    const arxivData = scienceCache.arxiv || heroState.data;
    const normalizedBlend = normalizeSourceBlend(sourceBlend || SOURCE_DEFAULT_BLEND);

    let months = [];
    let rawSeries = {};

    if (arxivData) {
      const maxRange = Array.isArray(arxivData.months) && arxivData.months.length
        ? Math.min(clampRangeMonths(range), arxivData.months.length)
        : clampRangeMonths(range);
      const built = buildSeries(arxivData, maxRange);
      months = built.months;
      rawSeries = built.series;
    }

    if (!months.length) {
      months = buildMonthKeys(Date.now(), clampRangeMonths(range));
      GROUP_ORDER.forEach((id) => {
        rawSeries[id] = months.map(() => 0);
      });
    }

    const monthSet = new Set(months);
    const arxivTotals = months.map((_, idx) => GROUP_ORDER.reduce((sum, id) => sum + (rawSeries[id]?.[idx] || 0), 0));

    const journalMonthlyRawMap = Object.fromEntries(months.map((month) => [month, 0]));
    (scienceCache.journalPosts || []).forEach((post) => {
      const month = monthKeyFromIso(post?.date);
      if (monthSet.has(month)) journalMonthlyRawMap[month] += 1;
    });
    const journalMonthlyRaw = months.map((month) => journalMonthlyRawMap[month] || 0);

    const sumArxiv = arxivTotals.reduce((sum, value) => sum + value, 0);
    const avgArxiv = arxivTotals.length ? (sumArxiv / arxivTotals.length) : 0;
    const sumJournalRaw = journalMonthlyRaw.reduce((sum, value) => sum + value, 0);
    const journalScale = sumJournalRaw ? (sumArxiv / sumJournalRaw) * 0.62 : 0;
    const journalSeries = journalMonthlyRaw.map((value) => value * journalScale);

    const apodMonth = monthKeyFromIso(scienceCache.apod?.date || '');
    const nasaPulse = avgArxiv > 0 ? avgArxiv * 0.52 : 0;
    const nasaSeries = months.map((month) => (month === apodMonth ? nasaPulse : 0));

    const arxivWeight = normalizedBlend.arxiv / 100;
    const journalWeight = normalizedBlend.journal / 100;
    const nasaWeight = normalizedBlend.nasa / 100;

    const series = {};
    GROUP_ORDER.forEach((id) => {
      const journalProfile = JOURNAL_SOURCE_PROFILE[id] || 0;
      const nasaProfile = NASA_SOURCE_PROFILE[id] || 0;
      series[id] = months.map((_, idx) => {
        const arxivComponent = (rawSeries[id]?.[idx] || 0) * arxivWeight;
        const journalComponent = journalSeries[idx] * journalWeight * journalProfile;
        const nasaComponent = nasaSeries[idx] * nasaWeight * nasaProfile;
        return arxivComponent + journalComponent + nasaComponent;
      });
    });

    const items = getArxivItemsInMonths(arxivData?.items || [], months);
    const topKeyword = extractTopKeyword(items);

    const context = {
      months,
      series,
      items,
      topKeyword,
      sourceBlend: normalizedBlend,
      sourceMonthly: {
        arxiv: arxivTotals.map((value) => value * arxivWeight),
        journal: journalSeries.map((value) => value * journalWeight),
        nasa: nasaSeries.map((value) => value * nasaWeight)
      }
    };

    if (cacheKey) pushMetricContextMemo(cacheKey, context);
    return context;
  }

  function buildMetricSeries(metricId, context, keywordHint = '') {
    const metric = String(metricId || '').toLowerCase();
    const months = context?.months || [];
    const series = context?.series || {};
    const items = context?.items || [];
    const topKeywordToken = context?.topKeyword?.token || '';
    const blend = normalizeSourceBlend(context?.sourceBlend || SOURCE_DEFAULT_BLEND);

    const empty = months.map(() => 0);

    if (metric === 'total') {
      return {
        label: getMetricLabel(metric),
        values: months.map((_, idx) => GROUP_ORDER.reduce((sum, id) => sum + (series[id]?.[idx] || 0), 0))
      };
    }

    if (metric.startsWith('group:')) {
      const groupId = metric.split(':')[1] || '';
      return {
        label: getMetricLabel(metric),
        values: Array.isArray(series[groupId]) ? series[groupId].slice() : empty
      };
    }

    if (metric === 'keyword-top') {
      const rawValues = buildKeywordMonthlySeries(items, months, topKeywordToken);
      const scale = Math.max(0.15, (blend.arxiv / 100) + (blend.journal / 100) * 0.45 + (blend.nasa / 100) * 0.25);
      return {
        label: getMetricLabel(metric),
        values: rawValues.map((value) => Math.round(value * scale)),
        keywordUsed: topKeywordToken
      };
    }

    if (metric === 'keyword-custom') {
      const keyword = sanitizeKeywordInput(keywordHint) || topKeywordToken;
      const rawValues = buildKeywordMonthlySeries(items, months, keyword);
      const scale = Math.max(0.15, (blend.arxiv / 100) + (blend.journal / 100) * 0.45 + (blend.nasa / 100) * 0.25);
      return {
        label: getMetricLabel(metric, keyword),
        values: rawValues.map((value) => Math.round(value * scale)),
        keywordUsed: keyword
      };
    }

    if (metric === 'apod-words') {
      const values = empty.slice();
      if (values.length) {
        const apodWords = countWords(scienceCache.apod?.explanation || '');
        const lastIdx = values.length - 1;
        const sourceMonthly = context?.sourceMonthly || {};
        const journalSupport = Number(sourceMonthly?.journal?.[lastIdx] || 0);
        const arxivSupport = Number(sourceMonthly?.arxiv?.[lastIdx] || 0);
        const nasaWeight = blend.nasa / 100;
        const mixed = apodWords * Math.max(0.2, nasaWeight)
          + journalSupport * (blend.journal / 100) * 3
          + arxivSupport * (blend.arxiv / 100) * 0.02;
        values[lastIdx] = Math.round(mixed);
      }
      return {
        label: getMetricLabel(metric),
        values
      };
    }

    return {
      label: getMetricLabel('total'),
      values: months.map((_, idx) => GROUP_ORDER.reduce((sum, id) => sum + (series[id]?.[idx] || 0), 0))
    };
  }


  function updateNodeMetricSnapshot(node, rangeHint = heroState.range || 6, options = null) {
    if (!node) return;

    ensureNodeSettings(node);

    if (node.role === 'control' && node.cardId === 'period-control') {
      const range = clampRangeMonths(node.settings.rangeMonths || rangeHint || 6);
      node.settings.rangeMonths = range;
      node.value = formatRangeMonthsLabel(range);
      node.note = isEn ? 'Controls timespan for linked chart' : 'Controla la ventana temporal del grafico enlazado';
      return;
    }

    if (node.role === 'control' && node.cardId === 'source-control') {
      const blend = getNodeSourceBlend(node);
      node.settings.sourceBlend = blend;
      node.value = formatSourceBlendText(blend);
      node.note = isEn ? 'Calibrates source weighting for linked chart' : 'Calibra el peso por fuente para el grafico enlazado';
      return;
    }

    if (node.role === 'style' && node.cardId === 'style-depth') {
      const styleDepth = normalizeStyleDepthSettings(node.settings.styleDepth);
      node.settings.styleDepth = styleDepth;
      node.value = formatStyleDepthValue(styleDepth);
      node.note = isEn
        ? 'Adjusts visual depth, line weight and glow in linked charts'
        : 'Ajusta profundidad visual, grosor de linea y glow en graficos enlazados';
      return;
    }

    if (node.role === 'style' && node.cardId === 'style-color') {
      const styleColor = normalizeStyleColorSettings(node.settings.styleColor);
      node.settings.styleColor = styleColor;
      node.value = formatStyleColorValue(styleColor);
      node.note = isEn
        ? 'Controls palette and contrast for linked chart rendering'
        : 'Controla paleta y contraste del render en graficos enlazados';
      return;
    }

    if (node.role === 'style' && node.cardId === 'style-3d') {
      const styleThreeD = normalizeStyleThreeDSettings(node.settings.style3d);
      node.settings.style3d = styleThreeD;
      node.value = formatStyleThreeDValue(styleThreeD);
      node.note = isEn
        ? 'Applies hero-like tridimensional relief across linked charts'
        : 'Aplica relieve tridimensional tipo hero en los graficos enlazados';
      return;
    }

    if (node.role !== 'data') return;

    let effectiveRange = rangeHint;
    let sourceBlend = SOURCE_DEFAULT_BLEND;

    if (node.attachedTo) {
      const attachedChart = getNodeById(node.attachedTo);
      if (attachedChart && attachedChart.role === 'chart') {
        effectiveRange = getChartRange(attachedChart);
        sourceBlend = getChartSourceBlend(attachedChart);
      }
    }

    const context = options?.context || buildMetricContext(effectiveRange, options?.sourceBlend || sourceBlend);
    const metric = resolveMetricForNode(node);
    const keyword = node.settings.keyword || '';
    const metricSeries = buildMetricSeries(metric, context, keyword);

    if (metric === 'keyword-custom') {
      node.settings.keyword = sanitizeKeywordInput(metricSeries.keywordUsed || keyword || '');
    }

    const transform = normalizeTransformId(node.settings.transform);
    const aggregate = normalizeAggregateId(node.settings.aggregate);
    const transformedValues = applySeriesTransform(metricSeries.values || [], transform);
    const aggregateValue = computeSeriesAggregate(transformedValues, aggregate);
    const titleKeyword = metricSeries.keywordUsed || node.settings.keyword || '';

    node.value = formatAggregateOutput(aggregate, aggregateValue);
    node.title = composeDataNodeTitle(metric, transform, aggregate, titleKeyword);
    node.note = '';
  }

  function renderNodeCustomizer(node, mode = 'body') {
    if (!node || node.role === 'chart') return '';
    ensureNodeSettings(node);

    const isPopover = mode === 'popover';
    const isInspector = mode === 'inspector';
    const className = `node-customizer${isPopover ? ' is-popover' : ''}${isInspector ? ' is-inspector' : ''}`;

    if (node.role === 'data') {
      const metric = resolveMetricForNode(node);
      const transform = normalizeTransformId(node.settings.transform);
      const aggregate = normalizeAggregateId(node.settings.aggregate);
      const keyword = escapeHtml(node.settings.keyword || '');

      const metricOptions = getDataMetricOptions().map((option) => {
        const selected = option.id === metric ? ' selected' : '';
        return `<option value="${escapeHtml(option.id)}"${selected}>${escapeHtml(option.label)}</option>`;
      });

      const transformOptions = getDataTransformOptions().map((option) => {
        const selected = option.id === transform ? ' selected' : '';
        return `<option value="${escapeHtml(option.id)}"${selected}>${escapeHtml(option.label)}</option>`;
      }).join('');

      const aggregateOptions = getAggregateOptions().map((option) => {
        const selected = option.id === aggregate ? ' selected' : '';
        return `<option value="${escapeHtml(option.id)}"${selected}>${escapeHtml(option.label)}</option>`;
      }).join('');

      const keywordField = metric === 'keyword-custom'
        ? `
          <div class="node-customizer-row">
            <label>${isEn ? 'Keyword' : 'Keyword'}</label>
            <input type="text" data-node-keyword="${node.uid}" value="${keyword}" placeholder="${isEn ? 'e.g. transformer' : 'ej. transformer'}" maxlength="32" />
          </div>
        `
        : '';

      return `
        <div class="${className}" data-node-customizer>
          <div class="node-customizer-row">
            <label>${isEn ? 'Data series' : 'Serie de datos'}</label>
            <select data-node-metric="${node.uid}">${metricOptions}</select>
          </div>
          <div class="node-customizer-row">
            <label>${isEn ? 'Transform' : 'Transformacion'}</label>
            <select data-node-transform="${node.uid}">${transformOptions}</select>
          </div>
          <div class="node-customizer-row">
            <label>${isEn ? 'Summary value' : 'Valor resumen'}</label>
            <select data-node-agg="${node.uid}">${aggregateOptions}</select>
          </div>
          ${keywordField}
        </div>
      `;
    }

    if (node.role === 'control' && node.cardId === 'period-control') {
      const current = clampRangeMonths(node.settings.rangeMonths || heroState.range || 6);
      const options = RANGE_OPTIONS.map((range) => {
        const selected = range === current ? ' selected' : '';
        return `<option value="${range}"${selected}>${formatRangeMonthsLabel(range)}</option>`;
      }).join('');

      return `
        <div class="${className}" data-node-customizer>
          <div class="node-customizer-row">
            <label>${isEn ? 'Window' : 'Ventana'}</label>
            <select data-node-range="${node.uid}">${options}</select>
          </div>
        </div>
      `;
    }

    if (node.role === 'control' && node.cardId === 'source-control') {
      const blend = getNodeSourceBlend(node);
      const sliderRows = SOURCE_KEYS.map((key) => {
        const label = SOURCE_LABELS[key] || key;
        const value = Number(blend[key] || 0);
        return `
          <label class="node-source-row">
            <span class="node-source-label">${label}</span>
            <input type="range" min="0" max="100" step="1" value="${value}" data-node-source="${node.uid}" data-source-key="${key}" />
            <span class="node-source-value">${value}%</span>
          </label>
        `;
      }).join('');

      return `
        <div class="${className}" data-node-customizer>
          <div class="node-customizer-row">
            <label>${isEn ? 'Source weights' : 'Pesos por fuente'}</label>
            <div class="node-source-grid">${sliderRows}</div>
          </div>
        </div>
      `;
    }

    if (node.role === 'style' && node.cardId === 'style-depth') {
      const styleDepth = normalizeStyleDepthSettings(node.settings.styleDepth);
      const depth = Number(styleDepth.depth || 0);
      const glow = Number(styleDepth.glow || 0);

      return `
        <div class="${className}" data-node-customizer>
          <div class="node-customizer-row">
            <label>${isEn ? 'Depth and glow' : 'Profundidad y glow'}</label>
            <div class="node-source-grid node-style-grid">
              <label class="node-source-row node-style-row">
                <span class="node-source-label">${isEn ? 'Depth' : 'Profundidad'}</span>
                <input type="range" min="0" max="100" step="1" value="${depth}" data-node-style-depth="${node.uid}" />
                <span class="node-source-value">${depth}%</span>
              </label>
              <label class="node-source-row node-style-row">
                <span class="node-source-label">Glow</span>
                <input type="range" min="0" max="100" step="1" value="${glow}" data-node-style-glow="${node.uid}" />
                <span class="node-source-value">${glow}%</span>
              </label>
            </div>
          </div>
        </div>
      `;
    }

    if (node.role === 'style' && node.cardId === 'style-color') {
      const styleColor = normalizeStyleColorSettings(node.settings.styleColor);
      const contrast = Number(styleColor.contrast || 0);
      const paletteOptions = getStylePaletteOptions().map((option) => {
        const selected = option.id === styleColor.palette ? ' selected' : '';
        return `<option value="${escapeHtml(option.id)}"${selected}>${escapeHtml(option.label)}</option>`;
      }).join('');

      return `
        <div class="${className}" data-node-customizer>
          <div class="node-customizer-row">
            <label>${isEn ? 'Palette' : 'Paleta'}</label>
            <select data-node-style-palette="${node.uid}">${paletteOptions}</select>
          </div>
          <div class="node-customizer-row">
            <label>${isEn ? 'Contrast' : 'Contraste'}</label>
            <div class="node-source-grid node-style-grid">
              <label class="node-source-row node-style-row">
                <span class="node-source-label">${isEn ? 'Intensity' : 'Intensidad'}</span>
                <input type="range" min="0" max="100" step="1" value="${contrast}" data-node-style-contrast="${node.uid}" />
                <span class="node-source-value">${contrast}%</span>
              </label>
            </div>
          </div>
        </div>
      `;
    }

    if (node.role === 'style' && node.cardId === 'style-3d') {
      const styleThreeD = normalizeStyleThreeDSettings(node.settings.style3d);
      const relief = Number(styleThreeD.relief || 0);
      const softness = Number(styleThreeD.softness || 0);

      return `
        <div class="${className}" data-node-customizer>
          <div class="node-customizer-row">
            <label>${isEn ? 'Tridimensionality' : 'Tridimensionalidad'}</label>
            <div class="node-source-grid node-style-grid">
              <label class="node-source-row node-style-row">
                <span class="node-source-label">${isEn ? 'Relief' : 'Relieve'}</span>
                <input type="range" min="0" max="100" step="1" value="${relief}" data-node-style-3d-relief="${node.uid}" />
                <span class="node-source-value">${relief}%</span>
              </label>
              <label class="node-source-row node-style-row">
                <span class="node-source-label">${isEn ? 'Softness' : 'Suavidad'}</span>
                <input type="range" min="0" max="100" step="1" value="${softness}" data-node-style-3d-softness="${node.uid}" />
                <span class="node-source-value">${softness}%</span>
              </label>
            </div>
          </div>
        </div>
      `;
    }

    return '';
  }

  function getShortMetricLabel(node) {
    if (!node || node.role !== 'data') return '';
    const metric = resolveMetricForNode(node);
    const keyword = node.settings?.keyword || '';
    const label = getMetricLabel(metric, keyword);

    if (metric.startsWith('group:')) {
      const groupId = metric.split(':')[1] || '';
      return GROUP_LABELS[groupId] || label;
    }

    if (metric === 'keyword-custom' && keyword) {
      return `${isEn ? 'Keyword' : 'Keyword'}: ${keyword}`;
    }

    return label;
  }

  function getShortTransformLabel(node) {
    if (!node || node.role !== 'data') return '';
    return getTransformLabel(node.settings?.transform || 'raw');
  }

  function getShortAggregateLabel(node) {
    if (!node || node.role !== 'data') return '';
    return getAggregateLabel(node.settings?.aggregate || 'last');
  }

  function getDeckCardTemplate(deckId, cardId) {
    const deck = getDeckById(deckId);
    if (!deck || !Array.isArray(deck.cards)) return null;
    return deck.cards.find((card) => card.id === cardId) || null;
  }

  function updateDeckCardTemplate(deckId, cardId, updates) {
    const card = getDeckCardTemplate(deckId, cardId);
    if (!card || !updates || typeof updates !== 'object') return;
    if (updates.title) card.title = updates.title;
    if (updates.value !== undefined) card.value = String(updates.value);
    if (updates.note !== undefined) card.note = String(updates.note);
  }

  function getChartKindFromCard(node) {
    const cardId = String(node?.cardId || '').toLowerCase();
    const title = String(node?.title || '').toLowerCase();
    if (cardId.includes('radar') || title.includes('radar')) return 'radar';
    if (cardId.includes('heatmap') || title.includes('heatmap') || title.includes('calor')) return 'heatmap';
    return 'line';
  }

  function getChartLinkedNodes(chartNode, slot) {
    if (!chartNode?.links?.[slot]?.length) return [];
    return chartNode.links[slot]
      .map((nodeId) => getNodeById(nodeId))
      .filter(Boolean);
  }

  function getChartRange(chartNode) {
    const controls = getChartLinkedNodes(chartNode, 'top');
    const periodNode = controls.find((node) => node.cardId === 'period-control');

    if (periodNode) {
      ensureNodeSettings(periodNode);
      if (periodNode.settings?.rangeMonths) {
        return clampRangeMonths(periodNode.settings.rangeMonths);
      }

      const match = String(periodNode.note || periodNode.value || '').match(/(\d+)/i);
      if (match) {
        const parsed = Number(match[1]);
        if (Number.isFinite(parsed)) return clampRangeMonths(parsed);
      }
    }

    return clampRangeMonths(heroState.range || 6);
  }

  function buildKeywordMonthlySeries(items, months, token) {
    if (!token || !Array.isArray(items) || !items.length || !Array.isArray(months) || !months.length) {
      return months.map(() => 0);
    }

    const monthSet = new Set(months);
    const counts = Object.fromEntries(months.map((month) => [month, 0]));
    const needle = normalizeToken(token);

    items.forEach((item) => {
      const month = monthKeyFromIso(item?.updated || item?.published);
      if (!monthSet.has(month)) return;
      const text = normalizeToken(`${safeText(item?.title)} ${safeText(item?.summary)}`);
      if (text.includes(needle)) counts[month] += 1;
    });

    return months.map((month) => counts[month] || 0);
  }

  function getChartDatasetMemoKey(chartNode) {
    if (!chartNode || chartNode.role !== 'chart') return '';

    const range = getChartRange(chartNode);
    const sourceBlend = getChartSourceBlend(chartNode);
    const inputNodes = getChartLinkedNodes(chartNode, 'left');

    const inputSignature = inputNodes.map((node) => {
      ensureNodeSettings(node);
      const metric = resolveMetricForNode(node);
      const transform = normalizeTransformId(node.settings?.transform);
      const aggregate = normalizeAggregateId(node.settings?.aggregate);
      const keyword = sanitizeKeywordInput(node.settings?.keyword || '');
      return [
        node.uid,
        node.cardId || '',
        metric,
        transform,
        aggregate,
        keyword
      ].join(':');
    }).join('|');

    return [
      scienceCacheRevision,
      chartNode.uid,
      `r${range}`,
      `sb${sourceBlend.arxiv}-${sourceBlend.journal}-${sourceBlend.nasa}`,
      inputSignature
    ].join('|');
  }

  function pushChartDatasetMemo(cacheKey, dataset) {
    if (!cacheKey || !dataset) return;
    if (chartDatasetMemo.size >= CHART_DATASET_MEMO_LIMIT) {
      const oldestKey = chartDatasetMemo.keys().next().value;
      if (oldestKey) chartDatasetMemo.delete(oldestKey);
    }
    chartDatasetMemo.set(cacheKey, dataset);
  }

  function buildChartInputDataset(chartNode) {
    if (!chartNode) return null;

    const cacheKey = getChartDatasetMemoKey(chartNode);
    if (cacheKey && chartDatasetMemo.has(cacheKey)) {
      chartDatasetMemoStats.hits += 1;
      return chartDatasetMemo.get(cacheKey) || null;
    }
    chartDatasetMemoStats.misses += 1;

    const inputNodes = getChartLinkedNodes(chartNode, 'left');
    const range = getChartRange(chartNode);
    const sourceBlend = getChartSourceBlend(chartNode);
    const context = buildMetricContext(range, sourceBlend);

    const channelColors = ['#ef5b2f', '#2f7dd1', '#16a085', '#7c5cfa', '#e74c3c', '#0ea5a6'];

    const channels = inputNodes.map((node, index) => {
      ensureNodeSettings(node);
      const metric = resolveMetricForNode(node);
      const metricSeries = buildMetricSeries(metric, context, node.settings?.keyword || '');

      if (metric === 'keyword-custom') {
        node.settings.keyword = sanitizeKeywordInput(metricSeries.keywordUsed || node.settings.keyword || '');
      }

      const transform = normalizeTransformId(node.settings.transform);
      const rawValues = Array.isArray(metricSeries.values) && metricSeries.values.length
        ? metricSeries.values
        : context.months.map(() => 0);
      const transformedValues = applySeriesTransform(rawValues, transform);

      return {
        id: node.uid,
        cardId: String(node.cardId || '').toLowerCase(),
        metric,
        transform,
        label: metricSeries.label || node.title,
        color: channelColors[index % channelColors.length],
        values: transformedValues
      };
    });

    const dataset = {
      months: context.months,
      channels,
      range,
      sourceBlend,
      context,
      inputs: inputNodes,
      controls: getChartLinkedNodes(chartNode, 'top'),
      outputs: getChartLinkedNodes(chartNode, 'right'),
      styles: getChartLinkedNodes(chartNode, 'bottom')
    };

    if (cacheKey) pushChartDatasetMemo(cacheKey, dataset);
    return dataset;
  }

  function updateOutputNodeSnapshot(node, chartNode, rangeHint = heroState.range || 6, datasetHint = null) {
    if (!node || node.role !== 'output') return;

    const cardId = String(node.cardId || '').toLowerCase();
    if (!['top-category-share', 'topic-density', 'context-output'].includes(cardId)) return;

    const chart = chartNode && chartNode.role === 'chart'
      ? chartNode
      : (node.attachedTo ? getNodeById(node.attachedTo) : null);

    const dataset = datasetHint || (chart ? buildChartInputDataset(chart) : null);
    const range = clampRangeMonths(rangeHint || getChartRange(chart) || heroState.range || 6);

    if (!dataset || !Array.isArray(dataset.channels) || !dataset.channels.length) {
      node.value = '--';
      node.note = isEn ? 'Waiting for input cards' : 'Esperando tarjetas de entrada';
      return;
    }

    const context = dataset.context || buildMetricContext(range, dataset.sourceBlend || SOURCE_DEFAULT_BLEND);
    const blend = normalizeSourceBlend(dataset.sourceBlend || context.sourceBlend || SOURCE_DEFAULT_BLEND);

    const channelTotals = dataset.channels.map((channel) => ({
      label: String(channel.label || '--'),
      total: (channel.values || []).reduce((sum, value) => sum + (Number(value) || 0), 0)
    }));

    const totalVolume = channelTotals.reduce((sum, channel) => sum + channel.total, 0);
    const leader = channelTotals.slice().sort((a, b) => b.total - a.total)[0] || { label: '--', total: 0 };

    if (cardId === 'top-category-share') {
      const share = totalVolume > 0 ? (leader.total / totalVolume) * 100 : 0;
      node.value = formatPercent(share, 1);
      node.note = `${truncate(leader.label, 30)} | ${Math.round(leader.total).toLocaleString()} / ${Math.round(totalVolume).toLocaleString()}`;
      return;
    }

    const monthSet = new Set(context.months || []);
    const categories = new Set((context.items || [])
      .map((item) => safeText(item?.primaryCategory || item?.categories?.[0]).trim())
      .filter(Boolean));

    if (cardId === 'topic-density') {
      const journalInRange = Array.isArray(scienceCache.journalPosts)
        ? scienceCache.journalPosts.filter((post) => monthSet.has(monthKeyFromIso(post?.date))).length
        : 0;
      const weightedTopics = Math.max(
        dataset.channels.length,
        Math.round(
          categories.size * (blend.arxiv / 100)
          + journalInRange * (blend.journal / 100) * 0.35
          + (scienceCache.apod ? 1 : 0) * (blend.nasa / 100) * 3
        )
      );

      node.value = `${weightedTopics.toLocaleString()} ${isEn ? 'topics' : 'temas'}`;
      node.note = isEn
        ? `ArXiv ${categories.size.toLocaleString()} + Blog ${journalInRange.toLocaleString()}`
        : `ArXiv ${categories.size.toLocaleString()} + Blog ${journalInRange.toLocaleString()}`;
      return;
    }

    const apodTokens = (normalizeToken(`${safeText(scienceCache.apod?.title)} ${safeText(scienceCache.apod?.explanation)}`)
      .match(/[a-z][a-z0-9-]{3,}/g) || [])
      .filter((token, index, arr) => !KEYWORD_STOPWORDS.has(token) && arr.indexOf(token) === index)
      .slice(0, 8);

    const arxivHits = apodTokens.length
      ? (context.items || []).filter((item) => {
        const haystack = normalizeToken(`${safeText(item?.title)} ${safeText(item?.summary)}`);
        return apodTokens.some((token) => haystack.includes(token));
      }).length
      : 0;

    const journalHits = apodTokens.length
      ? (scienceCache.journalPosts || []).filter((post) => {
        if (!monthSet.has(monthKeyFromIso(post?.date))) return false;
        const haystack = normalizeToken(`${safeText(post?.title)} ${safeText(post?.section)} ${safeText(post?.summary)}`);
        return apodTokens.some((token) => haystack.includes(token));
      }).length
      : 0;

    const weightedMatches = Math.round(
      arxivHits * (blend.arxiv / 100)
      + journalHits * (blend.journal / 100)
      + (apodTokens.length ? 6 * (blend.nasa / 100) : 0)
    );

    node.value = `${weightedMatches.toLocaleString()} ${isEn ? 'matches' : 'coincidencias'}`;
    node.note = isEn
      ? `ArXiv ${arxivHits.toLocaleString()} | Blog ${journalHits.toLocaleString()}`
      : `ArXiv ${arxivHits.toLocaleString()} | Blog ${journalHits.toLocaleString()}`;
  }

  function buildBoardLinePreviewSvg(dataset, styleConfig = null) {
    const width = 260;
    const height = 96;
    const padLeft = 30;
    const padRight = 8;
    const padTop = 8;
    const padBottom = 20;
    const innerW = width - padLeft - padRight;
    const innerH = height - padTop - padBottom;

    const visualStyle = styleConfig || createDefaultChartStyleConfig();
    const relief = clampNumber(Number(visualStyle.threeDRelief || 0), 0, 1);
    const softness = clampNumber(Number(visualStyle.threeDSoftness || 0.58), 0, 1);
    const lineWidth = Math.max(1.2, Number(visualStyle.lineWidth || 2));
    const glowStrength = clampNumber(Number(visualStyle.lineGlowStrength || 0), 0, 1.6);
    const lineDepthOffset = clampNumber(Number(visualStyle.lineDepthOffset || (0.35 + relief * 2.45)), 0.15, 3.2);
    const lineShadowOpacity = clampNumber(Number(visualStyle.lineShadowOpacity || (0.05 + relief * 0.18)), 0.02, 0.38);
    const lineHighlightOpacity = clampNumber(Number(visualStyle.lineHighlightOpacity || (0.04 + softness * 0.16)), 0.02, 0.34);
    const areaShadowOpacity = clampNumber(Number(visualStyle.lineAreaShadowOpacity || (0.03 + relief * 0.14)), 0.02, 0.28);
    const areaOpacity = clampNumber(Number(visualStyle.areaOpacity || 0.2), 0.05, 0.56);
    const areaTint = Array.isArray(visualStyle.areaTint) && visualStyle.areaTint.length === 3
      ? visualStyle.areaTint
      : [239, 91, 47];

    const max = Math.max(1, ...dataset.channels.flatMap((channel) => channel.values));
    const step = dataset.months.length > 1 ? innerW / (dataset.months.length - 1) : innerW;
    const xFor = (i) => padLeft + step * i;
    const yFor = (v) => padTop + innerH - (v / max) * innerH;
    const yBase = padTop + innerH;

    const formatTick = (value) => {
      const numeric = Number(value) || 0;
      const abs = Math.abs(numeric);
      if (abs >= 1000) {
        const compact = abs >= 10000 ? (numeric / 1000).toFixed(0) : (numeric / 1000).toFixed(1);
        return `${compact.replace(/\.0$/, '')}k`;
      }
      return Math.round(numeric).toLocaleString();
    };

    const ticks = [0, 0.25, 0.5, 0.75, 1].map((level) => {
      const y = yFor(max * level);
      return `<line x1="${padLeft}" y1="${y.toFixed(2)}" x2="${(padLeft + innerW).toFixed(2)}" y2="${y.toFixed(2)}" />`;
    }).join('');

    const yLabels = [0, 0.5, 1].map((level) => {
      const y = yFor(max * level);
      return `<text class="cp-tick-label cp-tick-label-y" x="${(padLeft - 4).toFixed(2)}" y="${y.toFixed(2)}" text-anchor="end">${escapeHtml(formatTick(max * level))}</text>`;
    }).join('');

    const monthCount = dataset.months.length;
    const xLabelIndexes = monthCount > 1
      ? [0, Math.floor((monthCount - 1) / 2), monthCount - 1]
      : [0];
    const uniqueXIndexes = Array.from(new Set(xLabelIndexes))
      .filter((idx) => idx >= 0 && idx < monthCount);

    const xLabels = uniqueXIndexes.map((idx, position) => {
      const anchor = position === 0 ? 'start' : (position === uniqueXIndexes.length - 1 ? 'end' : 'middle');
      const label = formatMonthLabel(dataset.months[idx] || '');
      return `<text class="cp-tick-label cp-tick-label-x" x="${xFor(idx).toFixed(2)}" y="${(yBase + 5).toFixed(2)}" text-anchor="${anchor}">${escapeHtml(label)}</text>`;
    }).join('');

    const first = dataset.channels[0];
    const firstPath = first.values.map((value, idx) => `${idx === 0 ? 'M' : 'L'} ${xFor(idx).toFixed(2)} ${yFor(value).toFixed(2)}`).join(' ');
    const firstShadowPath = first.values.map((value, idx) => `${idx === 0 ? 'M' : 'L'} ${xFor(idx).toFixed(2)} ${(yFor(value) + lineDepthOffset).toFixed(2)}`).join(' ');
    const area = `${firstPath} L ${(padLeft + innerW).toFixed(2)} ${yBase.toFixed(2)} L ${padLeft.toFixed(2)} ${yBase.toFixed(2)} Z`;
    const areaShadow = `${firstShadowPath} L ${(padLeft + innerW).toFixed(2)} ${(yBase + lineDepthOffset).toFixed(2)} L ${padLeft.toFixed(2)} ${(yBase + lineDepthOffset).toFixed(2)} Z`;

    const lines = dataset.channels.map((channel) => {
      const path = channel.values.map((value, idx) => `${idx === 0 ? 'M' : 'L'} ${xFor(idx).toFixed(2)} ${yFor(value).toFixed(2)}`).join(' ');
      return `<path class="cp-line" style="--cp-color:${channel.color};stroke-width:${lineWidth.toFixed(2)};stroke-opacity:0.98" d="${path}" />`;
    }).join('');

    const depthLines = dataset.channels.map((channel) => {
      const path = channel.values.map((value, idx) => `${idx === 0 ? 'M' : 'L'} ${xFor(idx).toFixed(2)} ${(yFor(value) + lineDepthOffset).toFixed(2)}`).join(' ');
      const depthWidth = lineWidth + 0.7 + relief * 1.2;
      return `<path d="${path}" fill="none" stroke="rgba(15,23,42,${lineShadowOpacity.toFixed(3)})" stroke-width="${depthWidth.toFixed(2)}" stroke-linecap="round" stroke-linejoin="round" />`;
    }).join('');

    const highlightLines = dataset.channels.map((channel) => {
      const path = channel.values.map((value, idx) => `${idx === 0 ? 'M' : 'L'} ${xFor(idx).toFixed(2)} ${(yFor(value) - lineDepthOffset * 0.32).toFixed(2)}`).join(' ');
      const highlightWidth = Math.max(0.6, lineWidth - 0.55);
      return `<path d="${path}" fill="none" stroke="rgba(255,255,255,${lineHighlightOpacity.toFixed(3)})" stroke-width="${highlightWidth.toFixed(2)}" stroke-linecap="round" stroke-linejoin="round" />`;
    }).join('');

    const glowLines = glowStrength > 0.01
      ? dataset.channels.map((channel) => {
          const path = channel.values.map((value, idx) => `${idx === 0 ? 'M' : 'L'} ${xFor(idx).toFixed(2)} ${yFor(value).toFixed(2)}`).join(' ');
          const glowWidth = lineWidth + 1.3 + glowStrength * 2.5;
          const glowOpacity = 0.05 + glowStrength * 0.24;
          return `<path d="${path}" fill="none" stroke="${channel.color}" stroke-width="${glowWidth.toFixed(2)}" stroke-opacity="${glowOpacity.toFixed(3)}" stroke-linecap="round" stroke-linejoin="round" />`;
        }).join('')
      : '';

    const areaFill = `rgba(${areaTint[0]},${areaTint[1]},${areaTint[2]},${areaOpacity.toFixed(3)})`;

    return `
      <svg class="chart-preview-svg chart-preview-svg-line" viewBox="0 0 ${width} ${height}" role="img" aria-label="Line preview">
        <g class="cp-grid">${ticks}</g>
        <g class="cp-axes">
          <line class="cp-axis" x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${yBase.toFixed(2)}" />
          <line class="cp-axis" x1="${padLeft}" y1="${yBase.toFixed(2)}" x2="${(padLeft + innerW).toFixed(2)}" y2="${yBase.toFixed(2)}" />
        </g>
        <g class="cp-ticks">${yLabels}${xLabels}</g>
        <path class="cp-area" style="fill:rgba(2,6,23,${areaShadowOpacity.toFixed(3)})" d="${areaShadow}" />
        <path class="cp-area" style="fill:${areaFill}" d="${area}" />
        <g class="cp-lines-depth">${depthLines}</g>
        <g class="cp-lines-glow">${glowLines}</g>
        ${lines}
        <g class="cp-lines-highlight">${highlightLines}</g>
      </svg>
    `;
  }

  function buildBoardRadarPreviewSvg(dataset, styleConfig = null) {
    const width = 260;
    const height = 96;
    const cx = width / 2;
    const cy = height / 2 + 3;
    const radius = 35;

    const visualStyle = styleConfig || createDefaultChartStyleConfig();
    const relief = clampNumber(Number(visualStyle.threeDRelief || 0), 0, 1);
    const softness = clampNumber(Number(visualStyle.threeDSoftness || 0.58), 0, 1);
    const radarDepth = clampNumber(Number(visualStyle.radarDepth || 0.4), 0.05, 1.65);
    const radarShadow = clampNumber(Number(visualStyle.radarShadow || 0.16), 0.04, 1.45);
    const floorOffset = clampNumber(Number(visualStyle.radarFloorOffset || (0.75 + relief * 3.2)), 0.4, 4.3);
    const highlightLift = clampNumber(Number(visualStyle.radarHighlightLift || (0.28 + softness * 1.65)), 0.2, 2.4);
    const polygonShadowOpacity = clampNumber(Number(visualStyle.radarPolygonShadowOpacity || (0.06 + relief * 0.22)), 0.04, 0.34);
    const polygonHighlightOpacity = clampNumber(Number(visualStyle.radarPolygonHighlightOpacity || (0.04 + softness * 0.24)), 0.03, 0.34);
    const areaTint = Array.isArray(visualStyle.areaTint) && visualStyle.areaTint.length === 3
      ? visualStyle.areaTint
      : [239, 91, 47];

    const channels = dataset.channels.slice(0, 6);
    const totals = channels.map((channel) => ({
      label: channel.label,
      color: channel.color,
      value: channel.values.reduce((sum, value) => sum + value, 0)
    }));

    const max = Math.max(1, ...totals.map((entry) => entry.value));
    const ringLevels = [0.25, 0.5, 0.75, 1];
    const formatTick = (value) => {
      const numeric = Number(value) || 0;
      const abs = Math.abs(numeric);
      if (abs >= 1000) {
        const compact = abs >= 10000 ? (numeric / 1000).toFixed(0) : (numeric / 1000).toFixed(1);
        return `${compact.replace(/\.0$/, '')}k`;
      }
      return Math.round(numeric).toLocaleString();
    };

    const rings = ringLevels.map((level) => {
      const r = radius * level;
      const shadowOpacity = (0.025 + radarShadow * 0.24 + relief * 0.07) * level;
      const highlightOpacity = (0.055 + radarDepth * 0.13 + softness * 0.06) * level;
      const strokeWidth = 0.8 + radarDepth * 0.95 * level;
      const shadowY = cy + floorOffset * level;
      const highlightY = cy - highlightLift * level;
      return `
        <circle cx="${cx}" cy="${shadowY.toFixed(2)}" r="${r.toFixed(2)}" style="opacity:${shadowOpacity.toFixed(3)};stroke-width:${(strokeWidth + 0.45).toFixed(2)}" />
        <circle cx="${cx}" cy="${cy}" r="${r.toFixed(2)}" style="stroke-width:${strokeWidth.toFixed(2)}" />
        <circle cx="${cx}" cy="${highlightY.toFixed(2)}" r="${r.toFixed(2)}" style="opacity:${highlightOpacity.toFixed(3)};stroke-width:${(strokeWidth - 0.18).toFixed(2)}" />
      `;
    }).join('');

    const axes = totals.map((_, idx) => {
      const angle = (Math.PI * 2 * idx) / totals.length - Math.PI / 2;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(2)}" y2="${y.toFixed(2)}" />`;
    }).join('');

    const points = totals.map((entry, idx) => {
      const angle = (Math.PI * 2 * idx) / totals.length - Math.PI / 2;
      const r = (entry.value / max) * radius;
      return {
        color: entry.color,
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r
      };
    });

    const scaleLabelX = cx + radius + 7;
    const scaleGuideX1 = cx + 3;
    const scaleGuideX2 = scaleLabelX - 3;
    const scaleLevels = [1, 0.75, 0.5, 0.25, 0];

    const scaleGuides = scaleLevels.map((level) => {
      const y = cy - radius * level;
      return `<line x1="${scaleGuideX1.toFixed(2)}" y1="${y.toFixed(2)}" x2="${scaleGuideX2.toFixed(2)}" y2="${y.toFixed(2)}" />`;
    }).join('');

    const scaleLabels = scaleLevels.map((level) => {
      const y = cy - radius * level;
      const value = formatTick(max * level);
      return `<text class="cp-tick-label cp-radar-level" x="${scaleLabelX.toFixed(2)}" y="${y.toFixed(2)}" text-anchor="start">${escapeHtml(value)}</text>`;
    }).join('');

    const polygon = points.map((point) => `${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
    const polygonShadow = points.map((point) => `${point.x.toFixed(2)} ${(point.y + floorOffset * 0.42).toFixed(2)}`).join(' ');
    const polygonHighlight = points.map((point) => `${point.x.toFixed(2)} ${(point.y - highlightLift * 0.28).toFixed(2)}`).join(' ');
    const dotRadius = (2.1 + radarDepth * 1.0).toFixed(2);
    const dots = points.map((point) => `<circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="${dotRadius}" fill="${point.color}" />`).join('');

    const fillOpacity = clampNumber(0.08 + radarDepth * 0.2 + relief * 0.08, 0.06, 0.42);
    const lineWidth = 1.35 + radarDepth * 1.45;
    const fillColor = `rgba(${areaTint[0]},${areaTint[1]},${areaTint[2]},${fillOpacity.toFixed(3)})`;

    return `
      <svg class="chart-preview-svg chart-preview-svg-radar" viewBox="0 0 ${width} ${height}" role="img" aria-label="Radar preview">
        <ellipse cx="${cx}" cy="${(cy + floorOffset * 1.35).toFixed(2)}" rx="${(radius * 0.72).toFixed(2)}" ry="${(3.2 + relief * 2.6).toFixed(2)}" fill="rgba(15,23,42,${(0.08 + relief * 0.14).toFixed(3)})" />
        <g class="cp-grid">${rings}${axes}</g>
        <g class="cp-radar-scale">${scaleGuides}</g>
        <g class="cp-ticks">${scaleLabels}</g>
        <polygon class="cp-area" style="fill:rgba(2,6,23,${polygonShadowOpacity.toFixed(3)})" points="${polygonShadow}" />
        <polygon class="cp-area" style="fill:${fillColor}" points="${polygon}" />
        <polygon class="cp-line" style="stroke-width:${lineWidth.toFixed(2)};stroke-opacity:0.96" points="${polygon}" />
        <polygon class="cp-line" style="stroke:rgba(255,255,255,${polygonHighlightOpacity.toFixed(3)});stroke-width:${Math.max(0.7, lineWidth - 0.8).toFixed(2)}" points="${polygonHighlight}" />
        <g class="cp-points">${dots}</g>
      </svg>
    `;
  }

  function buildBoardHeatmapPreviewSvg(dataset, styleConfig = null) {
    const width = 260;
    const height = 96;
    const padLeft = 30;
    const padRight = 8;
    const padTop = 8;
    const padBottom = 20;

    const visualStyle = styleConfig || createDefaultChartStyleConfig();
    const relief = clampNumber(Number(visualStyle.threeDRelief || 0), 0, 1);
    const softness = clampNumber(Number(visualStyle.threeDSoftness || 0.58), 0, 1);
    const start = Array.isArray(visualStyle.paletteStart) && visualStyle.paletteStart.length === 3
      ? visualStyle.paletteStart
      : [37, 99, 235];
    const end = Array.isArray(visualStyle.paletteEnd) && visualStyle.paletteEnd.length === 3
      ? visualStyle.paletteEnd
      : [239, 68, 68];
    const contrast = clampNumber(Number(visualStyle.heatContrast || 1), 0.55, 1.8);
    const alphaBase = clampNumber(Number(visualStyle.heatAlphaBase || 0.22), 0.12, 0.55);
    const alphaSpan = clampNumber(Number(visualStyle.heatAlphaSpan || 0.62), 0.22, 0.78);
    const cellLift = clampNumber(Number(visualStyle.heatCellLift || (0.3 + relief * 1.55)), 0.1, 2.4);
    const cellShadowOpacity = clampNumber(Number(visualStyle.heatCellShadowOpacity || (0.05 + relief * 0.21)), 0.03, 0.34);
    const cellHighlightOpacity = clampNumber(Number(visualStyle.heatCellHighlightOpacity || (0.06 + softness * 0.2)), 0.03, 0.34);
    const cellRadiusBoost = clampNumber(Number(visualStyle.heatCellRadiusBoost || (0.2 + relief * 1.1)), 0.1, 2);

    const channels = dataset.channels.slice(0, 5);
    const months = dataset.months.slice(-6);

    const cols = Math.max(1, months.length);
    const rows = Math.max(1, channels.length);
    const innerW = width - padLeft - padRight;
    const innerH = height - padTop - padBottom;
    const cellW = innerW / cols;
    const cellH = innerH / rows;

    const values = channels.flatMap((channel) => months.map((month) => {
      const monthIdx = dataset.months.indexOf(month);
      return channel.values[monthIdx] || 0;
    }));

    const rawMax = values.length ? Math.max(...values) : 0;
    const colorMax = Math.max(1, rawMax);

    const formatTick = (value) => {
      const numeric = Number(value) || 0;
      const abs = Math.abs(numeric);
      if (abs >= 1000) {
        const compact = abs >= 10000 ? (numeric / 1000).toFixed(0) : (numeric / 1000).toFixed(1);
        return `${compact.replace(/\.0$/, '')}k`;
      }
      return Math.round(numeric).toLocaleString();
    };

    const lerp = (a, b, t) => Math.round(a + (b - a) * t);
    const colorFor = (value) => {
      const tBase = Math.min(1, Math.max(0, value / colorMax));
      const t = clampNumber(0.5 + (tBase - 0.5) * contrast, 0, 1);
      const r = lerp(start[0], end[0], t);
      const g = lerp(start[1], end[1], t);
      const b = lerp(start[2], end[2], t);
      const alpha = clampNumber(alphaBase + t * alphaSpan, 0.12, 0.96);
      return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
    };

    const yForLevel = (level) => padTop + innerH - level * innerH;
    const guides = [0, 0.5, 1].map((level) => {
      const y = yForLevel(level);
      return `<line x1="${padLeft}" y1="${y.toFixed(2)}" x2="${(padLeft + innerW).toFixed(2)}" y2="${y.toFixed(2)}" />`;
    }).join('');

    const yLabels = [0, 0.5, 1].map((level) => {
      const y = yForLevel(level);
      const value = formatTick(rawMax * level);
      return `<text class="cp-tick-label cp-tick-label-y" x="${(padLeft - 4).toFixed(2)}" y="${y.toFixed(2)}" text-anchor="end">${escapeHtml(value)}</text>`;
    }).join('');

    const monthCount = months.length;
    const xLabelIndexes = monthCount > 1
      ? [0, Math.floor((monthCount - 1) / 2), monthCount - 1]
      : [0];
    const uniqueXIndexes = Array.from(new Set(xLabelIndexes))
      .filter((idx) => idx >= 0 && idx < monthCount);

    const xLabels = uniqueXIndexes.map((idx, position) => {
      const anchor = position === 0 ? 'start' : (position === uniqueXIndexes.length - 1 ? 'end' : 'middle');
      const x = padLeft + idx * cellW + cellW / 2;
      const label = formatMonthLabel(months[idx] || '');
      return `<text class="cp-tick-label cp-tick-label-x" x="${x.toFixed(2)}" y="${(padTop + innerH + 5).toFixed(2)}" text-anchor="${anchor}">${escapeHtml(label)}</text>`;
    }).join('');

    const cells = channels.map((channel, row) => {
      return months.map((month, col) => {
        const monthIdx = dataset.months.indexOf(month);
        const value = channel.values[monthIdx] || 0;
        const x = padLeft + col * cellW;
        const y = padTop + row * cellH;
        const boxW = Math.max(2, cellW - 1);
        const boxH = Math.max(2, cellH - 1);
        const rx = clampNumber(1.8 + cellRadiusBoost, 2, 4.8);
        return `
          <g>
            <rect x="${x.toFixed(2)}" y="${(y + cellLift).toFixed(2)}" width="${boxW.toFixed(2)}" height="${boxH.toFixed(2)}" rx="${rx.toFixed(2)}" fill="rgba(15,23,42,${cellShadowOpacity.toFixed(3)})" />
            <rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${boxW.toFixed(2)}" height="${boxH.toFixed(2)}" rx="${rx.toFixed(2)}" fill="${colorFor(value)}" />
            <line x1="${(x + 0.8).toFixed(2)}" y1="${(y + 0.95).toFixed(2)}" x2="${(x + boxW - 1).toFixed(2)}" y2="${(y + 0.95).toFixed(2)}" stroke="rgba(255,255,255,${cellHighlightOpacity.toFixed(3)})" stroke-width="0.75" />
          </g>
        `;
      }).join('');
    }).join('');

    return `
      <svg class="chart-preview-svg chart-preview-svg-heatmap" viewBox="0 0 ${width} ${height}" role="img" aria-label="Heatmap preview">
        <g class="cp-grid">${guides}</g>
        <g class="cp-heat-cells">${cells}</g>
        <g class="cp-axes">
          <line class="cp-axis" x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${(padTop + innerH).toFixed(2)}" />
          <line class="cp-axis" x1="${padLeft}" y1="${(padTop + innerH).toFixed(2)}" x2="${(padLeft + innerW).toFixed(2)}" y2="${(padTop + innerH).toFixed(2)}" />
        </g>
        <g class="cp-ticks">${yLabels}${xLabels}</g>
      </svg>
    `;
  }


  function isExpandedChartLegend(chartNode) {
    const width = Number(chartNode?.w || 0);
    const height = Number(chartNode?.h || 0);
    return width >= NODE_LAYOUT.chartW + 20 || height >= NODE_LAYOUT.chartH + 22;
  }

  function buildBoardChartLegend(dataset, kind, chartNode = null, styleConfig = null) {
    if (!dataset || !Array.isArray(dataset.channels) || !dataset.channels.length) return '';

    if (kind === 'heatmap') {
      const values = dataset.channels.flatMap((channel) => (Array.isArray(channel.values) ? channel.values : []))
        .map((value) => Number(value) || 0);
      const min = values.length ? Math.min(...values) : 0;
      const max = values.length ? Math.max(...values) : 0;
      const visualStyle = styleConfig || createDefaultChartStyleConfig();
      const start = Array.isArray(visualStyle.paletteStart) && visualStyle.paletteStart.length === 3
        ? visualStyle.paletteStart
        : [37, 99, 235];
      const end = Array.isArray(visualStyle.paletteEnd) && visualStyle.paletteEnd.length === 3
        ? visualStyle.paletteEnd
        : [239, 68, 68];
      const gradientStyle = `background:linear-gradient(90deg, rgba(${start[0]},${start[1]},${start[2]},0.52), rgba(${end[0]},${end[1]},${end[2]},0.84));`;

      return `
        <div class="chart-legend chart-legend-scale" aria-label="${isEn ? 'Heatmap legend' : 'Leyenda heatmap'}">
          <span class="chart-legend-range-label">${Math.round(min).toLocaleString()}</span>
          <span class="chart-legend-scale-bar" style="${gradientStyle}" aria-hidden="true"></span>
          <span class="chart-legend-range-label">${Math.round(max).toLocaleString()}</span>
        </div>
      `;
    }

    const expanded = isExpandedChartLegend(chartNode);
    const maxItems = expanded ? dataset.channels.length : 4;
    const items = dataset.channels.slice(0, maxItems).map((channel) => {
      const fullLabel = channel.label || '--';
      const label = expanded ? fullLabel : truncate(fullLabel, 24);
      return `
        <span class="chart-legend-item" title="${escapeHtml(fullLabel)}">
          <span class="chart-legend-dot" style="--legend-color:${channel.color || '#64748b'}"></span>
          <span class="chart-legend-label">${escapeHtml(label)}</span>
        </span>
      `;
    }).join('');

    const remaining = Math.max(0, dataset.channels.length - maxItems);
    const more = !expanded && remaining
      ? `<span class="chart-legend-more">+${remaining}</span>`
      : '';

    return `<div class="chart-legend${expanded ? ' is-expanded' : ''}" aria-label="${isEn ? 'Series legend' : 'Leyenda de series'}">${items}${more}</div>`;
  }


  function getChartKindTitle(kind) {
    if (kind === 'radar') return isEn ? 'Radar chart' : 'Grafico radar';
    if (kind === 'heatmap') return isEn ? 'Heatmap chart' : 'Grafico heatmap';
    return isEn ? 'Line chart' : 'Grafico de linea';
  }

  function getDefaultChartTitle(chartNode) {
    const template = getDeckCardTemplate(chartNode?.deckId, chartNode?.cardId);
    if (template?.title) return String(template.title);
    return String(chartNode?.title || '');
  }

  function getDominantValueByCount(values, priority = []) {
    const counts = new Map();
    (Array.isArray(values) ? values : []).forEach((value) => {
      const key = String(value || '');
      if (!key) return;
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    let bestKey = '';
    let bestCount = 0;

    counts.forEach((count, key) => {
      if (count > bestCount) {
        bestKey = key;
        bestCount = count;
        return;
      }
      if (count < bestCount) return;

      const bestIdx = priority.indexOf(bestKey);
      const keyIdx = priority.indexOf(key);
      if (keyIdx !== -1 && (bestIdx === -1 || keyIdx < bestIdx)) {
        bestKey = key;
      }
    });

    return bestKey;
  }

  function getAutoTitleSummaryPhrase(inputNodes) {
    const nodes = Array.isArray(inputNodes) ? inputNodes : [];
    const aggregate = getDominantValueByCount(
      nodes.map((node) => normalizeAggregateId(node?.settings?.aggregate)),
      ['growth', 'sum', 'avg', 'max', 'last']
    ) || 'last';

    const transform = getDominantValueByCount(
      nodes.map((node) => normalizeTransformId(node?.settings?.transform)),
      ['delta', 'moving3', 'cumulative', 'raw']
    ) || 'raw';

    const aggregateLabels = isEn
      ? {
          growth: 'Monthly variation (%)',
          sum: 'Period sum',
          avg: 'Period mean',
          max: 'Period maximum',
          last: 'Period end value'
        }
      : {
          growth: 'Variacion mensual (%)',
          sum: 'Suma del periodo',
          avg: 'Media del periodo',
          max: 'Maximo del periodo',
          last: 'Valor final del periodo'
        };

    const transformLabels = isEn
      ? {
          delta: 'monthly delta',
          moving3: 'moving average (3m)',
          cumulative: 'cumulative series',
          raw: 'raw series'
        }
      : {
          delta: 'delta mensual',
          moving3: 'promedio movil (3m)',
          cumulative: 'serie acumulada',
          raw: 'serie original'
        };

    if (aggregate === 'growth') return aggregateLabels.growth;

    if (aggregate !== 'last') {
      const base = aggregateLabels[aggregate] || aggregateLabels.last;
      if (transform !== 'raw') {
        return `${base} (${transformLabels[transform] || transformLabels.raw})`;
      }
      return base;
    }

    if (transform !== 'raw') {
      return transformLabels[transform] || transformLabels.raw;
    }

    return aggregateLabels.last;
  }

  function normalizeAutoTitleSubject(subject) {
    const raw = String(subject || '').replace(/\s+/g, ' ').trim();
    if (!raw) return '';

    const lowered = raw.charAt(0).toLowerCase() + raw.slice(1);
    return lowered;
  }

  function getAutoTitleSubject(chartNode, dataset, inputNodes) {
    const nodes = Array.isArray(inputNodes) ? inputNodes : [];
    const legendMap = buildInputLegendMapForChart(chartNode);

    const groupCounts = new Map();
    legendMap.forEach((entry) => {
      const token = String(entry?.groupToken || '');
      const count = Number(entry?.groupCount || 1);
      if (!token || count < 2) return;
      groupCounts.set(token, Math.max(groupCounts.get(token) || 0, count));
    });

    let dominantGroupToken = '';
    let dominantGroupCount = 0;
    const preferredGroups = isEn
      ? ['publications', 'publication', 'papers']
      : ['publicaciones', 'publicacion', 'papers'];

    groupCounts.forEach((count, token) => {
      if (count > dominantGroupCount) {
        dominantGroupToken = token;
        dominantGroupCount = count;
        return;
      }
      if (count < dominantGroupCount) return;

      const currentIdx = preferredGroups.indexOf(dominantGroupToken);
      const nextIdx = preferredGroups.indexOf(token);
      if (nextIdx !== -1 && (currentIdx === -1 || nextIdx < currentIdx)) {
        dominantGroupToken = token;
      }
    });

    if (dominantGroupToken) {
      const groupLabel = getLegendGroupDisplayLabel(dominantGroupToken);
      if (groupLabel) return normalizeAutoTitleSubject(groupLabel);
    }

    if (nodes.length === 1) {
      const node = nodes[0];
      const metric = resolveMetricForNode(node);
      const keyword = node?.settings?.keyword || '';
      const subject = getMetricSubjectForTitle(metric, keyword);
      const normalized = normalizeAutoTitleSubject(subject);
      if (normalized) return normalized;
    }

    if (dataset?.channels?.length) {
      const sorted = dataset.channels
        .map((channel) => ({
          label: String(channel.label || '').trim(),
          total: (channel.values || []).reduce((sum, value) => sum + (Number(value) || 0), 0)
        }))
        .sort((a, b) => b.total - a.total);

      const leadLabel = sorted[0]?.label || '';
      const normalized = normalizeAutoTitleSubject(leadLabel);
      if (normalized) return normalized;
    }

    return isEn ? 'selected series' : 'series seleccionadas';
  }

  function buildAutoChartTitle(chartNode) {
    const fallbackTitle = getDefaultChartTitle(chartNode);
    if (!chartNode || chartNode.role !== 'chart') return fallbackTitle;

    const dataset = buildChartInputDataset(chartNode);
    if (!dataset || !dataset.channels.length) {
      return fallbackTitle || getChartKindTitle(getChartKindFromCard(chartNode));
    }

    const inputNodes = getChartLinkedNodes(chartNode, 'left');
    const summary = getAutoTitleSummaryPhrase(inputNodes);
    const subject = getAutoTitleSubject(chartNode, dataset, inputNodes);

    if (!subject) return summary;
    return isEn ? `${summary} of ${subject}` : `${summary} de ${subject}`;
  }

  function getAutoChartTitleCacheKey(chartNode) {
    if (!chartNode || chartNode.role !== 'chart') return '';
    return `${pageLang}|${chartNode.uid}|${chartNode.cardId || ''}|${getChartDatasetMemoKey(chartNode)}`;
  }

  function syncAutoChartTitle(chartNode) {
    if (!chartNode || chartNode.role !== 'chart') return;
    const titleCacheKey = getAutoChartTitleCacheKey(chartNode);
    if (chartNode.__autoTitleCacheKey === titleCacheKey) return;

    boardPerfCounters.autoTitleBuilds += 1;
    const nextTitle = String(buildAutoChartTitle(chartNode) || '').trim();
    chartNode.__autoTitleCacheKey = titleCacheKey;
    if (!nextTitle || chartNode.title === nextTitle) return;
    chartNode.title = nextTitle;
  }

  function buildBoardChartPreview(chartNode) {
    const dataset = buildChartInputDataset(chartNode);
    if (!dataset) {
      return `<div class="chart-preview-empty">${isEn ? 'Waiting for cache...' : 'Esperando cache...'}</div>`;
    }

    if (!dataset.channels.length) {
      return `<div class="chart-preview-empty">${isEn ? 'Add input cards on the left slot.' : 'Agrega tarjetas de entrada en el slot izquierdo.'}</div>`;
    }

    const cacheKey = getBoardChartPreviewCacheKey(chartNode);
    if (cacheKey && chartPreviewMarkupMemo.has(cacheKey)) {
      return chartPreviewMarkupMemo.get(cacheKey) || '';
    }

    boardPerfCounters.chartPreviewBuilds += 1;

    const kind = getChartKindFromCard(chartNode);
    const styleConfig = getChartStyleConfig(chartNode, dataset);
    const svg = kind === 'radar'
      ? buildBoardRadarPreviewSvg(dataset, styleConfig)
      : kind === 'heatmap'
        ? buildBoardHeatmapPreviewSvg(dataset, styleConfig)
        : buildBoardLinePreviewSvg(dataset, styleConfig);
    const legend = buildBoardChartLegend(dataset, kind, chartNode, styleConfig);
    const legendMap = buildInputLegendMapForChart(chartNode);

    const sorted = dataset.channels
      .map((channel) => {
        const legendInfo = legendMap.get(channel.id);
        const compactLabel = String(legendInfo?.compactLabel || channel.label || '--').trim() || '--';
        return {
          label: compactLabel,
          total: channel.values.reduce((sum, value) => sum + value, 0)
        };
      })
      .sort((a, b) => b.total - a.total);

    const top = sorted[0];
    const leadLabel = top ? truncate(top.label, 42) : '--';
    const meta = `${isEn ? 'Lead' : 'Lider'}: ${leadLabel}`;

    const markup = `
      ${svg}
      ${legend}
      <div class="chart-preview-meta">${escapeHtml(meta)}</div>
    `;

    if (cacheKey) pushChartPreviewMarkupMemo(cacheKey, markup);
    return markup;
  }

  function syncBoardNodesFromTemplates(els) {
    if (!Array.isArray(boardState.nodes) || !boardState.nodes.length) return;

    let changed = false;

    boardState.nodes.forEach((node) => {
      ensureNodeSettings(node);

      const deck = getDeckById(node.deckId);
      if (!deck || !Array.isArray(deck.cards)) return;

      let template = node.cardId ? deck.cards.find((card) => card.id === node.cardId) : null;
      if (!template) {
        template = deck.cards.find((card) => card.title === node.title) || null;
        if (template && !node.cardId) node.cardId = template.id;
      }
      if (!template) return;

      const nextTitle = String(template.title || node.title || '');
      if (node.title !== nextTitle) {
        node.title = nextTitle;
        changed = true;
      }

      if (node.role !== 'data' && node.role !== 'style' && !(node.role === 'control' && (node.cardId === 'period-control' || node.cardId === 'source-control'))) {
        const nextValue = String(template.value || node.value || '');
        const nextNote = String(template.note || node.note || '');
        if (node.value !== nextValue || node.note !== nextNote) {
          node.value = nextValue;
          node.note = nextNote;
          changed = true;
        }
      }

      const beforeValue = String(node.value || '');
      const beforeNote = String(node.note || '');
      updateNodeMetricSnapshot(node);
      if (beforeValue !== String(node.value || '') || beforeNote !== String(node.note || '')) {
        changed = true;
      }
    });

    getChartNodes().forEach((chart) => {
      if (refreshLinkedDataNodes(chart)) changed = true;
    });

    if (changed && els?.canvas) {
      renderBoardCanvas(els);
    }
  }

  function syncWidgetDecksWithRealData(els) {
    const arxivData = scienceCache.arxiv || heroState.data;
    if (!arxivData) return;

    const { months, series } = buildSeries(arxivData, 6);
    if (!months.length) return;

    const totalsByGroup = GROUP_ORDER.map((id) => ({
      id,
      total: (series[id] || []).reduce((sum, value) => sum + value, 0)
    })).sort((a, b) => b.total - a.total);

    const totalPapers = totalsByGroup.reduce((sum, entry) => sum + entry.total, 0);
    const topGroup = totalsByGroup[0] || { id: '', total: 0 };
    const topShare = totalPapers ? (topGroup.total / totalPapers) * 100 : 0;

    const monthlyTotals = months.map((_, idx) => GROUP_ORDER.reduce((sum, id) => sum + (series[id]?.[idx] || 0), 0));
    const last = monthlyTotals[monthlyTotals.length - 1] || 0;
    const prev = monthlyTotals[monthlyTotals.length - 2] || 0;
    const growth = prev ? ((last - prev) / prev) * 100 : NaN;

    const items = getArxivItemsInMonths(arxivData.items || [], months);
    const topKeyword = extractTopKeyword(items);
    const uniqueCategories = new Set(items.map((item) => safeText(item?.primaryCategory || item?.categories?.[0])).filter(Boolean));

    const journalRangeCount = Array.isArray(scienceCache.journalPosts)
      ? scienceCache.journalPosts.filter((post) => months.includes(monthKeyFromIso(post?.date))).length
      : 0;
    const apodCount = scienceCache.apod ? 1 : 0;
    const sourceTotal = Math.max(1, totalPapers + journalRangeCount + apodCount);
    const arxivShare = (totalPapers / sourceTotal) * 100;
    const journalShare = (journalRangeCount / sourceTotal) * 100;
    const apodShare = (apodCount / sourceTotal) * 100;

    const apodItem = scienceCache.apod || {};
    const apodTitleTokens = (normalizeToken(apodItem.title).match(/[a-z][a-z0-9-]{3,}/g) || [])
      .filter((token) => !KEYWORD_STOPWORDS.has(token))
      .slice(0, 5);
    const contextHits = apodTitleTokens.length
      ? items.filter((item) => {
        const haystack = normalizeToken(`${safeText(item?.title)} ${safeText(item?.summary)}`);
        return apodTitleTokens.some((token) => haystack.includes(token));
      }).length
      : 0;

    const mean = monthlyTotals.length
      ? monthlyTotals.reduce((sum, value) => sum + value, 0) / monthlyTotals.length
      : 0;
    const variance = monthlyTotals.length
      ? monthlyTotals.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / monthlyTotals.length
      : 0;
    const volatility = mean ? (Math.sqrt(variance) / mean) * 100 : 0;

    updateDeckCardTemplate('arxiv-core', 'total-papers', {
      value: totalPapers.toLocaleString(),
      note: isEn ? `Source: ArXiv cache (${months.length}m)` : `Fuente: cache ArXiv (${months.length}m)`
    });

    const keywordLabel = topKeyword.token ? toTitleCase(topKeyword.token) : (isEn ? 'N/A' : 'N/D');
    updateDeckCardTemplate('arxiv-core', 'keyword-frequency', {
      title: isEn ? 'Top keyword frequency' : 'Frecuencia keyword lider',
      value: `${keywordLabel}: ${topKeyword.count.toLocaleString()}`,
      note: isEn ? 'Computed from titles and abstracts' : 'Calculado desde titulos y resumenes'
    });

    updateDeckCardTemplate('arxiv-core', 'top-category-share', {
      value: formatPercent(topShare, 1),
      note: `${GROUP_LABELS[topGroup.id] || '--'} | ${topGroup.total.toLocaleString()} / ${totalPapers.toLocaleString()}`
    });

    updateDeckCardTemplate('arxiv-core', 'line-chart', {
      value: isEn ? `${months.length} points` : `${months.length} puntos`,
      note: isEn ? `Monthly trend ${formatSignedPercent(growth, 0)}` : `Tendencia mensual ${formatSignedPercent(growth, 0)}`
    });

    updateDeckCardTemplate('keywords-lab', 'topic-density', {
      value: `${uniqueCategories.size.toLocaleString()} ${isEn ? 'topics' : 'temas'}`,
      note: isEn ? 'Distinct primary categories in range' : 'Categorias primarias distintas en el rango'
    });

    updateDeckCardTemplate('keywords-lab', 'period-control', {
      value: months.length >= 12 ? '3m / 6m / 9m / 12m' : '3m / 6m / 9m',
      note: isEn ? `Window now: ${formatRangeMonthsLabel(months.length)}` : `Ventana actual: ${formatRangeMonthsLabel(months.length)}`
    });

    updateDeckCardTemplate('keywords-lab', 'source-control', {
      value: `ArXiv ${Math.round(arxivShare)}% / Blog ${Math.round(journalShare)}% / NASA ${Math.round(apodShare)}%`,
      note: isEn ? 'Mix based on available records' : 'Mezcla basada en registros disponibles'
    });

    const apodWords = countWords(apodItem.explanation || '');
    updateDeckCardTemplate('nasa-signals', 'apod-index', {
      value: `${apodWords.toLocaleString()} ${isEn ? 'words' : 'palabras'}`,
      note: `${formatDate(apodItem.date)} | ${safeText(apodItem.media_type || '').toUpperCase() || '--'}`
    });

    updateDeckCardTemplate('nasa-signals', 'context-output', {
      value: `${contextHits.toLocaleString()} ${isEn ? 'matches' : 'coincidencias'}`,
      note: isEn ? 'ArXiv papers aligned with APOD terms' : 'Papers de ArXiv alineados con terminos APOD'
    });

    updateDeckCardTemplate('nasa-signals', 'radar-chart', {
      value: `${Math.min(4, totalsByGroup.length)} ${isEn ? 'groups' : 'grupos'}`,
      note: isEn ? 'Multigroup profile from ArXiv totals' : 'Perfil multigrupo desde totales ArXiv'
    });

    const minGroup = totalsByGroup[totalsByGroup.length - 1]?.total || 0;
    const maxGroup = totalsByGroup[0]?.total || 0;

    updateDeckCardTemplate('fusion-style', 'style-depth', {
      value: formatPercent(volatility, 1),
      note: isEn ? 'Relative volatility in monthly total' : 'Volatilidad relativa en total mensual'
    });

    updateDeckCardTemplate('fusion-style', 'style-color', {
      value: `${minGroup.toLocaleString()} - ${maxGroup.toLocaleString()}`,
      note: isEn ? 'Group range in selected period' : 'Rango por grupo en el periodo'
    });

    const depthHint = clampNumber(Math.round(Math.min(100, 28 + volatility * 1.8 + topShare * 0.6)), 0, 100);
    const softnessHint = clampNumber(Math.round(Math.max(24, 84 - volatility * 1.1)), 0, 100);
    updateDeckCardTemplate('fusion-style', 'style-3d', {
      value: isEn ? `Relief ${depthHint}% / Softness ${softnessHint}%` : `Relieve ${depthHint}% / Suavidad ${softnessHint}%`,
      note: isEn ? 'Calibrated from volatility and category spread' : 'Calibrado segun volatilidad y dispersion de categorias'
    });

    updateDeckCardTemplate('fusion-style', 'heatmap-chart', {
      value: `${Math.min(4, totalsByGroup.length)} x ${Math.min(6, months.length)}`,
      note: isEn ? 'Density matrix with live totals' : 'Matriz de densidad con totales reales'
    });

    if (els?.modal && !els.modal.hidden && boardState.currentDeckId) {
      openDeck(boardState.currentDeckId, els);
    }

    syncBoardNodesFromTemplates(els || widgetBoardEls);
  }

  function renderHeroRange() {
    if (!elHeroRange) return;
    elHeroRange.querySelectorAll('button[data-range]').forEach((btn) => {
      const value = Number(btn.dataset.range || 0);
      btn.classList.toggle('is-active', value === heroState.range);
      const hasData = heroState.data && Array.isArray(heroState.data.months);
      if (hasData) {
        btn.disabled = value > heroState.data.months.length;
      }
    });
  }

  function renderHeroFilters() {
    if (!elHeroFilters) return;
    elHeroFilters.innerHTML = GROUP_ORDER.map((id) => {
      const active = heroState.active.has(id) ? 'is-active' : '';
      const label = GROUP_LABELS[id] || id;
      return `<button class="filter-pill ${active}" type="button" data-group="${id}">${label}</button>`;
    }).join('');

    elHeroFilters.querySelectorAll('button[data-group]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.group;
        if (!id) return;
        if (heroState.active.has(id) && heroState.active.size === 1) return;
        if (heroState.active.has(id)) heroState.active.delete(id);
        else heroState.active.add(id);
        renderHeroFilters();
        renderHeroChart();
      });
    });
  }

  function renderHeroStats(months, series) {
    if (!elHeroTotal || !elHeroGrowth || !elHeroTop) return;
    if (elHeroTotalLabel) elHeroTotalLabel.textContent = i18n.totalLabel(heroState.range);
    const activeIds = GROUP_ORDER.filter((id) => heroState.active.has(id));
    const totalsByMonth = months.map((_, idx) => activeIds.reduce((sum, id) => sum + (series[id]?.[idx] || 0), 0));
    const total = totalsByMonth.reduce((sum, v) => sum + v, 0);
    const last = totalsByMonth[totalsByMonth.length - 1] || 0;
    const prev = totalsByMonth[totalsByMonth.length - 2] || 0;
    const growth = prev ? Math.round(((last - prev) / prev) * 100) : null;

    const totalsByGroup = activeIds.map((id) => ({
      id,
      total: series[id]?.reduce((sum, v) => sum + v, 0) || 0
    }));

    const sortedGroups = totalsByGroup
      .slice()
      .sort((a, b) => b.total - a.total);

    const top = sortedGroups[0];

    elHeroTotal.textContent = total.toLocaleString();
    elHeroGrowth.textContent = growth === null ? i18n.growthEmpty : `${growth > 0 ? '+' : ''}${growth}%`;
    elHeroTop.textContent = top ? (GROUP_LABELS[top.id] || top.id) : '--';

    if (elHeroBreakdown) {
      elHeroBreakdown.innerHTML = sortedGroups.map(({ id, total }) => {
        const label = GROUP_LABELS[id] || id;
        return `<li><span class="bd-dot" style="background:${GROUP_COLORS[id]}"></span><span class="bd-label">${label}</span><span class="bd-value">${total.toLocaleString()}</span></li>`;
      }).join('');
    }
  }

  function buildChartSvg(months, series) {
    const width = 720;
    const height = 280;
    const padX = 44;
    const padY = 26;
    const innerW = width - padX * 2;
    const innerH = height - padY * 2;

    const activeIds = GROUP_ORDER.filter((id) => heroState.active.has(id));
    const max = Math.max(1, ...activeIds.flatMap(id => series[id] || [0]));
    const step = months.length > 1 ? innerW / (months.length - 1) : innerW;

    const yFor = (v) => padY + innerH - (v / max) * innerH;
    const xFor = (i) => padX + step * i;

    const gridLines = Array.from({ length: 4 }, (_, i) => {
      const y = padY + (innerH / 3) * i;
      const value = Math.round(max - (max / 3) * i);
      return `
        <g class="chart-axis">
          <line x1="${padX}" y1="${y}" x2="${width - padX}" y2="${y}" />
          <text x="${padX - 6}" y="${y + 4}" text-anchor="end">${value}</text>
        </g>
      `;
    }).join('');

    const xLabels = months.map((m, i) => {
      const x = xFor(i);
      const label = formatMonthLabel(m);
      return `<text x="${x}" y="${height - 6}" text-anchor="middle">${label}</text>`;
    }).join('');

    const lines = activeIds.map((id) => {
      const values = series[id] || [];
      const d = values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(v)}`).join(' ');
      const lastIdx = values.length - 1;
      const lastX = xFor(lastIdx);
      const lastY = yFor(values[lastIdx] || 0);
      return `
        <path class="chart-line ${id}" d="${d}" />
        <circle class="chart-point" cx="${lastX}" cy="${lastY}" r="3.2" fill="${GROUP_COLORS[id]}" />
      `;
    }).join('');

    return `
      <g class="chart-grid">
        ${gridLines}
      </g>
      <g class="chart-axis">
        ${xLabels}
      </g>
      <g class="chart-series">
        ${lines}
      </g>
    `;
  }

  function buildRadarSvg(months, series) {
    const width = 720;
    const height = 400;
    const pad = 10;
    const cx = width / 2;
    const cy = height / 2 + 4;
    const radius = Math.min(width, height) / 2 - pad;

    const activeIds = GROUP_ORDER.filter((id) => heroState.active.has(id));
    if (!activeIds.length) return '';

    const totals = activeIds.map((id) => ({
      id,
      total: series[id]?.reduce((sum, v) => sum + v, 0) || 0
    }));

    const max = Math.max(1, ...totals.map((t) => t.total));
    const steps = 4;

    const rings = Array.from({ length: steps }, (_, i) => {
      const depth = (i + 1) / steps;
      const r = radius * depth;
      const shadowOffset = 3 + depth * 5;
      const highlightOffset = -0.4 - depth * 0.8;
      const shadowOpacity = 0.06 + depth * 0.06;
      const highlightOpacity = 0.18 + depth * 0.1;
      const strokeWidth = 1 + depth * 0.5;
      return `
        <circle class="radar-ring shadow" cx="${cx}" cy="${cy + shadowOffset}" r="${r}" style="opacity:${shadowOpacity.toFixed(2)}; stroke-width:${(strokeWidth + 0.6).toFixed(2)}" />
        <circle class="radar-ring" cx="${cx}" cy="${cy}" r="${r}" style="stroke-width:${strokeWidth.toFixed(2)}" />
        <circle class="radar-ring highlight" cx="${cx}" cy="${cy + highlightOffset}" r="${r}" style="opacity:${highlightOpacity.toFixed(2)}; stroke-width:${(strokeWidth - 0.2).toFixed(2)}" />
      `;
    }).join('');

    const axes = totals.map((_, i) => {
      const angle = (Math.PI * 2 * i) / totals.length - Math.PI / 2;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" />`;
    }).join('');

    const points = totals.map((t, i) => {
      const angle = (Math.PI * 2 * i) / totals.length - Math.PI / 2;
      const r = (t.total / max) * radius;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      return { id: t.id, x, y };
    });

    const polygon = points.map((p) => `${p.x} ${p.y}`).join(' ');

    const labels = totals.map((t, i) => {
      const angle = (Math.PI * 2 * i) / totals.length - Math.PI / 2;
      const cos = Math.cos(angle);
      const label = GROUP_LABELS[t.id] || t.id;
      const words = label.split(' ');
      const isEdge = Math.abs(cos) > 0.6;
      const labelRadius = radius + (isEdge ? 28 : 24);
      const x = cx + Math.cos(angle) * labelRadius;
      const y = cy + Math.sin(angle) * labelRadius;
      const anchor = cos > 0.2 ? 'start' : cos < -0.2 ? 'end' : 'middle';
      if (words.length > 1 && isEdge) {
        const first = words.slice(0, -1).join(' ');
        const second = words[words.length - 1];
        const y1 = y - 5;
        const y2 = y + 11;
        return `<text class="radar-label" x="${x}" text-anchor="${anchor}"><tspan x="${x}" y="${y1}">${first}</tspan><tspan x="${x}" y="${y2}">${second}</tspan></text>`;
      }
      return `<text class="radar-label" x="${x}" y="${y}" text-anchor="${anchor}">${label}</text>`;
    }).join('');

    const dots = points.map((p) => {
      return `<circle class="radar-point" cx="${p.x}" cy="${p.y}" r="3.8" fill="${GROUP_COLORS[p.id]}" />`;
    }).join('');

    return `
      <defs>
        <linearGradient id="radarStroke" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(255,255,255,0.42)" />
          <stop offset="35%" stop-color="rgba(255,255,255,0.22)" />
          <stop offset="70%" stop-color="rgba(2,6,23,0.12)" />
          <stop offset="100%" stop-color="rgba(2,6,23,0.18)" />
        </linearGradient>
      </defs>
      <g class="radar-grid">${rings}</g>
      <g class="radar-axes">${axes}</g>
      <polygon class="radar-fill" points="${polygon}" />
      <polygon class="radar-line" points="${polygon}" />
      <g class="radar-points">${dots}</g>
      <g class="radar-labels">${labels}</g>
    `;
  }






  function buildHeatmapSvg(months, series) {
    const width = 720;
    const height = 280;
    const padLeft = 150;
    const padRight = 28;
    const padTop = 18;
    const padBottom = 34;

    const activeIds = GROUP_ORDER.filter((id) => heroState.active.has(id));
    if (!activeIds.length || !months.length) return '';

    const innerW = width - padLeft - padRight;
    const innerH = height - padTop - padBottom;

    const cols = months.length;
    const rows = activeIds.length;
    const cellW = innerW / cols;
    const cellH = innerH / rows;

    const values = activeIds.map((id) => months.map((_, idx) => series[id]?.[idx] || 0));
    const flat = values.flat();
    const max = Math.max(1, ...flat);
    heroState.heatmapMax = max;

    const lerp = (a, b, t) => Math.round(a + (b - a) * t);
    const start = [37, 99, 235];
    const end = [239, 68, 68];

    const colorFor = (v) => {
      const t = Math.min(1, Math.max(0, v / max));
      const r = lerp(start[0], end[0], t);
      const g = lerp(start[1], end[1], t);
      const b = lerp(start[2], end[2], t);
      const alpha = 0.2 + t * 0.65;
      return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
    };

    const cells = activeIds.map((id, rowIdx) => {
      return months.map((m, colIdx) => {
        const v = series[id]?.[colIdx] || 0;
        const x = padLeft + colIdx * cellW;
        const y = padTop + rowIdx * cellH;
        const label = GROUP_LABELS[id] || id;
        const monthLabel = formatMonthLabel(m);
        return `<rect class="heatmap-cell" data-label="${label}" data-month="${monthLabel}" data-value="${v}" x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${(cellW - 1).toFixed(2)}" height="${(cellH - 1).toFixed(2)}" rx="4" fill="${colorFor(v)}" />`;
      }).join('');
    }).join('');

    const xLabels = months.map((m, i) => {
      const x = padLeft + i * cellW + cellW / 2;
      const label = formatMonthLabel(m);
      return `<text x="${x}" y="${height - 10}" text-anchor="middle">${label}</text>`;
    }).join('');

    const yLabels = activeIds.map((id, i) => {
      const y = padTop + i * cellH + cellH / 2 + 3;
      const label = GROUP_LABELS[id] || id;
      return `<text x="${padLeft - 10}" y="${y}" text-anchor="end">${label}</text>`;
    }).join('');

    const legendX = width - padRight - 140;
    const legendY = 8;
    const maxLabel = max.toLocaleString();

    return `
      <defs>
        <linearGradient id="heatmapGradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="rgba(${start[0]},${start[1]},${start[2]},0.6)" />
          <stop offset="100%" stop-color="rgba(${end[0]},${end[1]},${end[2]},0.95)" />
        </linearGradient>
      </defs>
      <g class="heatmap-legend">
        <rect x="${legendX}" y="${legendY}" width="140" height="8" rx="4" fill="url(#heatmapGradient)" />
        <text x="${legendX}" y="${legendY - 4}" text-anchor="start">0</text>
        <text x="${legendX + 140}" y="${legendY - 4}" text-anchor="end">${maxLabel}</text>
      </g>
      <g class="heatmap-y">${yLabels}</g>
      <g class="heatmap-x">${xLabels}</g>
      <g class="heatmap-cells">${cells}</g>
    `;
  }




  function renderHeroChart() {
    if (!elHeroChart || !heroState.data) return;
    const { months, series } = buildSeries(heroState.data, heroState.range);
    heroState.months = months;
    heroState.series = series;

    if (elHeroRangeLabel) elHeroRangeLabel.textContent = i18n.rangeLabel(heroState.range);

    if (!months.length) {
      elHeroChart.innerHTML = '';
      return;
    }

    if (heroState.chartType === 'radar') {
      elHeroChart.classList.add('is-radar');
      elHeroChart.classList.remove('is-heatmap');
      elHeroChart.setAttribute('viewBox', '0 0 720 400');
    } else if (heroState.chartType === 'heatmap') {
      elHeroChart.classList.remove('is-radar');
      elHeroChart.classList.add('is-heatmap');
      elHeroChart.setAttribute('viewBox', '0 0 720 280');
    } else {
      elHeroChart.classList.remove('is-radar');
      elHeroChart.classList.remove('is-heatmap');
      elHeroChart.setAttribute('viewBox', '0 0 720 280');
    }

    if (elHeroChartWrap) {
      elHeroChartWrap.classList.toggle('is-line', heroState.chartType === 'line');
      elHeroChartWrap.classList.toggle('is-radar', heroState.chartType === 'radar');
      elHeroChartWrap.classList.toggle('is-heatmap', heroState.chartType === 'heatmap');
    }
    elHeroChart.innerHTML = heroState.chartType === 'radar'
      ? buildRadarSvg(months, series)
      : heroState.chartType === 'heatmap'
        ? buildHeatmapSvg(months, series)
        : buildChartSvg(months, series);

    if (elHeroTooltip) elHeroTooltip.classList.remove('is-visible');
    renderHeroStats(months, series);
  }

  function handleHeatmapPointer(event) {
    if (!elHeroTooltip || !elHeroChartWrap) return;
    const target = event.target && event.target.closest ? event.target.closest('.heatmap-cell') : null;
    if (heatmapHideTimer) {
      clearTimeout(heatmapHideTimer);
      heatmapHideTimer = null;
    }
    if (!target) {
      if (!lastHeatmapCell) return;
      heatmapHideTimer = setTimeout(() => {
        lastHeatmapCell = null;
        elHeroTooltip.classList.remove('is-visible');
      }, 80);
      return;
    }

    const rect = elHeroChartWrap.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (target !== lastHeatmapCell) {
      lastHeatmapCell = target;
      const label = target.getAttribute('data-label') || '';
      const month = target.getAttribute('data-month') || '';
      const value = Number(target.getAttribute('data-value') || 0);
      const max = heroState.heatmapMax || 0;
      const pct = max ? Math.round((value / max) * 100) : 0;

      elHeroTooltip.innerHTML = `
        <div class="tt-title">${label}</div>
        <div class="tt-row">${month}</div>
        <div class="tt-row">${i18n.heatmapValue}: ${value.toLocaleString()} (${pct}%)</div>
      `;
      elHeroTooltip.classList.add('is-visible');
    } else if (!elHeroTooltip.classList.contains('is-visible')) {
      elHeroTooltip.classList.add('is-visible');
    }
    elHeroTooltip.style.left = `${Math.min(x + 12, rect.width - 180)}px`;
    elHeroTooltip.style.top = `${Math.max(y - 12, 12)}px`;
  }
  function handleChartPointer(event) {
    if (heroState.chartType === 'heatmap') {
      handleHeatmapPointer(event);
      return;
    }
    if (heroState.chartType !== 'line') {
      if (elHeroTooltip) elHeroTooltip.classList.remove('is-visible');
      return;
    }
    if (!elHeroTooltip || !heroState.months.length || !heroState.series || !elHeroChartWrap) return;
    const rect = elHeroChartWrap.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const pad = 44 / 720;
    const inner = 1 - pad * 2;
    const norm = Math.min(Math.max((x / rect.width - pad) / inner, 0), 1);
    const idx = Math.round(norm * (heroState.months.length - 1));

    const monthKey = heroState.months[idx];
    const rows = GROUP_ORDER.filter((id) => heroState.active.has(id)).map((id) => {
      const value = heroState.series[id]?.[idx] || 0;
      const dot = `<span class="tt-dot" style="background:${GROUP_COLORS[id]}"></span>`;
      return `<div class="tt-row">${dot}${GROUP_LABELS[id] || id}: ${value}</div>`;
    }).join('');

    elHeroTooltip.innerHTML = `<div class="tt-title">${formatMonthLabel(monthKey)}</div>${rows}`;
    elHeroTooltip.classList.add('is-visible');
    elHeroTooltip.style.left = `${Math.min(x + 12, rect.width - 160)}px`;
    elHeroTooltip.style.top = '12px';
  }

  function bindHeroEvents() {
    if (elHeroRange) {
      elHeroRange.querySelectorAll('button[data-range]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const next = Number(btn.dataset.range || 6);
          if (!Number.isFinite(next)) return;
          heroState.range = next;
          renderHeroRange();
          renderHeroChart();
          syncBoardNodesFromTemplates(widgetBoardEls);
        });
      });
    }

    if (elHeroChartWrap) {
      elHeroChartWrap.addEventListener('mousemove', handleChartPointer);
      elHeroChartWrap.addEventListener('mouseleave', () => {
        if (elHeroTooltip) elHeroTooltip.classList.remove('is-visible');
        lastHeatmapCell = null;
        if (heatmapHideTimer) {
          clearTimeout(heatmapHideTimer);
          heatmapHideTimer = null;
        }
      });
    }
    const switchBtns = document.querySelectorAll('.chart-switch-btn[data-chart]');
    const activeBtn = document.querySelector('.chart-switch-btn.is-active[data-chart]');
    if (activeBtn) heroState.chartType = activeBtn.dataset.chart;
    switchBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const next = btn.dataset.chart;
        if (!next) return;
        heroState.chartType = next;
        switchBtns.forEach((b) => b.classList.toggle('is-active', b === btn));
        renderHeroChart();
      });
    });
  }

  async function loadArxiv() {
    if (!elArxivList || !elArxivFilters) return;

    try {
      const data = await fetchJson('/static/data/arxiv.json', FETCH_CACHE_MODE.arxiv);
      const items = Array.isArray(data.items) ? data.items : [];

      const months = Array.isArray(data?.months) && data.months.length ? data.months : buildMonthKeys(data?.updatedAt || Date.now(), 12);
      data.months = months;
      const seriesFromItems = buildSeriesFromItems(items, months);
      if (seriesFromItems) data.series = seriesFromItems;
      heroState.data = data;
      scienceCache.arxiv = data;
      bumpScienceCacheRevision();
      renderHeroRange();
      renderHeroFilters();
      renderHeroChart();
      updateGlobalUpdated(data.updatedAt);

      setUpdated(elArxivUpdated, data.updatedAt);
      syncWidgetDecksWithRealData(widgetBoardEls);

      const listGroups = GROUP_ORDER.slice();
      const periodOptions = [
        { value: 'all', label: i18n.arxivPeriodAll },
        { value: '3', label: '3m' },
        { value: '6', label: '6m' },
        { value: '12', label: '12m' }
      ];

      const KEYWORD_GROUPS_STORAGE_KEY = `bcc-arxiv-keyword-groups-v1-${pageLang}`;

      const readKeywordGroups = () => {
        try {
          const raw = localStorage.getItem(KEYWORD_GROUPS_STORAGE_KEY) || '[]';
          const parsed = JSON.parse(raw);
          if (!Array.isArray(parsed)) return [];
          return parsed
            .map((entry) => ({
              id: safeText(entry?.id),
              name: safeText(entry?.name),
              terms: Array.isArray(entry?.terms) ? entry.terms.map((term) => safeText(term).trim()).filter(Boolean) : []
            }))
            .filter((entry) => entry.id && entry.name && entry.terms.length);
        } catch {
          return [];
        }
      };

      const writeKeywordGroups = (groups) => {
        try {
          localStorage.setItem(KEYWORD_GROUPS_STORAGE_KEY, JSON.stringify(groups));
        } catch {
          // ignore storage errors
        }
      };

      let activeGroup = i18n.all;
      let periodValue = '6';
      let keyword = '';
      let viewMode = 'papers';
      let keywordGroups = readKeywordGroups();
      let pickedGroupId = keywordGroups[0]?.id || '';
      let activeKeywordGroupIds = [];
      let isGroupPanelOpen = false;
      let keywordTopMode = 'all';
      let keywordTopMinCount = 1;
      let keywordTopSort = 'count';
      let keywordTopExclude = '';

      const KEYWORD_TOP_ACRONYMS = new Set(['ai', 'ml', 'dl', 'llm', 'llms', 'rag', 'nlp', 'gnn', 'gnns', 'cnn', 'rnns', 'rl', 'gpt']);

      const parseCommaTerms = (value) => {
        return Array.from(new Set(String(value || '')
          .split(/[;,\n]+/)
          .map((part) => part.trim())
          .filter((part) => part.length >= 2))).slice(0, 24);
      };

      const getQueryTerms = (value) => {
        const raw = String(value || '').trim();
        if (!raw) return [];
        if (raw.includes(',') || raw.includes(';')) return parseCommaTerms(raw);
        return Array.from(new Set(raw.split(/\s+/).map((part) => part.trim()).filter((part) => part.length >= 2))).slice(0, 8);
      };

      const getActiveGroupTerms = () => {
        const dict = new Map(keywordGroups.map((entry) => [entry.id, entry]));
        const terms = [];
        activeKeywordGroupIds.forEach((id) => {
          const group = dict.get(id);
          if (!group) return;
          terms.push(...group.terms);
        });
        return Array.from(new Set(terms)).slice(0, 80);
      };

      const normalizeTerms = (terms) => Array.from(new Set((terms || []).map((term) => normalizeToken(term).trim()).filter(Boolean)));

      const highlightMatches = (value, terms) => {
        const textValue = safeText(value);
        if (!textValue) return '';
        if (!Array.isArray(terms) || !terms.length) return escapeHtml(textValue);

        const sorted = terms
          .map((term) => String(term || '').trim())
          .filter(Boolean)
          .sort((a, b) => b.length - a.length)
          .slice(0, 18);

        if (!sorted.length) return escapeHtml(textValue);

        const pattern = new RegExp(`(${sorted.map((term) => escapeRegExp(term)).join('|')})`, 'gi');
        let lastIndex = 0;
        let output = '';

        for (const match of textValue.matchAll(pattern)) {
          const startIdx = match.index || 0;
          const endIdx = startIdx + match[0].length;
          if (startIdx < lastIndex) continue;
          output += escapeHtml(textValue.slice(lastIndex, startIdx));
          output += `<mark class="arxiv-hit">${escapeHtml(match[0])}</mark>`;
          lastIndex = endIdx;
        }

        output += escapeHtml(textValue.slice(lastIndex));
        return output;
      };

      const getPeriodMonthSet = (value) => {
        if (value === 'all') return null;
        const count = Math.max(1, Number(value) || 0);
        const selectedMonths = months.slice(-Math.min(count, months.length));
        return new Set(selectedMonths);
      };

      const matchesSearch = (item, manualTerms, groupTerms) => {
        const haystack = normalizeToken([
          item?.title,
          item?.summary,
          item?.primaryCategory,
          Array.isArray(item?.categories) ? item.categories.join(' ') : '',
          Array.isArray(item?.authors) ? item.authors.join(' ') : ''
        ].filter(Boolean).join(' '));

        const manualPass = !manualTerms.length || manualTerms.every((term) => containsNormalizedTerm(haystack, term));
        const groupPass = !groupTerms.length || groupTerms.some((term) => containsNormalizedTerm(haystack, term));
        return manualPass && groupPass;
      };

      const syncSelectWidth = (selectEl) => {
        if (!selectEl) return;
        const option = selectEl.options?.[selectEl.selectedIndex] || null;
        const label = option ? safeText(option.textContent) : safeText(selectEl.value);
        const chars = Math.max(7, Math.min(34, label.length + 3));
        selectEl.style.width = `${chars}ch`;
      };

      const renderActiveGroups = () => {
        if (!activeKeywordGroupIds.length) {
          return `<span class="arxiv-group-empty">${escapeHtml(i18n.arxivNoActiveGroups)}</span>`;
        }
        const dict = new Map(keywordGroups.map((entry) => [entry.id, entry]));
        return activeKeywordGroupIds.map((id) => {
          const group = dict.get(id);
          if (!group) return '';
          return `<button class="arxiv-group-chip" type="button" data-group-chip="${escapeHtml(id)}" title="${escapeHtml(group.name)}">${escapeHtml(group.name)} <span aria-hidden="true">x</span></button>`;
        }).join('');
      };

      const createKeywordGroupId = () => `kg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

      const buildSuggestedGroupName = (terms) => {
        if (Array.isArray(terms) && terms.length === 1) {
          return toTitleCase(safeText(terms[0]));
        }
        return `${i18n.arxivGroupAutoName} ${keywordGroups.length + 1}`;
      };

      const saveKeywordGroup = (nameValue, termsValue, activate = true) => {
        const name = safeText(nameValue || '').trim().slice(0, 42);
        const terms = normalizeTerms(Array.isArray(termsValue) ? termsValue : parseCommaTerms(termsValue || '')).slice(0, 24);
        if (!name || !terms.length) return false;

        const existing = keywordGroups.find((entry) => normalizeToken(entry.name) === normalizeToken(name));
        if (existing) {
          existing.name = name;
          existing.terms = terms;
          pickedGroupId = existing.id;
        } else {
          const id = createKeywordGroupId();
          keywordGroups.push({ id, name, terms });
          pickedGroupId = id;
        }

        if (activate && pickedGroupId && !activeKeywordGroupIds.includes(pickedGroupId)) {
          activeKeywordGroupIds.push(pickedGroupId);
        }

        writeKeywordGroups(keywordGroups);
        return true;
      };

      const renderFilters = () => {
        const keywordValue = escapeHtml(keyword);
        const hasKeyword = !!keyword.trim();
        const activeCount = activeKeywordGroupIds.length;

        const areaOptions = [i18n.all, ...listGroups].map((id) => {
          const label = id === i18n.all ? i18n.all : (GROUP_LABELS[id] || id);
          const selected = id === activeGroup ? ' selected' : '';
          return `<option value="${escapeHtml(id)}"${selected}>${escapeHtml(label)}</option>`;
        }).join('');

        const periodSelectOptions = periodOptions.map((option) => {
          const selected = option.value === periodValue ? ' selected' : '';
          return `<option value="${escapeHtml(option.value)}"${selected}>${escapeHtml(option.label)}</option>`;
        }).join('');

        const keywordGroupOptions = [`<option value="">${escapeHtml(i18n.arxivGroupPick)}</option>`, ...keywordGroups.map((entry) => {
          const selected = entry.id === pickedGroupId ? ' selected' : '';
          return `<option value="${escapeHtml(entry.id)}"${selected}>${escapeHtml(entry.name)}</option>`;
        })].join('');

        const keywordTopModeOptions = [
          { value: 'all', label: i18n.arxivTopModeAll },
          { value: 'phrases', label: i18n.arxivTopModePhrases },
          { value: 'terms', label: i18n.arxivTopModeTerms },
          { value: 'acronyms', label: i18n.arxivTopModeAcronyms }
        ].map((option) => {
          const selected = option.value === keywordTopMode ? ' selected' : '';
          return `<option value="${escapeHtml(option.value)}"${selected}>${escapeHtml(option.label)}</option>`;
        }).join('');

        const keywordTopMinCountOptions = [1, 2, 3, 5, 8].map((value) => {
          const selected = Number(value) === Number(keywordTopMinCount) ? ' selected' : '';
          return `<option value="${value}"${selected}>${value}</option>`;
        }).join('');

        const keywordTopSortOptions = [
          { value: 'count', label: i18n.arxivTopSortCount },
          { value: 'alpha', label: i18n.arxivTopSortAlpha }
        ].map((option) => {
          const selected = option.value === keywordTopSort ? ' selected' : '';
          return `<option value="${escapeHtml(option.value)}"${selected}>${escapeHtml(option.label)}</option>`;
        }).join('');

        const keywordTopExcludeValue = escapeHtml(keywordTopExclude);

        elArxivFilters.innerHTML = `
          <div class="arxiv-filter-stack">
            <div class="arxiv-keyword-bar">
              <input
                class="arxiv-keyword-input"
                type="search"
                id="arxiv-keyword-input"
                value="${keywordValue}"
                placeholder="${escapeHtml(i18n.arxivKeywordPlaceholder)}"
                aria-label="${escapeHtml(i18n.arxivKeywordPlaceholder)}"
                autocomplete="off"
                spellcheck="false"
              />
              <button class="btn btn-ghost arxiv-keyword-clear${hasKeyword ? '' : ' is-disabled-empty'}" type="button" id="arxiv-keyword-clear">${escapeHtml(i18n.arxivClear)}</button>
              <button class="btn btn-ghost arxiv-group-launch${activeCount ? ' has-active' : ''}" type="button" id="arxiv-group-toggle" aria-expanded="${isGroupPanelOpen ? 'true' : 'false'}">${escapeHtml(i18n.arxivGroupsLabel)}<span>${activeCount}</span></button>
            </div>
            <div class="arxiv-selector-row">
              <label class="arxiv-selector-field" for="arxiv-area-select">
                <span class="arxiv-selector-label">${escapeHtml(i18n.arxivAreaLabel)}</span>
                <select class="arxiv-select" id="arxiv-area-select">${areaOptions}</select>
              </label>
              <label class="arxiv-selector-field" for="arxiv-period-select">
                <span class="arxiv-selector-label">${escapeHtml(i18n.arxivPeriodLabel)}</span>
                <select class="arxiv-select" id="arxiv-period-select">${periodSelectOptions}</select>
              </label>
            </div>
            <div class="arxiv-view-row" role="tablist" aria-label="ArXiv view mode">
              <button class="arxiv-view-btn${viewMode === 'papers' ? ' is-active' : ''}" type="button" data-arxiv-view="papers">${escapeHtml(i18n.arxivViewPapers)}</button>
              <button class="arxiv-view-btn${viewMode === 'keywords' ? ' is-active' : ''}" type="button" data-arxiv-view="keywords">${escapeHtml(i18n.arxivViewKeywords)}</button>
            </div>
            ${viewMode === 'keywords' ? `
              <div class="arxiv-top-filters">
                <span class="arxiv-selector-label">${escapeHtml(i18n.arxivTopFiltersLabel)}</span>
                <label class="arxiv-selector-field" for="arxiv-top-mode">
                  <span class="arxiv-selector-label">${escapeHtml(i18n.arxivTopModeLabel)}</span>
                  <select class="arxiv-select" id="arxiv-top-mode">${keywordTopModeOptions}</select>
                </label>
                <label class="arxiv-selector-field" for="arxiv-top-min-count">
                  <span class="arxiv-selector-label">${escapeHtml(i18n.arxivTopMinCountLabel)}</span>
                  <select class="arxiv-select" id="arxiv-top-min-count">${keywordTopMinCountOptions}</select>
                </label>
                <label class="arxiv-selector-field" for="arxiv-top-sort">
                  <span class="arxiv-selector-label">${escapeHtml(i18n.arxivTopSortLabel)}</span>
                  <select class="arxiv-select" id="arxiv-top-sort">${keywordTopSortOptions}</select>
                </label>
                <label class="arxiv-selector-field arxiv-top-exclude-field" for="arxiv-top-exclude">
                  <span class="arxiv-selector-label">${escapeHtml(i18n.arxivTopExcludeLabel)}</span>
                  <input class="arxiv-keyword-input arxiv-top-exclude-input" type="text" id="arxiv-top-exclude" value="${keywordTopExcludeValue}" placeholder="${escapeHtml(i18n.arxivTopExcludePlaceholder)}" autocomplete="off" spellcheck="false" />
                </label>
              </div>
            ` : ''}
            ${isGroupPanelOpen ? `
              <div class="arxiv-group-dock is-open" id="arxiv-group-dock">
                <div class="arxiv-group-dock-head">
                  <span class="arxiv-selector-label">${escapeHtml(i18n.arxivGroupsLabel)}</span>
                  <button class="arxiv-group-close" type="button" id="arxiv-group-close">${escapeHtml(i18n.arxivGroupClose)}</button>
                </div>
                <div class="arxiv-group-controls">
                  <select class="arxiv-select" id="arxiv-group-select">${keywordGroupOptions}</select>
                  <button class="btn btn-ghost arxiv-group-btn" type="button" id="arxiv-group-add">${escapeHtml(i18n.arxivGroupAdd)}</button>
                  <button class="btn btn-ghost arxiv-group-btn" type="button" id="arxiv-group-clear-active">${escapeHtml(i18n.arxivGroupClear)}</button>
                  <button class="btn btn-ghost arxiv-group-btn" type="button" id="arxiv-group-save-current">${escapeHtml(i18n.arxivGroupSaveCurrent)}</button>
                </div>
                <div class="arxiv-active-groups">${renderActiveGroups()}</div>
                <div class="arxiv-group-save-row">
                  <input class="arxiv-keyword-input arxiv-group-name" type="text" id="arxiv-group-name" placeholder="${escapeHtml(i18n.arxivGroupNamePlaceholder)}" autocomplete="off" spellcheck="false" />
                  <input class="arxiv-keyword-input arxiv-group-terms" type="text" id="arxiv-group-terms" placeholder="${escapeHtml(i18n.arxivGroupTermsPlaceholder)}" autocomplete="off" spellcheck="false" />
                  <button class="btn btn-ghost arxiv-group-btn" type="button" id="arxiv-group-save">${escapeHtml(i18n.arxivGroupSave)}</button>
                  <button class="btn btn-ghost arxiv-group-btn" type="button" id="arxiv-group-delete">${escapeHtml(i18n.arxivGroupDelete)}</button>
                </div>
              </div>
            ` : ''}
          </div>
        `;

        const areaSelect = elArxivFilters.querySelector('#arxiv-area-select');
        const periodSelect = elArxivFilters.querySelector('#arxiv-period-select');
        const input = elArxivFilters.querySelector('#arxiv-keyword-input');
        const clear = elArxivFilters.querySelector('#arxiv-keyword-clear');
        const modeButtons = Array.from(elArxivFilters.querySelectorAll('[data-arxiv-view]'));

        const topModeSelect = elArxivFilters.querySelector('#arxiv-top-mode');
        const topMinCountSelect = elArxivFilters.querySelector('#arxiv-top-min-count');
        const topSortSelect = elArxivFilters.querySelector('#arxiv-top-sort');
        const topExcludeInput = elArxivFilters.querySelector('#arxiv-top-exclude');

        const groupToggleBtn = elArxivFilters.querySelector('#arxiv-group-toggle');
        const groupCloseBtn = elArxivFilters.querySelector('#arxiv-group-close');
        const groupSelect = elArxivFilters.querySelector('#arxiv-group-select');
        const groupAddBtn = elArxivFilters.querySelector('#arxiv-group-add');
        const groupClearActiveBtn = elArxivFilters.querySelector('#arxiv-group-clear-active');
        const groupSaveCurrentBtn = elArxivFilters.querySelector('#arxiv-group-save-current');
        const groupNameInput = elArxivFilters.querySelector('#arxiv-group-name');
        const groupTermsInput = elArxivFilters.querySelector('#arxiv-group-terms');
        const groupSaveBtn = elArxivFilters.querySelector('#arxiv-group-save');
        const groupDeleteBtn = elArxivFilters.querySelector('#arxiv-group-delete');

        if (areaSelect) {
          syncSelectWidth(areaSelect);
          areaSelect.addEventListener('change', () => {
            activeGroup = String(areaSelect.value || i18n.all);
            syncSelectWidth(areaSelect);
            renderList();
          });
        }

        if (periodSelect) {
          syncSelectWidth(periodSelect);
          periodSelect.addEventListener('change', () => {
            periodValue = String(periodSelect.value || 'all');
            syncSelectWidth(periodSelect);
            renderList();
          });
        }

        if (input) {
          input.addEventListener('input', () => {
            keyword = String(input.value || '').slice(0, 120);
            if (clear) {
              const hasTerm = !!keyword.trim();
              clear.classList.toggle('is-disabled-empty', !hasTerm);
              clear.disabled = !hasTerm;
            }
            renderList();
          });
        }

        if (clear) {
          clear.disabled = !hasKeyword;
          clear.addEventListener('click', () => {
            keyword = '';
            renderFilters();
            renderList();
          });
        }

        modeButtons.forEach((btn) => {
          btn.addEventListener('click', () => {
            const nextMode = String(btn.getAttribute('data-arxiv-view') || 'papers');
            if (nextMode === viewMode) return;
            viewMode = nextMode === 'keywords' ? 'keywords' : 'papers';
            renderFilters();
            renderList();
          });
        });

        if (topModeSelect) {
          syncSelectWidth(topModeSelect);
          topModeSelect.addEventListener('change', () => {
            keywordTopMode = String(topModeSelect.value || 'all');
            syncSelectWidth(topModeSelect);
            renderList();
          });
        }

        if (topMinCountSelect) {
          syncSelectWidth(topMinCountSelect);
          topMinCountSelect.addEventListener('change', () => {
            const parsed = Number(topMinCountSelect.value || 1);
            keywordTopMinCount = Number.isFinite(parsed) ? Math.max(1, parsed) : 1;
            syncSelectWidth(topMinCountSelect);
            renderList();
          });
        }

        if (topSortSelect) {
          syncSelectWidth(topSortSelect);
          topSortSelect.addEventListener('change', () => {
            keywordTopSort = String(topSortSelect.value || 'count') === 'alpha' ? 'alpha' : 'count';
            syncSelectWidth(topSortSelect);
            renderList();
          });
        }

        if (topExcludeInput) {
          topExcludeInput.addEventListener('input', () => {
            keywordTopExclude = String(topExcludeInput.value || '').slice(0, 140);
            renderList();
          });
        }

        if (groupToggleBtn) {
          groupToggleBtn.addEventListener('click', () => {
            isGroupPanelOpen = !isGroupPanelOpen;
            renderFilters();
          });
        }

        if (groupCloseBtn) {
          groupCloseBtn.addEventListener('click', () => {
            isGroupPanelOpen = false;
            renderFilters();
          });
        }

        if (groupSelect) {
          syncSelectWidth(groupSelect);
          groupSelect.addEventListener('change', () => {
            pickedGroupId = String(groupSelect.value || '');
            syncSelectWidth(groupSelect);
          });
        }

        if (groupAddBtn) {
          groupAddBtn.addEventListener('click', () => {
            if (!pickedGroupId) return;
            if (!activeKeywordGroupIds.includes(pickedGroupId)) {
              activeKeywordGroupIds.push(pickedGroupId);
            }
            renderFilters();
            renderList();
          });
        }

        if (groupClearActiveBtn) {
          groupClearActiveBtn.addEventListener('click', () => {
            activeKeywordGroupIds = [];
            renderFilters();
            renderList();
          });
        }

        if (groupSaveCurrentBtn) {
          groupSaveCurrentBtn.addEventListener('click', () => {
            const rawKeyword = String(keyword || '').trim();
            if (!rawKeyword) return;
            const derivedTerms = (rawKeyword.includes(',') || rawKeyword.includes(';'))
              ? parseCommaTerms(rawKeyword)
              : (rawKeyword.includes(' ') ? [rawKeyword] : getQueryTerms(rawKeyword));
            if (!derivedTerms.length) return;
            const fallbackName = buildSuggestedGroupName(derivedTerms);
            const name = safeText(groupNameInput?.value || '').trim() || fallbackName;
            if (!saveKeywordGroup(name, derivedTerms, true)) return;
            if (groupNameInput) groupNameInput.value = '';
            if (groupTermsInput) groupTermsInput.value = '';
            isGroupPanelOpen = true;
            renderFilters();
            renderList();
          });
        }

        if (groupSaveBtn) {
          groupSaveBtn.addEventListener('click', () => {
            const name = safeText(groupNameInput?.value || '').trim();
            const terms = parseCommaTerms(groupTermsInput?.value || '');
            if (!saveKeywordGroup(name, terms, true)) return;
            if (groupNameInput) groupNameInput.value = '';
            if (groupTermsInput) groupTermsInput.value = '';
            renderFilters();
            renderList();
          });
        }

        if (groupDeleteBtn) {
          groupDeleteBtn.addEventListener('click', () => {
            if (!pickedGroupId) return;
            keywordGroups = keywordGroups.filter((entry) => entry.id !== pickedGroupId);
            activeKeywordGroupIds = activeKeywordGroupIds.filter((id) => id !== pickedGroupId);
            pickedGroupId = keywordGroups[0]?.id || '';
            writeKeywordGroups(keywordGroups);
            renderFilters();
            renderList();
          });
        }

        elArxivFilters.querySelectorAll('[data-group-chip]').forEach((chip) => {
          chip.addEventListener('click', () => {
            const removeId = String(chip.getAttribute('data-group-chip') || '');
            activeKeywordGroupIds = activeKeywordGroupIds.filter((id) => id !== removeId);
            renderFilters();
            renderList();
          });
        });
      };

      const getRecencyScore = (item) => {
        const ts = Date.parse(item?.updated || item?.published || '');
        if (!Number.isFinite(ts)) return 0;
        const ageDays = Math.max(0, (Date.now() - ts) / 86400000);
        return Math.max(0, 1 - (ageDays / 365));
      };

      const getMatchScore = (item, normalizedTerms) => {
        if (!normalizedTerms.length) return 0;
        const title = normalizeToken(item?.title || '');
        const summary = normalizeToken(item?.summary || '');
        const primary = normalizeToken(item?.primaryCategory || '');
        const categories = normalizeToken(Array.isArray(item?.categories) ? item.categories.join(' ') : '');
        const authors = normalizeToken(Array.isArray(item?.authors) ? item.authors.join(' ') : '');

        return normalizedTerms.reduce((score, term) => {
          let s = 0;
          if (containsNormalizedTerm(title, term)) s += 4;
          if (containsNormalizedTerm(primary, term)) s += 3;
          if (containsNormalizedTerm(categories, term)) s += 2;
          if (containsNormalizedTerm(summary, term)) s += 1;
          if (containsNormalizedTerm(authors, term)) s += 1;
          return score + s;
        }, 0);
      };

      const getScopedItems = () => {
        const periodMonths = getPeriodMonthSet(periodValue);
        return items.filter((item) => {
          const group = item.group || detectGroup(item.primaryCategory || item.categories?.[0]);
          if (activeGroup !== i18n.all && group !== activeGroup) return false;
          if (periodMonths) {
            const month = monthKeyFromIso(item?.updated || item?.published);
            if (!periodMonths.has(month)) return false;
          }
          return true;
        });
      };

      const buildKeywordStats = (scopedItems) => {
        const counts = collectKeywordCounts(scopedItems);
        return Array.from(counts.entries())
          .map(([token, count]) => ({ token, count }))
          .sort((a, b) => (b.count - a.count) || a.token.localeCompare(b.token));
      };

      const isAcronymKeywordToken = (token) => {
        const normalized = normalizeToken(token).replace(/[^a-z0-9]/g, '');
        if (!normalized) return false;
        if (KEYWORD_TOP_ACRONYMS.has(normalized)) return true;
        return normalized.length >= 2 && normalized.length <= 5 && !token.includes(' ') && !KEYWORD_STOPWORDS.has(normalized);
      };

      const renderList = () => {
        const queryTerms = getQueryTerms(keyword);
        const manualTerms = normalizeTerms(queryTerms);
        const groupTerms = normalizeTerms(getActiveGroupTerms());
        const scopedItems = getScopedItems();
        const queryMatchedItems = scopedItems.filter((item) => matchesSearch(item, manualTerms, groupTerms));
        const highlightTerms = [...queryTerms, ...getActiveGroupTerms()].slice(0, 18);

        if (viewMode === 'keywords') {
          let rankedKeywords = buildKeywordStats(queryMatchedItems.length ? queryMatchedItems : scopedItems);
          const filterTerms = normalizeTerms(highlightTerms);
          const customExcludes = normalizeTerms(parseCommaTerms(keywordTopExclude || '')).slice(0, 24);

          rankedKeywords = rankedKeywords.filter((entry) => entry.count >= Math.max(1, Number(keywordTopMinCount) || 1));

          if (keywordTopMode === 'phrases') {
            rankedKeywords = rankedKeywords.filter((entry) => entry.token.includes(' '));
          } else if (keywordTopMode === 'terms') {
            rankedKeywords = rankedKeywords.filter((entry) => !entry.token.includes(' '));
          } else if (keywordTopMode === 'acronyms') {
            rankedKeywords = rankedKeywords.filter((entry) => isAcronymKeywordToken(entry.token));
          }

          if (customExcludes.length) {
            rankedKeywords = rankedKeywords.filter((entry) => !customExcludes.some((term) => containsNormalizedTerm(entry.token, term)));
          }

          if (filterTerms.length) {
            rankedKeywords = rankedKeywords.filter((entry) => filterTerms.some((term) => containsNormalizedTerm(entry.token, term)));
          }

          if (keywordTopSort === 'alpha') {
            rankedKeywords = rankedKeywords.sort((a, b) => a.token.localeCompare(b.token));
          } else {
            rankedKeywords = rankedKeywords.sort((a, b) => (b.count - a.count) || a.token.localeCompare(b.token));
          }

          if (!rankedKeywords.length) {
            elArxivList.innerHTML = `<div class="science-loading">${i18n.arxivKeywordsEmpty}</div>`;
            return;
          }

          elArxivList.innerHTML = `
            <div class="arxiv-keywords-meta">${escapeHtml(i18n.arxivKeywordsTitle)} - ${(queryMatchedItems.length || scopedItems.length).toLocaleString()}</div>
            <div class="arxiv-keywords-list">
              ${rankedKeywords.slice(0, 28).map((entry, idx) => {
                const scale = Math.max(0.84, 1.14 - (idx * 0.012));
                return `<span class="arxiv-keyword-item" style="--kw-scale:${scale.toFixed(3)}"><strong>${highlightMatches(toTitleCase(entry.token), highlightTerms)}</strong><em>${entry.count.toLocaleString()}</em></span>`;
              }).join('')}
            </div>
          `;
          return;
        }

        const allTermsForScore = normalizeTerms([...manualTerms, ...groupTerms]);
        const filtered = queryMatchedItems.map((item) => {
          const matchScore = getMatchScore(item, allTermsForScore);
          const recencyScore = getRecencyScore(item);
          const totalScore = (matchScore * 10) + (recencyScore * 100);
          return { item, totalScore };
        }).sort((a, b) => b.totalScore - a.totalScore)
          .map((entry) => entry.item);

        if (!filtered.length) {
          elArxivList.innerHTML = `<div class="science-loading">${i18n.arxivEmpty}</div>`;
          return;
        }

        elArxivList.innerHTML = filtered.slice(0, 10).map((item) => {
          const titleRaw = safeText(item.title) || 'ArXiv';
          const summaryRaw = truncate(item.summary, 220);
          const date = formatDate(item.updated || item.published);
          const authorsRaw = Array.isArray(item.authors)
            ? item.authors.map((author) => safeText(author)).join(', ')
            : '';
          const link = escapeHtml(safeHref(item.link || item.id || '#'));
          const group = item.group || detectGroup(item.primaryCategory || item.categories?.[0]);
          const groupLabel = group ? (GROUP_LABELS[group] || group) : '';
          const tags = [groupLabel, item.primaryCategory].filter(Boolean).slice(0, 2);

          const title = highlightMatches(titleRaw, highlightTerms);
          const summary = highlightMatches(summaryRaw, highlightTerms);
          const authors = highlightMatches(authorsRaw, highlightTerms);
          const metaPrefix = escapeHtml(`${date}${authorsRaw ? ' - ' : ''}`);

          return `
            <article class="arxiv-item">
              <a class="arxiv-title" href="${link}" target="_blank" rel="noopener noreferrer">${title}</a>
              <div class="arxiv-meta">${metaPrefix}${authors}</div>
              <div class="arxiv-summary">${summary}</div>
              <div class="arxiv-tags">
                ${tags.map((tag) => `<span class="arxiv-tag">${highlightMatches(safeText(tag), highlightTerms)}</span>`).join('')}
              </div>
            </article>
          `;
        }).join('');
      };

      renderFilters();
      renderList();
    } catch (err) {
      elArxivList.innerHTML = `<div class="science-loading">${i18n.arxivError}</div>`;
    }
  }

  async function loadJournal() {
    if (!elJournalList) return;
    try {
      const json = await fetchJson('/content/content-index.json', FETCH_CACHE_MODE.journal);
      const posts = Array.isArray(json.posts) ? json.posts : [];
      const filtered = posts.filter(p => {
        const lang = String(p.lang || 'es').toLowerCase();
        return pageLang === 'en' ? lang.startsWith('en') : !lang.startsWith('en');
      });

      filtered.sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
      scienceCache.journalPosts = filtered;
      bumpScienceCacheRevision();

      const latestDate = filtered[0]?.date || '';
      if (latestDate) {
        setUpdated(elJournalUpdated, latestDate);
        updateGlobalUpdated(latestDate);
      }

      if (!filtered.length) {
        elJournalList.innerHTML = `<div class="science-loading">${i18n.journalEmpty}</div>`;
        syncWidgetDecksWithRealData(widgetBoardEls);
        return;
      }

      elJournalList.innerHTML = filtered.slice(0, 5).map(post => {
        const title = escapeHtml(safeText(post.title) || 'Blog');
        const date = formatDate(post.date);
        const section = escapeHtml(safeText(post.section));
        const meta = escapeHtml(section ? `${date} - ` : date);
        return `
          <a class="journal-item" href="${escapeHtml(safeHref(postUrl(post.id), pageLang === 'en' ? '/en/blog.html' : '/blog.html'))}">
            <div class="journal-title">${title}</div>
            <div class="journal-meta">${meta}${section}</div>
          </a>
        `;
      }).join('');
      syncWidgetDecksWithRealData(widgetBoardEls);
    } catch (err) {
      elJournalList.innerHTML = `<div class="science-loading">${i18n.journalError}</div>`;
    }
  }

  function extractYoutubeVideoId(url) {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      const parts = parsed.pathname.split('/').filter(Boolean);

      const sanitize = (id) => String(id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32);

      if (host === 'youtu.be' || host.endsWith('.youtu.be')) {
        return sanitize(parts[0] || '');
      }

      const watchId = sanitize(parsed.searchParams.get('v') || '');
      if (watchId) return watchId;

      const markerIndex = parts.findIndex((part) => part === 'embed' || part === 'shorts' || part === 'live');
      if (markerIndex >= 0) {
        return sanitize(parts[markerIndex + 1] || '');
      }

      return '';
    } catch {
      return '';
    }
  }

  function extractVimeoVideoId(url) {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      if (!host.includes('vimeo.com')) return '';

      const parts = parsed.pathname.split('/').filter(Boolean).reverse();
      const candidate = parts.find((part) => /^\d{6,12}$/.test(part));
      return candidate || '';
    } catch {
      return '';
    }
  }

  function extractDailymotionVideoId(url) {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      const parts = parsed.pathname.split('/').filter(Boolean);

      if (host === 'dai.ly' || host.endsWith('.dai.ly')) {
        return (parts[0] || '').replace(/[^a-zA-Z0-9]/g, '');
      }

      if (!host.includes('dailymotion.com')) return '';

      const markerIndex = parts.findIndex((part) => part === 'video');
      if (markerIndex >= 0) {
        return (parts[markerIndex + 1] || '').split('_')[0].replace(/[^a-zA-Z0-9]/g, '');
      }

      return '';
    } catch {
      return '';
    }
  }

  function resolveApodVideoEmbed(rawUrl) {
    const safeUrl = safeHref(rawUrl, '');
    if (!safeUrl) return null;

    let parsed = null;
    try {
      parsed = new URL(safeUrl);
    } catch {
      return null;
    }

    const protocol = String(parsed.protocol || '').toLowerCase();
    if (protocol !== 'http:' && protocol !== 'https:') return null;

    const pathname = String(parsed.pathname || '');
    if (/\.(mp4|webm|ogg|m3u8)$/i.test(pathname)) {
      return { kind: 'video', src: parsed.href };
    }

    const host = parsed.hostname.toLowerCase();

    if (host.includes('youtube.com') || host.includes('youtu.be') || host.includes('youtube-nocookie.com')) {
      const id = extractYoutubeVideoId(parsed.href);
      if (!id) return null;
      const search = new URLSearchParams({
        rel: '0',
        modestbranding: '1',
        playsinline: '1'
      });
      return { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${id}?${search.toString()}` };
    }

    if (host.includes('vimeo.com')) {
      const id = extractVimeoVideoId(parsed.href);
      if (!id) return null;
      const search = new URLSearchParams({
        title: '0',
        byline: '0',
        portrait: '0'
      });
      return { kind: 'iframe', src: `https://player.vimeo.com/video/${id}?${search.toString()}` };
    }

    if (host.includes('dailymotion.com') || host.includes('dai.ly')) {
      const id = extractDailymotionVideoId(parsed.href);
      if (!id) return null;
      return { kind: 'iframe', src: `https://www.dailymotion.com/embed/video/${id}` };
    }

    return null;
  }

  function createApodVideoNode(rawUrl, title) {
    const embed = resolveApodVideoEmbed(rawUrl);
    if (!embed || !embed.src) return null;

    if (embed.kind === 'video') {
      const video = document.createElement('video');
      video.className = 'apod-media-embed';
      video.src = safeHref(embed.src, '');
      if (!video.src) return null;
      video.controls = true;
      video.preload = 'metadata';
      video.setAttribute('playsinline', '');
      video.setAttribute('aria-label', title || 'APOD video');
      return video;
    }

    const iframe = document.createElement('iframe');
    iframe.className = 'apod-media-embed';
    iframe.src = safeHref(embed.src, '');
    if (!iframe.src) return null;
    iframe.title = title || 'APOD video';
    iframe.loading = 'lazy';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.allowFullscreen = true;
    iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
    iframe.setAttribute('frameborder', '0');
    return iframe;
  }

  function renderApodMediaBlock(container, item, title) {
    if (!container) return;

    const imageUrl = safeHref(item?.url || item?.hdurl, '');
    if (item?.media_type === 'image' && imageUrl) {
      const img = document.createElement('img');
      img.src = imageUrl;
      img.alt = title;
      img.loading = 'lazy';
      container.replaceChildren(img);
      return;
    }

    const videoUrl = safeHref(item?.url || item?.hdurl, '');
    if (videoUrl) {
      const videoNode = createApodVideoNode(videoUrl, title);
      if (videoNode) {
        container.replaceChildren(videoNode);
        return;
      }

      const link = document.createElement('a');
      link.className = 'btn btn-ghost';
      link.href = videoUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = i18n.viewVideo;
      container.replaceChildren(link);
      return;
    }

    container.replaceChildren();
  }


  async function loadApod() {
    const hasHeroApod = !!(elHeroApodMedia || elHeroApodTitle || elHeroApodDesc || elHeroApodDate);
    const hasCardApod = !!(elApodMedia || elApodTitle || elApodDesc);
    if (!hasHeroApod && !hasCardApod) return;

    try {
      const data = await fetchJson('/static/data/nasa-apod.json', FETCH_CACHE_MODE.apod);
      const item = data.item || data;
      scienceCache.apod = item;
      bumpScienceCacheRevision();

      const updatedAt = data.updatedAt || item.date;
      setUpdated(elApodUpdated, updatedAt);
      updateGlobalUpdated(updatedAt);

      const title = safeText(item.title) || 'NASA APOD';
      const descCard = truncate(item.explanation, 220);
      const descHero = safeText(item.explanation) || (isEn
        ? 'Explore astronomy imagery and explanations curated by NASA.'
        : 'Explora imagenes y explicaciones astronomicas seleccionadas por NASA.');
      const date = formatDate(item.date);
      const targetUrl = safeHref(item.url, 'https://apod.nasa.gov/');

      if (elApodTitle) elApodTitle.textContent = title;
      if (elApodDate) elApodDate.textContent = date;
      if (elApodDesc) elApodDesc.textContent = descCard;
      if (elApodLink) elApodLink.href = targetUrl;
      renderApodMediaBlock(elApodMedia, item, title);

      if (elHeroApodTitle) elHeroApodTitle.textContent = title;
      if (elHeroApodDate) elHeroApodDate.textContent = date;
      if (elHeroApodDesc) elHeroApodDesc.textContent = descHero;
      renderApodMediaBlock(elHeroApodMedia, item, title);

      syncWidgetDecksWithRealData(widgetBoardEls);
    } catch (err) {
      const errorMarkup = `<div class="science-loading">${i18n.apodError}</div>`;
      if (elApodMedia) elApodMedia.innerHTML = errorMarkup;
      if (elHeroApodMedia) elHeroApodMedia.innerHTML = errorMarkup;
    }
  }


  const NODE_LAYOUT = {
    pad: 14,
    gap: 12,
    cardW: 216,
    cardH: 122,
    compactW: 146,
    compactH: 40,
    chartW: 304,
    chartH: 196,
    minCanvasH: 220,
    canvasExtraStep: 120,
    canvasStepOptions: [80, 120, 180],
    canvasAutoGrowThreshold: 78,
    canvasBottomClearance: 34,
    snapDistance: 126
  };

  const boardText = isEn ? {
    deckCards: 'cards',
    addCard: 'Add card',
    data: 'Input',
    output: 'Output',
    control: 'Calibration',
    style: 'Style',
    chart: 'Chart',
    unlinked: 'Not linked',
    selectedChart: 'Selected chart',
    cardsCount: (n) => `${n} cards`,
    cardsAvailable: 'Available cards',
    deckBundles: 'packages',
    openDeck: 'View package',
    sponsoredBack: 'Back to sponsored packages',
    sponsoredCta: 'Request integration',
    none: 'none',
    openDetails: 'Open details',
    closeDetails: 'Close details',
    showControls: 'Show controls',
    hideControls: 'Hide controls',
    moreItems: (n) => `+${n} more`,
    activeChart: 'Active chart',
    boardHelp: 'Drag by body, click to select, drag on empty space to marquee-select. Shortcuts: Backspace delete, B lock, D duplicate, Ctrl/Cmd+Z undo, Ctrl/Cmd+Y redo, Shift+Arrows align',
    dragHint: 'Move card across the board',
    snapHint: (slotLabel) => `Release to snap in ${slotLabel.toLowerCase()}`,
    inspectorTitle: 'Card inspector',
    inspectorEmptyTitle: 'Select a card to edit',
    inspectorEmptyHint: 'Click any card in the board to manage settings, links and display.',
    inspectorLinked: 'Linked chart',
    inspectorDetach: 'Detach',
    inspectorFocusChart: 'Focus chart',
    inspectorGoToCard: 'Go to card',
    nodeGoToInspector: 'Open in inspector',
    helpToggleOpen: 'Show board help',
    helpToggleClose: 'Hide board help',
    inspectorExpand: 'Expand card',
    inspectorCompact: 'Compact card',
    inspectorDuplicate: 'Duplicate card',
    inspectorLock: 'Lock position',
    inspectorUnlock: 'Unlock position',
    inspectorCollapse: 'Collapse inspector',
    inspectorExpandPanel: 'Expand inspector',
    inspectorGapMore: 'Increase board space',
    inspectorGapLess: 'Decrease board space',
    inspectorGapStep: 'Step size',
    inspectorStepSmall: 'Small step',
    inspectorStepMedium: 'Medium step',
    inspectorStepLarge: 'Large step',
    inspectorChartLinks: 'Chart links',
    inspectorNoLinks: 'No linked cards yet',
    inspectorRemove: 'Remove card',
    mobileViewsLabel: 'Smartboard views',
    mobileViewDecks: 'Decks',
    mobileViewBoard: 'Board',
    mobileViewInspector: 'Inspector',
    mobileTouchModeLabel: 'Touch mode',
    mobileTouchSelect: 'Select',
    mobileTouchMove: 'Move',
    mobileMoreActions: 'More actions',
    mobileHideActions: 'Hide extra actions',
    mobileCanvasSettings: 'Settings',
    mobileCanvasSettingsOpen: 'Show canvas settings',
    mobileCanvasSettingsClose: 'Hide canvas settings',
    mobileCloseInspector: 'Close inspector',
    mobileQuickEdit: 'Edit',
    mobileEmptyTemplates: 'Use a template',
    mobileEmptyDecks: 'Browse decks',
    mobileSelectionSummary: (n) => n === 1 ? '1 card selected' : `${n} cards selected`,
    traceSource: 'Source',
    traceTimestamp: 'Timestamp',
    traceFormula: 'Formula',
    traceSourceShort: 'SRC',
    traceTimestampShort: 'TS',
    traceFormulaShort: 'FX',
    traceManualSource: 'Manual input',
    traceUnavailable: '--',
    templateButton: 'Templates',
    exportPngButton: 'Export PNG',
    exportCsvButton: 'Export CSV',
    shareUrlButton: 'Share URL',
    exportPngDone: 'PNG exported',
    exportCsvDone: 'CSV exported',
    shareUrlDone: 'Share URL copied',
    shareUrlFail: 'Could not copy URL',
    shareUrlLoaded: 'Shared board state loaded',
    widgetBoardCollapse: 'Collapse smart board',
    widgetBoardExpand: 'Expand smart board',
    arxivBoardCollapse: 'Collapse ArXiv explorer',
    arxivBoardExpand: 'Expand ArXiv explorer',
    exportNoData: 'No data to export yet',
    templateCatalogTitle: 'Board templates',
    templateRole: 'Template',
    applyTemplateAdd: 'Add to board',
    applyTemplateReplace: 'Replace board',
    templateApplied: (name, mode = 'append') => mode === 'replace'
      ? `Template replaced board: ${name}`
      : `Template added: ${name}`
  } : {
    deckCards: 'tarjetas',
    addCard: 'Agregar tarjeta',
    data: 'Entrada',
    output: 'Salida',
    control: 'Calibracion',
    style: 'Estilo',
    chart: 'Grafico',
    unlinked: 'Sin enlace',
    selectedChart: 'Grafico seleccionado',
    cardsCount: (n) => `${n} tarjetas`,
    cardsAvailable: 'Tarjetas disponibles',
    deckBundles: 'paquetes',
    openDeck: 'Ver paquete',
    sponsoredBack: 'Volver a paquetes patrocinados',
    sponsoredCta: 'Solicitar integracion',
    none: 'ninguna',
    openDetails: 'Abrir detalle',
    closeDetails: 'Cerrar detalle',
    showControls: 'Mostrar controles',
    hideControls: 'Ocultar controles',
    moreItems: (n) => `+${n} mas`,
    activeChart: 'Grafico activo',
    boardHelp: 'Arrastra desde el cuerpo, haz clic para seleccionar y arrastra en espacio vacio para seleccionar varias. Atajos: Backspace elimina, B bloquea, D duplica, Ctrl/Cmd+Z deshace, Ctrl/Cmd+Y rehace, Shift+Flechas alinea',
    dragHint: 'Mueve la tarjeta dentro de la pizarra',
    snapHint: (slotLabel) => `Suelta para imantar en ${slotLabel.toLowerCase()}`,
    inspectorTitle: 'Inspector de tarjeta',
    inspectorEmptyTitle: 'Selecciona una tarjeta para editar',
    inspectorEmptyHint: 'Haz clic sobre cualquier tarjeta de la pizarra para gestionar ajustes, enlaces y vista.',
    inspectorLinked: 'Grafico enlazado',
    inspectorDetach: 'Desimantar',
    inspectorFocusChart: 'Ir al grafico',
    inspectorGoToCard: 'Ir a tarjeta',
    nodeGoToInspector: 'Abrir en inspector',
    helpToggleOpen: 'Mostrar ayuda de pizarra',
    helpToggleClose: 'Ocultar ayuda de pizarra',
    inspectorExpand: 'Expandir tarjeta',
    inspectorCompact: 'Compactar tarjeta',
    inspectorDuplicate: 'Duplicar tarjeta',
    inspectorLock: 'Bloquear posicion',
    inspectorUnlock: 'Desbloquear posicion',
    inspectorCollapse: 'Contraer inspector',
    inspectorExpandPanel: 'Expandir inspector',
    inspectorGapMore: 'Aumentar espacio en pizarra',
    inspectorGapLess: 'Reducir espacio en pizarra',
    inspectorGapStep: 'Tamano de paso',
    inspectorStepSmall: 'Paso pequeno',
    inspectorStepMedium: 'Paso medio',
    inspectorStepLarge: 'Paso grande',
    inspectorChartLinks: 'Enlaces del grafico',
    inspectorNoLinks: 'Aun sin tarjetas enlazadas',
    inspectorRemove: 'Eliminar tarjeta',
    mobileViewsLabel: 'Vistas del smartboard',
    mobileViewDecks: 'Tarjeteros',
    mobileViewBoard: 'Pizarra',
    mobileViewInspector: 'Inspector',
    mobileTouchModeLabel: 'Modo tactil',
    mobileTouchSelect: 'Seleccionar',
    mobileTouchMove: 'Mover',
    mobileMoreActions: 'Mas acciones',
    mobileHideActions: 'Ocultar acciones extra',
    mobileCanvasSettings: 'Ajustes',
    mobileCanvasSettingsOpen: 'Mostrar ajustes de lienzo',
    mobileCanvasSettingsClose: 'Ocultar ajustes de lienzo',
    mobileCloseInspector: 'Cerrar inspector',
    mobileQuickEdit: 'Editar',
    mobileEmptyTemplates: 'Usar plantilla',
    mobileEmptyDecks: 'Ver tarjeteros',
    mobileSelectionSummary: (n) => n === 1 ? '1 tarjeta seleccionada' : `${n} tarjetas seleccionadas`,
    traceSource: 'Fuente',
    traceTimestamp: 'Marca temporal',
    traceFormula: 'Formula',
    traceSourceShort: 'FTE',
    traceTimestampShort: 'TS',
    traceFormulaShort: 'FX',
    traceManualSource: 'Entrada manual',
    traceUnavailable: '--',
    templateButton: 'Plantillas',
    exportPngButton: 'Exportar PNG',
    exportCsvButton: 'Exportar CSV',
    shareUrlButton: 'Compartir URL',
    exportPngDone: 'PNG exportado',
    exportCsvDone: 'CSV exportado',
    shareUrlDone: 'URL copiada',
    shareUrlFail: 'No se pudo copiar la URL',
    shareUrlLoaded: 'Estado compartido cargado',
    widgetBoardCollapse: 'Contraer pizarra inteligente',
    widgetBoardExpand: 'Expandir pizarra inteligente',
    arxivBoardCollapse: 'Contraer ArXiv explorer',
    arxivBoardExpand: 'Expandir ArXiv explorer',
    exportNoData: 'Aun no hay datos para exportar',
    templateCatalogTitle: 'Plantillas de pizarra',
    templateRole: 'Plantilla',
    applyTemplateAdd: 'Agregar a pizarra',
    applyTemplateReplace: 'Reemplazar pizarra',
    templateApplied: (name, mode = 'append') => mode === 'replace'
      ? `Plantilla aplicada reemplazando: ${name}`
      : `Plantilla agregada: ${name}`
  };

  const BOARD_TEMPLATES = [
    {
      id: 'tpl-arxiv-pulse',
      name: isEn ? 'ArXiv pulse board' : 'Pizarra pulso ArXiv',
      subtitle: isEn
        ? 'Monthly growth by core areas with calibrated sources'
        : 'Crecimiento mensual por areas clave con fuentes calibradas',
      chart: { deckId: 'arxiv-core', cardId: 'line-chart' },
      cards: [
        { deckId: 'arxiv-core', cardId: 'total-papers', settings: { metric: 'group:cs', transform: 'raw', aggregate: 'growth' } },
        { deckId: 'arxiv-core', cardId: 'total-papers', settings: { metric: 'group:math', transform: 'raw', aggregate: 'growth' } },
        { deckId: 'arxiv-core', cardId: 'total-papers', settings: { metric: 'group:physics', transform: 'raw', aggregate: 'growth' } },
        { deckId: 'arxiv-core', cardId: 'top-category-share' },
        { deckId: 'keywords-lab', cardId: 'period-control', settings: { rangeMonths: 6 } },
        { deckId: 'keywords-lab', cardId: 'source-control', settings: { sourceBlend: { arxiv: 82, journal: 12, nasa: 6 } } },
        { deckId: 'fusion-style', cardId: 'style-depth', settings: { styleDepth: { depth: 46, glow: 28 } } },
        { deckId: 'fusion-style', cardId: 'style-3d', settings: { style3d: { relief: 58, softness: 72 } } },
        { deckId: 'fusion-style', cardId: 'style-color', settings: { styleColor: { palette: 'balanced', contrast: 56 } } }
      ]
    },
    {
      id: 'tpl-radar-areas',
      name: isEn ? 'Area radar board' : 'Pizarra radar por areas',
      subtitle: isEn
        ? 'Cross-area profile with stronger depth and warm contrast'
        : 'Perfil cruzado por areas con mayor profundidad y contraste calido',
      chart: { deckId: 'nasa-signals', cardId: 'radar-chart' },
      cards: [
        { deckId: 'arxiv-core', cardId: 'total-papers', settings: { metric: 'group:cs', transform: 'raw', aggregate: 'sum' } },
        { deckId: 'arxiv-core', cardId: 'total-papers', settings: { metric: 'group:math', transform: 'raw', aggregate: 'sum' } },
        { deckId: 'arxiv-core', cardId: 'total-papers', settings: { metric: 'group:physics', transform: 'raw', aggregate: 'sum' } },
        { deckId: 'arxiv-core', cardId: 'total-papers', settings: { metric: 'group:q-bio', transform: 'raw', aggregate: 'sum' } },
        { deckId: 'arxiv-core', cardId: 'top-category-share' },
        { deckId: 'keywords-lab', cardId: 'topic-density' },
        { deckId: 'keywords-lab', cardId: 'period-control', settings: { rangeMonths: 12 } },
        { deckId: 'keywords-lab', cardId: 'source-control', settings: { sourceBlend: { arxiv: 74, journal: 16, nasa: 10 } } },
        { deckId: 'fusion-style', cardId: 'style-depth', settings: { styleDepth: { depth: 63, glow: 42 } } },
        { deckId: 'fusion-style', cardId: 'style-3d', settings: { style3d: { relief: 74, softness: 64 } } },
        { deckId: 'fusion-style', cardId: 'style-color', settings: { styleColor: { palette: 'warm', contrast: 66 } } }
      ]
    },
    {
      id: 'tpl-heatmap-trends',
      name: isEn ? 'Heatmap trends board' : 'Pizarra heatmap de tendencias',
      subtitle: isEn
        ? 'Topic density and APOD context with cool palette'
        : 'Densidad tematica y contexto APOD con paleta fria',
      chart: { deckId: 'fusion-style', cardId: 'heatmap-chart' },
      cards: [
        { deckId: 'arxiv-core', cardId: 'total-papers', settings: { metric: 'group:cs', transform: 'raw', aggregate: 'sum' } },
        { deckId: 'arxiv-core', cardId: 'total-papers', settings: { metric: 'group:math', transform: 'raw', aggregate: 'sum' } },
        { deckId: 'arxiv-core', cardId: 'keyword-frequency', settings: { metric: 'keyword-top', transform: 'raw', aggregate: 'sum' } },
        { deckId: 'nasa-signals', cardId: 'apod-index', settings: { metric: 'apod-words', transform: 'raw', aggregate: 'last' } },
        { deckId: 'keywords-lab', cardId: 'topic-density' },
        { deckId: 'nasa-signals', cardId: 'context-output' },
        { deckId: 'keywords-lab', cardId: 'period-control', settings: { rangeMonths: 9 } },
        { deckId: 'keywords-lab', cardId: 'source-control', settings: { sourceBlend: { arxiv: 68, journal: 20, nasa: 12 } } },
        { deckId: 'fusion-style', cardId: 'style-depth', settings: { styleDepth: { depth: 58, glow: 46 } } },
        { deckId: 'fusion-style', cardId: 'style-3d', settings: { style3d: { relief: 68, softness: 66 } } },
        { deckId: 'fusion-style', cardId: 'style-color', settings: { styleColor: { palette: 'cool', contrast: 72 } } }
      ]
    }
  ];

  const BOARD_DECKS = [
    {
      id: 'arxiv-core',
      tone: 'arxiv',
      logo: 'AX',
      name: isEn ? 'ArXiv Core' : 'ArXiv Core',
      subtitle: isEn ? 'Publication signals by area' : 'Señales de publicacion por area',
      sleeveTitle: isEn ? 'ArXiv Core' : 'ArXiv Core',
      sleeveSubtitle: isEn ? 'Signals by area' : 'Señales por area',
      cards: [
        { id: 'total-papers', role: 'data', title: isEn ? 'Total papers (6m)' : 'Total publicaciones (6m)', value: '1,041', note: isEn ? 'Source: ArXiv cache' : 'Fuente: cache ArXiv' },
        { id: 'keyword-frequency', role: 'data', title: isEn ? 'Keyword frequency' : 'Frecuencia por palabra', value: '312', note: isEn ? 'For selected period and source' : 'Para periodo y fuente seleccionada' },
        { id: 'top-category-share', role: 'output', title: isEn ? 'Top category share' : 'Participacion categoria lider', value: '34%', note: isEn ? 'Computer science' : 'Ciencias de la computacion' },
        { id: 'line-chart', role: 'chart', title: isEn ? 'Line chart' : 'Grafico de linea', value: isEn ? 'Time trend chart' : 'Grafico de tendencia temporal', note: isEn ? 'Attach cards around this node' : 'Adhiere tarjetas alrededor de este nodo' }
      ]
    },
    {
      id: 'keywords-lab',
      tone: 'keywords',
      logo: 'KW',
      name: isEn ? 'Keyword Lab' : 'Laboratorio de keywords',
      subtitle: isEn ? 'Semantic and trend cards' : 'Tarjetas semanticas y de tendencia',
      sleeveTitle: isEn ? 'Keyword Lab' : 'Laboratorio keywords',
      sleeveSubtitle: isEn ? 'Semantic trends' : 'Tendencias semanticas',
      cards: [
        { id: 'topic-density', role: 'output', title: isEn ? 'Topic density map' : 'Mapa de densidad tematica', value: '4 clusters', note: isEn ? 'Computes term concentration' : 'Calcula concentracion de terminos' },
        { id: 'period-control', role: 'control', title: isEn ? 'Period selector' : 'Selector de periodos', value: isEn ? '3m / 6m / 12m' : '3m / 6m / 12m', note: isEn ? 'Calibration card' : 'Tarjeta de calibracion' },
        { id: 'source-control', role: 'control', title: isEn ? 'Source blend' : 'Mezcla de fuentes', value: isEn ? 'ArXiv + Blog + NASA' : 'ArXiv + Blog + NASA', note: isEn ? 'Adjust source weight' : 'Ajusta peso por fuente' }
      ]
    },
    {
      id: 'nasa-signals',
      tone: 'nasa',
      logo: 'NA',
      name: isEn ? 'NASA Signals' : 'Señales NASA',
      subtitle: isEn ? 'APOD and event cards' : 'Tarjetas APOD y eventos',
      sleeveTitle: isEn ? 'NASA Signals' : 'Señales NASA',
      sleeveSubtitle: isEn ? 'APOD and events' : 'APOD y eventos',
      cards: [
        { id: 'apod-index', role: 'data', title: isEn ? 'APOD activity index' : 'Indice actividad APOD', value: '78/100', note: isEn ? 'Image and tag extraction' : 'Extraccion de imagen y tags' },
        { id: 'context-output', role: 'output', title: isEn ? 'Cross-reference context' : 'Contexto de referencia cruzada', value: '19 links', note: isEn ? 'Related papers and tags' : 'Papers y tags relacionados' },
        { id: 'radar-chart', role: 'chart', title: isEn ? 'Radar chart' : 'Grafico radar', value: isEn ? 'Multisource profile' : 'Perfil multisource', note: isEn ? 'Compare source groups' : 'Compara grupos de fuentes' }
      ]
    },
    {
      id: 'fusion-style',
      tone: 'fusion',
      logo: 'FX',
      name: isEn ? 'Fusion + Style' : 'Fusion + Estilo',
      subtitle: isEn ? 'Output polish cards' : 'Tarjetas de pulido visual',
      sleeveTitle: isEn ? 'Fusion + Style' : 'Fusion + Estilo',
      sleeveSubtitle: isEn ? 'Visual polish' : 'Pulido visual',
      cards: [
        { id: 'style-depth', role: 'style', title: isEn ? 'Depth and glow' : 'Profundidad y glow', value: isEn ? 'Subtle 3D' : '3D sutil', note: isEn ? 'Shadows and attenuation' : 'Sombras y atenuacion' },
        { id: 'style-3d', role: 'style', title: isEn ? 'Tridimensionality' : 'Tridimensionalidad', value: isEn ? 'Hero-like depth profile' : 'Perfil de profundidad tipo hero', note: isEn ? 'Relief, bevel and soft light shaping' : 'Relieve, bisel y modelado de luz suave' },
        { id: 'style-color', role: 'style', title: isEn ? 'Color profile' : 'Perfil de color', value: isEn ? 'Blue to red contrast' : 'Contraste azul a rojo', note: isEn ? 'Gradient and accent control' : 'Control de gradiente y acentos' },
        { id: 'heatmap-chart', role: 'chart', title: isEn ? 'Heatmap chart' : 'Grafico heatmap', value: isEn ? 'Intensity matrix' : 'Matriz de intensidad', note: isEn ? 'Attach inputs and modifiers' : 'Adhiere entradas y modificadores' }
      ]
    },
    {
      id: 'sponsored-decks',
      tone: 'sponsored',
      logo: 'SP',
      name: isEn ? 'Sponsored data packages' : 'Paquetes de datos patrocinados',
      subtitle: isEn ? 'Turn institutional data into decision products' : 'Convierte datos institucionales en productos de decision',
      sleeveTitle: isEn ? 'Sponsored packages' : 'Paquetes patrocinados',
      sleeveSubtitle: isEn ? 'B2B showcase' : 'Vitrina B2B',
      cards: [],
      sponsoredDecks: ['sponsored-mit', 'sponsored-imperial', 'sponsored-eth']
    },
    {
      id: 'sponsored-mit',
      tone: 'sponsored',
      hiddenInRail: true,
      sponsoredParent: 'sponsored-decks',
      name: isEn ? 'Publications package (demo)' : 'Paquete de publicaciones (demo)',
      subtitle: isEn ? 'Showcase research KPIs for partners and prospects' : 'Muestra KPIs de investigacion para aliados y prospectos',
      sleeveTitle: isEn ? 'Research intelligence' : 'Inteligencia de investigacion',
      sleeveSubtitle: isEn ? 'B2B demo package' : 'Paquete demo B2B',
      cards: [
        { id: 'sp-mit-total', role: 'data', title: isEn ? 'Institutional KPI snapshot (demo)' : 'Snapshot KPI institucional (demo)', value: isEn ? 'Your KPI here' : 'Tu KPI aqui', note: isEn ? 'Example: publications, citations, or growth by area' : 'Ejemplo: publicaciones, citas o crecimiento por area' },
        { id: 'sp-mit-keyword', role: 'data', title: isEn ? 'Narrative signal card (demo)' : 'Tarjeta de narrativa (demo)', value: isEn ? 'Sales-ready insight' : 'Insight listo para ventas', note: isEn ? 'Translate complex research data into clear stakeholder language' : 'Traduce datos complejos en mensajes claros para stakeholders' },
        { id: 'sp-mit-line', role: 'chart', title: isEn ? 'Executive trend board (demo)' : 'Tablero ejecutivo de tendencia (demo)', value: isEn ? 'Interactive story chart' : 'Grafico narrativo interactivo', note: isEn ? 'Attach cards to build a sales narrative for your data product' : 'Conecta tarjetas para construir una narrativa comercial de tu producto de datos' }
      ]
    },
    {
      id: 'sponsored-imperial',
      tone: 'sponsored',
      hiddenInRail: true,
      sponsoredParent: 'sponsored-decks',
      name: isEn ? 'Admissions package (demo)' : 'Paquete de admisiones (demo)',
      subtitle: isEn ? 'Convert admissions data into strategic dashboards' : 'Convierte datos de admision en dashboards estrategicos',
      sleeveTitle: isEn ? 'Admissions intelligence' : 'Inteligencia de admisiones',
      sleeveSubtitle: isEn ? 'B2B demo package' : 'Paquete demo B2B',
      cards: [
        { id: 'sp-imp-admit-rate', role: 'output', title: isEn ? 'Admissions conversion KPI (demo)' : 'KPI de conversion de admisiones (demo)', value: isEn ? 'Your KPI here' : 'Tu KPI aqui', note: isEn ? 'Show your funnel from leads to accepted candidates' : 'Muestra tu embudo desde leads hasta candidatos admitidos' },
        { id: 'sp-imp-applications', role: 'output', title: isEn ? 'Demand growth signal (demo)' : 'Senal de crecimiento de demanda (demo)', value: isEn ? 'Pipeline growth' : 'Crecimiento de pipeline', note: isEn ? 'Highlight demand momentum by market, program, or campaign' : 'Destaca el impulso de demanda por mercado, programa o campana' },
        { id: 'sp-imp-radar', role: 'chart', title: isEn ? 'Admissions executive profile (demo)' : 'Perfil ejecutivo de admisiones (demo)', value: isEn ? 'Comparative strategy chart' : 'Grafico comparativo estrategico', note: isEn ? 'Compare programs, cycles, and yield scenarios in one view' : 'Compara programas, ciclos y escenarios de rendimiento en una sola vista' }
      ]
    },
    {
      id: 'sponsored-eth',
      tone: 'sponsored',
      hiddenInRail: true,
      sponsoredParent: 'sponsored-decks',
      name: isEn ? 'Lab operations package (demo)' : 'Paquete de operaciones de laboratorio (demo)',
      subtitle: isEn ? 'Productize lab and transfer signals for sponsors' : 'Productiza señales de laboratorio y transferencia para patrocinadores',
      sleeveTitle: isEn ? 'Lab operations' : 'Operaciones de laboratorio',
      sleeveSubtitle: isEn ? 'B2B demo package' : 'Paquete demo B2B',
      cards: [
        { id: 'sp-eth-lab-output', role: 'data', title: isEn ? 'Lab throughput KPI (demo)' : 'KPI de throughput de laboratorios (demo)', value: isEn ? 'Your KPI here' : 'Tu KPI aqui', note: isEn ? 'Expose publication and experiment velocity by lab unit' : 'Expone velocidad de publicaciones y experimentos por unidad de laboratorio' },
        { id: 'sp-eth-transfer', role: 'output', title: isEn ? 'Transfer opportunity pipeline (demo)' : 'Pipeline de oportunidades de transferencia (demo)', value: isEn ? 'Opportunity score' : 'Score de oportunidad', note: isEn ? 'Track deals, patents, and spin-off opportunities in one card' : 'Sigue acuerdos, patentes y oportunidades de spin-off en una tarjeta' },
        { id: 'sp-eth-heatmap', role: 'chart', title: isEn ? 'Sponsor-ready operations map (demo)' : 'Mapa operativo listo para sponsors (demo)', value: isEn ? 'Custom operations matrix' : 'Matriz operativa personalizada', note: isEn ? 'Attach inputs and controls to present sponsor-ready operations insight' : 'Conecta entradas y controles para presentar insights operativos para sponsors' }
      ]
    }
  ];

  const boardState = {
    nodes: [],
    selectedChartId: '',
    sequence: 0,
    currentDeckId: '',
    detailNodeId: '',
    optionsNodeId: '',
    activeNodeId: '',
    selectedNodeIds: [],
    inspectorCollapsed: false,
    helpOpen: false,
    canvasUserExtra: 0,
    canvasHeight: NODE_LAYOUT.minCanvasH,
    canvasStep: NODE_LAYOUT.canvasExtraStep
  };

  const boardDrag = {
    active: false,
    nodeId: '',
    nodeEl: null,
    pointerId: null,
    offsetX: 0,
    offsetY: 0,
    moved: false,
    skipClick: false,
    grabTimer: 0,
    snapPreview: null
  };

  const boardHold = {
    active: false,
    nodeId: '',
    nodeEl: null,
    pointerId: null,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
    timer: 0
  };

  const boardResize = {
    active: false,
    nodeId: '',
    nodeEl: null,
    pointerId: null,
    dir: '',
    startX: 0,
    startY: 0,
    startLeft: 0,
    startTop: 0,
    startW: 0,
    startH: 0,
    moved: false
  };

  const WIDGETBOARD_STORAGE_KEY = `bcc-widgetboard-v2-${pageLang}`;
  let boardPersistTimer = 0;
  let boardPersistenceEnabled = false;
  let boardNodeFocusTimer = 0;
  let boardInspectorFocusTimer = 0;
  let boardTemplateImportPending = false;
  const boardPerfCounters = {
    renderBoardCanvas: 0,
    refreshLinkedDataNodes: 0,
    historySerialize: 0,
    autoTitleBuilds: 0,
    legendMapBuilds: 0,
    traceContextBuilds: 0,
    chartPreviewBuilds: 0,
    slotRealigns: 0
  };
  const boardRenderCache = {
    mode: '',
    nodeOrder: [],
    nodeMarkupById: new Map(),
    groupLabelsMarkup: '',
    emptyMarkup: ''
  };

  const boardHistory = {
    stack: [],
    index: -1,
    limit: 90,
    suspended: false
  };
  let boardHistoryDirty = true;

  function markBoardHistoryDirty() {
    boardHistoryDirty = true;
  }

  function clearBoardHistoryDirty() {
    boardHistoryDirty = false;
  }

  const BOARD_MOBILE_BREAKPOINT = 860;
  const BOARD_MOBILE_VIEWS = ['decks', 'board', 'inspector'];
  const BOARD_TOUCH_MODES = ['select', 'move'];
  const boardMobileState = {
    view: 'decks',
    touchMode: 'select',
    actionsMenuOpen: false,
    canvasSettingsOpen: false,
    inspectorSheetOpen: false
  };

  const boardMarquee = {
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    moved: false,
    additive: false,
    baseIds: [],
    previewIds: [],
    skipClick: false
  };

  function getStoredSequence(nodes, fallback = 0) {
    const fromNodes = (Array.isArray(nodes) ? nodes : []).reduce((max, node) => {
      const match = String(node?.uid || '').match(/^wb-(\d+)$/);
      if (!match) return max;
      const value = Number(match[1]);
      return Number.isFinite(value) ? Math.max(max, value) : max;
    }, 0);
    const parsedFallback = Number(fallback);
    return Math.max(fromNodes, Number.isFinite(parsedFallback) ? parsedFallback : 0);
  }

  function normalizeCanvasStep(raw) {
    const value = Number(raw);
    const options = Array.isArray(NODE_LAYOUT.canvasStepOptions) ? NODE_LAYOUT.canvasStepOptions : [NODE_LAYOUT.canvasExtraStep];
    if (Number.isFinite(value) && options.includes(value)) return value;
    return NODE_LAYOUT.canvasExtraStep;
  }

  function getCanvasStepLabel(step) {
    const normalized = normalizeCanvasStep(step);
    if (normalized <= 80) return boardText.inspectorStepSmall;
    if (normalized >= 180) return boardText.inspectorStepLarge;
    return boardText.inspectorStepMedium;
  }

  function normalizeStoredNode(raw) {
    if (!raw || typeof raw !== 'object') return null;

    const role = String(raw.role || '').toLowerCase();
    const validRoles = new Set(['data', 'output', 'control', 'style', 'chart']);
    if (!validRoles.has(role)) return null;

    const uid = String(raw.uid || '').trim();
    if (!uid) return null;

    const node = {
      uid,
      deckId: String(raw.deckId || ''),
      cardId: String(raw.cardId || ''),
      role,
      title: String(raw.title || ''),
      value: String(raw.value || ''),
      note: String(raw.note || ''),
      attachedTo: String(raw.attachedTo || ''),
      compact: !!raw.compact,
      expanded: !!raw.expanded,
      resized: !!raw.resized,
      locked: !!raw.locked,
      x: Number(raw.x),
      y: Number(raw.y),
      w: Number(raw.w),
      h: Number(raw.h),
      settings: raw.settings && typeof raw.settings === 'object' ? { ...raw.settings } : {}
    };

    if (role === 'chart') {
      node.links = {
        top: Array.isArray(raw?.links?.top) ? raw.links.top.map(String) : [],
        left: Array.isArray(raw?.links?.left) ? raw.links.left.map(String) : [],
        right: Array.isArray(raw?.links?.right) ? raw.links.right.map(String) : [],
        bottom: Array.isArray(raw?.links?.bottom) ? raw.links.bottom.map(String) : []
      };
    }

    return node;
  }

  function sanitizeBoardNodes(rawNodes) {
    const nodes = (Array.isArray(rawNodes) ? rawNodes : [])
      .map(normalizeStoredNode)
      .filter(Boolean);

    if (!nodes.length) return [];

    const byId = new Map(nodes.map((node) => [node.uid, node]));

    nodes.forEach((node) => {
      if (node.role !== 'chart') return;
      if (!node.links || typeof node.links !== 'object') {
        node.links = { top: [], left: [], right: [], bottom: [] };
      }

      ['top', 'left', 'right', 'bottom'].forEach((slot) => {
        const seen = new Set();
        node.links[slot] = (Array.isArray(node.links[slot]) ? node.links[slot] : [])
          .map((id) => String(id || ''))
          .filter((id) => {
            if (!id || seen.has(id)) return false;
            const linked = byId.get(id);
            if (!linked || linked.role === 'chart') return false;
            seen.add(id);
            return true;
          });
      });
    });

    nodes.forEach((node) => {
      if (node.role === 'chart') return;
      if (!node.attachedTo || !byId.has(node.attachedTo) || byId.get(node.attachedTo)?.role !== 'chart') {
        node.attachedTo = '';
      }
    });

    nodes.forEach((node) => {
      if (node.role !== 'chart') return;
      ['top', 'left', 'right', 'bottom'].forEach((slot) => {
        node.links[slot].forEach((nodeId) => {
          const linked = byId.get(nodeId);
          if (linked) linked.attachedTo = node.uid;
        });
      });
    });

    nodes.forEach((node) => {
      if (node.role === 'chart' || !node.attachedTo) return;
      const chart = byId.get(node.attachedTo);
      if (!chart || chart.role !== 'chart') {
        node.attachedTo = '';
        return;
      }

      const slot = getSlotFromRole(node.role);
      if (!slot) return;
      if (!Array.isArray(chart.links[slot])) chart.links[slot] = [];
      if (!chart.links[slot].includes(node.uid)) {
        chart.links[slot].push(node.uid);
      }
    });

    return nodes;
  }

  function buildWidgetBoardSnapshot() {
    return {
      version: 5,
      lang: pageLang,
      savedAt: new Date().toISOString(),
      selectedChartId: boardState.selectedChartId,
      activeNodeId: boardState.activeNodeId,
      selectedNodeIds: Array.isArray(boardState.selectedNodeIds) ? boardState.selectedNodeIds.slice() : [],
      inspectorCollapsed: !!boardState.inspectorCollapsed,
      widgetBoardCollapsed: !!(widgetBoardEls?.section?.classList.contains('is-collapsed')),
      arxivBoardCollapsed: !!(widgetBoardEls?.arxivSection?.classList.contains('is-collapsed')),
      canvasUserExtra: Number(boardState.canvasUserExtra || 0),
      canvasHeight: Number(boardState.canvasHeight || NODE_LAYOUT.minCanvasH),
      canvasStep: Number(boardState.canvasStep || NODE_LAYOUT.canvasExtraStep),
      sequence: boardState.sequence,
      nodes: boardState.nodes.map((node) => {
        const payload = {
          uid: node.uid,
          deckId: node.deckId,
          cardId: node.cardId,
          role: node.role,
          title: node.title,
          value: node.value,
          note: node.note,
          attachedTo: node.attachedTo || '',
          compact: !!node.compact,
          expanded: !!node.expanded,
          resized: !!node.resized,
          locked: !!node.locked,
          x: Number(node.x || 0),
          y: Number(node.y || 0),
          w: Number(node.w || 0),
          h: Number(node.h || 0),
          settings: node.settings && typeof node.settings === 'object' ? { ...node.settings } : {}
        };

        if (node.role === 'chart') {
          payload.links = {
            top: Array.isArray(node?.links?.top) ? node.links.top.slice() : [],
            left: Array.isArray(node?.links?.left) ? node.links.left.slice() : [],
            right: Array.isArray(node?.links?.right) ? node.links.right.slice() : [],
            bottom: Array.isArray(node?.links?.bottom) ? node.links.bottom.slice() : []
          };
        }

        return payload;
      })
    };
  }

  function persistWidgetBoardStateNow() {
    if (!boardPersistenceEnabled) return;
    try {
      const payload = buildWidgetBoardSnapshot();
      localStorage.setItem(WIDGETBOARD_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore quota/storage errors to avoid breaking UI interactions.
    }
  }

  function scheduleWidgetBoardPersist() {
    if (!boardPersistenceEnabled) return;
    if (boardPersistTimer) {
      window.clearTimeout(boardPersistTimer);
    }
    boardPersistTimer = window.setTimeout(() => {
      boardPersistTimer = 0;
      persistWidgetBoardStateNow();
    }, 140);
  }

  function applyWidgetBoardSnapshot(parsed, els, options = {}) {
    if (!parsed || typeof parsed !== 'object') return false;

    const nodes = sanitizeBoardNodes(parsed?.nodes || []);

    boardState.nodes = nodes;
    boardState.sequence = getStoredSequence(nodes, parsed?.sequence);

    const selectedCandidate = String(parsed?.selectedChartId || '');
    if (selectedCandidate && nodes.some((node) => node.uid === selectedCandidate && node.role === 'chart')) {
      boardState.selectedChartId = selectedCandidate;
    } else {
      boardState.selectedChartId = nodes.find((node) => node.role === 'chart')?.uid || '';
    }

    const activeCandidate = String(parsed?.activeNodeId || '');
    if (activeCandidate && nodes.some((node) => node.uid === activeCandidate)) {
      boardState.activeNodeId = activeCandidate;
    } else {
      boardState.activeNodeId = boardState.selectedChartId || nodes[0]?.uid || '';
    }

    const selectedNodeCandidates = Array.isArray(parsed?.selectedNodeIds) ? parsed.selectedNodeIds.map(String) : [];
    boardState.selectedNodeIds = selectedNodeCandidates.filter((id, idx, list) => id && list.indexOf(id) === idx && nodes.some((node) => node.uid === id));
    if (!boardState.selectedNodeIds.length && boardState.activeNodeId) {
      boardState.selectedNodeIds = [boardState.activeNodeId];
    }

    boardState.inspectorCollapsed = !!parsed?.inspectorCollapsed;
    boardState.helpOpen = false;

    if (typeof parsed?.widgetBoardCollapsed === 'boolean') {
      setWidgetBoardCollapsed(parsed.widgetBoardCollapsed, els);
    } else {
      syncWidgetBoardCollapseUI(els);
    }

    if (typeof parsed?.arxivBoardCollapsed === 'boolean') {
      setArxivBoardCollapsed(parsed.arxivBoardCollapsed, els);
    } else {
      syncArxivBoardCollapseUI(els);
    }
    const parsedExtra = Number(parsed?.canvasUserExtra);
    const legacyGapExpanded = !!parsed?.inspectorGapExpanded;
    boardState.canvasUserExtra = Number.isFinite(parsedExtra) && parsedExtra >= 0
      ? parsedExtra
      : (legacyGapExpanded ? NODE_LAYOUT.canvasExtraStep : 0);

    const baseHeight = NODE_LAYOUT.minCanvasH + Math.max(0, Number(boardState.canvasUserExtra || 0));
    const parsedCanvasHeight = Number(parsed?.canvasHeight);
    boardState.canvasHeight = Number.isFinite(parsedCanvasHeight) && parsedCanvasHeight >= baseHeight
      ? parsedCanvasHeight
      : baseHeight;

    boardState.canvasStep = normalizeCanvasStep(parsed?.canvasStep);

    boardState.detailNodeId = '';
    boardState.optionsNodeId = '';

    boardState.nodes.forEach((node) => {
      ensureNodeSettings(node);
      ensureNodeSize(node);
      updateNodeMetricSnapshot(node);
    });

    if (els?.canvas && options.render !== false) {
      renderBoardCanvas(els);
    }

    clearBoardHistoryDirty();
    return nodes.length > 0;
  }

  function parseBoardSnapshotFromUrlParam(encoded) {
    const raw = String(encoded || '').trim();
    if (!raw) return null;

    const base64 = raw.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);

    try {
      const binary = atob(padded);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      const decoded = new TextDecoder().decode(bytes);
      return JSON.parse(decoded);
    } catch {
      return null;
    }
  }

  function restoreWidgetBoardStateFromUrl(els) {
    if (typeof window === 'undefined' || !window.location) return false;

    const search = String(window.location.search || '');
    if (!search) return false;

    let params = null;
    try {
      params = new URLSearchParams(search);
    } catch {
      return false;
    }

    const encoded = params.get('wb') || '';
    if (!encoded) return false;

    const parsed = parseBoardSnapshotFromUrlParam(encoded);
    if (!parsed) return false;

    return applyWidgetBoardSnapshot(parsed, els);
  }

  function restoreWidgetBoardState(els) {
    let raw = '';
    try {
      raw = localStorage.getItem(WIDGETBOARD_STORAGE_KEY) || '';
    } catch {
      return false;
    }

    if (!raw) return false;

    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return false;
    }

    return applyWidgetBoardSnapshot(parsed, els);
  }

  function clearWidgetBoardStoredState() {
    if (boardPersistTimer) {
      window.clearTimeout(boardPersistTimer);
      boardPersistTimer = 0;
    }

    try {
      localStorage.removeItem(WIDGETBOARD_STORAGE_KEY);
    } catch {
      // Ignore storage errors.
    }
  }


  function buildExportTimestampStamp() {
    const now = new Date();
    const part = (value) => String(value).padStart(2, '0');
    return `${now.getFullYear()}${part(now.getMonth() + 1)}${part(now.getDate())}-${part(now.getHours())}${part(now.getMinutes())}`;
  }

  function triggerBlobDownload(blob, filename) {
    if (!blob || !filename) return false;
    const link = document.createElement('a');
    const objectUrl = URL.createObjectURL(blob);

    link.href = objectUrl;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
    }, 1200);

    return true;
  }

  function escapeCsvCell(value) {
    const raw = String(value ?? '');
    if (!/[\"\n,]/.test(raw)) return raw;
    return '"' + raw.replace(/"/g, '""') + '"';
  }

  function buildWidgetBoardCsv() {
    const chartNodes = getChartNodes();
    if (!chartNodes.length) return '';

    const rows = [];
    chartNodes.forEach((chart) => {
      const dataset = buildChartInputDataset(chart);
      if (!dataset || !Array.isArray(dataset.channels) || !dataset.channels.length) return;

      const months = Array.isArray(dataset.months) ? dataset.months : [];
      const sourceLabel = formatSourceBlendForTrace(dataset.sourceBlend || SOURCE_DEFAULT_BLEND).label || boardText.traceUnavailable;
      const sourceTimestamp = getLatestSourceIso(SOURCE_KEYS);
      const sourceTimestampLabel = sourceTimestamp ? formatDateTime(sourceTimestamp) : boardText.traceUnavailable;
      const chartKind = getChartKindFromCard(chart);
      const chartTraceFormula = buildNodeTraceFormula(chart, 'verbose');

      dataset.channels.forEach((channel) => {
        const inputNode = getNodeById(channel.id) || null;
        const metric = inputNode ? resolveMetricForNode(inputNode) : String(channel.metric || '');
        const transform = inputNode ? normalizeTransformId(inputNode?.settings?.transform) : normalizeTransformId(channel.transform || 'raw');
        const aggregate = inputNode ? normalizeAggregateId(inputNode?.settings?.aggregate) : 'last';
        const keyword = inputNode ? sanitizeKeywordInput(inputNode?.settings?.keyword || '') : '';
        const seriesLabel = String(channel.label || inputNode?.title || '--');

        months.forEach((month, idx) => {
          const numericValue = Number(channel.values?.[idx] || 0);
          rows.push({
            chart_uid: chart.uid,
            chart_title: chart.title,
            chart_kind: chartKind,
            range_months: dataset.range,
            input_uid: channel.id,
            input_title: inputNode?.title || seriesLabel,
            series_label: seriesLabel,
            metric_id: metric,
            metric_label: getMetricLabel(metric, keyword),
            transform_id: transform,
            transform_label: getTransformLabel(transform),
            aggregate_id: aggregate,
            aggregate_label: getAggregateLabel(aggregate),
            month: month,
            month_label: formatMonthLabel(month),
            value: numericValue,
            source: sourceLabel,
            source_timestamp: sourceTimestampLabel,
            chart_formula: chartTraceFormula
          });
        });
      });
    });

    if (!rows.length) return '';

    const columns = [
      'chart_uid',
      'chart_title',
      'chart_kind',
      'range_months',
      'input_uid',
      'input_title',
      'series_label',
      'metric_id',
      'metric_label',
      'transform_id',
      'transform_label',
      'aggregate_id',
      'aggregate_label',
      'month',
      'month_label',
      'value',
      'source',
      'source_timestamp',
      'chart_formula'
    ];

    const lines = [columns.join(',')];
    rows.forEach((row) => {
      lines.push(columns.map((key) => escapeCsvCell(row[key])).join(','));
    });

    return lines.join('\n');
  }

  function exportWidgetBoardCsv(els) {
    const csv = buildWidgetBoardCsv();
    if (!csv) {
      setCanvasMeta(els, boardText.exportNoData);
      return false;
    }

    const fileName = `science-board-${pageLang}-${buildExportTimestampStamp()}.csv`;
    const csvBlob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const downloaded = triggerBlobDownload(csvBlob, fileName);
    if (downloaded) {
      setCanvasMeta(els, boardText.exportCsvDone);
    }
    return downloaded;
  }

  function inlineComputedStylesRecursive(sourceNode, targetNode) {
    if (!(sourceNode instanceof Element) || !(targetNode instanceof Element)) return;

    const computed = window.getComputedStyle(sourceNode);
    let cssText = '';
    for (const propertyName of computed) {
      cssText += `${propertyName}:${computed.getPropertyValue(propertyName)};`;
    }
    targetNode.setAttribute('style', cssText);

    const sourceChildren = sourceNode.children || [];
    const targetChildren = targetNode.children || [];
    const childCount = Math.min(sourceChildren.length, targetChildren.length);
    for (let i = 0; i < childCount; i += 1) {
      inlineComputedStylesRecursive(sourceChildren[i], targetChildren[i]);
    }
  }

  function canvasToBlob(canvas, type = 'image/png', quality = 0.95) {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), type, quality);
    });
  }

  async function exportWidgetBoardPng(els) {
    if (!els?.canvas || !boardState.nodes.length) {
      setCanvasMeta(els, boardText.exportNoData);
      return false;
    }

    const width = Math.max(1, Math.round(els.canvas.clientWidth || 0));
    const height = Math.max(1, Math.round(els.canvas.clientHeight || 0));
    if (!width || !height) {
      setCanvasMeta(els, boardText.exportNoData);
      return false;
    }

    const clone = els.canvas.cloneNode(true);
    inlineComputedStylesRecursive(els.canvas, clone);

    clone.querySelectorAll('[data-resize-dir], .node-snap-preview, .board-selection-marquee').forEach((element) => {
      element.remove();
    });

    clone.style.margin = '0';
    clone.style.width = `${width}px`;
    clone.style.height = `${height}px`;
    clone.style.overflow = 'hidden';

    const wrap = document.createElement('div');
    wrap.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
    wrap.style.width = `${width}px`;
    wrap.style.height = `${height}px`;
    wrap.style.margin = '0';
    wrap.style.padding = '0';
    wrap.style.overflow = 'hidden';
    wrap.style.background = window.getComputedStyle(els.canvas).backgroundColor || '#ffffff';
    wrap.appendChild(clone);

    const serialized = new XMLSerializer().serializeToString(wrap);
    const svgMarkup = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject width="100%" height="100%">${serialized}</foreignObject></svg>`;

    const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);

    try {
      const image = new Image();
      image.decoding = 'async';
      await new Promise((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = (err) => reject(err);
        image.src = svgUrl;
      });

      const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      const outputCanvas = document.createElement('canvas');
      outputCanvas.width = Math.max(1, Math.round(width * ratio));
      outputCanvas.height = Math.max(1, Math.round(height * ratio));

      const ctx = outputCanvas.getContext('2d');
      if (!ctx) {
        setCanvasMeta(els, boardText.exportNoData);
        return false;
      }

      ctx.scale(ratio, ratio);
      ctx.fillStyle = window.getComputedStyle(els.canvas).backgroundColor || '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(image, 0, 0, width, height);

      const pngBlob = await canvasToBlob(outputCanvas, 'image/png', 0.96);
      if (!pngBlob) {
        setCanvasMeta(els, boardText.exportNoData);
        return false;
      }

      const fileName = `science-board-${pageLang}-${buildExportTimestampStamp()}.png`;
      const downloaded = triggerBlobDownload(pngBlob, fileName);
      if (downloaded) {
        setCanvasMeta(els, boardText.exportPngDone);
      }
      return downloaded;
    } catch {
      setCanvasMeta(els, boardText.exportNoData);
      return false;
    } finally {
      URL.revokeObjectURL(svgUrl);
    }
  }

  function buildBoardShareParam() {
    let snapshot = null;
    try {
      snapshot = buildWidgetBoardSnapshot();
    } catch {
      return '';
    }

    try {
      const json = JSON.stringify(snapshot);
      const bytes = new TextEncoder().encode(json);
      const chunkSize = 0x8000;
      let binary = '';
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
      }
      return btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
    } catch {
      return '';
    }
  }

  function buildWidgetBoardShareUrl() {
    if (typeof window === 'undefined' || !window.location) return '';
    const payload = buildBoardShareParam();
    if (!payload) return '';

    try {
      const url = new URL(window.location.href);
      url.searchParams.set('wb', payload);
      return url.toString();
    } catch {
      return '';
    }
  }

  async function copyWidgetBoardShareUrl(els) {
    const shareUrl = buildWidgetBoardShareUrl();
    if (!shareUrl) {
      setCanvasMeta(els, boardText.shareUrlFail);
      return false;
    }

    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const input = document.createElement('textarea');
        input.value = shareUrl;
        input.setAttribute('readonly', 'readonly');
        input.style.position = 'fixed';
        input.style.opacity = '0';
        input.style.left = '-9999px';
        document.body.appendChild(input);
        input.select();
        const copied = document.execCommand('copy');
        input.remove();
        if (!copied) throw new Error('copy-failed');
      }

      setCanvasMeta(els, boardText.shareUrlDone);
      return true;
    } catch {
      setCanvasMeta(els, boardText.shareUrlFail);
      return false;
    }
  }

  function syncBoardActionButtons(els) {
    if (!els) return;

    const hasNodes = boardState.nodes.length > 0;

    const toggleDisabled = (button, disabled) => {
      if (!button) return;
      const isLoading = button.classList.contains('is-loading');
      button.disabled = !!disabled || isLoading;
      button.classList.toggle('is-disabled-empty', !!disabled && !isLoading);
    };

    toggleDisabled(els.exportPngBtn, !hasNodes);
    toggleDisabled(els.exportCsvBtn, !hasNodes);
    toggleDisabled(els.shareUrlBtn, !hasNodes);
    toggleDisabled(els.clearBtn, !hasNodes);
  }

  function setBoardActionLoading(button, isLoading) {
    if (!button) return;

    const loading = !!isLoading;
    button.classList?.toggle?.('is-loading', loading);
    if ('disabled' in button) {
      button.disabled = loading;
    }
    if (loading) {
      button.setAttribute?.('aria-busy', 'true');
    } else {
      button.removeAttribute?.('aria-busy');
    }

    syncBoardActionButtons(widgetBoardEls);
  }

  function setTemplateImportLoading(els, activeButton, isLoading) {
    const loading = !!isLoading;
    const buttons = Array.from(els?.modalList?.querySelectorAll?.('[data-apply-template]') || []);

    buttons.forEach((button) => {
      if (button === activeButton) {
        setBoardActionLoading(button, loading);
        return;
      }

      if ('disabled' in button) {
        button.disabled = loading;
      }
      button.classList?.toggle?.('is-busy-peer', loading);
      if (loading) {
        button.setAttribute?.('aria-disabled', 'true');
      } else {
        button.removeAttribute?.('aria-disabled');
      }
    });

    if (activeButton && !buttons.includes(activeButton)) {
      setBoardActionLoading(activeButton, loading);
    }

    els?.modalList?.classList?.toggle?.('is-busy', loading);
  }

  function waitForNextBoardPaint() {
    return new Promise((resolve) => {
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => resolve());
        return;
      }

      const schedule = typeof window !== 'undefined' && typeof window.setTimeout === 'function'
        ? window.setTimeout.bind(window)
        : setTimeout;
      schedule(resolve, 0);
    });
  }

  async function runBoardAction(button, action) {
    if (button?.classList.contains('is-loading')) return false;

    setBoardActionLoading(button, true);
    try {
      return await action();
    } finally {
      setBoardActionLoading(button, false);
    }
  }

  function clampNumber(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function getRoleLabel(role) {
    return boardText[role] || role;
  }

  function getSlotLabel(slot) {
    if (slot === 'left') return boardText.data;
    if (slot === 'right') return boardText.output;
    if (slot === 'top') return boardText.control;
    if (slot === 'bottom') return boardText.style;
    return boardText.none;
  }

  function getChartLinkedCount(chart) {
    if (!chart?.links) return 0;
    return ['top', 'left', 'right', 'bottom'].reduce((total, slot) => {
      const list = Array.isArray(chart.links[slot]) ? chart.links[slot] : [];
      return total + list.length;
    }, 0);
  }

  function renderChartSlotMetrics(chart, variant = 'grid') {
    const slotMap = [
      { slot: 'left', label: boardText.data },
      { slot: 'top', label: boardText.control },
      { slot: 'right', label: boardText.output },
      { slot: 'bottom', label: boardText.style }
    ];

    return slotMap.map(({ slot, label }) => {
      const amount = Array.isArray(chart?.links?.[slot]) ? chart.links[slot].length : 0;
      const filledClass = amount > 0 ? 'is-filled' : '';
      const variantClass = variant === 'pill' ? 'is-pill' : '';
      return `<span class="chart-metric ${variantClass} ${filledClass}"><strong>${label}</strong><em>${amount}</em></span>`;
    }).join('');
  }


  function getNodeAriaLabel(node) {
    if (!node) return '';

    const role = getRoleLabel(node.role);
    const title = String(node.title || '').trim();
    const value = String(node.value || '').trim();

    if (node.role === 'chart') {
      const linkedCount = getChartLinkedCount(node);
      return `${role}. ${title}. ${boardText.cardsCount(linkedCount)}.`;
    }

    const linkedChart = getNodeLinkedChart(node);
    const status = linkedChart
      ? `${boardText.inspectorLinked}: ${linkedChart.title}`
      : boardText.unlinked;

    const parts = [role, title, value, status].filter(Boolean);
    return `${parts.join('. ')}.`;
  }



  function getLatestIsoCandidate(candidates) {
    let latestValue = '';
    let latestTime = -Infinity;

    (Array.isArray(candidates) ? candidates : []).forEach((candidate) => {
      const raw = String(candidate || '').trim();
      if (!raw) return;
      const parsed = new Date(raw);
      const parsedTime = parsed.getTime();
      if (Number.isNaN(parsedTime)) return;
      if (parsedTime > latestTime) {
        latestTime = parsedTime;
        latestValue = parsed.toISOString();
      }
    });

    return latestValue;
  }

  function getLatestJournalIso() {
    if (!Array.isArray(scienceCache.journalPosts) || !scienceCache.journalPosts.length) return '';

    const dates = scienceCache.journalPosts.map((post) => (
      post?.updatedAt || post?.published || post?.date || post?.updated || ''
    ));

    return getLatestIsoCandidate(dates);
  }

  function getSourceLatestIso(sourceKey) {
    const key = String(sourceKey || '').toLowerCase();

    if (key === 'arxiv') {
      return getLatestIsoCandidate([scienceCache.arxiv?.updatedAt]);
    }

    if (key === 'journal') {
      return getLatestJournalIso();
    }

    if (key === 'nasa') {
      return getLatestIsoCandidate([scienceCache.apod?.updatedAt, scienceCache.apod?.date]);
    }

    return '';
  }

  function getLatestSourceIso(sourceKeys = [], traceContext = null) {
    const keys = Array.isArray(sourceKeys) && sourceKeys.length
      ? sourceKeys
      : SOURCE_KEYS;

    const contextMap = traceContext && typeof traceContext === 'object' && traceContext.latestBySource
      ? traceContext.latestBySource
      : null;

    if (contextMap && typeof contextMap === 'object') {
      const contextCandidates = keys
        .map((key) => String(contextMap[String(key || '').toLowerCase()] || '').trim())
        .filter(Boolean);
      const latestFromContext = getLatestIsoCandidate(contextCandidates);
      if (latestFromContext) return latestFromContext;

      const latestAny = String(traceContext?.latestAny || '').trim();
      if (latestAny) return latestAny;
    }

    const candidates = keys.map((key) => getSourceLatestIso(key));
    const latest = getLatestIsoCandidate(candidates);

    if (latest) return latest;

    return getLatestIsoCandidate([
      scienceCache.arxiv?.updatedAt,
      getLatestJournalIso(),
      scienceCache.apod?.updatedAt,
      scienceCache.apod?.date
    ]);
  }

  function formatSourceBlendForTrace(blend) {
    const normalized = normalizeSourceBlend(blend || SOURCE_DEFAULT_BLEND);
    const activeKeys = SOURCE_KEYS.filter((key) => Number(normalized[key] || 0) > 0);
    if (!activeKeys.length) {
      return {
        label: boardText.traceUnavailable,
        sourceKeys: []
      };
    }

    if (activeKeys.length === 1) {
      const singleKey = activeKeys[0];
      const pct = Number(normalized[singleKey] || 0);
      if (pct >= 99) {
        return {
          label: SOURCE_LABELS[singleKey] || singleKey,
          sourceKeys: activeKeys
        };
      }
    }

    return {
      label: activeKeys.map((key) => `${SOURCE_LABELS[key] || key} ${Math.round(Number(normalized[key] || 0))}%`).join(' / '),
      sourceKeys: activeKeys
    };
  }


  function buildTraceRenderContext() {
    const cacheKey = `${pageLang}|${scienceCacheRevision}`;
    if (traceRenderContextMemoKey === cacheKey && traceRenderContextMemoValue) {
      return traceRenderContextMemoValue;
    }

    boardPerfCounters.traceContextBuilds += 1;
    const latestBySource = {
      arxiv: getSourceLatestIso('arxiv'),
      journal: getSourceLatestIso('journal'),
      nasa: getSourceLatestIso('nasa')
    };

    const latestAny = getLatestIsoCandidate([
      latestBySource.arxiv,
      latestBySource.journal,
      latestBySource.nasa
    ]);

    traceRenderContextMemoKey = cacheKey;
    traceRenderContextMemoValue = {
      latestBySource,
      latestAny,
      defaultSourceBlend: formatSourceBlendForTrace(getDefaultSourceBlendFromCache())
    };

    return traceRenderContextMemoValue;
  }

  function buildNodeTraceSourceContext(node, traceContext = null) {
    if (!node) {
      return {
        sourceLabel: boardText.traceUnavailable,
        sourceKeys: []
      };
    }

    if (node.role === 'control' && node.cardId === 'source-control') {
      const blend = getNodeSourceBlend(node);
      const formatted = formatSourceBlendForTrace(blend);
      return {
        sourceLabel: formatted.label,
        sourceKeys: formatted.sourceKeys
      };
    }

    const linkedChart = node.role === 'chart' ? node : getNodeLinkedChart(node);
    if (linkedChart) {
      const blend = getChartSourceBlend(linkedChart);
      const formatted = formatSourceBlendForTrace(blend);
      return {
        sourceLabel: formatted.label,
        sourceKeys: formatted.sourceKeys
      };
    }

    if (node.role === 'data' || node.role === 'output') {
      const cachedDefault = traceContext && typeof traceContext === 'object' && traceContext.defaultSourceBlend
        ? traceContext.defaultSourceBlend
        : null;
      const formatted = cachedDefault && typeof cachedDefault === 'object'
        ? cachedDefault
        : formatSourceBlendForTrace(getDefaultSourceBlendFromCache());
      return {
        sourceLabel: formatted.label,
        sourceKeys: formatted.sourceKeys
      };
    }

    return {
      sourceLabel: boardText.traceManualSource,
      sourceKeys: []
    };
  }

  function buildNodeTraceFormula(node, detailLevel = 'compact') {
    if (!node) return boardText.traceUnavailable;

    const isVerbose = detailLevel === 'verbose';

    if (node.role === 'data') {
      const metric = resolveMetricForNode(node);
      const keyword = sanitizeKeywordInput(node?.settings?.keyword || '');
      const transform = normalizeTransformId(node?.settings?.transform);
      const aggregate = normalizeAggregateId(node?.settings?.aggregate);
      const metricLabel = getMetricLabel(metric, keyword);
      const transformLabel = getTransformLabel(transform);
      const aggregateLabel = getAggregateLabel(aggregate);

      if (!isVerbose) {
        return transform === 'raw'
          ? `${metricLabel} -> ${aggregateLabel}`
          : `${metricLabel} -> ${aggregateLabel} (${transformLabel})`;
      }

      const metricExpr = `series=${metricLabel}`;
      const transformExpr = transform === 'raw'
        ? (isEn ? 'transform=none' : 'transformacion=ninguna')
        : `${isEn ? 'transform' : 'transformacion'}=${transformLabel}`;
      const aggregateExpr = `${isEn ? 'summary' : 'resumen'}=${aggregateLabel}`;
      return `${metricExpr}; ${transformExpr}; ${aggregateExpr}`;
    }

    if (node.role === 'chart') {
      const kind = getChartKindFromCard(node);
      const range = getChartRange(node);

      if (!isVerbose) {
        if (kind === 'line') {
          return isEn
            ? `Series by month (${range}m)`
            : `Serie por mes (${range}m)`;
        }
        if (kind === 'radar') {
          return isEn
            ? `Input aggregate radar (${range}m)`
            : `Radar agregado por entrada (${range}m)`;
        }
        if (kind === 'heatmap') {
          return isEn
            ? `Input x month heatmap (${range}m)`
            : `Heatmap entrada x mes (${range}m)`;
        }
        return isEn ? 'Derived from linked inputs' : 'Derivado de entradas enlazadas';
      }

      if (kind === 'line') {
        return isEn
          ? `x=months (${range}m), y=value for each linked input`
          : `x=meses (${range}m), y=valor para cada entrada enlazada`;
      }
      if (kind === 'radar') {
        return isEn
          ? `radius=input summary over ${range}m, angle=input channel`
          : `radio=resumen por entrada en ${range}m, angulo=canal de entrada`;
      }
      if (kind === 'heatmap') {
        return isEn
          ? `cell(input, month)=input value in range ${range}m`
          : `celda(entrada, mes)=valor de entrada en rango ${range}m`;
      }
      return isEn ? 'Rendered from linked dataset' : 'Renderizado desde dataset enlazado';
    }

    if (node.role === 'output') {
      const cardId = String(node.cardId || '').toLowerCase();
      if (cardId === 'top-category-share') {
        return isVerbose
          ? (isEn ? 'share = leader_total / sum(channel_totals) * 100' : 'share = total_lider / suma(totales_canal) * 100')
          : (isEn ? 'leader / total * 100' : 'lider / total * 100');
      }
      if (cardId === 'topic-density') {
        return isVerbose
          ? (isEn
            ? 'topics = categories*w_arxiv + journal*w_journal + apod*w_nasa'
            : 'temas = categorias*w_arxiv + journal*w_journal + apod*w_nasa')
          : (isEn ? 'weighted topic density' : 'densidad de temas ponderada');
      }
      if (cardId === 'context-output') {
        return isVerbose
          ? (isEn
            ? 'matches = hits_arxiv*w_a + hits_journal*w_j + tokens_apod*w_n'
            : 'coincidencias = hits_arxiv*w_a + hits_journal*w_j + tokens_apod*w_n')
          : (isEn ? 'weighted cross-source matches' : 'coincidencias ponderadas entre fuentes');
      }
      return isEn ? 'Derived from linked chart dataset' : 'Derivado del dataset del grafico enlazado';
    }

    if (node.role === 'control') {
      const cardId = String(node.cardId || '').toLowerCase();
      if (cardId === 'period-control') {
        const range = clampRangeMonths(node?.settings?.rangeMonths || heroState.range || 6);
        return isVerbose
          ? (isEn ? `rangeMonths = ${range}` : `rangeMonths = ${range}`)
          : (isEn ? `${range}m window` : `ventana ${range}m`);
      }
      if (cardId === 'source-control') {
        return isVerbose
          ? (isEn ? 'weights normalized before metrics: w_arxiv+w_journal+w_nasa=100%' : 'pesos normalizados antes de metricas: w_arxiv+w_journal+w_nasa=100%')
          : (isEn ? 'source weights sum = 100%' : 'suma de pesos de fuente = 100%');
      }
      return isEn ? 'Manual calibration parameter' : 'Parametro de calibracion manual';
    }

    if (node.role === 'style') {
      const cardId = String(node.cardId || '').toLowerCase();
      if (cardId === 'style-depth') {
        return isVerbose
          ? (isEn ? 'render modifier: depth + glow attenuation' : 'modificador de render: profundidad + atenuacion glow')
          : (isEn ? 'depth + glow profile' : 'perfil profundidad + glow');
      }
      if (cardId === 'style-color') {
        return isVerbose
          ? (isEn ? 'render modifier: palette + contrast mapping' : 'modificador de render: mapeo de paleta + contraste')
          : (isEn ? 'palette + contrast profile' : 'perfil paleta + contraste');
      }
      if (cardId === 'style-3d') {
        return isVerbose
          ? (isEn ? 'render modifier: relief + softness 3d profile' : 'modificador de render: perfil 3d de relieve + suavidad')
          : (isEn ? 'relief + softness 3d' : 'relieve + suavidad 3d');
      }
      return isEn ? 'Visual post-processing modifier' : 'Modificador visual de post-proceso';
    }

    return String(node.note || node.value || boardText.traceUnavailable).trim() || boardText.traceUnavailable;
  }

  function buildNodeTraceability(node, detailLevel = 'compact', traceContext = null) {
    const sourceContext = buildNodeTraceSourceContext(node, traceContext);
    const sourceLabel = String(sourceContext.sourceLabel || boardText.traceUnavailable).trim() || boardText.traceUnavailable;
    const latestIso = getLatestSourceIso(sourceContext.sourceKeys || [], traceContext);
    const timestampLabel = latestIso ? formatDateTime(latestIso) : boardText.traceUnavailable;
    const formulaLabel = buildNodeTraceFormula(node, detailLevel);

    return {
      source: sourceLabel,
      timestamp: timestampLabel,
      formula: formulaLabel || boardText.traceUnavailable
    };
  }

  function renderNodeTraceMarkup(node, variant = 'card', traceContext = null) {
    const detailLevel = variant === 'inspector' ? 'verbose' : 'compact';
    const trace = buildNodeTraceability(node, detailLevel, traceContext);
    const source = escapeHtml(trace.source || boardText.traceUnavailable);
    const timestamp = escapeHtml(trace.timestamp || boardText.traceUnavailable);
    const formula = escapeHtml(trace.formula || boardText.traceUnavailable);

    if (variant === 'inspector') {
      return `
        <div class="inspector-trace-grid">
          <div class="inspector-trace-row"><strong>${boardText.traceSource}</strong><span>${source}</span></div>
          <div class="inspector-trace-row"><strong>${boardText.traceTimestamp}</strong><span>${timestamp}</span></div>
          <div class="inspector-trace-row"><strong>${boardText.traceFormula}</strong><span>${formula}</span></div>
        </div>
      `;
    }

    return `
      <div class="node-trace-row" aria-label="traceability">
        <span class="node-trace-pill"><strong>${boardText.traceSourceShort}</strong><em>${source}</em></span>
        <span class="node-trace-pill"><strong>${boardText.traceTimestampShort}</strong><em>${timestamp}</em></span>
        <span class="node-trace-pill"><strong>${boardText.traceFormulaShort}</strong><em>${formula}</em></span>
      </div>
    `;
  }

  function getNodeElementSelector(nodeId) {
    if (!nodeId) return '';
    if (window.CSS && typeof window.CSS.escape === 'function') {
      return `[data-node-id="${window.CSS.escape(nodeId)}"]`;
    }
    return `[data-node-id="${String(nodeId).replace(/["\\]/g, '')}"]`;
  }

  function highlightBoardNode(nodeId, els) {
    if (!els?.canvas || !nodeId) return;
    const selector = getNodeElementSelector(nodeId);
    if (!selector) return;

    const nodeEl = els.canvas.querySelector(selector);
    if (!nodeEl) return;

    nodeEl.classList.remove('is-nav-focus');
    void nodeEl.offsetWidth;
    nodeEl.classList.add('is-nav-focus');

    if (boardNodeFocusTimer) {
      window.clearTimeout(boardNodeFocusTimer);
    }
    boardNodeFocusTimer = window.setTimeout(() => {
      nodeEl.classList.remove('is-nav-focus');
      boardNodeFocusTimer = 0;
    }, 900);
  }

  function highlightInspectorPanel(els) {
    const panel = els?.inspector?.querySelector('.widget-inspector-panel');
    if (!panel) return;

    panel.classList.remove('is-jump-highlight');
    void panel.offsetWidth;
    panel.classList.add('is-jump-highlight');

    if (boardInspectorFocusTimer) {
      window.clearTimeout(boardInspectorFocusTimer);
    }
    boardInspectorFocusTimer = window.setTimeout(() => {
      panel.classList.remove('is-jump-highlight');
      boardInspectorFocusTimer = 0;
    }, 780);
  }

  function focusNodeFromInspector(nodeId, els) {
    const node = getNodeById(nodeId);
    if (!node) return false;

    boardState.activeNodeId = node.uid;
    setBoardSelection([node.uid], { activeId: node.uid });
    if (node.role === 'chart') {
      boardState.selectedChartId = node.uid;
    } else if (node.attachedTo) {
      const linkedChart = getNodeById(node.attachedTo);
      if (linkedChart?.role === 'chart') {
        boardState.selectedChartId = linkedChart.uid;
      }
    }

    if (boardState.detailNodeId) boardState.detailNodeId = '';
    if (boardState.optionsNodeId) boardState.optionsNodeId = '';

    renderBoardCanvas(els);
    if (isBoardMobileUI()) {
      closeBoardInspectorSheet(els, { view: 'board' });
    }

    window.requestAnimationFrame(() => {
      if (!els?.canvas) return;

      const selector = getNodeElementSelector(node.uid);
      if (!selector) return;
      const nodeEl = els.canvas.querySelector(selector);
      if (!nodeEl) return;

      nodeEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      if (typeof nodeEl.focus === 'function') {
        try {
          nodeEl.focus({ preventScroll: true });
        } catch {
          nodeEl.focus();
        }
      }
      highlightBoardNode(node.uid, els);
    });

    return true;
  }

  function focusInspectorFromNode(nodeId, els) {
    const node = getNodeById(nodeId);
    if (!node) return false;

    boardState.activeNodeId = node.uid;
    setBoardSelection([node.uid], { activeId: node.uid });
    if (node.role === 'chart') {
      boardState.selectedChartId = node.uid;
    } else if (node.attachedTo) {
      const linkedChart = getNodeById(node.attachedTo);
      if (linkedChart?.role === 'chart') {
        boardState.selectedChartId = linkedChart.uid;
      }
    }

    if (boardState.inspectorCollapsed) boardState.inspectorCollapsed = false;
    if (boardState.helpOpen) boardState.helpOpen = false;

    renderBoardCanvas(els);

    window.requestAnimationFrame(() => {
      if (!els?.inspector) return;
      if (isBoardMobileUI()) {
        openBoardInspectorSheet(els);
        highlightInspectorPanel(els);
        return;
      }
      els.inspector.scrollIntoView({ behavior: 'smooth', block: 'center' });
      highlightInspectorPanel(els);
    });

    return true;
  }

  function getBoardEmptyActionsMarkup() {
    return `
      <div class="widget-empty-actions">
        <button type="button" class="widget-empty-action is-primary" data-board-empty-action="templates">${boardText.mobileEmptyTemplates}</button>
        <button type="button" class="widget-empty-action" data-board-empty-action="decks">${boardText.mobileEmptyDecks}</button>
      </div>
    `;
  }

  function getBoardQuickHelpMarkup() {
    if (isEn) {
      return '<strong>Start in 3 steps:</strong><span>1) Open a deck and add a chart card</span><span>2) Snap input on the left, output on the right, and controls on top</span><span>3) Right-click any card to open inspector</span><span>Drag on empty canvas to marquee-select multiple cards</span><span><kbd>Backspace</kbd> delete | <kbd>B</kbd> lock/unlock | <kbd>D</kbd> duplicate | <kbd>Ctrl/Cmd+Z</kbd> undo | <kbd>Ctrl/Cmd+Y</kbd> redo</span><span><kbd>Shift + Arrows</kbd> align left/right/top/bottom | <kbd>Shift+H</kbd> center X | <kbd>Shift+V</kbd> center Y</span><span>Use the <kbd>?</kbd> button on the top-right to reopen this guide.</span>';
    }
    return '<strong>Empieza en 3 pasos:</strong><span>1) Abre un tarjetero y agrega una tarjeta de grafico</span><span>2) Imanta entrada a la izquierda, salida a la derecha y controles arriba</span><span>3) Clic derecho sobre una tarjeta para abrir inspector</span><span>Arrastra en espacio vacio para seleccionar varias tarjetas</span><span><kbd>Backspace</kbd> elimina | <kbd>B</kbd> bloquea/desbloquea | <kbd>D</kbd> duplica | <kbd>Ctrl/Cmd+Z</kbd> deshace | <kbd>Ctrl/Cmd+Y</kbd> rehace</span><span><kbd>Shift + Flechas</kbd> alinea izquierda/derecha/arriba/abajo | <kbd>Shift+H</kbd> centra X | <kbd>Shift+V</kbd> centra Y</span><span>Usa el boton <kbd>?</kbd> arriba a la derecha para reabrir esta guia.</span>';
  }

  function syncBoardHelpPopover(els) {
    if (!els?.helpPopover || !els?.helpToggleBtn) return;

    const closeLabel = escapeHtml(boardText.helpToggleClose);
    els.helpPopover.innerHTML = `<button class="widget-help-close" type="button" data-help-close aria-label="${closeLabel}" title="${closeLabel}">x</button>${getBoardQuickHelpMarkup()}`;

    const isOpen = !!boardState.helpOpen;
    els.helpPopover.hidden = !isOpen;
    els.helpToggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');

    const toggleLabel = isOpen ? boardText.helpToggleClose : boardText.helpToggleOpen;
    els.helpToggleBtn.setAttribute('aria-label', toggleLabel);
    els.helpToggleBtn.setAttribute('title', toggleLabel);
  }

  function setBoardHelpOpen(nextOpen, els) {
    boardState.helpOpen = !!nextOpen;
    syncBoardHelpPopover(els);

  }

  function isTypingTarget(target) {
    if (!target) return false;
    if (target.isContentEditable) return true;

    const tagName = String(target.tagName || '').toLowerCase();
    return tagName === 'input' || tagName === 'textarea' || tagName === 'select';
  }

  function sanitizeSelectionNodeIds(rawIds) {
    const validIds = new Set(boardState.nodes.map((node) => node.uid));
    const seen = new Set();
    const list = [];

    (Array.isArray(rawIds) ? rawIds : []).forEach((rawId) => {
      const id = String(rawId || '');
      if (!id || seen.has(id) || !validIds.has(id)) return;
      seen.add(id);
      list.push(id);
    });

    return list;
  }

  function getSelectedBoardNodeIds() {
    boardState.selectedNodeIds = sanitizeSelectionNodeIds(boardState.selectedNodeIds);
    return boardState.selectedNodeIds.slice();
  }

  function getEffectiveSelectionNodeIds() {
    const selectedIds = getSelectedBoardNodeIds();
    if (selectedIds.length) return selectedIds;

    const active = getNodeById(boardState.activeNodeId);
    return active ? [active.uid] : [];
  }

  function setBoardSelection(nodeIds, options = {}) {
    const nextIds = sanitizeSelectionNodeIds(nodeIds);
    boardState.selectedNodeIds = nextIds;

    const preferredActive = String(options.activeId || '');
    if (preferredActive && nextIds.includes(preferredActive)) {
      boardState.activeNodeId = preferredActive;
    } else if (nextIds.length && !nextIds.includes(boardState.activeNodeId)) {
      boardState.activeNodeId = nextIds[nextIds.length - 1];
    }

    if (!nextIds.length && options.clearActive) {
      boardState.activeNodeId = '';
    }

    if (boardState.detailNodeId && !nextIds.includes(boardState.detailNodeId)) {
      boardState.detailNodeId = '';
    }
    if (boardState.optionsNodeId && !nextIds.includes(boardState.optionsNodeId)) {
      boardState.optionsNodeId = '';
    }
  }

  function toggleBoardSelectionNode(nodeId) {
    const id = String(nodeId || '');
    if (!id) return;

    const selectedIds = getSelectedBoardNodeIds();
    if (selectedIds.includes(id)) {
      setBoardSelection(selectedIds.filter((entry) => entry !== id));
      if (boardState.activeNodeId === id) {
        boardState.activeNodeId = boardState.selectedNodeIds.slice(-1)[0] || boardState.selectedChartId || boardState.nodes[0]?.uid || '';
      }
      return;
    }

    setBoardSelection([...selectedIds, id], { activeId: id });
  }

  function getActiveBoardNode() {
    const active = getNodeById(boardState.activeNodeId);
    if (active) return active;

    const selectedIds = getSelectedBoardNodeIds();
    if (selectedIds.length) {
      const selectedNode = getNodeById(selectedIds[selectedIds.length - 1]);
      if (selectedNode) return selectedNode;
    }

    const selected = getNodeById(boardState.selectedChartId);
    if (selected) return selected;

    return boardState.nodes[0] || null;
  }

  function buildBoardHistorySnapshot() {
    return {
      selectedChartId: boardState.selectedChartId,
      activeNodeId: boardState.activeNodeId,
      selectedNodeIds: getSelectedBoardNodeIds(),
      sequence: Number(boardState.sequence || 0),
      inspectorCollapsed: !!boardState.inspectorCollapsed,
      canvasUserExtra: Number(boardState.canvasUserExtra || 0),
      canvasHeight: Number(boardState.canvasHeight || NODE_LAYOUT.minCanvasH),
      canvasStep: Number(boardState.canvasStep || NODE_LAYOUT.canvasExtraStep),
      nodes: boardState.nodes.map((node) => {
        const payload = {
          uid: node.uid,
          deckId: node.deckId,
          cardId: node.cardId,
          role: node.role,
          title: node.title,
          value: node.value,
          note: node.note,
          attachedTo: node.attachedTo || '',
          compact: !!node.compact,
          expanded: !!node.expanded,
          resized: !!node.resized,
          locked: !!node.locked,
          x: Number(node.x || 0),
          y: Number(node.y || 0),
          w: Number(node.w || 0),
          h: Number(node.h || 0),
          settings: node.settings && typeof node.settings === 'object' ? { ...node.settings } : {}
        };

        if (node.role === 'chart') {
          payload.links = {
            top: Array.isArray(node?.links?.top) ? node.links.top.slice() : [],
            left: Array.isArray(node?.links?.left) ? node.links.left.slice() : [],
            right: Array.isArray(node?.links?.right) ? node.links.right.slice() : [],
            bottom: Array.isArray(node?.links?.bottom) ? node.links.bottom.slice() : []
          };
        }

        return payload;
      })
    };
  }

  function pushBoardHistoryState() {
    if (boardHistory.suspended || !boardHistoryDirty) return false;

    let serialized = '';
    try {
      boardPerfCounters.historySerialize += 1;
      serialized = JSON.stringify(buildBoardHistorySnapshot());
    } catch {
      return false;
    }

    if (!serialized) {
      clearBoardHistoryDirty();
      return false;
    }

    const current = boardHistory.index >= 0 ? boardHistory.stack[boardHistory.index] : '';
    if (serialized === current) {
      clearBoardHistoryDirty();
      return false;
    }

    if (boardHistory.index < boardHistory.stack.length - 1) {
      boardHistory.stack = boardHistory.stack.slice(0, boardHistory.index + 1);
    }

    boardHistory.stack.push(serialized);
    if (boardHistory.stack.length > boardHistory.limit) {
      boardHistory.stack.shift();
    }

    boardHistory.index = boardHistory.stack.length - 1;
    clearBoardHistoryDirty();
    return true;
  }

  function initBoardHistoryState() {
    boardHistory.stack = [];
    boardHistory.index = -1;
    markBoardHistoryDirty();
    pushBoardHistoryState();
  }

  function applyBoardHistorySnapshot(serialized, els) {
    if (!serialized) return false;

    let parsed = null;
    try {
      parsed = JSON.parse(serialized);
    } catch {
      return false;
    }

    const nodes = sanitizeBoardNodes(parsed?.nodes || []);

    boardState.nodes = nodes;
    boardState.sequence = getStoredSequence(nodes, parsed?.sequence);

    const selectedCandidate = String(parsed?.selectedChartId || '');
    if (selectedCandidate && nodes.some((node) => node.uid === selectedCandidate && node.role === 'chart')) {
      boardState.selectedChartId = selectedCandidate;
    } else {
      boardState.selectedChartId = nodes.find((node) => node.role === 'chart')?.uid || '';
    }

    const activeCandidate = String(parsed?.activeNodeId || '');
    if (activeCandidate && nodes.some((node) => node.uid === activeCandidate)) {
      boardState.activeNodeId = activeCandidate;
    } else {
      boardState.activeNodeId = boardState.selectedChartId || nodes[0]?.uid || '';
    }

    boardState.selectedNodeIds = sanitizeSelectionNodeIds(parsed?.selectedNodeIds || []);
    if (!boardState.selectedNodeIds.length && boardState.activeNodeId) {
      boardState.selectedNodeIds = [boardState.activeNodeId];
    }

    boardState.inspectorCollapsed = !!parsed?.inspectorCollapsed;
    boardState.helpOpen = false;
    boardState.canvasUserExtra = Math.max(0, Number(parsed?.canvasUserExtra || 0));
    const baseHeight = NODE_LAYOUT.minCanvasH + boardState.canvasUserExtra;
    const parsedCanvasHeight = Number(parsed?.canvasHeight);
    boardState.canvasHeight = Number.isFinite(parsedCanvasHeight) && parsedCanvasHeight >= baseHeight
      ? parsedCanvasHeight
      : baseHeight;
    boardState.canvasStep = normalizeCanvasStep(parsed?.canvasStep);
    boardState.detailNodeId = '';
    boardState.optionsNodeId = '';

    boardState.nodes.forEach((node) => {
      ensureNodeSettings(node);
      ensureNodeSize(node);
      updateNodeMetricSnapshot(node);
    });

    clearBoardHold();
    clearBoardResize();
    clearBoardMarquee(els);
    clearSnapPreview(els);

    boardHistory.suspended = true;
    try {
      renderBoardCanvas(els);
    } finally {
      boardHistory.suspended = false;
      clearBoardHistoryDirty();
    }

    return true;
  }

  function undoBoardHistory(els) {
    if (boardHistory.index <= 0) return false;
    boardHistory.index -= 1;
    return applyBoardHistorySnapshot(boardHistory.stack[boardHistory.index], els);
  }

  function redoBoardHistory(els) {
    if (boardHistory.index < 0 || boardHistory.index >= boardHistory.stack.length - 1) return false;
    boardHistory.index += 1;
    return applyBoardHistorySnapshot(boardHistory.stack[boardHistory.index], els);
  }

  function handleBoardShortcut(event, els) {
    if (!els || isTypingTarget(event.target)) return false;
    if (els.modal && !els.modal.hidden) return false;

    const key = String(event.key || '').toLowerCase();
    const hasCtrlLike = !!(event.ctrlKey || event.metaKey);

    if (hasCtrlLike && key === 'z' && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      return undoBoardHistory(els);
    }

    if (((hasCtrlLike && key === 'y') || (hasCtrlLike && key === 'z' && event.shiftKey)) && !event.altKey) {
      event.preventDefault();
      return redoBoardHistory(els);
    }

    if (event.altKey || hasCtrlLike) return false;

    if (event.shiftKey) {
      let alignMode = '';
      if (event.key === 'ArrowLeft') alignMode = 'left';
      else if (event.key === 'ArrowRight') alignMode = 'right';
      else if (event.key === 'ArrowUp') alignMode = 'top';
      else if (event.key === 'ArrowDown') alignMode = 'bottom';
      else if (key === 'h') alignMode = 'center-x';
      else if (key === 'v') alignMode = 'center-y';

      if (alignMode) {
        const aligned = alignNodesInBoard(getEffectiveSelectionNodeIds(), alignMode, els);
        if (aligned) event.preventDefault();
        return aligned;
      }
      return false;
    }

    const selectionIds = getEffectiveSelectionNodeIds();
    if (!selectionIds.length) return false;

    if (key === 'backspace') {
      event.preventDefault();
      removeNodesFromBoard(selectionIds, els);
      return true;
    }

    if (key === 'b') {
      event.preventDefault();
      toggleNodesLock(selectionIds, els);
      return true;
    }

    if (key === 'd') {
      event.preventDefault();
      duplicateNodesInBoard(selectionIds, els);
      return true;
    }

    return false;
  }

  function setCanvasMeta(els, extra = '') {
    if (!els?.canvasMeta) return;
    const parts = [boardText.cardsCount(boardState.nodes.length)];
    const selected = getNodeById(boardState.selectedChartId);
    if (selected?.role === 'chart') {
      parts.push(`${boardText.activeChart}: ${selected.title}`);
    }

    const selectionCount = getSelectedBoardNodeIds().length;
    if (selectionCount > 1) {
      parts.push(isEn ? `${selectionCount} selected` : `${selectionCount} seleccionadas`);
    }

    if (extra) {
      parts.push(extra);
    } else if (boardState.nodes.length) {
      parts.push(boardText.boardHelp);
    }
    els.canvasMeta.textContent = parts.join(' | ');
  }

  function getSlotFromRole(role) {
    if (role === 'data') return 'left';
    if (role === 'output') return 'right';
    if (role === 'control') return 'top';
    if (role === 'style') return 'bottom';
    return '';
  }

  function getNodeDimensions(node) {
    if (!node) return { w: NODE_LAYOUT.cardW, h: NODE_LAYOUT.cardH };
    if (node.role === 'chart') return { w: NODE_LAYOUT.chartW, h: NODE_LAYOUT.chartH };
    if (node.compact) return { w: NODE_LAYOUT.compactW, h: NODE_LAYOUT.compactH };
    return { w: NODE_LAYOUT.cardW, h: NODE_LAYOUT.cardH };
  }

  function getNodeMinDimensions(node) {
    if (!node) return { w: 126, h: 34 };
    if (node.role === 'chart') return { w: 236, h: 152 };
    if (node.compact) {
      if ((node.role === 'control' || node.role === 'style') && node.attachedTo) return { w: 86, h: 34 };
      return { w: 126, h: 34 };
    }
    return { w: 172, h: 82 };
  }

  function ensureNodeSize(node, forceDefault = false) {
    if (!node) return;
    const base = getNodeDimensions(node);
    const min = getNodeMinDimensions(node);

    if (forceDefault || !Number.isFinite(Number(node.w)) || !Number.isFinite(Number(node.h))) {
      node.w = base.w;
      node.h = base.h;
    }

    node.w = Math.max(min.w, Number(node.w));
    node.h = Math.max(min.h, Number(node.h));
  }

  function setNodeCompact(node, compact) {
    if (!node || node.role === 'chart') return;
    node.compact = !!compact;
    if (!node.compact) node.expanded = false;

    if (!node.resized) {
      ensureNodeSize(node, true);
    } else {
      ensureNodeSize(node);
    }
  }

  function getCanvasSize(canvas) {
    const width = Math.max(canvas?.clientWidth || 0, NODE_LAYOUT.cardW + NODE_LAYOUT.pad * 2);
    const height = Math.max(canvas?.clientHeight || 0, NODE_LAYOUT.minCanvasH);
    return { width, height };
  }

  function fitNodeToCanvas(node, canvas) {
    if (!node || !canvas) return;
    ensureNodeSize(node);
    const { width } = getCanvasSize(canvas);
    const min = getNodeMinDimensions(node);
    const maxW = Math.max(min.w, width - NODE_LAYOUT.pad * 2);
    node.w = Math.max(min.w, Math.min(maxW, Number(node.w || min.w)));
    node.h = Math.max(min.h, Number(node.h || min.h));
    const maxX = Math.max(NODE_LAYOUT.pad, width - node.w - NODE_LAYOUT.pad);
    node.x = clampNumber(Number(node.x || NODE_LAYOUT.pad), NODE_LAYOUT.pad, maxX);
    node.y = Math.max(NODE_LAYOUT.pad, Number(node.y || NODE_LAYOUT.pad));
  }

  function getCanvasContentBottom() {
    if (!boardState.nodes.length) return 0;
    return boardState.nodes.reduce((max, node) => {
      ensureNodeSize(node);
      return Math.max(max, Number(node.y || 0) + node.h);
    }, 0);
  }

  function getCanvasBaseHeight() {
    return NODE_LAYOUT.minCanvasH + Math.max(0, Number(boardState.canvasUserExtra || 0));
  }

  function getCanvasRequiredHeight(baseHeight = getCanvasBaseHeight()) {
    if (!boardState.nodes.length) return baseHeight;
    const bottom = getCanvasContentBottom();
    return Math.max(baseHeight, Math.ceil(bottom + NODE_LAYOUT.pad + NODE_LAYOUT.canvasBottomClearance));
  }

  function ensureCanvasHeightState() {
    const base = getCanvasBaseHeight();
    const parsed = Number(boardState.canvasHeight);
    boardState.canvasHeight = Number.isFinite(parsed) && parsed >= base ? parsed : base;
    return boardState.canvasHeight;
  }

  function canReduceCanvasSpace() {
    const step = normalizeCanvasStep(boardState.canvasStep);
    const current = ensureCanvasHeightState();
    const currentExtra = Math.max(0, Number(boardState.canvasUserExtra || 0));
    const nextExtra = Math.max(0, currentExtra - step);
    const nextBase = NODE_LAYOUT.minCanvasH + nextExtra;
    const nextFloor = getCanvasRequiredHeight(nextBase);
    const nextHeight = Math.max(nextFloor, current - step);
    return nextHeight < current - 0.5;
  }

  function updateCanvasSize(els) {
    if (!els?.canvas) return;

    const base = getCanvasBaseHeight();
    const required = getCanvasRequiredHeight(base);
    const floor = required;

    let nextHeight = ensureCanvasHeightState();

    if (nextHeight < floor) {
      nextHeight = floor;
    } else if (boardState.nodes.length) {
      const bottom = getCanvasContentBottom();
      const triggerLine = nextHeight - NODE_LAYOUT.canvasAutoGrowThreshold;
      if (bottom >= triggerLine) {
        nextHeight = Math.max(nextHeight, required);
      }
    }

    boardState.canvasHeight = Math.max(base, Math.ceil(nextHeight));
    els.canvas.style.height = `${boardState.canvasHeight}px`;

    syncInspectorGapUI(els);
  }

  function adjustCanvasSpace(direction, els) {
    markBoardHistoryDirty();
    const step = normalizeCanvasStep(boardState.canvasStep);
    const normalized = direction > 0 ? 1 : -1;
    if (!step || !normalized) return;

    const currentExtra = Math.max(0, Number(boardState.canvasUserExtra || 0));
    const nextExtra = Math.max(0, currentExtra + normalized * step);
    boardState.canvasUserExtra = nextExtra;

    let nextHeight = ensureCanvasHeightState();
    nextHeight += normalized * step;

    const floor = Math.max(getCanvasBaseHeight(), getCanvasRequiredHeight());
    boardState.canvasHeight = Math.max(floor, nextHeight);

    updateCanvasSize(els);
    scheduleWidgetBoardPersist();
  }

  function syncNodeGeometry(els) {

    if (!els?.canvas) return;
    boardState.nodes.forEach((node) => {
      const nodeEl = els.canvas.querySelector(`[data-node-id="${node.uid}"]`);
      if (!nodeEl) return;
      nodeEl.style.left = `${Math.round(node.x)}px`;
      nodeEl.style.top = `${Math.round(node.y)}px`;
      nodeEl.style.width = `${Math.round(node.w)}px`;
      nodeEl.style.height = `${Math.round(node.h)}px`;
    });
  }

  function getBoardElements() {
    return {
      section: document.getElementById('widget-board'),
      body: document.getElementById('widgetboard-body'),
      actionsBar: document.getElementById('widget-actions-bar'),
      actionsToggleBtn: document.getElementById('widget-actions-toggle'),
      actionsOverflow: document.getElementById('widget-actions-overflow'),
      mobileNav: document.getElementById('widget-mobile-nav'),
      mobileViewButtons: Array.from(document.querySelectorAll('#widget-mobile-nav [data-mobile-view]')),
      collapseToggleBtn: document.getElementById('widgetboard-collapse-toggle'),
      arxivSection: document.getElementById('arxiv-board'),
      arxivBody: document.getElementById('arxivboard-body'),
      arxivCollapseToggleBtn: document.getElementById('arxivboard-collapse-toggle'),
      deckRail: document.getElementById('deck-rail'),
      modal: document.getElementById('widget-modal'),
      modalBack: document.getElementById('widget-modal-back'),
      modalTitle: document.getElementById('widget-modal-title'),
      modalList: document.getElementById('widget-modal-list'),
      canvasShell: document.getElementById('widget-canvas-shell'),
      canvas: document.getElementById('widget-canvas'),
      canvasMeta: document.getElementById('widget-canvas-meta'),
      canvasSettingsToggleBtn: document.getElementById('widget-canvas-settings-toggle'),
      canvasSettingsPanel: document.getElementById('widget-canvas-settings-panel'),
      touchMode: document.getElementById('widget-touch-mode'),
      touchModeButtons: Array.from(document.querySelectorAll('#widget-touch-mode [data-touch-mode]')),
      gapLessBtn: document.getElementById('widget-gap-less'),
      gapMoreBtn: document.getElementById('widget-gap-more'),
      gapStepLabel: document.getElementById('widget-gap-step-label'),
      gapStepButtons: Array.from(document.querySelectorAll('[data-gap-step]')),
      inspector: document.getElementById('widget-inspector'),
      inspectorBackdrop: document.getElementById('widget-inspector-backdrop'),
      mobileSelectionBar: document.getElementById('widget-mobile-selection-bar'),
      mobileSelectionSummary: document.getElementById('widget-mobile-selection-summary'),
      mobileSelectionActionButtons: Array.from(document.querySelectorAll('#widget-mobile-selection-bar [data-mobile-selection-action]')),
      clearBtn: document.getElementById('widget-clear'),
      templatesBtn: document.getElementById('widget-templates'),
      exportPngBtn: document.getElementById('widget-export-png'),
      exportCsvBtn: document.getElementById('widget-export-csv'),
      shareUrlBtn: document.getElementById('widget-share-link'),
      helpToggleBtn: document.getElementById('widget-help-toggle'),
      helpPopover: document.getElementById('widget-help-popover')
    };
  }

  function isBoardMobileUI() {
    if (typeof window === 'undefined') return false;
    if (typeof window.matchMedia === 'function') {
      return window.matchMedia(`(max-width: ${BOARD_MOBILE_BREAKPOINT}px)`).matches;
    }
    return window.innerWidth <= BOARD_MOBILE_BREAKPOINT;
  }

  function normalizeBoardMobileView(raw) {
    const view = String(raw || '').toLowerCase();
    return BOARD_MOBILE_VIEWS.includes(view) ? view : 'board';
  }

  function normalizeBoardTouchMode(raw) {
    const mode = String(raw || '').toLowerCase();
    return BOARD_TOUCH_MODES.includes(mode) ? mode : 'select';
  }

  function closeBoardTransientPanels(els, options = {}) {
    if (!options.keepMenu) boardMobileState.actionsMenuOpen = false;
    if (!options.keepSettings) boardMobileState.canvasSettingsOpen = false;
    if (!options.keepInspector) {
      boardMobileState.inspectorSheetOpen = false;
      if (boardMobileState.view === 'inspector') {
        boardMobileState.view = boardState.nodes.length ? 'board' : 'decks';
      }
    }
    if (!options.keepHelp && boardState.helpOpen) {
      setBoardHelpOpen(false, els);
    }
    syncBoardMobileUI(els);
  }

  function setBoardActionsMenuOpen(nextOpen, els) {
    const open = isBoardMobileUI() && !!nextOpen;
    boardMobileState.actionsMenuOpen = open;
    if (open) {
      boardMobileState.canvasSettingsOpen = false;
      boardMobileState.inspectorSheetOpen = false;
      if (boardState.helpOpen) setBoardHelpOpen(false, els);
    }
    syncBoardMobileUI(els);
  }

  function setCanvasSettingsOpen(nextOpen, els) {
    const open = isBoardMobileUI() && !!nextOpen;
    boardMobileState.canvasSettingsOpen = open;
    if (open) {
      boardMobileState.actionsMenuOpen = false;
      if (boardState.helpOpen) setBoardHelpOpen(false, els);
      boardMobileState.view = 'board';
    }
    syncBoardMobileUI(els);
  }

  function setBoardMobileTouchMode(nextMode, els) {
    boardMobileState.touchMode = normalizeBoardTouchMode(nextMode);
    syncBoardMobileUI(els);
  }

  function setBoardMobileView(nextView, els, options = {}) {
    if (!isBoardMobileUI()) {
      boardMobileState.view = 'board';
      boardMobileState.actionsMenuOpen = false;
      boardMobileState.canvasSettingsOpen = false;
      boardMobileState.inspectorSheetOpen = false;
      syncBoardMobileUI(els);
      return;
    }

    const view = normalizeBoardMobileView(nextView);
    boardMobileState.view = view;
    boardMobileState.actionsMenuOpen = false;
    boardMobileState.canvasSettingsOpen = false;
    boardMobileState.inspectorSheetOpen = view === 'inspector';
    if (view === 'inspector') {
      boardState.inspectorCollapsed = false;
    }
    if (!options.keepHelp && view !== 'board' && boardState.helpOpen) {
      setBoardHelpOpen(false, els);
    }

    syncBoardMobileUI(els);

    if (view === 'board' && options.scroll !== false) {
      window.requestAnimationFrame(() => {
        els?.canvasShell?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      });
    }
  }

  function openBoardInspectorSheet(els, options = {}) {
    if (!isBoardMobileUI()) return;
    boardMobileState.view = 'inspector';
    boardMobileState.inspectorSheetOpen = true;
    boardState.inspectorCollapsed = false;
    boardMobileState.actionsMenuOpen = false;
    boardMobileState.canvasSettingsOpen = false;
    if (!options.keepHelp && boardState.helpOpen) {
      setBoardHelpOpen(false, els);
    }
    syncBoardMobileUI(els);
  }

  function closeBoardInspectorSheet(els, options = {}) {
    boardMobileState.inspectorSheetOpen = false;
    if (isBoardMobileUI()) {
      boardMobileState.view = options.view
        ? normalizeBoardMobileView(options.view)
        : (boardState.nodes.length ? 'board' : 'decks');
    }
    syncBoardMobileUI(els);
  }

  function buildMobileSelectionSummary() {
    return boardText.mobileSelectionSummary(getSelectedBoardNodeIds().length);
  }

  function syncBoardMobileSelectionBar(els) {
    const bar = els?.mobileSelectionBar;
    if (!bar) return;

    const mobile = isBoardMobileUI();
    const selectionIds = getSelectedBoardNodeIds();
    const count = selectionIds.length;
    const singleNode = count === 1 ? (getNodeById(selectionIds[0]) || getActiveBoardNode()) : null;
    const show = mobile
      && count > 0
      && boardMobileState.view === 'board'
      && !boardMobileState.inspectorSheetOpen
      && !els?.section?.classList.contains('is-collapsed');

    bar.hidden = !show;
    bar.setAttribute('aria-hidden', show ? 'false' : 'true');

    if (els.mobileSelectionSummary) {
      els.mobileSelectionSummary.textContent = count ? buildMobileSelectionSummary() : '';
    }

    const canDetach = !!(singleNode && singleNode.role !== 'chart' && singleNode.attachedTo);
    (Array.isArray(els.mobileSelectionActionButtons) ? els.mobileSelectionActionButtons : []).forEach((button) => {
      const action = button.getAttribute('data-mobile-selection-action') || '';
      if (action === 'inspect') button.textContent = boardText.mobileQuickEdit;
      if (action === 'duplicate') button.textContent = boardText.inspectorDuplicate;
      if (action === 'detach') button.textContent = boardText.inspectorDetach;
      if (action === 'remove') button.textContent = boardText.inspectorRemove;

      if (action === 'detach') {
        button.hidden = !canDetach;
        button.disabled = !canDetach;
        return;
      }

      button.hidden = false;
      button.disabled = !count;
    });
  }

  function syncBoardMobileUI(els) {
    if (!els?.section) return;

    const mobile = isBoardMobileUI();
    if (!mobile) {
      boardMobileState.view = 'board';
      boardMobileState.actionsMenuOpen = false;
      boardMobileState.canvasSettingsOpen = false;
      boardMobileState.inspectorSheetOpen = false;
    }

    const view = mobile ? normalizeBoardMobileView(boardMobileState.view) : 'board';
    const touchMode = normalizeBoardTouchMode(boardMobileState.touchMode);
    const menuOpen = mobile && boardMobileState.actionsMenuOpen;
    const settingsOpen = mobile && boardMobileState.canvasSettingsOpen;
    const inspectorOpen = mobile && boardMobileState.inspectorSheetOpen && !els.section.classList.contains('is-collapsed');

    boardMobileState.view = view;
    boardMobileState.touchMode = touchMode;

    els.section.classList.toggle('is-mobile-ui', mobile);
    els.section.classList.toggle('is-mobile-inspector-open', inspectorOpen);
    els.section.classList.toggle('is-mobile-actions-open', menuOpen);
    els.section.classList.toggle('is-mobile-settings-open', settingsOpen);
    els.section.classList.toggle('is-touch-mode-select', touchMode === 'select');
    els.section.classList.toggle('is-touch-mode-move', touchMode === 'move');

    if (els.body) {
      els.body.setAttribute('data-mobile-view', view);
    }

    if (els.actionsBar) {
      els.actionsBar.classList.toggle('is-menu-open', menuOpen);
    }

    if (els.actionsToggleBtn) {
      const label = menuOpen ? boardText.mobileHideActions : boardText.mobileMoreActions;
      els.actionsToggleBtn.hidden = !mobile;
      els.actionsToggleBtn.textContent = menuOpen ? (isEn ? 'Close' : 'Cerrar') : (isEn ? 'More' : 'Mas');
      els.actionsToggleBtn.setAttribute('aria-expanded', menuOpen ? 'true' : 'false');
      els.actionsToggleBtn.setAttribute('aria-label', label);
      els.actionsToggleBtn.setAttribute('title', label);
    }

    if (els.actionsOverflow) {
      els.actionsOverflow.setAttribute('aria-hidden', mobile && !menuOpen ? 'true' : 'false');
    }

    if (els.mobileNav) {
      els.mobileNav.hidden = !mobile;
      els.mobileNav.setAttribute('aria-label', boardText.mobileViewsLabel);
    }

    (Array.isArray(els.mobileViewButtons) ? els.mobileViewButtons : []).forEach((button) => {
      const targetView = normalizeBoardMobileView(button.getAttribute('data-mobile-view'));
      const active = mobile && targetView === view;
      const labelMap = {
        decks: boardText.mobileViewDecks,
        board: boardText.mobileViewBoard,
        inspector: boardText.mobileViewInspector
      };
      button.textContent = labelMap[targetView] || targetView;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    if (els.touchMode) {
      els.touchMode.hidden = !mobile;
      els.touchMode.setAttribute('aria-label', boardText.mobileTouchModeLabel);
    }

    (Array.isArray(els.touchModeButtons) ? els.touchModeButtons : []).forEach((button) => {
      const mode = normalizeBoardTouchMode(button.getAttribute('data-touch-mode'));
      const active = touchMode === mode;
      button.textContent = mode === 'move' ? boardText.mobileTouchMove : boardText.mobileTouchSelect;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    if (els.canvasSettingsToggleBtn) {
      const label = settingsOpen ? boardText.mobileCanvasSettingsClose : boardText.mobileCanvasSettingsOpen;
      els.canvasSettingsToggleBtn.hidden = !mobile;
      els.canvasSettingsToggleBtn.textContent = boardText.mobileCanvasSettings;
      els.canvasSettingsToggleBtn.setAttribute('aria-expanded', settingsOpen ? 'true' : 'false');
      els.canvasSettingsToggleBtn.setAttribute('aria-label', label);
      els.canvasSettingsToggleBtn.setAttribute('title', label);
    }

    if (els.canvasSettingsPanel) {
      els.canvasSettingsPanel.setAttribute('aria-hidden', mobile && !settingsOpen ? 'true' : 'false');
    }

    if (els.canvasShell) {
      els.canvasShell.classList.toggle('is-settings-open', settingsOpen);
    }

    if (els.inspectorBackdrop) {
      els.inspectorBackdrop.hidden = !inspectorOpen;
    }

    syncBoardMobileSelectionBar(els);
  }

  function syncWidgetBoardCollapseUI(els) {
    if (!els?.collapseToggleBtn || !els?.section) return;

    const collapsed = els.section.classList.contains('is-collapsed');
    const label = collapsed ? boardText.widgetBoardExpand : boardText.widgetBoardCollapse;

    els.collapseToggleBtn.classList.toggle('is-collapsed', collapsed);
    els.collapseToggleBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    els.collapseToggleBtn.setAttribute('aria-label', label);
    els.collapseToggleBtn.setAttribute('title', label);
  }

  function setWidgetBoardCollapsed(collapsed, els) {
    if (!els?.section) return;

    const shouldCollapse = !!collapsed;
    const currentlyCollapsed = els.section.classList.contains('is-collapsed');
    if (shouldCollapse === currentlyCollapsed) {
      syncWidgetBoardCollapseUI(els);
      return;
    }

    els.section.classList.toggle('is-collapsed', shouldCollapse);

    if (shouldCollapse) {
      closeModal(els.modal);
      closeBoardTransientPanels(els);
      boardMobileState.view = boardState.nodes.length ? 'board' : 'decks';
    }

    syncWidgetBoardCollapseUI(els);
    syncBoardMobileUI(els);

    if (!shouldCollapse && els.deckRail) {
      window.requestAnimationFrame(() => {
        syncDeckRailAlignment(els.deckRail);
      });
      window.setTimeout(() => {
        syncDeckRailAlignment(els.deckRail);
      }, 360);
    }

    if (boardPersistenceEnabled) scheduleWidgetBoardPersist();
  }


  function syncArxivBoardCollapseUI(els) {
    if (!els?.arxivCollapseToggleBtn || !els?.arxivSection) return;

    const collapsed = els.arxivSection.classList.contains('is-collapsed');
    const label = collapsed ? boardText.arxivBoardExpand : boardText.arxivBoardCollapse;

    els.arxivCollapseToggleBtn.classList.toggle('is-collapsed', collapsed);
    els.arxivCollapseToggleBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    els.arxivCollapseToggleBtn.setAttribute('aria-label', label);
    els.arxivCollapseToggleBtn.setAttribute('title', label);
  }

  function setArxivBoardCollapsed(collapsed, els) {
    if (!els?.arxivSection) return;

    const shouldCollapse = !!collapsed;
    const currentlyCollapsed = els.arxivSection.classList.contains('is-collapsed');
    if (shouldCollapse === currentlyCollapsed) {
      syncArxivBoardCollapseUI(els);
      return;
    }

    els.arxivSection.classList.toggle('is-collapsed', shouldCollapse);
    syncArxivBoardCollapseUI(els);

    if (boardPersistenceEnabled) scheduleWidgetBoardPersist();
  }

  function getDeckPalette(tone) {
    const palettes = {
      arxiv: { sleeve: '#fff3ed', sleeveStroke: '#f1ad96', accent: '#ef5b2f', text: '#2b1b14' },
      keywords: { sleeve: '#eef5ff', sleeveStroke: '#9bbce8', accent: '#2f7dd1', text: '#10253f' },
      nasa: { sleeve: '#f3f1ff', sleeveStroke: '#b6a8ef', accent: '#7c5cfa', text: '#1e173d' },
      fusion: { sleeve: '#ecfaf6', sleeveStroke: '#8dcdbb', accent: '#16a085', text: '#0f2f28' },
      sponsored: { sleeve: '#f3f4f6', sleeveStroke: '#b7bdc6', accent: '#5f6876', text: '#1f2937' }
    };

    return palettes[tone] || {
      sleeve: '#f3f4f6',
      sleeveStroke: '#c8ccd3',
      accent: '#ef5b2f',
      text: '#1f2937'
    };
  }

  function renderDeckIconSvg() {
    return `
      <svg class="deck-art-icon" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
        <rect x="16.6" y="11" width="30.8" height="18.8" rx="3.6" fill="rgba(15,17,21,.12)" transform="translate(0.7 0.9)"/>
        <rect x="16.6" y="11" width="30.8" height="18.8" rx="3.6" fill="var(--deck-sleeve)" stroke="var(--deck-sleeve-stroke)" stroke-width="1"/>

        <rect x="18" y="13" width="28" height="16" rx="3" fill="#fff" stroke="rgba(15,17,21,.22)" stroke-width="1.1"/>

        <g transform="translate(19.7 14) scale(0.165)" opacity="0.76">
          <path d="M18 14 H46 V42 H18 Z" fill="none" stroke="#c7c7c7" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" opacity=".7"/>
          <path d="M10 22 H38 V50 H10 Z" fill="none" stroke="#c7c7c7" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" opacity=".7"/>
          <path d="M10 22 L18 14 M38 22 L46 14 M38 50 L46 42 M10 50 L18 42" fill="none" stroke="#c7c7c7" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" opacity=".7"/>

          <g fill="none" stroke="#a7a7a7" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity=".18">
            <path d="M28 32 L10 22"/><path d="M28 32 L38 22"/><path d="M28 32 L38 50"/><path d="M28 32 L10 50"/>
            <path d="M28 32 L18 14"/><path d="M28 32 L46 14"/><path d="M28 32 L46 42"/><path d="M28 32 L18 42"/>
          </g>

          <g fill="#ed4624">
            <circle cx="10" cy="22" r="3.2"/><circle cx="38" cy="22" r="3.2"/><circle cx="38" cy="50" r="3.2"/><circle cx="10" cy="50" r="3.2"/>
            <circle cx="18" cy="14" r="3.2"/><circle cx="46" cy="14" r="3.2"/><circle cx="46" cy="42" r="3.2"/><circle cx="18" cy="42" r="3.2"/>
            <circle cx="28" cy="32" r="3.6"/>
          </g>
          <g fill="none" stroke="rgba(255,255,255,.2)" stroke-width="1.05">
            <circle cx="10" cy="22" r="3.2"/><circle cx="38" cy="22" r="3.2"/><circle cx="38" cy="50" r="3.2"/><circle cx="10" cy="50" r="3.2"/>
            <circle cx="18" cy="14" r="3.2"/><circle cx="46" cy="14" r="3.2"/><circle cx="46" cy="42" r="3.2"/><circle cx="18" cy="42" r="3.2"/>
            <circle cx="28" cy="32" r="3.6"/>
          </g>
        </g>

        <rect x="33.6" y="20.8" width="5.2" height="7.8" rx="1.05" fill="#c2b27a" stroke="#a89966" stroke-width="0.72"/>

        <path d="M16 24Q16 21 19 21H24Q26 21 27 23Q28 26 32 26Q36 26 37 23Q38 21 40 21H45Q48 21 48 24V52Q48 55 45 55H19Q16 55 16 52Z"
              fill="var(--deck-sleeve)" stroke="var(--deck-sleeve-stroke)" stroke-width="1.2"/>
      </svg>
    `;
  }

  function getDeckRailItems() {
    return BOARD_DECKS.filter((deck) => !deck.hiddenInRail);
  }

  function syncDeckRailAlignment(deckRail) {
    if (!deckRail) return;
    const clientWidth = Math.round(deckRail.clientWidth || 0);
    if (clientWidth < 2) return;

    const hasOverflow = (deckRail.scrollWidth - clientWidth) > 2;
    deckRail.classList.toggle('is-overflowing', hasOverflow);

    if (!hasOverflow && deckRail.scrollLeft !== 0) {
      deckRail.scrollLeft = 0;
    }
  }

  function getDeckCardCount(deck) {
    if (!deck) return 0;
    if (Array.isArray(deck.sponsoredDecks) && deck.sponsoredDecks.length) {
      return deck.sponsoredDecks.length;
    }
    return Array.isArray(deck.cards) ? deck.cards.length : 0;
  }

  function isSponsoredHubDeck(deck) {
    return !!(deck && Array.isArray(deck.sponsoredDecks) && deck.sponsoredDecks.length);
  }

  function setModalBackState(els, targetDeckId = '') {
    const backButton = els?.modalBack;
    if (!backButton) return;

    const show = !!targetDeckId;
    backButton.hidden = !show;
    if (show) {
      backButton.setAttribute('data-sponsored-back', targetDeckId);
      backButton.setAttribute('aria-label', boardText.sponsoredBack);
      backButton.setAttribute('title', boardText.sponsoredBack);
    } else {
      backButton.removeAttribute('data-sponsored-back');
      backButton.removeAttribute('aria-label');
      backButton.removeAttribute('title');
    }
  }

  function renderDeckRail(deckRail) {
    if (!deckRail) return;
    deckRail.innerHTML = getDeckRailItems().map((deck) => {
      const palette = getDeckPalette(deck.tone);
      const sleeveTitle = escapeHtml(deck.sleeveTitle || deck.name);
      const sleeveSubtitle = escapeHtml(deck.sleeveSubtitle || deck.subtitle);
      const style = `--deck-sleeve:${palette.sleeve};--deck-sleeve-stroke:${palette.sleeveStroke};--deck-accent:${palette.accent};--deck-text:${palette.text};`;
      const count = getDeckCardCount(deck);
      const countLabel = isSponsoredHubDeck(deck) ? boardText.deckBundles : boardText.deckCards;

      return `
        <button class="deck-card deck-tone-${deck.tone}" type="button" data-deck-id="${deck.id}" aria-label="${sleeveTitle}" style="${style}">
          <span class="deck-art" aria-hidden="true">
            ${renderDeckIconSvg()}
            <span class="deck-count-dot" aria-label="${count} ${countLabel}">${count}</span>
            <span class="deck-sleeve-info">
              <span class="deck-name">${sleeveTitle}</span>
              <span class="deck-sub">${sleeveSubtitle}</span>
            </span>
          </span>
        </button>
      `;
    }).join('');

    syncDeckRailAlignment(deckRail);
    window.requestAnimationFrame(() => {
      syncDeckRailAlignment(deckRail);
    });
  }

  function getDeckById(deckId) {
    return BOARD_DECKS.find((deck) => deck.id === deckId) || null;
  }

  function openModal(modal) {
    if (!modal) return;
    if (widgetBoardEls) {
      closeBoardTransientPanels(widgetBoardEls);
    }
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
  }

  function renderSponsoredHub(deck, els) {
    const sponsoredDecks = (deck.sponsoredDecks || [])
      .map((deckId) => getDeckById(deckId))
      .filter(Boolean);

    boardState.currentDeckId = deck.id;
    els.modalTitle.textContent = deck.name;
    setModalBackState(els, '');

    els.modalList.innerHTML = sponsoredDecks.map((sponsoredDeck) => {
      const cardCount = getDeckCardCount(sponsoredDeck);
      return `
        <article class="modal-card modal-card-deck" data-sponsored-deck="${sponsoredDeck.id}">
          <div class="node-role">${boardText.deckBundles}</div>
          <div class="modal-card-title">${sponsoredDeck.name}</div>
          <div class="modal-card-value">${cardCount} ${boardText.deckCards}</div>
          <div class="modal-card-meta">${sponsoredDeck.subtitle || ''}</div>
          <button type="button" data-open-sponsored-deck="${sponsoredDeck.id}">${boardText.openDeck}</button>
        </article>
      `;
    }).join('');

    openModal(els.modal);
  }

  function renderDeckCards(deck, els) {
    boardState.currentDeckId = deck.id;
    els.modalTitle.textContent = `${boardText.cardsAvailable}: ${deck.name}`;
    setModalBackState(els, deck.sponsoredParent || '');

    const isSponsoredDemoDeck = !!deck.sponsoredParent;
    const sponsoredCtaHref = safeHref(pageLang === 'en' ? '/en/contactUs.html' : '/contactUs.html', '#');

    els.modalList.innerHTML = (deck.cards || []).map((card) => {
      const sponsoredCta = isSponsoredDemoDeck
        ? `<a class="modal-card-cta" href="${escapeHtml(sponsoredCtaHref)}">${boardText.sponsoredCta}</a>`
        : '';

      return `
        <article class="modal-card" data-card-id="${card.id}">
          <div class="node-role">${getRoleLabel(card.role)}</div>
          <div class="modal-card-title">${card.title}</div>
          <div class="modal-card-value">${card.value}</div>
          <div class="modal-card-meta">${card.note}</div>
          <div class="modal-card-actions">
            <button type="button" data-add-card="${card.id}">${boardText.addCard}</button>
            ${sponsoredCta}
          </div>
        </article>
      `;
    }).join('');

    openModal(els.modal);
  }

  function openDeck(deckId, els) {
    const deck = getDeckById(deckId);
    if (!deck || !els.modalList || !els.modalTitle) return;

    if (isSponsoredHubDeck(deck)) {
      renderSponsoredHub(deck, els);
      return;
    }

    renderDeckCards(deck, els);
  }

  function getBoardTemplateById(templateId) {
    return BOARD_TEMPLATES.find((template) => template.id === templateId) || null;
  }

  function applyTemplateSettingsToNode(node, settings = {}) {
    if (!node || !settings || typeof settings !== 'object') return;

    ensureNodeSettings(node);

    if (node.role === 'data') {
      if (settings.metric) node.settings.metric = String(settings.metric).toLowerCase();
      if (settings.transform) node.settings.transform = normalizeTransformId(settings.transform);
      if (settings.aggregate) node.settings.aggregate = normalizeAggregateId(settings.aggregate);
      if (settings.keyword !== undefined) node.settings.keyword = sanitizeKeywordInput(settings.keyword || '');
      if (node.settings.metric !== 'keyword-custom' && settings.keyword === undefined) node.settings.keyword = node.settings.keyword || '';
      updateNodeMetricSnapshot(node);
      return;
    }

    if (node.role === 'control' && node.cardId === 'period-control') {
      if (settings.rangeMonths !== undefined) node.settings.rangeMonths = clampRangeMonths(settings.rangeMonths);
      updateNodeMetricSnapshot(node, node.settings.rangeMonths || heroState.range);
      return;
    }

    if (node.role === 'control' && node.cardId === 'source-control') {
      if (settings.sourceBlend) node.settings.sourceBlend = normalizeSourceBlend(settings.sourceBlend);
      updateNodeMetricSnapshot(node);
      return;
    }

    if (node.role === 'style' && node.cardId === 'style-depth') {
      node.settings.styleDepth = normalizeStyleDepthSettings(settings.styleDepth || node.settings.styleDepth);
      updateNodeMetricSnapshot(node);
      return;
    }

    if (node.role === 'style' && node.cardId === 'style-color') {
      node.settings.styleColor = normalizeStyleColorSettings(settings.styleColor || node.settings.styleColor);
      updateNodeMetricSnapshot(node);
      return;
    }

    if (node.role === 'style' && node.cardId === 'style-3d') {
      node.settings.style3d = normalizeStyleThreeDSettings(settings.style3d || node.settings.style3d);
      updateNodeMetricSnapshot(node);
    }
  }

  function renderTemplateCatalog(els) {
    if (!els?.modalList || !els?.modalTitle) return;

    boardState.currentDeckId = '';
    els.modalTitle.textContent = boardText.templateCatalogTitle;
    setModalBackState(els, '');

    els.modalList.innerHTML = BOARD_TEMPLATES.map((template) => {
      return `
        <article class="modal-card modal-card-template" data-template-id="${template.id}">
          <div class="node-role">${boardText.templateRole}</div>
          <div class="modal-card-title">${template.name}</div>
          <div class="modal-card-value">${template.chart.cardId.replace('-chart', '')}</div>
          <div class="modal-card-meta">${template.subtitle}</div>
          <div class="modal-card-actions">
            <button type="button" data-apply-template="${template.id}" data-apply-template-mode="append">${boardText.applyTemplateAdd}</button>
            <button type="button" class="is-secondary" data-apply-template="${template.id}" data-apply-template-mode="replace">${boardText.applyTemplateReplace}</button>
          </div>
        </article>
      `;
    }).join('');

    openModal(els.modal);
  }

  function applyBoardTemplate(templateId, els, options = {}) {
    const template = getBoardTemplateById(templateId);
    if (!template || !els?.canvas) return false;

    const mode = options.mode === 'replace' ? 'replace' : 'append';
    if (mode === 'replace') {
      resetWidgetBoard(els, { deferRender: true });
    }

    const templateNodeOptions = {
      deferRender: true,
      skipSelection: true,
      skipLinkedRefresh: true,
      skipSlotRealign: true
    };

    const chartNode = addCardToBoard(template.chart.deckId, template.chart.cardId, els, templateNodeOptions);
    if (!chartNode || chartNode.role !== 'chart') {
      renderBoardCanvas(els);
      closeModal(els.modal);
      return false;
    }

    (template.cards || []).forEach((entry) => {
      const node = addCardToBoard(entry.deckId, entry.cardId, els, templateNodeOptions);
      if (!node) return;
      if (entry.settings) {
        applyTemplateSettingsToNode(node, entry.settings);
      }
    });

    realignChartSlots(chartNode, els.canvas);
    refreshLinkedDataNodes(chartNode);

    boardState.selectedChartId = chartNode.uid;
    boardState.activeNodeId = chartNode.uid;
    boardState.detailNodeId = '';
    boardState.optionsNodeId = '';
    if (isBoardMobileUI()) {
      boardMobileState.view = 'board';
      boardMobileState.actionsMenuOpen = false;
      boardMobileState.canvasSettingsOpen = false;
      boardMobileState.inspectorSheetOpen = false;
    }
    setBoardSelection([chartNode.uid], { activeId: chartNode.uid });
    renderBoardCanvas(els);
    closeModal(els.modal);
    return true;
  }

  async function importBoardTemplate(templateId, els, options = {}) {
    if (boardTemplateImportPending) return false;

    const activeButton = options.triggerButton || null;
    boardTemplateImportPending = true;
    setTemplateImportLoading(els, activeButton, true);

    try {
      await waitForNextBoardPaint();
      return applyBoardTemplate(templateId, els, options);
    } finally {
      setTemplateImportLoading(els, activeButton, false);
      boardTemplateImportPending = false;
    }
  }

  function getNodeById(nodeId) {
    return boardState.nodes.find((node) => node.uid === nodeId) || null;
  }

  function getChartNodes() {
    return boardState.nodes.filter((node) => node.role === 'chart');
  }

  function refreshLinkedDataNodes(chartOrId, rangeHint) {
    boardPerfCounters.refreshLinkedDataNodes += 1;

    const chart = typeof chartOrId === 'string' ? getNodeById(chartOrId) : chartOrId;
    if (!chart || chart.role !== 'chart' || !chart.links) return false;

    const range = clampRangeMonths(rangeHint || getChartRange(chart));
    const sourceBlend = getChartSourceBlend(chart);
    const metricContext = buildMetricContext(range, sourceBlend);
    let changed = false;

    (chart.links.top || []).forEach((nodeId) => {
      const node = getNodeById(nodeId);
      if (!node || node.role !== 'control') return;
      const prevValue = String(node.value || '');
      const prevNote = String(node.note || '');
      updateNodeMetricSnapshot(node, range);
      if (prevValue !== String(node.value || '') || prevNote !== String(node.note || '')) {
        changed = true;
      }
    });

    (chart.links.left || []).forEach((nodeId) => {
      const node = getNodeById(nodeId);
      if (!node || node.role !== 'data') return;
      const prevValue = String(node.value || '');
      const prevTitle = String(node.title || '');
      updateNodeMetricSnapshot(node, range, { context: metricContext, sourceBlend });
      if (prevValue !== String(node.value || '') || prevTitle !== String(node.title || '')) {
        changed = true;
      }
    });

    const dataset = buildChartInputDataset(chart);

    (chart.links.right || []).forEach((nodeId) => {
      const node = getNodeById(nodeId);
      if (!node || node.role !== 'output') return;
      const prevValue = String(node.value || '');
      const prevNote = String(node.note || '');
      updateOutputNodeSnapshot(node, chart, range, dataset);
      if (prevValue !== String(node.value || '') || prevNote !== String(node.note || '')) {
        changed = true;
      }
    });

    return changed;
  }

  function getNodeCenter(node) {
    return {
      x: Number(node.x || 0) + Number(node.w || 0) / 2,
      y: Number(node.y || 0) + Number(node.h || 0) / 2
    };
  }

  function clearSnapPreview(els) {
    boardDrag.snapPreview = null;
    if (!els?.canvas) return;

    els.canvas.querySelectorAll('.board-node-chart.is-snap-focus').forEach((el) => {
      el.classList.remove('is-snap-focus');
    });

    const ghost = els.canvas.querySelector('.node-snap-preview');
    if (ghost) ghost.remove();
  }

  function updateSnapPreview(node, candidate, els) {
    if (!els?.canvas) return;

    const prevChartId = boardDrag.snapPreview?.chartId || '';
    if (!candidate || !candidate.chart || !candidate.slot || !candidate.target) {
      if (prevChartId) {
        const prevEl = els.canvas.querySelector(`[data-node-id="${prevChartId}"]`);
        if (prevEl) prevEl.classList.remove('is-snap-focus');
      }
      clearSnapPreview(els);
      return;
    }

    if (prevChartId && prevChartId !== candidate.chart.uid) {
      const prevEl = els.canvas.querySelector(`[data-node-id="${prevChartId}"]`);
      if (prevEl) prevEl.classList.remove('is-snap-focus');
    }

    boardDrag.snapPreview = {
      chartId: candidate.chart.uid,
      slot: candidate.slot
    };

    const chartEl = els.canvas.querySelector(`[data-node-id="${candidate.chart.uid}"]`);
    if (chartEl) chartEl.classList.add('is-snap-focus');

    let ghost = els.canvas.querySelector('.node-snap-preview');
    if (!ghost) {
      ghost = document.createElement('div');
      ghost.className = 'node-snap-preview';
      const label = document.createElement('span');
      label.className = 'node-snap-preview-label';
      ghost.appendChild(label);
      els.canvas.appendChild(ghost);
    }

    const probe = { ...node, compact: true };
    ensureNodeSize(probe);

    ghost.style.left = `${Math.round(candidate.target.x)}px`;
    ghost.style.top = `${Math.round(candidate.target.y)}px`;
    ghost.style.width = `${Math.round(probe.w)}px`;
    ghost.style.height = `${Math.round(probe.h)}px`;
    ghost.setAttribute('data-slot', candidate.slot);

    const label = ghost.querySelector('.node-snap-preview-label');
    if (label) label.textContent = getSlotLabel(candidate.slot);
  }

  function clearBoardHold() {
    if (boardHold.timer) {
      window.clearTimeout(boardHold.timer);
    }

    boardHold.active = false;
    boardHold.nodeId = '';
    boardHold.nodeEl = null;
    boardHold.pointerId = null;
    boardHold.startX = 0;
    boardHold.startY = 0;
    boardHold.offsetX = 0;
    boardHold.offsetY = 0;
    boardHold.timer = 0;
  }

  function toggleNodeOptions(nodeId, els) {
    const node = getNodeById(nodeId);
    if (!node) return false;

    boardState.activeNodeId = node.uid;
    if (node.role === 'chart') boardState.selectedChartId = node.uid;
    if (boardState.detailNodeId) boardState.detailNodeId = '';
    if (boardState.optionsNodeId) boardState.optionsNodeId = '';

    renderBoardCanvas(els);
    return true;
  }

  function startNodeDrag(node, nodeEl, event, offsetX, offsetY, els) {
    if (boardState.optionsNodeId) boardState.optionsNodeId = '';
    clearSnapPreview(els);

    boardDrag.active = true;
    boardDrag.nodeId = node.uid;
    boardDrag.nodeEl = nodeEl;
    boardDrag.pointerId = event.pointerId;
    boardDrag.offsetX = offsetX;
    boardDrag.offsetY = offsetY;
    boardDrag.moved = false;

    nodeEl.classList.remove('has-options');
    nodeEl.classList.add('is-grab-start');
    nodeEl.classList.add('is-dragging');
    nodeEl.style.zIndex = '18';

    if (boardDrag.grabTimer) window.clearTimeout(boardDrag.grabTimer);
    boardDrag.grabTimer = window.setTimeout(() => {
      nodeEl.classList.remove('is-grab-start');
      boardDrag.grabTimer = 0;
    }, 180);

    if (els) setCanvasMeta(els, boardText.dragHint);

    if (nodeEl.setPointerCapture && typeof event.pointerId === 'number') {
      try {
        nodeEl.setPointerCapture(event.pointerId);
      } catch {
        // noop
      }
    }
  }

  function clearBoardResize() {
    boardResize.active = false;
    boardResize.nodeId = '';
    boardResize.nodeEl = null;
    boardResize.pointerId = null;
    boardResize.dir = '';
    boardResize.startX = 0;
    boardResize.startY = 0;
    boardResize.startLeft = 0;
    boardResize.startTop = 0;
    boardResize.startW = 0;
    boardResize.startH = 0;
    boardResize.moved = false;
  }

  function clearBoardMarquee(els, options = {}) {
    const keepSkip = !!options.keepSkip;
    const marqueeEl = els?.canvas?.querySelector('.board-selection-marquee');
    if (marqueeEl) {
      marqueeEl.remove();
    }

    boardMarquee.active = false;
    boardMarquee.pointerId = null;
    boardMarquee.startX = 0;
    boardMarquee.startY = 0;
    boardMarquee.currentX = 0;
    boardMarquee.currentY = 0;
    boardMarquee.moved = false;
    boardMarquee.additive = false;
    boardMarquee.baseIds = [];
    boardMarquee.previewIds = [];
    if (!keepSkip) boardMarquee.skipClick = false;
  }

  function getCanvasPointerPosition(event, canvas) {
    const rect = canvas.getBoundingClientRect();
    const x = clampNumber(event.clientX - rect.left, 0, canvas.clientWidth || rect.width || 0);
    const y = clampNumber(event.clientY - rect.top, 0, canvas.clientHeight || rect.height || 0);
    return { x, y };
  }

  function getMarqueeRect() {
    const left = Math.min(boardMarquee.startX, boardMarquee.currentX);
    const top = Math.min(boardMarquee.startY, boardMarquee.currentY);
    const right = Math.max(boardMarquee.startX, boardMarquee.currentX);
    const bottom = Math.max(boardMarquee.startY, boardMarquee.currentY);
    return {
      left,
      top,
      right,
      bottom,
      width: Math.max(0, right - left),
      height: Math.max(0, bottom - top)
    };
  }

  function getMarqueeSelectionIds(rect, baseIds = []) {
    const ids = [];
    const baseSet = new Set(Array.isArray(baseIds) ? baseIds : []);

    boardState.nodes.forEach((node) => {
      ensureNodeSize(node);
      const nodeLeft = Number(node.x || 0);
      const nodeTop = Number(node.y || 0);
      const nodeRight = nodeLeft + node.w;
      const nodeBottom = nodeTop + node.h;

      const overlapW = Math.max(0, Math.min(nodeRight, rect.right) - Math.max(nodeLeft, rect.left));
      const overlapH = Math.max(0, Math.min(nodeBottom, rect.bottom) - Math.max(nodeTop, rect.top));
      const overlapArea = overlapW * overlapH;
      const nodeArea = Math.max(1, node.w * node.h);
      const mostlyInside = (overlapArea / nodeArea) > 0.5;

      if (mostlyInside || baseSet.has(node.uid)) {
        ids.push(node.uid);
      }
    });

    return sanitizeSelectionNodeIds(ids);
  }

  function applyMarqueeSelectionClasses(nodeIds, els) {
    if (!els?.canvas) return;
    const selectedSet = new Set(sanitizeSelectionNodeIds(nodeIds));
    els.canvas.querySelectorAll('.board-node').forEach((nodeEl) => {
      const nodeId = nodeEl.getAttribute('data-node-id') || '';
      nodeEl.classList.toggle('is-multi-selected', selectedSet.has(nodeId));
    });
  }

  function beginCanvasSelection(event, els) {
    if (!els?.canvas || boardDrag.active || boardResize.active || boardHold.active) return false;
    if (event.pointerType === 'touch' && isBoardMobileUI()) return false;
    if (typeof event.button === 'number' && event.button !== 0) return false;
    if (event.target.closest('.board-node')) return false;
    if (event.target.closest('[data-resize-dir]')) return false;
    if (event.target.closest('.node-snap-preview')) return false;

    clearBoardMarquee(els);

    const pos = getCanvasPointerPosition(event, els.canvas);
    boardMarquee.active = true;
    boardMarquee.pointerId = event.pointerId;
    boardMarquee.startX = pos.x;
    boardMarquee.startY = pos.y;
    boardMarquee.currentX = pos.x;
    boardMarquee.currentY = pos.y;
    boardMarquee.moved = false;
    boardMarquee.additive = !!(event.shiftKey || event.ctrlKey || event.metaKey);
    boardMarquee.baseIds = boardMarquee.additive ? getSelectedBoardNodeIds() : [];
    boardMarquee.previewIds = boardMarquee.baseIds.slice();

    const marqueeEl = document.createElement('div');
    marqueeEl.className = 'board-selection-marquee';
    marqueeEl.style.left = `${Math.round(pos.x)}px`;
    marqueeEl.style.top = `${Math.round(pos.y)}px`;
    marqueeEl.style.width = '0px';
    marqueeEl.style.height = '0px';
    els.canvas.appendChild(marqueeEl);

    applyMarqueeSelectionClasses(boardMarquee.previewIds, els);
    event.preventDefault();
    return true;
  }

  function moveCanvasSelection(event, els) {
    if (!boardMarquee.active || !els?.canvas) return false;
    if (typeof boardMarquee.pointerId === 'number' && event.pointerId !== boardMarquee.pointerId) return false;

    const pos = getCanvasPointerPosition(event, els.canvas);
    boardMarquee.currentX = pos.x;
    boardMarquee.currentY = pos.y;

    const rect = getMarqueeRect();
    if (!boardMarquee.moved && (rect.width > 3 || rect.height > 3)) {
      boardMarquee.moved = true;
    }

    const marqueeEl = els.canvas.querySelector('.board-selection-marquee');
    if (marqueeEl) {
      marqueeEl.style.left = `${Math.round(rect.left)}px`;
      marqueeEl.style.top = `${Math.round(rect.top)}px`;
      marqueeEl.style.width = `${Math.round(rect.width)}px`;
      marqueeEl.style.height = `${Math.round(rect.height)}px`;
    }

    boardMarquee.previewIds = boardMarquee.moved
      ? getMarqueeSelectionIds(rect, boardMarquee.baseIds)
      : boardMarquee.baseIds.slice();

    applyMarqueeSelectionClasses(boardMarquee.previewIds, els);
    if (boardMarquee.previewIds.length > 1) {
      setCanvasMeta(els, isEn ? `${boardMarquee.previewIds.length} selected` : `${boardMarquee.previewIds.length} seleccionadas`);
    }

    event.preventDefault();
    return true;
  }

  function endCanvasSelection(event, els) {
    if (!boardMarquee.active) return false;
    if (typeof boardMarquee.pointerId === 'number' && typeof event.pointerId === 'number' && boardMarquee.pointerId !== event.pointerId) return false;

    const finalIds = boardMarquee.moved
      ? sanitizeSelectionNodeIds(boardMarquee.previewIds)
      : (boardMarquee.additive ? sanitizeSelectionNodeIds(boardMarquee.baseIds) : []);

    if (finalIds.length) {
      const activeId = finalIds[finalIds.length - 1];
      setBoardSelection(finalIds, { activeId });
      boardState.activeNodeId = activeId;
    } else if (!boardMarquee.additive) {
      setBoardSelection([], { clearActive: true });
    }

    if (boardMarquee.moved) {
      boardMarquee.skipClick = true;
    }

    clearBoardMarquee(els, { keepSkip: true });
    renderBoardCanvas(els);
    return true;
  }

  function beginNodeResize(event, els) {
    if (!els?.canvas || boardDrag.active) return false;
    const handleEl = event.target.closest('[data-resize-dir]');
    if (!handleEl) return false;

    const nodeEl = handleEl.closest('.board-node');
    if (!nodeEl || !els.canvas.contains(nodeEl)) return false;
    if (typeof event.button === 'number' && event.button !== 0) return false;

    const nodeId = nodeEl.getAttribute('data-node-id') || '';
    const node = getNodeById(nodeId);
    if (!node || node.locked || node.attachedTo) return false;

    clearBoardHold();
    clearSnapPreview(els);
    if (boardState.detailNodeId) boardState.detailNodeId = '';
    if (boardState.optionsNodeId) boardState.optionsNodeId = '';

    fitNodeToCanvas(node, els.canvas);
    ensureNodeSize(node);

    boardResize.active = true;
    boardResize.nodeId = node.uid;
    boardResize.nodeEl = nodeEl;
    boardResize.pointerId = event.pointerId;
    boardResize.dir = handleEl.getAttribute('data-resize-dir') || '';
    boardResize.startX = event.clientX;
    boardResize.startY = event.clientY;
    boardResize.startLeft = Number(node.x || NODE_LAYOUT.pad);
    boardResize.startTop = Number(node.y || NODE_LAYOUT.pad);
    boardResize.startW = Number(node.w || 0);
    boardResize.startH = Number(node.h || 0);
    boardResize.moved = false;

    nodeEl.classList.add('is-resizing');
    nodeEl.style.zIndex = '19';

    if (nodeEl.setPointerCapture && typeof event.pointerId === 'number') {
      try {
        nodeEl.setPointerCapture(event.pointerId);
      } catch {
        // noop
      }
    }

    event.preventDefault();
    return true;
  }

  function moveNodeResize(event, els) {
    if (!boardResize.active || !els?.canvas) return false;
    if (typeof boardResize.pointerId === 'number' && event.pointerId !== boardResize.pointerId) return true;

    const node = getNodeById(boardResize.nodeId);
    if (!node) {
      clearBoardResize();
      return true;
    }

    const { width } = getCanvasSize(els.canvas);
    const min = getNodeMinDimensions(node);
    const maxW = Math.max(min.w, width - NODE_LAYOUT.pad * 2);

    const dx = event.clientX - boardResize.startX;
    const dy = event.clientY - boardResize.startY;
    const dir = boardResize.dir;

    let nextX = boardResize.startLeft;
    let nextY = boardResize.startTop;
    let nextW = boardResize.startW;
    let nextH = boardResize.startH;

    if (dir.includes('e')) {
      nextW = boardResize.startW + dx;
    }
    if (dir.includes('s')) {
      nextH = boardResize.startH + dy;
    }
    if (dir.includes('w')) {
      nextW = boardResize.startW - dx;
      nextX = boardResize.startLeft + dx;
    }
    if (dir.includes('n')) {
      nextH = boardResize.startH - dy;
      nextY = boardResize.startTop + dy;
    }

    if (dir.includes('w') && nextX < NODE_LAYOUT.pad) {
      const shift = NODE_LAYOUT.pad - nextX;
      nextX = NODE_LAYOUT.pad;
      nextW -= shift;
    }
    if (dir.includes('n') && nextY < NODE_LAYOUT.pad) {
      const shift = NODE_LAYOUT.pad - nextY;
      nextY = NODE_LAYOUT.pad;
      nextH -= shift;
    }

    nextW = Math.max(min.w, Math.min(maxW, nextW));
    nextH = Math.max(min.h, nextH);

    if (nextX + nextW > width - NODE_LAYOUT.pad) {
      if (dir.includes('w')) {
        nextX = Math.max(NODE_LAYOUT.pad, width - NODE_LAYOUT.pad - nextW);
      } else {
        nextW = Math.max(min.w, width - NODE_LAYOUT.pad - nextX);
      }
    }

    node.x = Math.max(NODE_LAYOUT.pad, nextX);
    node.y = Math.max(NODE_LAYOUT.pad, nextY);
    node.w = nextW;
    node.h = nextH;
    node.resized = true;

    if (Math.abs(node.w - boardResize.startW) > 0.8 || Math.abs(node.h - boardResize.startH) > 0.8 || Math.abs(node.x - boardResize.startLeft) > 0.8 || Math.abs(node.y - boardResize.startTop) > 0.8) {
      boardResize.moved = true;
    }

    if (boardResize.nodeEl) {
      boardResize.nodeEl.style.left = `${Math.round(node.x)}px`;
      boardResize.nodeEl.style.top = `${Math.round(node.y)}px`;
      boardResize.nodeEl.style.width = `${Math.round(node.w)}px`;
      boardResize.nodeEl.style.height = `${Math.round(node.h)}px`;
      applyNodeModeClass(node, boardResize.nodeEl);
    }

    if (node.role === 'chart') {
      realignChartSlots(node, els.canvas);
      syncNodeGeometry(els);
    }

    updateCanvasSize(els);
    event.preventDefault();
    return true;
  }

  function endNodeResize(event, els) {
    if (!boardResize.active) return false;
    if (typeof boardResize.pointerId === 'number' && typeof event.pointerId === 'number' && boardResize.pointerId !== event.pointerId) return true;

    const resizedNodeId = boardResize.nodeId;

    if (boardResize.nodeEl) {
      boardResize.nodeEl.classList.remove('is-resizing');
      boardResize.nodeEl.style.zIndex = '';
    }

    if (boardResize.moved) boardDrag.skipClick = true;

    if (boardResize.moved) {
      markBoardHistoryDirty();
    }

    clearBoardResize();

    if (els?.canvas) {
      const resizedNode = getNodeById(resizedNodeId);
      if (resizedNode?.role === 'chart') {
        realignChartSlots(resizedNode, els.canvas);
      } else if (resizedNode?.attachedTo) {
        const chart = getNodeById(resizedNode.attachedTo);
        if (chart && chart.role === 'chart') {
          realignChartSlots(chart, els.canvas);
        }
      }
      renderBoardCanvas(els);
    }

    return true;
  }

  function detachNode(nodeId) {
    markBoardHistoryDirty();
    boardState.nodes.forEach((node) => {
      if (node.uid === nodeId) {
        node.attachedTo = '';
        setNodeCompact(node, false);
      }
      if (node.role !== 'chart' || !node.links) return;
      Object.keys(node.links).forEach((slot) => {
        node.links[slot] = node.links[slot].filter((id) => id !== nodeId);
      });
    });

    if (boardState.detailNodeId === nodeId) boardState.detailNodeId = '';
    if (boardState.optionsNodeId === nodeId) boardState.optionsNodeId = '';
  }

  function getSlotTargetPosition(chart, slot, node, slotIndex, canvas) {
    ensureNodeSize(chart);
    ensureNodeSize(node);

    const idx = Math.max(0, slotIndex || 0);
    const stackGap = node.compact ? 4 : 6;

    let x = chart.x;
    let y = chart.y;

    if (slot === 'left' || slot === 'right') {
      const rowsPerLane = Math.max(2, Math.floor((chart.h - 12) / (node.h + stackGap)));
      const row = idx % rowsPerLane;
      const lane = Math.floor(idx / rowsPerLane);
      const laneStep = node.compact
        ? Math.max(26, Math.round(node.w * 0.24))
        : Math.max(44, Math.round(node.w * 0.52));
      const laneOffset = lane * laneStep;

      y = chart.y + 6 + row * (node.h + stackGap);
      if (slot === 'left') {
        x = chart.x - node.w - NODE_LAYOUT.gap - laneOffset;
      } else {
        x = chart.x + chart.w + NODE_LAYOUT.gap + laneOffset;
      }
    } else {
      const isTopControl = slot === 'top' && node.role === 'control';
      const isBottomStyle = slot === 'bottom' && node.role === 'style';

      if (isTopControl || isBottomStyle) {
        const slotIds = Array.isArray(chart.links?.[slot]) ? chart.links[slot] : [];
        const slotRoleCount = slotIds.reduce((count, nodeId) => {
          const linked = getNodeById(nodeId);
          return linked && linked.role === node.role ? count + 1 : count;
        }, 0);

        const minCompactW = 86;
        const maxCompactW = NODE_LAYOUT.compactW;
        const compactGap = 8;

        let colsPerLane = Math.min(3, Math.max(1, Math.max(slotRoleCount, idx + 1)));
        while (colsPerLane > 1) {
          const maxWidthForCols = Math.floor((chart.w - 8 - (colsPerLane - 1) * compactGap) / colsPerLane);
          if (maxWidthForCols >= minCompactW) break;
          colsPerLane -= 1;
        }

        const maxWidthForCols = Math.floor((chart.w - 8 - (colsPerLane - 1) * compactGap) / colsPerLane);
        const nextCompactW = clampNumber(Number(node.w || maxCompactW), minCompactW, Math.max(minCompactW, Math.min(maxCompactW, maxWidthForCols)));
        node.w = nextCompactW;
        node.h = Math.max(34, Math.min(Number(node.h || NODE_LAYOUT.compactH), NODE_LAYOUT.compactH));

        const colStep = nextCompactW + compactGap;
        const col = idx % colsPerLane;
        const lane = Math.floor(idx / colsPerLane);
        const laneStep = Math.max(node.h + 18, Math.round(node.h * 1.35));
        const span = (colsPerLane - 1) * colStep;
        const startX = chart.x + Math.round((chart.w - nextCompactW - span) / 2);

        x = startX + col * colStep;
        if (isTopControl) {
          y = chart.y - node.h - NODE_LAYOUT.gap - lane * laneStep;
        } else {
          y = chart.y + chart.h + NODE_LAYOUT.gap + 4 + lane * laneStep;
        }
      } else {
        const colStep = node.compact
          ? Math.max(72, Math.round(node.w * 0.62))
          : Math.max(96, Math.round(node.w * 0.8));
        const colsPerLane = Math.max(2, Math.floor((chart.w - 8) / colStep));
        const col = idx % colsPerLane;
        const lane = Math.floor(idx / colsPerLane);
        const laneStep = node.compact
          ? Math.max(18, Math.round(node.h * 0.62))
          : Math.max(26, Math.round(node.h * 0.8));
        const span = (colsPerLane - 1) * colStep;
        const startX = chart.x + Math.round((chart.w - node.w - span) / 2);

        x = startX + col * colStep;
        if (slot === 'top') {
          y = chart.y - node.h - NODE_LAYOUT.gap - lane * laneStep;
        } else {
          y = chart.y + chart.h + NODE_LAYOUT.gap + lane * laneStep;
        }
      }
    }

    const { width } = getCanvasSize(canvas);
    return {
      x: clampNumber(x, NODE_LAYOUT.pad, Math.max(NODE_LAYOUT.pad, width - node.w - NODE_LAYOUT.pad)),
      y: Math.max(NODE_LAYOUT.pad, y)
    };
  }

  function getChartSlotLayoutCacheKey(chart, canvas) {
    if (!chart || chart.role !== 'chart' || !chart.links) return '';

    const { width } = getCanvasSize(canvas);
    const slotsKey = ['top', 'left', 'right', 'bottom'].map((slot) => {
      const slotNodes = Array.isArray(chart.links?.[slot]) ? chart.links[slot] : [];
      const nodeKey = slotNodes.map((nodeId) => {
        const node = getNodeById(nodeId);
        if (!node) return String(nodeId || '');
        return `${node.uid}:${node.role}:${Math.round(Number(node.w || 0))}x${Math.round(Number(node.h || 0))}:${node.compact ? 1 : 0}`;
      }).join(',');
      return `${slot}=${nodeKey}`;
    }).join('|');

    return `${pageLang}|${Math.round(Number(chart.x || 0))}:${Math.round(Number(chart.y || 0))}:${Math.round(Number(chart.w || 0))}:${Math.round(Number(chart.h || 0))}|cw:${Math.round(width)}|data:${getChartDatasetMemoKey(chart)}|${slotsKey}`;
  }

  function realignChartSlots(chart, canvas) {
    if (!chart || chart.role !== 'chart' || !chart.links) return false;

    ['top', 'left', 'right', 'bottom'].forEach((slot) => {
      chart.links[slot] = chart.links[slot].filter((nodeId) => !!getNodeById(nodeId));
      if (slot === 'left') {
        sortChartInputLinksByLegendGroup(chart);
      }
      chart.links[slot].forEach((nodeId) => {
        const node = getNodeById(nodeId);
        if (!node) return;
        node.attachedTo = chart.uid;
        setNodeCompact(node, true);
      });
    });

    const layoutCacheKey = getChartSlotLayoutCacheKey(chart, canvas);
    if (layoutCacheKey && chart.__slotLayoutCacheKey === layoutCacheKey) {
      return false;
    }

    boardPerfCounters.slotRealigns += 1;

    ['top', 'left', 'right', 'bottom'].forEach((slot) => {
      chart.links[slot].forEach((nodeId, idx) => {
        const node = getNodeById(nodeId);
        if (!node) return;
        const target = getSlotTargetPosition(chart, slot, node, idx, canvas);
        node.x = target.x;
        node.y = target.y;
      });
    });

    if (layoutCacheKey) {
      chart.__slotLayoutCacheKey = layoutCacheKey;
    } else {
      delete chart.__slotLayoutCacheKey;
    }

    return true;
  }

  function findSnapCandidate(node, canvas) {
    if (!node || node.role === 'chart') return null;
    const slot = getSlotFromRole(node.role);
    if (!slot) return null;

    const center = getNodeCenter(node);
    const probe = { ...node, compact: true };
    ensureNodeSize(probe);
    let best = null;

    getChartNodes().forEach((chart) => {
      if (!chart.links) return;
      const slotList = chart.links[slot].filter((id) => id !== node.uid);
      const idx = slotList.length;
      const target = getSlotTargetPosition(chart, slot, probe, idx, canvas);
      const targetCenter = {
        x: target.x + probe.w / 2,
        y: target.y + probe.h / 2
      };
      const dist = Math.hypot(center.x - targetCenter.x, center.y - targetCenter.y);

      if (!best || dist < best.dist) {
        best = { chart, slot, target, dist };
      }
    });

    if (!best) return null;
    return best.dist <= NODE_LAYOUT.snapDistance ? best : null;
  }

  function snapNodeToChart(node, chart, slot, canvas, options = {}) {
    if (!node || !chart || !slot || chart.role !== 'chart' || !chart.links) return;

    markBoardHistoryDirty();
    const previousChartId = node.attachedTo || '';
    const skipSlotRealign = !!options.skipSlotRealign;
    const skipLinkedRefresh = !!options.skipLinkedRefresh;

    detachNode(node.uid);
    node.attachedTo = chart.uid;
    node.resized = false;
    setNodeCompact(node, true);

    const idx = chart.links[slot].length;
    const target = getSlotTargetPosition(chart, slot, node, idx, canvas);

    chart.links[slot].push(node.uid);
    node.x = target.x;
    node.y = target.y;
    node.justSnappedAt = Date.now();
    boardState.selectedChartId = chart.uid;

    updateNodeMetricSnapshot(node, getChartRange(chart));
    if (!skipSlotRealign) {
      realignChartSlots(chart, canvas);
    }
    if (!skipLinkedRefresh) {
      refreshLinkedDataNodes(chart);

      if (previousChartId && previousChartId !== chart.uid) {
        refreshLinkedDataNodes(previousChartId);
      }
    }
  }

  function suggestNodePosition(node, canvas) {
    ensureNodeSize(node);
    const { width } = getCanvasSize(canvas);

    if (node.role === 'chart') {
      const chartCount = getChartNodes().length;
      return {
        x: clampNumber(Math.round((width - node.w) / 2), NODE_LAYOUT.pad, Math.max(NODE_LAYOUT.pad, width - node.w - NODE_LAYOUT.pad)),
        y: NODE_LAYOUT.pad + chartCount * (node.h + NODE_LAYOUT.gap)
      };
    }

    const activeChart = getNodeById(boardState.selectedChartId);
    if (activeChart) {
      const slot = getSlotFromRole(node.role);
      const slotList = activeChart?.links?.[slot] || [];
      return getSlotTargetPosition(activeChart, slot, node, slotList.length, canvas);
    }

    const index = boardState.nodes.length;
    const cols = Math.max(1, Math.floor((width - NODE_LAYOUT.pad * 2) / (NODE_LAYOUT.cardW + NODE_LAYOUT.gap)));
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = NODE_LAYOUT.pad + col * (NODE_LAYOUT.cardW + NODE_LAYOUT.gap);
    const y = NODE_LAYOUT.pad + row * (NODE_LAYOUT.cardH + NODE_LAYOUT.gap);

    return {
      x: clampNumber(x, NODE_LAYOUT.pad, Math.max(NODE_LAYOUT.pad, width - node.w - NODE_LAYOUT.pad)),
      y
    };
  }

  function attachNodeToSelectedChart(node, canvas, options = {}) {
    const slot = getSlotFromRole(node.role);
    if (!slot || !boardState.selectedChartId) return;

    const chart = getNodeById(boardState.selectedChartId);
    if (!chart || chart.role !== 'chart') return;

    snapNodeToChart(node, chart, slot, canvas, options);
  }

  function createDuplicateNodeFromSource(source, offsetX = 26, offsetY = 22) {
    const clone = {
      uid: `wb-${++boardState.sequence}`,
      deckId: source.deckId,
      cardId: source.cardId,
      role: source.role,
      title: source.title,
      value: source.value,
      note: source.note,
      attachedTo: '',
      compact: false,
      expanded: false,
      resized: !!source.resized,
      locked: false,
      x: Number(source.x || NODE_LAYOUT.pad) + offsetX,
      y: Number(source.y || NODE_LAYOUT.pad) + offsetY,
      w: Number(source.w || NODE_LAYOUT.cardW),
      h: Number(source.h || NODE_LAYOUT.cardH),
      settings: source.settings && typeof source.settings === 'object' ? { ...source.settings } : {}
    };

    if (clone.role === 'chart') {
      clone.links = { top: [], left: [], right: [], bottom: [] };
      clone.compact = false;
      clone.resized = !!source.resized;
    } else if (source.attachedTo) {
      clone.compact = true;
      clone.resized = false;
    }

    ensureNodeSize(clone);
    ensureNodeSettings(clone);
    updateNodeMetricSnapshot(clone);

    return clone;
  }

  function duplicateNodesInBoard(nodeIds, els, options = {}) {
    if (!els?.canvas) return [];

    const deferRender = !!options.deferRender;
    const ids = sanitizeSelectionNodeIds(nodeIds);
    if (!ids.length) return [];

    const entries = [];
    const chartCloneMap = new Map();

    ids.forEach((nodeId) => {
      const source = getNodeById(nodeId);
      if (!source) return;
      const clone = createDuplicateNodeFromSource(source);
      boardState.nodes.push(clone);
      entries.push({ source, clone });
      if (clone.role === 'chart') {
        chartCloneMap.set(source.uid, clone);
      }
    });

    if (!entries.length) return [];

    markBoardHistoryDirty();
    const cloneIds = entries.map((entry) => entry.clone.uid);

    entries.forEach(({ source, clone }) => {
      if (clone.role === 'chart') {
        fitNodeToCanvas(clone, els.canvas);
        return;
      }

      const sourceChart = source.attachedTo ? getNodeById(source.attachedTo) : null;
      const targetChart = sourceChart && sourceChart.role === 'chart'
        ? (chartCloneMap.get(sourceChart.uid) || sourceChart)
        : null;

      if (targetChart && targetChart.role === 'chart') {
        const slot = getSlotFromRole(clone.role);
        if (slot) {
          snapNodeToChart(clone, targetChart, slot, els.canvas);
          return;
        }
      }

      fitNodeToCanvas(clone, els.canvas);
      updateNodeMetricSnapshot(clone);
    });

    const latestCloneId = cloneIds[cloneIds.length - 1] || '';
    const latestChartClone = entries.map((entry) => entry.clone).reverse().find((node) => node.role === 'chart');
    if (latestChartClone) {
      boardState.selectedChartId = latestChartClone.uid;
    }

    boardState.activeNodeId = latestCloneId;
    boardState.detailNodeId = '';
    boardState.optionsNodeId = '';
    setBoardSelection(cloneIds, { activeId: latestCloneId });

    if (!deferRender) {
      updateCanvasSize(els);
      renderBoardCanvas(els);
    }

    return cloneIds;
  }

  function duplicateNodeInBoard(nodeId, els, options = {}) {
    const cloneIds = duplicateNodesInBoard([nodeId], els, options);
    return cloneIds[0] || '';
  }

  function addCardToBoard(deckId, cardId, els, options = {}) {
    const deck = getDeckById(deckId);
    const template = deck?.cards?.find((card) => card.id === cardId);
    if (!template || !els?.canvas) return null;
    const deferRender = !!options.deferRender;
    const skipSelection = !!options.skipSelection;
    const attachOptions = {
      skipLinkedRefresh: !!options.skipLinkedRefresh,
      skipSlotRealign: !!options.skipSlotRealign
    };

    const node = {
      uid: `wb-${++boardState.sequence}`,
      deckId,
      cardId: template.id,
      role: template.role,
      title: template.title,
      value: template.value,
      note: template.note,
      attachedTo: '',
      compact: false,
      expanded: false,
      resized: false,
      locked: false,
      x: NODE_LAYOUT.pad,
      y: NODE_LAYOUT.pad,
      w: NODE_LAYOUT.cardW,
      h: NODE_LAYOUT.cardH
    };

    ensureNodeSize(node);
    ensureNodeSettings(node);
    updateNodeMetricSnapshot(node);

    if (node.role === 'chart') {
      node.links = { top: [], left: [], right: [], bottom: [] };
      const pos = suggestNodePosition(node, els.canvas);
      node.x = pos.x;
      node.y = pos.y;
      boardState.selectedChartId = node.uid;
      boardState.nodes.push(node);
    } else {
      const pos = suggestNodePosition(node, els.canvas);
      node.x = pos.x;
      node.y = pos.y;
      boardState.nodes.push(node);
      attachNodeToSelectedChart(node, els.canvas, attachOptions);
    }

    if (!skipSelection) {
      boardState.activeNodeId = node.uid;
      setBoardSelection([node.uid], { activeId: node.uid });
    }

    markBoardHistoryDirty();

    if (isBoardMobileUI()) {
      boardMobileState.view = 'board';
      boardMobileState.actionsMenuOpen = false;
      boardMobileState.canvasSettingsOpen = false;
    }

    if (!deferRender) {
      updateCanvasSize(els);
      renderBoardCanvas(els);
    }

    return node;
  }

  function removeNodeFromBoard(nodeId, els, options = {}) {
    const node = getNodeById(nodeId);
    if (!node) return false;

    const deferRender = !!options.deferRender;
    const previousChartId = node.attachedTo || '';

    if (node.role === 'chart' && node.links) {
      const linkedIds = Object.values(node.links).flat();
      boardState.nodes.forEach((entry) => {
        if (!linkedIds.includes(entry.uid)) return;
        entry.attachedTo = '';
        setNodeCompact(entry, false);
      });
      if (boardState.selectedChartId === node.uid) boardState.selectedChartId = '';
    } else {
      detachNode(nodeId);
    }

    if (boardState.detailNodeId === nodeId) boardState.detailNodeId = '';
    if (boardState.optionsNodeId === nodeId) boardState.optionsNodeId = '';
    if (boardState.activeNodeId === nodeId) boardState.activeNodeId = '';

    boardState.nodes = boardState.nodes.filter((entry) => entry.uid !== nodeId);
    setBoardSelection(getSelectedBoardNodeIds().filter((id) => id !== nodeId));
    markBoardHistoryDirty();

    if (boardState.detailNodeId && !getNodeById(boardState.detailNodeId)) {
      boardState.detailNodeId = '';
    }
    if (boardState.optionsNodeId && !getNodeById(boardState.optionsNodeId)) {
      boardState.optionsNodeId = '';
    }

    if (!boardState.selectedChartId) {
      const firstChart = boardState.nodes.find((entry) => entry.role === 'chart');
      boardState.selectedChartId = firstChart?.uid || '';
    }

    if (!boardState.activeNodeId || !getNodeById(boardState.activeNodeId)) {
      boardState.activeNodeId = boardState.selectedChartId || boardState.nodes[0]?.uid || '';
    }

    if (!boardState.selectedNodeIds.length && boardState.activeNodeId) {
      boardState.selectedNodeIds = [boardState.activeNodeId];
    }

    if (previousChartId && previousChartId !== nodeId) {
      refreshLinkedDataNodes(previousChartId);
    }

    if (!deferRender) {
      updateCanvasSize(els);
      renderBoardCanvas(els);
    }

    return true;
  }

  function removeNodesFromBoard(nodeIds, els, options = {}) {
    const ids = sanitizeSelectionNodeIds(nodeIds);
    if (!ids.length) return false;

    ids.forEach((nodeId) => {
      removeNodeFromBoard(nodeId, els, { deferRender: true });
    });

    if (!options.deferRender) {
      updateCanvasSize(els);
      renderBoardCanvas(els);
    }

    return true;
  }

  function toggleNodesLock(nodeIds, els, options = {}) {
    const ids = sanitizeSelectionNodeIds(nodeIds);
    if (!ids.length) return false;

    const nodes = ids
      .map((nodeId) => getNodeById(nodeId))
      .filter(Boolean);
    if (!nodes.length) return false;

    const shouldLock = nodes.some((node) => !node.locked);
    nodes.forEach((node) => {
      node.locked = shouldLock;
    });
    markBoardHistoryDirty();

    if (shouldLock) {
      boardState.detailNodeId = '';
      boardState.optionsNodeId = '';
    }

    const activeId = ids[ids.length - 1] || boardState.activeNodeId;
    setBoardSelection(ids, { activeId });
    boardState.activeNodeId = activeId;
    markBoardHistoryDirty();

    if (!options.deferRender) {
      renderBoardCanvas(els);
    }

    return true;
  }

  function alignNodesInBoard(nodeIds, mode, els, options = {}) {
    if (!els?.canvas) return false;

    const ids = sanitizeSelectionNodeIds(nodeIds);
    if (!ids.length) return false;

    const candidates = ids
      .map((nodeId) => getNodeById(nodeId))
      .filter((node) => node && !node.locked && (!node.attachedTo || node.role === 'chart'));

    if (candidates.length < 2) return false;

    const minX = Math.min(...candidates.map((node) => node.x));
    const maxRight = Math.max(...candidates.map((node) => node.x + node.w));
    const minY = Math.min(...candidates.map((node) => node.y));
    const maxBottom = Math.max(...candidates.map((node) => node.y + node.h));
    const centerX = minX + (maxRight - minX) / 2;
    const centerY = minY + (maxBottom - minY) / 2;

    candidates.forEach((node) => {
      if (mode === 'left') node.x = minX;
      else if (mode === 'right') node.x = maxRight - node.w;
      else if (mode === 'center-x') node.x = centerX - node.w / 2;
      else if (mode === 'top') node.y = minY;
      else if (mode === 'bottom') node.y = maxBottom - node.h;
      else if (mode === 'center-y') node.y = centerY - node.h / 2;

      fitNodeToCanvas(node, els.canvas);
    });

    candidates
      .filter((node) => node.role === 'chart')
      .forEach((chart) => {
        realignChartSlots(chart, els.canvas);
      });

    const activeId = ids[ids.length - 1] || boardState.activeNodeId;
    setBoardSelection(ids, { activeId });
    boardState.activeNodeId = activeId;

    if (!options.deferRender) {
      updateCanvasSize(els);
      renderBoardCanvas(els);
    }

    return true;
  }

  function renderSlotLabels(chart, slot) {
    if (!chart?.links?.[slot]?.length) return boardText.none;
    const titles = chart.links[slot]
      .map((id) => getNodeById(id)?.title)
      .filter(Boolean);

    if (titles.length <= 2) return titles.join(' | ');
    return `${titles[0]} | ${titles[1]} ${boardText.moreItems(titles.length - 2)}`;
  }

  function getNodePopoverDirection(node, canvas) {
    const width = Math.max(0, canvas?.clientWidth || 0);
    return node.x + node.w / 2 > width * 0.56 ? 'is-left' : 'is-right';
  }

  function getCompactModeClass(node) {
    if (!node?.compact) return '';
    if (node.w >= 248) return 'compact-open';
    if (node.w >= 216 && node.h >= 54) return 'compact-rich';
    return 'compact-scroll';
  }

  function getCompactTitleLineClamp(node) {
    if (!node?.compact) return 2;
    return node.w >= 236 && node.h >= 64 ? 2 : 1;
  }

  function applyNodeModeClass(node, nodeEl) {
    if (!nodeEl) return;
    nodeEl.classList.remove('compact-open', 'compact-rich', 'compact-scroll');
    const mode = getCompactModeClass(node);
    if (mode) nodeEl.classList.add(mode);
    nodeEl.style.setProperty('--node-compact-title-lines', String(getCompactTitleLineClamp(node)));
  }

  function renderResizeHandles() {
    return `
      <span class="resize-handle resize-n" data-resize-dir="n"></span>
      <span class="resize-handle resize-e" data-resize-dir="e"></span>
      <span class="resize-handle resize-s" data-resize-dir="s"></span>
      <span class="resize-handle resize-w" data-resize-dir="w"></span>
      <span class="resize-handle resize-ne" data-resize-dir="ne"></span>
      <span class="resize-handle resize-nw" data-resize-dir="nw"></span>
      <span class="resize-handle resize-se" data-resize-dir="se"></span>
      <span class="resize-handle resize-sw" data-resize-dir="sw"></span>
    `;
  }

  function getNodeLinkedChart(node) {
    if (!node || node.role === 'chart' || !node.attachedTo) return null;
    const linked = getNodeById(node.attachedTo);
    return linked && linked.role === 'chart' ? linked : null;
  }


  const LEGEND_GROUP_PREFERRED_TOKENS = isEn
    ? ['publications', 'publication', 'papers']
    : ['publicaciones', 'publicacion', 'papers'];
  const LEGEND_GROUP_STOPWORDS = new Set(isEn
    ? ['the', 'and', 'for', 'with', 'from', 'into', 'onto', 'over', 'under', 'series', 'trend', 'data', 'input', 'inputs', 'chart', 'current', 'monthly']
    : ['de', 'del', 'la', 'el', 'los', 'las', 'y', 'para', 'con', 'desde', 'sobre', 'serie', 'series', 'tendencia', 'datos', 'dato', 'entrada', 'entradas', 'grafico', 'mensual', 'actual']);
  const LEGEND_GROUP_CONNECTORS = new Set(isEn
    ? ['in', 'of', 'for', 'with', 'to', 'the', 'and']
    : ['en', 'de', 'del', 'la', 'el', 'los', 'las', 'y', 'para', 'con']);

  function tokenizeLegendLabel(label) {
    const normalized = normalizeToken(label);
    const tokens = normalized.match(/[a-z0-9]{3,}/g) || [];
    const unique = [];
    const seen = new Set();

    tokens.forEach((token) => {
      if (LEGEND_GROUP_STOPWORDS.has(token) || seen.has(token)) return;
      seen.add(token);
      unique.push(token);
    });

    return unique;
  }

  function stripGroupTokenFromLabel(fullLabel, groupToken) {
    const raw = String(fullLabel || '').trim();
    if (!raw || !groupToken) return raw;

    const words = raw
      .split(/\s+/)
      .filter(Boolean)
      .filter((word) => normalizeToken(word).replace(/[^a-z0-9]/g, '') !== groupToken);

    while (words.length) {
      const lead = normalizeToken(words[0]).replace(/[^a-z0-9]/g, '');
      if (!LEGEND_GROUP_CONNECTORS.has(lead)) break;
      words.shift();
    }

    while (words.length) {
      const tail = normalizeToken(words[words.length - 1]).replace(/[^a-z0-9]/g, '');
      if (!LEGEND_GROUP_CONNECTORS.has(tail)) break;
      words.pop();
    }

    const compact = words.join(' ').replace(/\s{2,}/g, ' ').trim();
    return compact || raw;
  }

  function getChartLegendMemoKey(chartNode) {
    if (!chartNode || chartNode.role !== 'chart') return '';
    return `${pageLang}|${chartNode.uid}|${getChartDatasetMemoKey(chartNode)}`;
  }

  function pushChartLegendMemo(cacheKey, legendMap) {
    if (!cacheKey || !legendMap) return;
    if (chartLegendMemo.size >= CHART_LEGEND_MEMO_LIMIT) {
      const oldestKey = chartLegendMemo.keys().next().value;
      if (oldestKey) chartLegendMemo.delete(oldestKey);
    }
    chartLegendMemo.set(cacheKey, legendMap);
  }

  function buildInputLegendMapForChart(chartNode) {
    const legendMap = new Map();
    if (!chartNode || chartNode.role !== 'chart') return legendMap;

    const cacheKey = getChartLegendMemoKey(chartNode);
    if (cacheKey && chartLegendMemo.has(cacheKey)) {
      return chartLegendMemo.get(cacheKey) || legendMap;
    }

    const dataset = buildChartInputDataset(chartNode);
    if (!dataset || !Array.isArray(dataset.channels) || !dataset.channels.length) {
      if (cacheKey) pushChartLegendMemo(cacheKey, legendMap);
      return legendMap;
    }

    boardPerfCounters.legendMapBuilds += 1;

    const tokenCounts = new Map();
    const channelMeta = dataset.channels.map((channel) => {
      const fullLabel = String(channel.label || '--').trim() || '--';
      const tokens = tokenizeLegendLabel(fullLabel);
      tokens.forEach((token) => {
        tokenCounts.set(token, (tokenCounts.get(token) || 0) + 1);
      });
      return { channel, fullLabel, tokens, groupToken: '' };
    });

    const groupCounts = new Map();

    channelMeta.forEach((entry) => {
      let groupToken = '';

      for (const preferredToken of LEGEND_GROUP_PREFERRED_TOKENS) {
        if (!entry.tokens.includes(preferredToken)) continue;
        if ((tokenCounts.get(preferredToken) || 0) < 2) continue;
        groupToken = preferredToken;
        break;
      }

      if (!groupToken) {
        let bestToken = '';
        let bestCount = 1;

        entry.tokens.forEach((token) => {
          const count = tokenCounts.get(token) || 0;
          if (count < 2) return;

          if (count > bestCount || (count == bestCount && token.length > bestToken.length)) {
            bestToken = token;
            bestCount = count;
          }
        });

        groupToken = bestToken;
      }

      entry.groupToken = groupToken;
      if (groupToken) {
        groupCounts.set(groupToken, (groupCounts.get(groupToken) || 0) + 1);
      }
    });

    channelMeta.forEach((entry) => {
      const compactLabel = stripGroupTokenFromLabel(entry.fullLabel, entry.groupToken);
      legendMap.set(entry.channel.id, {
        fullLabel: entry.fullLabel,
        shortLabel: truncate(compactLabel, 20),
        compactLabel,
        groupToken: entry.groupToken,
        groupCount: entry.groupToken ? (groupCounts.get(entry.groupToken) || 1) : 1,
        color: String(entry.channel.color || '#64748b')
      });
    });

    if (cacheKey) pushChartLegendMemo(cacheKey, legendMap);
    return legendMap;
  }

  function getLegendGroupDisplayLabel(groupToken) {
    const token = String(groupToken || '').trim().toLowerCase();
    if (!token) return '';

    if (['publicaciones', 'publicacion', 'publications', 'publication', 'papers'].includes(token)) {
      return isEn ? 'Publications' : 'Publicaciones';
    }

    return toTitleCase(token.replace(/-/g, ' '));
  }

  function buildChartInputGroupLabelsMarkup(chartNode, canvasWidth) {
    if (!chartNode?.links?.left?.length) return '';

    const legendMap = buildInputLegendMapForChart(chartNode);
    const labels = [];
    let current = null;

    const flushGroup = () => {
      if (!current || current.count < 2) return;

      const displayLabel = getLegendGroupDisplayLabel(current.token);
      if (!displayLabel) return;

      const minSafe = NODE_LAYOUT.pad + 36;
      const maxSafe = Math.max(minSafe, canvasWidth - NODE_LAYOUT.pad - 36);
      const centerX = clampNumber(Math.round((current.minX + current.maxX) / 2), minSafe, maxSafe);
      const topY = Math.max(2, Math.round(current.minY - 18));

      labels.push(`<div class="board-group-label" style="left:${centerX}px;top:${topY}px;--group-color:${escapeHtml(current.color || '#64748b')}">${escapeHtml(displayLabel)}</div>`);
    };

    chartNode.links.left.forEach((nodeId) => {
      const node = getNodeById(nodeId);
      const legend = legendMap.get(nodeId);
      const groupToken = String(legend?.groupToken || '');
      const groupCount = Number(legend?.groupCount || 1);

      if (!node || !groupToken || groupCount < 2) {
        flushGroup();
        current = null;
        return;
      }

      const bounds = {
        minX: Number(node.x || 0),
        maxX: Number(node.x || 0) + Number(node.w || 0),
        minY: Number(node.y || 0),
        maxY: Number(node.y || 0) + Number(node.h || 0)
      };

      if (!current || current.token !== groupToken) {
        flushGroup();
        current = {
          token: groupToken,
          color: String(legend?.color || '#64748b'),
          count: 1,
          minX: bounds.minX,
          maxX: bounds.maxX,
          minY: bounds.minY,
          maxY: bounds.maxY
        };
        return;
      }

      current.count += 1;
      current.minX = Math.min(current.minX, bounds.minX);
      current.maxX = Math.max(current.maxX, bounds.maxX);
      current.minY = Math.min(current.minY, bounds.minY);
      current.maxY = Math.max(current.maxY, bounds.maxY);
    });

    flushGroup();
    return labels.join('');
  }

  function buildInputGroupLabelsMarkup(canvas) {
    const { width } = getCanvasSize(canvas);
    return getChartNodes().map((chartNode) => buildChartInputGroupLabelsMarkup(chartNode, width)).join('');
  }

  function sortChartInputLinksByLegendGroup(chartNode) {
    if (!chartNode?.links?.left?.length) return;

    const originalOrder = new Map();
    chartNode.links.left.forEach((nodeId, index) => {
      originalOrder.set(nodeId, index);
    });

    const legendMap = buildInputLegendMapForChart(chartNode);

    chartNode.links.left.sort((leftId, rightId) => {
      const leftInfo = legendMap.get(leftId);
      const rightInfo = legendMap.get(rightId);

      const leftGroup = leftInfo?.groupToken || '';
      const rightGroup = rightInfo?.groupToken || '';

      if (leftGroup && rightGroup) {
        const countDiff = (rightInfo?.groupCount || 0) - (leftInfo?.groupCount || 0);
        if (countDiff) return countDiff;

        if (leftGroup !== rightGroup) {
          return leftGroup < rightGroup ? -1 : 1;
        }

        const leftCompact = normalizeToken(leftInfo?.compactLabel || '');
        const rightCompact = normalizeToken(rightInfo?.compactLabel || '');
        if (leftCompact !== rightCompact) {
          return leftCompact < rightCompact ? -1 : 1;
        }
      } else if (leftGroup || rightGroup) {
        return leftGroup ? -1 : 1;
      }

      return (originalOrder.get(leftId) || 0) - (originalOrder.get(rightId) || 0);
    });
  }


  function getAttachedInputLegendInfo(node) {
    if (!node || node.role !== 'data' || !node.attachedTo) return null;
    const linkedChart = getNodeById(node.attachedTo);
    if (!linkedChart || linkedChart.role !== 'chart') return null;

    const legendMap = buildInputLegendMapForChart(linkedChart);
    const legend = legendMap.get(node.uid);
    if (!legend) return null;

    return {
      fullLabel: String(legend.fullLabel || node.title || '--'),
      shortLabel: String(legend.shortLabel || legend.fullLabel || node.title || '--'),
      color: String(legend.color || '#64748b')
    };
  }

  function renderInspectorChartLinks(chart) {
    if (!chart || chart.role !== 'chart' || !chart.links) return '';

    const rows = [
      { slot: 'left', label: boardText.data },
      { slot: 'top', label: boardText.control },
      { slot: 'right', label: boardText.output },
      { slot: 'bottom', label: boardText.style }
    ];

    return rows.map((row) => {
      const summary = renderSlotLabels(chart, row.slot);
      return `<div class="inspector-link-row"><strong>${row.label}</strong><span>${escapeHtml(summary)}</span></div>`;
    }).join('');
  }

  function syncInspectorGapUI(els) {
    const lessLabel = boardText.inspectorGapLess;
    const moreLabel = boardText.inspectorGapMore;
    const stepLabel = boardText.inspectorGapStep;
    const canReduce = canReduceCanvasSpace();
    const currentStep = normalizeCanvasStep(boardState.canvasStep);

    if (els?.gapLessBtn) {
      els.gapLessBtn.disabled = !canReduce;
      els.gapLessBtn.setAttribute('aria-label', lessLabel);
      els.gapLessBtn.setAttribute('title', lessLabel);
      const lessLabelEl = els.gapLessBtn.querySelector('.inspector-gap-label');
      if (lessLabelEl) lessLabelEl.textContent = lessLabel;
    }

    if (els?.gapMoreBtn) {
      els.gapMoreBtn.disabled = false;
      els.gapMoreBtn.setAttribute('aria-label', moreLabel);
      els.gapMoreBtn.setAttribute('title', moreLabel);
      const moreLabelEl = els.gapMoreBtn.querySelector('.inspector-gap-label');
      if (moreLabelEl) moreLabelEl.textContent = moreLabel;
    }

    if (els?.gapStepLabel) {
      els.gapStepLabel.textContent = stepLabel;
    }

    if (Array.isArray(els?.gapStepButtons)) {
      els.gapStepButtons.forEach((btn) => {
        const step = normalizeCanvasStep(btn.getAttribute('data-gap-step'));
        const active = step === currentStep;
        const label = stepLabel + ': ' + getCanvasStepLabel(step) + ' (' + step + 'px)';
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        btn.setAttribute('aria-label', label);
        btn.setAttribute('title', label);
      });
    }
  }

  function renderBoardInspector(els, options = {}) {

    if (!els?.inspector) return;

    const traceRenderContext = options.traceRenderContext || buildTraceRenderContext();

    const collapseLabel = boardState.inspectorCollapsed
      ? boardText.inspectorExpandPanel
      : boardText.inspectorCollapse;

    const toggleIcon = boardState.inspectorCollapsed
      ? '<svg class="inspector-toggle-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M5.4 7.8 10 12.2l4.6-4.4"></path></svg>'
      : '<svg class="inspector-toggle-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="m5.4 12.2 4.6-4.4 4.6 4.4"></path></svg>';

    const toggleButton = `<button type="button" class="inspector-toggle" data-inspector-collapse aria-pressed="${boardState.inspectorCollapsed ? 'true' : 'false'}" aria-label="${collapseLabel}" title="${collapseLabel}">${toggleIcon}</button>`;
    const mobileSheetHead = `
      <div class="mobile-inspector-sheet-head">
        <span class="mobile-inspector-sheet-handle" aria-hidden="true"></span>
        <button type="button" class="mobile-inspector-close" data-mobile-inspector-close aria-label="${boardText.mobileCloseInspector}" title="${boardText.mobileCloseInspector}">x</button>
      </div>
    `;

    if (!boardState.nodes.length) {
      els.inspector.hidden = false;
      els.inspector.innerHTML = `
        <section class="widget-inspector-panel is-empty${boardState.inspectorCollapsed ? ' is-collapsed' : ''}" aria-live="polite">
          ${mobileSheetHead}
          <div class="inspector-toggle-bar">
            <h3>${boardText.inspectorTitle}</h3>
            ${toggleButton}
          </div>
          <div class="inspector-body">
            <p><strong>${boardText.inspectorEmptyTitle}</strong></p>
            <p>${boardText.inspectorEmptyHint}</p>
          </div>
        </section>
      `;
      syncBoardMobileUI(els);
      return;
    }

    let activeNode = getNodeById(boardState.activeNodeId);
    if (!activeNode) {
      activeNode = getNodeById(boardState.selectedChartId) || boardState.nodes[0] || null;
      boardState.activeNodeId = activeNode?.uid || '';
    }

    if (!activeNode) {
      els.inspector.hidden = true;
      syncBoardMobileUI(els);
      return;
    }

    const roleLabel = getRoleLabel(activeNode.role);
    const value = escapeHtml(activeNode.value || '--');
    const title = escapeHtml(activeNode.title || '');
    const linkedChart = getNodeLinkedChart(activeNode);
    const attachedLegend = getAttachedInputLegendInfo(activeNode);

    let statusText = boardText.unlinked;
    if (activeNode.role === 'chart') {
      const linkedCount = Object.values(activeNode.links || {}).flat().length;
      statusText = linkedCount ? boardText.cardsCount(linkedCount) : boardText.inspectorNoLinks;
    } else if (linkedChart) {
      statusText = `${boardText.inspectorLinked}: ${linkedChart.title}`;
    }

    const actionButtons = [];
    actionButtons.push(`<button type="button" class="inspector-btn is-primary" data-inspector-focus-node="${activeNode.uid}">${boardText.inspectorGoToCard}</button>`);

    if (activeNode.role !== 'chart' && linkedChart) {
      actionButtons.push(`<button type="button" class="inspector-btn" data-inspector-focus-chart="${linkedChart.uid}">${boardText.inspectorFocusChart}</button>`);
      actionButtons.push(`<button type="button" class="inspector-btn" data-inspector-detach="${activeNode.uid}">${boardText.inspectorDetach}</button>`);
    } else if (activeNode.role !== 'chart') {
      const compactLabel = activeNode.compact ? boardText.inspectorExpand : boardText.inspectorCompact;
      actionButtons.push(`<button type="button" class="inspector-btn" data-inspector-compact="${activeNode.uid}">${compactLabel}</button>`);
    }

    const lockLabel = activeNode.locked ? boardText.inspectorUnlock : boardText.inspectorLock;
    const iconDuplicate = '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="6.4" y="6.4" width="8.2" height="8.2" rx="1.2"></rect><path d="M5 11V5.8c0-.7.5-1.2 1.2-1.2H11"></path></svg>';
    const iconLock = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6.8 9.2V7.7a3.2 3.2 0 1 1 6.4 0v1.5"></path><rect x="5.3" y="9.2" width="9.4" height="6.2" rx="1.2"></rect><path d="M10 11.3v2.1"></path></svg>';
    const iconRemove = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6.7 7.2h6.6M8.1 7.2V6.3c0-.5.4-.9.9-.9h2c.5 0 .9.4.9.9v.9M7.3 8.5l.4 5.6c0 .6.5 1 1 1h2.6c.6 0 1-.4 1-1l.4-5.6"></path></svg>';

    actionButtons.push(`<button type="button" class="inspector-btn is-icon" data-inspector-duplicate="${activeNode.uid}" aria-label="${boardText.inspectorDuplicate}" title="${boardText.inspectorDuplicate}">${iconDuplicate}</button>`);
    actionButtons.push(`<button type="button" class="inspector-btn is-icon" data-inspector-lock="${activeNode.uid}" aria-label="${lockLabel}" title="${lockLabel}">${iconLock}</button>`);
    actionButtons.push(`<button type="button" class="inspector-btn is-danger is-icon" data-node-remove="${activeNode.uid}" aria-label="${boardText.inspectorRemove}" title="${boardText.inspectorRemove}">${iconRemove}</button>`);

    const chartLinks = activeNode.role === 'chart'
      ? `
        <div class="chart-preview inspector-chart-preview" data-chart-kind="${getChartKindFromCard(activeNode)}">
          ${buildBoardChartPreview(activeNode)}
        </div>
        <div class="inspector-section-title">${boardText.inspectorChartLinks}</div>
        <div class="inspector-links-grid">
          ${renderInspectorChartLinks(activeNode)}
        </div>
      `
      : '';

    const inspectorLegend = attachedLegend
      ? `<div class="inspector-legend-full"><span class="inspector-legend-dot" style="--inspector-legend-color:${escapeHtml(attachedLegend.color)}"></span><span class="inspector-legend-text">${escapeHtml(attachedLegend.fullLabel)}</span></div>`
      : '';

    const traceability = renderNodeTraceMarkup(activeNode, 'inspector', traceRenderContext);

    const customizer = activeNode.role === 'chart'
      ? ''
      : renderNodeCustomizer(activeNode, 'inspector');

    els.inspector.hidden = false;
    els.inspector.innerHTML = `
      <section class="widget-inspector-panel${boardState.inspectorCollapsed ? ' is-collapsed' : ''}" aria-live="polite">
        ${mobileSheetHead}
        <div class="inspector-toggle-bar">
          <h3>${boardText.inspectorTitle}</h3>
          ${toggleButton}
        </div>
        <div class="inspector-collapsed-line">
          <span class="inspector-role">${roleLabel}</span>
          <span class="inspector-collapsed-title">${title}</span>
          <span class="inspector-collapsed-value">${value}</span>
        </div>
        <div class="inspector-body">
          <div class="inspector-head">
            <div class="inspector-role">${roleLabel}</div>
            <div class="inspector-actions">${actionButtons.join('')}</div>
          </div>
          <div class="inspector-title">${title}</div>
          <div class="inspector-value">${value}</div>
          <div class="inspector-status">${escapeHtml(statusText)}</div>
          ${traceability}
          ${inspectorLegend}
          ${customizer}
          ${chartLinks}
        </div>
      </section>
    `;
    syncBoardMobileUI(els);
  }

  function resetBoardRenderCache() {
    boardRenderCache.mode = '';
    boardRenderCache.nodeOrder = [];
    boardRenderCache.nodeMarkupById.clear();
    boardRenderCache.groupLabelsMarkup = '';
    boardRenderCache.emptyMarkup = '';
  }

  function setBoardRenderCacheEmpty(markup) {
    boardRenderCache.mode = 'empty';
    boardRenderCache.emptyMarkup = markup;
    boardRenderCache.nodeOrder = [];
    boardRenderCache.nodeMarkupById.clear();
    boardRenderCache.groupLabelsMarkup = '';
  }

  function setBoardRenderCacheNodes(entries, groupLabelsMarkup) {
    boardRenderCache.mode = 'nodes';
    boardRenderCache.nodeOrder = entries.map((entry) => entry.id);
    boardRenderCache.nodeMarkupById.clear();
    entries.forEach((entry) => {
      boardRenderCache.nodeMarkupById.set(entry.id, entry.markup);
    });
    boardRenderCache.groupLabelsMarkup = groupLabelsMarkup;
    boardRenderCache.emptyMarkup = '';
  }

  function renderBoardNodesFull(canvas, entries, groupLabelsMarkup) {
    const nodesMarkup = entries.map((entry) => entry.markup).join('');
    canvas.innerHTML = `${nodesMarkup}${groupLabelsMarkup}`;
    setBoardRenderCacheNodes(entries, groupLabelsMarkup);
  }

  function patchBoardGroupLabels(canvas, groupLabelsMarkup) {
    canvas.querySelectorAll('.board-group-label').forEach((labelEl) => {
      labelEl.remove();
    });

    if (groupLabelsMarkup) {
      canvas.insertAdjacentHTML('beforeend', groupLabelsMarkup);
    }
  }

  function canPatchBoardNodes(entries) {
    if (boardRenderCache.mode !== 'nodes') return false;
    if (boardRenderCache.nodeOrder.length !== entries.length) return false;

    for (let index = 0; index < entries.length; index += 1) {
      if (boardRenderCache.nodeOrder[index] !== entries[index].id) return false;
    }

    return true;
  }

  function renderBoardNodesIncremental(canvas, entries, groupLabelsMarkup) {
    if (!canPatchBoardNodes(entries)) return false;

    const nodeElements = new Map();
    canvas.querySelectorAll('.board-node').forEach((nodeEl) => {
      const nodeId = nodeEl.getAttribute('data-node-id') || '';
      if (nodeId) nodeElements.set(nodeId, nodeEl);
    });

    if (nodeElements.size < entries.length) return false;
    if (entries.some((entry) => !nodeElements.has(entry.id))) return false;

    entries.forEach((entry) => {
      const previousMarkup = boardRenderCache.nodeMarkupById.get(entry.id);
      if (previousMarkup === entry.markup) return;
      const nodeEl = nodeElements.get(entry.id);
      if (nodeEl) {
        nodeEl.outerHTML = entry.markup;
      }
    });

    if (groupLabelsMarkup !== boardRenderCache.groupLabelsMarkup) {
      patchBoardGroupLabels(canvas, groupLabelsMarkup);
    }

    setBoardRenderCacheNodes(entries, groupLabelsMarkup);
    return true;
  }

  function renderBoardNodes(canvas, entries, groupLabelsMarkup) {
    if (!renderBoardNodesIncremental(canvas, entries, groupLabelsMarkup)) {
      renderBoardNodesFull(canvas, entries, groupLabelsMarkup);
    }
  }

  function renderBoardCanvas(els, options = {}) {
    if (!els.canvas || !els.canvasMeta) return;

    boardPerfCounters.renderBoardCanvas += 1;

    boardState.nodes.forEach((node) => {
      ensureNodeSize(node);
      fitNodeToCanvas(node, els.canvas);
    });

    getChartNodes().forEach((chart) => {
      realignChartSlots(chart, els.canvas);
      syncAutoChartTitle(chart);
    });

    const detailNode = getNodeById(boardState.detailNodeId);
    if (!detailNode || !detailNode.compact) {
      boardState.detailNodeId = '';
    }

    const optionsNode = getNodeById(boardState.optionsNodeId);
    if (!optionsNode || optionsNode.role === 'chart') {
      boardState.optionsNodeId = '';
    }

    if (boardState.activeNodeId && !getNodeById(boardState.activeNodeId)) {
      boardState.activeNodeId = '';
    }

    if (!boardState.activeNodeId && boardState.nodes.length) {
      boardState.activeNodeId = boardState.selectedChartId || boardState.nodes[0].uid;
    }

    boardState.selectedNodeIds = sanitizeSelectionNodeIds(boardState.selectedNodeIds);

    updateCanvasSize(els);

    const count = boardState.nodes.length;
    setCanvasMeta(els);

    syncBoardHelpPopover(els);

    const traceRenderContext = buildTraceRenderContext();

    if (!count) {
      boardState.selectedNodeIds = [];
      if (els.canvasShell) {
        els.canvasShell.classList.remove('is-mobile-chart-focus');
      }
      const emptyMarkup = `
        <div class="widget-empty">
          ${getBoardEmptyActionsMarkup()}
          ${getBoardQuickHelpMarkup()}
        </div>
      `;
      if (boardRenderCache.mode !== 'empty' || boardRenderCache.emptyMarkup !== emptyMarkup) {
        els.canvas.innerHTML = emptyMarkup;
      }
      setBoardRenderCacheEmpty(emptyMarkup);
      renderBoardInspector(els, { traceRenderContext });
      syncBoardActionButtons(els);
      syncBoardMobileUI(els);
      if (!options.skipHistory) {
        pushBoardHistoryState();
        scheduleWidgetBoardPersist();
      }
      return;
    }

    const selectedNodeSet = new Set(getSelectedBoardNodeIds());
    const hasMultiSelection = selectedNodeSet.size > 1;
    const mobileFocusChartId = isBoardMobileUI() && !hasMultiSelection
      ? String(boardState.selectedChartId || '')
      : '';
    if (els.canvasShell) {
      els.canvasShell.classList.toggle('is-mobile-chart-focus', !!mobileFocusChartId);
    }

    const nodeMarkupEntries = boardState.nodes.map((node) => {
      const isChart = node.role === 'chart';
      const isNodeSelected = selectedNodeSet.has(node.uid);
      const selectedClass = (!hasMultiSelection && isChart && node.uid === boardState.selectedChartId) ? 'is-selected' : '';
      const attachedClass = node.attachedTo ? 'is-attached' : '';
      const compactClass = node.compact ? 'is-compact' : '';
      const compactModeClass = getCompactModeClass(node);
      const optionsClass = '';
      const activeClass = (boardState.activeNodeId === node.uid || (hasMultiSelection && isNodeSelected)) ? 'is-active' : '';
      const multiSelectedClass = isNodeSelected ? 'is-multi-selected' : '';
      const lockedClass = node.locked ? 'is-locked' : '';
      const lockBadge = node.locked
        ? '<span class="node-lock-badge" aria-hidden="true"><svg class="node-lock-icon" viewBox="0 0 20 20"><path d="M6.8 9.2V7.7a3.2 3.2 0 1 1 6.4 0v1.5"></path><rect x="5.3" y="9.2" width="9.4" height="6.2" rx="1.2"></rect><path d="M10 11.3v2.1"></path></svg></span>'
        : '';
      const snappedClass = node.justSnappedAt && Date.now() - node.justSnappedAt < 820 ? 'is-just-snapped' : '';
      const mobileFocusClass = mobileFocusChartId && node.role === 'chart' && node.uid === mobileFocusChartId ? 'is-mobile-focus-chart' : '';
      const mobileContextClass = mobileFocusChartId && node.uid !== mobileFocusChartId && node.attachedTo !== mobileFocusChartId ? 'is-mobile-context-muted' : '';
      const inlineStyle = `left:${Math.round(node.x)}px;top:${Math.round(node.y)}px;width:${Math.round(node.w)}px;height:${Math.round(node.h)}px;--node-compact-title-lines:${getCompactTitleLineClamp(node)};`;
      const iconRemove = '<svg class="node-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M6.7 7.2h6.6M8.1 7.2V6.3c0-.5.4-.9.9-.9h2c.5 0 .9.4.9.9v.9M7.3 8.5l.4 5.6c0 .6.5 1 1 1h2.6c.6 0 1-.4 1-1l.4-5.6"></path></svg>';

      if (isChart) {
        const markup = `
          <article class="board-node board-node-chart ${selectedClass} ${activeClass} ${multiSelectedClass} ${lockedClass} ${mobileFocusClass} ${mobileContextClass}" data-node-id="${node.uid}" data-node-chart="${node.uid}" tabindex="0" aria-label="${escapeHtml(getNodeAriaLabel(node))}" style="${inlineStyle}">
            ${lockBadge}
            <div class="node-head">
              <div class="node-head-main">
                <div class="node-role">${getRoleLabel(node.role)} - ${boardText.selectedChart}</div>
                <div class="node-title">${node.title}</div>
              </div>
              <div class="node-actions">
                <button class="node-remove node-icon-btn" type="button" data-node-remove="${node.uid}" aria-label="remove">${iconRemove}</button>
              </div>
            </div>
            <div class="chart-body">
              <div class="chart-meta-row">
                ${renderChartSlotMetrics(node, 'pill')}
              </div>
              <div class="chart-preview" data-chart-kind="${getChartKindFromCard(node)}">
                ${buildBoardChartPreview(node)}
              </div>
              ${renderNodeTraceMarkup(node, 'card', traceRenderContext)}
            </div>
            ${node.locked ? '' : renderResizeHandles()}
          </article>
        `;
        return { id: node.uid, markup };
      }

      const linkedChart = getNodeLinkedChart(node);
      const linkSummary = linkedChart ? linkedChart.title : boardText.unlinked;
      const linkSummarySafe = escapeHtml(linkSummary);
      const attachedLegend = getAttachedInputLegendInfo(node);
      const compactLegendSummary = attachedLegend
        ? `<div class="node-mini-content node-mini-legend"><span class="node-mini-legend-dot" style="--node-mini-legend-color:${escapeHtml(attachedLegend.color)}"></span><span class="node-mini-legend-label">${escapeHtml(attachedLegend.shortLabel)}</span></div><div class="node-mini-rich node-mini-legend-rich"><div class="node-mini-rich-title">${escapeHtml(attachedLegend.shortLabel)}</div></div>`
        : '';
      const compactControlValue = formatControlCompactValue(node);
      const compactControlSummary = (node.attachedTo && node.role === 'control')
        ? `<div class="node-mini-content node-mini-control"><span class="node-mini-value">${escapeHtml(compactControlValue)}</span></div><div class="node-mini-rich node-mini-control-rich"><div class="node-mini-rich-value">${escapeHtml(compactControlValue)}</div></div>`
        : '';
      const compactStyleValue = formatStyleCompactValue(node);
      const compactStyleSummary = (node.attachedTo && node.role === 'style')
        ? `<div class="node-mini-content node-mini-control"><span class="node-mini-value">${escapeHtml(compactStyleValue)}</span></div><div class="node-mini-rich node-mini-control-rich"><div class="node-mini-rich-value">${escapeHtml(compactStyleValue)}</div></div>`
        : '';
      const compactOutputValue = buildOutputCompactSummary(node);
      const compactOutputSummary = (node.attachedTo && node.role === 'output')
        ? `<div class="node-mini-content node-mini-output"><span class="node-mini-value">${escapeHtml(compactOutputValue)}</span></div><div class="node-mini-rich node-mini-output-rich"><div class="node-mini-rich-value">${escapeHtml(compactOutputValue)}</div></div>`
        : '';
      const controlTopic = (node.attachedTo && node.role === 'control')
        ? `<div class="node-control-topic" aria-hidden="true">${escapeHtml(getControlTopicLabel(node))}</div>`
        : '';
      const styleTopic = (node.attachedTo && node.role === 'style')
        ? `<div class="node-style-topic" aria-hidden="true">${escapeHtml(getStyleTopicLabel(node))}</div>`
        : '';
      const compactSummary = node.compact
        ? (compactControlSummary || compactStyleSummary || compactOutputSummary || compactLegendSummary || `<div class="node-mini-content"><span class="node-mini-value">${node.value}</span><span class="node-mini-sep">|</span><span class="node-mini-title">${node.title}</span></div><div class="node-mini-rich"><div class="node-mini-rich-value">${node.value}</div><div class="node-mini-rich-title">${node.title}</div></div>`)
        : '';

      const markup = `
        <article class="board-node ${attachedClass} ${compactClass} ${compactModeClass} ${optionsClass} ${activeClass} ${multiSelectedClass} ${lockedClass} ${snappedClass} ${mobileFocusClass} ${mobileContextClass}" data-node-id="${node.uid}" data-node-role="${node.role}" tabindex="0" aria-label="${escapeHtml(getNodeAriaLabel(node))}" style="${inlineStyle}">
          ${lockBadge}
          ${controlTopic}
          ${styleTopic}
          <div class="node-head">
            <div class="node-head-main">
              <span class="node-role-chip">${getRoleLabel(node.role)}</span>
            </div>
            <div class="node-actions">
              <button class="node-remove node-icon-btn" type="button" data-node-remove="${node.uid}" aria-label="remove">${iconRemove}</button>
            </div>
          </div>
          ${compactSummary}
          <div class="node-body">
            <div class="node-value">${node.value}</div>
            <div class="node-title">${node.title}</div>
            <div class="node-status-row">
              <span class="node-status-chip ${linkedChart ? 'is-linked' : ''}" title="${linkSummarySafe}">${linkSummarySafe}</span>
            </div>
            ${renderNodeTraceMarkup(node, 'card', traceRenderContext)}
          </div>
          ${(node.locked || node.attachedTo) ? '' : renderResizeHandles()}
        </article>
      `;
      return { id: node.uid, markup };
    });

    const groupLabelsMarkup = buildInputGroupLabelsMarkup(els.canvas);
    renderBoardNodes(els.canvas, nodeMarkupEntries, groupLabelsMarkup);

    renderBoardInspector(els, { traceRenderContext });
    syncBoardActionButtons(els);
    syncBoardMobileUI(els);
    if (!options.skipHistory) {
      pushBoardHistoryState();
      scheduleWidgetBoardPersist();
    }
  }

  function resetWidgetBoard(els, options = {}) {
    const deferRender = !!options.deferRender;
    const renderOptions = options.renderOptions && typeof options.renderOptions === 'object'
      ? options.renderOptions
      : {};

    boardMobileState.view = 'decks';
    boardMobileState.actionsMenuOpen = false;
    boardMobileState.canvasSettingsOpen = false;
    boardMobileState.inspectorSheetOpen = false;

    boardState.nodes = [];
    boardState.selectedChartId = '';
    boardState.sequence = 0;
    boardState.detailNodeId = '';
    boardState.optionsNodeId = '';
    boardState.activeNodeId = '';
    boardState.selectedNodeIds = [];
    boardState.inspectorCollapsed = false;
    boardState.helpOpen = false;
    boardState.canvasUserExtra = 0;
    boardState.canvasHeight = NODE_LAYOUT.minCanvasH;
    boardState.canvasStep = NODE_LAYOUT.canvasExtraStep;
    clearBoardHold();
    clearBoardMarquee(els);
    clearSnapPreview(els);
    clearBoardResize();
    clearWidgetBoardStoredState();
    resetBoardRenderCache();
    markBoardHistoryDirty();
    if (!deferRender) {
      renderBoardCanvas(els, renderOptions);
    } else {
      syncBoardMobileUI(els);
    }
  }

  function beginNodeDrag(event, els) {
    if (!els?.canvas) return;
    const nodeEl = event.target.closest('.board-node');
    if (!nodeEl || !els.canvas.contains(nodeEl)) return;
    if (event.target.closest('.node-remove')) return;
    if (event.target.closest('.node-expand')) return;
    if (event.target.closest('.node-tune')) return;
    if (event.target.closest('[data-node-popover]')) return;
    if (event.target.closest('.node-customizer')) return;
    if (event.target.closest('[data-resize-dir]')) return;
    if (typeof event.button === 'number' && event.button !== 0) return;

    const nodeId = nodeEl.getAttribute('data-node-id') || '';
    const node = getNodeById(nodeId);
    if (!node) return;

    const hasModifierSelection = !!(event.shiftKey || event.ctrlKey || event.metaKey);
    const selectedIds = getSelectedBoardNodeIds();
    if (hasModifierSelection) {
      toggleBoardSelectionNode(node.uid);
    } else if (!selectedIds.includes(node.uid) || selectedIds.length > 1) {
      setBoardSelection([node.uid], { activeId: node.uid });
    }

    boardState.activeNodeId = node.uid;

    if (event.pointerType === 'touch' && isBoardMobileUI()) {
      if (boardMobileState.touchMode !== 'move') {
        clearBoardHold();
        return;
      }
    }

    if (node.locked) return;

    const miniContentEl = event.target.closest('.node-mini-content');
    const scrollBodyEl = event.target.closest('.node-mini-rich, .node-body, .chart-body');
    const canScrollX = !!(
      miniContentEl &&
      miniContentEl.scrollWidth > miniContentEl.clientWidth + 1
    );
    const canScrollY = !!(
      scrollBodyEl &&
      scrollBodyEl.scrollHeight > scrollBodyEl.clientHeight + 1
    );

    if (
      !nodeEl.classList.contains('has-options') &&
      ((node.compact && canScrollX) || canScrollY)
    ) {
      return;
    }

    if (boardState.detailNodeId) boardState.detailNodeId = '';
    if (event.pointerType !== 'touch' && boardState.optionsNodeId) boardState.optionsNodeId = '';

    fitNodeToCanvas(node, els.canvas);

    const canvasRect = els.canvas.getBoundingClientRect();
    const offsetX = event.clientX - canvasRect.left - node.x;
    const offsetY = event.clientY - canvasRect.top - node.y;

    if (event.pointerType === 'touch') {
      if (isBoardMobileUI()) {
        startNodeDrag(node, nodeEl, event, offsetX, offsetY, els);
        event.preventDefault();
        return;
      }
      clearBoardHold();
      boardHold.active = true;
      boardHold.nodeId = nodeId;
      boardHold.nodeEl = nodeEl;
      boardHold.pointerId = event.pointerId;
      boardHold.startX = event.clientX;
      boardHold.startY = event.clientY;
      boardHold.offsetX = offsetX;
      boardHold.offsetY = offsetY;
      boardHold.timer = window.setTimeout(() => {
        if (!boardHold.active || boardDrag.active) return;
        if (toggleNodeOptions(boardHold.nodeId, els)) {
          boardDrag.skipClick = true;
        }
        clearBoardHold();
      }, 420);
      return;
    }

    startNodeDrag(node, nodeEl, event, offsetX, offsetY, els);
    event.preventDefault();
  }


  function moveNodeDrag(event, els) {
    if (boardHold.active && !boardDrag.active) {
      if (typeof boardHold.pointerId === 'number' && event.pointerId !== boardHold.pointerId) return;

      const dx = event.clientX - boardHold.startX;
      const dy = event.clientY - boardHold.startY;
      if (Math.hypot(dx, dy) > 6) {
        const node = getNodeById(boardHold.nodeId);
        const nodeEl = boardHold.nodeEl;
        if (!node || !nodeEl) {
          clearBoardHold();
          return;
        }

        if (node.locked) {
          clearBoardHold();
          return;
        }

        const offsetX = boardHold.offsetX;
        const offsetY = boardHold.offsetY;
        clearBoardHold();
        startNodeDrag(node, nodeEl, event, offsetX, offsetY, els);
      } else {
        return;
      }
    }

    if (!boardDrag.active || !els?.canvas) return;
    if (typeof boardDrag.pointerId === 'number' && event.pointerId !== boardDrag.pointerId) return;

    const node = getNodeById(boardDrag.nodeId);
    if (!node) return;

    ensureNodeSize(node);

    const canvasRect = els.canvas.getBoundingClientRect();
    const maxX = Math.max(NODE_LAYOUT.pad, els.canvas.clientWidth - node.w - NODE_LAYOUT.pad);

    const nextX = clampNumber(event.clientX - canvasRect.left - boardDrag.offsetX, NODE_LAYOUT.pad, maxX);
    const nextY = Math.max(NODE_LAYOUT.pad, event.clientY - canvasRect.top - boardDrag.offsetY);

    if (Math.abs(nextX - node.x) > 0.8 || Math.abs(nextY - node.y) > 0.8) boardDrag.moved = true;

    node.x = nextX;
    node.y = nextY;

    if (boardDrag.nodeEl) {
      boardDrag.nodeEl.style.left = `${Math.round(nextX)}px`;
      boardDrag.nodeEl.style.top = `${Math.round(nextY)}px`;
    }

    if (node.role !== 'chart') {
      const snap = findSnapCandidate(node, els.canvas);
      updateSnapPreview(node, snap, els);
      if (snap) {
        setCanvasMeta(els, boardText.snapHint(getSlotLabel(snap.slot)));
      } else {
        setCanvasMeta(els, boardText.dragHint);
      }
    } else {
      clearSnapPreview(els);
      setCanvasMeta(els, boardText.dragHint);
    }

    updateCanvasSize(els);
    event.preventDefault();
  }


  function endNodeDrag(event, els) {
    if (boardHold.active) {
      if (typeof boardHold.pointerId === 'number' && typeof event.pointerId === 'number' && boardHold.pointerId !== event.pointerId) return;
      clearBoardHold();
      return;
    }

    if (!boardDrag.active) return;
    if (typeof boardDrag.pointerId === 'number' && typeof event.pointerId === 'number' && boardDrag.pointerId !== event.pointerId) return;

    const draggedNode = getNodeById(boardDrag.nodeId);

    if (boardDrag.nodeEl) {
      boardDrag.nodeEl.classList.remove('is-dragging');
      boardDrag.nodeEl.classList.remove('is-grab-start');
      boardDrag.nodeEl.style.zIndex = '';
    }

    if (boardDrag.grabTimer) {
      window.clearTimeout(boardDrag.grabTimer);
      boardDrag.grabTimer = 0;
    }

    const dragDidMove = boardDrag.moved;
    if (dragDidMove) boardDrag.skipClick = true;

    boardDrag.active = false;
    boardDrag.nodeId = '';
    boardDrag.nodeEl = null;
    boardDrag.pointerId = null;
    boardDrag.offsetX = 0;
    boardDrag.offsetY = 0;
    boardDrag.moved = false;

    if (dragDidMove) {
      markBoardHistoryDirty();
    }

    if (draggedNode && els?.canvas) {
      if (draggedNode.role === 'chart') {
        realignChartSlots(draggedNode, els.canvas);
      } else {
        let snap = null;
        if (boardDrag.snapPreview?.chartId) {
          const chart = getNodeById(boardDrag.snapPreview.chartId);
          if (chart && chart.role === 'chart') {
            snap = { chart, slot: boardDrag.snapPreview.slot };
          }
        }

        if (!snap) snap = findSnapCandidate(draggedNode, els.canvas);

        const previousChartId = draggedNode.attachedTo || '';

        if (snap) {
          snapNodeToChart(draggedNode, snap.chart, snap.slot, els.canvas);
        } else {
          detachNode(draggedNode.uid);
          fitNodeToCanvas(draggedNode, els.canvas);
          if (previousChartId) refreshLinkedDataNodes(previousChartId);
        }
      }
    }

    clearSnapPreview(els);
    renderBoardCanvas(els);
  }


  function handleNodeSettingsChange(event, els) {
    const refreshAttachedChart = (node, rangeOverride) => {
      if (!node?.attachedTo) return;
      refreshLinkedDataNodes(node.attachedTo, rangeOverride);
    };

    const metricSelect = event.target.closest('[data-node-metric]');
    if (metricSelect) {
      const nodeId = metricSelect.getAttribute('data-node-metric') || '';
      const node = getNodeById(nodeId);
      if (!node) return true;
      ensureNodeSettings(node);
      node.settings.metric = String(metricSelect.value || getDefaultMetricForCard(node.cardId)).toLowerCase();
      if (node.settings.metric !== 'keyword-custom') node.settings.keyword = '';
      markBoardHistoryDirty();
      updateNodeMetricSnapshot(node);
      refreshAttachedChart(node);
      boardState.activeNodeId = node.uid;
      renderBoardCanvas(els);
      return true;
    }

    const transformSelect = event.target.closest('[data-node-transform]');
    if (transformSelect) {
      const nodeId = transformSelect.getAttribute('data-node-transform') || '';
      const node = getNodeById(nodeId);
      if (!node) return true;
      ensureNodeSettings(node);
      node.settings.transform = normalizeTransformId(transformSelect.value);
      markBoardHistoryDirty();
      updateNodeMetricSnapshot(node);
      refreshAttachedChart(node);
      boardState.activeNodeId = node.uid;
      renderBoardCanvas(els);
      return true;
    }

    const aggregateSelect = event.target.closest('[data-node-agg]');
    if (aggregateSelect) {
      const nodeId = aggregateSelect.getAttribute('data-node-agg') || '';
      const node = getNodeById(nodeId);
      if (!node) return true;
      ensureNodeSettings(node);
      node.settings.aggregate = normalizeAggregateId(aggregateSelect.value);
      markBoardHistoryDirty();
      updateNodeMetricSnapshot(node);
      refreshAttachedChart(node);
      boardState.activeNodeId = node.uid;
      renderBoardCanvas(els);
      return true;
    }

    const keywordInput = event.target.closest('[data-node-keyword]');
    if (keywordInput) {
      const nodeId = keywordInput.getAttribute('data-node-keyword') || '';
      const node = getNodeById(nodeId);
      if (!node) return true;
      ensureNodeSettings(node);
      node.settings.keyword = sanitizeKeywordInput(keywordInput.value || '');
      markBoardHistoryDirty();
      updateNodeMetricSnapshot(node);
      refreshAttachedChart(node);
      boardState.activeNodeId = node.uid;
      renderBoardCanvas(els);
      return true;
    }

    const rangeSelect = event.target.closest('[data-node-range]');
    if (rangeSelect) {
      const nodeId = rangeSelect.getAttribute('data-node-range') || '';
      const node = getNodeById(nodeId);
      if (!node) return true;
      ensureNodeSettings(node);
      node.settings.rangeMonths = clampRangeMonths(rangeSelect.value);
      markBoardHistoryDirty();
      updateNodeMetricSnapshot(node, node.settings.rangeMonths);
      if (node.attachedTo) {
        refreshLinkedDataNodes(node.attachedTo, node.settings.rangeMonths);
      }
      boardState.activeNodeId = node.uid;
      renderBoardCanvas(els);
      return true;
    }

    const sourceInput = event.target.closest('[data-node-source]');
    if (sourceInput) {
      const nodeId = sourceInput.getAttribute('data-node-source') || '';
      const sourceKey = sourceInput.getAttribute('data-source-key') || '';
      const node = getNodeById(nodeId);
      if (!node) return true;
      ensureNodeSettings(node);
      node.settings.sourceBlend = rebalanceSourceBlend(node.settings.sourceBlend, sourceKey, sourceInput.value);
      markBoardHistoryDirty();

      const chart = node.attachedTo ? getNodeById(node.attachedTo) : null;
      const range = chart ? getChartRange(chart) : clampRangeMonths(heroState.range || 6);
      updateNodeMetricSnapshot(node, range);
      if (node.attachedTo) {
        refreshLinkedDataNodes(node.attachedTo, range);
      }

      boardState.activeNodeId = node.uid;
      renderBoardCanvas(els);
      return true;
    }

    const styleDepthInput = event.target.closest('[data-node-style-depth]');
    if (styleDepthInput) {
      const nodeId = styleDepthInput.getAttribute('data-node-style-depth') || '';
      const node = getNodeById(nodeId);
      if (!node) return true;
      ensureNodeSettings(node);
      const current = normalizeStyleDepthSettings(node.settings.styleDepth);
      node.settings.styleDepth = normalizeStyleDepthSettings({ ...current, depth: styleDepthInput.value });
      markBoardHistoryDirty();
      updateNodeMetricSnapshot(node);
      refreshAttachedChart(node);
      boardState.activeNodeId = node.uid;
      renderBoardCanvas(els);
      return true;
    }

    const styleGlowInput = event.target.closest('[data-node-style-glow]');
    if (styleGlowInput) {
      const nodeId = styleGlowInput.getAttribute('data-node-style-glow') || '';
      const node = getNodeById(nodeId);
      if (!node) return true;
      ensureNodeSettings(node);
      const current = normalizeStyleDepthSettings(node.settings.styleDepth);
      node.settings.styleDepth = normalizeStyleDepthSettings({ ...current, glow: styleGlowInput.value });
      markBoardHistoryDirty();
      updateNodeMetricSnapshot(node);
      refreshAttachedChart(node);
      boardState.activeNodeId = node.uid;
      renderBoardCanvas(els);
      return true;
    }

    const stylePaletteSelect = event.target.closest('[data-node-style-palette]');
    if (stylePaletteSelect) {
      const nodeId = stylePaletteSelect.getAttribute('data-node-style-palette') || '';
      const node = getNodeById(nodeId);
      if (!node) return true;
      ensureNodeSettings(node);
      const current = normalizeStyleColorSettings(node.settings.styleColor);
      node.settings.styleColor = normalizeStyleColorSettings({ ...current, palette: stylePaletteSelect.value });
      markBoardHistoryDirty();
      updateNodeMetricSnapshot(node);
      refreshAttachedChart(node);
      boardState.activeNodeId = node.uid;
      renderBoardCanvas(els);
      return true;
    }

    const styleContrastInput = event.target.closest('[data-node-style-contrast]');
    if (styleContrastInput) {
      const nodeId = styleContrastInput.getAttribute('data-node-style-contrast') || '';
      const node = getNodeById(nodeId);
      if (!node) return true;
      ensureNodeSettings(node);
      const current = normalizeStyleColorSettings(node.settings.styleColor);
      node.settings.styleColor = normalizeStyleColorSettings({ ...current, contrast: styleContrastInput.value });
      markBoardHistoryDirty();
      updateNodeMetricSnapshot(node);
      refreshAttachedChart(node);
      boardState.activeNodeId = node.uid;
      renderBoardCanvas(els);
      return true;
    }

    const style3dReliefInput = event.target.closest('[data-node-style-3d-relief]');
    if (style3dReliefInput) {
      const nodeId = style3dReliefInput.getAttribute('data-node-style-3d-relief') || '';
      const node = getNodeById(nodeId);
      if (!node) return true;
      ensureNodeSettings(node);
      const current = normalizeStyleThreeDSettings(node.settings.style3d);
      node.settings.style3d = normalizeStyleThreeDSettings({ ...current, relief: style3dReliefInput.value });
      markBoardHistoryDirty();
      updateNodeMetricSnapshot(node);
      refreshAttachedChart(node);
      boardState.activeNodeId = node.uid;
      renderBoardCanvas(els);
      return true;
    }

    const style3dSoftnessInput = event.target.closest('[data-node-style-3d-softness]');
    if (style3dSoftnessInput) {
      const nodeId = style3dSoftnessInput.getAttribute('data-node-style-3d-softness') || '';
      const node = getNodeById(nodeId);
      if (!node) return true;
      ensureNodeSettings(node);
      const current = normalizeStyleThreeDSettings(node.settings.style3d);
      node.settings.style3d = normalizeStyleThreeDSettings({ ...current, softness: style3dSoftnessInput.value });
      markBoardHistoryDirty();
      updateNodeMetricSnapshot(node);
      refreshAttachedChart(node);
      boardState.activeNodeId = node.uid;
      renderBoardCanvas(els);
      return true;
    }

    return false;
  }

  function handleInspectorClick(event, els) {
    const closeInspectorButton = event.target.closest('[data-mobile-inspector-close]');
    if (closeInspectorButton) {
      closeBoardInspectorSheet(els, { view: 'board' });
      return true;
    }

    const collapseButton = event.target.closest('[data-inspector-collapse]');
    if (collapseButton) {
      boardState.inspectorCollapsed = !boardState.inspectorCollapsed;
      markBoardHistoryDirty();
      renderBoardInspector(els);
      scheduleWidgetBoardPersist();
      return true;
    }

    const focusNodeButton = event.target.closest('[data-inspector-focus-node]');
    if (focusNodeButton) {
      const nodeId = focusNodeButton.getAttribute('data-inspector-focus-node') || '';
      focusNodeFromInspector(nodeId, els);
      return true;
    }

    const removeButton = event.target.closest('[data-node-remove]');
    if (removeButton) {
      const nodeId = removeButton.getAttribute('data-node-remove') || '';
      const selection = getSelectedBoardNodeIds();
      if (selection.length > 1 && selection.includes(nodeId)) {
        removeNodesFromBoard(selection, els);
      } else {
        removeNodeFromBoard(nodeId, els);
      }
      return true;
    }

    const duplicateButton = event.target.closest('[data-inspector-duplicate]');
    if (duplicateButton) {
      const nodeId = duplicateButton.getAttribute('data-inspector-duplicate') || '';
      const selection = getSelectedBoardNodeIds();
      if (selection.length > 1 && selection.includes(nodeId)) {
        duplicateNodesInBoard(selection, els);
      } else {
        duplicateNodeInBoard(nodeId, els);
      }
      return true;
    }

    const lockButton = event.target.closest('[data-inspector-lock]');
    if (lockButton) {
      const nodeId = lockButton.getAttribute('data-inspector-lock') || '';
      const selection = getSelectedBoardNodeIds();
      if (selection.length > 1 && selection.includes(nodeId)) {
        toggleNodesLock(selection, els);
      } else {
        toggleNodesLock([nodeId], els);
      }
      return true;
    }

    const focusButton = event.target.closest('[data-inspector-focus-chart]');
    if (focusButton) {
      const chartId = focusButton.getAttribute('data-inspector-focus-chart') || '';
      focusNodeFromInspector(chartId, els);
      return true;
    }

    const detachButton = event.target.closest('[data-inspector-detach]');
    if (detachButton) {
      const nodeId = detachButton.getAttribute('data-inspector-detach') || '';
      const node = getNodeById(nodeId);
      if (!node || node.role === 'chart') return true;
      const previousChartId = node.attachedTo || '';
      detachNode(nodeId);
      fitNodeToCanvas(node, els.canvas);
      if (previousChartId) refreshLinkedDataNodes(previousChartId);
      boardState.activeNodeId = node.uid;
      updateCanvasSize(els);
      renderBoardCanvas(els);
      return true;
    }

    const compactButton = event.target.closest('[data-inspector-compact]');
    if (compactButton) {
      const nodeId = compactButton.getAttribute('data-inspector-compact') || '';
      const node = getNodeById(nodeId);
      if (!node || node.role === 'chart') return true;
      setNodeCompact(node, !node.compact);
      node.resized = false;
      fitNodeToCanvas(node, els.canvas);
      boardState.activeNodeId = node.uid;
      updateCanvasSize(els);
      renderBoardCanvas(els);
      return true;
    }

    return false;
  }

  function initWidgetBoard() {
    const els = getBoardElements();
    if (!els.deckRail || !els.canvas || !els.modal || !els.modalList) return;

    widgetBoardEls = els;
    boardPersistenceEnabled = false;
    setWidgetBoardCollapsed(true, els);
    renderDeckRail(els.deckRail);
    syncInspectorGapUI(els);

    const restoredFromUrl = restoreWidgetBoardStateFromUrl(els);
    const restored = restoredFromUrl || restoreWidgetBoardState(els);
    if (!restored) {
      renderBoardCanvas(els);
    }
    if (restoredFromUrl) {
      setCanvasMeta(els, boardText.shareUrlLoaded);
    }

    boardMobileState.view = boardState.nodes.length ? 'board' : 'decks';
    syncBoardMobileUI(els);

    if (els.templatesBtn) {
      els.templatesBtn.textContent = boardText.templateButton;
      els.templatesBtn.setAttribute('aria-label', boardText.templateButton);
      els.templatesBtn.setAttribute('title', boardText.templateButton);
    }

    if (els.exportPngBtn) {
      els.exportPngBtn.textContent = boardText.exportPngButton;
      els.exportPngBtn.setAttribute('aria-label', boardText.exportPngButton);
      els.exportPngBtn.setAttribute('title', boardText.exportPngButton);
    }

    if (els.exportCsvBtn) {
      els.exportCsvBtn.textContent = boardText.exportCsvButton;
      els.exportCsvBtn.setAttribute('aria-label', boardText.exportCsvButton);
      els.exportCsvBtn.setAttribute('title', boardText.exportCsvButton);
    }

    if (els.shareUrlBtn) {
      els.shareUrlBtn.textContent = boardText.shareUrlButton;
      els.shareUrlBtn.setAttribute('aria-label', boardText.shareUrlButton);
      els.shareUrlBtn.setAttribute('title', boardText.shareUrlButton);
    }

    syncBoardActionButtons(els);
    syncWidgetDecksWithRealData(els);
    syncBoardMobileUI(els);
    initBoardHistoryState();
    boardPersistenceEnabled = true;
    scheduleWidgetBoardPersist();
    els.deckRail.addEventListener('click', (event) => {
      const button = event.target.closest('[data-deck-id]');
      if (!button) return;
      openDeck(button.getAttribute('data-deck-id') || '', els);
    });

    if (els.collapseToggleBtn) {
      syncWidgetBoardCollapseUI(els);
      els.collapseToggleBtn.addEventListener('click', () => {
        const collapsed = !!els.section?.classList.contains('is-collapsed');
        setWidgetBoardCollapsed(!collapsed, els);
      });
    }

    if (els.templatesBtn) {
      els.templatesBtn.addEventListener('click', () => {
        setBoardActionsMenuOpen(false, els);
        renderTemplateCatalog(els);
      });
    }

    if (els.exportPngBtn) {
      els.exportPngBtn.addEventListener('click', async () => {
        setBoardActionsMenuOpen(false, els);
        await runBoardAction(els.exportPngBtn, () => exportWidgetBoardPng(els));
      });
    }

    if (els.exportCsvBtn) {
      els.exportCsvBtn.addEventListener('click', async () => {
        setBoardActionsMenuOpen(false, els);
        await runBoardAction(els.exportCsvBtn, () => Promise.resolve(exportWidgetBoardCsv(els)));
      });
    }

    if (els.shareUrlBtn) {
      els.shareUrlBtn.addEventListener('click', async () => {
        setBoardActionsMenuOpen(false, els);
        await runBoardAction(els.shareUrlBtn, () => copyWidgetBoardShareUrl(els));
      });
    }

    if (els.actionsToggleBtn) {
      els.actionsToggleBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        setBoardActionsMenuOpen(!boardMobileState.actionsMenuOpen, els);
      });
    }

    if (els.mobileNav) {
      els.mobileNav.addEventListener('click', (event) => {
        const button = event.target.closest('[data-mobile-view]');
        if (!button) return;
        setBoardMobileView(button.getAttribute('data-mobile-view') || 'board', els);
      });
    }

    if (els.touchMode) {
      els.touchMode.addEventListener('click', (event) => {
        const button = event.target.closest('[data-touch-mode]');
        if (!button) return;
        setBoardMobileTouchMode(button.getAttribute('data-touch-mode') || 'select', els);
      });
    }

    if (els.canvasSettingsToggleBtn) {
      els.canvasSettingsToggleBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        setCanvasSettingsOpen(!boardMobileState.canvasSettingsOpen, els);
      });
    }

    if (els.inspectorBackdrop) {
      els.inspectorBackdrop.addEventListener('click', () => {
        closeBoardInspectorSheet(els, { view: 'board' });
      });
    }

    if (els.mobileSelectionBar) {
      els.mobileSelectionBar.addEventListener('click', (event) => {
        const button = event.target.closest('[data-mobile-selection-action]');
        if (!button || button.disabled) return;

        const action = button.getAttribute('data-mobile-selection-action') || '';
        const selection = getSelectedBoardNodeIds();
        const activeId = selection[selection.length - 1] || boardState.activeNodeId;
        const activeNode = activeId ? getNodeById(activeId) : getActiveBoardNode();
        if (!activeNode) return;

        if (action === 'inspect') {
          focusInspectorFromNode(activeNode.uid, els);
          return;
        }

        if (action === 'duplicate') {
          if (selection.length > 1) {
            duplicateNodesInBoard(selection, els);
          } else {
            duplicateNodeInBoard(activeNode.uid, els);
          }
          return;
        }

        if (action === 'detach') {
          if (activeNode.role === 'chart' || !activeNode.attachedTo) return;
          const previousChartId = activeNode.attachedTo;
          detachNode(activeNode.uid);
          fitNodeToCanvas(activeNode, els.canvas);
          if (previousChartId) refreshLinkedDataNodes(previousChartId);
          updateCanvasSize(els);
          renderBoardCanvas(els);
          return;
        }

        if (action === 'remove') {
          if (selection.length > 1) {
            removeNodesFromBoard(selection, els);
          } else {
            removeNodeFromBoard(activeNode.uid, els);
          }
        }
      });
    }

    document.querySelectorAll('.deck-scroll-btn[data-scroll]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const dir = btn.getAttribute('data-scroll') === 'left' ? -1 : 1;
        els.deckRail.scrollBy({ left: dir * Math.max(220, Math.round(els.deckRail.clientWidth * 0.8)), behavior: 'smooth' });
      });
    });

    els.modal.addEventListener('click', async (event) => {
      const closeTrigger = event.target.closest('[data-close-modal]');
      if (closeTrigger) {
        closeModal(els.modal);
        return;
      }

      const backButton = event.target.closest('[data-sponsored-back]');
      if (backButton) {
        openDeck(backButton.getAttribute('data-sponsored-back') || '', els);
        return;
      }
      const sponsoredDeckButton = event.target.closest('[data-open-sponsored-deck]');
      if (sponsoredDeckButton) {
        openDeck(sponsoredDeckButton.getAttribute('data-open-sponsored-deck') || '', els);
        return;
      }

      const applyTemplateButton = event.target.closest('[data-apply-template]');
      if (applyTemplateButton) {
        const templateId = applyTemplateButton.getAttribute('data-apply-template') || '';
        const mode = applyTemplateButton.getAttribute('data-apply-template-mode') === 'replace' ? 'replace' : 'append';
        const template = getBoardTemplateById(templateId);
        if (!template) return;
        const applied = await importBoardTemplate(templateId, els, { mode, triggerButton: applyTemplateButton });
        if (applied) {
          setCanvasMeta(els, boardText.templateApplied(template.name, mode));
        }
        return;
      }

      const addButton = event.target.closest('[data-add-card]');
      if (!addButton) return;
      const cardId = addButton.getAttribute('data-add-card') || '';
      addCardToBoard(boardState.currentDeckId, cardId, els);
    });

    const handleSettingsInput = (event) => {
      if (!event.target.closest('[data-node-source], [data-node-style-depth], [data-node-style-glow], [data-node-style-contrast], [data-node-style-3d-relief], [data-node-style-3d-softness]')) return;
      handleNodeSettingsChange(event, els);
    };

    els.canvas.addEventListener('change', (event) => {
      handleNodeSettingsChange(event, els);
    });

    els.canvas.addEventListener('input', handleSettingsInput);

    if (els.inspector) {
      els.inspector.addEventListener('change', (event) => {
        handleNodeSettingsChange(event, els);
      });

      els.inspector.addEventListener('input', handleSettingsInput);

      els.inspector.addEventListener('click', (event) => {
        handleInspectorClick(event, els);
      });
    }

    if (els.gapMoreBtn) {
      els.gapMoreBtn.addEventListener('click', () => {
        adjustCanvasSpace(1, els);
      });
    }

    if (els.gapLessBtn) {
      els.gapLessBtn.addEventListener('click', () => {
        adjustCanvasSpace(-1, els);
      });
    }

    if (Array.isArray(els.gapStepButtons)) {
      els.gapStepButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
          const nextStep = normalizeCanvasStep(btn.getAttribute('data-gap-step'));
          if (nextStep === boardState.canvasStep) return;
          boardState.canvasStep = nextStep;
          markBoardHistoryDirty();
          syncInspectorGapUI(els);
          scheduleWidgetBoardPersist();
        });
      });
    }

    if (els.helpToggleBtn) {
      els.helpToggleBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        setBoardHelpOpen(!boardState.helpOpen, els);
      });
    }

    if (els.helpPopover) {
      els.helpPopover.addEventListener('click', (event) => {
        const closeButton = event.target.closest('[data-help-close]');
        if (!closeButton) return;
        event.preventDefault();
        setBoardHelpOpen(false, els);
      });
    }

    document.addEventListener('pointerdown', (event) => {
      const target = event.target;
      if (boardState.helpOpen && !els.helpToggleBtn?.contains(target) && !els.helpPopover?.contains(target)) {
        setBoardHelpOpen(false, els);
      }
      if (boardMobileState.actionsMenuOpen && !els.actionsBar?.contains(target)) {
        setBoardActionsMenuOpen(false, els);
      }
      if (boardMobileState.canvasSettingsOpen && !els.canvasSettingsPanel?.contains(target) && !els.canvasSettingsToggleBtn?.contains(target)) {
        setCanvasSettingsOpen(false, els);
      }
    }, true);

    els.canvas.addEventListener('pointerdown', (event) => {
      if (beginNodeResize(event, els)) return;
      if (beginCanvasSelection(event, els)) return;
      beginNodeDrag(event, els);
    });

    els.canvas.addEventListener('pointermove', (event) => {
      if (moveCanvasSelection(event, els)) return;
      if (moveNodeResize(event, els)) return;
      moveNodeDrag(event, els);
    });

    els.canvas.addEventListener('pointerup', (event) => {
      if (endCanvasSelection(event, els)) return;
      if (endNodeResize(event, els)) return;
      endNodeDrag(event, els);
    });

    els.canvas.addEventListener('pointercancel', (event) => {
      if (endCanvasSelection(event, els)) return;
      if (endNodeResize(event, els)) return;
      endNodeDrag(event, els);
    });

    els.canvas.addEventListener('contextmenu', (event) => {
      const nodeEl = event.target.closest('.board-node');
      if (!nodeEl) return;

      event.preventDefault();
      const nodeId = nodeEl.getAttribute('data-node-id') || '';
      if (!nodeId) return;

      setBoardSelection([nodeId], { activeId: nodeId });
      focusInspectorFromNode(nodeId, els);
    });

    els.canvas.addEventListener('click', (event) => {
      if (boardMarquee.skipClick) {
        boardMarquee.skipClick = false;
        return;
      }

      if (boardDrag.skipClick) {
        boardDrag.skipClick = false;
        return;
      }

      const isAdditiveSelection = !!(event.shiftKey || event.ctrlKey || event.metaKey);

      const emptyActionButton = event.target.closest('[data-board-empty-action]');
      if (emptyActionButton) {
        const action = emptyActionButton.getAttribute('data-board-empty-action') || '';
        if (action === 'templates') {
          renderTemplateCatalog(els);
          return;
        }
        if (action === 'decks') {
          setBoardMobileView('decks', els);
          return;
        }
      }

      const removeButton = event.target.closest('[data-node-remove]');
      if (removeButton) {
        const nodeId = removeButton.getAttribute('data-node-remove') || '';
        const selection = getSelectedBoardNodeIds();
        if (selection.length > 1 && selection.includes(nodeId)) {
          removeNodesFromBoard(selection, els);
        } else {
          removeNodeFromBoard(nodeId, els);
        }
        return;
      }

      const expandButton = event.target.closest('[data-node-expand]');
      if (expandButton) {
        const nodeId = expandButton.getAttribute('data-node-expand') || '';
        const node = getNodeById(nodeId);
        if (!node || !node.compact) return;
        boardState.activeNodeId = nodeId;
        setBoardSelection([nodeId], { activeId: nodeId });
        boardState.detailNodeId = boardState.detailNodeId === nodeId ? '' : nodeId;
        boardState.optionsNodeId = '';
        renderBoardCanvas(els);
        return;
      }

      const tuneButton = event.target.closest('[data-node-options]');
      if (tuneButton) {
        const nodeId = tuneButton.getAttribute('data-node-options') || '';
        boardState.activeNodeId = nodeId;
        setBoardSelection([nodeId], { activeId: nodeId });
        toggleNodeOptions(nodeId, els);
        return;
      }

      const chartCard = event.target.closest('[data-node-chart]');
      if (chartCard) {
        const nodeId = chartCard.getAttribute('data-node-chart') || '';
        boardState.selectedChartId = nodeId;
        boardState.activeNodeId = nodeId;

        if (isAdditiveSelection) {
          toggleBoardSelectionNode(nodeId);
        } else {
          setBoardSelection([nodeId], { activeId: nodeId });
        }

        if (boardState.detailNodeId) boardState.detailNodeId = '';
        if (boardState.optionsNodeId) boardState.optionsNodeId = '';
        renderBoardCanvas(els);
        return;
      }

      const nodeCard = event.target.closest('.board-node');
      if (nodeCard) {
        const nodeId = nodeCard.getAttribute('data-node-id') || '';
        const node = getNodeById(nodeId);
        if (!node) return;

        boardState.activeNodeId = nodeId;
        if (node.role === 'chart') boardState.selectedChartId = nodeId;

        if (isAdditiveSelection) {
          toggleBoardSelectionNode(nodeId);
        } else {
          setBoardSelection([nodeId], { activeId: nodeId });
        }

        if (boardState.detailNodeId && boardState.detailNodeId !== nodeId) boardState.detailNodeId = '';
        if (boardState.optionsNodeId && boardState.optionsNodeId !== nodeId) boardState.optionsNodeId = '';
        renderBoardCanvas(els);
        return;
      }

      if (!isAdditiveSelection) {
        setBoardSelection([], { clearActive: true });
      }

      if (boardState.detailNodeId || boardState.optionsNodeId || !isAdditiveSelection) {
        boardState.detailNodeId = '';
        boardState.optionsNodeId = '';
        renderBoardCanvas(els);
      }
    });

    els.canvas.addEventListener('dblclick', (event) => {
      const nodeCard = event.target.closest('.board-node');
      if (!nodeCard) return;
      const nodeId = nodeCard.getAttribute('data-node-id') || '';
      if (!nodeId) return;
      focusInspectorFromNode(nodeId, els);
    });

    els.canvas.addEventListener('keydown', (event) => {
      const nodeCard = event.target.closest('.board-node');
      if (!nodeCard) return;

      const nodeId = nodeCard.getAttribute('data-node-id') || '';
      if (!nodeId) return;

      const key = String(event.key || '').toLowerCase();
      if (key === 'enter' || key === ' ' || key === 'i') {
        event.preventDefault();
        focusInspectorFromNode(nodeId, els);
      }
    });

    if (els.clearBtn) {

      els.clearBtn.addEventListener('click', () => {
        setBoardActionsMenuOpen(false, els);
        resetWidgetBoard(els);
      });
    }

    document.addEventListener('keydown', (event) => {
      if (handleBoardShortcut(event, els)) return;
      if (event.key !== 'Escape') return;

      closeModal(els.modal);

      if (boardMobileState.actionsMenuOpen) {
        setBoardActionsMenuOpen(false, els);
        return;
      }

      if (boardMobileState.canvasSettingsOpen) {
        setCanvasSettingsOpen(false, els);
        return;
      }

      if (boardMobileState.inspectorSheetOpen) {
        closeBoardInspectorSheet(els, { view: 'board' });
        return;
      }

      if (boardState.helpOpen) {
        setBoardHelpOpen(false, els);
      }

      if (boardMarquee.active || boardMarquee.skipClick) {
        clearBoardMarquee(els);
        renderBoardCanvas(els);
        return;
      }

      if (getSelectedBoardNodeIds().length > 1) {
        setBoardSelection([], { clearActive: true });
        renderBoardCanvas(els);
        return;
      }

      if (boardState.detailNodeId || boardState.optionsNodeId) {
        boardState.detailNodeId = '';
        boardState.optionsNodeId = '';
        renderBoardCanvas(els);
      }
    });

    let resizeRaf = 0;
    window.addEventListener('resize', () => {
      if (resizeRaf) {
        window.cancelAnimationFrame(resizeRaf);
      }
      resizeRaf = window.requestAnimationFrame(() => {
        resizeRaf = 0;
        syncDeckRailAlignment(els.deckRail);
        syncBoardMobileUI(els);
        renderBoardCanvas(els, { skipHistory: true });
      });
    });
  }

  function initArxivBoard() {
    const els = getBoardElements();
    if (!els.arxivSection || !els.arxivCollapseToggleBtn) return;

    syncArxivBoardCollapseUI(els);
    els.arxivCollapseToggleBtn.addEventListener('click', () => {
      const collapsed = !!els.arxivSection?.classList.contains('is-collapsed');
      setArxivBoardCollapsed(!collapsed, els);
    });
  }

  function exposeScienceTestHooks() {
    if (typeof window === 'undefined' || !window.__SCIENCE_ENABLE_TEST_HOOKS__) return;

    window.__SCIENCE_TEST_HOOKS__ = {
      rebalanceSourceBlend,
      normalizeSourceBlend,
      summarizeSourceBlendValue,
      buildOutputCompactSummary,
      getOutputTopicLabel,
      getSlotTargetPosition,
      ensureNodeSize,
      setNodeCompact,
      buildChartInputDataset,
      getChartDatasetMemoKey,
      applyBoardTemplate,
      refreshLinkedDataNodes,
      __getMemoStats: () => ({ ...chartDatasetMemoStats }),
      __getMetricContextMemoStats: () => ({ ...metricContextMemoStats }),
      __getMetricContextMemoSize: () => metricContextMemo.size,
      __getMemoSize: () => chartDatasetMemo.size,
      __resetMemoForTest: () => {
        chartDatasetMemo.clear();
        chartLegendMemo.clear();
        chartPreviewMarkupMemo.clear();
        chartDatasetMemoStats.hits = 0;
        chartDatasetMemoStats.misses = 0;
      },
      __resetMetricContextMemoForTest: () => {
        metricContextMemo.clear();
        metricContextMemoStats.hits = 0;
        metricContextMemoStats.misses = 0;
      },
      __getBoardPerfCounters: () => ({ ...boardPerfCounters }),
      __resetBoardPerfCounters: () => {
        boardPerfCounters.renderBoardCanvas = 0;
        boardPerfCounters.refreshLinkedDataNodes = 0;
        boardPerfCounters.historySerialize = 0;
        boardPerfCounters.autoTitleBuilds = 0;
        boardPerfCounters.legendMapBuilds = 0;
        boardPerfCounters.traceContextBuilds = 0;
        boardPerfCounters.chartPreviewBuilds = 0;
        boardPerfCounters.slotRealigns = 0;
      },
      __setBoardNodesForTest: (nodes) => {
        boardState.nodes = Array.isArray(nodes) ? nodes : [];
      },
      __setBoardSelectionForTest: (nodeIds, options = {}) => {
        setBoardSelection(nodeIds, options);
      },
      __getBoardStateForTest: () => ({
        nodeCount: boardState.nodes.length,
        selectedChartId: boardState.selectedChartId,
        activeNodeId: boardState.activeNodeId,
        selectedNodeIds: getSelectedBoardNodeIds()
      }),
      __initBoardHistoryForTest: () => {
        initBoardHistoryState();
      },
      __getBoardHistoryForTest: () => ({
        index: boardHistory.index,
        size: boardHistory.stack.length
      }),
      __renderBoardCanvasForTest: (els, options = {}) => {
        renderBoardCanvas(els, options);
      },
      __resetBoardRenderCacheForTest: () => {
        resetBoardRenderCache();
      },
      __setHeroRangeForTest: (range) => {
        heroState.range = clampRangeMonths(range);
      },
      __setScienceCacheForTest: (payload = {}) => {
        const nextArxiv = payload.arxiv || null;
        scienceCache.arxiv = nextArxiv;
        heroState.data = nextArxiv;
        scienceCache.journalPosts = Array.isArray(payload.journalPosts) ? payload.journalPosts.slice() : [];
        scienceCache.apod = payload.apod || null;
        bumpScienceCacheRevision();
      },
      __layout: NODE_LAYOUT
    };
  }

  exposeScienceTestHooks();

  document.addEventListener('DOMContentLoaded', () => {
    bindHeroEvents();
    initWidgetBoard();
    initArxivBoard();
    loadArxiv();
    loadJournal();
    loadApod();
  });
})();





















