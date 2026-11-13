import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { probeStdioServerWithTools, refreshSingleServer } from '../src/core/mcp-refresh.js';
import { startServer } from '../src/server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function createMockMcpTempWorkspace() {
  const tempWs = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-mcp-refresh-'));
  const agentsDir = path.join(tempWs, '.agents');
  fs.mkdirSync(agentsDir, { recursive: true });

  const mockScriptPath = path.join(tempWs, 'mock-mcp.mjs');
  const mockScript = `
    let buf = '';
    process.stdin.on('data', (chunk) => {
      buf += chunk.toString();
      const idx = buf.lastIndexOf('\\n');
      if (idx === -1) return;
      const lines = buf.slice(0, idx).split('\\n');
      buf = buf.slice(idx + 1);
      for (const line of lines) {
        const t = line.trim();
        if (!t) continue;
        const msg = JSON.parse(t);
        if (msg.id === 1 && msg.method === 'initialize') {
          process.stdout.write(JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            result: { protocolVersion: '2024-11-05', serverInfo: { name: 'mock-mcp', version: '1.0.0' }, capabilities: { tools: {} } }
          }) + '\\n');
        } else if (msg.id === 2 && msg.method === 'tools/list') {
          process.stdout.write(JSON.stringify({
            jsonrpc: '2.0',
            id: 2,
            result: {
              tools: [
                { name: 'mock-ping', description: 'Ping check', inputSchema: { type: 'object', properties: {} } },
                { name: 'mock-echo', description: 'Echo text', inputSchema: { type: 'object', properties: { text: { type: 'string' } } } }
              ]
            }
          }) + '\\n');
        }
      }
    });
  `;
  fs.writeFileSync(mockScriptPath, mockScript, 'utf8');

  const configPath = path.join(agentsDir, 'mcp_config.json');
  const oldTime = new Date(Date.now() - 60_000);
  fs.writeFileSync(configPath, JSON.stringify({
    mcpServers: {
      'mock-echo-srv': {
        command: process.execPath,
        args: [mockScriptPath],
        env: { SECRET_API_KEY: 'super_secret_token_999' },
      },
      'mock-disabled-srv': {
        command: process.execPath,
        args: [mockScriptPath],
        disabled: true,
      },
    },
  }, null, 2), 'utf8');
  fs.utimesSync(configPath, oldTime, oldTime);

  return { tempWs, mockScriptPath, configPath, initialMtime: oldTime.getTime() };
}

function postJson(port, urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body || {});
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: urlPath,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          resolve({ status: res.statusCode, json: JSON.parse(raw) });
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

console.log('🧪 Starting MCP Refresh unit & contract test suite...\n');

const { tempWs, mockScriptPath, configPath, initialMtime } = createMockMcpTempWorkspace();
let started = null;

try {
  // 1. Live Stdio probe with initialize + tools/list
  console.log('1. Testing probeStdioServerWithTools() against mock Stdio MCP...');
  const directProbe = await probeStdioServerWithTools({
    command: process.execPath,
    args: [mockScriptPath],
    env: {},
  }, 5000);
  assert.strictEqual(directProbe.ok, true, 'Direct stdio probe should succeed');
  assert.strictEqual(directProbe.liveTools?.length, 2, 'Should discover 2 live tools');
  assert.strictEqual(directProbe.liveTools[0].name, 'mock-ping');
  console.log(`   ✔ Live probe succeeded in ${directProbe.latencyMs}ms (${directProbe.liveTools.length} tools)\n`);

  // 2. refreshSingleServer end-to-end (reload + mtime nudge + live probe + disabled + missing)
  console.log('2. Testing refreshSingleServer() flows...');
  const refreshRes = await refreshSingleServer('mock-echo-srv', {
    scope: 'workspace',
    workspaceDir: tempWs,
    configPath,
    timeoutMs: 5000,
  });
  assert.strictEqual(refreshRes.ok, true, 'refreshSingleServer should succeed');
  assert.strictEqual(refreshRes.touchedConfig, true, 'Should nudge config file mtime');
  assert.strictEqual(refreshRes.toolsCount, 2, 'Should report 2 discovered tools');
  assert.strictEqual(typeof refreshRes.antigravityRunning, 'boolean', 'Should check Antigravity process state');
  const updatedMtime = fs.statSync(configPath).mtimeMs;
  assert.ok(updatedMtime > initialMtime, 'Config file mtime should advance after refresh');

  const disabledRes = await refreshSingleServer('mock-disabled-srv', {
    scope: 'workspace',
    workspaceDir: tempWs,
    configPath,
  });
  assert.strictEqual(disabledRes.ok, true, 'Disabled server reload should succeed cleanly');
  assert.strictEqual(disabledRes.disabled, true, 'Disabled flag preserved');

  const missingRes = await refreshSingleServer('non-existent-server-xyz', {
    scope: 'workspace',
    workspaceDir: tempWs,
  });
  assert.strictEqual(missingRes.ok, false, 'Missing server should return ok=false');
  assert.strictEqual(missingRes.notFound, true, 'Missing server should set notFound=true');
  console.log('   ✔ refreshSingleServer flows passed\n');

  // 3. HTTP route POST /api/servers/:name/refresh + masking
  console.log('3. Testing HTTP route POST /api/servers/:name/refresh...');
  started = await startServer({ port: 0, workspaceDir: tempWs });
  const httpRes = await postJson(started.port, '/api/servers/mock-echo-srv/refresh', {
    scope: 'workspace',
    workspaceDir: tempWs,
    configPath,
  });
  assert.strictEqual(httpRes.status, 200, 'Refresh route should return HTTP 200');
  assert.strictEqual(httpRes.json.ok, true, 'HTTP refresh should succeed');
  assert.strictEqual(httpRes.json.liveTools?.length, 2, 'HTTP response includes liveTools');
  assert.ok(!httpRes.json.server.env.SECRET_API_KEY.includes('secret_token'), 'Sensitive env token must be masked');
  assert.ok(httpRes.json.server.env.SECRET_API_KEY.includes('******'), 'Mask asterisks must be applied');

  const httpMissing = await postJson(started.port, '/api/servers/missing-srv/refresh', {
    scope: 'workspace',
    workspaceDir: tempWs,
  });
  assert.strictEqual(httpMissing.status, 404, 'Missing server route should return HTTP 404');
  console.log(`   ✔ HTTP refresh route passed on port ${started.port}\n`);

  // 4. Static IPC / Preload / Web UI contract assertions
  console.log('4. Verifying IPC, Preload, API, HTML & Card Renderer contracts...');
  const ipcCode = fs.readFileSync(path.join(rootDir, 'src/desktop/ipc.js'), 'utf8');
  const preloadCode = fs.readFileSync(path.join(rootDir, 'src/desktop/preload.cjs'), 'utf8');
  const apiCode = fs.readFileSync(path.join(rootDir, 'src/web/js/api.js'), 'utf8');
  const htmlCode = fs.readFileSync(path.join(rootDir, 'src/web/index.html'), 'utf8');
  const rendererCode = fs.readFileSync(path.join(rootDir, 'src/web/js/server-card-renderer.js'), 'utf8');
  const refreshMgrCode = fs.readFileSync(path.join(rootDir, 'src/web/js/refresh-manager.js'), 'utf8');

  assert.ok(ipcCode.includes("ipcMain.handle('mcp:refreshServer'"), 'ipc.js registers mcp:refreshServer');
  assert.ok(preloadCode.includes('refreshServer:'), 'preload.cjs exposes refreshServer');
  assert.ok(apiCode.includes('async refreshServer('), 'api.js defines refreshServer');
  assert.ok(htmlCode.includes('id="btnRefreshAllMcp"'), 'index.html renders #btnRefreshAllMcp');
  assert.ok(htmlCode.includes('src="js/refresh-manager.js"'), 'index.html loads refresh-manager.js');
  assert.ok(rendererCode.includes('refreshSingleMcp('), 'server-card-renderer.js renders single-card refresh');
  assert.ok(rendererCode.includes('buildGroupRefreshBtnHtml('), 'server-card-renderer.js renders group refresh');
  assert.ok(rendererCode.includes('refreshAndInspectTools('), 'inspectTools supports one-click live fetch');
  assert.ok(refreshMgrCode.includes('function refreshAllMcp(') && refreshMgrCode.includes('function refreshGroupServers('), 'refresh-manager.js exports global & group refresh handlers');
  console.log('   ✔ UI & IPC contracts passed\n');

  console.log('🎉 ALL MCP REFRESH TESTS PASSED!');
} finally {
  if (started?.server) {
    await new Promise((r) => started.server.close(r));
  }
  fs.rmSync(tempWs, { recursive: true, force: true });
}
