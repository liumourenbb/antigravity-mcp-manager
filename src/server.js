import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getServers, toggleServer, saveServer, deleteServer, maskSensitiveServer } from './core/config.js';
import { testServerConnection } from './core/diagnostics.js';
import { getServerTools } from './core/tools.js';
import { PRESETS } from './core/presets.js';
import { scanJetBrainsBridges, cleanStaleJetBrainsBridges } from './core/jetbrains.js';
import { listBackups, restoreBackup } from './core/backup.js';
import { PATHS } from './core/paths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webIndexPath = path.join(__dirname, 'web', 'index.html');

/**
 * Parses JSON body from request.
 */
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 5 * 1024 * 1024) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON format: ' + err.message));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Creates and starts the HTTP server.
 * @param {object} options
 * @param {number} [options.port=3210]
 * @param {string} [options.host='127.0.0.1']
 * @param {string} [options.workspaceDir=process.cwd()]
 * @returns {Promise<{server: http.Server, port: number, url: string}>}
 */
export function startServer({ port = 3210, host = '127.0.0.1', workspaceDir = process.cwd() } = {}) {
  const server = http.createServer(async (req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
    const pathname = parsedUrl.pathname;
    const method = req.method.toUpperCase();

    // Helper: JSON responder
    const sendJson = (statusCode, data) => {
      res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      res.end(JSON.stringify(data));
    };

    // Helper: Error responder
    const sendError = (statusCode, message) => {
      sendJson(statusCode, { ok: false, error: message });
    };

    // Handle OPTIONS CORS preflight
    if (method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      return res.end();
    }

    try {
      // 1. Serve frontend HTML
      if (pathname === '/' || pathname === '/index.html') {
        if (!fs.existsSync(webIndexPath)) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          return res.end('Web dashboard index.html not found.');
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return fs.createReadStream(webIndexPath).pipe(res);
      }

      // 1.1 Serve local vendor scripts (tailwind, lucide - 100% offline!)
      if (pathname.startsWith('/vendor/') && method === 'GET') {
        const filePath = path.join(__dirname, 'web', pathname);
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
          return fs.createReadStream(filePath).pipe(res);
        }
      }

      // 2. GET /api/servers
      if (pathname === '/api/servers' && method === 'GET') {
        const scope = parsedUrl.searchParams.get('scope') || 'all';
        const rawServers = getServers(scope, workspaceDir);
        
        // Scan JetBrains bridges to identify dead ones
        const jbBridges = await scanJetBrainsBridges();
        const deadBridgeNames = new Set(jbBridges.filter(b => !b.isAlive).map(b => b.name));

        const masked = rawServers.map(s => {
          const item = maskSensitiveServer(s);
          if (s.isJetBrainsBridge) {
            item.isDeadBridge = deadBridgeNames.has(s.name);
          }
          return item;
        });

        return sendJson(200, { ok: true, servers: masked });
      }

      // 3. POST /api/servers/:name/toggle
      const toggleMatch = pathname.match(/^\/api\/servers\/([^/]+)\/toggle$/);
      if (toggleMatch && method === 'POST') {
        const name = decodeURIComponent(toggleMatch[1]);
        const body = await parseJsonBody(req);
        const updated = toggleServer(name, body.enabled, body.scope || 'global', workspaceDir);
        return sendJson(200, { ok: true, server: maskSensitiveServer(updated) });
      }

      // 4. POST /api/servers/save
      if (pathname === '/api/servers/save' && method === 'POST') {
        const body = await parseJsonBody(req);
        if (!body.name || !body.config) {
          return sendError(400, 'Missing name or config payload');
        }
        const updated = saveServer(body.name, body.config, body.scope || 'global', workspaceDir);
        return sendJson(200, { ok: true, server: maskSensitiveServer(updated) });
      }

      // 5. DELETE /api/servers/:name
      const deleteMatch = pathname.match(/^\/api\/servers\/([^/]+)$/);
      if (deleteMatch && method === 'DELETE') {
        const name = decodeURIComponent(deleteMatch[1]);
        const scope = parsedUrl.searchParams.get('scope') || 'global';
        const deleted = deleteServer(name, scope, workspaceDir);
        return sendJson(200, { ok: true, deleted });
      }

      // 6. POST /api/servers/:name/test
      const testMatch = pathname.match(/^\/api\/servers\/([^/]+)\/test$/);
      if (testMatch && method === 'POST') {
        const name = decodeURIComponent(testMatch[1]);
        const servers = getServers('all', workspaceDir);
        const target = servers.find(s => s.name === name);
        if (!target) return sendError(404, `Server "${name}" not found`);

        const result = await testServerConnection(target, 6000);
        return sendJson(200, result);
      }

      // 7. GET /api/servers/:name/tools
      const toolsMatch = pathname.match(/^\/api\/servers\/([^/]+)\/tools$/);
      if (toolsMatch && method === 'GET') {
        const name = decodeURIComponent(toolsMatch[1]);
        const info = getServerTools(name);
        return sendJson(200, info);
      }

      // 8. GET /api/presets
      if (pathname === '/api/presets' && method === 'GET') {
        return sendJson(200, { ok: true, presets: PRESETS });
      }

      // 9. JetBrains Bridges: GET scan, POST clean
      if (pathname === '/api/clean-jetbrains') {
        if (method === 'GET') {
          const bridges = await scanJetBrainsBridges();
          return sendJson(200, {
            ok: true,
            total: bridges.length,
            dead: bridges.filter(b => !b.isAlive),
            alive: bridges.filter(b => b.isAlive),
          });
        } else if (method === 'POST') {
          const result = await cleanStaleJetBrainsBridges();
          return sendJson(200, { ok: true, ...result });
        }
      }

      // 10. Backups: GET list, POST restore
      if (pathname === '/api/backups' && method === 'GET') {
        const backups = listBackups('mcp_config.json');
        return sendJson(200, { ok: true, backups });
      }

      const restoreMatch = pathname.match(/^\/api\/backups\/([^/]+)\/restore$/);
      if (restoreMatch && method === 'POST') {
        const backupId = decodeURIComponent(restoreMatch[1]);
        restoreBackup(backupId, PATHS.globalConfig);
        return sendJson(200, { ok: true, message: 'Restored successfully' });
      }

      // 404
      return sendError(404, `API route not found: ${method} ${pathname}`);
    } catch (err) {
      console.error(`[Server Error] ${method} ${pathname}:`, err);
      return sendError(500, err.message);
    }
  });

  return new Promise((resolve, reject) => {
    server.on('error', err => {
      if (err.code === 'EADDRINUSE') {
        // Retry next port
        console.warn(`Port ${port} in use, trying ${port + 1}...`);
        startServer({ port: port + 1, host, workspaceDir }).then(resolve, reject);
      } else {
        reject(err);
      }
    });

    server.listen(port, host, () => {
      const actualPort = server.address().port;
      const url = `http://${host}:${actualPort}`;
      resolve({ server, port: actualPort, url });
    });
  });
}

// Direct execution entry
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer().then(({ url }) => {
    console.log(`\n🚀 Antigravity MCP Manager running at: ${url}`);
    console.log(`Press Ctrl+C to stop.\n`);
  }).catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
