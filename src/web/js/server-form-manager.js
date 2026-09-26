/**
 * Antigravity MCP Manager - Server Form & Editing Manager
 * Compliant with Rule 7: Single responsibility, helper extraction, all methods <= 80 lines.
 */

function populateProjectOptions(selectedDir) {
  const projSelect = document.getElementById('formProjectSelect');
  const wsSelect = document.getElementById('formTargetWorkspace');
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

  updateFormScopeHint();
}

function handleFormProjectSelectChange() {
  const projPath = document.getElementById('formProjectSelect')?.value;
  const wsSelect = document.getElementById('formTargetWorkspace');
  if (wsSelect && projPath) {
    wsSelect.value = projPath;
  }
  updateFormScopeHint();
}

function handleFormWorkspaceChange() {
  const wsPath = document.getElementById('formTargetWorkspace')?.value;
  const projSelect = document.getElementById('formProjectSelect');
  if (projSelect && wsPath) {
    projSelect.value = wsPath;
  }
  updateFormScopeHint();
}

function setFormScope(scope, preferWorkspaceDir) {
  const input = document.getElementById('formScope');
  if (input) input.value = scope;

  const btnGlobal = document.getElementById('btnScopeGlobal');
  const btnWs = document.getElementById('btnScopeWorkspace');
  const wsSection = document.getElementById('sectionWorkspaceSelect');
  const hintMigration = document.getElementById('lblScopeChangeHint');
  const origScope = document.getElementById('formOriginalScope')?.value || '';

  if (scope === 'workspace') {
    if (btnWs) btnWs.className = 'flex-1 h-full rounded-md text-xs font-semibold flex items-center justify-center space-x-1.5 bg-purple-600 text-white shadow-sm transition';
    if (btnGlobal) btnGlobal.className = 'flex-1 h-full rounded-md text-xs font-medium flex items-center justify-center space-x-1.5 text-win-textSecondary hover:text-white transition';
    if (wsSection) wsSection.classList.remove('hidden');
    populateProjectOptions(preferWorkspaceDir || currentWorkspace);
  } else {
    if (btnGlobal) btnGlobal.className = 'flex-1 h-full rounded-md text-xs font-semibold flex items-center justify-center space-x-1.5 bg-[#0078d4] text-white shadow-sm transition';
    if (btnWs) btnWs.className = 'flex-1 h-full rounded-md text-xs font-medium flex items-center justify-center space-x-1.5 text-win-textSecondary hover:text-white transition';
    if (wsSection) wsSection.classList.add('hidden');
  }

  if (hintMigration) {
    if (origScope && origScope !== scope) {
      hintMigration.classList.remove('hidden');
      hintMigration.innerText = `* 将从原 [${origScope === 'global' ? '全局' : '工作区'}] 自动迁移`;
    } else {
      hintMigration.classList.add('hidden');
    }
  }

  updateFormScopeHint();
  if (window.lucide) lucide.createIcons();
}

function handleFormScopeChange(preferWorkspaceDir) {
  setFormScope(document.getElementById('formScope')?.value || 'global', preferWorkspaceDir);
}

async function browseCustomWorkspaceForForm() {
  if (window.mcpApi && window.mcpApi.selectWorkspaceFolder) {
    try {
      const res = await window.mcpApi.selectWorkspaceFolder();
      if (res.ok && res.activeWorkspace) {
        antigravityProjects = res.projects || antigravityProjects;
        populateProjectOptions(res.activeWorkspace);
        updateFormScopeHint();
        showToast(`已选定目标项目: ${res.activeWorkspace.split('\\').pop()}`, 'success');
      }
    } catch (e) {
      showToast('选择目录失败: ' + e.message, 'error');
    }
  }
}

function updateFormScopeHint() {
  const hint = document.getElementById('formScopeHint');
  const badge = document.getElementById('formWorkspaceMcpBadge');
  const scope = document.getElementById('formScope')?.value;
  if (!hint) return;

  if (scope === 'workspace') {
    const targetWs = document.getElementById('formTargetWorkspace')?.value || currentWorkspace;
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

function handleFormNameChange() {
  const origName = document.getElementById('formOriginalName')?.value || '';
  const newName = (document.getElementById('formName')?.value || '').trim();
  const hintEl = document.getElementById('lblFormNameChangeHint');
  if (!hintEl) return;

  if (!origName) {
    hintEl.classList.add('hidden');
    return;
  }

  if (newName && newName !== origName) {
    const curScope = document.getElementById('formScope')?.value || 'workspace';
    const exists = allServers.some(s => s.name.toLowerCase() === newName.toLowerCase() && s.scope === curScope);
    if (exists) {
      hintEl.className = 'text-[10px] text-rose-400';
      hintEl.innerText = `* 目标名称 [${newName}] 已在当前作用域存在，保存将覆盖同名服务`;
    } else {
      hintEl.className = 'text-[10px] text-purple-300';
      hintEl.innerText = `* 将由 [${origName}] 重命名为 [${newName}]`;
    }
    hintEl.classList.remove('hidden');
  } else {
    hintEl.classList.add('hidden');
  }
}

function getEnvListContainer() {
  return document.getElementById('envList') || document.getElementById('envContainer');
}

function getHeaderListContainer() {
  return document.getElementById('headerList') || document.getElementById('headerContainer');
}

function openAddServerModal() {
  document.getElementById('serverForm')?.reset();
  const titleEl = document.getElementById('modalServerTitle');
  if (titleEl) titleEl.innerText = '添加 MCP 服务';
  const fn = document.getElementById('formName');
  if (fn) { fn.value = ''; fn.readOnly = false; }
  ['formOriginalName', 'formOriginalScope', 'formOriginalWorkspaceDir'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('lblFormNameChangeHint')?.classList.add('hidden');

  const envCont = getEnvListContainer();
  if (envCont) envCont.innerHTML = '';
  const headerCont = getHeaderListContainer();
  if (headerCont) headerCont.innerHTML = '';

  const preferScope = currentScopeFilter === 'workspace' ? 'workspace' : 'global';
  setFormScope(preferScope, currentWorkspace);

  toggleTransportFields('stdio');
  openModal('modalServerForm');
}

function editServer(nameInput, scope, encodedConfigPath) {
  let name = nameInput;
  try {
    if (typeof nameInput === 'string' && nameInput.includes('%')) {
      name = decodeURIComponent(nameInput);
    }
  } catch {}

  const configPath = encodedConfigPath ? decodeURIComponent(encodedConfigPath) : '';
  const server = findServer(name, scope, configPath);
  if (!server) {
    showToast(`未找到服务配置: ${name || '未知'}`, 'error');
    return;
  }

  document.getElementById('serverForm')?.reset();
  const titleEl = document.getElementById('modalServerTitle');
  if (titleEl) titleEl.innerText = `编辑 MCP 服务: ${server.name}`;
  const fn = document.getElementById('formName');
  if (fn) { fn.value = server.name; fn.readOnly = false; }
  const origName = document.getElementById('formOriginalName');
  if (origName) origName.value = server.name;
  const origScope = document.getElementById('formOriginalScope');
  if (origScope) origScope.value = server.scope || 'global';
  document.getElementById('lblFormNameChangeHint')?.classList.add('hidden');

  let serverWs = '';
  if (server.configPath) {
    serverWs = server.configPath.replace(/[\\\/]\.agents?[\\\/]mcp_config\.json$/i, '');
  }
  const origWs = document.getElementById('formOriginalWorkspaceDir');
  if (origWs) origWs.value = serverWs || currentWorkspace;

  setFormScope(server.scope || 'global', serverWs || currentWorkspace);

  const isHttp = server.type === 'http';
  const radio = document.querySelector(`input[name="transportType"][value="${isHttp ? 'http' : 'stdio'}"], input[name="formType"][value="${isHttp ? 'http' : 'stdio'}"]`);
  if (radio) radio.checked = true;
  toggleTransportFields(isHttp ? 'http' : 'stdio');

  if (isHttp) {
    const urlEl = document.getElementById('formUrl');
    if (urlEl) urlEl.value = server.url || '';
    const headers = server.headers || {};
    const headerList = getHeaderListContainer();
    if (headerList) {
      headerList.innerHTML = '';
      Object.keys(headers).forEach(k => addHeaderRow(k, headers[k]));
    }
  } else {
    const cmdEl = document.getElementById('formCommand');
    if (cmdEl) cmdEl.value = server.command || '';
    const argsEl = document.getElementById('formArgs');
    if (argsEl) argsEl.value = (server.args || []).join(' ');
    const env = server.env || {};
    const envList = getEnvListContainer();
    if (envList) {
      envList.innerHTML = '';
      Object.keys(env).forEach(k => addEnvRow(k, env[k]));
    }
  }

  const disEl = document.getElementById('formDisabled');
  if (disEl) disEl.checked = Boolean(server.disabled);

  openModal('modalServerForm');
}

function toggleTransportFields(type) {
  const activeType = type || document.querySelector('input[name="transportType"]:checked, input[name="formType"]:checked')?.value || 'stdio';
  const elStdio = document.getElementById('fieldGroupStdio') || document.getElementById('sectionStdio');
  const elHttp = document.getElementById('fieldGroupHttp') || document.getElementById('sectionHttp');
  if (elStdio) elStdio.classList.toggle('hidden', activeType !== 'stdio');
  if (elHttp) elHttp.classList.toggle('hidden', activeType !== 'http');
}

function addEnvRow(key = '', val = '') {
  const container = getEnvListContainer();
  if (!container) return;
  const div = document.createElement('div');
  div.className = 'flex items-center space-x-2';
  div.innerHTML = `
    <input type="text" placeholder="KEY" value="${escapeHtml(key)}" class="env-key flex-1 bg-[#1e1e1e] border border-win-border rounded px-2.5 py-1 text-xs font-mono text-white placeholder-win-textTertiary focus:outline-none focus:border-win-accent">
    <input type="text" placeholder="VALUE" value="${escapeHtml(val)}" class="env-val flex-1 bg-[#1e1e1e] border border-win-border rounded px-2.5 py-1 text-xs font-mono text-white placeholder-win-textTertiary focus:outline-none focus:border-win-accent">
    <button type="button" onclick="this.parentElement.remove()" class="text-win-textSecondary hover:text-rose-400 p-1">
      <i data-lucide="minus-circle" class="w-4 h-4"></i>
    </button>
  `;
  container.appendChild(div);
  if (window.lucide) lucide.createIcons();
}

function addHeaderRow(key = '', val = '') {
  const container = getHeaderListContainer();
  if (!container) return;
  const div = document.createElement('div');
  div.className = 'flex items-center space-x-2';
  div.innerHTML = `
    <input type="text" placeholder="Header-Name" value="${escapeHtml(key)}" class="header-key flex-1 bg-[#1e1e1e] border border-win-border rounded px-2.5 py-1 text-xs font-mono text-white placeholder-win-textTertiary focus:outline-none focus:border-win-accent">
    <input type="text" placeholder="Value" value="${escapeHtml(val)}" class="header-val flex-1 bg-[#1e1e1e] border border-win-border rounded px-2.5 py-1 text-xs font-mono text-white placeholder-win-textTertiary focus:outline-none focus:border-win-accent">
    <button type="button" onclick="this.parentElement.remove()" class="text-win-textSecondary hover:text-rose-400 p-1">
      <i data-lucide="minus-circle" class="w-4 h-4"></i>
    </button>
  `;
  container.appendChild(div);
  if (window.lucide) lucide.createIcons();
}

function collectEnvFromForm() {
  const env = {};
  const container = getEnvListContainer();
  if (container) {
    container.querySelectorAll('div').forEach(row => {
      const k = row.querySelector('.env-key')?.value.trim();
      const v = row.querySelector('.env-val')?.value.trim();
      if (k) env[k] = v || '';
    });
  }
  return env;
}

function collectHeadersFromForm() {
  const headers = {};
  const container = getHeaderListContainer();
  if (container) {
    container.querySelectorAll('div').forEach(row => {
      const k = row.querySelector('.header-key')?.value.trim();
      const v = row.querySelector('.header-val')?.value.trim();
      if (k) headers[k] = v || '';
    });
  }
  return headers;
}

function assembleServerConfig(type) {
  if (type === 'http') {
    return {
      type: 'http',
      url: document.getElementById('formUrl')?.value.trim() || '',
      headers: collectHeadersFromForm()
    };
  }
  const rawArgs = document.getElementById('formArgs')?.value.trim() || '';
  return {
    command: document.getElementById('formCommand')?.value.trim() || '',
    args: rawArgs ? rawArgs.split(/\s+/).filter(Boolean) : [],
    env: collectEnvFromForm()
  };
}

async function handleSaveServer(e) {
  e.preventDefault();
  const name = (document.getElementById('formName')?.value || '').trim();
  const scope = document.getElementById('formScope')?.value || 'global';
  const typeRadio = document.querySelector('input[name="transportType"]:checked, input[name="formType"]:checked');
  const type = typeRadio?.value || 'stdio';
  const targetWs = scope === 'workspace' ? (document.getElementById('formTargetWorkspace')?.value || currentWorkspace) : undefined;

  const originalName = document.getElementById('formOriginalName')?.value || '';
  const originalScope = document.getElementById('formOriginalScope')?.value || '';
  const originalWorkspaceDir = document.getElementById('formOriginalWorkspaceDir')?.value || '';
  const disabled = document.getElementById('formDisabled')?.checked || false;

  if (!name) return showToast('请输入服务名称', 'error');

  const config = assembleServerConfig(type);
  if (disabled) config.disabled = true;

  try {
    const res = await api.saveServer({
      name,
      scope,
      config,
      workspaceDir: targetWs,
      originalName,
      originalScope,
      originalWorkspaceDir
    });

    if (res.ok) {
      const isRenamed = originalName && originalName !== name;
      const renameMsg = isRenamed ? `已重命名并更新服务 [${name}]` : `已成功保存服务 [${name}]`;
      showToast(renameMsg, 'success');
      closeModal('modalServerForm');
      setScopeFilter(scope);
      await fetchServers();
      await refreshProjects(false);
    } else {
      showToast('保存失败: ' + res.error, 'error');
    }
  } catch (err) {
    showToast('提交异常: ' + err.message, 'error');
  }
}
