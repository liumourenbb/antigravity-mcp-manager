/**
 * Antigravity MCP Manager - Workspace & Projects Manager
 * Compliant with Rule 7: Single responsibility, all methods <= 80 lines.
 */

async function initWorkspace() {
  if (window.mcpApi && window.mcpApi.getActiveWorkspace) {
    try {
      const res = await window.mcpApi.getActiveWorkspace();
      currentWorkspace = res.activeWorkspace || '';
      recentWorkspaces = res.recentWorkspaces || [];
      antigravityProjects = res.projects || [];
      updateWorkspaceUI();
    } catch (e) {
      console.error('Failed to get active workspace:', e);
    }
  }
}

async function refreshProjects(showToastMsg = false) {
  try {
    const res = await api.getAntigravityProjects();
    if (res.ok) {
      antigravityProjects = res.projects || [];
      if (res.activeWorkspace) currentWorkspace = res.activeWorkspace;
      updateWorkspaceUI();
      renderProjectsList();
      if (showToastMsg) showToast(`已重新同步 ${antigravityProjects.length} 个 Antigravity 项目`, 'success');
    }
  } catch (err) {
    if (showToastMsg) showToast('刷新项目失败: ' + err.message, 'error');
  }
}

function openProjectsModal() {
  refreshProjects(false);
  openModal('modalProjects');
  renderProjectsList();
}

function renderProjectItemHtml(p, isCurrent) {
  const hasMcp = p.hasMcp;
  const mcpBadge = hasMcp
    ? `<span class="text-[10px] px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 font-mono border border-purple-500/20">${p.mcpCount} 个 MCP 服务</span>`
    : `<span class="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-win-textTertiary font-mono">未配 MCP</span>`;

  const serverTags = (p.serverNames || []).length > 0
    ? `<div class="flex flex-wrap gap-1 mt-1.5">
         ${p.serverNames.map(s => `<span class="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/30 text-slate-300 border border-white/5">${escapeHtml(s)}</span>`).join('')}
       </div>`
    : '';

  return `
    <div onclick="switchWorkspaceTo('${escapeJs(p.path)}')" class="fluent-card p-3.5 flex flex-col justify-between cursor-pointer hover:border-purple-500/40 transition group/item ${isCurrent ? 'border-purple-500/60 bg-[#2b2b2b]' : ''}">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <div class="flex items-center space-x-2">
            <span class="font-bold text-xs ${isCurrent ? 'text-win-accent' : 'text-white'} group-hover/item:text-purple-300 transition truncate">${escapeHtml(p.name)}</span>
            ${isCurrent ? '<span class="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-medium">当前激活</span>' : ''}
            <span class="text-[9px] px-1.5 py-0.2 rounded bg-white/5 text-win-textTertiary font-mono">${escapeHtml(p.source || 'Antigravity')}</span>
          </div>
          <p class="text-[11px] font-mono text-win-textSecondary truncate mt-1" title="${escapeHtml(p.path)}">${escapeHtml(p.path)}</p>
          ${serverTags}
        </div>

        <div class="flex flex-col items-end space-y-1.5 shrink-0">
          ${mcpBadge}
          <div class="flex items-center space-x-1.5 mt-1">
            <button onclick="event.stopPropagation(); openProjectConfigFile('${escapeJs(p.path)}')" title="在外部编辑器中直接打开此工程的 .agents/mcp_config.json" class="px-2 py-1 rounded bg-white/5 hover:bg-white/15 text-purple-300 hover:text-white text-[11px] transition flex items-center space-x-1">
              <i data-lucide="file-code" class="w-3.5 h-3.5 text-purple-400"></i>
              <span>打开配置</span>
            </button>
            ${!hasMcp ? `
              <button onclick="event.stopPropagation(); initProjectMcp('${escapeJs(p.path)}')" title="为此工程初始化 .agents/mcp_config.json" class="px-2 py-1 rounded bg-white/5 hover:bg-purple-600/30 text-purple-300 hover:text-white text-[11px] transition">
                初始化
              </button>
            ` : ''}
            ${!isCurrent ? `
              <button onclick="event.stopPropagation(); switchWorkspaceTo('${escapeJs(p.path)}')" class="px-2.5 py-1 rounded bg-[#0078d4] hover:bg-[#106ebe] text-white text-[11px] font-medium transition shadow-sm">
                选中项目
              </button>
            ` : `
              <span class="text-[11px] text-emerald-400 font-medium px-2 py-0.5">当前使用</span>
            `}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderProjectsList() {
  const container = document.getElementById('projectsContainer');
  const counter = document.getElementById('modalProjectCount');
  const search = (document.getElementById('projectSearchInput')?.value || '').toLowerCase().trim();

  let list = antigravityProjects || [];
  if (search) {
    list = list.filter(p => p.name.toLowerCase().includes(search) || p.path.toLowerCase().includes(search));
  }

  if (counter) counter.innerText = `${list.length} 个`;

  if (list.length === 0) {
    container.innerHTML = `<div class="fluent-card p-8 text-center text-xs text-win-textSecondary">未找到匹配的 Antigravity 项目。点击上方“浏览本地其它目录”可手动添加。</div>`;
    return;
  }

  container.innerHTML = list.map(p => {
    const isCurrent = p.path.toLowerCase() === (currentWorkspace || '').toLowerCase();
    return renderProjectItemHtml(p, isCurrent);
  }).join('');

  if (window.lucide) lucide.createIcons();
}

async function switchWorkspaceTo(dir) {
  if (!dir) return;
  try {
    const res = await api.setActiveWorkspace(dir);
    if (res.ok) {
      currentWorkspace = dir;
      recentWorkspaces = res.recentWorkspaces || recentWorkspaces;
      antigravityProjects = res.projects || antigravityProjects;
      updateWorkspaceUI();
      renderProjectsList();
      closeModal('modalProjects');
      setScopeFilter('workspace');
      await fetchServers();
      const pName = dir.split('\\').pop() || '选中工程';
      showToast(`已选中项目 [${pName}]，仅显示此项目下的专属 MCP`, 'success');
    }
  } catch (err) {
    showToast('切换失败: ' + err.message, 'error');
  }
}

async function syncCurrentWorkspace() {
  if (!currentWorkspace) return;
  try {
    const res = await api.syncToAntigravity(currentWorkspace);
    if (res.ok) {
      antigravityProjects = res.projects || antigravityProjects;
      showToast(res.message || '已成功同步至 Antigravity 信任列表', 'success');
      updateWorkspaceUI();
    } else {
      showToast('同步失败: ' + res.error, 'error');
    }
  } catch (err) {
    showToast('同步异常: ' + err.message, 'error');
  }
}

async function initProjectMcp(dir) {
  try {
    const res = await api.initWorkspaceMcp(dir);
    if (res.ok) {
      showToast(res.message || '已初始化 MCP 配置', 'success');
      await refreshProjects(false);
      if (dir.toLowerCase() === currentWorkspace.toLowerCase()) {
        await fetchServers();
      }
    }
  } catch (err) {
    showToast('初始化异常: ' + err.message, 'error');
  }
}

async function openProjectConfigFile(dir) {
  const targetDir = dir || currentWorkspace;
  if (!targetDir) {
    showToast('未选定任何工程工作区', 'error');
    return;
  }
  try {
    const res = await api.openWorkspaceConfigFile(targetDir);
    if (res.ok) {
      const fileName = res.path.split('\\').pop() || 'mcp_config.json';
      showToast(`已在外部代码编辑器中打开: ${fileName}`, 'success');
      await refreshProjects(false);
    } else {
      showToast(`打开失败: ${res.error || res.message || '未知错误'}`, 'error');
    }
  } catch (err) {
    showToast('打开配置文件异常: ' + err.message, 'error');
  }
}

async function chooseWorkspace() {
  if (window.mcpApi && window.mcpApi.selectWorkspaceFolder) {
    try {
      const res = await window.mcpApi.selectWorkspaceFolder();
      if (res.ok && res.activeWorkspace) {
        currentWorkspace = res.activeWorkspace;
        recentWorkspaces = res.recentWorkspaces || [];
        antigravityProjects = res.projects || antigravityProjects;
        updateWorkspaceUI();
        closeModal('modalProjects');
        setScopeFilter('workspace');
        await fetchServers();
        const pName = currentWorkspace.split('\\').pop() || '选定目录';
        showToast(`已选中项目 [${pName}]，仅显示此项目下的专属 MCP`, 'success');
      }
    } catch (e) {
      showToast('切换工作区失败: ' + e.message, 'error');
    }
  }
}

function updateWorkspaceUI() {
  const lblPath = document.getElementById('lblCurrentWorkspace');
  const lblName = document.getElementById('lblWorkspaceName');
  const badgeCount = document.getElementById('badgeWorkspaceMcpCount');
  const syncStatus = document.getElementById('lblSyncStatus');

  const matched = (antigravityProjects || []).find(p => p.path.toLowerCase() === (currentWorkspace || '').toLowerCase());
  const folderName = matched ? matched.name : (currentWorkspace ? currentWorkspace.split('\\').pop() : '未选择');
  
  if (lblName) lblName.innerText = folderName;
  if (lblPath) {
    lblPath.innerText = currentWorkspace || '未选择工作区';
    lblPath.title = currentWorkspace || '';
  }

  if (badgeCount) {
    if (matched && matched.hasMcp) {
      badgeCount.innerText = `${matched.mcpCount} 个服务`;
      badgeCount.className = 'text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-300 font-mono border border-purple-500/20';
    } else {
      badgeCount.innerText = '未配置 MCP';
      badgeCount.className = 'text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 text-win-textTertiary font-mono';
    }
  }

  if (syncStatus) {
    const isAgyTrusted = matched && (matched.source.includes('Antigravity') || matched.source.includes('Trusted'));
    if (isAgyTrusted) {
      syncStatus.innerText = '已同步 AGY';
      syncStatus.className = 'text-emerald-400';
    } else {
      syncStatus.innerText = '+ 同步至 AGY';
      syncStatus.className = 'text-win-accent font-medium hover:underline';
    }
  }

  // Update top context bar
  const barName = document.getElementById('barWorkspaceName');
  const barPath = document.getElementById('barWorkspacePath');
  const barMcp = document.getElementById('barMcpStatus');
  const btnInit = document.getElementById('btnBarInitMcp');

  if (barName) barName.innerText = folderName;
  if (barPath) {
    barPath.innerText = currentWorkspace || '未选择工作区';
    barPath.title = currentWorkspace || '';
  }
  if (barMcp) {
    if (matched && matched.hasMcp) {
      barMcp.innerText = `${matched.mcpCount} 个服务`;
      barMcp.className = 'px-1.5 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-300 font-mono';
      if (btnInit) btnInit.classList.add('hidden');
    } else {
      barMcp.innerText = '未配置独立 MCP';
      barMcp.className = 'px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 font-mono';
      if (btnInit) btnInit.classList.remove('hidden');
    }
  }

  const pillWs = document.getElementById('pillWorkspace');
  if (pillWs) {
    pillWs.innerText = folderName ? `项目专属 (${folderName})` : '项目专属 MCP';
  }

  if (typeof updateFormScopeHint === 'function') updateFormScopeHint();
  if (window.lucide) lucide.createIcons();
}

async function initCurrentWorkspaceMcp() {
  if (!currentWorkspace) return;
  await initProjectMcp(currentWorkspace);
}
