/**
 * Antigravity MCP Manager - Server Card Renderer & Tooltip Engine
 * Compliant with Rule 7: Single method <= 80 lines, strict separation of concerns.
 */

function normalizePath(p) {
  if (!p || typeof p !== 'string') return '';
  return p.replace(/[\\\/]+/g, '/').replace(/\/+$/, '').toLowerCase().trim();
}

function getCurrentProjectAssociatedFolders(targetWs) {
  const ws = targetWs || (typeof currentWorkspace !== 'undefined' ? currentWorkspace : '');
  if (!ws) return [];
  const wsNorm = normalizePath(ws);

  const matched = (antigravityProjects || []).find(p => p.path && normalizePath(p.path) === wsNorm);
  if (matched && Array.isArray(matched.associatedFolders) && matched.associatedFolders.length > 0) {
    return matched.associatedFolders.map(normalizePath).filter(Boolean);
  }

  const parentProj = (antigravityProjects || []).find(p =>
    Array.isArray(p.associatedFolders) && p.associatedFolders.some(f => normalizePath(f) === wsNorm)
  );
  if (parentProj && Array.isArray(parentProj.associatedFolders) && parentProj.associatedFolders.length > 0) {
    return parentProj.associatedFolders.map(normalizePath).filter(Boolean);
  }

  return [wsNorm];
}

function isServerBelongToWorkspace(s, targetWorkspaceDir) {
  if (!targetWorkspaceDir) return true;
  const associated = getCurrentProjectAssociatedFolders(targetWorkspaceDir);
  if (associated.length === 0) return true;

  if (s.workspaceDir && associated.includes(normalizePath(s.workspaceDir))) {
    return true;
  }
  if (s.configPath) {
    const fromConfig = normalizePath(s.configPath.replace(/[\\\/]\.agents?[\\\/]mcp_config\.json$/i, ''));
    if (associated.includes(fromConfig)) return true;
  }
  return false;
}


function getServerProjectInfo(s) {
  const isWs = s.scope === 'workspace';
  const isOther = s.scope === 'other';
  let projectName = '';
  let workspacePath = '';
  let configPath = s.configPath || '';
  let scopeBadgeText = '';
  let isCurrent = false;

  if (isWs) {
    if (s.configPath) {
      workspacePath = s.configPath.replace(/[\\\/]\.agents?[\\\/]mcp_config\.json$/i, '');
    }
    if (!workspacePath) workspacePath = s.workspaceDir || currentWorkspace || '';

    const targetWsNorm = normalizePath(workspacePath);
    const matched = (antigravityProjects || []).find(p => p.path && normalizePath(p.path) === targetWsNorm);
    projectName = matched ? matched.name : (workspacePath.split(/[\\\/]/).filter(Boolean).pop() || '专属项目');
    scopeBadgeText = s.disabled ? '工作区专属 (已停用)' : '工作区专属 (Workspace)';
    isCurrent = Boolean(currentWorkspace && targetWsNorm === normalizePath(currentWorkspace));
  } else if (isOther) {
    projectName = '待启用池 (Pool)';
    workspacePath = '本地存储池 (~/.gemini/config)';
    scopeBadgeText = '备用池 (Other)';
  } else {
    projectName = '全局通用 (Global)';
    workspacePath = '全局 Antigravity 环境 (~/.gemini/config)';
    scopeBadgeText = s.disabled ? '全局服务 (已停用)' : '全局服务 (Global)';
  }

  return { isWs, isOther, projectName, workspacePath, configPath, scopeBadgeText, isCurrent };
}

function findServer(name, scope, configPath) {
  if (!name) return null;
  const lowerName = name.toLowerCase();
  if (scope) {
    if (configPath) {
      const exact = allServers.find(s => s.name === name && s.scope === scope && s.configPath && pathResolve(s.configPath) === pathResolve(configPath));
      if (exact) return exact;
    }
    const scoped = allServers.find(s => s.name === name && s.scope === scope);
    if (scoped) return scoped;
    const scopedLower = allServers.find(s => s.name.toLowerCase() === lowerName && s.scope === scope);
    if (scopedLower) return scopedLower;
  }
  return allServers.find(s => s.name === name) || allServers.find(s => s.name.toLowerCase() === lowerName);
}

function updateMcpTooltipContent(info, server) {
  const tipIconBox = document.getElementById('tipIconBox');
  const tipIcon = document.getElementById('tipIcon');
  const tipScopeLabel = document.getElementById('tipScopeLabel');
  const tipScopeBadge = document.getElementById('tipScopeBadge');
  const tipScopeDesc = document.getElementById('tipScopeDesc');

  if (info.isWs) {
    tipIconBox.className = 'w-6 h-6 rounded-md bg-purple-500/20 text-purple-300 flex items-center justify-center shrink-0';
    tipIcon.setAttribute('data-lucide', 'folder-git-2');
    tipScopeLabel.innerText = 'Antigravity 项目工作空间专属';
    tipScopeLabel.className = 'text-[10px] text-purple-400 font-mono truncate';
    tipScopeBadge.className = 'text-[10px] px-1.5 py-0.5 rounded font-mono font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30';
    tipScopeBadge.innerText = 'Workspace';
    tipScopeDesc.innerHTML = `<span class="text-purple-300 font-semibold">项目专属隔离</span>：仅在当前项目工程会话中生效，隔离不干扰其他项目。`;
  } else if (info.isOther) {
    tipIconBox.className = 'w-6 h-6 rounded-md bg-slate-500/20 text-slate-300 flex items-center justify-center shrink-0';
    tipIcon.setAttribute('data-lucide', 'archive');
    tipScopeLabel.innerText = '备用停用存储池';
    tipScopeLabel.className = 'text-[10px] text-slate-400 font-mono truncate';
    tipScopeBadge.className = 'text-[10px] px-1.5 py-0.5 rounded font-mono font-medium bg-white/5 text-win-textSecondary border border-win-border';
    tipScopeBadge.innerText = 'Pool';
    tipScopeDesc.innerHTML = `暂存休眠服务，已隔离不被会话调用，可随时启用。`;
  } else {
    tipIconBox.className = 'w-6 h-6 rounded-md bg-blue-500/20 text-blue-300 flex items-center justify-center shrink-0';
    tipIcon.setAttribute('data-lucide', 'globe');
    tipScopeLabel.innerText = '全局共享基础服务';
    tipScopeLabel.className = 'text-[10px] text-blue-400 font-mono truncate';
    tipScopeBadge.className = 'text-[10px] px-1.5 py-0.5 rounded font-mono font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30';
    tipScopeBadge.innerText = 'Global';
    const curProj = (antigravityProjects || []).find(p => p.path && p.path.toLowerCase() === (currentWorkspace || '').toLowerCase());
    const curName = curProj ? curProj.name : (currentWorkspace ? currentWorkspace.split(/[\\\/]/).filter(Boolean).pop() : '');
    tipScopeDesc.innerHTML = curName
      ? `<span class="text-blue-300 font-semibold">全局共享</span>：在所有项目中通用（在当前项目 [${escapeHtml(curName)}] 中默认继承）。`
      : `<span class="text-blue-300 font-semibold">全局通用</span>：所有 Antigravity 窗口与项目均默认继承可用。`;
  }
}

function handleMcpMouseEnter(e, name, scope, encodedConfigPath) {
  const configPath = encodedConfigPath ? decodeURIComponent(encodedConfigPath) : '';
  const server = findServer(name, scope, configPath);
  if (!server) return;

  const info = getServerProjectInfo(server);
  const tooltip = document.getElementById('mcpGlobalTooltip');
  if (!tooltip) return;

  document.getElementById('tipServerName').innerText = server.name;
  document.getElementById('tipProjectName').innerText = info.projectName;
  document.getElementById('tipWorkspacePath').innerText = info.workspacePath;
  document.getElementById('tipConfigPath').innerText = info.configPath || '未关联文件';

  updateMcpTooltipContent(info, server);

  if (window.lucide) lucide.createIcons();
  updateMcpTooltipPosition(e);

  tooltip.classList.remove('hidden');
  requestAnimationFrame(() => {
    tooltip.classList.remove('opacity-0', 'scale-95');
    tooltip.classList.add('opacity-100', 'scale-100');
  });
}

function updateMcpTooltipPosition(e) {
  const tooltip = document.getElementById('mcpGlobalTooltip');
  if (!tooltip || tooltip.classList.contains('hidden')) return;

  const tipWidth = 330;
  const tipHeight = 160;
  let x = e.clientX + 14;
  let y = e.clientY + 14;

  if (x + tipWidth > window.innerWidth - 14) x = e.clientX - tipWidth - 14;
  if (y + tipHeight > window.innerHeight - 14) y = e.clientY - tipHeight - 14;

  tooltip.style.left = `${Math.max(12, x)}px`;
  tooltip.style.top = `${Math.max(12, y)}px`;
}

function handleMcpMouseLeave() {
  const tooltip = document.getElementById('mcpGlobalTooltip');
  if (!tooltip) return;
  tooltip.classList.add('opacity-0', 'scale-95');
  tooltip.classList.remove('opacity-100', 'scale-100');
  setTimeout(() => {
    if (tooltip.classList.contains('opacity-0')) {
      tooltip.classList.add('hidden');
    }
  }, 150);
}

function renderEmptySearchStateHtml(search) {
  return `
    <div class="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-400 mx-auto flex items-center justify-center mb-3.5 border border-amber-500/20">
      <i data-lucide="search-x" class="w-7 h-7"></i>
    </div>
    <h3 class="text-sm font-bold text-white">未找到名称包含 "<span class="text-win-accent">${escapeHtml(search)}</span>" 的 MCP 服务</h3>
    <p class="text-xs text-win-textSecondary mt-1.5 max-w-md mx-auto">
      当前筛选范围 (${currentScopeFilter === 'workspace' ? '项目专属' : currentScopeFilter === 'global' ? '全局服务' : currentScopeFilter === 'other' ? '停用池' : '全部服务'}) 下无匹配项。
    </p>
    <div class="mt-4 flex items-center justify-center space-x-2.5">
      <button onclick="clearServerSearch()" class="px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-semibold flex items-center space-x-1.5 transition">
        <i data-lucide="x-circle" class="w-3.5 h-3.5"></i>
        <span>清空搜索条件</span>
      </button>
      ${currentScopeFilter !== 'all' ? `
      <button onclick="setScopeFilter('all')" class="px-3 py-1.5 rounded-lg bg-[#0078d4] hover:bg-[#106ebe] text-white text-xs font-medium flex items-center space-x-1.5 transition">
        <i data-lucide="list" class="w-3.5 h-3.5"></i>
        <span>在全部服务中查找</span>
      </button>
      ` : ''}
    </div>
  `;
}

function renderEmptyStateHtml(folderName, search) {
  if (search) {
    return renderEmptySearchStateHtml(search);
  }
  if (currentScopeFilter === 'workspace') {
    return `
      <div class="w-14 h-14 rounded-2xl bg-purple-500/10 text-purple-400 mx-auto flex items-center justify-center mb-3.5 border border-purple-500/20">
        <i data-lucide="folder-git-2" class="w-7 h-7"></i>
      </div>
      <h3 class="text-sm font-bold text-white">项目 [${escapeHtml(folderName)}] 暂无专属配置的 MCP 服务</h3>
      <p class="text-xs text-win-textSecondary mt-1.5 max-w-md mx-auto">
        当前项目尚未在 <span class="font-mono text-purple-300">.agents/mcp_config.json</span> 中定义专属 MCP。<br>
        在 Antigravity 中与该项目对话时将默认继承全局服务。
      </p>
      <div class="mt-4 flex items-center justify-center space-x-2.5">
        <button onclick="openAddServerModal()" class="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition">
          <i data-lucide="plus" class="w-3.5 h-3.5"></i>
          <span>为此项目添加专属 MCP</span>
        </button>
        <button onclick="initCurrentWorkspaceMcp()" class="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-medium flex items-center space-x-1.5 transition">
          <i data-lucide="sparkles" class="w-3.5 h-3.5 text-purple-400"></i>
          <span>初始化配置文件</span>
        </button>
        <button onclick="setScopeFilter('global')" class="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-win-accent text-xs font-medium flex items-center space-x-1.5 transition">
          <i data-lucide="globe" class="w-3.5 h-3.5"></i>
          <span>查看全局服务</span>
        </button>
      </div>
    `;
  }
  if (currentScopeFilter === 'other') {
    return `
      <div class="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 mx-auto flex items-center justify-center mb-3.5 border border-emerald-500/20">
        <i data-lucide="check-circle-2" class="w-7 h-7"></i>
      </div>
      <h3 class="text-sm font-bold text-white">当前停用池为空</h3>
      <p class="text-xs text-win-textSecondary mt-1.5 max-w-md mx-auto">
        当前没有已停用的服务，所有全局和项目专属 MCP 均处于就绪激活状态。<br>
        若需临时停用某个服务，可直接在服务卡片上关闭开关。
      </p>
      <div class="mt-4 flex items-center justify-center space-x-2.5">
        <button onclick="setScopeFilter('all')" class="px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-medium flex items-center space-x-1.5 transition">
          <i data-lucide="list" class="w-3.5 h-3.5"></i>
          <span>查看全部服务</span>
        </button>
      </div>
    `;
  }
  return `
    <div class="w-12 h-12 rounded-full bg-white/5 text-win-textSecondary mx-auto flex items-center justify-center mb-3">
      <i data-lucide="inbox" class="w-6 h-6"></i>
    </div>
    <h3 class="text-sm font-semibold text-slate-200">没有匹配的 MCP 服务</h3>
    <p class="text-xs text-win-textSecondary mt-1">请尝试更换筛选条件，或点击右上角添加新服务。</p>
  `;
}

function getServerCardPingId(s) {
  const pathPart = (s.configPath || s.workspaceDir || '').replace(/[^a-zA-Z0-9]/g, '').slice(-8);
  return `ping-${encodeURIComponent(s.name)}-${s.scope}-${pathPart}`;
}

function highlightSearchKeyword(text, keyword) {
  if (!keyword || !text) return escapeHtml(text || '');
  const raw = String(text);
  const lower = raw.toLowerCase();
  const kw = keyword.toLowerCase().trim();
  if (!kw) return escapeHtml(raw);
  const idx = lower.indexOf(kw);
  if (idx === -1) return escapeHtml(raw);
  const before = escapeHtml(raw.slice(0, idx));
  const matched = escapeHtml(raw.slice(idx, idx + kw.length));
  const after = escapeHtml(raw.slice(idx + kw.length));
  return `${before}<mark class="bg-cyan-500/30 text-cyan-200 px-0.5 rounded font-bold">${matched}</mark>${after}`;
}

function renderCardHeaderHtml(s, isHttp, scopeBadge, typeBadge, searchKeyword) {
  const encName = encodeURIComponent(s.name);
  const encPath = encodeURIComponent(s.configPath || '');
  const displayName = highlightSearchKeyword(s.name, searchKeyword);
  return `
    <div class="flex items-start justify-between mb-2.5">
      <div class="flex items-center space-x-2.5">
        <div class="w-8 h-8 rounded-lg ${isHttp ? 'bg-gradient-to-br from-amber-500/20 to-orange-500/10 text-amber-300 border border-amber-500/25 shadow-sm shadow-amber-500/10' : 'bg-gradient-to-br from-emerald-500/20 to-teal-500/10 text-emerald-300 border border-emerald-500/25 shadow-sm shadow-emerald-500/10'} flex items-center justify-center shrink-0">
          <i data-lucide="${isHttp ? 'globe' : 'terminal'}" class="w-4 h-4"></i>
        </div>
        <div>
          <h4 class="font-bold text-xs text-white group-hover/card:text-win-accent transition truncate max-w-[150px]">${displayName}</h4>
          <div class="flex items-center space-x-1.5 mt-0.5">
            ${scopeBadge}
            ${typeBadge}
          </div>
        </div>
      </div>

      <label class="fluent-switch">
        <input type="checkbox" onchange="toggleServer('${encName}', '${s.scope}', this.checked, '${encPath}')" ${!s.disabled ? 'checked' : ''}>
        <span class="fluent-slider"></span>
      </label>
    </div>
  `;
}

function renderCardFooterHtml(s) {
  const encName = encodeURIComponent(s.name);
  const encPath = encodeURIComponent(s.configPath || '');
  const encScope = encodeURIComponent(s.scope || 'global');
  const pingId = getServerCardPingId(s);
  return `
    <div class="pt-3 mt-3 border-t border-white/5 flex items-center justify-between">
      <div id="${pingId}" class="flex items-center space-x-1.5 text-[11px] ${s.disabled ? 'text-win-textTertiary' : 'text-emerald-400 font-medium'}">
        <span class="w-2 h-2 rounded-full ${s.disabled ? 'bg-slate-600' : 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]'} inline-block"></span>
        <span>${s.disabled ? '已停用' : '就绪'}</span>
      </div>

      <div class="flex items-center space-x-1">
        <button onclick="testConnection('${encName}', '${pingId}')" title="测试连接" class="p-1.5 rounded-lg hover:bg-white/10 text-win-textSecondary hover:text-white transition">
          <i data-lucide="activity" class="w-3.5 h-3.5"></i>
        </button>
        <button onclick="inspectTools('${encName}')" title="探查 Schema" class="p-1.5 rounded-lg hover:bg-white/10 text-win-textSecondary hover:text-emerald-400 transition">
          <i data-lucide="wrench" class="w-3.5 h-3.5"></i>
        </button>
        <button onclick="copyServerConfig('${encName}', '${encScope}', '${encPath}')" title="复制 MCP 配置到剪贴板" class="p-1.5 rounded-lg hover:bg-white/10 text-win-textSecondary hover:text-indigo-400 transition">
          <i data-lucide="copy" class="w-3.5 h-3.5"></i>
        </button>
        <button onclick="cloneServerDirectly('${encName}', '${encScope}', '${encPath}')" title="一键克隆此服务到新配置" class="p-1.5 rounded-lg hover:bg-purple-500/20 text-win-textSecondary hover:text-purple-300 transition">
          <i data-lucide="copy-plus" class="w-3.5 h-3.5"></i>
        </button>
        <button onclick="editServer('${encName}', '${encScope}', '${encPath}')" title="编辑" class="p-1.5 rounded-lg hover:bg-white/10 text-win-textSecondary hover:text-blue-400 transition">
          <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
        </button>
        <button onclick="deleteServer('${encName}', '${encScope}', '${encPath}')" title="删除" class="p-1.5 rounded-lg hover:bg-rose-500/10 text-win-textSecondary hover:text-rose-400 transition">
          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
        </button>
      </div>
    </div>
  `;
}

function renderServerCardHtml(s, info, searchKeyword) {
  const isHttp = s.type === 'http';
  const scopeBadge = s.scope === 'workspace' 
    ? '<span class="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/25 font-mono font-medium">Workspace</span>'
    : s.scope === 'other'
    ? '<span class="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/25 font-mono font-medium">Pool</span>'
    : '<span class="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/25 font-mono font-medium">Global</span>';

  const typeBadge = isHttp
    ? '<span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/25 font-mono font-medium">HTTP</span>'
    : '<span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 font-mono font-medium">Stdio</span>';

  const argsHtml = (s.args || []).length > 0
    ? `<div class="flex flex-wrap gap-1 mt-2">
         ${s.args.slice(0, 3).map(a => `<span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-slate-300 border border-white/5 truncate max-w-[180px]">${escapeHtml(a)}</span>`).join('')}
         ${s.args.length > 3 ? `<span class="text-[10px] text-win-textTertiary self-center">+${s.args.length - 3}</span>` : ''}
       </div>`
    : '';

  return `
    <div class="fluent-card p-4 flex flex-col justify-between transition-all duration-200 cursor-default group/card ${s.disabled ? 'opacity-65 hover:opacity-100' : ''} ${info.isWs ? 'hover:border-purple-500/50 hover:shadow-xl hover:shadow-purple-500/10' : 'hover:border-blue-500/50 hover:shadow-xl hover:shadow-blue-500/10'}"
         onmouseenter="handleMcpMouseEnter(event, '${escapeHtml(s.name)}', '${s.scope}', '${encodeURIComponent(s.configPath || '')}')"
         onmouseleave="handleMcpMouseLeave()"
         onmousemove="updateMcpTooltipPosition(event)"
         title="【${escapeHtml(s.name)}】&#10;所属项目: ${escapeHtml(info.projectName)}&#10;工作空间: ${escapeHtml(info.workspacePath)}&#10;配置文件: ${escapeHtml(info.configPath)}">
      <div>
        ${renderCardHeaderHtml(s, isHttp, scopeBadge, typeBadge, searchKeyword)}

        <div class="bg-[#121216]/90 rounded-lg p-2.5 border border-white/5 shadow-inner mt-2.5 group-hover/card:border-white/10 transition backdrop-blur-sm">
          <p class="text-[11px] font-mono text-slate-200 truncate select-all tracking-tight">${escapeHtml(isHttp ? s.url : s.command)}</p>
          ${argsHtml}
        </div>

        <div class="mt-3 py-1.5 px-2.5 rounded-lg ${info.isWs ? 'bg-gradient-to-r from-purple-950/40 via-purple-900/15 to-transparent border border-purple-500/25 text-purple-200' : 'bg-gradient-to-r from-blue-950/35 via-blue-900/15 to-transparent border border-blue-500/20 text-blue-200'} flex items-center justify-between text-[11px] font-mono">
          <div class="flex items-center space-x-1.5 truncate max-w-[80%]">
            <i data-lucide="${info.isWs ? 'folder-git-2' : 'globe'}" class="w-3.5 h-3.5 ${info.isWs ? 'text-purple-400' : 'text-blue-400'} shrink-0"></i>
            <span class="font-bold text-white truncate" title="项目名: ${escapeHtml(info.projectName)}">${escapeHtml(info.projectName)}</span>
            <span class="text-win-textTertiary text-[10px] truncate max-w-[130px]" title="工作空间: ${escapeHtml(info.workspacePath)}">(${escapeHtml(info.workspacePath)})</span>
          </div>
          <span class="text-[10px] shrink-0 font-sans opacity-85 px-1.5 py-0.2 rounded bg-white/5 border border-white/5">${escapeHtml(info.scopeBadgeText.split(' ')[0])}</span>
        </div>
      </div>

      ${renderCardFooterHtml(s)}
    </div>
  `;
}

function filterServersList(servers, search, filterScope) {
  const normSearch = (search || '').toLowerCase().trim();
  const filtered = servers.filter(s => {
    if (filterScope === 'other') {
      if (!s.disabled && s.scope !== 'other') return false;
    } else if (filterScope === 'workspace') {
      if (s.scope !== 'workspace') return false;
      if (currentWorkspace && !isServerBelongToWorkspace(s, currentWorkspace)) return false;
    } else if (filterScope === 'global') {
      if (s.scope !== 'global') return false;
    }

    if (normSearch) {
      const matchName = s.name && s.name.toLowerCase().includes(normSearch);
      const matchCmd = (s.command || '').toLowerCase().includes(normSearch);
      const matchUrl = (s.url || '').toLowerCase().includes(normSearch);
      const matchArgs = (s.args || []).join(' ').toLowerCase().includes(normSearch);
      if (!matchName && !matchCmd && !matchUrl && !matchArgs) return false;
    }
    return true;
  });

  if (normSearch) {
    filtered.sort((a, b) => {
      const aName = a.name && a.name.toLowerCase().includes(normSearch);
      const bName = b.name && b.name.toLowerCase().includes(normSearch);
      if (aName && !bName) return -1;
      if (!aName && bName) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });
  }

  return filtered;
}

let currentViewMode = localStorage.getItem('mcp_view_mode') || 'layered';
const collapsedGroups = new Set();

function setViewMode(mode) {
  currentViewMode = mode === 'grid' ? 'grid' : 'layered';
  localStorage.setItem('mcp_view_mode', currentViewMode);
  updateViewModeUI();
  renderServers();
}

function updateViewModeUI() {
  const btnLayered = document.getElementById('btnViewLayered');
  const btnGrid = document.getElementById('btnViewGrid');
  if (btnLayered) {
    if (currentViewMode === 'layered') {
      btnLayered.className = 'px-2.5 py-1 rounded-md font-semibold text-white bg-white/10 shadow-sm transition flex items-center space-x-1.5 border border-white/10';
    } else {
      btnLayered.className = 'px-2.5 py-1 rounded-md font-medium text-win-textSecondary hover:text-white transition flex items-center space-x-1.5';
    }
  }
  if (btnGrid) {
    if (currentViewMode === 'grid') {
      btnGrid.className = 'px-2.5 py-1 rounded-md font-semibold text-white bg-white/10 shadow-sm transition flex items-center space-x-1.5 border border-white/10';
    } else {
      btnGrid.className = 'px-2.5 py-1 rounded-md font-medium text-win-textSecondary hover:text-white transition flex items-center space-x-1.5';
    }
  }
}

function toggleGroupCollapse(groupId) {
  if (collapsedGroups.has(groupId)) {
    collapsedGroups.delete(groupId);
  } else {
    collapsedGroups.add(groupId);
  }
  renderServers();
}

function categorizeServersForGrouping(servers) {
  const globalServers = [];
  const otherServers = [];
  const wsMap = new Map();
  const currentAssociated = getCurrentProjectAssociatedFolders();

  for (const s of servers) {
    if (s.scope === 'global') {
      globalServers.push(s);
    } else if (s.scope === 'other') {
      otherServers.push(s);
    } else {
      const info = getServerProjectInfo(s);
      const wsPath = (info.workspacePath || s.workspaceDir || currentWorkspace || '专属项目').trim();
      const wsKey = normalizePath(wsPath);
      if (!wsMap.has(wsKey)) {
        const isCur = Boolean(currentWorkspace && wsKey === normalizePath(currentWorkspace));
        const isMember = Boolean(!isCur && currentAssociated.includes(wsKey));
        wsMap.set(wsKey, {
          id: 'ws-' + encodeURIComponent(wsKey).replace(/[^a-zA-Z0-9]/g, '_'),
          type: 'workspace',
          workspaceDir: wsPath,
          projectName: info.projectName || s.workspaceName || wsPath.split(/[\\\/]/).filter(Boolean).pop() || '专属项目',
          isCurrent: isCur,
          isProjectMember: isMember,
          configPath: s.configPath || '',
          servers: []
        });
      }
      wsMap.get(wsKey).servers.push(s);
    }
  }
  return { globalServers, otherServers, wsMap };
}

function ensureActiveWorkspaceInMap(wsMap) {
  if (!currentWorkspace) return;
  if (currentScopeFilter !== 'all' && currentScopeFilter !== 'workspace') return;

  const curNorm = normalizePath(currentWorkspace);
  const matchedCur = (antigravityProjects || []).find(p => p.path && normalizePath(p.path) === curNorm);
  const folderList = (matchedCur && Array.isArray(matchedCur.associatedFolders) && matchedCur.associatedFolders.length > 0)
    ? matchedCur.associatedFolders
    : [currentWorkspace];

  for (const folderPath of folderList) {
    const fNorm = normalizePath(folderPath);
    if (!wsMap.has(fNorm)) {
      const folderProj = (antigravityProjects || []).find(p => p.path && normalizePath(p.path) === fNorm);
      const isCur = Boolean(fNorm === curNorm);
      const name = folderProj ? folderProj.name : (folderPath.split(/[\\\/]/).filter(Boolean).pop() || '专属项目');
      wsMap.set(fNorm, {
        id: 'ws-' + encodeURIComponent(fNorm).replace(/[^a-zA-Z0-9]/g, '_'),
        type: 'workspace',
        workspaceDir: folderPath,
        projectName: name,
        isCurrent: isCur,
        isProjectMember: !isCur,
        configPath: folderProj?.configPath || '',
        servers: []
      });
    }
  }
}

function groupServersByWorkspace(servers) {
  const { globalServers, otherServers, wsMap } = categorizeServersForGrouping(servers);
  ensureActiveWorkspaceInMap(wsMap);

  const groups = [];
  if (globalServers.length > 0) {
    groups.push({
      id: 'group-global',
      type: 'global',
      title: '全局通用服务 (Global MCP)',
      subtitle: '全局配置 (~/.gemini/config) · 所有 Antigravity 项目默认继承',
      servers: globalServers
    });
  }

  const wsList = Array.from(wsMap.values()).sort((a, b) => {
    if (a.isCurrent && !b.isCurrent) return -1;
    if (!a.isCurrent && b.isCurrent) return 1;
    if (a.isProjectMember && !b.isProjectMember) return -1;
    if (!a.isProjectMember && b.isProjectMember) return 1;
    return a.projectName.localeCompare(b.projectName, 'zh');
  });

  for (const ws of wsList) {
    const prefix = ws.isCurrent ? '当前工作文件夹' : (ws.isProjectMember ? '项目工作文件夹' : '项目专属');
    groups.push({
      id: `group-${ws.id}`,
      type: 'workspace',
      title: `${prefix}: ${ws.projectName}`,
      subtitle: ws.workspaceDir,
      workspaceDir: ws.workspaceDir,
      configPath: ws.configPath,
      isCurrent: ws.isCurrent,
      isProjectMember: ws.isProjectMember,
      servers: ws.servers
    });
  }

  if (otherServers.length > 0) {
    groups.push({
      id: 'group-other',
      type: 'other',
      title: '备用停用池 (Pool)',
      subtitle: '暂存休眠服务 · 已从运行环境卸载隔离，不占用资源',
      servers: otherServers
    });
  }
  return groups;
}

function renderWorkspaceGroupHeaderHtml(g, isCollapsed) {
  const encWs = encodeURIComponent(g.workspaceDir || '');
  const countBadge = `<span class="text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${g.type === 'global' ? 'bg-blue-500/15 text-blue-300 border border-blue-500/25' : g.isCurrent ? 'bg-purple-500/20 text-purple-200 border border-purple-500/35' : g.type === 'other' ? 'bg-rose-500/15 text-rose-300 border border-rose-500/25' : 'bg-slate-500/15 text-slate-300 border border-white/10'}">${g.servers.length} 个服务</span>`;

  let actionsHtml = '';
  if (g.type === 'global') {
    actionsHtml = `
      <button onclick="openAddServerModal()" class="px-2.5 py-1 rounded-md bg-blue-600/30 hover:bg-blue-600 text-blue-200 hover:text-white text-[11px] font-semibold flex items-center space-x-1 border border-blue-500/30 transition shadow-sm">
        <i data-lucide="plus" class="w-3 h-3"></i>
        <span>添加全局服务</span>
      </button>
    `;
  } else if (g.type === 'workspace') {
    const switchBtn = !g.isCurrent ? `
      <button onclick="switchWorkspaceTo(decodeURIComponent('${encWs}'))" title="切换为此项目并过滤" class="px-2 py-1 rounded-md bg-white/5 hover:bg-win-accent hover:text-black text-slate-300 text-[11px] font-medium flex items-center space-x-1 border border-white/10 transition">
        <i data-lucide="arrow-left-right" class="w-3 h-3 text-win-accent"></i>
        <span>切换为此项目</span>
      </button>
    ` : '';
    actionsHtml = `
      ${switchBtn}
      <button onclick="openProjectConfigFile(decodeURIComponent('${encWs}'))" title="打开此项目配置文件" class="px-2 py-1 rounded-md bg-white/5 hover:bg-white/15 text-purple-300 hover:text-white text-[11px] font-medium flex items-center space-x-1 border border-white/5 transition">
        <i data-lucide="file-code" class="w-3 h-3 text-purple-400"></i>
        <span>打开配置</span>
      </button>
      <button onclick="openAddServerModal(decodeURIComponent('${encWs}'))" title="为此项目添加专属服务" class="px-2.5 py-1 rounded-md bg-purple-600/30 hover:bg-purple-600 text-purple-200 hover:text-white text-[11px] font-semibold flex items-center space-x-1 border border-purple-500/30 transition shadow-sm">
        <i data-lucide="plus" class="w-3 h-3"></i>
        <span>添加服务</span>
      </button>
    `;
  }

  const iconName = g.type === 'global' ? 'globe' : g.type === 'other' ? 'archive' : 'folder-git-2';
  const iconColor = g.type === 'global' ? 'text-blue-400 bg-blue-500/15 border-blue-500/25' : g.isCurrent ? 'text-purple-300 bg-purple-500/20 border-purple-500/35 ring-1 ring-purple-500/30' : g.type === 'other' ? 'text-rose-400 bg-rose-500/15 border-rose-500/25' : 'text-slate-300 bg-white/5 border-white/10';
  const memberBadge = g.isCurrent 
    ? '<span class="text-[9px] px-1.5 py-0.2 rounded font-semibold bg-purple-500/25 text-purple-300 border border-purple-500/30">当前激活</span>' 
    : (g.isProjectMember 
        ? '<span class="text-[9px] px-1.5 py-0.2 rounded font-semibold bg-indigo-500/25 text-indigo-300 border border-indigo-500/30">项目成员文件夹</span>' 
        : '');

  return `
    <div class="flex items-center justify-between p-3 rounded-xl ${g.isCurrent ? 'bg-[#221a30]/85 border border-purple-500/40 shadow-sm' : 'bg-[#18181d]/85 border border-white/5'} backdrop-blur-md">
      <div class="flex items-center space-x-3 min-w-0 cursor-pointer select-none" onclick="toggleGroupCollapse('${g.id}')">
        <div class="w-7 h-7 rounded-lg border ${iconColor} flex items-center justify-center shrink-0">
          <i data-lucide="${iconName}" class="w-3.5 h-3.5"></i>
        </div>
        <div class="min-w-0">
          <div class="flex items-center space-x-2">
            <h3 class="text-xs font-bold ${g.isCurrent ? 'text-purple-200' : 'text-white'} truncate">${escapeHtml(g.title)}</h3>
            ${memberBadge}
            ${countBadge}
          </div>
          <p class="text-[10px] font-mono text-win-textTertiary truncate mt-0.5" title="${escapeHtml(g.subtitle)}">${escapeHtml(g.subtitle)}</p>
        </div>
      </div>
      <div class="flex items-center space-x-2 shrink-0">
        ${actionsHtml}
        <button onclick="toggleGroupCollapse('${g.id}')" title="${isCollapsed ? '展开此分组' : '折叠此分组'}" class="p-1 rounded-md hover:bg-white/10 text-win-textSecondary hover:text-white transition">
          <i data-lucide="${isCollapsed ? 'chevron-down' : 'chevron-up'}" class="w-4 h-4"></i>
        </button>
      </div>
    </div>
  `;
}

function renderWorkspaceGroupHtml(g, searchKeyword) {
  const isCollapsed = collapsedGroups.has(g.id);
  const headerHtml = renderWorkspaceGroupHeaderHtml(g, isCollapsed);
  let cardsHtml = '';
  if (!isCollapsed) {
    if (g.servers && g.servers.length > 0) {
      cardsHtml = `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-2">
          ${g.servers.map(s => {
            const info = getServerProjectInfo(s);
            return renderServerCardHtml(s, info, searchKeyword);
          }).join('')}
        </div>
      `;
    } else {
      cardsHtml = `
        <div class="p-4 bg-white/5 rounded-xl border border-dashed border-white/10 text-center text-xs text-win-textSecondary mt-2">
          当前项目尚未配置专属 MCP 服务。点击右侧“<span class="text-purple-300 font-semibold">+ 添加服务</span>”为此项目创建专属工具。
        </div>
      `;
    }
  }
  return `
    <div id="${g.id}" class="workspace-layer-group space-y-1">
      ${headerHtml}
      ${cardsHtml}
    </div>
  `;
}

function getCurrentSearchQuery() {
  const mainInput = document.getElementById('serverSearchInput');
  const sideInput = document.getElementById('searchInput');
  return (mainInput?.value || sideInput?.value || '').trim();
}

function updateSearchUI(search, matchCount) {
  const badge = document.getElementById('searchResultBadge');
  const btnClear = document.getElementById('btnClearServerSearch');
  if (badge) {
    if (search) {
      badge.innerText = `匹配到 ${matchCount} 个服务`;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }
  if (btnClear) {
    if (search) btnClear.classList.remove('hidden');
    else btnClear.classList.add('hidden');
  }
}

function handleServerSearch(query) {
  const q = query || '';
  const mainInput = document.getElementById('serverSearchInput');
  const sideInput = document.getElementById('searchInput');

  if (mainInput && mainInput.value !== q) mainInput.value = q;
  if (sideInput && sideInput.value !== q) sideInput.value = q;

  renderServers();
}

function clearServerSearch() {
  const mainInput = document.getElementById('serverSearchInput');
  const sideInput = document.getElementById('searchInput');

  if (mainInput) mainInput.value = '';
  if (sideInput) sideInput.value = '';

  renderServers();
  if (mainInput) mainInput.focus();
}

function renderServers() {
  const container = document.getElementById('serversContainer');
  const empty = document.getElementById('emptyState');
  if (!container || !empty) return;

  const search = getCurrentSearchQuery();
  const filtered = filterServersList(allServers, search, currentScopeFilter);
  updateSearchUI(search, filtered.length);

  if (filtered.length === 0) {
    container.innerHTML = '';
    empty.classList.remove('hidden');
    const matched = (antigravityProjects || []).find(p => p.path && p.path.toLowerCase() === (currentWorkspace || '').toLowerCase());
    const folderName = matched ? matched.name : (currentWorkspace ? currentWorkspace.split(/[\\\/]/).filter(Boolean).pop() : '选定项目');
    empty.innerHTML = renderEmptyStateHtml(folderName, search);
    if (window.lucide) lucide.createIcons();
    return;
  }

  empty.classList.add('hidden');

  if (currentViewMode === 'grid') {
    container.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5';
    container.innerHTML = filtered.map(s => {
      const info = getServerProjectInfo(s);
      return renderServerCardHtml(s, info, search);
    }).join('');
  } else {
    container.className = 'space-y-6 flex flex-col';
    const groups = groupServersByWorkspace(filtered);
    container.innerHTML = groups.map(g => renderWorkspaceGroupHtml(g, search)).join('');
  }

  if (window.lucide) lucide.createIcons();
}

async function toggleServer(name, scope, enabled, encodedConfigPath) {
  let configPath = '';
  try {
    if (encodedConfigPath) configPath = decodeURIComponent(encodedConfigPath);
  } catch {}

  try {
    const data = await api.toggleServer(name, scope, enabled, configPath);
    if (data.ok) {
      showToast(`已${enabled ? '启用' : '禁用'}服务: ${name}`, 'success');
      fetchServers();
    } else {
      showToast('切换失败: ' + data.error, 'error');
      fetchServers();
    }
  } catch (err) {
    showToast('调用异常: ' + err.message, 'error');
  }
}

async function testConnection(nameInput, pingIdInput) {
  let name = nameInput;
  try {
    if (typeof nameInput === 'string' && nameInput.includes('%')) name = decodeURIComponent(nameInput);
  } catch {}

  const pingEl = (pingIdInput ? document.getElementById(pingIdInput) : null) || document.getElementById(`ping-${name}`);
  if (pingEl) {
    pingEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse inline-block"></span><span class="text-amber-400 font-mono text-[10px]">测试握手中...</span>`;
  }
  showToast(`正在测试服务连接: ${name}...`, 'info');
  try {
    const res = await api.testServer(name);
    if (res.ok) {
      if (pingEl) pingEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)] inline-block"></span><span class="text-emerald-400 font-mono font-medium">${res.latencyMs || 0}ms 正常</span>`;
      showToast(`[${name}] 连接成功 (${res.latencyMs || 0}ms)`, 'success');
    } else {
      if (pingEl) pingEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-rose-500 inline-block"></span><span class="text-rose-400 font-mono">失败</span>`;
      showToast(`[${name}] 测试失败: ${res.message || '未知错误'}`, 'error');
    }
  } catch (err) {
    if (pingEl) pingEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-rose-500 inline-block"></span><span class="text-rose-400 font-mono">异常</span>`;
    showToast('测试异常: ' + err.message, 'error');
  }
}

async function inspectTools(nameInput) {
  let name = nameInput;
  try {
    if (typeof nameInput === 'string' && nameInput.includes('%')) name = decodeURIComponent(nameInput);
  } catch {}

  openModal('modalTools');
  const title = document.getElementById('modalToolsTitle');
  const subtitle = document.getElementById('modalToolsSubtitle');
  const container = document.getElementById('toolsContent');

  if (title) title.innerText = `工具 Schema: ${name}`;
  if (subtitle) subtitle.innerText = '从 Antigravity 缓存中提取已注册的工具与参数';
  if (container) container.innerHTML = '<div class="text-center py-6 text-win-textSecondary text-xs">正在读取工具定义...</div>';

  try {
    const res = await api.getTools(name);
    const tools = res.tools || [];
    if (tools.length === 0) {
      container.innerHTML = `<div class="p-6 text-center text-win-textSecondary text-xs">该服务尚未缓存工具列表，或未在 Antigravity 启动调用过。</div>`;
      return;
    }

    container.innerHTML = tools.map(t => `
      <div class="fluent-card p-3 space-y-1.5">
        <div class="flex items-center justify-between">
          <span class="font-mono font-bold text-win-accent text-xs">${escapeHtml(t.name)}</span>
          <span class="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-win-textSecondary font-mono">Tool</span>
        </div>
        <p class="text-xs text-slate-300">${escapeHtml(t.description || '无详细描述')}</p>
        ${t.inputSchema ? `<pre class="mt-2 p-2 bg-[#161616] rounded border border-white/5 text-[10px] font-mono text-slate-300 overflow-x-auto">${escapeHtml(JSON.stringify(t.inputSchema, null, 2))}</pre>` : ''}
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `<div class="p-4 text-center text-rose-400 text-xs">读取失败: ${escapeHtml(err.message)}</div>`;
  }
}

async function deleteServer(nameInput, scopeInput, encodedConfigPath) {
  let name = nameInput;
  let scope = scopeInput;
  let configPath = '';
  try {
    if (typeof nameInput === 'string' && nameInput.includes('%')) name = decodeURIComponent(nameInput);
    if (typeof scopeInput === 'string' && scopeInput.includes('%')) scope = decodeURIComponent(scopeInput);
    if (encodedConfigPath) configPath = decodeURIComponent(encodedConfigPath);
  } catch {}

  if (!confirm(`确定要彻底删除 MCP 服务 "${name}" 吗？此操作不可恢复。`)) return;
  try {
    const data = await api.deleteServer(name, scope, configPath);
    if (data.ok) {
      showToast(`已删除服务: ${name}`, 'success');
      fetchServers();
    } else {
      showToast('删除失败: ' + data.error, 'error');
    }
  } catch (err) {
    showToast('删除异常: ' + err.message, 'error');
  }
}

async function copyServerConfig(nameInput, scopeInput, encodedConfigPath) {
  let name = nameInput;
  let scope = scopeInput;
  try {
    if (typeof nameInput === 'string' && nameInput.includes('%')) name = decodeURIComponent(nameInput);
    if (typeof scopeInput === 'string' && scopeInput.includes('%')) scope = decodeURIComponent(scopeInput);
  } catch {}

  const configPath = encodedConfigPath ? decodeURIComponent(encodedConfigPath) : '';
  const server = findServer(name, scope, configPath);
  if (!server) {
    showToast(`未找到服务 [${name}]`, 'error');
    return;
  }

  const exportObj = {};
  if (server.type === 'http') {
    exportObj[server.name] = {
      type: 'http',
      url: server.url || '',
      headers: server.headers || {}
    };
  } else {
    exportObj[server.name] = {
      command: server.command || '',
      args: server.args || [],
      env: server.env || {}
    };
  }

  const jsonStr = JSON.stringify(exportObj, null, 2);
  const success = await api.writeClipboard(jsonStr);
  if (success) {
    showToast(`已复制 [${server.name}] 的标准 MCP 配置`, 'success');
  } else {
    showToast('写入剪贴板失败，请检查系统权限', 'error');
  }
}

function cloneServerDirectly(nameInput, scopeInput, encodedConfigPath) {
  let name = nameInput;
  let scope = scopeInput;
  try {
    if (typeof nameInput === 'string' && nameInput.includes('%')) name = decodeURIComponent(nameInput);
    if (typeof scopeInput === 'string' && scopeInput.includes('%')) scope = decodeURIComponent(scopeInput);
  } catch {}

  const configPath = encodedConfigPath ? decodeURIComponent(encodedConfigPath) : '';
  const server = findServer(name, scope, configPath);
  if (!server) {
    showToast(`未找到服务 [${name}]`, 'error');
    return;
  }

  let copyName = `${server.name}-copy`;
  let counter = 2;
  while (allServers.some(s => s.name === copyName)) {
    copyName = `${server.name}-copy-${counter++}`;
  }

  const rawConfig = server.type === 'http'
    ? { type: 'http', url: server.url || '', headers: server.headers || {} }
    : { command: server.command || '', args: server.args || [], env: server.env || {} };

  const snippet = {};
  snippet[copyName] = rawConfig;
  const jsonText = JSON.stringify(snippet, null, 2);

  openPasteModal(jsonText);
  showToast(`已载入服务 [${server.name}] 的克隆模板，新名称: ${copyName}`, 'info');
}
