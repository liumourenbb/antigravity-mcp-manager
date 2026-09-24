/**
 * Antigravity MCP Manager - Main Application Lifecycle & Filter Controller
 * Compliant with Rule 7: Single responsibility, all methods <= 80 lines.
 */

async function fetchServers() {
  try {
    const data = await api.getServers();
    allServers = data.servers || [];
    updateStats();
    renderServers();
  } catch (err) {
    showToast('读取服务失败: ' + err.message, 'error');
  }
}

function updateStats() {
  const total = allServers.length;
  const enabled = allServers.filter(s => !s.disabled && s.scope !== 'other').length;
  const disabled = allServers.filter(s => s.disabled || s.scope === 'other').length;
  const wsCount = allServers.filter(s => s.scope === 'workspace').length;

  document.getElementById('statTotal').innerText = total;
  document.getElementById('badgeServerCount').innerText = total;
  document.getElementById('statEnabled').innerText = enabled;
  document.getElementById('statDisabled').innerText = disabled;
  document.getElementById('statWorkspace').innerText = wsCount;

  const badgeDisabled = document.getElementById('badgeDisabledCount');
  if (badgeDisabled) {
    if (disabled > 0) {
      badgeDisabled.innerText = disabled;
      badgeDisabled.classList.remove('hidden');
    } else {
      badgeDisabled.classList.add('hidden');
    }
  }
}

function updateScopePillsUI(scope) {
  document.querySelectorAll('.scope-pill').forEach(pill => {
    if (pill.dataset.scope === scope) {
      if (scope === 'workspace') {
        pill.className = 'scope-pill px-2.5 py-1 rounded-md font-semibold text-purple-200 bg-purple-600/30 border border-purple-500/30 shadow-sm transition flex items-center space-x-1';
      } else if (scope === 'other') {
        pill.className = 'scope-pill px-2.5 py-1 rounded-md font-semibold text-rose-200 bg-rose-600/25 border border-rose-500/30 shadow-sm transition flex items-center space-x-1';
      } else {
        pill.className = 'scope-pill px-2.5 py-1 rounded-md font-semibold text-white bg-white/10 transition flex items-center space-x-1';
      }
    } else {
      pill.className = 'scope-pill px-2.5 py-1 rounded-md font-medium text-win-textSecondary hover:text-white transition flex items-center space-x-1';
    }
  });

  const btnFilterOnly = document.getElementById('btnFilterProjectOnly');
  if (btnFilterOnly) {
    if (scope === 'workspace') {
      btnFilterOnly.className = 'px-2.5 py-1 rounded bg-purple-600 text-white text-xs font-semibold flex items-center space-x-1 shadow-sm transition';
    } else {
      btnFilterOnly.className = 'px-2.5 py-1 rounded bg-purple-500/15 hover:bg-purple-500/25 text-purple-200 text-xs font-semibold flex items-center space-x-1 border border-purple-500/20 transition';
    }
  }
}

function setScopeFilter(scope) {
  currentScopeFilter = scope;
  updateScopePillsUI(scope);
  renderServers();
}

document.addEventListener('DOMContentLoaded', async () => {
  await initWorkspace();
  await fetchServers();
  await fetchPresets();
  checkJetBrains();
  if (window.RulesManager && typeof RulesManager.init === 'function') {
    RulesManager.init();
  }
  if (window.lucide) lucide.createIcons();
});
