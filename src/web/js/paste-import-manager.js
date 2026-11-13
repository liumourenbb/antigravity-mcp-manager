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
  validatePasteServerName();
}

function handlePasteWorkspaceChange() {
  const wsPath = document.getElementById('pasteTargetWorkspace')?.value;
  const projSelect = document.getElementById('pasteProjectSelect');
  if (projSelect && wsPath) {
    projSelect.value = wsPath;
  }
  updatePasteScopeHint();
  validatePasteServerName();
}

function updatePasteScopeHint() {
  const hint = document.getElementById('pasteScopeHint');
  const badge = document.getElementById('pasteWorkspaceMcpBadge');
  const scope = getPasteScopeValue();
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
        validatePasteServerName();
        showToast(`已选定导入目标项目: ${res.activeWorkspace.split('\\').pop()}`, 'success');
      }
    } catch (e) {
      showToast('选择目录失败: ' + e.message, 'error');
    }
  }
}

function getPasteScopeValue() {
  const input = document.getElementById('pasteScope') || document.getElementById('pasteTargetScope');
  return input?.value || 'workspace';
}

function setPasteScope(scope, preferWorkspaceDir) {
  const input1 = document.getElementById('pasteScope');
  const input2 = document.getElementById('pasteTargetScope');
  if (input1) input1.value = scope;
  if (input2) input2.value = scope;

  const btnGlobal = document.getElementById('btnPasteScopeGlobal');
  const btnWs = document.getElementById('btnPasteScopeWorkspace');
  const wsSection = document.getElementById('pasteWorkspaceRow') || document.getElementById('sectionPasteWorkspaceSelect');

  if (scope === 'workspace') {
    if (btnWs) btnWs.className = 'flex-1 h-full rounded text-[11px] font-semibold flex items-center justify-center space-x-1 bg-purple-600 text-white shadow-sm transition';
    if (btnGlobal) btnGlobal.className = 'flex-1 h-full rounded text-[11px] font-medium flex items-center justify-center space-x-1 text-win-textSecondary hover:text-white transition';
    if (wsSection) wsSection.classList.remove('hidden');
    populatePasteProjectOptions(preferWorkspaceDir || currentWorkspace);
  } else {
    if (btnGlobal) btnGlobal.className = 'flex-1 h-full rounded text-[11px] font-semibold flex items-center justify-center space-x-1 bg-[#0078d4] text-white shadow-sm transition';
    if (btnWs) btnWs.className = 'flex-1 h-full rounded text-[11px] font-medium flex items-center justify-center space-x-1 text-win-textSecondary hover:text-white transition';
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
  if (typeof refreshProjects === 'function') refreshProjects(false);
  openModal('modalPasteMcp');
  const textarea = document.getElementById('pasteJsonInput');
  const targetScope = currentScopeFilter === 'workspace' ? 'workspace' : (currentScopeFilter === 'global' ? 'global' : 'workspace');
  setPasteScope(targetScope, currentWorkspace);

  if (initialJson) {
    if (textarea) textarea.value = initialJson;
    handlePasteJsonChange();
  } else {
    if (textarea) textarea.value = '';
    handlePasteJsonChange();
    readFromClipboardToModal(false);
  }

  if (textarea) setTimeout(() => textarea.focus(), 150);
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

function renderPasteSummaryDetails(conf, isHttp) {
  const cmdEl = document.getElementById('pasteSummaryCmd');
  if (cmdEl) cmdEl.innerText = isHttp ? (conf.url || '未指定 URL') : (conf.command || '未指定命令');

  const argsRow = document.getElementById('pasteSummaryArgsRow');
  const argsEl = document.getElementById('pasteSummaryArgs');
  if (argsRow && argsEl) {
    if (!isHttp && conf.args && conf.args.length > 0) {
      argsRow.classList.remove('hidden');
      argsEl.innerText = conf.args.join(' ');
    } else {
      argsRow.classList.add('hidden');
    }
  }

  const envRow = document.getElementById('pasteSummaryEnvRow');
  const envEl = document.getElementById('pasteSummaryEnv');
  if (envRow && envEl) {
    const envKeys = conf.env ? Object.keys(conf.env) : [];
    if (envKeys.length > 0) {
      envRow.classList.remove('hidden');
      envEl.innerText = envKeys.join(', ');
    } else {
      envRow.classList.add('hidden');
    }
  }
}

function updatePastePreviewUI(result) {
  const badgeStatus = document.getElementById('pasteStatusBadge');
  const errBox = document.getElementById('pasteErrorMsg');
  const errText = document.getElementById('pasteErrorText');
  const previewBox = document.getElementById('pasteParsedPreview');
  const btnConfirm = document.getElementById('btnConfirmPasteImport');
  const nameInput = document.getElementById('pasteServerName');

  if (!result || !result.ok) {
    lastPastedParseResult = null;
    if (badgeStatus) {
      badgeStatus.innerText = result ? '格式异常' : '等待粘贴';
      badgeStatus.className = 'text-[11px] font-mono ' + (result ? 'text-rose-400' : 'text-indigo-400');
    }
    if (errBox && errText) {
      if (result && result.error) {
        errText.innerText = result.error;
        errBox.classList.remove('hidden');
      } else {
        errBox.classList.add('hidden');
      }
    }
    if (previewBox) previewBox.classList.add('hidden');
    if (btnConfirm) {
      btnConfirm.classList.add('opacity-50', 'cursor-not-allowed');
      btnConfirm.disabled = true;
    }
    return;
  }

  lastPastedParseResult = result;
  if (errBox) errBox.classList.add('hidden');
  if (badgeStatus) {
    badgeStatus.innerText = '解析成功';
    badgeStatus.className = 'text-[11px] font-mono text-emerald-400 font-bold';
  }
  if (previewBox) previewBox.classList.remove('hidden');
  if (btnConfirm) {
    btnConfirm.classList.remove('opacity-50', 'cursor-not-allowed');
    btnConfirm.disabled = false;
  }

  const conf = result.serverConfig || {};
  const isHttp = conf.type === 'http' || Boolean(conf.url);
  const typeBadge = document.getElementById('pasteParsedTypeBadge');
  if (typeBadge) {
    typeBadge.innerText = isHttp ? 'HTTP / SSE' : 'Stdio';
    typeBadge.className = isHttp 
      ? 'px-1.5 py-0.5 rounded font-mono text-[10px] bg-blue-500/10 text-blue-300 border border-blue-500/20'
      : 'px-1.5 py-0.5 rounded font-mono text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20';
  }

  const targetName = suggestServerName(conf, result.serverName);
  if (nameInput) {
    nameInput.value = targetName;
  }

  renderPasteSummaryDetails(conf, isHttp);
  validatePasteServerName();
  if (window.lucide) lucide.createIcons();
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
  const scope = getPasteScopeValue();
  const name = (nameInput?.value || '').trim();
  if (!hint) return;

  if (!name) {
    hint.innerText = '* 请输入服务标识名称';
    hint.className = 'text-[10px] text-rose-400 font-mono block';
    return;
  }

  const conflict = allServers.find(s => s.name.toLowerCase() === name.toLowerCase() && s.scope === scope);
  if (conflict) {
    hint.innerText = `* 同名服务已存在于 [${scope === 'global' ? '全局配置' : '选定项目'}]，确认导入将直接覆盖同名配置`;
    hint.className = 'text-[10px] text-amber-300 font-mono block';
  } else {
    hint.innerText = '✓ 服务名称可用';
    hint.className = 'text-[10px] text-emerald-400 font-mono block';
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

  const scope = getPasteScopeValue();
  const targetWs = scope === 'workspace' 
    ? (document.getElementById('pasteTargetWorkspace')?.value || currentWorkspace)
    : undefined;

  const payload = buildPastedServerPayload(lastPastedParseResult, name, scope, targetWs);

  try {
    const res = await api.saveServer(payload);
    if (res && res.ok) {
      showToast(`已成功导入 MCP 服务 [${name}] 到 ${scope === 'global' ? '全局配置' : '项目工作区'}`, 'success');
      closeModal('modalPasteMcp');
      setScopeFilter(scope);
      if (scope === 'workspace' && targetWs && targetWs !== currentWorkspace) {
        if (typeof switchWorkspace === 'function') {
          await switchWorkspace(targetWs);
        }
      }
      await fetchServers();
      await refreshProjects(false);
    } else {
      showToast(`导入失败: ${res?.error || '未知错误'}`, 'error');
    }
  } catch (err) {
    showToast('导入异常: ' + err.message, 'error');
  }
}
