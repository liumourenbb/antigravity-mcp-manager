import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { startServer } from '../src/server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function createMockClassList(initial = []) {
  const set = new Set(initial);
  return {
    add: (...cls) => cls.forEach(c => set.add(c)),
    remove: (...cls) => cls.forEach(c => set.delete(c)),
    contains: (c) => set.has(c),
    toggle: (c, force) => {
      if (force === true) { set.add(c); return true; }
      if (force === false) { set.delete(c); return false; }
      if (set.has(c)) { set.delete(c); return false; }
      set.add(c);
      return true;
    },
  };
}

function createMockElement(id, initialClasses = []) {
  const attrs = {};
  return {
    id,
    textContent: '',
    classList: createMockClassList(initialClasses),
    setAttribute: (k, v) => { attrs[k] = String(v); },
    getAttribute: (k) => attrs[k] || null,
  };
}

function loadThemeManagerSandbox({ prefersDark = true, stored = null } = {}) {
  const store = new Map();
  if (stored !== null) store.set('color-scheme', stored);
  const ipcCalls = [];
  const listeners = { storage: [], media: [] };

  const metaEl = createMockElement('meta-color-scheme');
  metaEl.setAttribute('content', 'light dark');
  const btnEl = createMockElement('theme-toggle-btn');
  const sunEl = createMockElement('theme-icon-sun', ['hidden']);
  const moonEl = createMockElement('theme-icon-moon');
  const labelEl = createMockElement('theme-toggle-label');
  const rootEl = { classList: createMockClassList(), dataset: {} };

  const sandbox = {
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    document: {
      documentElement: rootEl,
      querySelector: (sel) => (sel === 'meta[name="color-scheme"]' ? metaEl : null),
      getElementById: (id) => ({
        'theme-toggle-btn': btnEl,
        'theme-icon-sun': sunEl,
        'theme-icon-moon': moonEl,
        'theme-toggle-label': labelEl,
      }[id] || null),
    },
    window: {
      matchMedia: () => ({
        matches: prefersDark,
        addEventListener: (_ev, fn) => listeners.media.push(fn),
      }),
      addEventListener: (ev, fn) => {
        if (ev === 'storage') listeners.storage.push(fn);
      },
      mcpApi: {
        setTheme: async (t) => { ipcCalls.push(t); return { ok: true, theme: t }; },
      },
    },
    showToast: () => {},
  };
  sandbox.window.localStorage = sandbox.localStorage;
  sandbox.window.document = sandbox.document;
  sandbox.globalThis = sandbox;

  const code = fs.readFileSync(path.join(rootDir, 'src', 'web', 'js', 'theme-manager.js'), 'utf8');
  vm.runInNewContext(code, sandbox);

  return { sandbox, store, ipcCalls, listeners, metaEl, btnEl, sunEl, moonEl, labelEl, rootEl };
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    }).on('error', reject);
  });
}

async function runThemeTests() {
  console.log('Running Antigravity MCP Manager Theme Contract & Runtime Tests...');

  // 1. HTML, CSS, IPC, Preload contracts
  const html = fs.readFileSync(path.join(rootDir, 'src/web/index.html'), 'utf8');
  assert(!/<html[^>]*class=["'][^"']*dark/.test(html), 'index.html should not hardcode class="dark" on <html>');
  assert(html.includes('<meta name="color-scheme" content="light dark">'), 'index.html must include <meta name="color-scheme" content="light dark">');
  assert(/<meta name="color-scheme"[^>]*>\s*<script>(?![^>]*defer)/.test(html), 'FOUC prevention inline script must appear immediately after color-scheme meta');
  assert(html.includes('<link rel="stylesheet" href="css/theme.css">'), 'index.html must load css/theme.css');
  assert(html.includes('<script src="js/theme-manager.js"></script>'), 'index.html must load js/theme-manager.js');
  assert(html.includes('id="theme-toggle-btn"') && html.includes('ThemeManager.toggleTheme()'), 'Titlebar must include accessible theme toggle button');

  const css = fs.readFileSync(path.join(rootDir, 'src/web/css/theme.css'), 'utf8');
  const cssNoComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert(css.includes('color-scheme: light dark;'), 'theme.css must declare color-scheme: light dark on :root');
  assert(css.includes('html:not(.dark)'), 'theme.css must define light theme rules');
  assert(!/transition\s*:[^;{}]*scrollbar-color/i.test(cssNoComments), 'scrollbar-color must NOT be animated or transitioned');
  assert(!cssNoComments.includes('#workspaceContextBar .text-white'), 'Must not override solid buttons inside #workspaceContextBar with dark text');
  assert(cssNoComments.includes('#barWorkspaceName') && cssNoComments.includes(':is(*, [class])'), 'Must target #barWorkspaceName specifically and preserve white foregrounds inside solid accent buttons');

  const ipc = fs.readFileSync(path.join(rootDir, 'src/desktop/ipc.js'), 'utf8');
  const preload = fs.readFileSync(path.join(rootDir, 'src/desktop/preload.cjs'), 'utf8');
  assert(ipc.includes("ipcMain.handle('mcp:setTheme'"), 'ipc.js must register mcp:setTheme handler');
  assert(ipc.includes('nativeTheme.themeSource') && ipc.includes('setTitleBarOverlay'), 'ipc.js must sync nativeTheme and titleBarOverlay');
  assert(preload.includes("setTheme: (theme) => ipcRenderer.invoke('mcp:setTheme', theme)"), 'preload.cjs must expose mcpApi.setTheme');

  // 2. Runtime behavior in sandbox (Dark system default -> toggle to Light -> toggle back to Dark)
  const ctx = loadThemeManagerSandbox({ prefersDark: true, stored: null });
  ctx.sandbox.window.ThemeManager.initThemeManager();
  assert.strictEqual(ctx.rootEl.classList.contains('dark'), true);
  assert.strictEqual(ctx.metaEl.getAttribute('content'), 'light dark');
  assert.strictEqual(ctx.ipcCalls[0], 'system');
  assert.strictEqual(ctx.btnEl.getAttribute('aria-pressed'), 'false');

  const afterFirstToggle = ctx.sandbox.window.ThemeManager.toggleTheme();
  assert.strictEqual(afterFirstToggle, 'light');
  assert.strictEqual(ctx.rootEl.classList.contains('dark'), false);
  assert.strictEqual(ctx.metaEl.getAttribute('content'), 'light');
  assert.strictEqual(ctx.store.get('color-scheme'), 'light');
  assert.strictEqual(ctx.btnEl.getAttribute('aria-pressed'), 'true');
  assert.strictEqual(ctx.labelEl.textContent, '白天');
  assert.strictEqual(ctx.sunEl.classList.contains('hidden'), false);
  assert.strictEqual(ctx.moonEl.classList.contains('hidden'), true);
  assert.strictEqual(ctx.ipcCalls.at(-1), 'light');

  // OS preference change must NOT clobber explicit user override
  ctx.listeners.media.forEach(fn => fn());
  assert.strictEqual(ctx.store.get('color-scheme'), 'light');
  assert.strictEqual(ctx.rootEl.classList.contains('dark'), false);

  // Storage sync from another tab updates active theme
  ctx.store.set('color-scheme', 'dark');
  ctx.listeners.storage.forEach(fn => fn({ key: 'color-scheme' }));
  assert.strictEqual(ctx.rootEl.classList.contains('dark'), true);
  assert.strictEqual(ctx.metaEl.getAttribute('content'), 'dark');
  assert.strictEqual(ctx.labelEl.textContent, '暗夜');

  // 3. Hover tooltip Light Mode & no-duplicate-tooltip contract checks
  const cssSource = fs.readFileSync(path.join(rootDir, 'src/web/css/theme.css'), 'utf8');
  assert(cssSource.includes('.bg-\\[\\#1c1c22\\]\\/95'), 'theme.css must override bg-[#1c1c22]/95 in light mode');
  assert(cssSource.includes('html:not(.dark) #mcpGlobalTooltip'), 'theme.css must adapt #mcpGlobalTooltip in light mode');

  const cardRendererSource = fs.readFileSync(path.join(rootDir, 'src/web/js/server-card-renderer.js'), 'utf8');
  assert(!cardRendererSource.includes('title="【'), 'Card must not keep native title tooltip alongside custom #mcpGlobalTooltip');

  // 4. HTTP static asset serving & traversal safety
  const { server, url } = await startServer({ port: 0, host: '127.0.0.1' });
  try {
    const cssRes = await fetchUrl(`${url}/css/theme.css`);
    assert.strictEqual(cssRes.status, 200);
    assert(cssRes.headers['content-type'].includes('text/css'));

    const jsRes = await fetchUrl(`${url}/js/theme-manager.js`);
    assert.strictEqual(jsRes.status, 200);
    assert(jsRes.headers['content-type'].includes('application/javascript'));

    const badRes = await fetchUrl(`${url}/css/../desktop/ipc.js`);
    assert.strictEqual(badRes.status, 404);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }

  console.log('✅ Theme contract, runtime & asset serving tests PASSED.');
}

runThemeTests().catch((err) => {
  console.error('❌ Theme test failed:', err);
  process.exit(1);
});
