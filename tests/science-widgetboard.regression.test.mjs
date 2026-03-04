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

  hooks.__setScienceCacheForTest({
    arxiv: {
      months: ['2025-10', '2025-11', '2025-12'],
      series: {
        physics: { '2025-10': 14, '2025-11': 16, '2025-12': 18 },
        math: { '2025-10': 12, '2025-11': 13, '2025-12': 15 },
        cs: { '2025-10': 20, '2025-11': 23, '2025-12': 28 }
      },
      items: []
    },
    journalPosts: [],
    apod: { date: '2025-12-15', title: 'Aurora', explanation: 'Aurora over polar skies.' }
  });

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
