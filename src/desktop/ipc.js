import { ipcMain, dialog, BrowserWindow, shell, clipboard } from 'electron';
import { getServers, toggleServer, saveServer, deleteServer } from '../core/config.js';
import { testServerConnection } from '../core/diagnostics.js';
import { getServerTools } from '../core/tools.js';
import { PRESETS } from '../core/presets.js';
import { scanJetBrainsBridges, cleanStaleJetBrainsBridges } from '../core/jetbrains.js';
import { listBackups, restoreBackup } from '../core/backup.js';
import { PATHS, getDefaultWorkspaceDir, saveActiveWorkspace, getRecentWorkspaces } from '../core/paths.js';
import { listAntigravityProjects, syncWorkspaceToAntigravity, initWorkspaceMcpConfig, getWorkspaceConfigFile } from '../core/workspaces.js';
import {
  PRESET_RULES,
  loadRules,
  saveRules,
  appendPresetToRules,
  listModularRules,
  resolveRulesPath,
  getProjectRulesOverview,
  initProjectRules,
  copyGlobalRulesToProject
} from '../core/rules.js';

/**
 * Registers workspace query and selection IPC handlers.
 */
function registerWorkspaceQueryHandlers() {
  ipcMain.handle('mcp:getActiveWorkspace', async () => ({
    activeWorkspace: getDefaultWorkspaceDir(),
    recentWorkspaces: getRecentWorkspaces(),
    projects: listAntigravityProjects(),
  }));

  ipcMain.handle('mcp:getAntigravityProjects', async () => {
    try {
      return { ok: true, activeWorkspace: getDefaultWorkspaceDir(), projects: listAntigravityProjects() };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('mcp:selectWorkspaceFolder', async () => {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(focusedWindow, {
      title: '选择工程工作区目录 (Workspace Folder)',
      defaultPath: getDefaultWorkspaceDir(),
      properties: ['openDirectory', 'createDirectory'],
    });

    if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
      const selected = result.filePaths[0];
      saveActiveWorkspace(selected);
      return {
        ok: true,
        activeWorkspace: selected,
        recentWorkspaces: getRecentWorkspaces(),
        projects: listAntigravityProjects(),
      };
    }
    return { ok: false, canceled: true };
  });

  ipcMain.handle('mcp:setActiveWorkspace', async (event, dir) => {
    saveActiveWorkspace(dir);
    return {
      ok: true,
      activeWorkspace: getDefaultWorkspaceDir(),
      recentWorkspaces: getRecentWorkspaces(),
      projects: listAntigravityProjects(),
    };
  });
}

/**
 * Registers workspace action and file-related IPC handlers.
 */
function registerWorkspaceActionHandlers() {
  ipcMain.handle('mcp:syncToAntigravity', async (event, dir) => {
    try {
      const targetDir = dir || getDefaultWorkspaceDir();
      const res = syncWorkspaceToAntigravity(targetDir);
      return { ...res, projects: listAntigravityProjects() };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('mcp:initWorkspaceMcp', async (event, dir) => {
    try {
      const targetDir = dir || getDefaultWorkspaceDir();
      const res = initWorkspaceMcpConfig(targetDir);
      return { ...res, projects: listAntigravityProjects() };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('mcp:openWorkspaceConfigFile', async (event, dir) => {
    try {
      const targetDir = dir || getDefaultWorkspaceDir();
      const configFile = getWorkspaceConfigFile(targetDir);
      const errMsg = await shell.openPath(configFile);
      if (errMsg) {
        shell.showItemInFolder(configFile);
        return { ok: true, path: configFile, fallback: true, message: errMsg };
      }
      return { ok: true, path: configFile };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('mcp:showWorkspaceConfigInFolder', async (event, dir) => {
    try {
      const targetDir = dir || getDefaultWorkspaceDir();
      const configFile = getWorkspaceConfigFile(targetDir);
      shell.showItemInFolder(configFile);
      return { ok: true, path: configFile };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
}

/**
 * Registers IPC handlers for Server CRUD operations and testing.
 */
function registerServerCrudIpcHandlers() {
  ipcMain.handle('mcp:getServers', async (event, scope = 'all', workspaceDir) => {
    try {
      const effectiveWs = workspaceDir || getDefaultWorkspaceDir();
      const rawServers = getServers(scope, effectiveWs);
      const jbBridges = await scanJetBrainsBridges();
      const deadBridgeNames = new Set(jbBridges.filter(b => !b.isAlive).map(b => b.name));

      const servers = rawServers.map(s => ({
        ...s,
        isDeadBridge: s.isJetBrainsBridge ? deadBridgeNames.has(s.name) : false,
      }));

      return { ok: true, servers, activeWorkspace: effectiveWs };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('mcp:toggleServer', async (event, { name, scope, enabled, workspaceDir }) => {
    try {
      const effectiveWs = workspaceDir || getDefaultWorkspaceDir();
      const updated = toggleServer(name, enabled, scope || 'global', effectiveWs);
      return { ok: true, server: updated };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('mcp:saveServer', async (event, { name, scope, config, workspaceDir, originalName, originalScope, originalWorkspaceDir }) => {
    try {
      const effectiveWs = workspaceDir || getDefaultWorkspaceDir();
      const updated = saveServer(name, config, scope || 'global', effectiveWs, {
        originalName,
        originalScope,
        originalWorkspaceDir,
      });
      return { ok: true, server: updated };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('mcp:deleteServer', async (event, { name, scope, workspaceDir }) => {
    try {
      const effectiveWs = workspaceDir || getDefaultWorkspaceDir();
      const deleted = deleteServer(name, scope || 'global', effectiveWs);
      return { ok: true, deleted };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('mcp:testServer', async (event, name, workspaceDir) => {
    try {
      const effectiveWs = workspaceDir || getDefaultWorkspaceDir();
      const servers = getServers('all', effectiveWs);
      const target = servers.find(s => s.name === name);
      if (!target) return { ok: false, message: `Server "${name}" not found` };
      return await testServerConnection(target, 6000);
    } catch (err) {
      return { ok: false, message: err.message };
    }
  });

  ipcMain.handle('mcp:getTools', async (event, name) => {
    try {
      return getServerTools(name);
    } catch (err) {
      return { tools: [], message: err.message };
    }
  });
}

/**
 * Registers IPC handlers for Presets, JetBrains diagnostics, and Backups.
 */
function registerDiagnosticsAndBackupIpcHandlers() {
  ipcMain.handle('mcp:getPresets', async () => ({ ok: true, presets: PRESETS }));

  ipcMain.handle('mcp:scanJetBrains', async () => {
    try {
      const bridges = await scanJetBrainsBridges();
      return {
        ok: true,
        total: bridges.length,
        dead: bridges.filter(b => !b.isAlive),
        alive: bridges.filter(b => b.isAlive),
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('mcp:cleanJetBrains', async () => {
    try {
      const result = await cleanStaleJetBrainsBridges();
      return { ok: true, ...result };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('mcp:getBackups', async () => {
    try {
      return { ok: true, backups: listBackups('mcp_config.json') };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('mcp:restoreBackup', async (event, backupId) => {
    try {
      restoreBackup(backupId, PATHS.globalConfig);
      return { ok: true, message: 'Restored successfully' };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
}

/**
 * Registers IPC handlers for system native capabilities (Clipboard, etc.).
 */
function registerSystemIpcHandlers() {
  ipcMain.handle('mcp:readClipboard', async () => {
    try {
      return { ok: true, text: clipboard.readText() };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('mcp:writeClipboard', async (event, text) => {
    try {
      clipboard.writeText(text || '');
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
}

/**
 * Registers IPC handlers for Antigravity rules management.
 */
function registerRulesIpcHandlers() {
  ipcMain.handle('mcp:getRules', async (event, { scope = 'global', projectDir = null } = {}) => {
    try {
      return { ok: true, rules: loadRules(scope, projectDir) };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('mcp:saveRules', async (event, { scope = 'global', projectDir = null, content = '' } = {}) => {
    try {
      return { ok: true, result: saveRules(scope, projectDir, content) };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('mcp:getPresetRules', async () => ({
    ok: true,
    presets: PRESET_RULES
  }));

  ipcMain.handle('mcp:applyPresetRule', async (event, { scope = 'global', projectDir = null, presetId } = {}) => {
    try {
      return { ok: true, result: appendPresetToRules(scope, projectDir, presetId) };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('mcp:getModularRules', async (event, { scope = 'global', projectDir = null } = {}) => {
    try {
      return { ok: true, files: listModularRules(scope, projectDir) };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('mcp:openRulesFile', async (event, { scope = 'global', projectDir = null } = {}) => {
    try {
      const p = resolveRulesPath(scope, projectDir);
      await shell.openPath(p);
      return { ok: true, filePath: p };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('mcp:getProjectRulesOverview', async () => {
    try {
      return { ok: true, ...getProjectRulesOverview() };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('mcp:initProjectRules', async (event, { projectDir, templateId } = {}) => {
    try {
      return { ok: true, result: initProjectRules(projectDir, templateId) };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('mcp:copyGlobalRulesToProject', async (event, { projectDir } = {}) => {
    try {
      return { ok: true, result: copyGlobalRulesToProject(projectDir) };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
}

/**
 * Main entrance to register all IPC handlers.
 */
export function registerIpcHandlers() {
  registerWorkspaceQueryHandlers();
  registerWorkspaceActionHandlers();
  registerServerCrudIpcHandlers();
  registerDiagnosticsAndBackupIpcHandlers();
  registerSystemIpcHandlers();
  registerRulesIpcHandlers();
}
