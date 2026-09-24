/**
 * Antigravity MCP Manager - Server Card Renderer & Tooltip Engine
 * Compliant with Rule 7: Single method <= 80 lines, strict separation of concerns.
 */

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
    if (!workspacePath) workspacePath = currentWorkspace || '';

    const matched = (antigravityProjects || []).find(p => p.path && p.path.toLowerCase() === workspacePath.toLowerCase());
    projectName = matched ? matched.name : (workspacePath.split(/[\\\/]/).filter(Boolean).pop() || '专属项目');
    scopeBadgeText = s.disabled ? '工作区专属 (已停用)' : '工作区专属 (Workspace)';
    isCurrent = currentWorkspace && (workspacePath.toLowerCase() === currentWorkspace.toLowerCase());
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
  if (scope) {
    if (configPath) {
      const exact = allServers.find(s => s.name === name && s.scope === scope && s.configPath && pathResolve(s.configPath) === pathResolve(configPath));
      if (exact) return exact;
    }
    const scoped = allServers.find(s => s.name === name && s.scope === scope);
    if (scoped) return scoped;
  }
  return allServers.find(s => s.name === name);
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

function renderEmptyStateHtml(folderName) {
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

function renderCardHeaderHtml(s, isHttp, scopeBadge, typeBadge) {
  return `
    <div class="flex items-start justify-between mb-2.5">
      <div class="flex items-center space-x-2.5">
        <div class="w-8 h-8 rounded-lg ${isHttp ? 'bg-gradient-to-br from-amber-500/20 to-orange-500/10 text-amber-300 border border-amber-500/25 shadow-sm shadow-amber-500/10' : 'bg-gradient-to-br from-emerald-500/20 to-teal-500/10 text-emerald-300 border border-emerald-500/25 shadow-sm shadow-emerald-500/10'} flex items-center justify-center shrink-0">
          <i data-lucide="${isHttp ? 'globe' : 'terminal'}" class="w-4 h-4"></i>
        </div>
        <div>
          <h4 class="font-bold text-xs text-white group-hover/card:text-win-accent transition truncate max-w-[150px]">${escapeHtml(s.name)}</h4>
          <div class="flex items-center space-x-1.5 mt-0.5">
            ${scopeBadge}
            ${typeBadge}
          </div>
        </div>
      </div>

      <label class="fluent-switch">
        <input type="checkbox" onchange="toggleServer('${s.name}', '${s.scope}', this.checked)" ${!s.disabled ? 'checked' : ''}>
        <span class="fluent-slider"></span>
      </label>
    </div>
  `;
}

function renderCardFooterHtml(s) {
  return `
    <div class="pt-3 mt-3 border-t border-white/5 flex items-center justify-between">
      <div id="ping-${s.name}" class="flex items-center space-x-1.5 text-[11px] ${s.disabled ? 'text-win-textTertiary' : 'text-emerald-400 font-medium'}">
        <span class="w-2 h-2 rounded-full ${s.disabled ? 'bg-slate-600' : 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]'} inline-block"></span>
        <span>${s.disabled ? '已停用' : '就绪'}</span>
      </div>

      <div class="flex items-center space-x-1">
        <button onclick="testConnection('${s.name}')" title="测试连接" class="p-1.5 rounded-lg hover:bg-white/10 text-win-textSecondary hover:text-white transition">
          <i data-lucide="activity" class="w-3.5 h-3.5"></i>
        </button>
        <button onclick="inspectTools('${s.name}')" title="探查 Schema" class="p-1.5 rounded-lg hover:bg-white/10 text-win-textSecondary hover:text-emerald-400 transition">
          <i data-lucide="wrench" class="w-3.5 h-3.5"></i>
        </button>
        <button onclick="copyServerConfig('${escapeHtml(s.name)}', '${s.scope}', '${encodeURIComponent(s.configPath || '')}')" title="复制 MCP 配置到剪贴板" class="p-1.5 rounded-lg hover:bg-white/10 text-win-textSecondary hover:text-indigo-400 transition">
          <i data-lucide="copy" class="w-3.5 h-3.5"></i>
        </button>
        <button onclick="cloneServerDirectly('${escapeHtml(s.name)}', '${s.scope}', '${encodeURIComponent(s.configPath || '')}')" title="一键克隆此服务到新配置" class="p-1.5 rounded-lg hover:bg-purple-500/20 text-win-textSecondary hover:text-purple-300 transition">
          <i data-lucide="copy-plus" class="w-3.5 h-3.5"></i>
        </button>
        <button onclick="editServer('${escapeHtml(s.name)}', '${s.scope}', '${encodeURIComponent(s.configPath || '')}')" title="编辑" class="p-1.5 rounded-lg hover:bg-white/10 text-win-textSecondary hover:text-blue-400 transition">
          <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
        </button>
        <button onclick="deleteServer('${s.name}', '${s.scope}')" title="删除" class="p-1.5 rounded-lg hover:bg-rose-500/10 text-win-textSecondary hover:text-rose-400 transition">
          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
        </button>
      </div>
    </div>
  `;
}

function renderServerCardHtml(s, info) {
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
        ${renderCardHeaderHtml(s, isHttp, scopeBadge, typeBadge)}

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
  return servers.filter(s => {
    if (filterScope === 'other') {
      if (!s.disabled && s.scope !== 'other') return false;
    } else if (filterScope === 'workspace') {
      if (s.scope !== 'workspace') return false;
    } else if (filterScope === 'global') {
      if (s.scope !== 'global') return false;
    }

    if (search) {
      const matchName = s.name.toLowerCase().includes(search);
      const matchCmd = (s.command || '').toLowerCase().includes(search);
      const matchUrl = (s.url || '').toLowerCase().includes(search);
      const matchArgs = (s.args || []).join(' ').toLowerCase().includes(search);
      if (!matchName && !matchCmd && !matchUrl && !matchArgs) return false;
    }
    return true;
  });
}

function renderServers() {
  const container = document.getElementById('serversContainer');
  const empty = document.getElementById('emptyState');
  const search = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();

  const filtered = filterServersList(allServers, search, currentScopeFilter);

  if (filtered.length === 0) {
    container.innerHTML = '';
    empty.classList.remove('hidden');
    const matched = (antigravityProjects || []).find(p => p.path.toLowerCase() === (currentWorkspace || '').toLowerCase());
    const folderName = matched ? matched.name : (currentWorkspace ? currentWorkspace.split('\\').pop() : '选定项目');
    empty.innerHTML = renderEmptyStateHtml(folderName);
    if (window.lucide) lucide.createIcons();
    return;
  }

  empty.classList.add('hidden');
  container.innerHTML = filtered.map(s => {
    const info = getServerProjectInfo(s);
    return renderServerCardHtml(s, info);
  }).join('');

  if (window.lucide) lucide.createIcons();
}

async function toggleServer(name, scope, enabled) {
  try {
    const data = await api.toggleServer(name, scope, enabled);
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

async function testConnection(name) {
  const pingEl = document.getElementById(`ping-${name}`);
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

async function inspectTools(name) {
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

async function deleteServer(name, scope) {
  if (!confirm(`确定要彻底删除 MCP 服务 "${name}" 吗？此操作不可恢复。`)) return;
  try {
    const data = await api.deleteServer(name, scope);
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

async function copyServerConfig(name, scope, encodedConfigPath) {
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

function cloneServerDirectly(name, scope, encodedConfigPath) {
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
