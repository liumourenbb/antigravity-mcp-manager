/**
 * Antigravity MCP Manager - Refresh & Live Probe Controller
 * Compliant with Rule 7: Standalone manager module, every function <= 55 lines.
 */

window.__mcpLiveToolsCache = window.__mcpLiveToolsCache || new Map();
window.__mcpLastProbeMap = window.__mcpLastProbeMap || new Map();

function getProbeCacheKey(s) {
  return `${s.scope || 'global'}::${s.configPath || ''}::${s.name || ''}`;
}

function getLastProbeResult(s) {
  return window.__mcpLastProbeMap.get(getProbeCacheKey(s)) || null;
}

function saveLastProbeResult(name, scope, configPath, res) {
  if (!name || !res) return;
  const key = `${scope || 'all'}::${configPath || ''}::${name}`;
  const exactKey = `${res.server?.scope || scope || 'global'}::${res.server?.configPath || configPath || ''}::${name}`;
  const record = {
    ok: Boolean(res.ok),
    disabled: Boolean(res.disabled),
    latencyMs: res.latencyMs ?? 0,
    toolsCount: res.toolsCount ?? 0,
    updatedAt: Date.now(),
  };
  window.__mcpLastProbeMap.set(key, record);
  window.__mcpLastProbeMap.set(exactKey, record);
}

function getLiveCachedTools(serverName) {
  return window.__mcpLiveToolsCache.get(serverName) || [];
}

function decodeSafeParam(val) {
  if (typeof val !== 'string') return val || '';
  try {
    return val.includes('%') ? decodeURIComponent(val) : val;
  } catch {
    return val;
  }
}

function setRefreshButtonSpinning(btnEl, spinning) {
  if (!btnEl) return;
  btnEl.disabled = Boolean(spinning);
  btnEl.setAttribute('aria-busy', spinning ? 'true' : 'false');
  const icon = btnEl.querySelector('svg, i');
  if (icon) {
    icon.classList.toggle('animate-spin', Boolean(spinning));
  }
}

function updatePingBadgeAfterRefresh(pingEl, res) {
  if (!pingEl) return;
  if (res.disabled) {
    pingEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-slate-500 inline-block"></span><span class="text-win-textTertiary font-mono text-[10px]">已停用 (已重载)</span>`;
    return;
  }
  if (res.ok) {
    const toolsText = res.toolsCount > 0 ? ` · ${res.toolsCount} 工具` : '';
    pingEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)] inline-block"></span><span class="text-emerald-400 font-mono font-medium text-[11px]">${res.latencyMs || 0}ms 正常${toolsText}</span>`;
    return;
  }
  pingEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-rose-500 inline-block"></span><span class="text-rose-400 font-mono text-[11px]">探针失败</span>`;
}

function buildGroupRefreshBtnHtml(g) {
  if (!g || g.type === 'other' || !Array.isArray(g.servers) || g.servers.length === 0) {
    return '';
  }
  return `
    <button type="button" onclick="refreshGroupServers('${g.id}', this)" title="重载本组配置并对启用中 MCP 发起实时探针" aria-label="刷新本组 MCP 服务" class="px-2 py-1 rounded-md bg-white/5 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 text-[11px] font-medium flex items-center space-x-1 border border-white/10 transition">
      <i data-lucide="refresh-cw" aria-hidden="true" class="w-3 h-3"></i>
      <span>刷新本组</span>
    </button>
  `;
}

async function refreshSingleMcp(nameInput, scopeInput = 'all', encodedPath = '', pingIdInput = '', btnEl = null) {
  const name = decodeSafeParam(nameInput);
  const scope = decodeSafeParam(scopeInput) || 'all';
  const configPath = decodeSafeParam(encodedPath);
  const pingEl = (pingIdInput ? document.getElementById(pingIdInput) : null) || document.getElementById(`ping-${name}`);

  setRefreshButtonSpinning(btnEl, true);
  if (pingEl) {
    pingEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse inline-block"></span><span class="text-amber-400 font-mono text-[10px]">实时探针刷新中...</span>`;
  }

  try {
    const ws = typeof currentWorkspace !== 'undefined' ? currentWorkspace : '';
    const res = await api.refreshServer(name, scope, configPath, ws);
    if (Array.isArray(res.liveTools) && res.liveTools.length > 0) {
      window.__mcpLiveToolsCache.set(name, res.liveTools);
    }
    saveLastProbeResult(name, scope, configPath, res);
    updatePingBadgeAfterRefresh(pingEl, res);
    showToast(res.message || `[${name}] 刷新完成`, res.ok ? 'success' : 'error');
    return res;
  } catch (err) {
    updatePingBadgeAfterRefresh(pingEl, { ok: false });
    showToast(`[${name}] 刷新异常: ${err.message}`, 'error');
    return { ok: false, message: err.message };
  } finally {
    setRefreshButtonSpinning(btnEl, false);
  }
}

async function refreshAllMcp(showFeedback = true) {
  const btn = document.getElementById('btnRefreshAllMcp');
  setRefreshButtonSpinning(btn, true);
  try {
    if (typeof refreshProjects === 'function') {
      await refreshProjects(false);
    }
    if (typeof fetchServers === 'function') {
      await fetchServers();
    }
    if (showFeedback) {
      const list = Array.isArray(allServers) ? allServers : [];
      const enabledCount = list.filter(s => !s.disabled && s.scope !== 'other').length;
      showToast(`已从磁盘重新同步全部 MCP 配置 (共 ${list.length} 项，启用 ${enabledCount} 项)`, 'success');
    }
  } catch (err) {
    showToast('全局刷新失败: ' + err.message, 'error');
  } finally {
    setRefreshButtonSpinning(btn, false);
  }
}

async function probeServerBatch(targets, concurrency = 3) {
  const results = [];
  for (let i = 0; i < targets.length; i += concurrency) {
    const slice = targets.slice(i, i + concurrency);
    const ws = typeof currentWorkspace !== 'undefined' ? currentWorkspace : '';
    const settled = await Promise.all(slice.map(async (s) => {
      const res = await api.refreshServer(s.name, s.scope || 'all', s.configPath || '', ws);
      if (Array.isArray(res.liveTools) && res.liveTools.length > 0) {
        window.__mcpLiveToolsCache.set(s.name, res.liveTools);
      }
      saveLastProbeResult(s.name, s.scope, s.configPath, res);
      return res;
    }));
    results.push(...settled);
  }
  return results;
}

async function refreshGroupServers(groupId, btnEl = null) {
  setRefreshButtonSpinning(btnEl, true);
  try {
    const groups = typeof groupServersByWorkspace === 'function' ? groupServersByWorkspace(allServers || []) : [];
    const targetGroup = groups.find(g => g.id === groupId);
    const activeServers = (targetGroup?.servers || []).filter(s => !s.disabled);

    if (activeServers.length === 0) {
      if (typeof fetchServers === 'function') await fetchServers();
      showToast('本组暂无启用中的 MCP 服务，已同步最新磁盘配置', 'info');
      return;
    }

    showToast(`正在刷新本组 ${activeServers.length} 个 MCP 服务...`, 'info');
    const results = await probeServerBatch(activeServers, 3);
    if (typeof fetchServers === 'function') await fetchServers();

    const okCount = results.filter(r => r.ok).length;
    const failCount = results.length - okCount;
    const msg = failCount === 0
      ? `本组 ${okCount} 个启用服务全部刷新与探针通过`
      : `本组刷新完成: ${okCount} 个正常，${failCount} 个异常`;
    showToast(msg, failCount === 0 ? 'success' : 'error');
  } catch (err) {
    showToast('分组刷新异常: ' + err.message, 'error');
  } finally {
    setRefreshButtonSpinning(btnEl, false);
  }
}

async function refreshAndInspectTools(nameInput) {
  const name = decodeSafeParam(nameInput);
  const match = (typeof allServers !== 'undefined' && Array.isArray(allServers))
    ? allServers.find(s => s.name === name && s.scope !== 'other') || allServers.find(s => s.name === name)
    : null;
  const scope = encodeURIComponent(match?.scope || 'all');
  const configPath = encodeURIComponent(match?.configPath || '');
  const pingId = match && typeof getServerCardPingId === 'function' ? getServerCardPingId(match) : '';
  await refreshSingleMcp(encodeURIComponent(name), scope, configPath, pingId, null);
  if (typeof inspectTools === 'function') {
    await inspectTools(encodeURIComponent(name));
  }
}
