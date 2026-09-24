import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

const homedir = os.homedir();

export const PATHS = {
  // Global MCP config
  globalConfig: path.join(homedir, '.gemini', 'config', 'mcp_config.json'),
  
  // Stashed/Other MCP config (user's manual pool)
  otherConfig: path.join(homedir, '.gemini', 'config', 'mcp_other.json'),
  
  // Backup directory for versioned snapshots
  backupsDir: path.join(homedir, '.gemini', 'config', '.mcp_backups'),
  
  // Antigravity MCP cache (contains tool schemas)
  antigravityMcpDir: path.join(homedir, '.gemini', 'antigravity', 'mcp'),
  
  // Antigravity CLI directory (contains JetBrains bridge .bat files)
  antigravityCliDir: path.join(homedir, '.gemini', 'antigravity-cli'),
  
  // Antigravity global bin (in PATH)
  antigravityBinDir: path.join(homedir, '.gemini', 'antigravity', 'bin'),

  // Manager persistent settings
  settingsFile: path.join(homedir, '.gemini', 'antigravity', 'mcp_manager_settings.json'),

  // Global Rules config file (Antigravity system rules)
  globalRulesFile: path.join(homedir, '.gemini', 'config', 'AGENTS.md'),

  // Global Rules modular directory
  globalRulesDir: path.join(homedir, '.gemini', 'config', 'rules'),
};

/**
 * Gets the current active workspace directory.
 * Never falls back to Windows system32 or system paths.
 * @returns {string}
 */
export function getDefaultWorkspaceDir() {
  // 1. Check manager settings file
  if (fs.existsSync(PATHS.settingsFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(PATHS.settingsFile, 'utf8'));
      if (data.activeWorkspace && fs.existsSync(data.activeWorkspace)) {
        return path.resolve(data.activeWorkspace);
      }
    } catch {}
  }

  // 2. Check Antigravity trusted workspaces
  const cliSettings = path.join(homedir, '.gemini', 'antigravity-cli', 'settings.json');
  if (fs.existsSync(cliSettings)) {
    try {
      const data = JSON.parse(fs.readFileSync(cliSettings, 'utf8'));
      if (Array.isArray(data.trustedWorkspaces)) {
        for (const ws of data.trustedWorkspaces) {
          if (!ws.includes('*') && fs.existsSync(ws)) {
            return path.resolve(ws);
          }
        }
      }
    } catch {}
  }

  // 3. Check process.cwd() IF NOT in Windows system directory
  const cwd = process.cwd();
  const isSystemDir = /^[a-zA-Z]:\\(windows|program files)/i.test(cwd);
  if (!isSystemDir && fs.existsSync(cwd)) {
    return path.resolve(cwd);
  }

  // 4. Default candidates
  const candidates = [
    'A:\\code\\github',
    'A:\\code',
    path.join(homedir, 'code'),
    path.join(homedir, 'Projects'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return path.resolve(c);
  }

  return path.resolve(homedir);
}

/**
 * Saves the active workspace directory to settings.
 * @param {string} dir
 */
export function saveActiveWorkspace(dir) {
  if (!dir || !fs.existsSync(dir)) return;
  const resolved = path.resolve(dir);
  ensureDir(path.dirname(PATHS.settingsFile));
  
  let data = {};
  if (fs.existsSync(PATHS.settingsFile)) {
    try { data = JSON.parse(fs.readFileSync(PATHS.settingsFile, 'utf8')); } catch {}
  }

  data.activeWorkspace = resolved;
  const recents = new Set(data.recentWorkspaces || []);
  recents.add(resolved);
  data.recentWorkspaces = Array.from(recents).filter(d => fs.existsSync(d)).slice(0, 10);

  fs.writeFileSync(PATHS.settingsFile, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Gets list of recent workspaces.
 * @returns {Array<string>}
 */
export function getRecentWorkspaces() {
  const current = getDefaultWorkspaceDir();
  const list = [current];

  if (fs.existsSync(PATHS.settingsFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(PATHS.settingsFile, 'utf8'));
      if (Array.isArray(data.recentWorkspaces)) {
        for (const r of data.recentWorkspaces) {
          if (fs.existsSync(r) && !list.includes(r)) list.push(r);
        }
      }
    } catch {}
  }

  return list;
}

/**
 * Finds workspace MCP config by walking up from current directory to root.
 * Looks for .agents/mcp_config.json or .agent/mcp_config.json.
 * @param {string} [startDir]
 * @returns {string|null}
 */
export function findWorkspaceMcpConfig(startDir) {
  let targetDir = startDir;
  if (!targetDir || /^[a-zA-Z]:\\(windows|program files)/i.test(targetDir)) {
    targetDir = getDefaultWorkspaceDir();
  }

  let curr = path.resolve(targetDir);
  const root = path.parse(curr).root;
  
  while (true) {
    const candidates = [
      path.join(curr, '.agents', 'mcp_config.json'),
      path.join(curr, '.agent', 'mcp_config.json'),
      path.join(curr, '_agents', 'mcp_config.json'),
    ];
    
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
    
    // Stop if we hit a git root or filesystem root
    if (fs.existsSync(path.join(curr, '.git')) || curr === root) {
      break;
    }
    
    const parent = path.dirname(curr);
    if (parent === curr) break;
    curr = parent;
  }
  
  return null;
}

/**
 * Ensures a directory exists synchronously.
 * @param {string} dirPath
 */
export function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}
