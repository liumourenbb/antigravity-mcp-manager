import fs from 'node:fs';
import path from 'node:path';
import { PATHS, findWorkspaceMcpConfig, getDefaultWorkspaceDir, ensureDir } from './paths.js';
import { createBackup } from './backup.js';
import { listAntigravityProjects } from './workspaces.js';

/**
 * Safely reads and parses a JSON config file.
 * @param {string} filePath
 * @returns {object}
 */
export function readConfigFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return { mcpServers: {} };
  }
  try {
    let raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '').trim();
    if (!raw) return { mcpServers: {} };
    raw = raw.replace(/,(\s*[}\]])/g, '$1');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { mcpServers: {} };
    if (!parsed.mcpServers || typeof parsed.mcpServers !== 'object') {
      parsed.mcpServers = {};
    }
    return parsed;
  } catch (err) {
    throw new Error(`Failed to parse config file ${filePath}: ${err.message}`);
  }
}

/**
 * Safely writes a config file atomically with backup.
 * @param {string} filePath
 * @param {object} data
 * @param {string} [reason='update-config']
 */
export function writeConfigFile(filePath, data, reason = 'update-config') {
  ensureDir(path.dirname(filePath));

  // Sort mcpServers keys alphabetically for consistency
  if (data && data.mcpServers && typeof data.mcpServers === 'object') {
    const sorted = {};
    const keys = Object.keys(data.mcpServers).sort((a, b) => a.localeCompare(b));
    for (const key of keys) {
      sorted[key] = data.mcpServers[key];
    }
    data.mcpServers = sorted;
  }

  const jsonStr = JSON.stringify(data, null, 2) + '\n';
  
  // Validate JSON stringification by parsing it back
  JSON.parse(jsonStr);

  // Backup existing file before overwriting
  if (fs.existsSync(filePath)) {
    createBackup(filePath, reason);
  }

  // Atomic write: write to temp file then rename
  const tmpPath = `${filePath}.tmp.${Date.now()}`;
  fs.writeFileSync(tmpPath, jsonStr, 'utf8');
  fs.renameSync(tmpPath, filePath);
}

/**
 * Normalizes an MCP server entry.
 * @param {string} name
 * @param {object} config
 * @param {'global'|'workspace'|'other'} scope
 * @param {string} configPath
 * @returns {object}
 */
export function normalizeServer(name, config, scope, configPath) {
  const isHttp = Boolean(config.url || config.serverUrl);
  const type = isHttp ? 'http' : (config.command ? 'stdio' : 'unknown');
  const disabled = config.disabled === true || scope === 'other';
  const isJetBrainsBridge = name.startsWith('jetbrains-companion-iu-');

  return {
    name,
    scope,
    configPath,
    type,
    disabled,
    isJetBrainsBridge,
    command: config.command || '',
    args: config.args || [],
    env: config.env || {},
    url: config.url || config.serverUrl || '',
    headers: config.headers || {},
    raw: config,
  };
}

/**
 * Retrieves servers across scopes.
 * @param {'all'|'global'|'workspace'|'other'} [scope='all']
 * @param {string} [workspaceDir]
 * @returns {Array<object>}
 */
function collectOtherPoolServers(servers) {
  if (!fs.existsSync(PATHS.otherConfig)) return;
  try {
    const rawOther = fs.readFileSync(PATHS.otherConfig, 'utf8');
    const parsed = JSON.parse(rawOther);
    const entries = parsed.mcpServers || parsed;
    for (const [name, cfg] of Object.entries(entries)) {
      const existing = servers.find(s => s.name === name);
      if (!existing) {
        servers.push(normalizeServer(name, cfg, 'other', PATHS.otherConfig));
      }
    }
  } catch (e) {
    console.error(`[config] Error reading other config:`, e.message);
  }
}

function collectSingleWorkspaceServers(servers, workspaceConfigPath, effectiveWs) {
  if (!workspaceConfigPath || !fs.existsSync(workspaceConfigPath)) return;
  try {
    const wsData = readConfigFile(workspaceConfigPath);
    for (const [name, cfg] of Object.entries(wsData.mcpServers || {})) {
      const item = normalizeServer(name, cfg, 'workspace', workspaceConfigPath);
      item.workspaceDir = effectiveWs;
      item.workspaceName = path.basename(effectiveWs);
      item.isCurrentWorkspace = true;
      servers.push(item);
    }
  } catch (e) {
    console.error(`[config] Error reading single workspace config:`, e.message);
  }
}

function collectAllWorkspacesServers(servers, currentActiveWs) {
  const seenConfigs = new Set();
  const projects = listAntigravityProjects();
  for (const p of projects) {
    if (!p.configPath || !fs.existsSync(p.configPath)) continue;
    const norm = path.resolve(p.configPath).toLowerCase();
    if (seenConfigs.has(norm)) continue;
    seenConfigs.add(norm);
    try {
      const wsData = readConfigFile(p.configPath);
      for (const [name, cfg] of Object.entries(wsData.mcpServers || {})) {
        const item = normalizeServer(name, cfg, 'workspace', p.configPath);
        item.workspaceDir = p.path;
        item.workspaceName = p.name;
        item.isCurrentWorkspace = p.isCurrent || (p.path.toLowerCase() === currentActiveWs);
        item.projectSource = p.source;
        servers.push(item);
      }
    } catch (e) {
      console.error(`[config] Error reading workspace config for ${p.name}:`, e.message);
    }
  }
}

/**
 * Retrieves servers across scopes, aggregating all Antigravity workspace projects.
 * @param {'all'|'global'|'workspace'|'other'} [scope='all']
 * @param {string} [workspaceDir]
 * @param {object} [options={}]
 * @returns {Array<object>}
 */
export function getServers(scope = 'all', workspaceDir, options = {}) {
  const isSystemDir = !workspaceDir || /^[a-zA-Z]:\\(windows|program files)/i.test(workspaceDir);
  const effectiveWs = isSystemDir ? getDefaultWorkspaceDir() : workspaceDir;
  const servers = [];
  const workspaceConfigPath = findWorkspaceMcpConfig(effectiveWs);
  const shouldCollectAll = options.allWorkspaces !== false;

  // 1. Global
  if (scope === 'all' || scope === 'global') {
    try {
      const globalData = readConfigFile(PATHS.globalConfig);
      for (const [name, cfg] of Object.entries(globalData.mcpServers || {})) {
        servers.push(normalizeServer(name, cfg, 'global', PATHS.globalConfig));
      }
    } catch (e) {
      console.error(`[config] Error reading global config:`, e.message);
    }
  }

  // 2. Workspace: All Antigravity projects or single specified workspace
  if (scope === 'all' || scope === 'workspace') {
    if (shouldCollectAll) {
      collectAllWorkspacesServers(servers, effectiveWs.toLowerCase());
      if (workspaceConfigPath && !servers.some(s => s.configPath && path.resolve(s.configPath).toLowerCase() === path.resolve(workspaceConfigPath).toLowerCase())) {
        collectSingleWorkspaceServers(servers, workspaceConfigPath, effectiveWs);
      }
    } else {
      collectSingleWorkspaceServers(servers, workspaceConfigPath, effectiveWs);
    }
  }

  // 3. Other / Inactive Pool
  if (scope === 'all' || scope === 'other') {
    collectOtherPoolServers(servers);
  }

  return servers;
}

/**
 * Finds a target server matching name, scope, workspaceDir, or exact configPath.
 * @param {Array<object>} servers
 * @param {string} name
 * @param {string} scope
 * @param {string} [workspaceDir]
 * @param {string} [configPath]
 * @returns {object|undefined}
 */
export function findTargetServer(servers, name, scope, workspaceDir, configPath) {
  if (configPath) {
    const norm = path.resolve(configPath).toLowerCase();
    const exact = servers.find(s => s.name === name && s.configPath && path.resolve(s.configPath).toLowerCase() === norm);
    if (exact) return exact;
  }
  if (workspaceDir && (scope === 'workspace' || scope === 'all')) {
    const wsNorm = path.resolve(workspaceDir).toLowerCase();
    const wsMatch = servers.find(s => s.name === name && s.scope === 'workspace' && s.workspaceDir && path.resolve(s.workspaceDir).toLowerCase() === wsNorm);
    if (wsMatch) return wsMatch;
  }
  return servers.find(s => s.name === name && (scope === 'all' || s.scope === scope));
}

/**
 * Toggles enabled/disabled status of a server.
 * @param {string} name
 * @param {boolean} [targetState] If undefined, inverts current state
 * @param {string} [scope='global']
 * @param {string} [workspaceDir=process.cwd()]
 * @param {string} [preferConfigPath]
 * @returns {object} updated server
 */
export function toggleServer(name, targetState, scope = 'global', workspaceDir, preferConfigPath) {
  const isSystemDir = !workspaceDir || /^[a-zA-Z]:\\(windows|program files)/i.test(workspaceDir);
  const effectiveWs = isSystemDir ? getDefaultWorkspaceDir() : workspaceDir;
  const servers = getServers('all', effectiveWs);
  const target = findTargetServer(servers, name, scope, effectiveWs, preferConfigPath);

  if (!target) {
    throw new Error(`Server "${name}" not found in scope "${scope}"`);
  }

  const effectiveScope = target.scope;
  const configPath = target.configPath;
  const data = readConfigFile(configPath);

  if (!data.mcpServers[name]) {
    // Check if it was in mcp_other without mcpServers wrapper
    if (effectiveScope === 'other') {
      const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const srvObj = raw.mcpServers ? raw.mcpServers[name] : raw[name];
      if (srvObj) {
        // Migrating from other pool to global config!
        const globalData = readConfigFile(PATHS.globalConfig);
        delete srvObj.disabled;
        globalData.mcpServers[name] = srvObj;
        writeConfigFile(PATHS.globalConfig, globalData, `enable-server-${name}`);
        
        // Remove from other pool
        if (raw.mcpServers) delete raw.mcpServers[name];
        else delete raw[name];
        fs.writeFileSync(configPath, JSON.stringify(raw, null, 2) + '\n', 'utf8');
        return normalizeServer(name, srvObj, 'global', PATHS.globalConfig);
      }
    }
    throw new Error(`Server config entry for "${name}" not found`);
  }

  const currentDisabled = data.mcpServers[name].disabled === true;
  const newDisabled = targetState !== undefined ? !targetState : !currentDisabled;

  if (newDisabled) {
    data.mcpServers[name].disabled = true;
  } else {
    delete data.mcpServers[name].disabled;
  }

  writeConfigFile(configPath, data, `${newDisabled ? 'disable' : 'enable'}-server-${name}`);
  return normalizeServer(name, data.mcpServers[name], effectiveScope, configPath);
}

/**
 * Adds or updates a server definition.
 * @param {string} name
 * @param {object} serverConfig
 * @param {'global'|'workspace'} [scope='global']
 * @param {string} [workspaceDir=process.cwd()]
 * @returns {object}
 */
export function saveServer(name, serverConfig, scope = 'global', workspaceDir, migrationOptions = {}) {
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new Error('Server name is required');
  }
  name = name.trim();

  // 安全拦截防护：严禁将包含掩码星号 (***) 的凭据写入实际配置文件，彻底防止真实凭据被污染破坏
  const configString = JSON.stringify(serverConfig || {});
  if (/(\*{3,})/.test(configString)) {
    throw new Error(`[安全防护拦截] 检测到配置项中含有掩码星号 (***)，已坚决拒绝写入！请确认使用的是真实完整密码或Token，系统严禁将脱敏星号写回配置文件。`);
  }

  let targetPath = PATHS.globalConfig;
  if (scope === 'workspace') {
    const isSystemDir = !workspaceDir || /^[a-zA-Z]:\\(windows|program files)/i.test(workspaceDir);
    const effectiveWs = isSystemDir ? getDefaultWorkspaceDir() : path.resolve(workspaceDir);
    let wsConfig = findWorkspaceMcpConfig(effectiveWs);
    if (!wsConfig) {
      // Create in .agents/mcp_config.json
      targetPath = path.join(effectiveWs, '.agents', 'mcp_config.json');
    } else {
      targetPath = wsConfig;
    }
  }

  // Handle migration from previous scope or location if requested
  const { originalName, originalScope, originalWorkspaceDir } = migrationOptions || {};
  if (originalName && originalScope) {
    const isScopeChanged = originalScope !== scope;
    const isNameChanged = originalName !== name;
    const isWsChanged = scope === 'workspace' && originalWorkspaceDir && path.resolve(originalWorkspaceDir).toLowerCase() !== path.resolve(workspaceDir || getDefaultWorkspaceDir()).toLowerCase();

    if (isScopeChanged || isNameChanged || isWsChanged) {
      // Delete old entry from original location
      try {
        let oldConfigPath = PATHS.globalConfig;
        if (originalScope === 'workspace') {
          const oldWs = originalWorkspaceDir || getDefaultWorkspaceDir();
          oldConfigPath = findWorkspaceMcpConfig(oldWs) || path.join(path.resolve(oldWs), '.agents', 'mcp_config.json');
        } else if (originalScope === 'other') {
          oldConfigPath = PATHS.otherConfig;
        }

        if (fs.existsSync(oldConfigPath)) {
          const oldData = readConfigFile(oldConfigPath);
          if (oldData.mcpServers && oldData.mcpServers[originalName]) {
            delete oldData.mcpServers[originalName];
            writeConfigFile(oldConfigPath, oldData, `migrate-remove-${originalName}-from-${originalScope}`);
          }
        }
      } catch (err) {
        console.error(`[config] Failed to remove migrated server from old scope:`, err.message);
      }
    }
  }

  const data = readConfigFile(targetPath);
  
  // Format serverConfig cleanly
  const cleanConfig = {};
  if (serverConfig.disabled === true) {
    cleanConfig.disabled = true;
  }

  if (serverConfig.type === 'http' || serverConfig.url || serverConfig.serverUrl) {
    cleanConfig.url = serverConfig.url || serverConfig.serverUrl;
    if (serverConfig.headers && Object.keys(serverConfig.headers).length > 0) {
      cleanConfig.headers = serverConfig.headers;
    }
  } else {
    cleanConfig.command = serverConfig.command || 'npx';
    cleanConfig.args = Array.isArray(serverConfig.args) ? serverConfig.args : [];
    if (serverConfig.env && Object.keys(serverConfig.env).length > 0) {
      cleanConfig.env = serverConfig.env;
    }
  }

  data.mcpServers[name] = cleanConfig;
  writeConfigFile(targetPath, data, `save-server-${name}`);
  return normalizeServer(name, cleanConfig, scope, targetPath);
}

/**
 * Removes a server from configuration.
 * @param {string} name
 * @param {'all'|'global'|'workspace'|'other'} [scope='global']
 * @param {string} [workspaceDir=process.cwd()]
 * @param {string} [preferConfigPath]
 * @returns {boolean}
 */
export function deleteServer(name, scope = 'global', workspaceDir, preferConfigPath) {
  const isSystemDir = !workspaceDir || /^[a-zA-Z]:\\(windows|program files)/i.test(workspaceDir);
  const effectiveWs = isSystemDir ? getDefaultWorkspaceDir() : workspaceDir;
  const servers = getServers('all', effectiveWs);
  const target = findTargetServer(servers, name, scope, effectiveWs, preferConfigPath);

  if (!target) {
    throw new Error(`Server "${name}" not found in scope "${scope}"`);
  }

  const configPath = target.configPath;
  const data = readConfigFile(configPath);
  if (data.mcpServers && data.mcpServers[name]) {
    delete data.mcpServers[name];
    writeConfigFile(configPath, data, `delete-server-${name}`);
    return true;
  }
  
  // Check if raw in mcp_other
  if (target.scope === 'other' && fs.existsSync(configPath)) {
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (raw[name]) {
      delete raw[name];
      fs.writeFileSync(configPath, JSON.stringify(raw, null, 2) + '\n', 'utf8');
      return true;
    }
  }

  return false;
}

/**
 * Masks sensitive values in environment variables or headers.
 * @param {object} server
 * @returns {object}
 */
export function maskSensitiveServer(server) {
  const clone = JSON.parse(JSON.stringify(server));
  const sensitivePatterns = /token|auth|key|secret|password|credential/i;

  if (clone.env && typeof clone.env === 'object') {
    for (const [k, v] of Object.entries(clone.env)) {
      if (sensitivePatterns.test(k) && typeof v === 'string' && v.length > 4) {
        clone.env[k] = v.slice(0, 3) + '******' + v.slice(-3);
      }
    }
  }

  if (clone.headers && typeof clone.headers === 'object') {
    for (const [k, v] of Object.entries(clone.headers)) {
      if (sensitivePatterns.test(k) && typeof v === 'string' && v.length > 6) {
        clone.headers[k] = v.slice(0, 5) + '******' + v.slice(-3);
      }
    }
  }

  // Also check database connection strings in args
  if (Array.isArray(clone.args)) {
    clone.args = clone.args.map(arg => {
      if (typeof arg === 'string' && arg.includes('://') && arg.includes('@')) {
        return arg.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:******@');
      }
      return arg;
    });
  }

  return clone;
}
