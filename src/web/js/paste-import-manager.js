/**
 * Antigravity MCP Manager - Clipboard MCP Paste & Import Manager
 * Compliant with Rule 7: Single responsibility, helper extraction, all methods <= 80 lines.
 */

let lastPastedParseResult = null;

function populatePasteProjectOptions(selectedDir) {
  const projSelect = document.getElementById('pasteProjectSelect');
  const wsSelect = document.getElementById('pasteTargetWorkspace');
  if (!wsSelect) return;

  const target = (selectedDir || currentWorkspace || '').toLowerCase();
  let list = antigravityProjects || [];

  const exists = list.some(p => p.path.toLowerCase() === target);
  if (!exists && selectedDir) {
    list = [{
      name: selectedDir.split('\\').pop() || '自定义目录',
      path: selectedDir,
      hasMcp: false,
      mcpCount: 0,
      source: '外部选定'
    }, ...list];
  }

  if (projSelect) {
    projSelect.innerHTML = list.map(p => {
      const isSel = p.path.toLowerCase() === target;
      const isCurrent = p.path.toLowerCase() === (currentWorkspace || '').toLowerCase();
      const tag = isCurrent ? ' (当前项目)' : '';
      const mcpInfo = p.hasMcp ? ` [${p.mcpCount}个服务]` : ' [未配MCP]';
      return `<option value="${escapeHtml(p.path)}" ${isSel ? 'selected' : ''}>${escapeHtml(p.name)}${tag} ${mcpInfo}</option>`;
    }).join('');
  }

  wsSelect.innerHTML = list.map(p => {
    const isSel = p.path.toLowerCase() === target;
    return `<option value="${escapeHtml(p.path)}" ${isSel ? 'selected' : ''}>${escapeHtml(p.path)}</option>`;
  }).join('');

  updatePasteScopeHint();
}

function handlePasteProjectSelectChange() {
  const projPath = document.getElementById('pasteProjectSelect')?.value;
  const wsSelect = document.getElementById('pasteTargetWorkspace');
  if (wsSelect && projPath) {
    wsSelect.value = projPath;
  }
  updatePasteScopeHint();
}

function handlePasteWorkspaceChange() {
  const wsPath = document.getElementById('pasteTargetWorkspace')?.value;
  const projSelect = document.getElementById('pasteProjectSelect');
  if (projSelect && wsPath) {
    projSelect.value = wsPath;
  }
  updatePasteScopeHint();
}

function updatePasteScopeHint() {
  const hint = document.getElementById('pasteScopeHint');
  const badge = document.getElementById('pasteWorkspaceMcpBadge');
  const scope = document.getElementById('pasteScope')?.value;
  if (!hint) return;

  if (scope === 'workspace') {
    const targetWs = document.getElementById('pasteTargetWorkspace')?.value || currentWorkspace;
    const matched = (antigravityProjects || []).find(p => p.path.toLowerCase() === (targetWs || '').toLowerCase());
    
    hint.innerText = targetWs ? `写入目标: ${targetWs}\\.agents\\mcp_config.json` : '请选择目标项目工作空间';
    hint.className = 'text-[11px] text-purple-400 font-mono truncate';
    
    if (badge) {
      if (matched && matched.hasMcp) {
        badge.innerText = `${matched.mcpCount} 个已有服务`;
        badge.className = 'px-1.5 py-0.2 rounded bg-purple-500/15 text-purple-300 font-mono shrink-0 ml-2';
      } else {
        badge.innerText = '将新建 .agents 配置';
        badge.className = 'px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 font-mono shrink-0 ml-2';
      }
    }
  } else {
    hint.innerText = '写入目标: ~/.gemini/config/mcp_config.json';
    hint.className = 'text-[11px] text-win-textTertiary font-mono truncate';
    if (badge) badge.innerText = '';
  }
}

async function browseCustomWorkspaceForPaste() {
  if (window.mcpApi && window.mcpApi.selectWorkspaceFolder) {
    try {
      const res = await window.mcpApi.selectWorkspaceFolder();
      if (res.ok && res.activeWorkspace) {
        antigravityProjects = res.projects || antigravityProjects;
        populatePasteProjectOptions(res.activeWorkspace);
        updatePasteScopeHint();
        showToast(`已选定导入目标项目: ${res.activeWorkspace.split('\\').pop()}`, 'success');
      }
    } catch (e) {
      showToast('选择目录失败: ' + e.message, 'error');
    }
  }
}

function setPasteScope(scope) {
  const input = document.getElementById('pasteScope');
  if (input) input.value = scope;

  const btnGlobal = document.getElementById('btnPasteScopeGlobal');
  const btnWs = document.getElementById('btnPasteScopeWorkspace');
  const wsSection = document.getElementById('sectionPasteWorkspaceSelect');

  if (scope === 'workspace') {
    if (btnWs) btnWs.className = 'flex-1 h-full rounded-md text-xs font-semibold flex items-center justify-center space-x-1.5 bg-purple-600 text-white shadow-sm transition';
    if (btnGlobal) btnGlobal.className = 'flex-1 h-full rounded-md text-xs font-medium flex items-center justify-center space-x-1.5 text-win-textSecondary hover:text-white transition';
    if (wsSection) wsSection.classList.remove('hidden');
    populatePasteProjectOptions(currentWorkspace);
  } else {
    if (btnGlobal) btnGlobal.className = 'flex-1 h-full rounded-md text-xs font-semibold flex items-center justify-center space-x-1.5 bg-[#0078d4] text-white shadow-sm transition';
    if (btnWs) btnWs.className = 'flex-1 h-full rounded-md text-xs font-medium flex items-center justify-center space-x-1.5 text-win-textSecondary hover:text-white transition';
    if (wsSection) wsSection.classList.add('hidden');
  }

  updatePasteScopeHint();
  validatePasteServerName();
  if (window.lucide) lucide.createIcons();
}

async function readFromClipboardToModal(showToastNotice = true) {
  const textarea = document.getElementById('pasteJsonInput');
  if (!textarea) return;

  try {
    const text = await api.readClipboard();
    if (text && text.trim().length > 0) {
      textarea.value = text;
      handlePasteJsonChange();
      if (showToastNotice) showToast('已从剪贴板读取内容并完成解析', 'success');
    } else {
      if (showToastNotice) showToast('剪贴板中暂无文本内容，请先复制 MCP 配置或点击“载入示例”', 'info');
      textarea.focus();
    }
  } catch (err) {
    if (showToastNotice) showToast('读取系统剪贴板失败，请手动在此粘贴 (Ctrl+V)', 'error');
    textarea.focus();
  }
}

function loadSampleMcpConfig() {
  const sample = {
    "git": {
      "command": "uvx",
      "args": ["mcp-server-git", "--repository", "."],
      "env": {}
    }
  };
  const textarea = document.getElementById('pasteJsonInput');
  if (textarea) {
    textarea.value = JSON.stringify(sample, null, 2);
    handlePasteJsonChange();
    showToast('已载入常用 Git MCP 服务示例配置', 'info');
  }
}

function clearPasteInput() {
  const textarea = document.getElementById('pasteJsonInput');
  if (textarea) {
    textarea.value = '';
    handlePasteJsonChange();
    textarea.focus();
  }
}

function openPasteModal(initialJson = '') {
  openModal('modalPasteMcp');
  const textarea = document.getElementById('pasteJsonInput');
  const targetScope = currentScopeFilter === 'workspace' ? 'workspace' : 'global';
  setPasteScope(targetScope);

  if (initialJson) {
    textarea.value = initialJson;
    handlePasteJsonChange();
  } else {
    textarea.value = '';
    handlePasteJsonChange();
    readFromClipboardToModal(false);
  }

  setTimeout(() => textarea.focus(), 150);
}

function stripCommentsAndTrailingCommas(str) {
  let cleaned = str.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1');
  return cleaned.replace(/,(\s*[}\]])/g, '$1').trim();
}

function parseMcpJsonString(rawStr) {
  if (!rawStr || !rawStr.trim()) {
    return { ok: false, error: '输入内容为空' };
  }

  const clean = stripCommentsAndTrailingCommas(rawStr);
  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch (err) {
    return { ok: false, error: 'JSON 语法解析失败: ' + err.message };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, error: 'JSON 必须是对象或键值对格式' };
  }

  // Strategy 1: { mcpServers: { ... } }
  if (parsed.mcpServers && typeof parsed.mcpServers === 'object') {
    const keys = Object.keys(parsed.mcpServers);
    if (keys.length === 0) return { ok: false, error: 'mcpServers 对象为空' };
    const firstKey = keys[0];
    return {
      ok: true,
      serverName: firstKey,
      serverConfig: parsed.mcpServers[firstKey],
      allServersMap: parsed.mcpServers,
      mode: 'mcpServers-root'
    };
  }

  // Strategy 2: Single server config without name { command: "...", args: [...] }
  if (parsed.command || (parsed.type === 'http' && parsed.url)) {
    return {
      ok: true,
      serverName: '',
      serverConfig: parsed,
      allServersMap: null,
      mode: 'single-server-config'
    };
  }

  // Strategy 3: Key-value map { "my-server": { command: "..." } }
  const topKeys = Object.keys(parsed);
  if (topKeys.length > 0) {
    const firstKey = topKeys[0];
    const val = parsed[firstKey];
    if (val && typeof val === 'object' && (val.command || val.url || val.type)) {
      return {
        ok: true,
        serverName: firstKey,
        serverConfig: val,
        allServersMap: parsed,
        mode: 'key-value-map'
      };
    }
  }

  return { ok: false, error: '无法识别的 MCP 配置结构。支持 { mcpServers: { ... } } 或单服务对象' };
}

function suggestServerName(config, fallbackKey) {
  if (fallbackKey && fallbackKey.trim()) return fallbackKey.trim();
  if (config.command) {
    const cmdBase = config.command.replace(/\\/g, '/').split('/').pop().replace(/\.exe$/i, '');
    if (config.args && config.args.length > 0) {
      const firstArg = config.args[0];
      if (/^[a-zA-Z0-9_\-]+$/.test(firstArg) && firstArg.length > 2 && firstArg.length < 25) {
        return firstArg;
      }
    }
    return cmdBase || 'mcp-server';
  }
  if (config.url) {
    try {
      const u = new URL(config.url);
      return u.hostname.replace(/\./g, '-') || 'http-mcp';
    } catch {
      return 'http-mcp';
    }
  }
  return 'new-mcp-server';
}

function updatePastePreviewUI(result) {
  const badgeStatus = document.getElementById('pasteStatusBadge');
  const details = document.getElementById('pasteParsedDetails');
  const nameInput = document.getElementById('pasteServerName');
  const btnConfirm = document.getElementById('btnConfirmPasteImport');

  if (!result || !result.ok) {
    lastPastedParseResult = null;
    badgeStatus.innerText = result ? '格式异常' : '等待粘贴';
    badgeStatus.className = 'text-[10px] px-2 py-0.5 rounded-full font-mono bg-white/5 text-win-textTertiary';
    details.innerHTML = `<span class="text-rose-400">${result ? escapeHtml(result.error) : '请在上方粘贴有效 JSON 配置'}</span>`;
    btnConfirm.classList.add('opacity-50', 'cursor-not-allowed');
    btnConfirm.disabled = true;
    return;
  }

  lastPastedParseResult = result;
  badgeStatus.innerText = '解析成功';
  badgeStatus.className = 'text-[10px] px-2 py-0.5 rounded-full font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
  btnConfirm.classList.remove('opacity-50', 'cursor-not-allowed');
  btnConfirm.disabled = false;

  const conf = result.serverConfig || {};
  const isHttp = conf.type === 'http' || Boolean(conf.url);
  const typeText = isHttp ? 'HTTP' : 'Stdio';
  const targetName = suggestServerName(conf, result.serverName);

  if (nameInput && (!nameInput.value || nameInput.value.trim() === '')) {
    nameInput.value = targetName;
  }

  details.innerHTML = `
    <div class="flex items-center space-x-2">
      <span class="text-[10px] px-1.5 py-0.2 rounded ${isHttp ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'} font-mono">${typeText}</span>
      <span class="font-bold text-white">${escapeHtml(isHttp ? conf.url : conf.command)}</span>
    </div>
    <div class="text-[10px] text-win-textTertiary truncate">
      ${conf.args && conf.args.length > 0 ? `参数: [${conf.args.join(', ')}]` : '无额外启动参数'}
    </div>
  `;

  validatePasteServerName();
}

function handlePasteJsonChange() {
  const rawText = document.getElementById('pasteJsonInput')?.value || '';
  if (!rawText.trim()) {
    updatePastePreviewUI(null);
    return;
  }
  const result = parseMcpJsonString(rawText);
  updatePastePreviewUI(result);
}

function validatePasteServerName() {
  const nameInput = document.getElementById('pasteServerName');
  const hint = document.getElementById('pasteNameConflictHint');
  const scope = document.getElementById('pasteScope')?.value;
  const name = (nameInput?.value || '').trim();

  if (!hint) return;

  if (!name) {
    hint.innerText = '* 请输入服务名称';
    hint.className = 'text-[11px] text-rose-400';
    return;
  }

  const conflict = allServers.find(s => s.name.toLowerCase() === name.toLowerCase() && s.scope === scope);
  if (conflict) {
    hint.innerText = `* 同名服务已存在于 [${scope === 'global' ? '全局' : '项目'}]，确认导入将直接覆盖更新配置`;
    hint.className = 'text-[11px] text-amber-300';
  } else {
    hint.innerText = '服务名称可用';
    hint.className = 'text-[11px] text-emerald-400';
  }
}

function buildPastedServerPayload(result, name, scope, targetWs) {
  const conf = result.serverConfig || {};
  const isHttp = conf.type === 'http' || Boolean(conf.url);

  const cleanConfig = {};
  if (isHttp) {
    cleanConfig.type = 'http';
    cleanConfig.url = conf.url || '';
    if (conf.headers && typeof conf.headers === 'object') {
      cleanConfig.headers = conf.headers;
    }
  } else {
    cleanConfig.command = conf.command || '';
    cleanConfig.args = Array.isArray(conf.args) ? conf.args : [];
    if (conf.env && typeof conf.env === 'object') {
      cleanConfig.env = conf.env;
    }
  }

  return {
    name,
    scope,
    workspaceDir: scope === 'workspace' ? targetWs : undefined,
    config: cleanConfig
  };
}

async function executePasteImport() {
  if (!lastPastedParseResult || !lastPastedParseResult.ok) {
    showToast('当前未解析出有效的 MCP 配置，无法导入', 'error');
    return;
  }

  const name = (document.getElementById('pasteServerName')?.value || '').trim();
  if (!name) {
    showToast('请输入 MCP 服务名称', 'error');
    document.getElementById('pasteServerName')?.focus();
    return;
  }

  const scope = document.getElementById('pasteScope')?.value || 'workspace';
  const targetWs = scope === 'workspace' 
    ? (document.getElementById('pasteTargetWorkspace')?.value || currentWorkspace)
    : undefined;

  const payload = buildPastedServerPayload(lastPastedParseResult, name, scope, targetWs);

  try {
    const res = await api.saveServer(payload);
    if (res && res.ok) {
      showToast(`已成功导入 MCP 服务 [${name}] 到 ${scope === 'global' ? '全局' : '项目工作区'}`, 'success');
      closeModal('modalPasteMcp');
      setScopeFilter(scope);
      await fetchServers();
      await refreshProjects(false);
    } else {
      showToast(`导入失败: ${res?.error || '未知错误'}`, 'error');
    }
  } catch (err) {
    showToast('导入异常: ' + err.message, 'error');
  }
}
