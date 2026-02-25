/* BCC Technologies - Preferences (theme + language) */
(() => {
  const THEME_KEY = 'bcc-theme';
  const LANG_KEY = 'bcc-lang';

  function getSaved(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }

  function setSaved(key, value) {
    try { localStorage.setItem(key, value); } catch {}
  }

  function normalizeLang(raw) {
    if (!raw) return 'es';
    const lower = String(raw).toLowerCase();
    return lower.startsWith('en') ? 'en' : 'es';
  }

  function getSavedLang() {
    const saved = getSaved(LANG_KEY);
    return saved === 'en' || saved === 'es' ? saved : null;
  }

  function detectBrowserLang() {
    const list = (navigator.languages && navigator.languages.length)
      ? navigator.languages
      : [navigator.language || ''];
    for (const entry of list) {
      const norm = normalizeLang(entry);
      if (norm === 'en' || norm === 'es') return norm;
    }
    return 'es';
  }

  function getPathLang() {
    return window.location.pathname.toLowerCase().startsWith('/en/') ? 'en' : 'es';
  }

  function mapPathToLang(pathname, lang) {
    const path = pathname || '/';
    if (lang === 'en') {
      if (path.toLowerCase().startsWith('/en/')) return path;
      if (path === '/' || path === '') return '/en/index.html';
      return '/en' + (path.startsWith('/') ? path : '/' + path);
    }
    if (path.toLowerCase().startsWith('/en/')) {
      const stripped = path.slice(3);
      if (stripped === '/' || stripped === '') return '/index.html';
      return stripped;
    }
    return path;
  }

  function getAlternateHref(lang) {
    const link = document.querySelector(`link[rel="alternate"][hreflang="${lang}"]`);
    if (!link) return null;
    const href = link.getAttribute('href');
    if (!href) return null;
    return new URL(href, window.location.href).pathname;
  }

  function getSwitchHref(lang) {
    const link = document.querySelector('a.lang-switch[href]');
    if (!link) return null;
    const href = link.getAttribute('href');
    if (!href) return null;
    const targetLang = href.includes('/en/') ? 'en' : 'es';
    if (targetLang !== lang) return null;
    return new URL(href, window.location.href).pathname;
  }

  function getLangTargets() {
    const meta = document.querySelector('meta[name="bcc-lang-targets"]');
    if (!meta) return null;
    const content = (meta.getAttribute('content') || '').toLowerCase();
    const list = content.split(',').map(x => normalizeLang(x.trim())).filter(Boolean);
    return list.length ? Array.from(new Set(list)) : null;
  }

  function resolveLangTarget(lang) {
    return getAlternateHref(lang) || getSwitchHref(lang) || mapPathToLang(window.location.pathname, lang);
  }

  function maybeRedirectLang() {
    const saved = getSavedLang();
    const desired = saved || detectBrowserLang();
    const current = getPathLang();
    const targets = getLangTargets();
    if (targets && !targets.includes(desired)) return;
    if (desired === current) return;
    const targetPath = resolveLangTarget(desired);
    if (!targetPath || targetPath === window.location.pathname) return;
    const next = targetPath + window.location.search + window.location.hash;
    window.location.replace(next);
  }

  function getCurrentTheme() {
    const data = document.documentElement.dataset.theme;
    if (data === 'dark' || data === 'light') return data;
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
  }

  function applyTheme(theme, persist) {
    const safe = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = safe;
    updateThemeButtons(safe);
    if (persist) setSaved(THEME_KEY, safe);
  }

  function updateThemeButtons(theme) {
    const lang = document.documentElement.lang && document.documentElement.lang.toLowerCase().startsWith('en') ? 'en' : 'es';
    const aria = theme === 'dark'
      ? (lang === 'en' ? 'Switch to light mode' : 'Cambiar a modo claro')
      : (lang === 'en' ? 'Switch to dark mode' : 'Cambiar a modo oscuro');
    document.querySelectorAll('[data-action="toggle-theme"]').forEach((btn) => {
      btn.setAttribute('aria-label', aria);
      btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
    });
  }

  function init() {
    const savedTheme = getSaved(THEME_KEY);
    if (savedTheme === 'dark' || savedTheme === 'light') {
      document.documentElement.dataset.theme = savedTheme;
    }
    updateThemeButtons(getCurrentTheme());

    document.querySelectorAll('[data-action="toggle-theme"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const current = getCurrentTheme();
        applyTheme(current === 'dark' ? 'light' : 'dark', true);
      });
    });

    document.querySelectorAll('a.lang-switch, button.lang-switch').forEach((el) => {
      el.addEventListener('click', () => {
        const href = el.getAttribute('href') || '';
        const targetLang = href.includes('/en/') ? 'en' : 'es';
        setSaved(LANG_KEY, targetLang);
      });
    });
  }

  maybeRedirectLang();
  document.addEventListener('DOMContentLoaded', init);
})();



