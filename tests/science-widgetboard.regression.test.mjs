import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

function loadScienceHooks(lang = 'es') {
  const scriptPath = path.resolve(process.cwd(), 'js/science.js');
  const code = fs.readFileSync(scriptPath, 'utf8');

  const noop = () => {};
  const documentStub = {
    documentElement: { lang },
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => ({
      style: {},
      className: '',
      appendChild: noop,
      replaceChildren: noop,
      setAttribute: noop,
      querySelector: () => null
    }),
    addEventListener: noop
  };

  const windowStub = {
    __SCIENCE_ENABLE_TEST_HOOKS__: true,
    location: { href: 'https://example.com/science.html' },
    addEventListener: noop,
    setTimeout,
    clearTimeout
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
  assert.ok(hooks, 'Expected test hooks to be exposed');
  return hooks;
}

function seedScienceCache(hooks) {
  hooks.__setScienceCacheForTest({
    arxiv: {
      months: ['2025-10', '2025-11', '2025-12'],
      series: {
        physics: { '2025-10': 14, '2025-11': 16, '2025-12': 18 },
        math: { '2025-10': 12, '2025-11': 13, '2025-12': 15 },
        cs: { '2025-10': 20, '2025-11': 23, '2025-12': 28 },
        'q-bio': { '2025-10': 6, '2025-11': 7, '2025-12': 9 }
      },
      items: []
    },
    journalPosts: [],
    apod: { date: '2025-12-15', title: 'Aurora', explanation: 'Aurora over polar skies.' }
  });
}

function createClassListStub() {
  const names = new Set();
  return {
    add: (...tokens) => tokens.forEach((token) => names.add(token)),
    remove: (...tokens) => tokens.forEach((token) => names.delete(token)),
    contains: (token) => names.has(token),
    toggle: (token, force) => {
      const next = force === undefined ? !names.has(token) : !!force;
      if (next) {
        names.add(token);
      } else {
        names.delete(token);
      }
      return next;
    }
  };
}

function createBoardElsStub() {
  return {
    canvas: {
      clientWidth: 1400,
      clientHeight: 900,
      innerHTML: '',
      style: {},
      querySelectorAll: () => [],
      querySelector: () => null,
      insertAdjacentHTML: () => {}
    },
    canvasMeta: { textContent: '' },
    modal: {
      hidden: false,
      classList: createClassListStub(),
      setAttribute(name, value) {
        this[name] = value;
      },
      removeAttribute(name) {
        delete this[name];
      }
    },
    inspector: null
  };
}

test('source blend rebalances while preserving 100%', () => {
  const hooks = loadScienceHooks('en');
  const next = hooks.rebalanceSourceBlend({ arxiv: 60, journal: 30, nasa: 10 }, 'journal', 50);

  assert.equal(next.journal, 50);
  assert.equal(next.arxiv + next.journal + next.nasa, 100);
  assert.equal(next.arxiv, 43);
  assert.equal(next.nasa, 7);
});

test('top control slot keeps three compact controls on one lane', () => {
  const hooks = loadScienceHooks('es');
  const chart = {
    uid: 'chart-1',
    role: 'chart',
    x: 220,
    y: 260,
    w: 320,
    h: 240,
    links: { top: ['c1', 'c2', 'c3'], left: [], right: [], bottom: [] }
  };

  const controls = ['c1', 'c2', 'c3'].map((uid) => ({
    uid,
    role: 'control',
    cardId: 'period-control',
    compact: true,
    attachedTo: chart.uid,
    x: 0,
    y: 0,
    w: 146,
    h: 40,
    settings: { rangeMonths: 6 }
  }));

  hooks.__setBoardNodesForTest([chart, ...controls]);
  controls.forEach((node) => hooks.setNodeCompact(node, true));

  const canvas = { clientWidth: 1400, clientHeight: 900 };
  const p1 = hooks.getSlotTargetPosition(chart, 'top', controls[0], 0, canvas);
  const p2 = hooks.getSlotTargetPosition(chart, 'top', controls[1], 1, canvas);
  const p3 = hooks.getSlotTargetPosition(chart, 'top', controls[2], 2, canvas);

  assert.equal(p1.y, p2.y);
  assert.equal(p2.y, p3.y);
  assert.ok(p1.x < p2.x && p2.x < p3.x, 'Controls should stay in a single horizontal row');
});

test('chart dataset memo hits on repeated build with same inputs', () => {
  const hooks = loadScienceHooks('en');

  seedScienceCache(hooks);

  const chart = {
    uid: 'chart-memo',
    role: 'chart',
    x: 200,
    y: 220,
    w: 320,
    h: 220,
    links: {
      left: ['data-1'],
      right: [],
      top: ['period-1', 'source-1'],
      bottom: []
    }
  };

  const dataNode = {
    uid: 'data-1',
    role: 'data',
    cardId: 'total-papers',
    settings: { metric: 'group:cs', transform: 'raw', aggregate: 'sum' },
    x: 0,
    y: 0,
    w: 216,
    h: 122
  };

  const periodNode = {
    uid: 'period-1',
    role: 'control',
    cardId: 'period-control',
    settings: { rangeMonths: 6 },
    value: '6 months',
    x: 0,
    y: 0,
    w: 146,
    h: 40,
    compact: true
  };

  const sourceNode = {
    uid: 'source-1',
    role: 'control',
    cardId: 'source-control',
    settings: { sourceBlend: { arxiv: 70, journal: 20, nasa: 10 } },
    value: 'ArXiv 70% / Journal 20% / NASA 10%',
    x: 0,
    y: 0,
    w: 146,
    h: 40,
    compact: true
  };

  hooks.__setBoardNodesForTest([chart, dataNode, periodNode, sourceNode]);
  hooks.__resetMemoForTest();

  const first = hooks.buildChartInputDataset(chart);
  const second = hooks.buildChartInputDataset(chart);
  const stats = hooks.__getMemoStats();

  assert.ok(first && second);
  assert.strictEqual(first, second, 'Second dataset build should return memoized reference');
  assert.equal(stats.misses, 1);
  assert.equal(stats.hits, 1);
  assert.equal(hooks.__getMemoSize(), 1);
});



test('refreshLinkedDataNodes reuses one metric context across linked data cards', () => {
  const hooks = loadScienceHooks('en');

  seedScienceCache(hooks);

  const chart = {
    uid: 'chart-refresh',
    role: 'chart',
    x: 200,
    y: 220,
    w: 320,
    h: 220,
    links: {
      top: ['period-1', 'source-1'],
      left: ['data-1', 'data-2', 'data-3'],
      right: [],
      bottom: []
    }
  };

  const periodNode = {
    uid: 'period-1',
    role: 'control',
    cardId: 'period-control',
    settings: { rangeMonths: 6 },
    value: '',
    note: '',
    x: 0,
    y: 0,
    w: 146,
    h: 40,
    compact: true,
    attachedTo: chart.uid
  };

  const sourceNode = {
    uid: 'source-1',
    role: 'control',
    cardId: 'source-control',
    settings: { sourceBlend: { arxiv: 72, journal: 18, nasa: 10 } },
    value: '',
    note: '',
    x: 0,
    y: 0,
    w: 146,
    h: 40,
    compact: true,
    attachedTo: chart.uid
  };

  const dataNodes = [
    { uid: 'data-1', metric: 'group:cs' },
    { uid: 'data-2', metric: 'group:math' },
    { uid: 'data-3', metric: 'keyword-top' }
  ].map((entry, index) => ({
    uid: entry.uid,
    role: 'data',
    cardId: 'total-papers',
    settings: { metric: entry.metric, transform: 'raw', aggregate: 'sum' },
    value: '',
    title: '',
    x: 0,
    y: index * 40,
    w: 216,
    h: 122,
    attachedTo: chart.uid
  }));

  hooks.__setBoardNodesForTest([chart, periodNode, sourceNode, ...dataNodes]);
  hooks.__resetMetricContextMemoForTest();
  hooks.__resetMemoForTest();

  const changed = hooks.refreshLinkedDataNodes(chart);
  const contextStats = hooks.__getMetricContextMemoStats();
  const chartMemoStats = hooks.__getMemoStats();

  assert.equal(changed, true);
  assert.equal(contextStats.misses, 1);
  assert.equal(contextStats.hits, 1);
  assert.equal(hooks.__getMetricContextMemoSize(), 1);
  assert.equal(chartMemoStats.misses, 1);
  assert.equal(chartMemoStats.hits, 0);
  dataNodes.forEach((node) => {
    assert.notEqual(String(node.value || ''), '');
    assert.notEqual(String(node.title || ''), '');
  });
});



test('repeated render reuses cached chart metadata work', () => {
  const hooks = loadScienceHooks('en');
  const els = createBoardElsStub();

  seedScienceCache(hooks);

  const chart = {
    uid: 'chart-meta',
    deckId: 'arxiv-core',
    cardId: 'line-chart',
    role: 'chart',
    title: 'Line chart',
    value: '',
    note: '',
    x: 220,
    y: 240,
    w: 320,
    h: 220,
    links: { top: [], left: ['data-1', 'data-2'], right: [], bottom: [] }
  };

  const dataNodes = [
    { uid: 'data-1', metric: 'group:cs' },
    { uid: 'data-2', metric: 'group:math' }
  ].map((entry, index) => ({
    uid: entry.uid,
    deckId: 'arxiv-core',
    cardId: 'total-papers',
    role: 'data',
    title: '',
    value: '',
    note: '',
    attachedTo: chart.uid,
    compact: true,
    expanded: false,
    resized: false,
    locked: false,
    x: 32 + index * 120,
    y: 96,
    w: 126,
    h: 34,
    settings: { metric: entry.metric, transform: 'raw', aggregate: 'sum' }
  }));

  hooks.__setBoardNodesForTest([chart, ...dataNodes]);
  hooks.__resetBoardPerfCounters();

  hooks.__renderBoardCanvasForTest(els, { skipHistory: true });
  const first = hooks.__getBoardPerfCounters();

  hooks.__renderBoardCanvasForTest(els, { skipHistory: true });
  const second = hooks.__getBoardPerfCounters();

  assert.equal(first.autoTitleBuilds, 1);
  assert.equal(first.legendMapBuilds, 1);
  assert.equal(first.traceContextBuilds, 1);
  assert.equal(first.chartPreviewBuilds, 1);
  assert.equal(first.slotRealigns, 1);
  assert.equal(second.autoTitleBuilds, first.autoTitleBuilds);
  assert.equal(second.legendMapBuilds, first.legendMapBuilds);
  assert.equal(second.traceContextBuilds, first.traceContextBuilds);
  assert.equal(second.chartPreviewBuilds, first.chartPreviewBuilds);
  assert.equal(second.slotRealigns, first.slotRealigns);
});

test('chart layout changes invalidate render caches once', () => {
  const hooks = loadScienceHooks('en');
  const els = createBoardElsStub();

  seedScienceCache(hooks);

  const chart = {
    uid: 'chart-layout',
    deckId: 'arxiv-core',
    cardId: 'line-chart',
    role: 'chart',
    title: 'Line chart',
    value: '',
    note: '',
    x: 220,
    y: 240,
    w: 320,
    h: 210,
    links: { top: [], left: ['data-1', 'data-2'], right: [], bottom: [] }
  };

  const dataNodes = [
    { uid: 'data-1', metric: 'group:cs' },
    { uid: 'data-2', metric: 'group:math' }
  ].map((entry, index) => ({
    uid: entry.uid,
    deckId: 'arxiv-core',
    cardId: 'total-papers',
    role: 'data',
    title: '',
    value: '',
    note: '',
    attachedTo: chart.uid,
    compact: true,
    expanded: false,
    resized: false,
    locked: false,
    x: 32 + index * 120,
    y: 96,
    w: 126,
    h: 34,
    settings: { metric: entry.metric, transform: 'raw', aggregate: 'sum' }
  }));

  hooks.__setBoardNodesForTest([chart, ...dataNodes]);
  hooks.__resetBoardPerfCounters();

  hooks.__renderBoardCanvasForTest(els, { skipHistory: true });
  chart.w = 340;
  hooks.__renderBoardCanvasForTest(els, { skipHistory: true });

  const counters = hooks.__getBoardPerfCounters();

  assert.equal(counters.chartPreviewBuilds, 2);
  assert.equal(counters.slotRealigns, 2);
});

test('selection-only render does not serialize a new history snapshot', () => {
  const hooks = loadScienceHooks('es');
  const els = createBoardElsStub();

  seedScienceCache(hooks);
  assert.equal(hooks.applyBoardTemplate('tpl-arxiv-pulse', els, { mode: 'append' }), true);

  hooks.__initBoardHistoryForTest();
  hooks.__resetBoardPerfCounters();

  hooks.__setBoardSelectionForTest([], { clearActive: true });
  hooks.__renderBoardCanvasForTest(els);

  const counters = hooks.__getBoardPerfCounters();
  const history = hooks.__getBoardHistoryForTest();

  assert.equal(counters.historySerialize, 0);
  assert.equal(history.size, 1);
  assert.equal(history.index, 0);
});

test('template replace batches refresh and keeps history to a single new state', () => {
  const hooks = loadScienceHooks('es');
  const els = createBoardElsStub();

  seedScienceCache(hooks);
  assert.equal(hooks.applyBoardTemplate('tpl-arxiv-pulse', els, { mode: 'append' }), true);

  hooks.__initBoardHistoryForTest();
  hooks.__resetBoardPerfCounters();

  assert.equal(hooks.applyBoardTemplate('tpl-radar-areas', els, { mode: 'replace' }), true);

  const counters = hooks.__getBoardPerfCounters();
  const history = hooks.__getBoardHistoryForTest();
  const board = hooks.__getBoardStateForTest();

  assert.equal(counters.renderBoardCanvas, 1);
  assert.equal(counters.refreshLinkedDataNodes, 1);
  assert.equal(history.size, 2);
  assert.equal(history.index, 1);
  assert.equal(board.nodeCount, 12);
  assert.equal(board.selectedNodeIds.length, 1);
  assert.equal(board.activeNodeId, board.selectedChartId);
  assert.equal(els.modal.hidden, true);
});
