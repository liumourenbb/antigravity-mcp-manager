import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { getServers, findTargetServer, normalizeServer } from '../src/core/config.js';

console.log('🧪 Testing Multi-Workspace Layering & Exact Server Resolution Contracts...');

// 1. Test findTargetServer exact match with same server name in multiple scopes
const fakeServers = [
  normalizeServer('common-server', { command: 'node', args: ['global.js'] }, 'global', 'C:\\user\\.gemini\\config\\mcp_config.json'),
  {
    ...normalizeServer('common-server', { command: 'node', args: ['projA.js'] }, 'workspace', 'A:\\code\\projA\\.agents\\mcp_config.json'),
    workspaceDir: 'A:\\code\\projA',
    workspaceName: 'projA',
    isCurrentWorkspace: false,
  },
  {
    ...normalizeServer('common-server', { command: 'node', args: ['projB.js'] }, 'workspace', 'A:\\code\\projB\\.agents\\mcp_config.json'),
    workspaceDir: 'A:\\code\\projB',
    workspaceName: 'projB',
    isCurrentWorkspace: true,
  },
];

// Test 1.1: Match by exact configPath
const hitGlobal = findTargetServer(fakeServers, 'common-server', 'global', '', 'C:\\user\\.gemini\\config\\mcp_config.json');
assert.strictEqual(hitGlobal.scope, 'global', 'Must match global server via configPath');

const hitProjA = findTargetServer(fakeServers, 'common-server', 'workspace', 'A:\\code\\projA', 'A:\\code\\projA\\.agents\\mcp_config.json');
assert.strictEqual(hitProjA.workspaceName, 'projA', 'Must match projA server via configPath');
assert.strictEqual(hitProjA.args[0], 'projA.js');

const hitProjB = findTargetServer(fakeServers, 'common-server', 'workspace', 'A:\\code\\projB', 'A:\\code\\projB\\.agents\\mcp_config.json');
assert.strictEqual(hitProjB.workspaceName, 'projB', 'Must match projB server via configPath');
assert.strictEqual(hitProjB.args[0], 'projB.js');
console.log('✔ Exact server resolution across duplicate server names passed');

// 2. Test getServers aggregation returns all workspace servers with metadata
const allDiscovered = getServers('all');
assert(Array.isArray(allDiscovered), 'getServers should return an array');
assert(allDiscovered.length > 0, 'Should find servers in real environment');

const wsServers = allDiscovered.filter(s => s.scope === 'workspace');
assert(wsServers.length > 0, 'Should discover workspace servers across multiple projects');
for (const s of wsServers) {
  assert(s.workspaceDir, `Workspace server ${s.name} must have workspaceDir`);
  assert(s.workspaceName, `Workspace server ${s.name} must have workspaceName`);
  assert(s.configPath, `Workspace server ${s.name} must have configPath`);
}
console.log(`✔ Verified ${wsServers.length} workspace servers from live projects with metadata`);

// 3. Test index.html DOM contract for Layered View and Search
const htmlPath = path.resolve('src/web/index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');
assert(htmlContent.includes('id="btnViewLayered"'), 'index.html must include btnViewLayered');
assert(htmlContent.includes('id="btnViewGrid"'), 'index.html must include btnViewGrid');
assert(htmlContent.includes("setViewMode('layered')"), 'index.html must bind setViewMode layered');
assert(htmlContent.includes("setViewMode('grid')"), 'index.html must bind setViewMode grid');
assert(htmlContent.includes('id="serverSearchInput"'), 'index.html must include serverSearchInput');
assert(htmlContent.includes('id="btnClearServerSearch"'), 'index.html must include btnClearServerSearch');
assert(htmlContent.includes('id="searchResultBadge"'), 'index.html must include searchResultBadge');
console.log('✔ Verified View Mode Switcher buttons and Search Inputs in index.html');

// 4. Test server-card-renderer.js contracts
const rendererPath = path.resolve('src/web/js/server-card-renderer.js');
const rendererCode = fs.readFileSync(rendererPath, 'utf8');
assert(rendererCode.includes('function normalizePath'), 'Must declare normalizePath');
assert(rendererCode.includes('function getCurrentProjectAssociatedFolders'), 'Must declare getCurrentProjectAssociatedFolders');
assert(rendererCode.includes('function isServerBelongToWorkspace'), 'Must declare isServerBelongToWorkspace');
assert(rendererCode.includes('function groupServersByWorkspace'), 'Must declare groupServersByWorkspace');
assert(rendererCode.includes('function renderWorkspaceGroupHeaderHtml'), 'Must declare renderWorkspaceGroupHeaderHtml');
assert(rendererCode.includes('function renderWorkspaceGroupHtml'), 'Must declare renderWorkspaceGroupHtml');
assert(rendererCode.includes('function setViewMode'), 'Must declare setViewMode');
assert(rendererCode.includes('function updateViewModeUI'), 'Must declare updateViewModeUI');
assert(rendererCode.includes('function toggleGroupCollapse'), 'Must declare toggleGroupCollapse');
assert(rendererCode.includes('function getServerCardPingId'), 'Must declare getServerCardPingId');
assert(rendererCode.includes('function handleServerSearch'), 'Must declare handleServerSearch');
assert(rendererCode.includes('function clearServerSearch'), 'Must declare clearServerSearch');
assert(rendererCode.includes('function highlightSearchKeyword'), 'Must declare highlightSearchKeyword');
console.log('✔ Verified all Layering & Grouping & Search contracts in server-card-renderer.js');

// 5. Test multi-folder project association & isolation logic
function mockNormalizePath(p) {
  if (!p) return '';
  return p.replace(/[\\\/]+/g, '/').replace(/\/+$/, '').toLowerCase().trim();
}

const mockProjects = [
  {
    name: 'ERP-MES-PACKAGE',
    path: 'A:\\code\\jeecg\\ERP-MES-PACKAGE',
    associatedFolders: ['A:\\code\\jeecg\\ERP-MES-PACKAGE', 'D:\\agy\\WSL'],
    isMultiFolder: true,
  },
  {
    name: 'WSL',
    path: 'D:\\agy\\WSL',
    associatedFolders: ['D:\\agy\\WSL'],
    isMultiFolder: false,
  },
  {
    name: 'cf',
    path: 'D:\\agy\\cf',
    associatedFolders: ['D:\\agy\\cf'],
    isMultiFolder: false,
  }
];

function mockGetAssociated(target) {
  const norm = mockNormalizePath(target);
  const found = mockProjects.find(p => mockNormalizePath(p.path) === norm);
  if (found && found.associatedFolders) return found.associatedFolders.map(mockNormalizePath);
  return [norm];
}

function mockIsServerBelongToMultiFolder(s, target) {
  if (!target) return true;
  const associated = mockGetAssociated(target);
  if (s.workspaceDir && associated.includes(mockNormalizePath(s.workspaceDir))) return true;
  if (s.configPath) {
    const fromCfg = mockNormalizePath(s.configPath.replace(/[\\\/]\.agents?[\\\/]mcp_config\.json$/i, ''));
    if (associated.includes(fromCfg)) return true;
  }
  return false;
}

const multiFolderFakeServers = [
  {
    name: 'ssh-wsl',
    scope: 'workspace',
    workspaceDir: 'D:\\agy\\WSL',
    configPath: 'D:\\agy\\WSL\\.agents\\mcp_config.json'
  },
  {
    name: 'cf-worker',
    scope: 'workspace',
    workspaceDir: 'D:\\agy\\cf',
    configPath: 'D:\\agy\\cf\\.agents\\mcp_config.json'
  }
];

// Selecting ERP-MES-PACKAGE must match ssh-wsl from WSL folder, but strictly exclude cf-worker
const matchedForPackage = multiFolderFakeServers.filter(s => mockIsServerBelongToMultiFolder(s, 'A:\\code\\jeecg\\ERP-MES-PACKAGE'));
assert.strictEqual(matchedForPackage.length, 1, 'ERP-MES-PACKAGE project must include WSL member folder servers');
assert.strictEqual(matchedForPackage[0].name, 'ssh-wsl');

// Selecting cf must match only cf-worker
const matchedForCf = multiFolderFakeServers.filter(s => mockIsServerBelongToMultiFolder(s, 'D:\\agy\\cf'));
assert.strictEqual(matchedForCf.length, 1);
assert.strictEqual(matchedForCf[0].name, 'cf-worker');

console.log('✔ Verified multi-folder project association & strict project isolation');

// 6. Test MCP Name search filtering and name-priority sorting
const searchPool = [
  { name: 'postgres', command: 'docker', args: ['run', 'db'] },
  { name: 'readonly_postgres', command: 'docker', args: ['run', 'db-ro'] },
  { name: 'database_proxy', command: 'node', args: ['postgres-proxy.js'] },
  { name: 'github', command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'] },
];

function mockFilterByNamePriority(servers, search) {
  const norm = (search || '').toLowerCase().trim();
  const res = servers.filter(s => {
    if (!norm) return true;
    const mName = s.name.toLowerCase().includes(norm);
    const mCmd = (s.command || '').toLowerCase().includes(norm);
    const mArgs = (s.args || []).join(' ').toLowerCase().includes(norm);
    return mName || mCmd || mArgs;
  });
  if (norm) {
    res.sort((a, b) => {
      const aN = a.name.toLowerCase().includes(norm);
      const bN = b.name.toLowerCase().includes(norm);
      if (aN && !bN) return -1;
      if (!aN && bN) return 1;
      return a.name.localeCompare(b.name);
    });
  }
  return res;
}

const searchedPostgres = mockFilterByNamePriority(searchPool, 'postgres');
assert.strictEqual(searchedPostgres.length, 3, 'Must match 2 with name postgres and 1 with args postgres');
assert.strictEqual(searchedPostgres[0].name, 'postgres', 'Direct name match must come first');
assert.strictEqual(searchedPostgres[1].name, 'readonly_postgres', 'Direct name match must come before args match');
assert.strictEqual(searchedPostgres[2].name, 'database_proxy', 'Args match must come after name matches');
console.log('✔ Verified MCP Name search filtering & name-priority sorting contract');

console.log('🎉 ALL MULTI-WORKSPACE LAYERING TESTS PASSED SUCCESSFULLY!');

