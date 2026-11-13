import fs from 'fs';
import { spawn } from 'child_process';
import { getServers, findTargetServer } from './config.js';
import { testServerConnection } from './diagnostics.js';
import { getServerTools } from './tools.js';
import { isAntigravityRunning } from './rules.js';

/**
 * Builds a newline-delimited JSON-RPC 2.0 request payload.
 */
function createJsonRpcMessage(id, method, params = {}) {
  const payload = { jsonrpc: '2.0', method, params };
  if (id !== null && id !== undefined) {
    payload.id = id;
  }
  return JSON.stringify(payload) + '\n';
}

/**
 * Touches the config file timestamp without altering contents to nudge file watchers.
 */
export function nudgeConfigTimestamp(configPath) {
  if (!configPath || !fs.existsSync(configPath)) return false;
  try {
    const now = new Date();
    fs.utimesSync(configPath, now, now);
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely kills a spawned child process and closes its stdin.
 */
function stopChildProcess(child) {
  if (!child) return;
  try { child.stdin?.end(); } catch {}
  try { child.kill('SIGTERM'); } catch {}
}

/**
 * Maps raw MCP tools/list items into display-safe descriptors.
 */
function normalizeLiveTools(rawTools) {
  if (!Array.isArray(rawTools)) return [];
  return rawTools.map((t) => ({
    name: t.name,
    description: t.description || '',
    inputSchema: t.inputSchema || t.parameters || {},
  }));
}

/**
 * Sends initialized notification + tools/list after handshake succeeds.
 */
function requestToolsAfterInit(child, timerRef, onGraceTimeout) {
  try {
    child.stdin.write(createJsonRpcMessage(null, 'notifications/initialized', {}));
    child.stdin.write(createJsonRpcMessage(2, 'tools/list', {}));
  } catch {}
  timerRef.grace = setTimeout(() => {
    stopChildProcess(child);
    onGraceTimeout();
  }, 2000);
}

/**
 * Handles parsed JSON-RPC messages for initialize + tools/list sequence.
 */
function handleProbeJsonMessage(msg, state, child, start, done) {
  if (msg.id === 1) {
    if (msg.error) {
      return done({
        ok: false,
        latencyMs: Math.round(performance.now() - start),
        message: msg.error.message || 'MCP initialize rejected',
      });
    }
    state.initDone = true;
    state.serverInfo = msg.result?.serverInfo || null;
    requestToolsAfterInit(child, state.timers, () => {
      done({
        ok: true,
        latencyMs: Math.round(performance.now() - start),
        message: `MCP 握手成功 (${Math.round(performance.now() - start)}ms)`,
        serverInfo: state.serverInfo,
        liveTools: null,
      });
    });
    return;
  }

  if (msg.id === 2) {
    if (state.timers.grace) clearTimeout(state.timers.grace);
    const latencyMs = Math.round(performance.now() - start);
    const liveTools = normalizeLiveTools(msg.result?.tools);
    done({
      ok: true,
      latencyMs,
      message: `MCP 实时探针成功 (${latencyMs}ms, ${liveTools.length} 个工具)`,
      serverInfo: state.serverInfo,
      liveTools: msg.error ? null : liveTools,
    });
  }
}

/**
 * Wires stdout/stderr/close/error listeners for a live Stdio refresh probe.
 */
function attachToolsProbeHandlers(child, start, finish) {
  const state = { initDone: false, serverInfo: null, timers: { grace: null } };
  let stdoutBuf = '';
  let stderrBuf = '';

  const done = (res) => {
    if (state.timers.grace) clearTimeout(state.timers.grace);
    stopChildProcess(child);
    finish(res);
  };

  child.on('error', (err) => {
    done({ ok: false, latencyMs: Math.round(performance.now() - start), message: `Process error: ${err.message}` });
  });
  child.stderr?.on('data', (chunk) => { stderrBuf += chunk.toString(); });
  child.stdout?.on('data', (chunk) => {
    stdoutBuf += chunk.toString();
    const lastNl = stdoutBuf.lastIndexOf('\n');
    if (lastNl === -1) return;
    const completeLines = stdoutBuf.slice(0, lastNl).split('\n');
    stdoutBuf = stdoutBuf.slice(lastNl + 1);
    for (const rawLine of completeLines) {
      const trimmed = rawLine.trim();
      if (!trimmed.startsWith('{')) continue;
      try {
        handleProbeJsonMessage(JSON.parse(trimmed), state, child, start, done);
      } catch {}
    }
  });
  child.on('close', (code) => {
    const latencyMs = Math.round(performance.now() - start);
    if (state.initDone) {
      return done({ ok: true, latencyMs, message: `MCP 握手成功 (${latencyMs}ms)`, serverInfo: state.serverInfo, liveTools: null });
    }
    done({
      ok: code === 0,
      latencyMs,
      message: code === 0 ? `Process exited cleanly in ${latencyMs}ms` : `Process exited with code ${code}`,
      details: { stderr: stderrBuf.slice(0, 300) || stdoutBuf.slice(0, 300) },
    });
  });
}

/**
 * Probes a Stdio MCP server via JSON-RPC initialize + tools/list.
 */
export async function probeStdioServerWithTools(server, timeoutMs = 8000) {
  const start = performance.now();
  const { command, args = [], env = {} } = server;
  if (!command) {
    return { ok: false, latencyMs: 0, message: 'Missing executable command' };
  }

  return new Promise((resolve) => {
    let settled = false;
    let child = null;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(outerTimer);
      resolve(result);
    };

    const outerTimer = setTimeout(() => {
      stopChildProcess(child);
      finish({ ok: false, latencyMs: Math.round(performance.now() - start), message: `探针超时 (${timeoutMs}ms)` });
    }, timeoutMs);

    try {
      child = spawn(command, args, {
        env: { ...process.env, ...env },
        shell: process.platform === 'win32',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err) {
      return finish({ ok: false, latencyMs: 0, message: `无法启动 "${command}": ${err.message}` });
    }

    attachToolsProbeHandlers(child, start, finish);

    try {
      child.stdin.write(createJsonRpcMessage(1, 'initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'antigravity-mcp-manager', version: '1.0.0' },
      }));
    } catch {}
  });
}

/**
 * Builds an honest user-facing summary message for single-server refresh.
 */
function buildRefreshMessage(target, probeResult, touchedConfig, antigravityRunning) {
  const nudgeHint = touchedConfig ? '，已触发配置变更时间戳' : '';
  const desktopHint = antigravityRunning
    ? '（Antigravity 运行中：若对话仍保留旧会话请在桌面端 Customizations → Installed → ⋮ → Restart）'
    : '';

  if (target.disabled) {
    return `已重载 ${target.name} 配置${nudgeHint}（服务当前处于禁用状态）`;
  }
  if (!probeResult?.ok) {
    return `重载配置成功，但实时探针失败: ${probeResult?.message || '未知错误'}`;
  }
  const toolsSuffix = Array.isArray(probeResult.liveTools) ? `，实时识别 ${probeResult.liveTools.length} 个工具` : '';
  return `刷新与探针成功 (${probeResult.latencyMs}ms)${toolsSuffix}${nudgeHint}${desktopHint}`;
}

/**
 * Reloads disk config for a single MCP server, nudges config mtime, and runs live probe.
 */
export async function refreshSingleServer(name, options = {}) {
  const { scope = 'all', workspaceDir, configPath, timeoutMs = 8000, nudge = true } = options;
  const servers = getServers('all', workspaceDir);
  const target = findTargetServer(servers, name, scope, workspaceDir, configPath);
  if (!target) {
    return { ok: false, notFound: true, message: `未找到 MCP 服务 "${name}"` };
  }

  const touchedConfig = nudge ? nudgeConfigTimestamp(target.configPath) : false;
  const antigravityRunning = isAntigravityRunning();
  const cachedInfo = getServerTools(target.name);
  const cachedTools = cachedInfo.tools || [];

  if (target.disabled) {
    return {
      ok: true,
      disabled: true,
      server: target,
      latencyMs: 0,
      liveTools: null,
      cachedTools,
      toolsCount: cachedInfo.toolsCount || 0,
      touchedConfig,
      antigravityRunning,
      message: buildRefreshMessage(target, null, touchedConfig, antigravityRunning),
    };
  }

  const probeResult = target.type === 'http'
    ? await testServerConnection(target, timeoutMs)
    : await probeStdioServerWithTools(target, timeoutMs);

  const liveTools = Array.isArray(probeResult.liveTools) ? probeResult.liveTools : null;
  const toolsCount = liveTools ? liveTools.length : (cachedInfo.toolsCount || 0);

  return {
    ok: Boolean(probeResult.ok),
    disabled: false,
    server: target,
    latencyMs: probeResult.latencyMs ?? 0,
    serverInfo: probeResult.serverInfo || null,
    liveTools,
    cachedTools,
    toolsCount,
    touchedConfig,
    antigravityRunning,
    details: probeResult.details || null,
    message: buildRefreshMessage(target, probeResult, touchedConfig, antigravityRunning),
  };
}
