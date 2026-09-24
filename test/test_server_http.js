import assert from 'node:assert';
import { startServer } from '../src/server.js';

console.log('Testing HTTP Server endpoints...');
const { server, port, url } = await startServer({ port: 3218 });
console.log(`Server started on ${url}`);

try {
  // Test 1: GET /
  const htmlRes = await fetch(`${url}/`);
  assert.strictEqual(htmlRes.status, 200);
  const htmlText = await htmlRes.text();
  assert.ok(htmlText.includes('Antigravity MCP Manager'), 'HTML contains app title');
  console.log('✔ GET / returned 200 and valid HTML');

  // Test 2: GET /api/servers
  const serversRes = await fetch(`${url}/api/servers`);
  assert.strictEqual(serversRes.status, 200);
  const serversData = await serversRes.json();
  assert.ok(serversData.ok, 'API returned ok: true');
  assert.ok(Array.isArray(serversData.servers), 'API returned servers array');
  assert.ok(serversData.servers.length >= 14, 'API returned >= 14 servers');
  console.log(`✔ GET /api/servers returned ${serversData.servers.length} servers`);

  // Test 3: GET /api/presets
  const presetsRes = await fetch(`${url}/api/presets`);
  assert.strictEqual(presetsRes.status, 200);
  const presetsData = await presetsRes.json();
  assert.ok(presetsData.ok, 'Presets API ok');
  assert.ok(presetsData.presets.length >= 10, 'Presets count >= 10');
  console.log(`✔ GET /api/presets returned ${presetsData.presets.length} presets`);

  // Test 4: GET /api/clean-jetbrains
  const jbRes = await fetch(`${url}/api/clean-jetbrains`);
  assert.strictEqual(jbRes.status, 200);
  const jbData = await jbRes.json();
  assert.ok(jbData.ok, 'JetBrains scan API ok');
  console.log(`✔ GET /api/clean-jetbrains returned total=${jbData.total}, dead=${jbData.dead.length}`);

  console.log('\n🎉 ALL HTTP SERVER ENDPOINTS VERIFIED SUCCESSFULLY!\n');
} finally {
  server.close();
}
