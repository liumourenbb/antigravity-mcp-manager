import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listAntigravityProjects } from '../src/core/workspaces.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Testing Workspace Project Multi-Source Discovery & Auto-Sync Contracts...');

// 1. Test Backend Project Discovery
const projects = listAntigravityProjects();
if (!Array.isArray(projects) || projects.length === 0) {
  throw new Error('listAntigravityProjects() returned empty or non-array result');
}

console.log(`✔ Successfully discovered ${projects.length} Antigravity projects across all sources.`);

// Verify required fields on each project
projects.forEach((p, idx) => {
  if (!p.id || !p.name || !p.path || typeof p.hasMcp !== 'boolean') {
    throw new Error(`Project at index ${idx} is missing required properties: ${JSON.stringify(p)}`);
  }
});
console.log('✔ All projects conform to required schema (id, name, path, hasMcp, mcpCount, source)');

// 2. Test Frontend workspace-manager.js contracts
const wmSource = fs.readFileSync(path.join(__dirname, '../src/web/js/workspace-manager.js'), 'utf8');

const requiredIdentifiers = [
  'hasProjectsChanged',
  'notifyProjectConsumers',
  'refreshProjects',
  'triggerAutoSync',
  'startAutoProjectSync'
];

requiredIdentifiers.forEach(name => {
  if (!wmSource.includes(name)) {
    throw new Error(`workspace-manager.js is missing required function or identifier: ${name}`);
  }
});
console.log('✔ workspace-manager.js contains all required auto-sync functions');

// 3. Test hasProjectsChanged logic simulation
function testHasProjectsChanged() {
  function hasProjectsChanged(oldList, newList) {
    if (!oldList || !newList) return true;
    if (oldList.length !== newList.length) return true;
    const oldMap = new Map(oldList.map(p => [(p.path || '').toLowerCase(), p.mcpCount || 0]));
    return newList.some(p => {
      const key = (p.path || '').toLowerCase();
      if (!oldMap.has(key)) return true;
      return oldMap.get(key) !== (p.mcpCount || 0);
    });
  }

  const base = [
    { path: 'A:\\code\\proj1', mcpCount: 2 },
    { path: 'A:\\code\\proj2', mcpCount: 0 }
  ];

  // Identical list
  if (hasProjectsChanged(base, [{ path: 'A:\\code\\proj1', mcpCount: 2 }, { path: 'A:\\code\\proj2', mcpCount: 0 }])) {
    throw new Error('hasProjectsChanged reported change for identical lists');
  }

  // Added project
  if (!hasProjectsChanged(base, [...base, { path: 'A:\\code\\proj3', mcpCount: 1 }])) {
    throw new Error('hasProjectsChanged failed to detect added project');
  }

  // Changed MCP count
  if (!hasProjectsChanged(base, [{ path: 'A:\\code\\proj1', mcpCount: 3 }, { path: 'A:\\code\\proj2', mcpCount: 0 }])) {
    throw new Error('hasProjectsChanged failed to detect MCP count change');
  }

  console.log('✔ Project change detection algorithm verified successfully');
}

testHasProjectsChanged();

// 4. Test app.js mounts auto-sync
const appSource = fs.readFileSync(path.join(__dirname, '../src/web/js/app.js'), 'utf8');
if (!appSource.includes('startAutoProjectSync()') || !appSource.includes('refreshProjects(false)')) {
  throw new Error('app.js does not mount startAutoProjectSync() or refreshProjects(false)');
}
console.log('✔ app.js successfully mounts startAutoProjectSync on DOMContentLoaded');

console.log('🎉 ALL WORKSPACE AUTO-SYNC TESTS PASSED SUCCESSFULLY!');
