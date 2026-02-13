/* BCC Technologies - Preferences (theme only) */
(() => {
  const THEME_KEY = 'bcc-theme';

  function getSaved(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }

  function setSaved(key, value) {
    try { localStorage.setItem(key, value); } catch {}
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
  }

  document.addEventListener('DOMContentLoaded', init);
})();
