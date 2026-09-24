import fs from 'node:fs';
import path from 'node:path';
import { PATHS, getDefaultWorkspaceDir, saveActiveWorkspace, ensureDir, findWorkspaceMcpConfig } from './paths.js';

/**
 * Scans all Antigravity projects and workspaces.
 * Aggregates from trustedWorkspaces, trustedFolders.json, manager recent workspaces, and known locations.
 * @returns {Array<object>}
 */
/**
 * Helper to register a directory into projectsMap
 */
function registerDirectoryCandidate(projectsMap, dirPath, source, currentActive) {
  if (!dirPath || typeof dirPath !== 'string' || dirPath.includes('*')) return;
  if (/^[a-zA-Z]:\\(windows|program files)/i.test(dirPath)) return;

  try {
    if (fs.existsSync(dirPath)) {
      const resolved = path.resolve(dirPath);
      const key = resolved.toLowerCase();
      if (!projectsMap.has(key)) {
        projectsMap.set(key, {
          id: key,
          name: path.basename(resolved),
          path: resolved,
          source,
          isCurrent: key === currentActive,
        });
      }
    }
  } catch {}
}

/**
 * Collects candidate project directories from Antigravity configs and history.
 */
function collectCandidateProjects(currentActive) {
  const projectsMap = new Map();

  // 1. Antigravity CLI Settings
  const cliSettings = path.join(PATHS.antigravityCliDir, 'settings.json');
  if (fs.existsSync(cliSettings)) {
    try {
      const data = JSON.parse(fs.readFileSync(cliSettings, 'utf8'));
      if (Array.isArray(data.trustedWorkspaces)) {
        data.trustedWorkspaces.forEach(ws => registerDirectoryCandidate(projectsMap, ws, 'Antigravity Trusted', currentActive));
      }
    } catch (e) {
      console.error('[workspaces] Error reading cli settings:', e.message);
    }
  }

  // 2. Antigravity trustedFolders.json
  const trustedFoldersFile = path.join(path.dirname(PATHS.globalConfig), '..', 'trustedFolders.json');
  if (fs.existsSync(trustedFoldersFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(trustedFoldersFile, 'utf8'));
      Object.keys(data).forEach(folder => registerDirectoryCandidate(projectsMap, folder, 'Trusted Folders', currentActive));
    } catch (e) {
      console.error('[workspaces] Error reading trustedFolders:', e.message);
    }
  }

  // 3. Manager's saved active workspace and recent workspaces
  if (fs.existsSync(PATHS.settingsFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(PATHS.settingsFile, 'utf8'));
      if (data.activeWorkspace) registerDirectoryCandidate(projectsMap, data.activeWorkspace, 'Manager Selected', currentActive);
      if (Array.isArray(data.recentWorkspaces)) {
        data.recentWorkspaces.forEach(r => registerDirectoryCandidate(projectsMap, r, 'Recent Workspace', currentActive));
      }
    } catch {}
  }

  // 4. Default candidates & active workspace
  const candidates = ['A:\\code\\github', 'A:\\code', 'A:\\code\\jeecg\\ERP-MES', 'D:\\agy', 'D:\\agy\\code'];
  candidates.forEach(c => registerDirectoryCandidate(projectsMap, c, 'Default Candidate', currentActive));
  registerDirectoryCandidate(projectsMap, getDefaultWorkspaceDir(), 'Active Workspace', currentActive);

  return Array.from(projectsMap.values());
}

/**
 * Enriches a project entry with its local MCP configuration details.
 */
function enrichProjectMcpMeta(p, currentActive) {
  const wsMcpFile = findWorkspaceMcpConfig(p.path);
  const hasMcp = Boolean(wsMcpFile && fs.existsSync(wsMcpFile));
  let serverNames = [];

  if (hasMcp) {
    try {
      const raw = JSON.parse(fs.readFileSync(wsMcpFile, 'utf8'));
      serverNames = Object.keys(raw.mcpServers || {});
    } catch {}
  }

  return {
    ...p,
    hasMcp,
    mcpCount: serverNames.length,
    serverNames,
    configPath: wsMcpFile,
    isCurrent: p.path.toLowerCase() === currentActive,
  };
}

/**
 * Scans all Antigravity projects and workspaces.
 * Aggregates from trustedWorkspaces, trustedFolders.json, manager recent workspaces, and known locations.
 * @returns {Array<object>}
 */
export function listAntigravityProjects() {
  const currentActive = getDefaultWorkspaceDir().toLowerCase();
  const rawProjects = collectCandidateProjects(currentActive);
  const projects = rawProjects.map(p => enrichProjectMcpMeta(p, currentActive));

  // Sort: current active first, then hasMcp projects, then alphabetically
  return projects.sort((a, b) => {
    if (a.isCurrent) return -1;
    if (b.isCurrent) return 1;
    if (a.hasMcp && !b.hasMcp) return -1;
    if (!a.hasMcp && b.hasMcp) return 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Synchronizes a workspace directory to Antigravity trusted workspaces list.
 * Writes to both ~/.gemini/antigravity-cli/settings.json and ~/.gemini/trustedFolders.json
 * @param {string} workspaceDir
 * @returns {object} { ok: boolean, message: string }
 */
export function syncWorkspaceToAntigravity(workspaceDir) {
  if (!workspaceDir || !fs.existsSync(workspaceDir)) {
    throw new Error(`目录不存在: ${workspaceDir}`);
  }

  const resolved = path.resolve(workspaceDir);
  let updatedCli = false;
  let updatedFolders = false;

  // 1. Update antigravity-cli/settings.json
  const cliSettings = path.join(PATHS.antigravityCliDir, 'settings.json');
  if (fs.existsSync(cliSettings)) {
    try {
      const data = JSON.parse(fs.readFileSync(cliSettings, 'utf8'));
      if (!Array.isArray(data.trustedWorkspaces)) {
        data.trustedWorkspaces = [];
      }

      const normalizedList = data.trustedWorkspaces.map(p => p.toLowerCase());
      if (!normalizedList.includes(resolved.toLowerCase())) {
        data.trustedWorkspaces.unshift(resolved);
        fs.writeFileSync(cliSettings, JSON.stringify(data, null, 2) + '\n', 'utf8');
        updatedCli = true;
      }
    } catch (e) {
      console.error('[workspaces] Failed to update cli settings:', e.message);
    }
  }

  // 2. Update trustedFolders.json
  const trustedFoldersFile = path.join(path.dirname(PATHS.globalConfig), '..', 'trustedFolders.json');
  if (fs.existsSync(trustedFoldersFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(trustedFoldersFile, 'utf8'));
      const forwardSlashPath = resolved.replace(/\\/g, '/').toLowerCase();
      if (!data[forwardSlashPath]) {
        data[forwardSlashPath] = 'TRUST_FOLDER';
        fs.writeFileSync(trustedFoldersFile, JSON.stringify(data, null, 2) + '\n', 'utf8');
        updatedFolders = true;
      }
    } catch (e) {
      console.error('[workspaces] Failed to update trustedFolders:', e.message);
    }
  }

  // Also save as active in manager
  saveActiveWorkspace(resolved);

  return {
    ok: true,
    workspace: resolved,
    updatedCli,
    updatedFolders,
    message: `已成功将 "${resolved}" 同步登记到 Antigravity 信任项目列表`,
  };
}

/**
 * Initializes a new .agents/mcp_config.json file for a workspace.
 * @param {string} workspaceDir
 * @returns {object}
 */
export function initWorkspaceMcpConfig(workspaceDir) {
  if (!workspaceDir || !fs.existsSync(workspaceDir)) {
    throw new Error(`工程工作区目录不存在: ${workspaceDir}`);
  }

  const targetDir = path.join(path.resolve(workspaceDir), '.agents');
  const targetFile = path.join(targetDir, 'mcp_config.json');

  if (fs.existsSync(targetFile)) {
    return { ok: true, file: targetFile, isNew: false, message: '工作区已存在 MCP 配置文件' };
  }

  ensureDir(targetDir);
  const initialContent = {
    mcpServers: {}
  };

  fs.writeFileSync(targetFile, JSON.stringify(initialContent, null, 2) + '\n', 'utf8');
  return { ok: true, file: targetFile, isNew: true, message: '已成功为当前工程初始化 .agents/mcp_config.json' };
}

/**
 * Resolves the MCP configuration file for a workspace.
 * If not exists, automatically initializes .agents/mcp_config.json.
 * @param {string} [workspaceDir]
 * @returns {string}
 */
export function getWorkspaceConfigFile(workspaceDir) {
  const dir = workspaceDir || getDefaultWorkspaceDir();
  let wsConfig = findWorkspaceMcpConfig(dir);
  if (!wsConfig || !fs.existsSync(wsConfig)) {
    initWorkspaceMcpConfig(dir);
    wsConfig = path.join(path.resolve(dir), '.agents', 'mcp_config.json');
  }
  return path.resolve(wsConfig);
}
