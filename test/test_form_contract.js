import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Testing Server Form Contract & DOM Alignment...');

const html = fs.readFileSync(path.join(__dirname, '../src/web/index.html'), 'utf8');

// 1. Verify critical form IDs
const requiredIds = [
  'modalServerForm',
  'serverForm',
  'modalServerTitle',
  'formName',
  'formOriginalName',
  'formOriginalScope',
  'formOriginalWorkspaceDir',
  'formScope',
  'btnScopeGlobal',
  'btnScopeWorkspace',
  'sectionWorkspaceSelect',
  'formProjectSelect',
  'formTargetWorkspace',
  'fieldGroupStdio',
  'fieldGroupHttp',
  'formCommand',
  'formArgs',
  'envList',
  'formUrl',
  'headerList',
  'formDisabled'
];

requiredIds.forEach(id => {
  const match = html.includes(`id="${id}"`) || html.includes(`id='${id}'`);
  if (!match) {
    throw new Error(`Required DOM ID "${id}" is missing in src/web/index.html!`);
  }
});
console.log(`✔ Verified ${requiredIds.length} critical DOM IDs in index.html`);

// 2. Verify transportType radios
if (!html.includes('name="transportType" value="stdio"')) {
  throw new Error('Missing radio input name="transportType" value="stdio"');
}
if (!html.includes('name="transportType" value="http"')) {
  throw new Error('Missing radio input name="transportType" value="http"');
}
console.log('✔ Verified transportType radio inputs');

// 3. Test findServer logic emulation
function pathResolve(p) {
  if (!p) return '';
  return p.replace(/\\/g, '/').toLowerCase();
}

const mockServers = [
  { name: 'context7', scope: 'global', type: 'http', url: 'https://mcp.context7.com/mcp' },
  { name: 'github', scope: 'workspace', configPath: 'A:\\code\\github\\.agents\\mcp_config.json', type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'] },
  { name: 'Special Server', scope: 'global', type: 'stdio', command: 'node' }
];

function findServer(name, scope, configPath) {
  if (!name) return null;
  const lowerName = name.toLowerCase();
  if (scope) {
    if (configPath) {
      const exact = mockServers.find(s => s.name === name && s.scope === scope && s.configPath && pathResolve(s.configPath) === pathResolve(configPath));
      if (exact) return exact;
    }
    const scoped = mockServers.find(s => s.name === name && s.scope === scope);
    if (scoped) return scoped;
    const scopedLower = mockServers.find(s => s.name.toLowerCase() === lowerName && s.scope === scope);
    if (scopedLower) return scopedLower;
  }
  return mockServers.find(s => s.name === name) || mockServers.find(s => s.name.toLowerCase() === lowerName);
}

// Emulate editServer parameter decoding and retrieval
const encName = encodeURIComponent('Special Server');
const encPath = encodeURIComponent('A:\\code\\github\\.agents\\mcp_config.json');

const targetName = decodeURIComponent(encName);
const found = findServer(targetName, 'global', '');
if (!found || found.name !== 'Special Server') {
  throw new Error('Failed to resolve encoded server name');
}

const foundWs = findServer('github', 'workspace', decodeURIComponent(encPath));
if (!foundWs || foundWs.name !== 'github') {
  throw new Error('Failed to resolve workspace server with config path');
}

console.log('✔ Verified URL-encoded parameter decoding and server resolution');
console.log('🎉 Server Form Contract tests passed successfully!\n');
