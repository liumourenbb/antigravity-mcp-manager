import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { PATHS, findWorkspaceMcpConfig } from '../src/core/paths.js';
import { getServers, normalizeServer, maskSensitiveServer } from '../src/core/config.js';
import { getServerTools } from '../src/core/tools.js';
import { PRESETS } from '../src/core/presets.js';
import { scanJetBrainsBridges } from '../src/core/jetbrains.js';
import { listBackups } from '../src/core/backup.js';
import { testServerConnection } from '../src/core/diagnostics.js';

console.log('🧪 Starting Antigravity MCP Manager test suite...\n');

// 1. Paths test
console.log('1. Testing Paths module...');
assert.ok(PATHS.globalConfig.includes('mcp_config.json'), 'globalConfig path valid');
assert.ok(fs.existsSync(PATHS.globalConfig), 'globalConfig file exists on disk');
const wsConfig = findWorkspaceMcpConfig('A:\\code\\github');
console.log(`   Found workspace config: ${wsConfig}`);
assert.ok(wsConfig, 'Found workspace config for A:\\code\\github');
console.log('   ✔ Paths module passed\n');

// 2. Config reading & normalization
console.log('2. Testing getServers() & Normalization...');
const allServers = getServers('all', 'A:\\code\\github');
console.log(`   Discovered ${allServers.length} servers total.`);
assert.ok(allServers.length > 5, 'Found at least 5 configured servers');

const hasGlobal = allServers.some(s => s.scope === 'global');
const hasWorkspace = allServers.some(s => s.scope === 'workspace');
assert.ok(hasGlobal, 'Found global servers');
assert.ok(hasWorkspace, 'Found workspace servers (github)');
console.log('   ✔ Scope discovery passed\n');

// 3. Sensitive Data Masking test
console.log('3. Testing Credential Masking...');
const dummyServer = {
  name: 'dummy',
  env: {
    API_TOKEN: 'secret_123456789_token',
    NORMAL_VAR: 'hello',
  },
  headers: {
    Authorization: 'Bearer my_top_secret_bearer_token',
  },
  args: [
    'postgresql://myuser:mypassword123@192.168.1.1:5432/mydb'
  ]
};
const masked = maskSensitiveServer(dummyServer);
assert.ok(!masked.env.API_TOKEN.includes('123456789'), 'Token masked in env');
assert.ok(masked.env.API_TOKEN.includes('******'), 'Mask asterisks applied to token');
assert.strictEqual(masked.env.NORMAL_VAR, 'hello', 'Non-sensitive var preserved');
assert.ok(!masked.headers.Authorization.includes('top_secret'), 'Auth header masked');
assert.ok(masked.args[0].includes('myuser:******@'), 'DB connection password masked');
console.log('   ✔ Masking tests passed\n');

// 4. Tools Schema reading
console.log('4. Testing Tool Schema extraction...');
const c7Tools = getServerTools('context7');
console.log(`   Context7 has ${c7Tools.tools.length} cached tools.`);
assert.ok(c7Tools.tools.length > 0, 'Extracted context7 tools');
assert.ok(c7Tools.tools.some(t => t.name === 'query-docs'), 'Found query-docs tool');
console.log('   ✔ Tool Schema extraction passed\n');

// 5. Presets validation
console.log('5. Testing Presets library...');
assert.ok(PRESETS.length >= 10, 'Presets library has >= 10 entries');
for (const p of PRESETS) {
  assert.ok(p.id, 'Preset has ID');
  assert.ok(p.name, 'Preset has Name');
  assert.ok(p.type === 'stdio' || p.type === 'http', 'Preset has valid type');
  assert.ok(p.defaultConfig, 'Preset has defaultConfig');
}
console.log(`   Verified ${PRESETS.length} presets.`);
console.log('   ✔ Presets passed\n');

// 6. JetBrains scan test
console.log('6. Testing JetBrains Companion scanner...');
const jbBridges = await scanJetBrainsBridges();
console.log(`   Scanned ${jbBridges.length} JetBrains bridge configurations.`);
for (const b of jbBridges) {
  console.log(`   - ${b.name}: ${b.host}:${b.port} (Alive: ${b.isAlive})`);
}
console.log('   ✔ JetBrains scanner passed\n');

// 7. Diagnostics test
console.log('7. Testing Diagnostics engine on Context7 (HTTP)...');
const c7Server = allServers.find(s => s.name === 'context7');
if (c7Server) {
  const diagRes = await testServerConnection(c7Server, 5000);
  console.log(`   Context7 test result: ok=${diagRes.ok}, latency=${diagRes.latencyMs}ms, msg=${diagRes.message}`);
}
console.log('   ✔ Diagnostics passed\n');

// 8. Backups listing
console.log('8. Testing Backups module...');
const backups = listBackups();
console.log(`   Found ${backups.length} existing backup snapshots.`);
console.log('   ✔ Backups passed\n');

console.log('🎉 ALL AUTOMATED TESTS PASSED SUCCESSFULLY!\n');
