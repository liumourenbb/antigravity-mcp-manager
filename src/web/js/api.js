/**
 * Antigravity MCP Manager - Unified API Client (Native IPC vs Web HTTP)
 * Compliant with Rule 7: Single responsibility, all methods <= 80 lines.
 */

const api = {
  async getServers(scope) {
    if (window.mcpApi) return window.mcpApi.getServers(scope, currentWorkspace);
    const res = await fetch(`/api/servers?scope=${scope || 'all'}&workspaceDir=${encodeURIComponent(currentWorkspace || '')}`);
    return res.json();
  },

  async toggleServer(name, scope, enabled) {
    if (window.mcpApi) return window.mcpApi.toggleServer(name, scope, enabled, currentWorkspace);
    const res = await fetch(`/api/servers/${encodeURIComponent(name)}/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope, enabled, workspaceDir: currentWorkspace })
    });
    return res.json();
  },

  async saveServer(data) {
    if (!data.workspaceDir) data.workspaceDir = currentWorkspace;
    if (window.mcpApi) return window.mcpApi.saveServer(data);
    const res = await fetch('/api/servers/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async deleteServer(name, scope) {
    if (window.mcpApi) return window.mcpApi.deleteServer(name, scope, currentWorkspace);
    const res = await fetch(`/api/servers/${encodeURIComponent(name)}?scope=${scope}&workspaceDir=${encodeURIComponent(currentWorkspace || '')}`, { method: 'DELETE' });
    return res.json();
  },

  async testServer(name) {
    if (window.mcpApi) return window.mcpApi.testServer(name, currentWorkspace);
    const res = await fetch(`/api/servers/${encodeURIComponent(name)}/test?workspaceDir=${encodeURIComponent(currentWorkspace || '')}`, { method: 'POST' });
    return res.json();
  },

  async getTools(name) {
    if (window.mcpApi) return window.mcpApi.getTools(name);
    const res = await fetch(`/api/servers/${encodeURIComponent(name)}/tools`);
    return res.json();
  },

  async getPresets() {
    if (window.mcpApi) return window.mcpApi.getPresets();
    const res = await fetch('/api/presets');
    return res.json();
  },

  async scanJetBrains() {
    if (window.mcpApi) return window.mcpApi.scanJetBrains();
    const res = await fetch('/api/clean-jetbrains');
    return res.json();
  },

  async cleanJetBrains() {
    if (window.mcpApi) return window.mcpApi.cleanJetBrains();
    const res = await fetch('/api/clean-jetbrains', { method: 'POST' });
    return res.json();
  },

  async getBackups() {
    if (window.mcpApi) return window.mcpApi.getBackups();
    const res = await fetch('/api/backups');
    return res.json();
  },

  async restoreBackup(id) {
    if (window.mcpApi) return window.mcpApi.restoreBackup(id);
    const res = await fetch(`/api/backups/${encodeURIComponent(id)}/restore`, { method: 'POST' });
    return res.json();
  },

  async getAntigravityProjects() {
    if (window.mcpApi && window.mcpApi.getAntigravityProjects) {
      return window.mcpApi.getAntigravityProjects();
    }
    return { ok: true, projects: [] };
  },

  async setActiveWorkspace(dir) {
    if (window.mcpApi && window.mcpApi.setActiveWorkspace) {
      return window.mcpApi.setActiveWorkspace(dir);
    }
    return { ok: true, activeWorkspace: dir };
  },

  async syncToAntigravity(dir) {
    if (window.mcpApi && window.mcpApi.syncToAntigravity) {
      return window.mcpApi.syncToAntigravity(dir);
    }
    return { ok: true, message: '已同步' };
  },

  async readClipboard() {
    if (window.mcpApi && window.mcpApi.readClipboard) {
      const res = await window.mcpApi.readClipboard();
      if (res && res.ok) return res.text || '';
    }
    try {
      return await navigator.clipboard.readText();
    } catch {
      return '';
    }
  },

  async writeClipboard(text) {
    if (window.mcpApi && window.mcpApi.writeClipboard) {
      await window.mcpApi.writeClipboard(text);
      return true;
    }
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  },

  async initWorkspaceMcp(dir) {
    if (window.mcpApi && window.mcpApi.initWorkspaceMcp) {
      return window.mcpApi.initWorkspaceMcp(dir);
    }
    return { ok: true, message: '已初始化' };
  },

  async openWorkspaceConfigFile(dir) {
    if (window.mcpApi && window.mcpApi.openWorkspaceConfigFile) {
      return window.mcpApi.openWorkspaceConfigFile(dir);
    }
    return { ok: false, error: '当前环境不支持直接调用系统外部编辑器' };
  },

  async showWorkspaceConfigInFolder(dir) {
    if (window.mcpApi && window.mcpApi.showWorkspaceConfigInFolder) {
      return window.mcpApi.showWorkspaceConfigInFolder(dir);
    }
    return { ok: false, error: '当前环境不支持打开资源管理器' };
  },

  async getRules(scope, projectDir) {
    if (window.mcpApi && window.mcpApi.getRules) {
      return window.mcpApi.getRules(scope, projectDir);
    }
    const res = await fetch(`/api/rules?scope=${scope || 'global'}&projectDir=${encodeURIComponent(projectDir || '')}`);
    return res.json();
  },

  async saveRules(scope, projectDir, content) {
    if (window.mcpApi && window.mcpApi.saveRules) {
      return window.mcpApi.saveRules(scope, projectDir, content);
    }
    const res = await fetch('/api/rules/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope, projectDir, content })
    });
    return res.json();
  },

  async getPresetRules() {
    if (window.mcpApi && window.mcpApi.getPresetRules) {
      return window.mcpApi.getPresetRules();
    }
    const res = await fetch('/api/rules/presets');
    return res.json();
  },

  async applyPresetRule(scope, projectDir, presetId) {
    if (window.mcpApi && window.mcpApi.applyPresetRule) {
      return window.mcpApi.applyPresetRule(scope, projectDir, presetId);
    }
    const res = await fetch('/api/rules/apply-preset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope, projectDir, presetId })
    });
    return res.json();
  },

  async openRulesFile(scope, projectDir) {
    if (window.mcpApi && window.mcpApi.openRulesFile) {
      return window.mcpApi.openRulesFile(scope, projectDir);
    }
    return { ok: false, error: '当前环境不支持直接打开文件' };
  }
};
