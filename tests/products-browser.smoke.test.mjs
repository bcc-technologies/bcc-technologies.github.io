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
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bcc-products-chrome-'));
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
      // keep stderr available for debugging without failing normal runs
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

test('products browser smoke test covers ES/EN desktop/mobile', async (t) => {
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

    async function openAndCheck({ pathname, width, height, locale, familyLabel, expectedTitle }) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: width <= 480
      });

      const loaded = new Promise((resolve) => {
        const off = cdp.on('Page.loadEventFired', () => {
          off();
          resolve();
        });
      });

      await cdp.send('Page.navigate', { url: `${origin}${pathname}` });
      await loaded;

      const metrics = await evaluate(cdp, `(() => {
        const title = document.getElementById('productsHeroTitle')?.textContent?.trim();
        const cards = Array.from(document.querySelectorAll('#productsGrid .product-card'));
        const cardCount = cards.length;
        const visibleCards = cards.filter((card) => !card.hidden).length;
        const filterBar = document.querySelector('.filter-bar');
        const filterBarPosition = getComputedStyle(filterBar).position;
        const filterBarHeight = filterBar ? filterBar.getBoundingClientRect().height : 0;
        const overflow = document.documentElement.scrollWidth - window.innerWidth;
        const firstCardOpacity = cards[0] ? getComputedStyle(cards[0]).opacity : null;
        const familyText = document.getElementById('familyLabel')?.textContent?.trim();
        const toggle = document.getElementById('filtersToggle');
        const controls = document.getElementById('filtersControls');
        return {
          title,
          cardCount,
          visibleCards,
          filterBarPosition,
          filterBarHeight,
          overflow,
          firstCardOpacity,
          familyText,
          toggleHidden: toggle ? toggle.hidden : null,
          toggleExpanded: toggle ? toggle.getAttribute('aria-expanded') : null,
          controlsHidden: controls ? controls.hidden : null
        };
      })()`);

      assert.equal(metrics.title, expectedTitle);
      assert.equal(metrics.cardCount, 8);
      assert.equal(metrics.visibleCards, 8);
      assert.equal(metrics.filterBarPosition, 'sticky');
      assert.ok(metrics.overflow <= 1, `Unexpected horizontal overflow for ${pathname} ${width}x${height}: ${metrics.overflow}`);
      assert.equal(metrics.firstCardOpacity, '1');
      assert.equal(metrics.familyText, familyLabel);

      if (width <= 480) {
        assert.equal(metrics.toggleHidden, false);
        assert.equal(metrics.toggleExpanded, 'false');
        assert.equal(metrics.controlsHidden, true);
        assert.ok(metrics.filterBarHeight <= height * 0.22, `Sticky filter bar too tall on mobile for ${pathname}: ${metrics.filterBarHeight}px of ${height}px`);
      } else {
        assert.equal(metrics.controlsHidden, false);
      }

      const tabState = await evaluate(cdp, `(() => {
        document.getElementById('tab-instrumentacion')?.click();
        const active = document.querySelector('.hero-pane.active')?.id;
        const theme = document.querySelector('.hero')?.getAttribute('data-theme');
        return { active, theme };
      })()`);
      assert.equal(tabState.active, 'pane-instrumentacion');
      assert.equal(tabState.theme, 'instrumentacion');

      const filterState = await evaluate(cdp, `(() => {
        const toggle = document.getElementById('filtersToggle');
        const controls = document.getElementById('filtersControls');
        if (toggle && controls && controls.hidden) toggle.click();
        const select = document.getElementById('familySelect');
        select.value = 'bundles';
        select.dispatchEvent(new Event('change', { bubbles: true }));
        const visible = Array.from(document.querySelectorAll('#productsGrid .product-card')).filter((card) => !card.hidden).length;
        const countText = document.getElementById('resultCount')?.textContent?.trim();
        const clearHidden = document.getElementById('clearFilters')?.hidden;
        const chips = Array.from(document.querySelectorAll('#activeChips .chip')).map((chip) => chip.textContent.trim());
        return {
          visible,
          countText,
          clearHidden,
          chips,
          url: location.search,
          toggleExpanded: toggle ? toggle.getAttribute('aria-expanded') : null,
          controlsHidden: controls ? controls.hidden : null
        };
      })()`);

      assert.equal(filterState.visible, 2);
      assert.equal(filterState.clearHidden, false);
      assert.match(filterState.countText, /^2 /);
      assert.ok(filterState.chips.some((chip) => chip.includes('Bundles')));
      assert.equal(filterState.url, '?family=bundles');
      if (width <= 480) {
        assert.equal(filterState.toggleExpanded, 'true');
        assert.equal(filterState.controlsHidden, false);
      }
    }

    await openAndCheck({
      pathname: '/products.html',
      width: 1440,
      height: 1024,
      locale: 'es',
      familyLabel: 'Familia:',
      expectedTitle: 'Tecnología BCC'
    });

    await openAndCheck({
      pathname: '/products.html',
      width: 390,
      height: 844,
      locale: 'es',
      familyLabel: 'Familia:',
      expectedTitle: 'Tecnología BCC'
    });

    await openAndCheck({
      pathname: '/en/products.html',
      width: 1440,
      height: 1024,
      locale: 'en',
      familyLabel: 'Family:',
      expectedTitle: 'BCC Technology'
    });

    await openAndCheck({
      pathname: '/en/products.html',
      width: 390,
      height: 844,
      locale: 'en',
      familyLabel: 'Family:',
      expectedTitle: 'BCC Technology'
    });

    assert.equal(exceptions.length, 0, `Browser exceptions: ${JSON.stringify(exceptions, null, 2)}`);
    const severeLogs = logs.filter((entry) => entry.level === 'error');
    assert.equal(severeLogs.length, 0, `Browser console errors: ${JSON.stringify(severeLogs, null, 2)}`);
  } finally {
    server.close();
    await cdp.close();
  }
});
