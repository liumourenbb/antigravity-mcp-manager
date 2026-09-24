/**
 * Antigravity MCP Manager - Presets, JetBrains Diagnostics & Backups
 * Compliant with Rule 7: Single responsibility, all methods <= 80 lines.
 */

async function fetchPresets() {
  try {
    const data = await api.getPresets();
    presetsCache = data.presets || [];
    renderPresetsView();
  } catch {}
}

function renderPresetsView() {
  const container = document.getElementById('presetsGrid');
  if (!container) return;

  container.innerHTML = presetsCache.map(p => `
    <div class="fluent-card p-4 flex flex-col justify-between">
      <div class="space-y-2">
        <div class="flex items-center space-x-2">
          <span class="text-xs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono font-bold">${escapeHtml(p.category || 'MCP')}</span>
          <h4 class="font-bold text-xs text-white">${escapeHtml(p.name)}</h4>
        </div>
        <p class="text-xs text-slate-300">${escapeHtml(p.description || '')}</p>
        <div class="bg-[#1e1e1e] p-2 rounded text-[11px] font-mono text-win-textTertiary truncate">
          ${escapeHtml(p.config?.command || p.config?.url || '')}
        </div>
      </div>
      <div class="pt-3 mt-3 border-t border-win-border/40 flex justify-end">
        <button onclick="applyPreset('${escapeJs(p.name)}')" class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center space-x-1.5 transition">
          <i data-lucide="plus-circle" class="w-3.5 h-3.5"></i>
          <span>一键套用</span>
        </button>
      </div>
    </div>
  `).join('');

  if (window.lucide) lucide.createIcons();
}

function applyPreset(name) {
  const preset = presetsCache.find(p => p.name === name);
  if (!preset) return;

  openAddServerModal();
  document.getElementById('formName').value = preset.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-');

  const conf = preset.config || {};
  const isHttp = conf.type === 'http' || Boolean(conf.url);
  document.querySelector(`input[name="transportType"][value="${isHttp ? 'http' : 'stdio'}"]`).checked = true;
  toggleTransportFields(isHttp ? 'http' : 'stdio');

  if (isHttp) {
    document.getElementById('formUrl').value = conf.url || '';
  } else {
    document.getElementById('formCommand').value = conf.command || '';
    document.getElementById('formArgs').value = (conf.args || []).join(' ');
    const envList = document.getElementById('envList');
    envList.innerHTML = '';
    Object.keys(conf.env || {}).forEach(k => addEnvRow(k, conf.env[k]));
  }

  showToast(`已套用预设模板 [${preset.name}]，请确认参数后点击保存`, 'info');
}

async function checkJetBrains() {
  const badgeDead = document.getElementById('badgeJbDead');
  const container = document.getElementById('jetbrainsList');
  if (container) container.innerHTML = '<div class="text-xs text-win-textSecondary py-4">正在扫描 JetBrains 桥接脚本...</div>';

  try {
    const res = await api.scanJetBrains();
    const deadCount = (res.dead || []).length;
    if (badgeDead) {
      if (deadCount > 0) {
        badgeDead.innerText = `${deadCount} 失效`;
        badgeDead.classList.remove('hidden');
      } else {
        badgeDead.classList.add('hidden');
      }
    }

    if (!container) return;
    const allBridges = [...(res.dead || []), ...(res.alive || [])];
    if (allBridges.length === 0) {
      container.innerHTML = `<div class="fluent-card p-6 text-center text-xs text-win-textSecondary">未发现 JetBrains 伴随桥接服务。</div>`;
      return;
    }

    container.innerHTML = allBridges.map(b => `
      <div class="fluent-card p-3 flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <span class="w-2 h-2 rounded-full ${b.isAlive ? 'bg-emerald-400' : 'bg-rose-500'} inline-block"></span>
            <span class="font-bold text-xs text-white font-mono">${escapeHtml(b.name)}</span>
            <span class="text-[10px] px-1.5 py-0.2 rounded ${b.isAlive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'} font-mono">${b.isAlive ? '活跃' : '已失效残留'}</span>
          </div>
          <p class="text-[11px] font-mono text-win-textTertiary truncate max-w-lg">${escapeHtml(b.command || '')}</p>
        </div>
      </div>
    `).join('');
  } catch (err) {
    if (container) container.innerHTML = `<div class="text-xs text-rose-400 py-4">扫描失败: ${escapeHtml(err.message)}</div>`;
  }
}

async function cleanDeadBridges() {
  try {
    const res = await api.cleanJetBrains();
    if (res.ok) {
      showToast(`已成功清理 ${res.cleaned?.length || 0} 个失效 JetBrains 桥接`, 'success');
      await checkJetBrains();
      await fetchServers();
    } else {
      showToast('清理失败: ' + res.error, 'error');
    }
  } catch (err) {
    showToast('清理异常: ' + err.message, 'error');
  }
}

async function renderBackupsView() {
  const container = document.getElementById('backupsList');
  if (!container) return;
  container.innerHTML = '<div class="text-xs text-win-textSecondary py-4">正在读取配置历史快照...</div>';

  try {
    const res = await api.getBackups();
    const list = res.backups || [];
    if (list.length === 0) {
      container.innerHTML = `<div class="fluent-card p-6 text-center text-xs text-win-textSecondary">暂无自动快照。当编辑或删除服务时系统会自动创建版本备份。</div>`;
      return;
    }

    container.innerHTML = list.map(b => `
      <div class="fluent-card p-3.5 flex items-center justify-between">
        <div>
          <div class="flex items-center space-x-2">
            <i data-lucide="file-check-2" class="w-4 h-4 text-blue-400"></i>
            <span class="font-bold text-xs text-white">${escapeHtml(b.id || b.name)}</span>
            <span class="text-[10px] px-1.5 py-0.2 rounded bg-white/5 text-win-textTertiary font-mono">${escapeHtml(b.date || '')}</span>
          </div>
          <p class="text-[11px] text-win-textSecondary mt-0.5">${escapeHtml(b.reason || '自动保存快照')}</p>
        </div>
        <button onclick="restoreBackupSnapshot('${escapeJs(b.id)}')" class="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-win-accent text-xs font-medium transition">
          恢复此版本
        </button>
      </div>
    `).join('');

    if (window.lucide) lucide.createIcons();
  } catch (err) {
    container.innerHTML = `<div class="text-xs text-rose-400 py-4">读取快照失败: ${escapeHtml(err.message)}</div>`;
  }
}

async function restoreBackupSnapshot(id) {
  if (!confirm(`确定要将 MCP 配置还原至快照版本 [${id}] 吗？当前配置将被覆写。`)) return;
  try {
    const res = await api.restoreBackup(id);
    if (res.ok) {
      showToast('已成功恢复至历史快照', 'success');
      await fetchServers();
    } else {
      showToast('恢复失败: ' + res.error, 'error');
    }
  } catch (err) {
    showToast('恢复异常: ' + err.message, 'error');
  }
}
