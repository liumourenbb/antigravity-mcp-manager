import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';

/**
 * Tests connection and health of an MCP server.
 * @param {object} server Normalized server object
 * @param {number} [timeoutMs=5000]
 * @returns {Promise<{ok: boolean, latencyMs: number, message: string, details?: any}>}
 */
export async function testServerConnection(server, timeoutMs = 5000) {
  const start = performance.now();

  if (server.type === 'http') {
    return testHttpServer(server, timeoutMs, start);
  } else if (server.type === 'stdio') {
    return testStdioServer(server, timeoutMs, start);
  }

  return {
    ok: false,
    latencyMs: 0,
    message: `Unknown server transport type: ${server.type}`,
  };
}

/**
 * Tests an HTTP / SSE MCP server.
 */
async function testHttpServer(server, timeoutMs, start) {
  const url = server.url;
  if (!url) {
    return { ok: false, latencyMs: 0, message: 'Missing HTTP URL in server config' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers = { ...server.headers };
    // Most MCP servers accept GET or POST or OPTIONS
    const res = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
    clearTimeout(timer);

    const latencyMs = Math.round(performance.now() - start);
    
    // Status 200, 204, 400 (missing payload), 405 (method not allowed), 406 (accept header)
    // indicate the server endpoint is active and listening!
    if (res.status >= 200 && res.status < 500) {
      return {
        ok: true,
        latencyMs,
        status: res.status,
        message: `HTTP endpoint reachable (${res.status} ${res.statusText}) in ${latencyMs}ms`,
      };
    } else {
      return {
        ok: false,
        latencyMs,
        status: res.status,
        message: `Server returned HTTP ${res.status} ${res.statusText}`,
      };
    }
  } catch (err) {
    clearTimeout(timer);
    const latencyMs = Math.round(performance.now() - start);
    if (err.name === 'AbortError') {
      return { ok: false, latencyMs, message: `Connection timed out after ${timeoutMs}ms` };
    }
    return { ok: false, latencyMs, message: `Connection failed: ${err.message}` };
  }
}

/**
 * Tests a Stdio MCP server by sending a standard JSON-RPC initialize request.
 */
/**
 * Builds the standard JSON-RPC initialize payload.
 */
function createInitJsonRpcMessage() {
  return JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'antigravity-mcp-manager',
        version: '1.0.0',
      },
    },
  }) + '\n';
}

/**
 * Attaches stdout/stderr/close/error listeners for the MCP child process.
 */
function attachStdioProcessHandlers(child, start, onFinish) {
  let stdoutData = '';
  let stderrData = '';

  child.on('error', (err) => {
    onFinish({
      ok: false,
      latencyMs: Math.round(performance.now() - start),
      message: `Process error: ${err.message}`,
    });
  });

  child.stderr?.on('data', (chunk) => {
    stderrData += chunk.toString();
  });

  child.stdout?.on('data', (chunk) => {
    stdoutData += chunk.toString();
    const lines = stdoutData.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed.result || parsed.id === 1) {
            try { child.kill(); } catch {}
            const latencyMs = Math.round(performance.now() - start);
            return onFinish({
              ok: true,
              latencyMs,
              message: `MCP JSON-RPC Handshake success in ${latencyMs}ms`,
              serverInfo: parsed.result?.serverInfo || null,
            });
          }
        } catch {}
      }
    }
  });

  child.on('close', (code) => {
    const latencyMs = Math.round(performance.now() - start);
    if (code === 0) {
      onFinish({ ok: true, latencyMs, message: `Process exited with code 0 in ${latencyMs}ms` });
    } else {
      onFinish({
        ok: false,
        latencyMs,
        message: `Process exited with code ${code}`,
        details: { stderr: stderrData.slice(0, 300) || stdoutData.slice(0, 300) },
      });
    }
  });
}

/**
 * Tests a Stdio MCP server by sending a standard JSON-RPC initialize request.
 */
async function testStdioServer(server, timeoutMs, start) {
  const { command, args = [], env = {} } = server;
  if (!command) {
    return { ok: false, latencyMs: 0, message: 'Missing executable command' };
  }

  return new Promise((resolve) => {
    let resolved = false;
    let child = null;

    const finish = (result) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve(result);
      }
    };

    const timer = setTimeout(() => {
      if (child) {
        try { child.kill('SIGTERM'); } catch {}
      }
      finish({
        ok: false,
        latencyMs: Math.round(performance.now() - start),
        message: `Process timed out after ${timeoutMs}ms without response`,
      });
    }, timeoutMs);

    try {
      child = spawn(command, args, {
        env: { ...process.env, ...env },
        shell: process.platform === 'win32',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err) {
      return finish({
        ok: false,
        latencyMs: Math.round(performance.now() - start),
        message: `Failed to spawn command "${command}": ${err.message}`,
      });
    }

    attachStdioProcessHandlers(child, start, finish);

    try {
      child.stdin.write(createInitJsonRpcMessage());
    } catch {}
  });
}
