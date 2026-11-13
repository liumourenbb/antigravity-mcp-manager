import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { PATHS, getDefaultWorkspaceDir, saveActiveWorkspace, ensureDir, findWorkspaceMcpConfig } from './paths.js';

/**
 * Scans all Antigravity projects and workspaces.
 * Aggregates from trustedWorkspaces, trustedFolders.json, manager recent workspaces, and known locations.
 * @returns {Array<object>}
 */

/**
 * Decodes a file:// URI to a normalized native physical directory path.
 * @param {string} uri
 * @returns {string}
 */
export function decodeFolderUri(uri) {
  if (!uri || typeof uri !== 'string') return '';
  let clean = uri.replace(/^file:\/\/\/?/i, '');
  try {
    clean = decodeURIComponent(clean);
  } catch {}
  clean = clean.replace(/\//g, path.sep);
  if (/^[a-zA-Z]:[\\\/]/.test(clean)) {
    clean = clean.charAt(0).toUpperCase() + clean.slice(1);
  }
  return path.resolve(clean);
}

/**
 * Reads native Antigravity project definitions from ~/.gemini/config/projects/*.json.
 * Extracts project name and associated member folders.
 * @returns {Array<object>}
 */
export function getAntigravityNativeProjects() {
  const projectsDir = PATHS.antigravityProjectsDir || path.join(path.dirname(PATHS.globalConfig), 'projects');
  if (!fs.existsSync(projectsDir)) return [];
  const results = [];
  try {
    const files = fs.readdirSync(projectsDir);
    for (const f of files) {
      if (!f.endsWith('.json') || f === 'outside-of-project.json') continue;
      try {
        const filePath = path.join(projectsDir, f);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (!data || !data.name) continue;
        const folders = [];
        const resources = data.projectResources?.resources || [];
        for (const res of resources) {
          const rawUri = res.folderUri || res.gitFolder?.folderUri;
          const decoded = decodeFolderUri(rawUri);
          if (decoded && fs.existsSync(decoded)) {
            folders.push(decoded);
          }
        }
        results.push({
          id: data.id || f.replace('.json', ''),
          name: data.name,
          folders,
          filePath,
        });
      } catch {}
    }
  } catch (e) {
    console.error('[workspaces] Error reading native projects:', e.message);
  }
  return results;
}

/**
 * Returns all associated folders for an Antigravity project containing workspaceDir.
 * Supports multi-folder projects (e.g. ERP-MES-PACKAGE containing both ERP-MES-PACKAGE and WSL).
 * @param {string} workspaceDir
 * @returns {Array<string>}
 */
export function getProjectFoldersForWorkspace(workspaceDir) {
  if (!workspaceDir) return [];
  const normTarget = path.resolve(workspaceDir).toLowerCase();
  const nativeProjects = getAntigravityNativeProjects();
  for (const proj of nativeProjects) {
    if (proj.folders && proj.folders.some(f => path.resolve(f).toLowerCase() === normTarget)) {
      return proj.folders;
    }
  }
  const baseName = path.basename(workspaceDir).toLowerCase();
  for (const proj of nativeProjects) {
    if (proj.name && proj.name.toLowerCase() === baseName) {
      return proj.folders.length > 0 ? proj.folders : [workspaceDir];
    }
  }
  return [workspaceDir];
}

/**
 * Helper to register a directory into projectsMap
 */
function registerDirectoryCandidate(projectsMap, dirPath, source, currentActive) {
  if (!dirPath || typeof dirPath !== 'string') return;
  let clean = dirPath.trim();
  if (clean.startsWith('file://')) {
    clean = decodeFolderUri(clean);
  }
  clean = clean.replace(/\\/g, '/');
  if (/^[a-zA-Z]:\//.test(clean)) {
    clean = clean.charAt(0).toUpperCase() + clean.slice(1);
  }
  if (/^[a-zA-Z]:\/(windows|program files)/i.test(clean)) return;

  try {
    if (fs.existsSync(clean)) {
      const stat = fs.statSync(clean);
      if (!stat.isDirectory()) return;
      const resolved = path.resolve(clean);
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

function collectFromWildcardPath(projectsMap, wildcardPattern, currentActive) {
  const base = wildcardPattern.split('*')[0].replace(/[\\\/]+$/, '');
  if (!base || !fs.existsSync(base)) return;
  try {
    fs.readdirSync(base, { withFileTypes: true }).forEach(d => {
      if (d.isDirectory() && !d.name.startsWith('.') && d.name !== 'node_modules') {
        registerDirectoryCandidate(projectsMap, path.join(base, d.name), 'Antigravity Wildcard', currentActive);
      }
    });
  } catch {}
}

function collectFromCliSettings(projectsMap, currentActive) {
  const cliSettings = path.join(PATHS.antigravityCliDir, 'settings.json');
  if (!fs.existsSync(cliSettings)) return;
  try {
    const data = JSON.parse(fs.readFileSync(cliSettings, 'utf8'));
    if (Array.isArray(data.trustedWorkspaces)) {
      data.trustedWorkspaces.forEach(ws => {
        if (ws.includes('*')) {
          collectFromWildcardPath(projectsMap, ws, currentActive);
        } else {
          registerDirectoryCandidate(projectsMap, ws, 'Antigravity Trusted', currentActive);
        }
      });
    }
  } catch (e) {
    console.error('[workspaces] Error reading cli settings:', e.message);
  }
}

function collectFromGeminiJson(projectsMap, currentActive) {
  const projJson = path.join(path.dirname(PATHS.globalConfig), '..', 'projects.json');
  if (fs.existsSync(projJson)) {
    try {
      const data = JSON.parse(fs.readFileSync(projJson, 'utf8'));
      Object.keys(data.projects || {}).forEach(folder => {
        registerDirectoryCandidate(projectsMap, folder, 'Antigravity Projects', currentActive);
      });
    } catch {}
  }

  const trustedFoldersFile = path.join(path.dirname(PATHS.globalConfig), '..', 'trustedFolders.json');
  if (fs.existsSync(trustedFoldersFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(trustedFoldersFile, 'utf8'));
      Object.keys(data).forEach(folder => registerDirectoryCandidate(projectsMap, folder, 'Trusted Folders', currentActive));
    } catch (e) {
      console.error('[workspaces] Error reading trustedFolders:', e.message);
    }
  }
}

function collectFromConversationDb(projectsMap, currentActive) {
  const dbPath = path.join(path.dirname(PATHS.globalConfig), '..', 'antigravity', 'conversation_summaries.db');
  if (!fs.existsSync(dbPath)) return;
  try {
    const db = new DatabaseSync(dbPath, { readOnly: true });
    const rows = db.prepare("SELECT DISTINCT workspace_uris FROM conversation_summaries WHERE workspace_uris IS NOT NULL AND workspace_uris != ''").all();
    rows.forEach(r => {
      try {
        const uris = JSON.parse(r.workspace_uris);
        if (Array.isArray(uris)) {
          uris.forEach(u => registerDirectoryCandidate(projectsMap, u, 'Antigravity Session', currentActive));
        }
      } catch {}
    });
    db.close();
  } catch {}
}

function collectFromCommonWorkspaces(projectsMap, currentActive) {
  if (fs.existsSync(PATHS.settingsFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(PATHS.settingsFile, 'utf8'));
      if (data.activeWorkspace) registerDirectoryCandidate(projectsMap, data.activeWorkspace, 'Manager Selected', currentActive);
      if (Array.isArray(data.recentWorkspaces)) {
        data.recentWorkspaces.forEach(r => registerDirectoryCandidate(projectsMap, r, 'Recent Workspace', currentActive));
      }
    } catch {}
  }

  const hubs = ['A:\\code\\github', 'D:\\agy'];
  hubs.forEach(hub => {
    if (fs.existsSync(hub)) {
      try {
        fs.readdirSync(hub, { withFileTypes: true }).forEach(d => {
          if (d.isDirectory() && !d.name.startsWith('.') && d.name !== 'node_modules') {
            registerDirectoryCandidate(projectsMap, path.join(hub, d.name), 'Workspace Hub', currentActive);
          }
        });
      } catch {}
    }
  });

  registerDirectoryCandidate(projectsMap, getDefaultWorkspaceDir(), 'Active Workspace', currentActive);
}

function collectFromNativeProjectsDir(projectsMap, currentActive) {
  const nativeProjects = getAntigravityNativeProjects();
  for (const proj of nativeProjects) {
    for (const folder of proj.folders) {
      registerDirectoryCandidate(projectsMap, folder, `Antigravity [${proj.name}]`, currentActive);
    }
  }
}

/**
 * Collects candidate project directories from Antigravity configs and history.
 */
function collectCandidateProjects(currentActive) {
  const projectsMap = new Map();
  collectFromNativeProjectsDir(projectsMap, currentActive);
  collectFromCliSettings(projectsMap, currentActive);
  collectFromGeminiJson(projectsMap, currentActive);
  collectFromConversationDb(projectsMap, currentActive);
  collectFromCommonWorkspaces(projectsMap, currentActive);
  return Array.from(projectsMap.values());
}

/**
 * Enriches a project entry with its local MCP configuration details and native Antigravity project metadata.
 */
function enrichProjectMcpMeta(p, currentActive, nativeProjects) {
  const wsMcpFile = findWorkspaceMcpConfig(p.path);
  const hasMcp = Boolean(wsMcpFile && fs.existsSync(wsMcpFile));
  let serverNames = [];

  if (hasMcp) {
    try {
      const raw = JSON.parse(fs.readFileSync(wsMcpFile, 'utf8'));
      serverNames = Object.keys(raw.mcpServers || {});
    } catch {}
  }

  const norm = p.path.toLowerCase();
  let matchedProj = (nativeProjects || []).find(np => np.name.toLowerCase() === p.name.toLowerCase() && np.folders && np.folders.some(f => f.toLowerCase() === norm));
  if (!matchedProj) {
    matchedProj = (nativeProjects || []).find(np => np.name.toLowerCase() === p.name.toLowerCase());
  }
  if (!matchedProj) {
    matchedProj = (nativeProjects || []).find(np => np.folders && np.folders.some(f => f.toLowerCase() === norm));
  }

  const associatedFolders = matchedProj && matchedProj.folders.length > 0 ? matchedProj.folders : [p.path];
  const projectName = matchedProj ? matchedProj.name : p.name;

  return {
    ...p,
    projectName,
    associatedFolders,
    isMultiFolder: associatedFolders.length > 1,
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
  const nativeProjects = getAntigravityNativeProjects();
  const projects = rawProjects.map(p => enrichProjectMcpMeta(p, currentActive, nativeProjects));

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
