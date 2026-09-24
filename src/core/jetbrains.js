import fs from 'node:fs';
import net from 'node:net';
import { readConfigFile, writeConfigFile } from './config.js';
import { PATHS } from './paths.js';

/**
 * Checks if a TCP port is open locally.
 * @param {string} host
 * @param {number} port
 * @param {number} [timeoutMs=800]
 * @returns {Promise<boolean>}
 */
function testTcpPort(host, port, timeoutMs = 800) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let isConnected = false;

    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      isConnected = true;
      socket.destroy();
      resolve(true);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });

    try {
      socket.connect(port, host);
    } catch {
      resolve(false);
    }
  });
}

/**
 * Parses a JetBrains bridge .bat file to extract host and port.
 * @param {string} batPath
 * @returns {{host: string, port: number}|null}
 */
export function parseJetBrainsBat(batPath) {
  if (!fs.existsSync(batPath)) return null;
  try {
    const content = fs.readFileSync(batPath, 'utf8');
    // Match: StdioBridge 127.0.0.1 58471
    const match = content.match(/StdioBridge\s+([0-9.]+)\s+([0-9]+)/i);
    if (match) {
      return {
        host: match[1],
        port: parseInt(match[2], 10),
      };
    }
  } catch {}
  return null;
}

/**
 * Scans all JetBrains companion bridges in global config and tests their port status.
 * @returns {Promise<Array<{name: string, batPath: string, batExists: boolean, host: string, port: number, isAlive: boolean}>>}
 */
export async function scanJetBrainsBridges() {
  const data = readConfigFile(PATHS.globalConfig);
  const bridges = [];

  for (const [name, cfg] of Object.entries(data.mcpServers || {})) {
    if (name.startsWith('jetbrains-companion-iu-')) {
      const batPath = cfg.command || '';
      const batExists = Boolean(batPath && fs.existsSync(batPath));
      let isAlive = false;
      let host = '127.0.0.1';
      let port = 0;

      if (batExists) {
        const parsed = parseJetBrainsBat(batPath);
        if (parsed) {
          host = parsed.host;
          port = parsed.port;
          isAlive = await testTcpPort(host, port, 800);
        }
      }

      bridges.push({
        name,
        batPath,
        batExists,
        host,
        port,
        isAlive,
      });
    }
  }

  return bridges;
}

/**
 * Cleans up dead/stale JetBrains companion bridges from global config.
 * @returns {Promise<{removed: Array<string>, kept: Array<string>}>}
 */
export async function cleanStaleJetBrainsBridges() {
  const bridges = await scanJetBrainsBridges();
  const deadBridges = bridges.filter(b => !b.isAlive);
  const aliveBridges = bridges.filter(b => b.isAlive);

  if (deadBridges.length === 0) {
    return { removed: [], kept: aliveBridges.map(b => b.name) };
  }

  const data = readConfigFile(PATHS.globalConfig);
  const removed = [];

  for (const dead of deadBridges) {
    delete data.mcpServers[dead.name];
    removed.push(dead.name);
  }

  writeConfigFile(PATHS.globalConfig, data, `clean-stale-jetbrains-bridges-${removed.length}`);

  return {
    removed,
    kept: aliveBridges.map(b => b.name),
  };
}
