import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { once } from 'node:events';

const ROOT = process.cwd();
const HOST = '127.0.0.1';
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  `${process.env.LOCALAPPDATA || ''}/Google/Chrome/Application/chrome.exe`,
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  `${process.env.LOCALAPPDATA || ''}/Microsoft/Edge/Application/msedge.exe`
].filter(Boolean);

async function fileExists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function resolveChrome() {
  for (const candidate of CHROME_CANDIDATES) {
    const normalized = candidate.replaceAll('\\', '/');
    if (await fileExists(normalized)) return normalized;
  }
  return null;
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html': return 'text/html; charset=utf-8';
    case '.css': return 'text/css; charset=utf-8';
    case '.js': return 'application/javascript; charset=utf-8';
    case '.json': return 'application/json; charset=utf-8';
    case '.svg': return 'image/svg+xml';
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.gif': return 'image/gif';
    case '.webp': return 'image/webp';
    case '.ico': return 'image/x-icon';
    default: return 'application/octet-stream';
  }
}

async function startStaticServer() {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://${HOST}`);
      let filePath = decodeURIComponent(url.pathname);
      if (filePath === '/') filePath = '/index.html';
      const resolved = path.resolve(ROOT, `.${filePath}`);
      if (!resolved.startsWith(ROOT)) {
        res.writeHead(403).end('Forbidden');
        return;
      }
      const data = await fs.readFile(resolved);
      res.writeHead(200, { 'Content-Type': contentType(resolved) });
      res.end(data);
    } catch {
      res.writeHead(404).end('Not found');
    }
  });

  server.listen(0, HOST);
  await once(server, 'listening');
  const address = server.address();
  return {
    server,
    origin: `http://${HOST}:${address.port}`
  };
}

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function getAvailablePort() {
  const server = http.createServer();
  server.listen(0, HOST);
  await once(server, 'listening');
  const address = server.address();
  await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  return address.port;
}

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(fn, { timeout = 10000, interval = 100 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const value = await fn();
    if (value) return value;
    await delay(interval);
  }
  throw new Error('Timed out waiting for condition');
}

async function launchChrome(executablePath) {
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bcc-science-chrome-'));
  const debugPort = await getAvailablePort();

  const args = [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    'about:blank'
  ];

  const proc = spawn(executablePath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  const exitPromise = once(proc, 'exit').catch(() => null);
  let stderr = '';
  proc.stderr.on('data', (chunk) => { stderr += String(chunk); });

  const target = await waitFor(async () => {
    try {
      const list = await getJson(`http://${HOST}:${debugPort}/json/list`);
      return list.find((entry) => entry.type === 'page' && entry.webSocketDebuggerUrl) || null;
    } catch {
      return null;
    }
  }, { timeout: 15000, interval: 200 });

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await once(ws, 'open');

  let nextId = 1;
  const pending = new Map();
  const events = new Map();

  ws.addEventListener('message', (event) => {
    const payload = JSON.parse(String(event.data));
    if (payload.id) {
      const handlers = pending.get(payload.id);
      if (!handlers) return;
      pending.delete(payload.id);
      if (payload.error) handlers.reject(new Error(payload.error.message));
      else handlers.resolve(payload.result);
      return;
    }

    const listeners = events.get(payload.method) || [];
    listeners.forEach((listener) => listener(payload.params || {}));
  });

  function send(method, params = {}) {
    const id = nextId++;
    const message = { id, method, params };
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify(message));
    });
  }

  function on(method, listener) {
    const list = events.get(method) || [];
    list.push(listener);
    events.set(method, list);
    return () => {
      const current = events.get(method) || [];
      events.set(method, current.filter((entry) => entry !== listener));
    };
  }

  async function close() {
    try { ws.close(); } catch {}
    const exited = await Promise.race([exitPromise, delay(2000)]);
    if (!exited && !proc.killed) {
      try { proc.kill(); } catch {}
      await Promise.race([exitPromise, delay(2000)]);
    }
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        await fs.rm(userDataDir, { recursive: true, force: true });
        break;
      } catch {
        await delay(200);
      }
    }
    if (stderr.trim()) {
      // available for debugging if needed
    }
  }

  return { send, on, close, stderr: () => stderr };
}

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  return result.result ? result.result.value : undefined;
}

async function click(cdp, selector) {
  return evaluate(cdp, `(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) throw new Error('Missing selector: ' + ${JSON.stringify(selector)});
    el.click();
    return true;
  })()`);
}

test('science smartboard mobile smoke test covers mobile workflow in ES/EN', async (t) => {
  const chrome = await resolveChrome();
  if (!chrome) {
    t.skip('Chrome/Edge not available on this machine');
    return;
  }

  const { server, origin } = await startStaticServer();
  const cdp = await launchChrome(chrome);
  const exceptions = [];
  const logs = [];

  try {
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');

    cdp.on('Runtime.exceptionThrown', (params) => exceptions.push(params));
    cdp.on('Log.entryAdded', (params) => logs.push(params.entry));

    async function openAndCheck({ pathname, expected }) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: 390,
        height: 844,
        deviceScaleFactor: 1,
        mobile: true
      });

      const loaded = new Promise((resolve) => {
        const off = cdp.on('Page.loadEventFired', () => {
          off();
          resolve();
        });
      });

      await cdp.send('Page.navigate', { url: `${origin}${pathname}` });
      await loaded;

      await waitFor(async () => evaluate(cdp, `!!document.getElementById('widgetboard-collapse-toggle')`));
      await click(cdp, '#widgetboard-collapse-toggle');
      await waitFor(async () => evaluate(cdp, `!document.getElementById('widget-board')?.classList.contains('is-collapsed')`));

      const initial = await evaluate(cdp, `(() => {
        const body = document.getElementById('widgetboard-body');
        const nav = document.getElementById('widget-mobile-nav');
        const tabs = Array.from(document.querySelectorAll('#widget-mobile-nav [data-mobile-view]')).map((el) => el.textContent.trim());
        const overflow = document.documentElement.scrollWidth - window.innerWidth;
        return {
          view: body?.dataset.mobileView || '',
          navHidden: nav ? nav.hidden : null,
          tabs,
          templatesLabel: document.getElementById('widget-templates')?.textContent?.trim() || '',
          moreLabel: document.getElementById('widget-actions-toggle')?.textContent?.trim() || '',
          overflow
        };
      })()`);

      assert.equal(initial.view, 'decks');
      assert.equal(initial.navHidden, false);
      assert.deepEqual(initial.tabs, expected.tabs);
      assert.equal(initial.templatesLabel, expected.templatesLabel);
      assert.equal(initial.moreLabel, expected.moreLabel);
      assert.ok(initial.overflow <= 1, `Unexpected horizontal overflow on initial mobile state for ${pathname}: ${initial.overflow}`);

      await click(cdp, '#widget-mobile-nav [data-mobile-view="board"]');
      await waitFor(async () => evaluate(cdp, `document.getElementById('widgetboard-body')?.dataset.mobileView === 'board'`));

      const boardState = await evaluate(cdp, `(() => {
        const canvasShell = document.getElementById('widget-canvas-shell');
        const deckWrap = document.querySelector('.deck-rail-wrap');
        return {
          canvasVisible: canvasShell ? getComputedStyle(canvasShell).display !== 'none' : false,
          decksHidden: deckWrap ? getComputedStyle(deckWrap).display === 'none' : false,
          emptyTemplatesVisible: !!document.querySelector('#widget-canvas [data-board-empty-action="templates"]'),
          touchModeHidden: document.getElementById('widget-touch-mode')?.hidden,
          settingsHidden: document.getElementById('widget-canvas-settings-toggle')?.hidden
        };
      })()`);

      assert.equal(boardState.canvasVisible, true);
      assert.equal(boardState.decksHidden, true);
      assert.equal(boardState.emptyTemplatesVisible, true);
      assert.equal(boardState.touchModeHidden, false);
      assert.equal(boardState.settingsHidden, false);

      await click(cdp, '#widget-canvas-settings-toggle');
      await waitFor(async () => evaluate(cdp, `document.getElementById('widget-board')?.classList.contains('is-mobile-settings-open')`));
      const settingsOpen = await evaluate(cdp, `(() => ({
        expanded: document.getElementById('widget-canvas-settings-toggle')?.getAttribute('aria-expanded'),
        panelHidden: document.getElementById('widget-canvas-settings-panel')?.getAttribute('aria-hidden')
      }))()`);
      assert.equal(settingsOpen.expanded, 'true');
      assert.equal(settingsOpen.panelHidden, 'false');

      await click(cdp, '#widget-canvas-settings-toggle');
      await waitFor(async () => evaluate(cdp, `!document.getElementById('widget-board')?.classList.contains('is-mobile-settings-open')`));

      await click(cdp, '#widget-actions-toggle');
      await waitFor(async () => evaluate(cdp, `document.getElementById('widget-actions-overflow')?.getAttribute('aria-hidden') === 'false'`));
      const overflowMenu = await evaluate(cdp, `(() => ({
        expanded: document.getElementById('widget-actions-toggle')?.getAttribute('aria-expanded'),
        items: Array.from(document.querySelectorAll('#widget-actions-overflow .widget-action')).map((el) => el.textContent.trim())
      }))()`);
      assert.equal(overflowMenu.expanded, 'true');
      assert.equal(overflowMenu.items.length, 3);

      await click(cdp, '#widget-actions-toggle');
      await waitFor(async () => evaluate(cdp, `document.getElementById('widget-actions-overflow')?.getAttribute('aria-hidden') === 'true'`));

      await click(cdp, '#widget-canvas [data-board-empty-action="templates"]');
      await waitFor(async () => evaluate(cdp, `document.getElementById('widget-modal') && !document.getElementById('widget-modal').hidden && !!document.querySelector('[data-apply-template]')`), { timeout: 15000 });

      const modalMetrics = await evaluate(cdp, `(() => {
        const dialog = document.querySelector('#widget-modal .widget-modal-dialog');
        if (!dialog) return null;
        const rect = dialog.getBoundingClientRect();
        return {
          height: rect.height,
          top: rect.top,
          viewport: window.innerHeight
        };
      })()`);
      assert.ok(modalMetrics && modalMetrics.height > modalMetrics.viewport * 0.75, `Expected mobile modal to use most of viewport height for ${pathname}`);

      await click(cdp, '[data-apply-template]');
      await waitFor(async () => evaluate(cdp, `(() => {
        const modal = document.getElementById('widget-modal');
        const nodeCount = document.querySelectorAll('#widget-canvas .board-node').length;
        const selectionBar = document.getElementById('widget-mobile-selection-bar');
        return !!modal && modal.hidden && nodeCount > 0 && selectionBar && !selectionBar.hidden;
      })()`), { timeout: 20000, interval: 150 });

      const afterTemplate = await evaluate(cdp, `(() => ({
        nodeCount: document.querySelectorAll('#widget-canvas .board-node').length,
        selectedCount: document.querySelectorAll('#widget-canvas .board-node.is-active, #widget-canvas .board-node.is-selected, #widget-canvas .board-node.is-multi-selected').length,
        selectionSummary: document.getElementById('widget-mobile-selection-summary')?.textContent?.trim() || '',
        inspectLabel: document.querySelector('[data-mobile-selection-action="inspect"]')?.textContent?.trim() || '',
        activeView: document.getElementById('widgetboard-body')?.dataset.mobileView || '',
        overflow: document.documentElement.scrollWidth - window.innerWidth
      }))()`);

      assert.ok(afterTemplate.nodeCount >= 4, `Expected template to render multiple nodes for ${pathname}`);
      assert.ok(afterTemplate.selectionSummary.length > 0);
      assert.equal(afterTemplate.inspectLabel, expected.inspectLabel);
      assert.equal(afterTemplate.activeView, 'board');
      assert.ok(afterTemplate.overflow <= 1, `Unexpected horizontal overflow after template import for ${pathname}: ${afterTemplate.overflow}`);

      await click(cdp, '[data-mobile-selection-action="inspect"]');
      await waitFor(async () => evaluate(cdp, `document.getElementById('widget-board')?.classList.contains('is-mobile-inspector-open')`), { timeout: 10000 });

      const inspectorState = await evaluate(cdp, `(() => ({
        backdropHidden: document.getElementById('widget-inspector-backdrop')?.hidden,
        closeExists: !!document.querySelector('[data-mobile-inspector-close]'),
        activeView: document.getElementById('widgetboard-body')?.dataset.mobileView || ''
      }))()`);
      assert.equal(inspectorState.backdropHidden, false);
      assert.equal(inspectorState.closeExists, true);
      assert.equal(inspectorState.activeView, 'inspector');

      await click(cdp, '[data-mobile-inspector-close]');
      await waitFor(async () => evaluate(cdp, `!document.getElementById('widget-board')?.classList.contains('is-mobile-inspector-open') && document.getElementById('widgetboard-body')?.dataset.mobileView === 'board'`));

      await click(cdp, '#widget-touch-mode [data-touch-mode="move"]');
      await waitFor(async () => evaluate(cdp, `document.getElementById('widget-board')?.classList.contains('is-touch-mode-move')`));

      const touchModeState = await evaluate(cdp, `(() => ({
        movePressed: document.querySelector('#widget-touch-mode [data-touch-mode="move"]')?.getAttribute('aria-pressed'),
        selectPressed: document.querySelector('#widget-touch-mode [data-touch-mode="select"]')?.getAttribute('aria-pressed'),
        overflow: document.documentElement.scrollWidth - window.innerWidth
      }))()`);
      assert.equal(touchModeState.movePressed, 'true');
      assert.equal(touchModeState.selectPressed, 'false');
      assert.ok(touchModeState.overflow <= 1, `Unexpected horizontal overflow at end of flow for ${pathname}: ${touchModeState.overflow}`);
    }

    await openAndCheck({
      pathname: '/science.html',
      expected: {
        tabs: ['Tarjeteros', 'Pizarra', 'Inspector'],
        templatesLabel: 'Plantillas',
        moreLabel: 'Mas',
        inspectLabel: 'Editar'
      }
    });

    await openAndCheck({
      pathname: '/en/science.html',
      expected: {
        tabs: ['Decks', 'Board', 'Inspector'],
        templatesLabel: 'Templates',
        moreLabel: 'More',
        inspectLabel: 'Edit'
      }
    });

    assert.equal(exceptions.length, 0, `Unexpected runtime exceptions: ${JSON.stringify(exceptions, null, 2)}`);

    const severeLogs = logs.filter((entry) => ['error', 'assert'].includes(String(entry.level || '').toLowerCase()));
    assert.equal(severeLogs.length, 0, `Unexpected browser error logs: ${JSON.stringify(severeLogs, null, 2)}`);
  } finally {
    await cdp.close();
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});
