/**
 * Antigravity MCP Manager - Frontend Helpers & UI Primitives
 * Compliant with Rule 7: Modular, single-responsibility, all methods <= 80 lines.
 */

// Global State
let allServers = [];
let currentScopeFilter = 'workspace';
let presetsCache = [];
let currentWorkspace = '';
let recentWorkspaces = [];
let antigravityProjects = [];

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeJs(str) {
  if (!str) return '';
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function pathResolve(p) {
  if (!p) return '';
  return p.replace(/\\/g, '/').toLowerCase();
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('hidden');
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('hidden');
}

function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  const icon = document.getElementById('toastIcon');
  const msgEl = document.getElementById('toastMsg');
  if (!toast || !msgEl) return;

  msgEl.innerText = msg;
  if (type === 'success') {
    icon.className = 'w-4 h-4 text-emerald-400';
  } else if (type === 'error') {
    icon.className = 'w-4 h-4 text-rose-400';
  } else {
    icon.className = 'w-4 h-4 text-win-accent';
  }

  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3000);
}

function switchTab(tabId) {
  document.querySelectorAll('section[id^="view-"]').forEach(s => s.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const target = document.getElementById(`view-${tabId}`);
  const nav = document.getElementById(`nav-${tabId}`);
  if (target) target.classList.remove('hidden');
  if (nav) nav.classList.add('active');

  if (tabId === 'jetbrains' && typeof checkJetBrains === 'function') checkJetBrains();
  if (tabId === 'backups' && typeof renderBackupsView === 'function') renderBackupsView();
  if (tabId === 'rules' && window.RulesManager && typeof RulesManager.load === 'function') RulesManager.load();
  if (tabId === 'project-rules' && window.ProjectRulesManager && typeof ProjectRulesManager.load === 'function') ProjectRulesManager.load();
}
