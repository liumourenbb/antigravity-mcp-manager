/**
 * Antigravity MCP Manager - Dark/Light Theme Manager
 * Handles instant switching, localStorage persistence, OS preference sync,
 * multi-tab storage sync, and Electron Windows 11 native chrome sync.
 * Compliant with Rule 7: All functions <= 80 lines.
 */

const THEME_STORAGE_KEY = 'color-scheme';

/**
 * Reads user-selected override ('light' | 'dark') or null for system default.
 */
function getStoredThemeOverride() {
  try {
    const val = localStorage.getItem(THEME_STORAGE_KEY);
    return (val === 'light' || val === 'dark') ? val : null;
  } catch (_) {
    return null;
  }
}

/**
 * Resolves active visual theme ('light' | 'dark') from override or OS media query.
 */
function resolveEffectiveTheme(override = getStoredThemeOverride()) {
  if (override === 'light' || override === 'dark') return override;
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

/**
 * Updates toggle button icons, label, and accessibility attributes.
 */
function updateThemeToggleButton(resolvedTheme) {
  const btn = document.getElementById('theme-toggle-btn');
  if (!btn) return;
  const isDark = resolvedTheme === 'dark';
  const sunIcon = document.getElementById('theme-icon-sun');
  const moonIcon = document.getElementById('theme-icon-moon');
  const label = document.getElementById('theme-toggle-label');

  if (sunIcon) sunIcon.classList.toggle('hidden', isDark);
  if (moonIcon) moonIcon.classList.toggle('hidden', !isDark);
  if (label) label.textContent = isDark ? '暗夜' : '白天';

  btn.setAttribute('aria-pressed', String(!isDark));
  btn.setAttribute('aria-label', isDark ? '当前暗夜模式，点击切换到白天模式' : '当前白天模式，点击切换到暗夜模式');
  btn.setAttribute('title', isDark ? '切换到白天模式' : '切换到暗夜模式');
}

/**
 * Applies <meta name="color-scheme">, root class, UI controls, and Electron chrome.
 */
function applyTheme(override = getStoredThemeOverride()) {
  const meta = document.querySelector('meta[name="color-scheme"]');
  if (meta) {
    meta.setAttribute('content', override ? override : 'light dark');
  }
  const resolved = resolveEffectiveTheme(override);
  document.documentElement.classList.toggle('dark', resolved === 'dark');
  document.documentElement.dataset.theme = resolved;
  updateThemeToggleButton(resolved);

  if (window.mcpApi && typeof window.mcpApi.setTheme === 'function') {
    window.mcpApi.setTheme(override || 'system').catch(() => {});
  }
  return resolved;
}

/**
 * Toggles between Dark and Light modes and persists user preference.
 */
function toggleTheme() {
  const current = resolveEffectiveTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch (_) {
    // Ignore storage quota / privacy mode errors
  }
  const resolved = applyTheme(next);
  if (typeof showToast === 'function') {
    showToast(resolved === 'light' ? '已切换为白天模式' : '已切换为暗夜模式', 'info');
  }
  return resolved;
}

/**
 * Initializes theme manager, system preference listener, and cross-tab sync.
 */
function initThemeManager() {
  applyTheme();

  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystemChange = () => {
      if (!getStoredThemeOverride()) applyTheme(null);
    };
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onSystemChange);
    }
  }

  window.addEventListener('storage', (e) => {
    if (e.key === THEME_STORAGE_KEY) applyTheme();
  });
}

window.ThemeManager = {
  applyTheme,
  toggleTheme,
  initThemeManager,
  resolveEffectiveTheme,
  getStoredThemeOverride,
};
