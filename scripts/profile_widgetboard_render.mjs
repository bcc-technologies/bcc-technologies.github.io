import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { performance } from 'node:perf_hooks';

function loadScienceHooks(lang = 'es') {
  const scriptPath = path.resolve(process.cwd(), 'js/science.js');
  const code = fs.readFileSync(scriptPath, 'utf8');

  const noop = () => {};
  const documentStub = {
    documentElement: { lang },
    body: { appendChild: noop },
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => ({
      style: {},
      className: '',
      appendChild: noop,
      replaceChildren: noop,
      setAttribute: noop,
      querySelector: () => null,
      querySelectorAll: () => [],
      remove: noop
    }),
    addEventListener: noop
  };

  const windowStub = {
    __SCIENCE_ENABLE_TEST_HOOKS__: true,
    location: { href: 'https://example.com/science.html' },
    addEventListener: noop,
    setTimeout,
    clearTimeout,
    requestAnimationFrame: (cb) => setTimeout(() => cb(performance.now()), 0),
    cancelAnimationFrame: (id) => clearTimeout(id)
  };

  const context = {
    window: windowStub,
    document: documentStub,
    console,
    fetch: async () => ({ ok: false, status: 500, json: async () => ({}) }),
    URL,
    Intl,
    Date,
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
  vm.runInContext(code, context, { filename: 'science.js' });

  const hooks = context.window.__SCIENCE_TEST_HOOKS__;
  if (!hooks) {
    throw new Error('Expected __SCIENCE_TEST_HOOKS__ to be available');
  }
  return hooks;
}

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
  return sorted[idx];
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function buildMockCanvas(width, height) {
  const state = {
    nodeOrder: [],
    groupLabelsMarkup: '',
    innerHTML: ''
  };

  const extractNodeIds = (html) => {
    const ids = [];
    const pattern = /data-node-id="([^"]+)"/g;
    let match = pattern.exec(html);
    while (match) {
      ids.push(match[1]);
      match = pattern.exec(html);
    }
    return ids;
  };

  const canvas = {
    clientWidth: width,
    clientHeight: height,
    style: {},
    set innerHTML(value) {
      const html = String(value || '');
      state.innerHTML = html;
      state.nodeOrder = extractNodeIds(html);
      state.groupLabelsMarkup = html.includes('board-group-label') ? html : '';
    },
    get innerHTML() {
      return state.innerHTML;
    },
    querySelectorAll(selector) {
      if (selector === '.board-node') {
        return state.nodeOrder.map((id) => ({
          getAttribute: (attr) => (attr === 'data-node-id' ? id : null),
          set outerHTML(markup) {
            state.innerHTML = String(markup || state.innerHTML);
          }
        }));
      }

      if (selector === '.board-group-label') {
        if (!state.groupLabelsMarkup) return [];
        return [{ remove: () => { state.groupLabelsMarkup = ''; } }];
      }

      return [];
    },
    insertAdjacentHTML(_position, html) {
      state.groupLabelsMarkup += String(html || '');
      state.innerHTML += String(html || '');
    }
  };

  return canvas;
}

function buildMockElements(width = 1400, height = 860) {
  return {
    canvas: buildMockCanvas(width, height),
    canvasMeta: { textContent: '' },
    inspector: null,
    helpPopover: null,
    exportPngBtn: null,
    exportCsvBtn: null,
    shareUrlBtn: null,
    clearBtn: null
  };
}

function buildSyntheticCache() {
  const months = [
    '2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02'
  ];

  const buildSeries = (base, step) => {
    const output = {};
    months.forEach((month, idx) => {
      output[month] = base + step * idx;
    });
    return output;
  };

  return {
    arxiv: {
      months,
      series: {
        physics: buildSeries(140, 7),
        math: buildSeries(120, 6),
        cs: buildSeries(190, 12),
        'q-bio': buildSeries(95, 5)
      },
      items: []
    },
    journalPosts: [
      { title: 'Signal A', date: '2026-01-20' },
      { title: 'Signal B', date: '2026-02-10' }
    ],
    apod: {
      date: '2026-02-26',
      title: 'Solar Wind',
      explanation: 'Particle flux with mixed intensity over heliosphere lanes.'
    }
  };
}

function buildSyntheticNodes({ chartCount = 4, rowsGap = 280 } = {}) {
  const chartKinds = ['line-chart', 'radar-chart', 'heatmap-chart', 'line-chart'];
  const dataMetrics = ['group:cs', 'group:math', 'group:physics', 'group:q-bio'];
  const nodes = [];
  let seq = 1;

  const nextId = () => `bench-${seq++}`;

  for (let chartIndex = 0; chartIndex < chartCount; chartIndex += 1) {
    const chartId = nextId();
    const chartY = 120 + chartIndex * rowsGap;
    const chartX = 460 + (chartIndex % 2) * 380;
    const chart = {
      uid: chartId,
      role: 'chart',
      cardId: chartKinds[chartIndex % chartKinds.length],
      title: `Benchmark Chart ${chartIndex + 1}`,
      value: 'Synthetic benchmark',
      note: 'Benchmark card',
      x: chartX,
      y: chartY,
      w: 360,
      h: 272,
      links: { top: [], left: [], right: [], bottom: [] },
      settings: {}
    };

    nodes.push(chart);

    dataMetrics.forEach((metric, metricIdx) => {
      const dataId = nextId();
      chart.links.left.push(dataId);
      nodes.push({
        uid: dataId,
        role: 'data',
        cardId: 'total-papers',
        title: `Publicaciones ${metric}`,
        value: `Serie ${metric}`,
        note: 'Synthetic input',
        x: chartX - 238,
        y: chartY + 14 + metricIdx * 56,
        w: 176,
        h: 40,
        compact: true,
        attachedTo: chartId,
        settings: { metric, transform: 'raw', aggregate: 'sum' }
      });
    });

    const periodId = nextId();
    chart.links.top.push(periodId);
    nodes.push({
      uid: periodId,
      role: 'control',
      cardId: 'period-control',
      title: 'Periodo',
      value: '6 meses',
      note: 'Synthetic control',
      x: chartX,
      y: chartY - 60,
      w: 146,
      h: 40,
      compact: true,
      attachedTo: chartId,
      settings: { rangeMonths: 6 }
    });

    const sourceId = nextId();
    chart.links.top.push(sourceId);
    nodes.push({
      uid: sourceId,
      role: 'control',
      cardId: 'source-control',
      title: 'Fuentes',
      value: 'ArXiv 80 / Journal 15 / NASA 5',
      note: 'Synthetic source mix',
      x: chartX + 156,
      y: chartY - 60,
      w: 146,
      h: 40,
      compact: true,
      attachedTo: chartId,
      settings: { sourceBlend: { arxiv: 80, journal: 15, nasa: 5 } }
    });

    const styleId = nextId();
    chart.links.bottom.push(styleId);
    nodes.push({
      uid: styleId,
      role: 'style',
      cardId: 'style-3d',
      title: 'Tridimensionalidad',
      value: 'Relieve 62 / Suavidad 70',
      note: 'Synthetic style',
      x: chartX,
      y: chartY + 286,
      w: 146,
      h: 40,
      compact: true,
      attachedTo: chartId,
      settings: { style3d: { relief: 62, softness: 70 } }
    });

    const outputId = nextId();
    chart.links.right.push(outputId);
    nodes.push({
      uid: outputId,
      role: 'output',
      cardId: 'context-output',
      title: 'Lider',
      value: 'CS 41%',
      note: 'Synthetic output',
      x: chartX + 380,
      y: chartY + 62,
      w: 176,
      h: 40,
      compact: true,
      attachedTo: chartId,
      settings: {}
    });
  }

  return nodes;
}

function runBenchmark() {
  const hooks = loadScienceHooks('es');

  hooks.__setScienceCacheForTest(buildSyntheticCache());
  hooks.__resetMemoForTest();
  hooks.__resetBoardRenderCacheForTest();

  const nodes = buildSyntheticNodes({ chartCount: 4 });
  hooks.__setBoardNodesForTest(nodes);

  const els = buildMockElements(1540, 980);
  const iterations = 160;

  const coldSamples = [];
  for (let i = 0; i < 35; i += 1) {
    hooks.__resetBoardRenderCacheForTest();
    const t0 = performance.now();
    hooks.__renderBoardCanvasForTest(els, { skipHistory: true });
    coldSamples.push(performance.now() - t0);
  }

  hooks.__resetBoardRenderCacheForTest();
  hooks.__renderBoardCanvasForTest(els, { skipHistory: true });

  const warmSamples = [];
  for (let i = 0; i < iterations; i += 1) {
    const t0 = performance.now();
    hooks.__renderBoardCanvasForTest(els, { skipHistory: true });
    warmSamples.push(performance.now() - t0);
  }

  const memoStats = hooks.__getMemoStats();

  const payload = {
    scenario: 'widgetboard-render',
    nodes: nodes.length,
    charts: nodes.filter((node) => node.role === 'chart').length,
    iterations,
    cold: {
      meanMs: round(mean(coldSamples)),
      p95Ms: round(percentile(coldSamples, 95)),
      maxMs: round(Math.max(...coldSamples))
    },
    warm: {
      meanMs: round(mean(warmSamples)),
      p95Ms: round(percentile(warmSamples, 95)),
      maxMs: round(Math.max(...warmSamples))
    },
    memo: memoStats
  };

  return payload;
}

const result = runBenchmark();
console.log(JSON.stringify(result, null, 2));
